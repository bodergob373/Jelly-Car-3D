import * as value3 from "./value3.js";
import * as triangleFunctions from "./triangle_functions.js";
import * as softbodyGenerator from "./softbody_generator.js";
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

let lastFrameTime = performance.now();
let dt;

const STEPS_PER_SECOND = 2048;

const CAM_ZOOM_SPEED = 0.02;
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

const keyData = [];
let mouseDelta = [0, 0];

let physics = null;
let sphereCenter = null;
let camera = new Camera([0, 0, 10], 20, 0, 1000);
let resolutionScale = 0.5;

const SPHERE_FORCE = 100;

function reset() {
    const mass = 0.1;
    const friction = 100;
    const stiffness = 8;
    const centerStiffness = 2;
    const damping = 0.2;

    physics = new SoftbodyPhysics(9.81, terrain);
    sphereCenter = softbodyGenerator.createIcosphere(physics, [0, 5, 0], 5, 1, mass, friction, stiffness, centerStiffness, damping);
}

function resize() {
    canvas3D.width = window.innerWidth * resolutionScale;
    canvas3D.height = window.innerHeight * resolutionScale;
    canvasOverlay.width = window.innerWidth;
    canvasOverlay.height = window.innerHeight;
    renderer.resize();
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

            triangleFunctions.uvMapTriangle(triangle);
        }
    }
}

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.imageSmoothingEnabled = false;
    overlayContext.drawImage(canvas3D, 0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.fillStyle = "rgb(0, 0, 200)";
    overlayContext.font = "32px system-ui";
    overlayContext.fillText(Math.round(1 / dt) + " FPS", 20, canvasOverlay.height - 20);
    overlayContext.font = "28px system-ui";

    if (keyData["c"]) {
        overlayContext.fillText("Controls:", canvasOverlay.width - 300, 40);
        overlayContext.font = "20px system-ui";
        overlayContext.fillText("Movement: WASD", canvasOverlay.width - 300, 80);
        overlayContext.fillText("Camera Zoom: Mouse Wheel", canvasOverlay.width - 300, 110);
        overlayContext.fillText("Decrease Resolution: O", canvasOverlay.width - 300, 140);
        overlayContext.fillText("Increase Resolution: P", canvasOverlay.width - 300, 170);
        overlayContext.fillText("Reload Ball: R", canvasOverlay.width - 300, 200);

    }
    else {
        overlayContext.fillText("See Controls (C)", canvasOverlay.width - 300, 40);
    }
}

function updateCamera() {
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

    camera.setRotation(camera.pitch - mouseDelta[1] * CAMERA_ROT_SPEED, camera.yaw - mouseDelta[0] * CAMERA_ROT_SPEED);
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

    const substeps = Math.round(dt * STEPS_PER_SECOND);
    const subDt = dt / substeps;

    for (let i = 0; i < substeps; i++) {
        let moveDir = [0, 0, 0];

        moveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
        moveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
        moveDir = camera.rotation.vectorToWorldSpace(...moveDir);
        moveDir[1] = 0;
        moveDir = value3.norm(moveDir)

        physics.applyForce(sphereCenter, moveDir, SPHERE_FORCE);
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
    }
    else if (clickEvent.button == 2) {
        canvas3D.requestPointerLock();
    }
})

window.addEventListener("mouseup", releaseEvent => {
    if (releaseEvent.button == 0) {
    }
    else if (releaseEvent.button == 2) {
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
    await new Material("./assets/materials/car", 2).load(),
    //await new Material("./assets/materials/painted_metal", 4).load(),
]
titleScreen.style.display = "none";
resize();
renderer.geographicLatitude = 20;
reset();
nextFrame();