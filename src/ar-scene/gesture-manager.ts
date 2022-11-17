import { Group } from "three";
import { VideoPlayer } from "./videoplayer";

export class GestureManager {
    constructor(private controller0: Group, private controller1: Group, private videoPlayer: VideoPlayer) {
        this.handleControllerEventsRightHandGestures(this.controller0!);
        this.handleControllerEventsRightHandGestures(this.controller1!);
        this.handleControllerEventsLeftHandGestures(this.controller0!);
        this.handleControllerEventsLeftHandGestures(this.controller1!);
    }
    
    private handleControllerEventsLeftHandGestures(controller: Group) {
        controller.addEventListener('selectstart', async (event: any) => {
            if (event.data.handedness === 'right') {
                return;
            }

            //TODO: implement custom gesture for left hand here.

            console.log('**** GestureManager-selectstart: left hand detected');
        });

        controller.addEventListener('selectend', async (event: any) => {
            if (event.data.handedness === 'right') {
                return;
            }

            //TODO: implement custom gesture for left hand here.

            console.log('**** GestureManager-selectend: left hand detected');
        });
    }

    private handleControllerEventsRightHandGestures(controller: Group) {
        controller.addEventListener('selectstart', async (event: any) => {
            if (event.data.handedness === 'left') {
                return;
            }

            //TODO: implement custom gesture for right hand here.

            console.log('**** GestureManager-selectstart: right hand detected - start:');
        });

        controller.addEventListener('selectend', async (event: any) => {
            if (event.data.handedness === 'left') {
                return;
            }

            //TODO: implement custom gesture for right hand here.

            console.log('**** GestureManager-selectend: right hand detected - end:');
        });
    }

    public destroy() {
        // TODO
    }
}