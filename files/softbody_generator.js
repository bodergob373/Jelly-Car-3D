import * as value3 from "./value3.js";
import * as triangleFunctions from "./triangle_functions.js";

export function createIcosphere(physicsObject, centerPosition = [0, 0, 0], radius = 10, subdivisions = 0, mass = 1, friction = 100, surfaceStiffness = 100, centerStiffness = 100, damping = 0) {
    const centralNode = physicsObject.addNode(centerPosition, mass * 2, 0);
    const nodes = [];
    const t = (1 + Math.sqrt(5)) / 2;

    const positions = [
        [-1, t, 0],
        [1, t, 0],
        [-1, -t, 0],
        [1, -t, 0],
        [0, -1, t],
        [0, 1, t],
        [0, -1, -t],
        [0, 1, -t],
        [t, 0, -1],
        [t, 0, 1],
        [-t, 0, -1],
        [-t, 0, 1]
    ];

    for (const position of positions) {
        const newPos = value3.mul(value3.norm(position), radius);

        nodes.push(physicsObject.addNode(newPos, mass, friction));
    }

    let faces = [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1]
    ];

    const midpointCache = new Map();

    const getMidpoint = (a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const key = `${min},${max}`;

        const cached = midpointCache.get(key);

        if (cached !== undefined) {
            return cached;
        }

        const pa = nodes[a].position;
        const pb = nodes[b].position;
        const x = (pa[0] + pb[0]) * 0.5;
        const y = (pa[1] + pb[1]) * 0.5;
        const z = (pa[2] + pb[2]) * 0.5;
        const point = value3.mul(value3.norm([x, y, z]), radius)
        const node = physicsObject.addNode(point, mass, friction);
        const index = nodes.length;

        nodes.push(node);
        midpointCache.set(key, index);

        return index;
    };

    for (let level = 0; level < subdivisions; level++) {
        const newFaces = [];

        for (const [a, b, c] of faces) {
            const ab = getMidpoint(a, b);
            const bc = getMidpoint(b, c);
            const ca = getMidpoint(c, a);

            newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        }

        faces = newFaces;
    }

    const edgeSet = new Set();

    for (const [a, b, c] of faces) {
        const edges = [[a, b], [b, c], [c, a]];

        for (const [i, j] of edges) {
            const min = Math.min(i, j);
            const max = Math.max(i, j);
            const key = `${min},${max}`;

            if (edgeSet.has(key)) continue;

            edgeSet.add(key);

            physicsObject.addSpring(nodes[i], nodes[j], surfaceStiffness, damping);
        }
    }

    for (const node of nodes) {
        node.position = value3.add(node.position, centerPosition);
        physicsObject.addSpring(centralNode, node, centerStiffness, damping);
    }

    for (const [a, b, c] of faces) {
        const triangle = physicsObject.addTriangle(nodes[a], nodes[b], nodes[c]);

        triangle[9] = 4;
        triangleFunctions.uvMapTriangle(triangle);
    }

    return centralNode;
}

export function getCircleData(centerPosition = [0, 0, 0], radius = 10, outerNodeCount = 16) {
    const center = [centerPosition[0], centerPosition[1], centerPosition[2]];
    const outerPoints = [];

    for (let i = 0; i < outerNodeCount; i++) {
        const angle = (i / outerNodeCount) * Math.PI * 2;

        outerPoints.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }

    return { center, points: outerPoints };
}

export function createDiskFromPoints(physicsObject, faceMaterial, points, centerPosition = [0, 0, 0], mass = 1, friction = 100, stiffness = 100, damping = 0) {
    if (points.length < 3) {
        return [];
    }

    let centroidY = 0;
    let centroidZ = 0;

    for (const [nz, y] of points) {
        centroidZ -= nz;
        centroidY += y;
    }

    centroidY /= points.length;
    centroidZ /= points.length;

    const sortedPoints = points.map(([y, z]) => ({ y, z, angle: Math.atan2(z - centroidZ, y - centroidY) })).sort((a, b) => a.angle - b.angle);
    const centerNode = physicsObject.addNode([centerPosition[0], centerPosition[1] + centroidY, centerPosition[2] + centroidZ], mass, friction);
    const outerNodes = sortedPoints.map(({ y, z }) => physicsObject.addNode([centerPosition[0], centerPosition[1] + z, centerPosition[2] - y], mass, friction));

    for (let i = 0; i < outerNodes.length; i++) {
        const current = outerNodes[i];
        const next = outerNodes[(i + 1) % outerNodes.length];

        physicsObject.addSpring(centerNode, current, stiffness, damping);
        physicsObject.addSpring(current, next, stiffness, damping);

        const triangle = physicsObject.addTriangle(centerNode, current, next);

        triangle[9] = faceMaterial;
        triangleFunctions.uvMapTriangle(triangle);
    }

    return [centerNode, outerNodes];
}

