import { CFrame } from "./cframe.js";
import { Enum } from "./enums.js";

export class Camera {
    constructor(focus = [0, 0, 0], zoom = 0, fov = 80, pitch = 0, yaw = 0) {
        this.focus = focus;
        this.pitch = pitch;
        this.yaw = yaw;
        this.zoom = zoom;
        this.fov = fov;
        this.rotation = new CFrame();
        this.cframe = new CFrame();
        this.minZoom = 0;
        this.maxZoom = 100;
        this.pitchLimit = Math.PI / 2;
        this.updateCFrame();
    }

    updateCFrame() {
        this.rotation = CFrame.fromEulerAngles(this.pitch, this.yaw, 0, Enum.RotationOrder.XYZ);
        this.cframe = new CFrame(...this.focus).mult(this.rotation).mult(new CFrame(0, 0, this.zoom));
    }

    setFocus(focus) {
        this.focus = focus;
        this.updateCFrame();
    }

    setRotation(pitch, yaw) {
        this.pitch = Math.max(Math.min(pitch, this.pitchLimit), -this.pitchLimit);
        this.yaw = yaw;
        this.updateCFrame();
    }

    setZoom(zoom) {
        this.zoom = Math.max(Math.min(zoom, this.maxZoom), this.minZoom);
        this.updateCFrame();
    }
}