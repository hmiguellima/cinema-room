import { Scene, PerspectiveCamera, WebGLRenderer, Object3D, AmbientLight, PointLight, XRSession, Group, sRGBEncoding, Vector3, Box3, BoxGeometry, MeshBasicMaterial, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StereoLayout } from "../common/net-scheme";
import { Controllers, EventType } from "./controllers";

const DIM_LIGHT_INTENSITY = 0.05;
const NORMAL_LIGHT_INTENSITY = 0.7;

declare global {
    class XRMediaBinding {
        constructor(session: XRSession | null);
        createQuadLayer(el: HTMLVideoElement, init: any): Promise<any>;
    }

    class XRRigidTransform {
        constructor(init: any);
    }
}

export type LedSetup = {
    hCount: number;
    vCount: number;
}

export class HomeCinemaSession {
    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;
    private controllers: Controllers | null;
    private tv?: Object3D;
    private xrLayer: any;
    private videoQualityInterval: number | undefined;
    private isPlaying = false;
    private ambientLight = new AmbientLight(0x101010);
    private roomLight = new PointLight(0xffffed, NORMAL_LIGHT_INTENSITY);
    private xrSession: XRSession |  null;
    private room?: Group;
    private topLeds: Array<PointLight>;
    private bottomLeds: Array<PointLight>;
    private leftLeds: Array<PointLight>;
    private rightLeds: Array<PointLight>;

    constructor(xrSession: XRSession, private video: HTMLVideoElement, private stereoLayout: StereoLayout, private ledSetup?: LedSetup) {
        this.topLeds = [];
        this.bottomLeds = [];
        this.leftLeds = [];
        this.rightLeds = [];

        this.xrSession = xrSession;
        this.scene = new Scene();

        this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
        this.scene.add(this.camera);

        this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = sRGBEncoding;
        this.renderer.xr.enabled = true;
        this.renderer.shadowMap.enabled = false;
        this.renderer.setAnimationLoop(this.render);

        this.roomLight.position.set(0, 1.8, 0);
        this.scene.add(this.roomLight);
        this.scene.add(this.ambientLight);
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

        if (!this.tv) {
            throw new Error('expected tv object');
        }

        this.moveToSeat();

        if (!this.video) {
            throw new Error('expected video');
        }

        const video = this.video;
        video.addEventListener('play', () => {
            this.isPlaying = true;
            this.controllers?.updateInfoText('playing');
            this.roomLight.intensity = DIM_LIGHT_INTENSITY;
        });
        video.addEventListener('pause', () => {
            this.isPlaying = false;
            this.controllers?.updateInfoText('paused');
            this.roomLight.intensity = NORMAL_LIGHT_INTENSITY;
        });

        const tv = this.tv;

        // hide tv placeholder to show the video playing behind it
        tv.visible = false;

        await video.play();

        const tvPosition: Vector3 = new Vector3();
        tv.getWorldPosition(tvPosition);
        const refSpace = this.renderer.xr.getReferenceSpace();
        const layerFactory = new XRMediaBinding(xrSession);
        const videoLayer = await layerFactory.createQuadLayer(video, {
            space: refSpace,
            layout: this.stereoLayout,
            transform: new XRRigidTransform({
                x: tvPosition.x,
                y: tvPosition.y,
                z: tvPosition.z,
                w: 1,
            }),
            width: 1.8,
            height: 1,
        });
        xrSession.updateRenderState({
            layers: [videoLayer, this.xrLayer],
        } as any);

        let lastVideoFrames = 0;
        this.videoQualityInterval = window.setInterval(() => {
            if (this.controllers && this.video && !this.video.paused && this.isPlaying) {
                const quality = this.video.getVideoPlaybackQuality();
                const videoFrames = quality.totalVideoFrames - quality.droppedVideoFrames;
                if (lastVideoFrames) {
                    this.controllers.updateInfoText(`playing at ${videoFrames - lastVideoFrames}fps`);
                }
                lastVideoFrames = videoFrames;
            } else {
                lastVideoFrames = 0;
            }
        }, 1000);
    }

    private destroy() {
        window.clearInterval(this.videoQualityInterval);
        window.removeEventListener( 'resize', this.resize);
        this.xrSession = null;
        this.controllers = null;
    }

    private moveToSeat() {
        const seat = this.scene.getObjectByName('seat_1');
        const room  = this.room;
        if (room && seat){
            const x = seat.position.x;
            const z = seat.position.z;
            room.translateX(-x);
            room.translateZ(-z);
        }
    }

    private async loadScene(): Promise<void> {
        const loader = new GLTFLoader();
        const model = await loader.loadAsync('assets/home-cinema.glb');
        this.room = model.scene;
        this.scene.add(this.room);
        this.tv = this.scene.getObjectByName('screen');
        // we need to rotate the room for some weird reason
        this.room.rotateY(Math.PI);

        // LED strip creation
        if (this.ledSetup && this.tv) {
            const hideStuff = ['screen_wall', 'screen', 'room'];
            hideStuff.forEach(name => {
                let o = this.scene.getObjectByName(name);
                if (o) {
                    o.visible = false;
                }    
            });

            const bb = new Box3().setFromObject(this.tv);
            const xSize = bb.max.x - bb.min.x;
            const ySize = bb.max.y - bb.min.y;
            const boxGeo = new BoxGeometry(0.01, 0.01, 0.01);
            const boxMat = new MeshBasicMaterial( {color: 0x00ff00} );

            // Top & Bottom LEDs
            for (let x = 0; x < this.ledSetup.hCount; x++) {
                for (let y = 0; y < 2; y++) {
                    // let light = new PointLight(0xffffed, 0);
                    let light = new Mesh(boxGeo, boxMat);

                    this.scene.add(light);
                    light.position.setX(bb.min.x + x * (xSize / this.ledSetup.hCount));
                    light.position.setY(y === 0 ? bb.min.y : bb.max.y);
                    light.position.setZ(-bb.max.z);

                    /*
                    if (y === 0) {
                        this.topLeds.push(light);
                    } else {
                        this.bottomLeds.push(light);
                    }
                    */
                }
            }

            // Left & Right LEDs
            for (let y = 0; y < this.ledSetup.vCount; y++) {
                for (let x = 0; x < 2; x++) {
                    // let light = new PointLight(0xffffed, 0);
                    let light = new Mesh(boxGeo, boxMat);

                    this.scene.add(light);
                    light.position.setY(bb.min.y + y * (ySize / this.ledSetup.vCount));
                    light.position.setX(x === 0 ? bb.min.x : bb.max.x);
                    light.position.setZ(-bb.max.z);

                    /*
                    if (x == 0) {
                        this.leftLeds.push(light);
                    } else {
                        this.rightLeds.push(light);
                    }
                    */
                }
            }
        }

        /*
        // very un-optimized avatar
        const avatar = await loader.loadAsync('assets/rpm-avatar-vr-1.glb');
        avatar.scene.translateX(-0.5);
        this.scene.add(avatar.scene);
        */
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
