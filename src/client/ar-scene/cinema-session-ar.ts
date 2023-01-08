import { BoxGeometry, HemisphereLight, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { EventType } from "./controllers-ar";
import { ControllersAR } from "./controllers-ar";
import { PlanesManager } from "./planes-manager";
import { GazeManager } from "./gaze-manager";
import { CinemaSession } from "../cinema-session";

const AR_SCREEN_ANCHORS_STATE = 'cinema_room_ar_screen_anchors';

export class CinemaSessionAR extends CinemaSession {
    private anchorsAdded = new Set();
    private planeManager?: PlanesManager;
    private controllers?: ControllersAR;
    private gazeManager?: GazeManager;
    private screenPosition?: Vector3;
    private creatingAnchors = false;
    private anchorMetadata?: {
        id: string;
        zoom: number;
        translateX: number;
        translateY: number;
        translateZ: number;
    };
    private anchorCube?: Mesh;

    constructor(sessionEndCallback: () => void) {
        const xrSessionConfig = {
            requiredFeatures: ['anchors', 'plane-detection'], // TODO: add hit-test when working on Quest.
            optionalFeatures: [ 'hand-tracking', 'layers' ]
        };

        super(sessionEndCallback, xrSessionConfig, {
            createButton: ARButton.createButton,
            requestSession: config => (navigator as any).xr.requestSession('immersive-ar', config)
        });
    }

    public destroy() {
        super.destroy();
        this.planeManager?.destroy();
        this.gazeManager?.destroy();
        this.clearAnchorsListeners();
    }

    protected postInit() {
        const light = new HemisphereLight(0xffffff, 0xbbbbff, 1);

        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        this.controllers = new ControllersAR(this.renderer.xr, this.scene, this.handleControllerEvent, this.camera);
        this.planeManager = new PlanesManager(this.renderer, this.scene);
        this.initAnchorsListeners();
        this.gazeManager = new GazeManager(this.camera, this.scene);
    }

    protected onLoading() {
        this.controllers?.updateInfoText('loading...');
    }

    protected onPause() {
        this.controllers?.updateInfoText('paused');
    }

    protected onPlay() {
        this.controllers?.updateInfoText('playing');        
    }

    protected postStart() {
        this.restoreAnchorMetadata();
    }

    protected updateState() {
        this.gazeManager?.update();
        this.controllers?.update();
    }

    private saveAnchorMetadata() {
        if (!this.anchorMetadata) return;
        localStorage.setItem(AR_SCREEN_ANCHORS_STATE, JSON.stringify(this.anchorMetadata));
    }

    private restoreAnchorMetadata() {
        const val = localStorage.getItem(AR_SCREEN_ANCHORS_STATE);
        this.anchorMetadata = JSON.parse(val!);
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
            const frame = await (this.renderer.xr as any).getFrame();
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

            this.setupVideoPlayer(boxMesh, anchorZoom, anchorTranslation);
        } );
    };

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

                await (this.renderer.xr as any).deleteAnchor(this.anchorMetadata.id);
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
            this.anchorMetadata.id = await (this.renderer.xr as any).createAnchor(anchorPosition, anchorRotation, true);
            this.saveAnchorMetadata();
            this.screenPosition = anchorPosition;
        } catch (e) {
            this.anchorMetadata = undefined;
            throw e;
        } finally {
            this.creatingAnchors = false;
        }
    }
}
