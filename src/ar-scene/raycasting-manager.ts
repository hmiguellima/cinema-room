import { Box3, Camera, Group, Raycaster, Scene, Vector3 } from "three";

// TODO: Ideally the video player should be pinnable in one of the walls detected by the PlanesManager.
export class RaycastingManager {
    private raycaster = new Raycaster();
    private lastVerticalHit: Vector3 | null = null;

    constructor(private controller: Group, private camera: Camera, private scene: Scene) {
    }

    public render = () => {
        const touchOrigin = new Vector3().setFromMatrixPosition(this.controller.matrixWorld);
        const cameraPosition = new Vector3().setFromMatrixPosition(this.camera.matrixWorld);
        const directionFromCamera = touchOrigin.clone().sub(cameraPosition).normalize();

        this.raycaster.set(touchOrigin, directionFromCamera);
        const intersects = this.raycaster.intersectObjects( this.scene.children );

        if (intersects && intersects.length >= 1) {
            intersects.forEach(i => {
                if (intersects[0].object.name === 'plane-Vertical') {
                    const center = this.getCenterPoint(i.object);

                    this.lastVerticalHit = center;
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

    public getLatestVerticalHit() {
        return this.lastVerticalHit;
    }

    public destroy() {
    }
}