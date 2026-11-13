import { CFrame } from "./cframe.js";
import { Enum } from "./enums.js";
import { Texture } from "./texture.js";

const canvas3D = document.getElementById("canvas3D");
const canvasOverlay = document.getElementById("canvasOverlay");

const DISPLAY_WIDTH = window.innerWidth;
const DISPLAY_HEIGHT = window.innerHeight;

const MIN_Z = 0.1;
const VIEW_SCALE = 600;

const CAM_MIN_ZOOM = 0;
const CAM_MAX_ZOOM = 100;
const CAM_MOVE_SPEED = 20;
const CAM_ZOOM_SPEED = 0.1;
const CAMERA_ROT_SPEED = 0.01;

const canvas3DContext = canvas3D.getContext("2d");
const overlayContext = canvasOverlay.getContext("2d");
const screenImage = canvas3DContext.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);

const imageData = screenImage.data;
const zBuffer = new Float32Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
const keyData = [];

let ambientIntensity = 0.6;
let ambientColor = [255, 255, 255];

let sunlightIntensity = 0.8;
let sunlightDir = [1, -1, 1];
let sunlightColor = [255, 240, 220];

let textures = {
    rocky_grass: await new Texture("./textures/rocky_grass").load()
}

let triangles = [
    [-5, -5, -100, -5, 5, -100, 5, -5, -100, 0, 250, 250],
    [-5, -5, -110, -5, 5, -110, 5, -5, -105, 50, 250, 200],
    [-5, -5, -120, -5, 5, -120, 5, -5, -110, 100, 250, 150],
    [-5, -5, -130, -5, 5, -130, 5, -5, -115, 150, 250, 100],
    [-5, -5, -140, -5, 5, -140, 5, -5, -120, 200, 250, 50],
    [-5, -5, -150, -5, 5, -150, 5, -5, -125, 250, 250, 0],
    [-5, -5, -160, -5, 5, -160, 5, -5, -130, 250, 200, 50],
    [-5, -5, -170, -5, 5, -170, 5, -5, -135, 250, 150, 100],
    [-5, -5, -180, -5, 5, -180, 5, -5, -140, 250, 100, 150],
    [-5, -5, -190, -5, 5, -190, 5, -5, -145, 250, 50, 200],
    [-5, -5, -200, -5, 5, -200, 5, -5, -150, 250, 0, 250],

    [-5, -5, -5, 5, -5, -5, -5, -5, 5, 140, 180, 80],
    [5, -5, 5, 5, -5, -5, -5, -5, 5, 140, 180, 80],
    [-5, 5, -5, 5, 5, -5, -5, 5, 5, 140, 180, 80],
    [5, 5, 5, 5, 5, -5, -5, 5, 5, 140, 180, 80],
    [-5, -5, -5, -5, -5, 5, -5, 5, -5, 140, 180, 80],
    [-5, 5, 5, -5, -5, 5, -5, 5, -5, 140, 180, 80],
    [5, -5, -5, 5, -5, 5, 5, 5, -5, 140, 180, 80],
    [5, 5, 5, 5, -5, 5, 5, 5, -5, 140, 180, 80],
    [-5, -5, -5, 5, -5, -5, -5, 5, -5, 140, 180, 80],
    [5, 5, -5, 5, -5, -5, -5, 5, -5, 140, 180, 80],
    [-5, -5, 5, 5, -5, 5, -5, 5, 5, 140, 180, 80],
    [5, 5, 5, 5, -5, 5, -5, 5, 5, 140, 180, 80],
];

let lastFrameTime = performance.now();
let dt;

let mouseLeft = false;
let mouseRight = false;
let mouseDelta = [0, 0];

let cameraFocus = [0, 0, 10];
let cameraPitch = 0;
let cameraYaw = 0;
let cameraCF = new CFrame();
let cameraZoom = 0;

