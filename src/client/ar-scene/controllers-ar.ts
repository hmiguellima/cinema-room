import { Group, WebGLRenderer, Scene, Camera, Vector3, Object3D } from "three";
import { ControllerEventHandler, Controllers } from "../controllers";
import { throttle } from "../../common/throttle";

export enum EventType {
    play,
    pause,
    exit,
    screen_size_increase,
    screen_size_decrease,
    set_wall,
    move_screen_left,
    move_screen_right,
    move_screen_up,
    move_screen_down,
}

const UI_PANEL_WIDTH = 0.280;
const UI_TRANSLATE_VEC: Vector3 = new Vector3(UI_PANEL_WIDTH, 0, 0);

export class ControllersAR extends Controllers<EventType> {
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
        addButton('setWall', EventType.set_wall);
        row++;
        col = 0;
        addButton('increaseScreenSize', EventType.screen_size_increase);
        addButton('decreaseScreenSize', EventType.screen_size_decrease);
        addButton('leftArrow', EventType.move_screen_left);
        addButton('rightArrow', EventType.move_screen_right);
        addButton('upArrow', EventType.move_screen_up);
        addButton('downArrow', EventType.move_screen_down);

        return uiConfig;
    }

    protected getUIContent() {
        return {
            info: 'Press the wall button to place the screen',
            pause: '<path>M 17 10 L 7 10 L 7 40 L 17 40 Z M 32 10 L 22 10 L 22 40 L 32 40 Z</path>',
            stop: '<path>M 7 10 L 32 10 L 32 40 L 7 40 Z</path>',
            play: '<path>M 32 25 L 12 10 L 12 40 Z</path>',
            increaseScreenSize: '<path>M 32 20 L 22 13 L 32 10 Z M 12 40 L 12 30 L 23 38 Z M 29 18 L 25 15 L 15 32 L 19 35 Z</path>',
            decreaseScreenSize: '<path>M 32 20 L 22 13 L 22 25 Z M 22 25 L 12 30 L 23 38 Z M 26 16 L 29 18 L 32 14 L 29 12 Z M 13 36 L 16 38 L 19 34 L 16 32 Z</path>',
            setWall: '<path>M 5 14 L 8.4 10.6 L 8.4 34 L 5 41 Z M 28.2 34 L 28.2 10.6 L 10.2 10.6 L 10.2 34 Z M 30 34 L 30 10.6 L 34 14 L 34 42 Z</path>',
            rightArrow: '<path>M 31 23 L 20 11 L 20 19 L 12 20 L 12 26 L 20 27 L 20 34 Z</path>',
            leftArrow: '<path>M 12 23 L 20 11 L 20 19 L 27 20 L 27 26 L 20 27 L 20 34 Z</path>',
            upArrow: '<path>M 20 13 L 28 19 L 23 19 L 22 27 L 18 27 L 17 19 L 12 19 Z</path>',
            downArrow: '<path>M 20 26 L 28 19 L 23 19 L 22 13 L 18 13 L 17 19 L 12 19 Z</path>'
        };
    }
}
