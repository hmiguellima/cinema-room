import { BoxGeometry, Mesh, MeshBasicMaterial, Scene, WebGLRenderer } from "three";

// TODO: Ideally the video player should be pinnable in one of the walls detected by the PlanesManager.
export class PlanesManager {
    private planesAdded = new Set();

    constructor(private renderer: WebGLRenderer, private scene: Scene) {
        this.subscribeToEvents();
    }

    private subscribeToEvents() {
        this.renderer.xr.addEventListener( 'planeadded', this.planeAdded);
        this.renderer.xr.addEventListener( 'planeremoved', this.planeRemoved);
        this.renderer.xr.addEventListener( 'planechanged', this.planeChanged);
        this.renderer.xr.addEventListener( 'planesdetected', this.planesDetected );
    }

    private planeAdded = () => {
        // console.log( "plane added", e.data )
    };

    private planeRemoved = () => {
        // console.log( "plane removed", e.data )
    };

    private planeChanged = () => {
        // console.log( "plane changed", e.data )
    };

    private planesDetected = (e: any) => {
        const detectedPlanes = e.data;

        // console.log( `Detected ${detectedPlanes.size} planes` );

        // @ts-ignore
        detectedPlanes.forEach((plane: XRPlane) => {

            if ( this.planesAdded.has( plane ) ) return;

            if ( plane.orientation.toLowerCase() === 'horizontal') return;

            console.log('*** plane detected', plane, ' - orientation: ', plane.orientation);

            this.planesAdded.add( plane );

            this.showPlanesPlaceholders(plane);
        })
    };

    showPlanesPlaceholders(plane: XRPlane) {
        const referenceSpace = this.renderer.xr.getReferenceSpace();

        const polygon = plane.polygon;

        let minX = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minZ = Number.MAX_SAFE_INTEGER;
        let maxZ = Number.MIN_SAFE_INTEGER;

        polygon.forEach( (point: { x: number; z: number; }) => {

            minX = Math.min( minX, point.x );
            maxX = Math.max( maxX, point.x );
            minZ = Math.min( minZ, point.z );
            maxZ = Math.max( maxZ, point.z );

        } );

        // Show vertical planes on scene:
        const frame = (this.renderer.xr as any).getFrame();
        const planePose = frame.getPose( plane.planeSpace, referenceSpace );
        const width = maxX - minX;
        const height = maxZ - minZ;

        const boxMesh = new Mesh(
            new BoxGeometry( width, 0.01, height ),
            new MeshBasicMaterial( { color: 0xffffff * Math.random(), transparent: true, opacity: 0 } )
        );
        boxMesh.matrixAutoUpdate = false;
        boxMesh.matrix.fromArray( planePose.transform.matrix );
        boxMesh.name = "plane-" + plane.orientation;
        this.scene.add( boxMesh );
    }

    public destroy() {
        this.renderer.xr.removeEventListener( 'planeadded', this.planeAdded);
        this.renderer.xr.removeEventListener( 'planeremoved', this.planeRemoved);
        this.renderer.xr.removeEventListener( 'planechanged', this.planeChanged);
        this.renderer.xr.removeEventListener( 'planesdetected', this.planesDetected );
    }
}