function normVector3(vector) {
    let magnitude = Math.hypot(vector[0], vector[1], vector[2]) || 1;

    return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function mulVector3(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addVector3(vector1, vector2) {
    return [vector1[0] + vector2[0], vector1[1] + vector2[1], vector1[2] + vector2[2]];
}

function subVector3(vector1, vector2) {
    return [vector1[0] - vector2[0], vector1[1] - vector2[1], vector1[2] - vector2[2]];
}

function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) {
        return;
    }

    const i = (y * DISPLAY_WIDTH + x) * 4;

    imageData[i] = r;
    imageData[i + 1] = g;
    imageData[i + 2] = b;
    imageData[i + 3] = 255;
}

function sampleTextureTest(u, v) {
    const gridSize = 10;

    u = u % 1;
    v = v % 1;

    const x = Math.floor(u * (gridSize));
    const y = Math.floor(v * (gridSize));

    const value = ((Math.round(x) + Math.round(y)) % 2) * 200;

    return [value + 55, value + 55, value + 55];
}

function sampleTexture(texture, u, v) {
    const x = Math.floor((u % 1) * (texture.width - 1));
    const y = Math.floor((v % 1) * (texture.height - 1));
    const index = (y * texture.width + x) * 4;

    return [texture.data[index], texture.data[index + 1], texture.data[index + 2]];
}

function clearDisplay() {
    for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 180;
        imageData[i + 1] = 220;
        imageData[i + 2] = 240;
        imageData[i + 3] = 255;
    }

    zBuffer.fill(-Infinity);
}

function gameLoop() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    lastFrameTime = performance.now();
    sunlightDir = [Math.cos(performance.now() * 0.001), -1, Math.sin(performance.now() * 0.001)];
    sunlightDir = normVector3(sunlightDir);
    clearDisplay();
    updateCamera();
    render();
    canvas3DContext.putImageData(screenImage, 0, 0);
    updateOverlay();
    requestAnimationFrame(gameLoop);
}

