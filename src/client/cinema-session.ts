import { Camera, HemisphereLight, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer, WebXRManager } from "three";
import { PlayoutData } from "../common/net-scheme";
import { VideoPlayer } from "./videoplayer";

export type XRSessionConfig = {
    requiredFeatures: string[];
    optionalFeatures: string[];
}

export interface ICreateStartXRSession {
    createButton(renderer: any, sessionConfig: XRSessionConfig): HTMLElement;
    requestSession(sessionConfig: XRSessionConfig): Promise<XRSession>;
}

export abstract class CinemaSession {
    protected renderer: WebGLRenderer;
    protected scene: Scene;
    protected camera: Camera;
    protected videoPlayer?: VideoPlayer;
    protected session: any;
    private remoteAsset?: PlayoutData;

    constructor(private sessionEndCallback: () => void, private xrSessionConfig: XRSessionConfig, private createXRSession: ICreateStartXRSession) {
        this.camera = new PerspectiveCamera(70, 2, 0.01, 20);
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    }

    public init() {
        const container = document.getElementById('container');
        const light = new HemisphereLight(0xffffff, 0xbbbbff, 1);

        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        container!.appendChild(this.renderer.domElement);
        this.renderer.setAnimationLoop(() => this.render());

        const startBtn = this.createXRSession.createButton(this.renderer, this.xrSessionConfig);
        container!.appendChild(startBtn);
        this.listenForExternalRequests();
        this.renderer.xr.addEventListener('sessionstart', this.onSessionStart);
        this.postInit();
    }

    public destroy() {
        const container = document.getElementById('container');

        container!.innerHTML = '';
        this.videoPlayer?.destroy();
        this.session.removeEventListener('end', this.onDestroy);
        window.removeEventListener('message', this.handleExternalPlayoutRequest);
    }

    protected abstract onLoading(): void;
    protected abstract onPlay(): void;
    protected abstract onPause(): void;

    protected async setupVideoPlayer(tvPlaceholder: Object3D, defaultZoom: number, defaultTranslation: Vector3) {
        if (this.videoPlayer === undefined) {
            this.videoPlayer = new VideoPlayer({
                onLoading: this.onLoading,
                onPause: this.onPause,
                onPlay: this.onPlay,
            }, this.handleLicenseReq);
            await this.videoPlayer.init(this.remoteAsset);
        }

        console.log('**** showVideoPlayer');
        this.videoPlayer.showVideoPlayer(this.renderer, this.session, tvPlaceholder, defaultZoom, defaultTranslation);
    }

    // override with custom init logic
    protected postInit() {
    }

    // override with logic to update scene state
    protected updateState() {
    }

    // override with custom logic to run after session start
    protected postStart() {
    }

    protected onError(message: string) {
        console.error(message);
        this.session?.end();
    }

    private onSessionStart = async (event: any) => {
        this.camera.position.set(0, 0, 0);

        this.session = (event.target as WebXRManager).getSession();
        this.session.addEventListener('end', this.onDestroy);
        this.postStart();
    }

    private listenForExternalRequests() {
        window.addEventListener('message', this.handleExternalPlayoutRequest);
    }

    private handleExternalPlayoutRequest = async (e: MessageEvent<any>) => {
        console.log('Received message:', JSON.stringify(e.data));
        if (e.data && e.data.type === 'asset') {
            this.remoteAsset = e.data.asset;

            const session: XRSession = await this.createXRSession.requestSession(this.xrSessionConfig);
            this.renderer.xr.setReferenceSpaceType('local');
            this.renderer.xr.setSession(session as any);
        }
    }

    private onDestroy = () => {
        this.destroy();
        this.sessionEndCallback();
    }

    private async handleLicenseReq(req: shaka.extern.Request): Promise<shaka.extern.Request> {
        console.log('**** Sending decorateLicense request');
        window.parent.postMessage({type: 'decorateLicense', decorateLicense: req});
        return new Promise((resolve, reject) => {
            let waitingForResponse = true;

            const timeout = window.setTimeout(() => {
                if (waitingForResponse) {
                    window.removeEventListener('message', listener);
                    reject('handleLicenseReq:timeout');
                }
            }, 5000);

            const listener = (event: any) => {
                if (event.data.type === 'licenseRequest') {
                    console.log('**** received decorated license', JSON.stringify(event.data.licenseRequest));
                    waitingForResponse = false;
                    window.removeEventListener('message', listener);
                    window.clearTimeout(timeout);
                    resolve(event.data.licenseRequest);
                }
            };
            window.addEventListener('message', listener);
        });
    }

    private render() {
        if (!this.renderer.xr.isPresenting) return;
        this.updateState();
        this.renderer.render(this.scene, this.camera);
    }
}
