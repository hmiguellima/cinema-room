import { BoxGeometry, Camera, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer, WebXRManager } from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { EventType } from "../client/controllers";
import { throttle } from "../common/throttle";
import { PlayoutData } from "../common/net-scheme";
import { ControllersAR } from "./controllers-ar";
import { PlanesManager } from "./planes-manager";
import { GazeManager } from "./gaze-manager";
import { VideoPlayer } from "./videoplayer";
import { AnchorsManager } from "./anchors-manager";
import { UIManager } from "./ui-manager";

export class CinemaSessionAR {
    private renderer: any;
    private scene?: Scene;
    private camera?: Camera;
    private session: any;
    private anchorCubes = new Map();
    private anchorsAdded = new Set();
    private videoPlayer?: VideoPlayer;
    private planeManager?: PlanesManager;
    private controllers?: ControllersAR;
    private gazeManager?: GazeManager;
    private updateScreenSize?: (percentage: number) => void;
    private remoteAsset?: PlayoutData;
    private screenAnchor?: Vector3;
    private creatingAnchors = false;
    private xrSessionConfig?: {
        requiredFeatures: string[];
        optionalFeatures: string[];
    };
    private anchorsManager?: AnchorsManager;
    private UIManager?: UIManager;

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

        //

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
        this.anchorsManager = new AnchorsManager(this.renderer);
        this.initAnchorsListeners();

        // Init gaze detection
        this.gazeManager = new GazeManager(this.camera, this.scene);

        // Init UI manager.
        this.UIManager = new UIManager(this.scene);
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

    private onSessionStart = async (event: any) => {
        this.camera?.position.set( 0, 0, 0 );

        const val = localStorage.getItem( 'webxr_ar_anchors_handles' );
        const persistentHandles = JSON.parse( val! ) || [];

        for (const uuid of persistentHandles) {
            this.renderer.xr.restoreAnchor( uuid );
        }

        this.session = (event.target as WebXRManager).getSession();
        this.session.addEventListener('end', this.onDestroy);
    }

    private destroy() {
        const container = document.getElementById('container');

        container!.innerHTML = '';
        this.planeManager?.destroy();
        this.gazeManager?.destroy();
        this.anchorsManager?.destroy();
        this.clearAnchorsListeners();
        this.videoPlayer?.destroy();
        this.session.removeEventListener('end', this.onDestroy);
        window.removeEventListener('message', this.handleExternalPlayoutRequest);
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
                this.updateScreenSize?.(10);
                break;
            case EventType.screen_size_decrease:
                this.updateScreenSize?.(-10);
                break;
            case EventType.set_wall:
                this.handleSelectWall();
                break;
        }
    }

    private initAnchorsListeners() {
        // TODO: move anchors to separate class.
        this.renderer.xr.addEventListener( 'anchorsdetected', this.anchorsDetected);
    }

    private clearAnchorsListeners() {
        this.renderer.xr.removeEventListener( 'anchorsdetected', this.anchorsDetected);
    }

    private anchorsDetected = async (e: any) => {
        const detectedAnchors = e.data;

        if (detectedAnchors?.length === 0) return;

        detectedAnchors.forEach( async (anchor: any) => {
            if ( this.anchorsAdded.has( anchor ) ) return;

            console.log('New anchor detected');

            this.anchorsAdded.add( anchor );

            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const frame = await this.renderer.xr.getFrame();
            const anchorPose = await frame.getPose( anchor.anchorSpace, referenceSpace );

            // Sample anchor placeholder. Set as transparent to not be shown on top of the screen.
            const boxMesh = new Mesh(
                new BoxGeometry(0.85, 0.5, 0.01),
                new MeshBasicMaterial({color: 0, opacity: 1})
            );
            boxMesh.position.setX(anchorPose.transform.position.x);
            boxMesh.position.setY(anchorPose.transform.position.y);
            boxMesh.position.setZ(anchorPose.transform.position.z);
            boxMesh.setRotationFromQuaternion(anchorPose.transform.orientation);
            boxMesh.rotateOnAxis(new Vector3(1, 0, 0), Math.PI / 2);

            this.scene?.add( boxMesh );

            if (this.videoPlayer === undefined) {
                this.videoPlayer = new VideoPlayer(this.controllers!, this.handleLicenseReq);
                await this.videoPlayer.init(this.remoteAsset);
            }

            this.updateScreenSize = throttle((percent: number) => this.videoPlayer!.updateScreenSize(percent), 200);

            console.log('**** showVideoPlayer');
            this.videoPlayer.showVideoPlayer(this.renderer, this.session, boxMesh, this.camera!);

            this.anchorCubes.set( anchor, boxMesh );
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
        const anchorsId = 'webxr_ar_anchors_handles';
        const val = localStorage.getItem( anchorsId );
        const persistentHandles = JSON.parse( val! ) || [];

        if (this.creatingAnchors
            || anchorPosition === undefined
            || (this.screenAnchor && anchorPosition.equals(this.screenAnchor))) {
            return;
        }

        this.gazeManager?.getLatestVerticalHitObject()?.matrixWorld.decompose(__a, anchorRotation, __b);

        this.creatingAnchors = true;

        try {
            // Clear previous anchor
            if (persistentHandles.length >= 1) {
                console.log('**** clearing all the anchors');

                while( persistentHandles.length != 0 ) {
                    const handle = persistentHandles.pop();
                    await this.renderer.xr.deleteAnchor( handle );
                    localStorage.setItem( anchorsId, JSON.stringify( persistentHandles ) );
                }

                this.anchorCubes.forEach( ( cube ) => {
                    this.scene?.remove( cube );
                } );

                this.anchorCubes = new Map();
            }

            // Create a new anchor
            console.log('**** creating anchor', anchorsId);
            const uuid = await this.renderer.xr.createAnchor(anchorPosition, anchorRotation, true);
            persistentHandles.push(uuid);
            localStorage.setItem(anchorsId, JSON.stringify(persistentHandles));
            this.screenAnchor = anchorPosition;
        } finally {
            this.creatingAnchors = false;
        }
    }

    /*
    private onWindowResize() {
        (this.camera as any).aspect = window.innerWidth / window.innerHeight;
        (this.camera as any).updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
    */

    private render = () => {
        if (!this.renderer.xr.isPresenting) return;

        this.gazeManager?.render();
        this.controllers?.update();

        this.renderer.render(this.scene, this.camera);

        this.UIManager?.render();
    }
}
