import * as value3 from "./value3.js";

export class SoftbodyPhysics {
    constructor(gravity = 9.81, terrainCollider) {
        this.gravity = gravity;
        this.terrainCollider = terrainCollider;
        this.nodes = [];
        this.springs = [];
    }

    stepPhysics(dt) {

    }
}