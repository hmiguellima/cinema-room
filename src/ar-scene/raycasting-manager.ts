import { Camera, Group, Object3D, Raycaster, Scene, Vector3 } from "three";

// TODO: Ideally the video player should be pinnable in one of the walls detected by the PlanesManager.
export class RaycastingManager {
    private raycaster = new Raycaster();
    private lastVerticalHitCenter?: Vector3;
    private lastVerticalHitObject?: Object3D;
    private cameraDirection = new Vector3();

    constructor(private controller: Group, private camera: Camera, private scene: Scene) {
    }

    public render = () => {
        this.camera.getWorldDirection(this.cameraDirection);

        this.raycaster.set(this.camera.position, this.cameraDirection);
        const intersects = this.raycaster.intersectObjects( this.scene.children );

        if (intersects && intersects.length >= 1) {
            intersects.forEach(i => {
                if (intersects[0].object.name === 'plane-Vertical') {
                    const center = this.getCenterPoint(i.object);

                    this.lastVerticalHitCenter = center;
                    this.lastVerticalHitObject = intersects[0].object;
                    return;
                }
            })
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