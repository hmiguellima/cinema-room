import { Box3, Group, HemisphereLight, Object3D, Vector3 } from "three";
import { CinemaSession } from "../cinema-session";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ControllersVR, EventType } from "./controllers-vr";
import { VRButton } from "./vr-button";

export class CinemaSessionVR extends CinemaSession {
    private tv?: Object3D;
    private room?: Group;
    private controllers?: ControllersVR;
    private light: HemisphereLight = new HemisphereLight(0xffffff, 0xbbbbff, 1);

    constructor(sessionEndCallback: () => void) {
        const xrSessionConfig = {
            requiredFeatures: ['hand-tracking', 'layers'],
            optionalFeatures: ['local-floor', 'bounded-floor']
        };

        super(sessionEndCallback, xrSessionConfig, {
            createButton: VRButton.createButton,
            requestSession: config => navigator.xr!.requestSession('immersive-vr', config)
        });
    }

    public destroy() {
        super.destroy();
    }

    protected onLoading() {
        this.controllers?.updateInfoText('loading...');
    }

    protected onPause() {
        this.controllers?.updateInfoText('paused');
        this.light.intensity = 1;
    }

    protected onPlay() {
        this.controllers?.updateInfoText('playing');        
        this.light.intensity = 0.2;
    }
    
    protected async postInit(): Promise<void> {
        this.light.position.set(0.5, 1, 0.25);
        this.scene.add(this.light);

        const loader = new GLTFLoader();
        const model = await loader.loadAsync('assets/home-cinema.glb');

        this.controllers = new ControllersVR(this.renderer.xr, this.scene, this.handleControllerEvent, this.camera, 'mesh');

        this.room = model.scene;
        this.scene.add(this.room);
        this.tv = this.scene.getObjectByName('screen');
        if (!this.tv) {
            this.onError('TV object not found');
            return;
        }
        // we need to rotate the room
        this.room.rotateY(Math.PI);
        this.room.translateY(0.1);
        this.moveToSeat('seat_1');
    }

    protected postStart(): void {
        if (!this.tv) {
            this.onError('TV object not found');
            return;
        }
        const box = new Box3().setFromObject(this.tv);
        const tvHeight = (box.max.y - box.min.y) * 0.5;
        const tvWidth = tvHeight * 1.8;
        this.setupVideoPlayer(this.tv, 100, new Vector3(0, 0, 0), tvWidth, tvHeight);
    }

    protected updateState() {
        this.controllers?.update();
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
        }
    }

    private moveToSeat(seatName: string) {
        const seat = this.scene.getObjectByName(seatName);
        const room  = this.room;
        if (room && seat){
            const x = seat.position.x;
            const z = seat.position.z;
            room.translateX(-x);
            room.translateZ(-z);
        }
    }

}