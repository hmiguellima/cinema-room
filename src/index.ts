import { Color, Group, HemisphereLight, PerspectiveCamera, Scene, sRGBEncoding, Vector3, WebGLRenderer, XRSession } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Player } from 'shaka-player';

declare global {
    class XRMediaBinding {
        constructor(session: XRSession | null);
        createQuadLayer(el: HTMLVideoElement, init: any): Promise<any>;
    }

    class XRRigidTransform {
        constructor(init: any);
    }
}

class VRControllers {
    private controller1: Group;
    private controller2: Group;
    private controllerGrip1: Group;
    private controllerGrip2: Group;
    private hand1: Group;
    private hand2: Group;

    constructor(renderer: WebGLRenderer, scene: Scene) {
        // controllers
        this.controller1 = renderer.xr.getController(0);
        scene.add(this.controller1);

        this.controller2 = renderer.xr.getController(1);
        scene.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();
        const handModelFactory = new XRHandModelFactory().setPath('./models/fbx/');

        // Hand 1
        this.controllerGrip1 = renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        scene.add(this.controllerGrip1);

        this.hand1 = renderer.xr.getHand(0);
        this.hand1.add(handModelFactory.createHandModel(this.hand1));

        scene.add(this.hand1);

        // Hand 2
        this.controllerGrip2 = renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add( controllerModelFactory.createControllerModel(this.controllerGrip2));
        scene.add(this.controllerGrip2);

        this.hand2 = renderer.xr.getHand(1);
        this.hand2.add(handModelFactory.createHandModel(this.hand2));
        scene.add(this.hand2);
    }
}

class VRSession {
    public readonly button: HTMLElement;

    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;
    private controllers: VRControllers;
    private layersPromise: Promise<void>;
    private notifyLayersReady?: () => void;
    private layersReady = false;
    private tvPosition?: Vector3;
    private video?: HTMLVideoElement;
    private player?: Player;

    constructor(private container: HTMLElement) {
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
        this.camera.position.set(0, 0, 0);
        this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearAlpha(1);
        this.renderer.setClearColor(new Color(0), 0);
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.scene.add( new HemisphereLight(0x808080, 0x606060));

        this.controllers = new VRControllers(this.renderer, this.scene);
        container.appendChild(this.renderer.domElement);

        this.button = VRButton.createButton(this.renderer);

        window.addEventListener( 'resize', this.resize);

        this.renderer.setAnimationLoop(this.render);

        this.layersPromise = new Promise<void>((resolve) => {
            this.notifyLayersReady = resolve;
        });
    }

    public setupDebugControls() {
        const controls = new OrbitControls(this.camera, this.container);
        controls.target.set(0, 1, -0.5);
        controls.update();
    }

    public async run() {
        await this.loadScene();
        if (!this.tvPosition) {
            throw new Error('expected tvPosition');
        }

        await Promise.all([this.loadVideo(), this.layersPromise]);
        if (!this.video) {
            throw new Error('expected video');
        }
        const video = this.video;
        if (!this.xrSession) {
            throw new Error('expected xrSession');
        }
        const xrSession = this.xrSession;

        await video.play();

        const tvPosition = this.tvPosition;
        const projLayer = (xrSession.renderState as any).layers[0];
        const refSpace = await xrSession.requestReferenceSpace('local');
        const layerFactory = new XRMediaBinding(xrSession);
        const videoLayer = await layerFactory.createQuadLayer(video, {
            space: refSpace,
            layout: 'mono',
            transform: new XRRigidTransform({
                x: tvPosition.x - 0.35,
                y: tvPosition.y + 0.15,
                z: -tvPosition.z - 0.5,
                w: 1.0,
            }),
            width: 0.8,
        });
        xrSession.updateRenderState({
            layers: [projLayer, videoLayer],
        } as any);    
    }

    private async loadScene() {
        const loader = new GLTFLoader();
        const model = await loader.loadAsync('../assets/sala1.glb');
        this.scene.add(model.scene);
        this.tvPosition = this.scene.getObjectByName('TV')?.position;
    }

    private async loadVideo() {
        this.video = document.createElement('video');
        this.video.crossOrigin = 'anonymous';
        this.video.preload = 'auto';
        this.player = new Player(this.video);
        const config = {
            drm: {
              servers: {
                'com.widevine.alpha': 'https://cwip-shaka-proxy.appspot.com/no_auth',
              },
            },
        };
        this.player.configure(config);
        
          // DRM protected stream
        await this.player.load('https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd');
    }

    private resize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight ); 
    }

    private get xrSession() {
        return this.renderer?.xr?.getSession();
    }

    private render = () => {
        if ((this.xrSession?.renderState as any)?.layers && !this.layersReady) {
            this.layersReady = true;
            this.notifyLayersReady?.();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

const containerEl = document.getElementById('container');

if (!containerEl) {
    throw new Error('invalid container element');
}
const session = new VRSession(containerEl);
session.setupDebugControls();
session.run();

document.body.appendChild(session.button);