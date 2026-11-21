import * as value3 from "./value3.js";
import { Material } from "./material.js";
import { Sky } from "./sky.js";
import { Renderer } from "./renderer_v2.js";
import { Camera } from "./camera.js";
import { ProceduralTerrain } from "./procedural_terrain.js";
import { SoftbodyPhysics } from "./softbody_physics.js";

const canvas3D = document.getElementById("canvas3D");
const titleScreen = document.getElementById("titleScreen");
const renderer = new Renderer(canvas3D);
const canvasOverlay = document.getElementById("canvasOverlay");
const overlayContext = canvasOverlay.getContext("2d");

const CAM_MOVE_SPEED = 50;
const CAM_ZOOM_SPEED = 0.08;
const CAMERA_ROT_SPEED = 0.01;

const DAY_LENGTH = 240;
const nightSpeedMultiplier = 16.0;

const TERRAIN_LAYERS = [
    { Frequency: 0.0008, Amplitude: 128 },
    { Frequency: 0.002, Amplitude: 64 },
    { Frequency: 0.004, Amplitude: 32 },
    { Frequency: 0.008, Amplitude: 16 },
    { Frequency: 0.02, Amplitude: 8 },
    { Frequency: 0.04, Amplitude: 4 },
    { Frequency: 0.08, Amplitude: 2 },
]

const TERRAIN_SEED = Date.now();
const terrain = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 8, 0, 200, 200);
const terrainFar1 = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 16, -1, 400, 400, 200, 200);
const terrainFar2 = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 32, -3, 1200, 1200, 400, 400);

let physics = null;
let sphereCenter = null;

let lastFrameTime = performance.now();
let dt;

const keyData = [];
let mouseLeft = false;
let mouseRight = false;
let mouseDelta = [0, 0];

let camera = new Camera([0, 0, 10], 40, 0, 1000);

let resolutionScale = 0.5;

function reset() {
    const mass = 1;
    const friction = 100;
    const stiffness = 40;
    const centerStiffness = 10;
    const damping = 1;

    physics = new SoftbodyPhysics(9.81, terrain);
    sphereCenter = createIcosphere(10, 1, mass, friction, stiffness, centerStiffness, damping);
}

function createIcosphere(radius = 1, subdivisions = 1, mass = 1, friction = 1, stiffness = 10, centerStiffness = 10, damping = 0) {
    const nodes = [];
    const triangles = [];
    const centralNode = physics.addNode([0, 0, 0], mass * 10, 0);

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
        const length = Math.hypot(
            position[0],
            position[1],
            position[2]
        );

        position[0] = position[0] / length * radius;
        position[1] = position[1] / length * radius;
        position[2] = position[2] / length * radius;
    }

    for (const position of positions) {
        nodes.push(
            physics.addNode(position, mass, friction)
        );
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

        let x = (pa[0] + pb[0]) * 0.5;
        let y = (pa[1] + pb[1]) * 0.5;
        let z = (pa[2] + pb[2]) * 0.5;

        const length = Math.hypot(x, y, z);

        x = x / length * radius;
        y = y / length * radius;
        z = z / length * radius;

        const node = physics.addNode(
            [x, y, z],
            mass,
            friction
        );

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

            newFaces.push(
                [a, ab, ca],
                [b, bc, ab],
                [c, ca, bc],
                [ab, bc, ca]
            );
        }

        faces = newFaces;
    }

    const edgeSet = new Set();

    for (const [a, b, c] of faces) {
        const edges = [
            [a, b],
            [b, c],
            [c, a]
        ];

        for (const [i, j] of edges) {
            const min = Math.min(i, j);
            const max = Math.max(i, j);
            const key = `${min},${max}`;

            if (edgeSet.has(key)) continue;

            edgeSet.add(key);

            physics.addSpring(
                nodes[i],
                nodes[j],
                stiffness,
                damping
            );
        }
    }

    for (const node of nodes) {
        physics.addSpring(
            centralNode,
            node,
            centerStiffness,
            damping
        );
    }

    for (const [a, b, c] of faces) {
        const triangle = physics.addTriangle(nodes[a], nodes[b], nodes[c]);

        triangle[9] = 4;
        uvMapTriangle(triangle);
    }

    return centralNode;
}

