export class SoftbodyPhysics {
    constructor(gravity = 9.81, terrainCollider = null) {
        this.gravity = gravity;
        this.terrainCollider = terrainCollider;
        this.nodes = [];
        this.springs = [];
        this.renderTriangles = [];
        this.triangles = [];
        this.velocityDamping = 0.1;
    }

    applyForce(node, direction, magnitude) {
        node.force[0] += direction[0] * magnitude;
        node.force[1] += direction[1] * magnitude;
        node.force[2] += direction[2] * magnitude;
    }

    addTriangle(nodeA, nodeB, nodeC) {
        const triangle = { nodes: [nodeA, nodeB, nodeC], vertices: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };

        this.triangles.push(triangle);
        this.updateTriangle(triangle);
        this.renderTriangles.push(triangle.vertices);

        return triangle.vertices;
    }

    updateTriangle(triangle) {
        const nodes = triangle.nodes;

        for (let i = 0; i < 3; i++) {
            const node = nodes[i];
            const offset = i * 3;

            if (node) {
                triangle.vertices[offset] = node.position[0];
                triangle.vertices[offset + 1] = node.position[1];
                triangle.vertices[offset + 2] = node.position[2];
            }
            else {
                triangle.vertices[offset] = 0;
                triangle.vertices[offset + 1] = 0;
                triangle.vertices[offset + 2] = 0;
            }
        }
    }

    updateTriangles() {
        for (const triangle of this.triangles) {
            this.updateTriangle(triangle);
        }
    }

    rebuildTriangles(triangleDefinitions = []) {
        this.triangles.length = 0;

        for (const definition of triangleDefinitions) {
            this.addTriangle(
                definition[0] ?? null,
                definition[1] ?? null,
                definition[2] ?? null
            );
        }
    }

    addNode(position, mass = 1, friction = 0.5) {
        const node = { position: [...position], velocity: [0, 0, 0], force: [0, 0, 0], mass, friction };

        this.nodes.push(node);

        return node;
    }

    addSpring(nodeA, nodeB, stiffness, damping, freeLength = null) {
        if (freeLength === null) {
            const dx = nodeB.position[0] - nodeA.position[0];
            const dy = nodeB.position[1] - nodeA.position[1];
            const dz = nodeB.position[2] - nodeA.position[2];

            freeLength = Math.hypot(dx, dy, dz);
        }

        const spring = { nodeA, nodeB, stiffness, damping, freeLength };

        this.springs.push(spring);

        return spring;
    }

    stepPhysics(dt) {
        if (dt <= 0) return;

        for (const node of this.nodes) {
            node.force[1] += -this.gravity * node.mass;
        }

        for (const spring of this.springs) {
            this.applySpringForce(spring, dt);
        }

        const decay = Math.exp(-this.velocityDamping * dt);

        for (const node of this.nodes) {
            const invMass = 1 / node.mass;

            node.velocity[0] += node.force[0] * invMass * dt;
            node.velocity[1] += node.force[1] * invMass * dt;
            node.velocity[2] += node.force[2] * invMass * dt;
            node.velocity[0] *= decay;
            node.velocity[1] *= decay;
            node.velocity[2] *= decay;
            node.position[0] += node.velocity[0] * dt;
            node.position[1] += node.velocity[1] * dt;
            node.position[2] += node.velocity[2] * dt;
        }

        if (this.terrainCollider) {
            for (const node of this.nodes) {
                this.resolveTerrainCollision(node, dt);
            }
        }

        for (const node of this.nodes) {
            node.force[0] = 0;
            node.force[1] = 0;
            node.force[2] = 0;
        }
    }

    applySpringForce(spring, dt) {
        const a = spring.nodeA;
        const b = spring.nodeB;
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const length = Math.hypot(dx, dy, dz);

        if (length < 1e-8) return;

        const nx = dx / length;
        const ny = dy / length;
        const nz = dz / length;
        const displacement = length - spring.freeLength;
        const relVelocity = (b.velocity[0] - a.velocity[0]) * nx + (b.velocity[1] - a.velocity[1]) * ny + (b.velocity[2] - a.velocity[2]) * nz;
        //const force = spring.stiffness * displacement + spring.damping * relVelocity;

        const ratio = length / spring.freeLength;
        const distanceToLimit = Math.min(Math.max(ratio - 0.6, 0), Math.max(1.6 - ratio, 0));
        const multiplier = Math.min(1 / distanceToLimit, 100);
        const force = spring.stiffness * multiplier * displacement + spring.damping * relVelocity;

        const fx = force * nx;
        const fy = force * ny;
        const fz = force * nz;

        a.force[0] += fx;
        a.force[1] += fy;
        a.force[2] += fz;
        b.force[0] -= fx;
        b.force[1] -= fy;
        b.force[2] -= fz;
    }

    resolveTerrainCollision(node, dt) {
        const collision = this.terrainCollider.getSurfaceAt(node.position[0], node.position[2]);

        if (!collision) return;

        const penetration = collision.height - node.position[1];

        if (penetration <= 0) return;

        const normal = collision.normal;

        node.position[0] += normal[0] * penetration;
        node.position[1] += normal[1] * penetration;
        node.position[2] += normal[2] * penetration;

        const normalVelocity = node.velocity[0] * normal[0] + node.velocity[1] * normal[1] + node.velocity[2] * normal[2];

        if (normalVelocity < 0) {
            node.velocity[0] -= normal[0] * normalVelocity;
            node.velocity[1] -= normal[1] * normalVelocity;
            node.velocity[2] -= normal[2] * normalVelocity;
        }

        const vx = node.velocity[0];
        const vy = node.velocity[1];
        const vz = node.velocity[2];
        const vn = vx * normal[0] + vy * normal[1] + vz * normal[2];
        const tangentX = vx - normal[0] * vn;
        const tangentY = vy - normal[1] * vn;
        const tangentZ = vz - normal[2] * vn;
        const frictionFactor = Math.exp(-node.friction * dt);

        node.velocity[0] = normal[0] * vn + tangentX * frictionFactor;
        node.velocity[1] = normal[1] * vn + tangentY * frictionFactor;
        node.velocity[2] = normal[2] * vn + tangentZ * frictionFactor;
    }
}