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

export function createCuboid(physicsObject, material, centerPosition, size, nodeProperties, springProperties) {
    const [cx, cy, cz] = centerPosition;
    const [sx, sy, sz] = size;
    const hx = sx * 0.5;
    const hy = sy * 0.5;
    const hz = sz * 0.5;

    const positions = [
        [cx - hx, cy - hy, cz - hz],
        [cx + hx, cy - hy, cz - hz],
        [cx + hx, cy + hy, cz - hz],
        [cx - hx, cy + hy, cz - hz],
        [cx - hx, cy - hy, cz + hz],
        [cx + hx, cy - hy, cz + hz],
        [cx + hx, cy + hy, cz + hz],
        [cx - hx, cy + hy, cz + hz],
    ];

    const nodes = positions.map(position => physicsObject.addNode(position, nodeProperties.mass, nodeProperties.friction));

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            physicsObject.addSpring(nodes[i], nodes[j], springProperties.stiffness, springProperties.damping);
        }
    }

    if (material >= 0) {
        const triangles = [
            [0, 1, 2],
            [0, 2, 3],
            [4, 6, 5],
            [4, 7, 6],
            [0, 4, 5],
            [0, 5, 1],
            [3, 2, 6],
            [3, 6, 7],
            [0, 3, 7],
            [0, 7, 4],
            [1, 5, 6],
            [1, 6, 2],
        ];

        for (const [a, b, c] of triangles) {
            const triangle = physicsObject.addTriangle(nodes[a], nodes[b], nodes[c]);
            triangle[9] = material;
            triangleFunctions.uvMapTriangle(triangle);
        }
    }

    return { nodes };
}

export function createDiskFromPoints(physicsObject, material, points, centerPosition = [0, 0, 0], nodeProperties, springProperties) {
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
    const centerNode = physicsObject.addNode([centerPosition[0], centerPosition[1] + centroidY, centerPosition[2] + centroidZ], nodeProperties.mass, nodeProperties.friction);
    const outerNodes = sortedPoints.map(({ y, z }) => physicsObject.addNode([centerPosition[0], centerPosition[1] + z, centerPosition[2] - y], nodeProperties.mass, nodeProperties.friction));

    for (let i = 0; i < outerNodes.length; i++) {
        const current = outerNodes[i];
        const next = outerNodes[(i + 1) % outerNodes.length];

        physicsObject.addSpring(centerNode, current, springProperties.stiffness, springProperties.damping);
        physicsObject.addSpring(current, next, springProperties.stiffness, springProperties.damping);

        if (material >= 0) {
            const triangle = physicsObject.addTriangle(centerNode, current, next);

            triangle[9] = material;
            triangleFunctions.uvMapTriangle(triangle);
        }
    }

    return [centerNode, outerNodes];
}

export function createCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition = [0, 0, 0], points, thickness = 1, nodeProperties, springProperties) {
    if (!points || points.length < 3) {
        return { centerNodes: [], outerNodes: [] };
    }

    const center1 = [centerPosition[0] - thickness * 0.5, centerPosition[1], centerPosition[2]];
    const center2 = [centerPosition[0] + thickness * 0.5, centerPosition[1], centerPosition[2]];
    const [centerNode1, outerNodes1] = createDiskFromPoints(physicsObject, faceMaterial, points, center1, nodeProperties, springProperties);
    const [centerNode2, outerNodes2] = createDiskFromPoints(physicsObject, faceMaterial, points, center2, nodeProperties, springProperties);

    for (let i = 0; i < outerNodes1.length; i++) {
        const next = (i + 1) % outerNodes1.length;
        const a = outerNodes1[i];
        const b = outerNodes2[i];
        const c = outerNodes1[next];
        const d = outerNodes2[next];

        physicsObject.addSpring(a, centerNode2, springProperties.stiffness, springProperties.damping);
        physicsObject.addSpring(b, centerNode1, springProperties.stiffness, springProperties.damping);
        physicsObject.addSpring(a, b, springProperties.stiffness, springProperties.damping);
        physicsObject.addSpring(b, c, springProperties.stiffness, springProperties.damping);
        physicsObject.addSpring(a, d, springProperties.stiffness, springProperties.damping);

        if (edgeMaterial >= 0) {
            const triangle1 = physicsObject.addTriangle(a, c, b);
            triangle1[9] = edgeMaterial;
            triangleFunctions.uvMapTriangle(triangle1);

            const triangle2 = physicsObject.addTriangle(b, c, d);
            triangle2[9] = edgeMaterial;
            triangleFunctions.uvMapTriangle(triangle2);
        }
    }

    physicsObject.addSpring(centerNode1, centerNode2, springProperties.stiffness, springProperties.damping);

    return { centerNodes: [centerNode1, centerNode2], outerNodes: [outerNodes1, outerNodes2] };
}

export function createCircularCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition = [0, 0, 0], radius = 1, thickness = 1, outerNodeCount = 16, nodeProperties, springProperties) {
    const { points } = getCircleData([0, 0, 0], radius, outerNodeCount);

    return createCylinder(physicsObject, faceMaterial, edgeMaterial, centerPosition, points, thickness, nodeProperties, springProperties);
}


