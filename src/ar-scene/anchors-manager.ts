import { WebGLRenderer } from "three";

export class AnchorsManager {
    constructor(private renderer: WebGLRenderer) {
        this.subscribeToEvents();
    }

    private subscribeToEvents() {
        this.renderer.xr.addEventListener( 'anchoradded', this.anchorAdded);
        this.renderer.xr.addEventListener( 'anchorremoved', this.anchorRemoved);
        this.renderer.xr.addEventListener( 'anchorposechanged', this.anchorChanged);
    }

    private anchorAdded = () => {
        // console.log( "anchor added", e.data )
    };

    private anchorRemoved = () => {
        // console.log( "anchor removed", e.data )
    };

    private anchorChanged = (e: any) => {
        // console.log( "anchor changed", e.data )
    };

    private unsubscribeFromEvents() {
        this.renderer.xr.removeEventListener( 'anchoradded', this.anchorAdded);
        this.renderer.xr.removeEventListener( 'anchorremoved', this.anchorRemoved);
        this.renderer.xr.removeEventListener( 'anchorposechanged', this.anchorChanged);
    }

    public destroy() {
        this.unsubscribeFromEvents();
    }
}