import { Player } from "shaka-player";
import { Box3, Object3D, Plane, Vector3, WebGLRenderer } from "three";
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
    }

    public async init() {
        const asset: PlayoutData = this.assets[0];
        if (asset.drmUri) {
            this.videoPlayer.configure({
                drm: {
                    servers: {
                        'com.widevine.alpha': asset.drmUri
                    }
                }
            });
        }    
        await this.videoPlayer?.load(asset.streamUri);
    }

    private onPlay = () => {
        this.controllers?.updateInfoText('playing');
    }

    private onPause = () => {
        this.controllers?.updateInfoText('paused');
    }

    private errorCount = 0;
    public async showVideoPlayer(renderer: WebGLRenderer, session: any, tv: Object3D, camera: any) {
        try
        {
            const tvPosition = new Vector3();
            tv.getWorldPosition(tvPosition);

            // TODO: fix screen rotation.
            const anchorRotation = Math.atan2( ( camera.position.x - tvPosition.x ), ( camera.position.z - tvPosition.z ) ); // Anchor should face the camera.

            const refSpace = renderer.xr.getReferenceSpace() as any;
            const xrMediaBinding = new XRMediaBinding(session);
        
            await this.videoElement.play();

            let transform = new XRRigidTransform({
                x: tvPosition.x,
                y: tvPosition.y,
                z: tvPosition.z,
                w: 1,
            }, {
                x: 0,
                y: anchorRotation,
                z: 0,
                w: 1
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
