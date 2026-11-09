import { CFrame } from "./cframe.js";
import { Enum } from "./enums.js";

const canvas3D = document.getElementById("canvas3D");
const canvasOverlay = document.getElementById("canvasOverlay");

const DISPLAY_WIDTH = window.innerWidth;
const DISPLAY_HEIGHT = window.innerHeight;
const MIN_Z = 0.1;
const VIEW_SCALE = 600;

const CAM_MIN_ZOOM = 0;
const CAM_MAX_ZOOM = 100;
const CAM_ZOOM_SPEED = 0.1;
const CAMERA_ROT_SPEED = 0.01;

const canvas3DContext = canvas3D.getContext("2d");
const overlayContext = canvasOverlay.getContext("2d");
const screenImage = canvas3DContext.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
const imageData = screenImage.data;
const keyData = [];

let triangles = [
    [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 250, 250],
    [0, 0, -1, 0, 1, -1, 1, 0, 0, 50, 250, 200],
    [0, 0, -2, 0, 1, -2, 1, 0, 0, 100, 250, 150],
    [0, 0, -3, 0, 1, -3, 1, 0, 0, 150, 250, 100],
    [0, 0, -4, 0, 1, -4, 1, 0, 0, 200, 250, 50],
    [0, 0, -5, 0, 1, -5, 1, 0, 0, 250, 250, 0],
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

function clearDisplay() {
    for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 0;
        imageData[i + 1] = 0;
        imageData[i + 2] = 0;
        imageData[i + 3] = 255;
    }
}

function gameLoop() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    clearDisplay();
    mainFunction();
    render();
    canvas3DContext.putImageData(screenImage, 0, 0);
    updateOverlay();
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function mainFunction() {
    let cameraMovementVector = [0, 0, 0];

    cameraYaw += mouseDelta[0] * CAMERA_ROT_SPEED;
    cameraPitch = Math.max(Math.min(cameraPitch - mouseDelta[1] * CAMERA_ROT_SPEED, Math.PI / 2), -Math.PI / 2);

    const cameraRot = CFrame.fromEulerAngles(cameraPitch, -cameraYaw, 0, Enum.RotationOrder.XYZ);

    cameraMovementVector[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    cameraMovementVector[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    cameraMovementVector[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    cameraMovementVector = cameraRot.pointToWorldSpace(...cameraMovementVector);
    cameraMovementVector = mulVector3(normVector3(cameraMovementVector), 10 * dt);
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

    return [-localPoint[0] / localPoint[2], -localPoint[1] / localPoint[2], localPoint[2]];
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
        console.log(triangle[3][2]);
        setPixel(Math.round(triangle[3][0] * VIEW_SCALE + DISPLAY_WIDTH / 2), Math.round(-triangle[3][1] * VIEW_SCALE + DISPLAY_HEIGHT / 2), triangle[6][0], triangle[6][1], triangle[6][2]);
        setPixel(Math.round(triangle[4][0] * VIEW_SCALE + DISPLAY_WIDTH / 2), Math.round(-triangle[4][1] * VIEW_SCALE + DISPLAY_HEIGHT / 2), triangle[6][0], triangle[6][1], triangle[6][2]);
        setPixel(Math.round(triangle[5][0] * VIEW_SCALE + DISPLAY_WIDTH / 2), Math.round(-triangle[5][1] * VIEW_SCALE + DISPLAY_HEIGHT / 2), triangle[6][0], triangle[6][1], triangle[6][2]);
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