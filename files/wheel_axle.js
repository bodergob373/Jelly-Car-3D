export class WheelAxle {
    constructor(wheelRadius, wheelWidth, trackWidth, zOffset, tireNodeCount, suspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties) {
        this.wheelRadius = wheelRadius;
        this.wheelWidth = wheelWidth;
        this.trackWidth = trackWidth;
        this.zOffset = zOffset;
        this.tireNodeCount = tireNodeCount;
        this.suspensionProperties = suspensionProperties;
        this.tireNodeProperties = tireNodeProperties;
        this.tireSpringProperties = tireSpringProperties;
        this.axleSpringProperties = axleSpringProperties;
    }
}