export function createCar(physicsObject, baseMaterial, tireMaterial, rimMaterial, centerPosition, basePoints, baseThickness, frontWheelRadius, frontWheelWidth, rearWheelRadius, rearWheelWidth, frontAxleWidth, rearAxleWidth, frontAxleZOffset, rearAxleZOffset, baseYOffset, wheelOuterNodeCount, chassisNodeProperties, chassisSpringProperties, frontSuspensionProperties, rearSuspensionProperties, axleSpringProperties, tireNodeProperties, tireSpringProperties, baseNodeProperties, baseSpringProperties) {
    const basePosition = [centerPosition[0], centerPosition[1] + baseYOffset, centerPosition[2]];
    const base = createCylinder(physicsObject, baseMaterial, baseMaterial, basePosition, basePoints, baseThickness, baseNodeProperties, baseSpringProperties);
    const chassis = createCuboid(physicsObject, -1, [centerPosition[0], centerPosition[1] + baseYOffset + 0.2, centerPosition[2]], [(frontAxleWidth + rearAxleWidth) / 4, 0.4, Math.abs(rearAxleZOffset - frontAxleZOffset)], chassisNodeProperties, chassisSpringProperties);
    const baseNodes = [...base.centerNodes, ...base.outerNodes[0], ...base.outerNodes[1]];
    const chassisNodes = chassis.nodes;
    const chassisCenterNode = physicsObject.addNode([centerPosition[0], centerPosition[1] + baseYOffset + 0.8, centerPosition[2]], chassisNodeProperties.mass, 0);

    chassisNodes.push(chassisCenterNode);

    function addWheel(xOffset, zOffset, wheelRadius, wheelWidth, suspensionProperties) {
        const wheelPosition = [centerPosition[0] + xOffset, centerPosition[1], centerPosition[2] + zOffset];
        const wheel = createCircularCylinder(physicsObject, rimMaterial, tireMaterial, wheelPosition, wheelRadius, wheelWidth, wheelOuterNodeCount, tireNodeProperties, tireSpringProperties);
        const [centerNode1, centerNode2] = wheel.centerNodes;
        const [outerNodes1, outerNodes2] = wheel.outerNodes;

        for (const centerNode of [centerNode1, centerNode2]) {
            for (const chassisNode of chassisNodes) {
                physicsObject.addSpring(centerNode, chassisNode, suspensionProperties.stiffness, suspensionProperties.damping);
            }
        }

        return [[centerNode1, outerNodes1], [centerNode2, outerNodes2]];
    }

    for (const chassisNode of chassisNodes) {
        physicsObject.addSpring(chassisCenterNode, chassisNode, chassisSpringProperties.stiffness, chassisSpringProperties.damping);

        for (const baseNode of baseNodes) {
            let heightDifference = Math.max(baseNode.position[1] - centerPosition[1], 0);
            let stiffnessModifier = 1 / (0.2 + heightDifference);

            physicsObject.addSpring(chassisNode, baseNode, baseSpringProperties.stiffness * stiffnessModifier, baseSpringProperties.damping);
        }
    }

    const fl = addWheel(-frontAxleWidth * 0.5, frontAxleZOffset, frontWheelRadius, frontWheelWidth, frontSuspensionProperties);
    const fr = addWheel(frontAxleWidth * 0.5, frontAxleZOffset, frontWheelRadius, frontWheelWidth, frontSuspensionProperties);
    const rl = addWheel(-rearAxleWidth * 0.5, rearAxleZOffset, rearWheelRadius, rearWheelWidth, rearSuspensionProperties);
    const rr = addWheel(rearAxleWidth * 0.5, rearAxleZOffset, rearWheelRadius, rearWheelWidth, rearSuspensionProperties);

    const axles = [[fl, fr], [rl, rr]];

    for (const [wheelA, wheelB] of axles) {
        const centerNodesA = [wheelA[0][0], wheelA[1][0]];
        const centerNodesB = [wheelB[0][0], wheelB[1][0]];
        const outerNodesA = [wheelA[0][1], wheelA[1][1]];
        const outerNodesB = [wheelB[0][1], wheelB[1][1]];

        for (const centerNode of centerNodesA) {
            for (const outerNodes of outerNodesB) {
                for (const outerNode of outerNodes) {
                    physicsObject.addSpring(centerNode, outerNode, axleSpringProperties.stiffness, axleSpringProperties.damping);
                }
            }

            physicsObject.addSpring(centerNode, centerNodesB[0], axleSpringProperties.stiffness, axleSpringProperties.damping);
            physicsObject.addSpring(centerNode, centerNodesB[1], axleSpringProperties.stiffness, axleSpringProperties.damping);
        }

        for (const centerNode of centerNodesB) {
            for (const outerNodes of outerNodesA) {
                for (const outerNode of outerNodes) {
                    physicsObject.addSpring(centerNode, outerNode, axleSpringProperties.stiffness, axleSpringProperties.damping);
                }
            }
        }
    }

    return { chassis: chassisNodes, fl, fr, rl, rr };
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