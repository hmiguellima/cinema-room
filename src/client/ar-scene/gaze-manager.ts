import { Camera, Group, Object3D, Raycaster, Scene, Vector3 } from "three";

// TODO: Ideally the video player should be pinnable in one of the walls detected by the PlanesManager.
export class GazeManager {
    private raycaster = new Raycaster();
    private lastVerticalHitCenter?: Vector3;
    private lastVerticalHitObject?: Object3D;
    private cameraDirection = new Vector3();

    constructor(private camera: Camera, private scene: Scene) {
    }

    public update() {
        this.camera.getWorldDirection(this.cameraDirection);

        this.raycaster.set(this.camera.position, this.cameraDirection);
        const plane = this.raycaster.intersectObjects(this.scene.children)[0]?.object;

        if (plane?.name === 'plane-Vertical') {
            const center = this.getCenterPoint(plane);
            this.lastVerticalHitCenter = center;
            this.lastVerticalHitObject = plane;
        }
    }

    private getCenterPoint(mesh: any) {
        var geometry = mesh.geometry;
        geometry.computeBoundingBox();
        var center = new Vector3();
        geometry.boundingBox.getCenter( center );
        mesh.localToWorld( center );
        return center;
    }

    public getLatestVerticalHitCenter(): Vector3 | undefined {
        return this.lastVerticalHitCenter;
    }

    public getLatestVerticalHitObject(): Object3D | undefined {
        return this.lastVerticalHitObject;
    }

    public destroy() {
    }
}