import { Group, WebGLRenderer, Scene, Camera, Vector3, Object3D } from "three";
import { CanvasUI } from "../client/CanvasUI";
import { ControllerEventHandler, EventType } from "../client/controllers";

export class ControllersAR {
    private hand1?: Group;
    private hand2?: Group;
    private leftJoints: any;
    private rightJoints: any;
    private rightIndex: any;
    private ui: CanvasUI;

    constructor(private renderer: WebGLRenderer, private scene: Scene, private evtHandler: ControllerEventHandler,
        private controller1: Group, private controller2: Group, private camera: Camera) {

        // Hands initialisation.
        this.hand1 = this.renderer.xr.getHand(0);
        this.scene.add(this.hand1);

        this.hand2 = this.renderer.xr.getHand(1);
        this.scene.add(this.hand2);

        // handle controller/hand events
        this.handleControllerEvents(this.controller1, this.hand1);
        this.handleControllerEvents(this.controller2, this.hand2);

        const uiConfig = {
            panelSize: { width: 0.280, height: 0.125},
            width: 334,
            height: 128,
            opacity: 0.8,
            info: { type: "text", position:{ left: 6, top: 6 }, width: 320, height: 58, backgroundColor: "#aaa", fontColor: "#000", fontSize: 18 },
            pause: { type: "button", position:{ top: 70, left: 6 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.pause)},
            play: { type: "button", position:{ top: 70, left: 60 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.play) },
            stop: { type: "button", position:{ top: 70, left: 114 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.exit) },
            increaseScreenSize: { type: "button", position:{ top: 70, left: 168 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.screen_size_increase) },
            decreaseScreenSize: { type: "button", position:{ top: 70, left: 226 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.screen_size_decrease) },
            setWall: { type: "button", position:{ top: 70, left: 286 }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: () => this.evtHandler(EventType.set_wall) },
            renderer: this.renderer
        };
        const uiContent = {
            info: 'Press the wall button to place screen',
            pause: '<path>M 17 10 L 7 10 L 7 40 L 17 40 Z M 32 10 L 22 10 L 22 40 L 32 40 Z</path>',
            stop: '<path>M 7 10 L 32 10 L 32 40 L 7 40 Z</path>',
            play: '<path>M 32 25 L 12 10 L 12 40 Z</path>',
            increaseScreenSize: '<path>M 32 20 L 22 13 L 32 10 Z M 12 40 L 12 30 L 23 38 Z M 29 18 L 25 15 L 15 32 L 19 35 Z</path>',
            decreaseScreenSize: '<path>M 32 20 L 22 13 L 22 25 Z M 22 25 L 12 30 L 23 38 Z M 26 16 L 29 18 L 32 14 L 29 12 Z M 13 36 L 16 38 L 19 34 L 16 32 Z</path>',
            setWall: '<path>M 5 14 L 8.4 10.6 L 8.4 34 L 5 41 Z M 28.2 34 L 28.2 10.6 L 10.2 10.6 L 10.2 34 Z M 30 34 L 30 10.6 L 34 14 L 34 42 Z</path>'
        };
        this.ui = new CanvasUI(uiContent, uiConfig);
        this.ui.mesh.visible = false;

        this.scene.add(this.ui.mesh);
    }

    public updateInfoText(text: string) {
        this.ui.updateElement('info', text);
        console.log('**** Updating player info text:', text);
    }

    public update = () => {
        if (!this.renderer.xr.isPresenting) return;
        if (this.leftJoints) {
            const leftPinky: Object3D = this.leftJoints['pinky-finger-tip'];
            const leftThumb: Object3D = this.leftJoints['thumb-tip'];

            if (!leftPinky) {
                return;
            }

            let pp = new Vector3(leftPinky.position.x, leftPinky.position.y, leftPinky.position.z);
            let tp = new Vector3(leftThumb.position.x, leftThumb.position.y, leftThumb.position.z);

            const camera = this.camera;
            pp.applyMatrix4(camera.matrixWorldInverse);
            tp.applyMatrix4(camera.matrixWorldInverse);

            const ui = this.ui.mesh;

            ui.visible = pp.x - tp.x > leftThumb.position.distanceTo(leftPinky.position) * 2 / 3;
            ui.rotation.y = Math.atan2( ( camera.position.x - ui.position.x ), ( camera.position.z - ui.position.z ) );

            if (ui.visible) {
                const np = leftPinky.position.project(camera).add(new Vector3(0.3, 0, 0)).unproject(camera);
                this.ui.mesh.position.set(np.x, np.y, np.z);
            }
        }
        if (this.rightJoints && !this.rightIndex) {
            const rightIndexTip = this.rightJoints['index-finger-tip'];
            const rightIndexPhalanxDistal = this.rightJoints['index-finger-phalanx-distal'];
            this.rightIndex = {tip: rightIndexTip, phalanx: rightIndexPhalanxDistal};
            this.ui?.setRightIndex(this.rightIndex);
        }

        if (this.ui.mesh.visible) {
            this.ui.update();
        }
    }

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
