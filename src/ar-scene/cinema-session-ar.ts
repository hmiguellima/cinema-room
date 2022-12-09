import { BoxGeometry, Camera, Euler, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshPhongMaterial, PerspectiveCamera, Quaternion, RingGeometry, Scene, Vector3, WebGLRenderer, WebXRManager } from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { EventType } from "./controllers-ar";
import { PlayoutData } from "../common/net-scheme";
import { ControllersAR } from "./controllers-ar";
import { PlanesManager } from "./planes-manager";
import { GazeManager } from "./gaze-manager";
import { VideoPlayer } from "./videoplayer";

const AR_SCREEN_ANCHORS_STATE = 'cinema_room_ar_screen_anchors';

export class CinemaSessionAR {
    private renderer: any;
    private scene?: Scene;
    private camera?: Camera;
    private session: any;
    private anchorsAdded = new Set();
    private videoPlayer?: VideoPlayer;
    private planeManager?: PlanesManager;
    private controllers?: ControllersAR;
    private gazeManager?: GazeManager;
    private remoteAsset?: PlayoutData;
    private screenPosition?: Vector3;
    private creatingAnchors = false;
    private xrSessionConfig?: {
        requiredFeatures: string[];
        optionalFeatures: string[];
    };
    private anchorMetadata?: {
        id: string;
        zoom: number;
        translateX: number;
        translateY: number;
        translateZ: number;
    };
    private anchorCube?: Mesh;

    constructor(private sessionEndCallback: () => void) {
        this.init();
    }

