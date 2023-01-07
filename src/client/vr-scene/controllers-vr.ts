import { Vector3 } from "three";
import { ControllerEventHandler, Controllers } from "../controllers";
import { throttle } from "../../common/throttle";

export enum EventType {
    play,
    pause,
    exit,
}

const UI_PANEL_WIDTH = 0.280;
const UI_TRANSLATE_VEC: Vector3 = new Vector3(UI_PANEL_WIDTH, 0, 0);

export class ControllersVR extends Controllers<EventType> {
    protected getUITranslateVec(): Vector3 {
        return UI_TRANSLATE_VEC;
    }

    protected getUIConfig(evtHandler: ControllerEventHandler<EventType>) {
        function columnPosition(col: number) {
            return 6 + (col * 54);
        }

        function rowPosition(row: number) {
            return 6 + (row * 64);
        }

        let row = 0, col = 0;

        const addButton = (name: string, evt: EventType) => {
            const top = rowPosition(row);
            const left = columnPosition(col++);

            uiConfig[name] = { type: "button", position:{ top, left }, width: 40, height: 52, backgroundColor: "#bbb", fontColor: "#bb0", hover: "#fff", onSelect: throttle(() => evtHandler(evt), 200)};
        };

        const uiConfig: {[key:string]: any} = {
            panelSize: { width: UI_PANEL_WIDTH, height: 0.2},
            width: 334,
            height: 200,
            opacity: 0.8,
            info: { type: "text", position:{ top: rowPosition(row++), left: columnPosition(0) }, width: 320, height: 58, backgroundColor: "#aaa", fontColor: "#000", fontSize: 18 },
        };

        addButton('pause', EventType.pause);
        addButton('play', EventType.play);
        addButton('stop', EventType.exit);

        return uiConfig;
    }

    protected getUIContent() {
        return {
            info: 'Press the wall button to place the screen',
            pause: '<path>M 17 10 L 7 10 L 7 40 L 17 40 Z M 32 10 L 22 10 L 22 40 L 32 40 Z</path>',
            stop: '<path>M 7 10 L 32 10 L 32 40 L 7 40 Z</path>',
            play: '<path>M 32 25 L 12 10 L 12 40 Z</path>',
        };
    }    
}
