import { Player } from "shaka-player";
import { Camera, Matrix4, Object3D, Quaternion, Vector3, WebGLRenderer } from "three";
import { PlayoutData } from "../common/net-scheme";
import { ControllersAR } from "./controllers-ar";

export class VideoPlayer {
    private videoElement: HTMLVideoElement;
    private videoPlayer: Player;
    private videoLayer: XRQuadLayer | undefined;

    constructor(private controllers: ControllersAR) {
        this.videoElement = document.createElement('video');
        this.videoElement.crossOrigin = 'anonymous';
        this.videoElement.preload = 'auto';
        this.videoElement.autoplay = true;
        this.videoElement.controls = true;
    
        this.videoPlayer = new Player(this.videoElement);

        this.videoElement.addEventListener('play', this.onPlay);
        this.videoElement.addEventListener('pause', this.onPause);

        document.body.appendChild(this.videoElement);
    }

    public async init(remoteAsset?: PlayoutData) {
        const asset: PlayoutData = remoteAsset || this.assets[0];
        // if (asset.drmUri) {
            this.videoPlayer.configure({
                drm: {
                    servers: {
                        // 'com.widevine.alpha': asset.drmUri
                        'com.widevine.alpha': "https://cwip-shaka-proxy.appspot.com/no_auth"
                    }
                }
            });
        // }
        if (asset.headers) {
            // const headers: {[key:string]:string} = {};

            this.videoPlayer?.getNetworkingEngine()?.
                registerRequestFilter((type: shaka.net.NetworkingEngine.RequestType, request: shaka.extern.Request) => {
                    if (type === 2) {
                        request.headers = asset.headers!;
                        console.log(">>> License request headers: ", request.headers);
                    }
                });

        }

        console.log(">>> Video Asset: ", asset);
        setTimeout(async () => {
            // await this.videoPlayer?.load(asset.streamUri);
            await this.videoPlayer?.load("https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd");
        }, 2500);
    }

    private onPlay = () => {
        this.controllers?.updateInfoText('playing');
    }

    private onPause = () => {
        this.controllers?.updateInfoText('paused');
    }

    private errorCount = 0;
    public async showVideoPlayer(renderer: WebGLRenderer, session: any, tv: Object3D, camera: Camera) {
        try
        {
            const tvPosition = new Vector3();
            tv.getWorldPosition(tvPosition);

            const centerPosition = new Vector3();
            centerPosition.x = camera.position.x;
            centerPosition.y = tvPosition.y;
            centerPosition.z = camera.position.z;

            const rotationMatrix = new Matrix4();
            const targetQuaternion = new Quaternion();
            rotationMatrix.lookAt( centerPosition, tvPosition, tv.up );
            targetQuaternion.setFromRotationMatrix( rotationMatrix );

            // const anchorRotation = Math.atan2( ( camera.position.x - tvPosition.x ), ( camera.position.z - tvPosition.z ) );
            
            const refSpace = renderer.xr.getReferenceSpace() as any;
            const xrMediaBinding = new XRMediaBinding(session);
            
            console.log(">>> showVideoPlayer: videoElement.play");
            await this.videoElement.play();

            let transform = new XRRigidTransform({
                x: tvPosition.x,
                y: tvPosition.y,
                z: tvPosition.z,
                w: 1,
            }, {
                x: targetQuaternion.x,
                y: targetQuaternion.y,
                z: targetQuaternion.z,
                w: targetQuaternion.w              
            });

            this.videoLayer = await xrMediaBinding.createQuadLayer(this.videoElement, {
                space: refSpace,
                // layout: 'stereo-left-right',
                transform: transform,
                width: 0.54,
                height: 0.3,
            });

            session.updateRenderState({
                layers: [this.videoLayer, (renderer.xr as any).getBaseLayer()],
            } as any);

            this.errorCount = 0;
        } catch (e) {
            console.log('**** showVideoPlayer error', JSON.stringify(e));

            // TODO: fix this hack
            this.errorCount++;
            if (this.errorCount <=2) {
                setTimeout(() => this.showVideoPlayer(renderer, session, tv, camera), 500);
            } else {
                this.errorCount = 0;
            }
        }
    }

    public async pause() {
        await this.videoElement.pause();
    }

    public async play() {
        await this.videoElement.play();
    }

    // percentage can be positive or negative i.e. (-10%) -10
    public updateScreenSize(percentage: number) {
        if(this.videoLayer) {
            const currentW = this.videoLayer.width;
            const currentH = this.videoLayer.height;
            const newW = currentW - ((-percentage / 100) * currentW);
            const newH = currentH - ((-percentage / 100) * currentH);

            if(newW <= 0 || newH <= 0) return;

            this.videoLayer.width = newW;
            this.videoLayer.height = newH;
        }
    }

    private assets: Array<PlayoutData> = [
        {
            name: 'Sintel Dash Widevine | 24fps',
            fps: 24,
            streamUri: 'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd',
            layout: 'mono',
            drmUri: 'https://cwip-shaka-proxy.appspot.com/no_auth',
        }
    ];

    public destroy() {
        this.videoElement.removeEventListener('play', this.onPlay);
        this.videoElement.removeEventListener('pause', this.onPause);
    }
}