export function createCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition = [0, 0, 0], points, thickness = 1, mass = 1, friction = 100, stiffness = 100, damping = 0) {
    if (!points || points.length < 3) {
        return { centerNodes: [], outerNodes: [] };
    }

    const center1 = [centerPosition[0] - thickness * 0.5, centerPosition[1], centerPosition[2]];
    const center2 = [centerPosition[0] + thickness * 0.5, centerPosition[1], centerPosition[2]];
    const [centerNode1, outerNodes1] = createDiskFromPoints(physicsObject, faceMaterial, points, center1, mass, friction, stiffness, damping);
    const [centerNode2, outerNodes2] = createDiskFromPoints(physicsObject, faceMaterial, points, center2, mass, friction, stiffness, damping);

    for (let i = 0; i < outerNodes1.length; i++) {
        const next = (i + 1) % outerNodes1.length;
        const a = outerNodes1[i];
        const b = outerNodes2[i];
        const c = outerNodes1[next];
        const d = outerNodes2[next];

        physicsObject.addSpring(a, centerNode2, stiffness, damping);
        physicsObject.addSpring(b, centerNode1, stiffness, damping);
        physicsObject.addSpring(a, b, stiffness, damping);
        physicsObject.addSpring(b, c, stiffness, damping);
        physicsObject.addSpring(a, d, stiffness, damping);

        const triangle1 = physicsObject.addTriangle(a, c, b);
        triangle1[9] = edgeMaterial;
        triangleFunctions.uvMapTriangle(triangle1);

        const triangle2 = physicsObject.addTriangle(b, c, d);
        triangle2[9] = edgeMaterial;
        triangleFunctions.uvMapTriangle(triangle2);
    }

    physicsObject.addSpring(centerNode1, centerNode2, stiffness, damping);

    return { centerNodes: [centerNode1, centerNode2], outerNodes: [outerNodes1, outerNodes2] };
}

export function createCircularCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition = [0, 0, 0], radius = 1, thickness = 1, outerNodeCount = 16, mass = 1, friction = 100, stiffness = 100, damping = 0) {
    const { points } = getCircleData([0, 0, 0], radius, outerNodeCount);

    return createCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition, points, thickness, mass, friction, stiffness, damping);
}


