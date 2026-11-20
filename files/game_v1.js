import * as value3 from "./value3.js";
import { Material } from "./material.js";
import { Sky } from "./sky.js";
import { Renderer } from "./renderer_v2.js";
import { Camera } from "./camera.js";
import { ProceduralTerrain } from "./procedural_terrain.js";

const canvas3D = document.getElementById("canvas3D");
const renderer = new Renderer(canvas3D);
const canvasOverlay = document.getElementById("canvasOverlay");
const overlayContext = canvasOverlay.getContext("2d");

const CAM_MOVE_SPEED = 50;
const CAM_ZOOM_SPEED = 0.01;
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

let lastFrameTime = performance.now();
let dt;

const keyData = [];
let mouseLeft = false;
let mouseRight = false;
let mouseDelta = [0, 0];

let camera = new Camera([0, 0, 0]);

let resolutionScale = 0.5;

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
    camMoveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    camMoveDir[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    camMoveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    camMoveDir = value3.mul(value3.norm(camera.rotation.vectorToWorldSpace(...camMoveDir)), CAM_MOVE_SPEED * dt);
    camera.setFocus(value3.add(camera.focus, camMoveDir));
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

    updateGame(dt);
    renderer.render([terrain.triangles, terrainFar1.triangles, terrainFar2.triangles], camera);
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
    await new Material("./assets/materials/rocky_grass", 8).load(),
    await new Material("./assets/materials/rockier_grass", 8).load(),
    await new Material("./assets/materials/rockiest_grass", 8).load(),
    await new Material("./assets/materials/pebbles", 16).load(),
    //await new Material("./assets/materials/painted_metal", 2).load(),
    //await new Material("./assets/materials/steel", 2).load(),
]
resize();
renderer.geographicLatitude = 40;
nextFrame();