function updateCamera() {
    let cameraMovementVector = [0, 0, 0];

    cameraYaw += mouseDelta[0] * CAMERA_ROT_SPEED;
    cameraPitch = Math.max(Math.min(cameraPitch - mouseDelta[1] * CAMERA_ROT_SPEED, Math.PI / 2), -Math.PI / 2);

    const cameraRot = CFrame.fromEulerAngles(cameraPitch, -cameraYaw, 0, Enum.RotationOrder.XYZ);

    cameraMovementVector[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    cameraMovementVector[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    cameraMovementVector[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    cameraMovementVector = cameraRot.pointToWorldSpace(...cameraMovementVector);
    cameraMovementVector = mulVector3(normVector3(cameraMovementVector), CAM_MOVE_SPEED * dt);
    cameraFocus = addVector3(cameraFocus, cameraMovementVector);
    cameraCF = new CFrame(...cameraFocus).mult(cameraRot).mult(new CFrame(0, 0, cameraZoom));
    mouseDelta[0] = 0;
    mouseDelta[1] = 0;
}

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    overlayContext.fillStyle = "rgb(100, 100, 100)";
    overlayContext.font = "20px monospace";
    overlayContext.fillText("FPS: " + Math.round(1 / dt), 10, DISPLAY_HEIGHT - 10);
    overlayContext.fillText("Camera Position: " + cameraCF.position, 10, 20);
    overlayContext.fillText("Camera Zoom: " + cameraZoom, 10, 40);
}

function projectPoint(point, cf) {
    const localPoint = cf.pointToLocalSpace(...point);
    const x = DISPLAY_WIDTH / 2 - localPoint[0] / localPoint[2] * VIEW_SCALE;
    const y = DISPLAY_HEIGHT / 2 + localPoint[1] / localPoint[2] * VIEW_SCALE;
    const z = localPoint[2];

    return [x, y, z];
}

function render() {
    const transformedTriangles = [];

    for (const triangle of triangles) {
        const texture = [triangle[9], triangle[10], triangle[11]];
        const p1 = [triangle[0], triangle[1], triangle[2]];
        const p2 = [triangle[3], triangle[4], triangle[5]];
        const p3 = [triangle[6], triangle[7], triangle[8]];
        const projP1 = projectPoint(p1, cameraCF);
        const projP2 = projectPoint(p2, cameraCF);
        const projP3 = projectPoint(p3, cameraCF);

        if (projP1[2] < -MIN_Z && projP2[2] < -MIN_Z && projP3[2] < -MIN_Z) {
            transformedTriangles.push([p1, p2, p3, projP1, projP2, projP3, texture]);
        }
    }

    for (const triangle of transformedTriangles) {
        const minX = Math.min(triangle[3][0], triangle[4][0], triangle[5][0]);
        const maxX = Math.max(triangle[3][0], triangle[4][0], triangle[5][0]);
        const minY = Math.min(triangle[3][1], triangle[4][1], triangle[5][1]);
        const maxY = Math.max(triangle[3][1], triangle[4][1], triangle[5][1]);
        const wu = [triangle[1][0] - triangle[0][0], triangle[1][1] - triangle[0][1], triangle[1][2] - triangle[0][2]];
        const wv = [triangle[2][0] - triangle[0][0], triangle[2][1] - triangle[0][1], triangle[2][2] - triangle[0][2]];

        for (let i = Math.max(Math.floor(minX), 0); i < Math.min(Math.ceil(maxX), DISPLAY_WIDTH); i++) {
            for (let j = Math.max(Math.floor(minY), 0); j < Math.min(Math.ceil(maxY), DISPLAY_HEIGHT); j++) {
                const det = (triangle[4][1] - triangle[5][1]) * (triangle[3][0] - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (triangle[3][1] - triangle[5][1]);
                const a = ((triangle[4][1] - triangle[5][1]) * (i - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (j - triangle[5][1])) / det;
                const b = ((triangle[5][1] - triangle[3][1]) * (i - triangle[5][0]) + (triangle[3][0] - triangle[5][0]) * (j - triangle[5][1])) / det;
                const c = 1 - a - b;

                if (a >= 0 && b >= 0 && c >= 0) {
                    const invZ = a / triangle[3][2] + b / triangle[4][2] + c / triangle[5][2];
                    const pA = a / triangle[3][2] / invZ;
                    const pB = b / triangle[4][2] / invZ;
                    const pC = c / triangle[5][2] / invZ;
                    const pZ = 1 / invZ;
                    const index = j * DISPLAY_WIDTH + i;

                    if (pZ > zBuffer[index]) {
                        zBuffer[index] = pZ;


                        const u1 = 0;
                        const v1 = 0;
                        const u2 = 1;
                        const v2 = 0;
                        const u3 = 0;
                        const v3 = 1;
                        const u = pA * u1 + pB * u2 + pC * u3;
                        const v = pA * v1 + pB * v2 + pC * v3;
                        const textureColor = sampleTextureTest(u, v);

                        let normal = normVector3([wu[1] * wv[2] - wu[2] * wv[1], wu[2] * wv[0] - wu[0] * wv[2], wu[0] * wv[1] - wu[1] * wv[0]]);
                        let pixelColor = [0, 0, 0];

                        if ((triangle[4][0] - triangle[3][0]) * (triangle[5][1] - triangle[3][1]) - (triangle[4][1] - triangle[3][1]) * (triangle[5][0] - triangle[3][0]) < 0) {
                            normal = mulVector3(normal, -1);
                        }

                        const sunlightLambert = Math.max(normal[0] * sunlightDir[0] + normal[1] * sunlightDir[1] + normal[2] * sunlightDir[2], 0);

                        for (let v = 0; v < 3; v++) {
                            pixelColor[v] += ambientColor[v] * ambientIntensity * (textureColor[v] + 10) / 255;
                            pixelColor[v] += sunlightColor[v] * sunlightIntensity * sunlightLambert * (textureColor[v] + 10) / 255;
                        }


                        setPixel(i, j, pixelColor[0], pixelColor[1], pixelColor[2]);
                    }
                }
            }
        }
    }
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
    cameraZoom = Math.max(Math.min(cameraZoom + scrollEvent.deltaY * CAM_ZOOM_SPEED, CAM_MAX_ZOOM), CAM_MIN_ZOOM);
})

window.addEventListener("contextmenu", openEvent => {
    openEvent.preventDefault();
});

canvas3D.width = DISPLAY_WIDTH;
canvas3D.height = DISPLAY_HEIGHT;
canvasOverlay.width = DISPLAY_WIDTH;
canvasOverlay.height = DISPLAY_HEIGHT;
gameLoop();