export function createCar(physicsObject, baseMaterial = 0, tireMaterial = 0, rimMaterial = 0, centerPosition = [0, 0, 0], basePoints, baseThickness, wheelRadius = 5, wheelThickness = 3, wheelbaseWidth = 10, frontWheelZOffset = 10, rearWheelZOffset = -10, baseYOffset = 0, wheelOuterNodeCount = 12, mass = 1, friction = 100, stiffness = 100, damping = 0) {
    const basePosition = [centerPosition[0], centerPosition[1] + baseYOffset, centerPosition[2]];
    const base = createCylinder(physicsObject, baseMaterial, baseMaterial, basePosition, basePoints, baseThickness, mass, friction, stiffness, damping);
    const baseNodes = [...base.centerNodes, ...base.outerNodes[0], ...base.outerNodes[1]];
    const carCenterNode = physicsObject.addNode([centerPosition[0], centerPosition[1] + 0.8, centerPosition[2]], mass, 0);

    function addWheel(xOffset, zOffset) {
        const wheelPosition = [centerPosition[0] + xOffset, centerPosition[1], centerPosition[2] + zOffset];
        const wheel = createCircularCylinder(physicsObject, rimMaterial, tireMaterial, wheelPosition, wheelRadius, wheelThickness, wheelOuterNodeCount, mass, friction, stiffness, damping);
        const [centerNode1, centerNode2] = wheel.centerNodes;
        const [outerNodes1, outerNodes2] = wheel.outerNodes;

        for (const centerNode of [centerNode1, centerNode2]) {
            for (const node of baseNodes) {
                physicsObject.addSpring(centerNode, node, stiffness, damping);
            }

            physicsObject.addSpring(centerNode, carCenterNode, stiffness, damping);
        }

        return [[centerNode1, outerNodes1], [centerNode2, outerNodes2]];
    }

    const fl = addWheel(-wheelbaseWidth * 0.5, frontWheelZOffset);
    const fr = addWheel(wheelbaseWidth * 0.5, frontWheelZOffset);
    const rl = addWheel(-wheelbaseWidth * 0.5, rearWheelZOffset);
    const rr = addWheel(wheelbaseWidth * 0.5, rearWheelZOffset);

    const wheels = [fl, fr, rl, rr];

    for (let i = 0; i < wheels.length; i++) {
        for (let j = i + 1; j < wheels.length; j++) {
            for (const nodeA of [wheels[i][0][0], wheels[i][1][0]]) {
                for (const nodeB of [wheels[j][0][0], wheels[j][1][0]]) {
                    physicsObject.addSpring(nodeA, nodeB, stiffness, damping);
                }
            }
        }
    }

    return { base: baseNodes, fl, fr, rl, rr };
}

export function applyDiskSpin(physicsObject, disk, targetSpeed = 0, strength = 1) {
    const [centerNode, outerNodes] = disk;

    if (outerNodes.length < 2) return;

    const center = centerNode.position;

    let normal = [0, 0, 0];

    for (let i = 0; i < outerNodes.length; i++) {
        const a = outerNodes[i].position;
        const b = outerNodes[(i + 1) % outerNodes.length].position;

        const ax = a[0] - center[0];
        const ay = a[1] - center[1];
        const az = a[2] - center[2];

        const bx = b[0] - center[0];
        const by = b[1] - center[1];
        const bz = b[2] - center[2];

        normal[0] += ay * bz - az * by;
        normal[1] += az * bx - ax * bz;
        normal[2] += ax * by - ay * bx;
    }

    const normalLength = Math.hypot(...normal);

    if (normalLength < 1e-8) return;

    normal = normal.map(v => v / normalLength);

    let angularVelocity = 0;
    let totalWeight = 0;

    for (const node of outerNodes) {
        const p = node.position;
        const v = node.velocity;

        const rx = p[0] - center[0];
        const ry = p[1] - center[1];
        const rz = p[2] - center[2];

        const radialDistanceSq = rx * rx + ry * ry + rz * rz;

        if (radialDistanceSq < 1e-8) continue;

        const angularSpeed = (normal[0] * (ry * v[2] - rz * v[1]) + normal[1] * (rz * v[0] - rx * v[2]) + normal[2] * (rx * v[1] - ry * v[0])) / radialDistanceSq;

        angularVelocity += angularSpeed;
        totalWeight++;
    }

    if (totalWeight === 0) return;

    angularVelocity /= totalWeight;

    const speedError = targetSpeed - angularVelocity;

    for (const node of outerNodes) {
        const p = node.position;

        let rx = p[0] - center[0];
        let ry = p[1] - center[1];
        let rz = p[2] - center[2];

        const normalComponent = rx * normal[0] + ry * normal[1] + rz * normal[2];

        rx -= normalComponent * normal[0];
        ry -= normalComponent * normal[1];
        rz -= normalComponent * normal[2];

        const radialLength = Math.hypot(rx, ry, rz);

        if (radialLength < 1e-8) continue;

        rx /= radialLength;
        ry /= radialLength;
        rz /= radialLength;

        const tx = normal[1] * rz - normal[2] * ry;
        const ty = normal[2] * rx - normal[0] * rz;
        const tz = normal[0] * ry - normal[1] * rx;

        physicsObject.applyForce(node, [tx, ty, tz], speedError * strength);
    }
}