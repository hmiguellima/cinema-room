import { Camera, Color, Group, HemisphereLight, PerspectiveCamera, Scene, sRGBEncoding, Vector3, WebGLRenderer, XRInputSource, XRReferenceSpace, XRReferenceSpaceType, XRRenderState, XRRenderStateInit, XRSession } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
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

function interceptMethodCalls(obj: Object, fn: Function) {
    return new Proxy(obj, {
      get(target, prop) {
        if (typeof (target as any)[prop] === 'function') {
          return new Proxy((target as any)[prop], {
            apply: (target, thisArg, argumentsList) => {
              if (fn(prop, argumentsList)) {
                return Reflect.apply(target, thisArg, argumentsList);
              }
            }
          });
        } else {
          return Reflect.get(target, prop);
        }
      }
    });
}

class VRButton {

	static createButton(sessionStartCallback: (session: XRSession) => void ) {
		const button = document.createElement( 'button' );

		function showEnterVR( /*device*/ ) {

			let currentSession:any  = null;

			async function onSessionStarted( session: XRSession ) {

				session.addEventListener( 'end', onSessionEnded );

				sessionStartCallback(session);
				button.textContent = 'EXIT VR';

				currentSession = session;

			}

			function onSessionEnded( /*event*/ ) {

				currentSession.removeEventListener( 'end', onSessionEnded );

				button.textContent = 'ENTER VR';

				currentSession = null;

			}

			//

			button.style.display = '';

			button.style.cursor = 'pointer';
			button.style.left = 'calc(50% - 50px)';
			button.style.width = '100px';

			button.textContent = 'ENTER VR';

			button.onmouseenter = function () {

				button.style.opacity = '1.0';

			};

			button.onmouseleave = function () {

				button.style.opacity = '0.5';

			};

			button.onclick = function () {

				if ( currentSession === null ) {

					// WebXR's requestReferenceSpace only works if the corresponding feature
					// was requested at session creation time. For simplicity, just ask for
					// the interesting ones as optional features, but be aware that the
					// requestReferenceSpace call will fail if it turns out to be unavailable.
					// ('local' is always available for immersive sessions and doesn't need to
					// be requested separately.)

					const sessionInit = { optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking', 'layers' ] };
					(navigator as any).xr.requestSession( 'immersive-vr', sessionInit ).then( onSessionStarted );

				} else {

					currentSession.end();

				}

			};

		}

		function disableButton() {

			button.style.display = '';

			button.style.cursor = 'auto';
			button.style.left = 'calc(50% - 75px)';
			button.style.width = '150px';

			button.onmouseenter = null;
			button.onmouseleave = null;

			button.onclick = null;

		}

		function showWebXRNotFound() {

			disableButton();

			button.textContent = 'VR NOT SUPPORTED';

		}

		function stylizeElement( element: HTMLElement ) {

			element.style.position = 'absolute';
			element.style.bottom = '20px';
			element.style.padding = '12px 6px';
			element.style.border = '1px solid #fff';
			element.style.borderRadius = '4px';
			element.style.background = 'rgba(0,0,0,0.1)';
			element.style.color = '#fff';
			element.style.font = 'normal 13px sans-serif';
			element.style.textAlign = 'center';
			element.style.opacity = '0.5';
			element.style.outline = 'none';
			element.style.zIndex = '999';

		}

		if ( 'xr' in navigator ) {

			button.id = 'VRButton';
			button.style.display = 'none';

			stylizeElement( button );

			(navigator as any).xr.isSessionSupported( 'immersive-vr' ).then( function ( supported: any ) {

				supported ? showEnterVR() : showWebXRNotFound();

			} );

			return button;

		} else {

			const message = document.createElement( 'a' );

			if ( window.isSecureContext === false ) {

				message.href = document.location.href.replace( /^http:/, 'https:' );
				message.innerHTML = 'WEBXR NEEDS HTTPS'; // TODO Improve message

			} else {

				message.href = 'https://immersiveweb.dev/';
				message.innerHTML = 'WEBXR NOT AVAILABLE';

			}

			message.style.left = 'calc(50% - 90px)';
			message.style.width = '180px';
			message.style.textDecoration = 'none';

			stylizeElement( message );

			return message;

		}

	}

}

class Controllers {
    private controller1: Group;
    private controller2: Group;
    private controllerGrip1: Group;
    private controllerGrip2: Group;
    private hand1: Group;
    private hand2: Group;
    private scene: Scene;
    private renderer: WebGLRenderer;

    constructor(private camera: any) {
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({ antialias: false, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearAlpha(1);
        this.renderer.setClearColor(new Color(0), 0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.scene.add( new HemisphereLight(0x808080, 0x606060));

        // controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.scene.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
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

        this.renderer.setAnimationLoop(this.render);
    }

    public setupXrSession(xrSession: XRSession): Promise<any> {
        return this.renderer.xr.setSession(xrSession);
    }

    private render = () => {
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
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        this.scene.add( new HemisphereLight(0x808080, 0x606060));

        this.controllers = new Controllers(this.camera);
        // container.appendChild(this.renderer.domElement);

        this.button = VRButton.createButton(async (session) => {
            this.bottomXrLayer = await this.renderer.xr.setSession(session);
            this.topXrLayer = await this.controllers.setupXrSession(session);
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