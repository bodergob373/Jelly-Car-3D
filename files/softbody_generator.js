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