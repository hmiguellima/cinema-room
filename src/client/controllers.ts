import { Group, Scene, Camera, Vector3, Object3D, WebXRManager } from "three";
import { CanvasUI } from "./CanvasUI";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory";

export type ControllerEventHandler<T> = (evt: T) => void;

export abstract class Controllers<T> {
    private controller1: Group;
    private controller2: Group;
    private hand1: Group;
    private hand2: Group;
    private leftJoints: any;
    private rightJoints: any;
    private ui: CanvasUI;
    private pinkyPos: Vector3 = new Vector3();
    private thumbPos: Vector3 = new Vector3();

    constructor(protected xr: WebXRManager, scene: Scene, private evtHandler: ControllerEventHandler<T>, protected camera: Camera, handsProfile?: string) {
        // Controllers (base XRInput interface)
        this.controller1 = xr.getController(0);
        scene.add(this.controller1);

        this.controller2 = xr.getController(1);
        scene.add(this.controller2);

        // Hands objects initialisation.
        this.hand1 = xr.getHand(0);
        scene.add(this.hand1);

        this.hand2 = xr.getHand(1);
        scene.add(this.hand2);

        if (handsProfile) {
            const handModelFactory = new XRHandModelFactory();
            this.hand1.add(handModelFactory.createHandModel(this.hand1, handsProfile as any));
            this.hand2.add(handModelFactory.createHandModel(this.hand2, handsProfile as any));
        }

        // handle controller events
        this.handleControllerEvents(this.controller1, this.hand1);
        this.handleControllerEvents(this.controller2, this.hand2);

        this.ui = new CanvasUI(this.getUIContent(), this.getUIConfig(evtHandler));
        this.ui.mesh.visible = false;

        scene.add(this.ui.mesh);
    }

    public updateInfoText(text: string) {
        this.ui.updateElement('info', text);
        console.log('**** Updating player info text:', text);
    }

    public update = () => {
        if (!this.xr.isPresenting) return;
        if (this.leftJoints) {
            const leftPinky: Object3D = this.leftJoints['pinky-finger-tip'];
            const leftThumb: Object3D = this.leftJoints['thumb-tip'];

            if (!leftPinky) {
                return;
            }

            const pp = this.pinkyPos;
            const tp = this.thumbPos;
            pp.copy(leftPinky.position);
            tp.copy(leftThumb.position);

            const camera = this.camera;
            pp.applyMatrix4(camera.matrixWorldInverse);
            tp.applyMatrix4(camera.matrixWorldInverse);

            const ui = this.ui.mesh;

            ui.visible = pp.x - tp.x > leftThumb.position.distanceTo(leftPinky.position) * 2 / 3;
            ui.rotation.y = Math.atan2( ( camera.position.x - ui.position.x ), ( camera.position.z - ui.position.z ) );

            if (ui.visible) {
                const np = leftPinky.position.project(camera).add(this.getUITranslateVec()).unproject(camera);
                this.ui.mesh.position.set(np.x, np.y, np.z);
            }
        }
        if (this.rightJoints) {
            this.ui.setFingerJoints(this.rightJoints);
        }

        if (this.ui.mesh.visible) {
            this.ui.update();
        }
    }

    protected abstract getUITranslateVec(): Vector3;
    protected abstract getUIContent(): any;
    protected abstract getUIConfig(evtHandler: ControllerEventHandler<T>): any;

    private handleControllerEvents(controller: Group, hand: Group) {
        controller.addEventListener('connected', (event: any) => {
            if (event.data.handedness === 'left') {
                // console.log('**** left hand detected');
                this.leftJoints = (hand as any).joints;
            }
            if (event.data.handedness === 'right') {
                // console.log('**** right hand detected');
                this.rightJoints = (hand as any).joints;
            }
        });
    }
}
