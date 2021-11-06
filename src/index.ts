import { HemisphereLight, PerspectiveCamera, Scene, sRGBEncoding, Vector3, XRSession } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory';
import { Player } from 'shaka-player';
import { VRButton } from './VRButton';
import { WebGLRenderer, Group } from 'three';
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

enum EventType {
    play,
    pause,
    exit
}

type ControllerEventHandler = (evt: EventType) => void;

class Controllers {
    private controller1: Group;
    private controller2: Group;
    private controllerGrip1: Group;
    private controllerGrip2: Group;
    private hand1: Group;
    private hand2: Group;
    private leftController?: Group;
    private rightController?: Group;
    private ui: CanvasUI;

    constructor(private renderer: WebGLRenderer, private scene: Scene, private evtHandler: ControllerEventHandler) {
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

        const uiConfig = {
            panelSize: { width: 0.250, height: 0.125},
            width: 256,
            height: 128,
            opacity: 0.7,
            info: { type: "text", position:{ left: 6, top: 6 }, width: 244, height: 58, backgroundColor: "#aaa", fontColor: "#000", fontSize: 20 },
            pause: { type: "button", position:{ top: 70, left: 6 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.pause)},
            play: { type: "button", position:{ top: 70, left: 60 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.play) },
            stop: { type: "button", position:{ top: 70, left: 114 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.exit) },
	        renderer: this.renderer
        };
        const uiContent = {
            info: 'loading',
            pause: '<path>M 17 10 L 7 10 L 7 40 L 17 40 Z M 32 10 L 22 10 L 22 40 L 32 40 Z</path>',
            stop: '<path>M 7 10 L 32 10 L 32 40 L 7 40 Z</path>',
            play: '<path>M 32 25 L 12 10 L 12 40 Z</path>'
        };
        this.ui = new CanvasUI(uiContent, uiConfig);
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
    }

    public updateInfoText(text: string) {
        this.ui.updateElement('info', text);
    }

    public update = () => {
        if (!this.renderer.xr.isPresenting) return;
        if (this.leftController) {
            if (this.leftController.visible && this.ui.mesh.visible) {
                const pos = this.leftController.position;
                this.ui.mesh.position.set(pos.x + 0.2, pos.y, pos.z);
                this.ui.update();
            }
        }
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
}

class HomeCinemaSession {
    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;
    private controllers: Controllers | null;
    private tvPosition?: Vector3;
    private xrLayer: any;
    private videoQualityInterval: number | undefined;
    private isPlaying = false;
    private roomLight = new HemisphereLight(0x808080, 0x606060);
    private xrSession: XRSession |  null;

    constructor(xrSession: XRSession, private video: HTMLVideoElement) {
        this.xrSession = xrSession;
        this.scene = new Scene();

        this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
        this.camera.position.set(0, 0, 0);

        this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = sRGBEncoding;
        this.renderer.xr.enabled = true;
        this.renderer.setAnimationLoop(this.render);

        this.scene.add(this.roomLight);
        this.controllers = new Controllers(this.renderer, this.scene, this.handleControllerEvent);

        window.addEventListener( 'resize', this.resize);
        xrSession.addEventListener('end', () => {
            this.destroy();
        });
    }

    public async run() {
        if (!this.xrSession) {
            throw new Error('expected xrSession');
        }
        const xrSession = this.xrSession;

        await Promise.all([this.renderer.xr.setSession(xrSession), this.loadScene()]);
        this.xrLayer = (this.renderer.xr as any).getBaseLayer();
        this.xrLayer.fixedFoveation = 1;
    
        this.tvPosition = { x: 0, y: 0, z: 1 } as any;
        if (!this.tvPosition) {
            throw new Error('expected tvPosition');
        }

        if (!this.video) {
            throw new Error('expected video');
        }
        const video = this.video;
        video.addEventListener('play', () => {
            this.isPlaying = true;
            this.controllers?.updateInfoText('playing');
            this.roomLight.intensity = 0.2;
        });
        video.addEventListener('pause', () => {
            this.isPlaying = false;
            this.controllers?.updateInfoText('paused');
            this.roomLight.intensity = 1;
        });
        await video.play();

        const tvPosition = this.tvPosition;
        const refSpace = this.renderer.xr.getReferenceSpace();
        const layerFactory = new XRMediaBinding(xrSession);
        const videoLayer = await layerFactory.createQuadLayer(video, {
            space: refSpace,
            layout: 'mono',
            transform: new XRRigidTransform({
                x: tvPosition.x - 0.355,
                y: tvPosition.y + 1.15,
                z: -tvPosition.z - 2.5,
                w: 1.0,
            }),
            width: 2.35,
            height: 1,
        });
        xrSession.updateRenderState({
            layers: [videoLayer, this.xrLayer],
        } as any);

        this.videoQualityInterval = window.setInterval(() => {
            if (this.controllers && this.video && !this.video.paused && this.isPlaying) {
                const quality = this.video.getVideoPlaybackQuality();
                this.controllers.updateInfoText(`playing-${quality.totalVideoFrames}/${quality.droppedVideoFrames}`);
            }
        }, 1000);
    }

    private destroy() {
        window.clearInterval(this.videoQualityInterval);
        window.removeEventListener( 'resize', this.resize);
        this.xrSession = null;
        this.controllers = null;
    }

    private async loadScene() {
        const loader = new GLTFLoader();
        const model = await loader.loadAsync('assets/home-cinema.glb');
        model.scene.translateZ(0.2);
        this.scene.add(model.scene);
        this.tvPosition = this.scene.getObjectByName('TV')?.position;
    }

    private handleControllerEvent = (evt: EventType) => {
        switch (evt) {
            case EventType.pause:
                this.video?.pause();
                break;
            case EventType.play:
                this.video?.play();
                break;
            case EventType.exit:
                this.video.pause();
                this.xrSession?.end();
                break;
        }
    }

    private resize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight ); 
    }

    private render = () => {
        if (!this.renderer.xr.isPresenting) return;
        this.renderer.render(this.scene, this.camera);
        this.controllers?.update();
    }
}

async function loadVideo(video: HTMLVideoElement) {
    const player = new Player(video);
    const config = {
        drm: {
          servers: {
            'com.widevine.alpha': 'https://cwip-shaka-proxy.appspot.com/no_auth',
          },
        },
    };
    player.configure(config);

    // DRM protected stream
    await player.load('https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd');
}

async function beforeStart() {
    videoEl.pause();
    containerEl?.removeChild(videoEl);        
    await new Promise(resolve => window.setTimeout(resolve, 100));
}

function startImmersiveSession(session: XRSession) {
    (session as any).updateTargetFrameRate(72);
    immersiveSession = new HomeCinemaSession(session, videoEl);
    immersiveSession.run();    
    session.addEventListener('end', () => {
        window.setTimeout(() => {
            immersiveSession = null;
            containerEl?.appendChild(videoEl);
            videoEl.play();
        }, 100);
    })
}

const containerEl = document.getElementById('container');
if (!containerEl) {
    throw new Error('invalid container element');
}

const videoEl = document.createElement('video');
videoEl.crossOrigin = 'anonymous';
videoEl.preload = 'auto';
videoEl.autoplay = true;
videoEl.controls = true;

containerEl.appendChild(videoEl);

let immersiveSession: HomeCinemaSession | null;

loadVideo(videoEl).then(() => {
    const button = VRButton.createButton(beforeStart, startImmersiveSession);    
    document.body.appendChild(button);
});