function resize() {
    canvas3D.width = window.innerWidth * resolutionScale;
    canvas3D.height = window.innerHeight * resolutionScale;
    canvasOverlay.width = window.innerWidth;
    canvasOverlay.height = window.innerHeight;
    renderer.resize();
}

function uvMapTriangle(triangle) {
    const cx = (triangle[0] + triangle[3] + triangle[6]) / 3;
    const cy = (triangle[1] + triangle[4] + triangle[7]) / 3;
    const cz = (triangle[2] + triangle[5] + triangle[8]) / 3;
    const ux = triangle[3] - triangle[0];
    const uy = triangle[4] - triangle[1];
    const uz = triangle[5] - triangle[2];
    const vx = triangle[6] - triangle[0];
    const vy = triangle[7] - triangle[1];
    const vz = triangle[8] - triangle[2];
    const normal = value3.norm(value3.cross([ux, uy, uz], [vx, vy, vz]));
    const xAxisDir = value3.norm([ux, uy, uz]);
    const yAxisDir = value3.norm(value3.cross(normal, xAxisDir));
    const rel1 = [triangle[0] - cx, triangle[1] - cy, triangle[2] - cz];
    const rel2 = [triangle[3] - cx, triangle[4] - cy, triangle[5] - cz];
    const rel3 = [triangle[6] - cx, triangle[7] - cy, triangle[8] - cz];
    const x1 = value3.dot(rel1, xAxisDir);
    const y1 = value3.dot(rel1, yAxisDir);
    const x2 = value3.dot(rel2, xAxisDir);
    const y2 = value3.dot(rel2, yAxisDir);
    const x3 = value3.dot(rel3, xAxisDir);
    const y3 = value3.dot(rel3, yAxisDir);
    const textureScale = renderer.materials[triangle[9]].scale;
    const uOffset = Math.random() * textureScale;
    const vOffset = Math.random() * textureScale;

    triangle[10] = x1 + uOffset;
    triangle[11] = y1 + vOffset;
    triangle[12] = x2 + uOffset;
    triangle[13] = y2 + vOffset;
    triangle[14] = x3 + uOffset;
    triangle[15] = y3 + vOffset;
}

function textureTerrainTiles(tiles, steepnessModifier = 1) {
    for (let tile of tiles) {
        for (let i = 0; i < tile.triangles.length; i++) {
            const triangle = tile.triangles[i];
            const steepness = Math.acos(Math.max(-1, Math.min(1, tile.normals[i][1]))) / (Math.PI / 2) * steepnessModifier;

            if (steepness == 0) {
                triangle[9] = 3;
            }
            else if (steepness < 0.3) {
                triangle[9] = 0;
            }
            else if (steepness < 0.4) {
                triangle[9] = 1;
            }
            else {
                triangle[9] = 2;
            }

            uvMapTriangle(triangle);
        }
    }
}

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.imageSmoothingEnabled = false;
    overlayContext.drawImage(canvas3D, 0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.fillStyle = "rgb(20, 20, 40)";
    overlayContext.font = "32px system-ui";
    overlayContext.fillText(Math.round(1 / dt) + " FPS", 20, canvasOverlay.height - 20);
}

function updateCamera() {
    let camMoveDir = [0, 0, 0];

    camera.setRotation(camera.pitch - mouseDelta[1] * CAMERA_ROT_SPEED, camera.yaw - mouseDelta[0] * CAMERA_ROT_SPEED);
    /*camMoveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    camMoveDir[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    camMoveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    camMoveDir = value3.mul(value3.norm(camera.rotation.vectorToWorldSpace(...camMoveDir)), CAM_MOVE_SPEED * dt);
    camera.setFocus(value3.add(camera.focus, camMoveDir));*/

    const center = [0, 0, 0];
    const nodeCount = physics.nodes.length;

    if (nodeCount > 0) {
        for (const node of physics.nodes) {
            center[0] += node.position[0];
            center[1] += node.position[1];
            center[2] += node.position[2];
        }

        center[0] /= nodeCount;
        center[1] /= nodeCount;
        center[2] /= nodeCount;

        camera.setFocus(center);
    }

    mouseDelta[0] = 0;
    mouseDelta[1] = 0;
}