    private async init() {

        const container = document.getElementById('container');

        this.scene = new Scene();

        this.camera = new PerspectiveCamera(70, 2, 0.01, 20);

        const light = new HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        this.renderer = new WebGLRenderer( { antialias: true, alpha: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.xr.enabled = true;
        container!.appendChild( this.renderer.domElement );
        this.renderer.setAnimationLoop(this.render);

        this.xrSessionConfig = {
            requiredFeatures: ['anchors', 'plane-detection'], // TODO: add hit-test when working on Quest.
            optionalFeatures: [ 'hand-tracking', 'layers' ]
        };

        const arButton = ARButton.createButton(this.renderer,  this.xrSessionConfig);
        container!.appendChild(arButton);
        this.listenForExternalRequests();

        this.controllers = new ControllersAR(this.renderer, this.scene, this.handleControllerEvent, this.camera);

        this.renderer.xr.addEventListener( 'sessionstart', this.onSessionStart);

        // Init planes.
        this.planeManager = new PlanesManager(this.renderer, this.scene);

        // Init anchors.
        this.initAnchorsListeners();

        // Init gaze detection
        this.gazeManager = new GazeManager(this.camera, this.scene);
    }

    private listenForExternalRequests() {
        window.addEventListener('message', this.handleExternalPlayoutRequest);
    }

    private handleExternalPlayoutRequest = async (e: MessageEvent<any>) => {
        console.log('Received message:', JSON.stringify(e.data));
        if (e.data && e.data.type === 'asset') {
            this.remoteAsset = e.data.asset;

            const session: XRSession = await (navigator as any).xr.requestSession('immersive-ar', this.xrSessionConfig);
            this.renderer.xr.setReferenceSpaceType('local');
            this.renderer.xr.setSession(session);
        }
    }

    private onDestroy = () => {
        this.destroy();
        this.sessionEndCallback();
    }

    private saveAnchorMetadata() {
        if (!this.anchorMetadata) return;
        localStorage.setItem(AR_SCREEN_ANCHORS_STATE, JSON.stringify(this.anchorMetadata));
    }

    private restoreAnchorMetadata() {
        const val = localStorage.getItem(AR_SCREEN_ANCHORS_STATE);
        this.anchorMetadata = JSON.parse(val!);
    }

    private onSessionStart = async (event: any) => {
        this.camera?.position.set(0, 0, 0);

        const val = localStorage.getItem(AR_SCREEN_ANCHORS_STATE);
        const persistentAnchors = JSON.parse(val!) || [];

        this.restoreAnchorMetadata();
        if (this.anchorMetadata) {
            this.renderer.xr.restoreAnchor(this.anchorMetadata.id);
        }

        this.session = (event.target as WebXRManager).getSession();
        this.session.addEventListener('end', this.onDestroy);
    }

    destroy() {
        const container = document.getElementById('container');

        container!.innerHTML = '';
        this.planeManager?.destroy();
        this.gazeManager?.destroy();
        this.clearAnchorsListeners();
        this.videoPlayer?.destroy();
        this.session.removeEventListener('end', this.onDestroy);
        window.removeEventListener('message', this.handleExternalPlayoutRequest);
    }

    private updateScreenZoom(zoom?: number) {
        if (!this.anchorMetadata || !zoom) return;
        this.anchorMetadata.zoom = zoom;
        this.saveAnchorMetadata();
    }

    private updateScreenTranslation(translation?: Vector3) {
        if (!this.anchorMetadata || !translation) return;
        this.anchorMetadata.translateX = translation.x;
        this.anchorMetadata.translateY = translation.y;
        this.anchorMetadata.translateZ = translation.z;
        this.saveAnchorMetadata();
    }

    private handleControllerEvent = (evt: EventType) => {
        switch (evt) {
            case EventType.pause:
                this.videoPlayer?.pause();
                break;
            case EventType.play:
                this.videoPlayer?.play();
                break;
            case EventType.exit:
                this.videoPlayer?.pause();
                this.session?.end();
                break;
            case EventType.screen_size_increase:
                this.updateScreenZoom(this.videoPlayer?.updateScreenSize(10));
                break;
            case EventType.screen_size_decrease:
                this.updateScreenZoom(this.videoPlayer?.updateScreenSize(-10));
                break;
            case EventType.move_screen_right:
                this.updateScreenTranslation(this.videoPlayer?.translateScreenPos(0.1, 0, 0));
                break;
            case EventType.move_screen_left:
                this.updateScreenTranslation(this.videoPlayer?.translateScreenPos(-0.1, 0, 0));
                break;
            case EventType.move_screen_up:
                this.updateScreenTranslation(this.videoPlayer?.translateScreenPos(0, 0.1, 0));
                break;
            case EventType.move_screen_down:
                this.updateScreenTranslation(this.videoPlayer?.translateScreenPos(0, -0.1, 0));
                break;    
            case EventType.set_wall:
                this.handleSelectWall();
                break;
        }
    }

    private initAnchorsListeners() {
        // TODO: move anchors to separate class.

        this.renderer.xr.addEventListener( 'anchoradded', this.anchorAdded);
        this.renderer.xr.addEventListener( 'anchorremoved', this.anchorRemoved);
        this.renderer.xr.addEventListener( 'anchorposechanged', this.anchorChanged);
        this.renderer.xr.addEventListener( 'anchorsdetected', this.anchorsDetected);
    }

    private clearAnchorsListeners() {
        this.renderer.xr.removeEventListener( 'anchoradded', this.anchorAdded);
        this.renderer.xr.removeEventListener( 'anchorremoved', this.anchorRemoved);
        this.renderer.xr.removeEventListener( 'anchorposechanged', this.anchorChanged);
        this.renderer.xr.removeEventListener( 'anchorsdetected', this.anchorsDetected);
    }

    private anchorAdded = () => {
        // console.log( "anchor added", e.data )
    };

    private anchorRemoved = () => {
        // console.log( "anchor removed", e.data )
    };

    private anchorChanged = (e: any) => {
        // console.log( "anchor changed", e.data )
    };

    private anchorsDetected = async (e: any) => {
        const detectedAnchors = e.data;

        if (detectedAnchors?.length === 0) return;

        detectedAnchors.forEach(async (anchor: any) => {
            if (this.anchorsAdded.has(anchor)) return;

            console.log('New anchor detected');
            if (!this.anchorMetadata) {
                throw 'Expected anchor metadata but none found';
            }

            this.anchorsAdded.add(anchor);
            const anchorZoom = this.anchorMetadata.zoom;
            const anchorTranslation = new Vector3(this.anchorMetadata.translateX, this.anchorMetadata.translateY, this.anchorMetadata.translateZ);

            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const frame = await this.renderer.xr.getFrame();
            const anchorPose = await frame.getPose(anchor.anchorSpace, referenceSpace);

            const boxMesh = new Mesh(
                new BoxGeometry(0.85, 0.5, 0.01),
                new MeshBasicMaterial({color: 0, opacity: 1})
            );
            boxMesh.position.setX(anchorPose.transform.position.x);
            boxMesh.position.setY(anchorPose.transform.position.y);
            boxMesh.position.setZ(anchorPose.transform.position.z);
            boxMesh.setRotationFromQuaternion(anchorPose.transform.orientation);
            boxMesh.rotateOnAxis(new Vector3(1, 0, 0), Math.PI / 2);

            this.scene?.add(boxMesh);
            this.anchorCube = boxMesh;

            if (this.videoPlayer === undefined) {
                this.videoPlayer = new VideoPlayer(this.controllers!, this.handleLicenseReq);
                await this.videoPlayer.init(this.remoteAsset);
            }

            console.log('**** showVideoPlayer');
            this.videoPlayer.showVideoPlayer(this.renderer, this.session, boxMesh, anchorZoom, anchorTranslation);
        } );
    };

    private async handleLicenseReq(req: shaka.extern.Request): Promise<shaka.extern.Request> {
        console.log('**** Sending decorateLicense request');
        window.parent.postMessage({type: 'decorateLicense', decorateLicense: req});
        return new Promise((resolve, reject) => {
            let waitingForResponse = true;

            const timeout = window.setTimeout(() => {
                if (waitingForResponse) {
                    window.removeEventListener('message', listener);
                    reject('handleLicenseReq:timeout');
                }
            }, 5000);

            const listener = (event: any) => {
                if (event.data.type === 'licenseRequest') {
                    console.log('**** received decorated license', JSON.stringify(event.data.licenseRequest));
                    waitingForResponse = false;
                    window.removeEventListener('message', listener);
                    window.clearTimeout(timeout);
                    resolve(event.data.licenseRequest);
                }
            };
            window.addEventListener('message', listener);
        });
    }

    private async handleSelectWall() {
        let __a = new Vector3(), anchorRotation = new Quaternion(), __b = new Vector3();
        const anchorPosition = this.gazeManager?.getLatestVerticalHitCenter();

        if (this.creatingAnchors
            || anchorPosition === undefined
            || (this.screenPosition && anchorPosition.equals(this.screenPosition))) {
            return;
        }

        this.gazeManager?.getLatestVerticalHitObject()?.matrixWorld.decompose(__a, anchorRotation, __b);

        this.creatingAnchors = true;

        try {
            // For now we only allow the screen to anchor to a single place
            // but in the future it would be cool to setup different places
            // and then have a way to move the screen across the previously
            // defined places
            if (this.anchorMetadata) {
                console.log('**** clearing all the anchors');

                await this.renderer.xr.deleteAnchor(this.anchorMetadata.id);
                localStorage.removeItem(AR_SCREEN_ANCHORS_STATE);

                if (this.anchorCube) {
                    this.scene?.remove(this.anchorCube);
                    this.anchorCube = undefined;
                }
            }

            // Create a new anchor
            console.log('**** creating anchor');
            this.anchorMetadata = {
                id: '',
                zoom: 100,
                translateX: 0,
                translateY: 0,
                translateZ: 0
            };
            this.anchorMetadata.id = await this.renderer.xr.createAnchor(anchorPosition, anchorRotation, true);
            this.saveAnchorMetadata();
            this.screenPosition = anchorPosition;
        } catch (e) {
            this.anchorMetadata = undefined;
            throw e;
        } finally {
            this.creatingAnchors = false;
        }
    }

    private render = () => {
        if (!this.renderer.xr.isPresenting) return;

        this.gazeManager?.render();
        this.controllers?.update();

        this.renderer.render(this.scene, this.camera);
    }
}
