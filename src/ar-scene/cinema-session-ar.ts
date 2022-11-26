import { BoxGeometry, Camera, Euler, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshPhongMaterial, PerspectiveCamera, Quaternion, RingGeometry, Scene, Vector3, WebGLRenderer, WebXRManager } from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { EventType } from "../client/controllers";
import { throttle } from "../common/throttle";
import { PlayoutData } from "../common/net-scheme";
import { ControllersAR } from "./controllers-ar";
import { PlanesManager } from "./planes-manager";
import { RaycastingManager } from "./raycasting-manager";
import { VideoPlayer } from "./videoplayer";

export class CinemaSessionAR {
    private renderer: any;
    private scene?: Scene;
    private camera?: Camera;
    private session: any;
    private anchorCubes = new Map();
    private anchorsAdded = new Set();
    private controller0?: Group;
    private controller1?: Group;
    private videoPlayer?: VideoPlayer;
    private planeManager?: PlanesManager;
    private controllers?: ControllersAR;
    private raycastingManager?: RaycastingManager;
    private updateScreenSize?: (percentage: number) => void;
    private remoteAsset?: PlayoutData;
    private screenAnchor?: Vector3;
    private creatingAnchors = false;

    constructor(private sessionEndCallback: () => void) {
        this.init();
    }

    private async init() {

        const container = document.getElementById('container');

        this.scene = new Scene();

        this.camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );

        const light = new HemisphereLight( 0xffffff, 0xbbbbff, 1 );
        light.position.set( 0.5, 1, 0.25 );
        this.scene.add( light );

        //

        this.renderer = new WebGLRenderer( { antialias: true, alpha: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.xr.enabled = true;
        container!.appendChild( this.renderer.domElement );
        this.renderer.setAnimationLoop(this.render);

        //

        const xrSessionConfig = {
            requiredFeatures: ['anchors', 'plane-detection'], // TODO: add hit-test when working on Quest.
            optionalFeatures: [ 'hand-tracking', 'layers' ]
        };

        const arButton = ARButton.createButton( this.renderer,  xrSessionConfig);
        container!.appendChild(arButton);
        this.listenForExternalRequests(xrSessionConfig);

        this.controller0 = this.renderer.xr.getController( 0 );
        this.scene.add( this.controller0! );

        this.controller1 = this.renderer.xr.getController( 1 );
        this.scene.add( this.controller1! );

        this.controllers = new ControllersAR(this.renderer, this.scene, this.handleControllerEvent, this.controller0!, this.controller1!, this.camera);

        window.addEventListener( 'resize', this.onWindowResize );

        this.renderer.xr.addEventListener( 'sessionstart', this.onSessionStart);

        // Init planes.
        this.planeManager = new PlanesManager(this.renderer, this.scene);

        // Init anchors.
        this.initAnchorsListeners();

        // Init raycasting.
        this.raycastingManager = new RaycastingManager(this.controller0!, this.camera, this.scene);
    }

    private listenForExternalRequests(xrSessionConfig: {
        requiredFeatures: string[];
        optionalFeatures: string[];
    }) {
        window.addEventListener('message', async (e) => {
            console.log("Received message: ", e.data);
            this.remoteAsset = e.data;
            console.log(this.remoteAsset);

            const session: XRSession = await (navigator as any).xr.requestSession( 'immersive-ar', xrSessionConfig );
            this.renderer.xr.setReferenceSpaceType('local');
            this.renderer.xr.setSession(session);
        });
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

    destroy() {
        const container = document.getElementById('container');

        container!.innerHTML = '';
        this.planeManager?.destroy();
        this.raycastingManager?.destroy();
        this.clearAnchorsListeners();
        this.videoPlayer?.destroy();
        this.session.removeEventListener('end', this.onDestroy);
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
                this.videoPlayer = new VideoPlayer(this.controllers!);
                this.videoPlayer.init(this.remoteAsset);
            }

            this.updateScreenSize = throttle((percent: number) => this.videoPlayer!.updateScreenSize(percent), 200);

            this.videoPlayer.showVideoPlayer(this.renderer, this.session, boxMesh, this.camera!);

            this.anchorCubes.set( anchor, boxMesh );
        } );
    };

    private async handleSelectWall() {
        let __a = new Vector3(), anchorRotation = new Quaternion(), __b = new Vector3();
        const anchorPosition = this.raycastingManager?.getLatestVerticalHitCenter();
        const anchorsId = 'webxr_ar_anchors_handles';
        const val = localStorage.getItem( anchorsId );
        const persistentHandles = JSON.parse( val! ) || [];

        if (this.creatingAnchors
            || anchorPosition === undefined
            || (this.screenAnchor && anchorPosition.equals(this.screenAnchor))) {
            return;
        }

        this.raycastingManager?.getLatestVerticalHitObject()?.matrixWorld.decompose(__a, anchorRotation, __b);

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

    private onWindowResize() {
        (this.camera as any).aspect = window.innerWidth / window.innerHeight;
        (this.camera as any).updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    private render = () => {
        if (!this.renderer.xr.isPresenting) return;

        this.raycastingManager?.render();
        this.controllers?.update();

        this.renderer.render(this.scene, this.camera);
    }
}
