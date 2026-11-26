export class NodeProperties {
    constructor(mass = 1, friction = 100, collisionEnabled = true) {
        this.mass = mass;
        this.friction = friction;
        this.collisionEnabled = collisionEnabled;
    }
}