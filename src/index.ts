import { BufferGeometry, Color, DoubleSide, FrontSide, Group, HemisphereLight, Line, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Scene, Side, sRGBEncoding, Vector3, XRFrame, XRSession } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Player } from 'shaka-player';
import { VRButton } from './VRButton';
import { WebGLRenderer } from './WebGLRenderer';
import { CanvasUI } from './CanvasUI';

declare global {
    class XRMediaBinding {
        constructor(session: XRSession | null);
        createQuadLayer(el: HTMLVideoElement, init: any): Promise<any>;
    }

    class XRRigidTransform {
        constructor(init: any);
    }
}

class Controllers {
    private controller1: Group;
    private controller2: Group;
    private controllerGrip1: Group;
    private controllerGrip2: Group;
    private hand1: Group;
    private hand2: Group;
    private leftController?: Group;
    private rightController?: Group;
    private scene: Scene;
    private renderer: WebGLRenderer;
    private ui: CanvasUI;

    constructor(private camera: any) {
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({ antialias: false, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearAlpha(1);
        this.renderer.setClearColor(new Color(0), 0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = sRGBEncoding;
        // this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.scene.add( new HemisphereLight(0x808080, 0x606060));

        // controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.handleControllerEvents(this.controller1);
        this.scene.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
        this.handleControllerEvents(this.controller2);
        this.scene.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();
        const handModelFactory = new XRHandModelFactory().setPath('./models/fbx/');

        // Hand 1
        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.scene.add(this.controllerGrip1);

        this.hand1 = this.renderer.xr.getHand(0);
        this.hand1.add(handModelFactory.createHandModel(this.hand1));
        this.scene.add(this.hand1);

        // Hand 2
        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add( controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.scene.add(this.controllerGrip2);

        this.hand2 = this.renderer.xr.getHand(1);
        this.hand2.add(handModelFactory.createHandModel(this.hand2));
        this.scene.add(this.hand2);

        this.ui = new CanvasUI();
        this.ui.updateElement('body', 'Hello world');
        this.ui.mesh.visible = false;

        this.scene.add(this.ui.mesh);

        /*
        const geometry = new BufferGeometry().setFromPoints( [ new Vector3( 0, 0, 0 ), new Vector3( 0, 0, - 1 ) ] );

        const line = new Line( geometry );
        line.name = 'line';
        line.scale.z = 5;

        this.controller1.add( line.clone() );
        this.controller2.add( line.clone() );
        */

        this.renderer.setAnimationLoop(this.render);
    }

    public setupXrSession(xrSession: XRSession): Promise<any> {
        return this.renderer.xr.setSession(xrSession);
    }

    private handleControllerEvents(controller: any) {
        controller.addEventListener('connected', (event: any) => {
            if (event.data.handedness === 'left') {
                console.log('left hand detected');
                this.leftController = controller;
                controller.addEventListener('pinchstart', (event: any) => {
                    this.ui.mesh.visible = true;
                });
                controller.addEventListener('pinchend', (event: any) => {
                    this.ui.mesh.visible = false;
                });
            }
            if (event.data.handedness === 'right') {
                console.log('right hand detected');
                this.rightController = controller;
            }
        });
    }

    private render = (time: number, frame: XRFrame) => {
        if (!this.renderer.xr.isPresenting) return;
        if (this.leftController) {
            if (this.leftController.visible && this.ui.mesh.visible) {
                const pos = this.leftController.position;
                this.ui.mesh.position.set(pos.x + 0.2, pos.y, pos.z);
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
}

class VRSession {
    public readonly button: HTMLElement;

    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;
    private controllers: Controllers;
    private layersPromise: Promise<void>;
    private notifyLayersReady?: () => void;
    private tvPosition?: Vector3;
    private video?: HTMLVideoElement;
    private player?: Player;
    private topXrLayer: any;
    private bottomXrLayer: any;

    constructor(private container: HTMLElement) {
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
        this.camera.position.set(0, 0, 0);
        this.renderer = new WebGLRenderer({ antialias: false, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearAlpha(1);
        this.renderer.setClearColor(new Color(0), 0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = sRGBEncoding;
        // this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.scene.add( new HemisphereLight(0x808080, 0x606060));

        this.controllers = new Controllers(this.camera);
        // container.appendChild(this.renderer.domElement);

        this.button = VRButton.createButton(async (session) => {
            this.bottomXrLayer = await this.renderer.xr.setSession(session);
            this.bottomXrLayer.fixedFoveation = 1;
            this.topXrLayer = await this.controllers.setupXrSession(session);
            this.topXrLayer.fixedFoveation = 1;
            this.notifyLayersReady?.();
        });

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

    public async runWithoutVideo() {
        await Promise.all([this.loadScene(), this.layersPromise]);

        if (!this.xrSession) {
            throw new Error('expected xrSession');
        }
        const xrSession = this.xrSession;

        xrSession.updateRenderState({
            // layers: [this.bottomXrLayer],
            layers: [this.bottomXrLayer, this.topXrLayer],
        } as any);
    }

    public async run() {
        await Promise.all([this.loadScene(), this.loadVideo(), this.layersPromise]);

        if (!this.tvPosition) {
            throw new Error('expected tvPosition');
        }

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
        const refSpace = this.renderer.xr.getReferenceSpace();
        const layerFactory = new XRMediaBinding(xrSession);
        const videoLayer = await layerFactory.createQuadLayer(video, {
            space: refSpace,
            layout: 'mono',
            transform: new XRRigidTransform({
                x: tvPosition.x - 0.35,
                y: tvPosition.y + 1.15,
                z: -tvPosition.z - 0.5,
                w: 1.0,
            }),
            width: 0.8,
        });
        xrSession.updateRenderState({
            layers: [this.bottomXrLayer, videoLayer, this.topXrLayer],
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
        if (!this.renderer.xr.isPresenting) return;
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
// session.runWithoutVideo();

document.body.appendChild(session.button);