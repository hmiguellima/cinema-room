import { Player } from "shaka-player";
import { Object3D, Quaternion, Vector3, WebGLRenderer } from "three";
import { PlayoutData } from "../common/net-scheme";

export type IPlayerEventHandlers = {
    onLoading(): void;
    onPlay(): void;
    onPause(): void;
}

export class VideoPlayer {
    private videoElement: HTMLVideoElement;
    private videoPlayer: Player;
    private videoLayer: XRQuadLayer | undefined;
    private tvQuaternion?: Quaternion;
    private tvPosition = new Vector3();
    private translateVec = new Vector3(0, 0, 0);
    private zoomPercentage = 100;
    private defaultWidth = 0.54;
    private defaultHeight = 0.3;

    constructor(private eventHandlers: IPlayerEventHandlers, private licenseReqDecorator: (request: shaka.extern.Request) => Promise<shaka.extern.Request>) {
        this.videoElement = document.createElement('video');
        this.videoElement.crossOrigin = 'anonymous';
        this.videoElement.preload = 'auto';
        this.videoElement.autoplay = true;
        this.videoElement.controls = true;
    
        this.videoPlayer = new Player(this.videoElement);

        this.videoElement.addEventListener('play', this.onPlay);
        this.videoElement.addEventListener('pause', this.onPause);
    }

    public async init(remoteAsset?: PlayoutData) {
        const asset: PlayoutData = remoteAsset || this.assets[0];
        if (asset.drmUri) {
            this.videoPlayer.configure({
                drm: {
                    servers: {
                        'com.widevine.alpha': asset.drmUri
                        // 'com.widevine.alpha': "https://cwip-shaka-proxy.appspot.com/no_auth"
                    }
                }
            });
        }
        if (asset.headers || asset.needsExternalSigning) {
            this.videoPlayer?.getNetworkingEngine()?.
                registerRequestFilter(async (type: shaka.net.NetworkingEngine.RequestType, request: shaka.extern.Request) => {
                    // License request
                    if (type === 2) {
                        if (asset.headers) {
                            request.headers = {...asset.headers, ...request.headers};
                        }
                        if (asset.needsExternalSigning) {
                            console.log('****signing request', JSON.stringify(request));
                            const req = await this.licenseReqDecorator(request);
                            request.headers = req.headers;
                        }
                        console.log('****license request headers', JSON.stringify(request.headers));
                    }
                });
        }

        console.log(">>> Video Asset: ", JSON.stringify(asset));
        this.eventHandlers.onLoading?.();
        this.videoPlayer.addEventListener('error', this.handleError);
        await this.videoPlayer?.load(asset.streamUri);
        await new Promise((resolve) => {
            window.setTimeout(resolve, 1000);
        });
    }

    private handleError = (e: any) => {
        console.log('***** Shaka error:', e);
    } 

    private onPlay = () => {
        this.eventHandlers.onPlay?.();
    }

    private onPause = () => {
        this.eventHandlers.onPause?.();
    }

    private getAdjustedScreenSize() {
        const width = (this.zoomPercentage / 100) * this.defaultWidth;
        const height = (this.zoomPercentage / 100) * this.defaultHeight;
        return {
            width,
            height
        }
    }

    private getMediaLayerTransform() {
        const position = new Vector3().copy(this.tvPosition);
        const correctedTranslation = new Vector3().copy(this.translateVec);
        correctedTranslation.applyQuaternion(this.tvQuaternion!);
        position.add(correctedTranslation);
        return new XRRigidTransform({
            x: position.x,
            y: position.y,
            z: position.z,
            w: 1,
        }, {
            x: this.tvQuaternion?.x,
            y: this.tvQuaternion?.y,
            z: this.tvQuaternion?.z,
            w: this.tvQuaternion?.w              
        });
    }

    public async showVideoPlayer(renderer: WebGLRenderer, session: any, tv: Object3D, 
        defaultZoom = 100, defaultTranslationVec = new Vector3(0, 0, 0)) {
        try
        {
            this.tvQuaternion = tv.quaternion;            
            this.tvPosition = tv.getWorldPosition(this.tvPosition);
            this.translateVec.copy(defaultTranslationVec);
            this.zoomPercentage = defaultZoom;

            const transform = this.getMediaLayerTransform();
            const screenSize = this.getAdjustedScreenSize();

            if (!this.videoLayer) {
                const refSpace = renderer.xr.getReferenceSpace() as any;
                const xrMediaBinding = new XRMediaBinding(session);
                
                console.log(">>> showVideoPlayer: videoElement.play");
                await this.videoElement.play();
    
                console.log(">>> showVideoPlayer: create media layer");
                this.videoLayer = xrMediaBinding.createQuadLayer(this.videoElement, {
                    space: refSpace,
                    // layout: 'stereo-left-right',
                    transform: transform,
                    width: screenSize.width,
                    height: screenSize.height,
                });
    
                session.updateRenderState({
                    layers: [this.videoLayer, (renderer.xr as any).getBaseLayer()],
                } as any);    
            } else {
                this.videoLayer.transform = transform;
                this.videoLayer.width = screenSize.width;
                this.videoLayer.height = screenSize.height;
            }

            tv.visible = false;
        } catch (e) {
            console.log('**** showVideoPlayer error', e);
        }
    }

    public async pause() {
        this.videoElement.pause();
    }

    public async play() {
        await this.videoElement.play();
    }

    // percentage can be positive or negative i.e. (-10%) -10
    public updateScreenSize(percentage: number) {
        if (!this.videoLayer) {
            return this.zoomPercentage;
        }
        this.zoomPercentage = Math.max(10, this.zoomPercentage + percentage);
        const newSize = this.getAdjustedScreenSize();
        this.videoLayer.width = newSize.width;
        this.videoLayer.height = newSize.height;

        return this.zoomPercentage;
    }

    public translateScreenPos(x: number, y: number, z: number) {
        if (!this.videoLayer) {
            return this.translateVec;
        }
        this.translateVec.add(new Vector3(x, y, z));
        let transform = this.getMediaLayerTransform();
        this.videoLayer.transform = transform;

        return this.translateVec;
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
        this.videoPlayer.removeEventListener('error', this.handleError);
        this.videoPlayer.unload();
    }
}