function updateGame(dt) {
    let timeSpeed = 1 / DAY_LENGTH;

    if (renderer.timeOfDay < 0.2 || renderer.timeOfDay > 0.8) {
        timeSpeed *= nightSpeedMultiplier;
    }

    renderer.timeOfDay = (renderer.timeOfDay + dt * timeSpeed) % 1;
}

function nextFrame() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    lastFrameTime = performance.now();
    updateCamera();

    terrain.unloadTiles(camera.focus);
    textureTerrainTiles(terrain.loadTiles(camera.focus));
    terrainFar1.unloadTiles(camera.focus);
    textureTerrainTiles(terrainFar1.loadTiles(camera.focus), 1.2);
    terrainFar2.unloadTiles(camera.focus);
    textureTerrainTiles(terrainFar2.loadTiles(camera.focus), 1.4);

    const substeps = 512;
    const subDt = dt / substeps;

    for (let i = 0; i < substeps; i++) {
        let moveDir = [0, 0, 0];

        moveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
        moveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
        moveDir = camera.rotation.vectorToWorldSpace(...moveDir);
        moveDir[1] = 0;
        moveDir = value3.norm(moveDir)

        physics.applyForce(sphereCenter, moveDir, 1000);
        physics.stepPhysics(subDt);
    }

    physics.updateTriangles();

    updateGame(dt);
    renderer.render([physics.renderTriangles, terrain.triangles, terrainFar1.triangles, terrainFar2.triangles], camera);
    updateOverlay();
    requestAnimationFrame(nextFrame);
}

window.addEventListener("keydown", downEvent => {
    keyData[downEvent.key] = true;
})

window.addEventListener("keyup", upEvent => {
    keyData[upEvent.key] = false;

    if (upEvent.key == "r") {
        reset();
    }
    else if (upEvent.key == "o") {
        resolutionScale = Math.max(Math.min(resolutionScale * 0.8, 1), 0.01);
        resize();
    }
    else if (upEvent.key == "p") {
        resolutionScale = Math.max(Math.min(resolutionScale * 1.2, 1), 0.01);
        resize();
    }
})

window.addEventListener("mousedown", clickEvent => {
    if (clickEvent.button == 0) {
        mouseLeft = true;
    }
    else if (clickEvent.button == 2) {
        mouseRight = true;
        canvas3D.requestPointerLock();
    }
})

window.addEventListener("mouseup", releaseEvent => {
    if (releaseEvent.button == 0) {
        mouseLeft = false;
    }
    else if (releaseEvent.button == 2) {
        mouseRight = false;
        document.exitPointerLock();
    }
})

window.addEventListener("mousemove", moveEvent => {
    if (document.pointerLockElement == canvas3D) {
        mouseDelta[0] = moveEvent.movementX;
        mouseDelta[1] = moveEvent.movementY;
    }
})

window.addEventListener("wheel", scrollEvent => {
    camera.setZoom(camera.zoom + scrollEvent.deltaY * CAM_ZOOM_SPEED);
})

window.addEventListener("contextmenu", openEvent => {
    openEvent.preventDefault();
});

window.addEventListener("resize", () => {
    resize();
});

renderer.daySky = await new Sky("./assets/day_sky", 20).load();
renderer.nightSky = await new Sky("./assets/night_sky", 0).load();
renderer.materials = [
    await new Material("./assets/materials/rocky_grass", 8).load(),
    await new Material("./assets/materials/rockier_grass", 8).load(),
    await new Material("./assets/materials/rockiest_grass", 8).load(),
    await new Material("./assets/materials/pebbles", 16).load(),
    await new Material("./assets/materials/car", 4).load(),
    //await new Material("./assets/materials/painted_metal", 2).load(),
    //await new Material("./assets/materials/steel", 2).load(),
]
titleScreen.style.display = "none";
resize();
renderer.geographicLatitude = 30;
reset();
nextFrame();