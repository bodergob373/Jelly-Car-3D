import * as value3 from "./value3.js";
import { Material } from "./material.js";
import { Sky } from "./sky.js";
import { Renderer } from "./renderer_v1.js";
import { Camera } from "./camera.js";
import { PerlinNoise2D } from "./perlin_noise_3d.js";

const canvas3D = document.getElementById("canvas3D");
const renderer = new Renderer(canvas3D);
const canvasOverlay = document.getElementById("canvasOverlay");
const overlayContext = canvasOverlay.getContext("2d");
const noise = new PerlinNoise2D(Math.random());

const CAM_MOVE_SPEED = 100;
const CAM_ZOOM_SPEED = 0.1;
const CAMERA_ROT_SPEED = 0.01;

const DAY_LENGTH = 60;

const TERRAIN_LAYERS = [
    { Frequency: 100, Amplitude: 100 }
]

let lastFrameTime = performance.now();
let dt;

const keyData = [];
let mouseLeft = false;
let mouseRight = false;
let mouseDelta = [0, 0];

let terrainTriangles = [
    [-5, -5, -5, 5, -5, -5, -5, -5, 5, 0, 0, 0, 0, 0, 0, 0],
    [5, -5, 5, 5, -5, -5, -5, -5, 5, 0, 0, 0, 0, 0, 0, 0],
    [-5, 5, -5, 5, 5, -5, -5, 5, 5, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, 5, 5, -5, -5, 5, 5, 0, 0, 0, 0, 0, 0, 0],
    [-5, -5, -5, -5, -5, 5, -5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [-5, 5, 5, -5, -5, 5, -5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [5, -5, -5, 5, -5, 5, 5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, 5, -5, 5, 5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [-5, -5, -5, 5, -5, -5, -5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, -5, 5, -5, -5, -5, 5, -5, 0, 0, 0, 0, 0, 0, 0],
    [-5, -5, 5, 5, -5, 5, -5, 5, 5, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, 5, -5, 5, -5, 5, 5, 0, 0, 0, 0, 0, 0, 0]
];

let camera = new Camera([0, 0, 10]);

let resolutionScale = 0.5;

function resize() {
    canvas3D.width = window.innerWidth * resolutionScale;
    canvas3D.height = window.innerHeight * resolutionScale;
    canvasOverlay.width = window.innerWidth;
    canvasOverlay.height = window.innerHeight;
    renderer.resize();
}

function updateTriangleUVs(triangles) {
    for (const triangle of triangles) {
        const cx = (triangle[0] + triangle[3] + triangle[6]) / 3;
        const cy = (triangle[1] + triangle[4] + triangle[7]) / 3;
        const cz = (triangle[2] + triangle[5] + triangle[8]) / 3;
        const ux = triangle[3] - triangle[0];
        const uy = triangle[4] - triangle[1];
        const uz = triangle[5] - triangle[2];
        const vx = triangle[6] - triangle[0];
        const vy = triangle[7] - triangle[1];
        const vz = triangle[8] - triangle[2];
        const normal = value3.cross([ux, uy, uz], [vx, vy, vz]);
        const xAxisDir = value3.norm([ux, uy, uz]);
        const yAxisDir = value3.cross(normal, xAxisDir);
        const rel1 = [triangle[0] - cx, triangle[1] - cy, triangle[2] - cz];
        const rel2 = [triangle[3] - cx, triangle[4] - cy, triangle[5] - cz];
        const rel3 = [triangle[6] - cx, triangle[7] - cy, triangle[8] - cz];
        const x1 = value3.dot(rel1, xAxisDir);
        const y1 = value3.dot(rel1, yAxisDir);
        const x2 = value3.dot(rel2, xAxisDir);
        const y2 = value3.dot(rel2, yAxisDir);
        const x3 = value3.dot(rel3, xAxisDir);
        const y3 = value3.dot(rel3, yAxisDir);

        triangle[10] = x1;
        triangle[11] = y1;
        triangle[12] = x2;
        triangle[13] = y2;
        triangle[14] = x3;
        triangle[15] = y3;
    }
}

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.imageSmoothingEnabled = false;
    overlayContext.drawImage(canvas3D, 0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.fillStyle = "rgb(100, 100, 100)";
    overlayContext.font = "32px system-ui";
    overlayContext.fillText(Math.round(1 / dt) + " FPS", 20, canvasOverlay.height - 20);
}

function updateCamera() {
    let camMoveDir = [0, 0, 0];

    camera.setRotation(camera.pitch - mouseDelta[1] * CAMERA_ROT_SPEED, camera.yaw - mouseDelta[0] * CAMERA_ROT_SPEED);
    camMoveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    camMoveDir[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    camMoveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    camMoveDir = value3.mul(value3.norm(camera.rotation.vectorToWorldSpace(...camMoveDir)), CAM_MOVE_SPEED * dt);
    camera.setFocus(value3.add(camera.focus, camMoveDir));
    mouseDelta[0] = 0;
    mouseDelta[1] = 0;
}

function startFunction() {
    for (let x = -1000; x < 1000; x += 100) {
        for (let z = -1000; z < 1000; z += 100) {
            const x1 = x - 50;
            const z1 = z - 50;
            const x2 = x + 50;
            const z2 = z - 50;
            const x3 = x - 50;
            const z3 = z + 50;
            const x4 = x + 50;
            const z4 = z + 50;
            let y1 = 0;
            let y2 = 0;
            let y3 = 0;
            let y4 = 0;

            for (let layer of TERRAIN_LAYERS) {
                const freq = layer.Frequency;
                const amp = layer.Amplitude;

                y1 += noise.noise(x1 / freq, z1 / freq) * amp;
                y2 += noise.noise(x2 / freq, z2 / freq) * amp;
                y3 += noise.noise(x3 / freq, z3 / freq) * amp;
                y4 += noise.noise(x4 / freq, z4 / freq) * amp;
            }

            const tri1 = [x1, y1, z1, x2, y2, z2, x3, y3, z3, 0, 0, 0, 0, 0, 0, 0];
            const tri2 = [x4, y4, z4, x2, y2, z2, x3, y3, z3, 0, 0, 0, 0, 0, 0, 0];

            terrainTriangles.push(tri1, tri2);
        }
    }
}

function updateGame(dt) {
    renderer.timeOfDay = (renderer.timeOfDay + dt / DAY_LENGTH) % 1;
}

function nextFrame() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    lastFrameTime = performance.now();
    updateCamera();
    updateGame(dt);
    updateTriangleUVs(terrainTriangles);
    renderer.render([terrainTriangles], camera);
    updateOverlay();
    requestAnimationFrame(nextFrame);
}

window.addEventListener("keydown", downEvent => {
    keyData[downEvent.key] = true;
})

window.addEventListener("keyup", upEvent => {
    keyData[upEvent.key] = false;
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
    //await new Material("./assets/materials/rocky_grass", 40).load(),
    //await new Material("./assets/materials/rockier_grass", 80).load(),
    //await new Material("./assets/materials/rockiest_grass", 120).load()
    await new Material("./assets/materials/steel", 20).load()
    //await new Material("./assets/materials/painted_metal", 20).load()
]

startFunction();
resize();
nextFrame();