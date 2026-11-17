import { CFrame } from "./cframe.js";
import { Enum } from "./enums.js";
import { Material } from "./material.js";
import { Sky } from "./sky.js";

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

const SUN_I_ELEV_START = -0.2;
const SUN_I_ELEV_END = 0.2;
const MAX_SUNLIGHT_INTENSITY = 1.2;
const AMBIENT_INTENSITY_POW = 2;
const MIN_AMBIENT_INTENSITY = 0.3;
const MAX_AMBIENT_INTENSITY = 0.6;
const AMBIENT_COLOR_CURVE = [
    [-1, [200, 220, 255]],
    [-0.2, [180, 200, 255]],
    [-0.1, [255, 180, 120]],
    [0.2, [255, 220, 140]],
    [1, [200, 240, 255]]
];

let sunlightIntensity = 0;
let sunlightDir = [0, 0, 0];
let sunlightColor = [255, 250, 240];
let ambientIntensity = 0;
let ambientColor = [255, 255, 255];

let dayLength = 30;
let geographicLatitude = 40;
let timeOfDay = 0.4;

let sky = new Sky("./assets/sky", 1);

let materials = {
    //"rocky_grass": await new Texture("./assets/materials/rocky_grass").load(),
    //"diamond_plate": await new Texture("./assets/materials/diamond_plate").load(),
    //"rock": await new Texture("./assets/materials/rock").load(),
    //"pebbles": await new Texture("./assets/materials/pebbles").load()
    "default_texture": await new Material("./assets/materials/pebbles").load(),
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
    [5, 5, 5, 5, -5, 5, -5, 5, 5, 140, 180, 80]
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

function normValue3(vector) {
    let magnitude = Math.hypot(vector[0], vector[1], vector[2]) || 1;

    return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function mulValue3(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addValue3(vector1, vector2) {
    return [vector1[0] + vector2[0], vector1[1] + vector2[1], vector1[2] + vector2[2]];
}

function subValue3(vector1, vector2) {
    return [vector1[0] - vector2[0], vector1[1] - vector2[1], vector1[2] - vector2[2]];
}

function interpolateValue3(points, t) {
    if (t <= points[0][0]) {
        return points[0][1];
    }

    if (t >= points[points.length - 1][0]) {
        return points[points.length - 1][1];
    }

    let i = 0;

    while (points[i + 1][0] < t) i++;

    const [p0, c0] = points[i];
    const [p1, c1] = points[i + 1];
    const u = (1 - Math.cos((t - p0) / (p1 - p0) * Math.PI)) / 2;

    return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u];
}

function sampleTexture(textureName, u, v) {
    const texture = materials[textureName];
    const diff = texture.diff.data;
    const x = Math.floor((u % 1) * (texture.width - 1));
    const y = Math.floor((v % 1) * (texture.height - 1));
    const index = (y * texture.width + x) * 4;

    return [diff[index], diff[index + 1], diff[index + 2]];
}

function nextFrame() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    lastFrameTime = performance.now();
    mainUpdate(dt);
    clearDisplay();
    render();
    canvas3DContext.putImageData(screenImage, 0, 0);
    updateOverlay();
    requestAnimationFrame(nextFrame);
}

function updateLighting() {
    const latitudeRad = geographicLatitude * Math.PI / 180;
    const hourAngle = (timeOfDay - 0.5) * Math.PI * 2;
    const elevation = Math.asin(Math.cos(latitudeRad) * Math.cos(hourAngle));
    const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRad));
    const sunlightIntensityModifier = Math.max(1 - Math.pow(Math.min((elevation - SUN_I_ELEV_START) / (SUN_I_ELEV_END - SUN_I_ELEV_START) - 1, 0), 2), 0);
    const ambientIntensityModifier = Math.pow((elevation + 1) / 2, AMBIENT_INTENSITY_POW);

    sunlightDir = [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)];
    sunlightIntensity = MAX_SUNLIGHT_INTENSITY * sunlightIntensityModifier;
    ambientIntensity = ambientIntensityModifier * (MAX_AMBIENT_INTENSITY - MIN_AMBIENT_INTENSITY) + MIN_AMBIENT_INTENSITY;
    ambientColor = interpolateValue3(AMBIENT_COLOR_CURVE, elevation);
}

function mainUpdate(dt) {
    timeOfDay = (timeOfDay + dt / dayLength) % 1;
    updateLighting();
    updateCamera();
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
    cameraMovementVector = mulValue3(normValue3(cameraMovementVector), CAM_MOVE_SPEED * dt);
    cameraFocus = addValue3(cameraFocus, cameraMovementVector);
    cameraCF = new CFrame(...cameraFocus).mult(cameraRot).mult(new CFrame(0, 0, cameraZoom));
    mouseDelta[0] = 0;
    mouseDelta[1] = 0;
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

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    overlayContext.fillStyle = "rgb(100, 100, 100)";
    overlayContext.font = "20px monospace";
    overlayContext.fillText("FPS: " + Math.round(1 / dt), 10, DISPLAY_HEIGHT - 10);
    overlayContext.fillText("Camera Position: " + cameraCF.position, 10, 20);
    overlayContext.fillText("Time of Day: " + (Math.round(timeOfDay * 24 * 100) / 100 - 12), 10, 40);
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
        const u1 = 0;
        const v1 = 0;
        const u2 = 1;
        const v2 = 0;
        const u3 = 0;
        const v3 = 1;
        const texture = materials["default_texture"];
        const texDiff = texture.diff.data;
        const texNorm = texture.nor_gl.data;
        const edge1X = triangle[1][0] - triangle[0][0];
        const edge1Y = triangle[1][1] - triangle[0][1];
        const edge1Z = triangle[1][2] - triangle[0][2];
        const edge2X = triangle[2][0] - triangle[0][0];
        const edge2Y = triangle[2][1] - triangle[0][1];
        const edge2Z = triangle[2][2] - triangle[0][2];
        const du1 = u2 - u1;
        const dv1 = v2 - v1;
        const du2 = u3 - u1;
        const dv2 = v3 - v1;
        const f = 1 / (du1 * dv2 - du2 * dv1);
        let tan = normValue3([f * (dv2 * edge1X - dv1 * edge2X), f * (dv2 * edge1Y - dv1 * edge2Y), f * (dv2 * edge1Z - dv1 * edge2Z)]);
        let bitan = normValue3([f * (-du2 * edge1X + du1 * edge2X), f * (-du2 * edge1Y + du1 * edge2Y), f * (-du2 * edge1Z + du1 * edge2Z)]);
        const wu = [triangle[1][0] - triangle[0][0], triangle[1][1] - triangle[0][1], triangle[1][2] - triangle[0][2]];
        const wv = [triangle[2][0] - triangle[0][0], triangle[2][1] - triangle[0][1], triangle[2][2] - triangle[0][2]];
        let triangleNormal = normValue3([wu[1] * wv[2] - wu[2] * wv[1], wu[2] * wv[0] - wu[0] * wv[2], wu[0] * wv[1] - wu[1] * wv[0]]);


        if ((triangle[4][0] - triangle[3][0]) * (triangle[5][1] - triangle[3][1]) - (triangle[4][1] - triangle[3][1]) * (triangle[5][0] - triangle[3][0]) > 0) {
            triangleNormal = mulValue3(triangleNormal, -1);
            tan = mulValue3(tan, -1);
            bitan = mulValue3(bitan, -1);
        }

        for (let i = Math.max(Math.floor(minX), 0); i < Math.min(Math.ceil(maxX), DISPLAY_WIDTH); i++) {
            for (let j = Math.max(Math.floor(minY), 0); j < Math.min(Math.ceil(maxY), DISPLAY_HEIGHT); j++) {
                const det = (triangle[4][1] - triangle[5][1]) * (triangle[3][0] - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (triangle[3][1] - triangle[5][1]);
                const baryA = ((triangle[4][1] - triangle[5][1]) * (i - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (j - triangle[5][1])) / det;
                const baryB = ((triangle[5][1] - triangle[3][1]) * (i - triangle[5][0]) + (triangle[3][0] - triangle[5][0]) * (j - triangle[5][1])) / det;
                const baryC = 1 - baryA - baryB;

                if (baryA >= 0 && baryB >= 0 && baryC >= 0) {
                    const invZ = baryA / triangle[3][2] + baryB / triangle[4][2] + baryC / triangle[5][2];
                    const pZ = 1 / invZ;
                    const bufferIndex = j * DISPLAY_WIDTH + i;

                    if (pZ > zBuffer[bufferIndex]) {
                        const imageIndex = (j * DISPLAY_WIDTH + i) * 4;
                        const pA = baryA / triangle[3][2] / invZ;
                        const pB = baryB / triangle[4][2] / invZ;
                        const pC = baryC / triangle[5][2] / invZ;
                        const u = pA * u1 + pB * u2 + pC * u3;
                        const v = pA * v1 + pB * v2 + pC * v3;
                        const sampleX = Math.floor((u % 1) * (texture.width - 1));
                        const sampleY = Math.floor((v % 1) * (texture.height - 1));
                        const sampleIndex = (sampleY * texture.width + sampleX) * 4;
                        const normX = texNorm[sampleIndex] * 2 - 1;
                        const normY = texNorm[sampleIndex + 1] * 2 - 1;
                        const normZ = texNorm[sampleIndex + 2] * 2 - 1;
                        const pixelNormal = normValue3([tan[0] * normX + bitan[0] * normY + triangleNormal[0] * normZ, tan[1] * normX + bitan[1] * normY + triangleNormal[1] * normZ, tan[2] * normX + bitan[2] * normY + triangleNormal[2] * normZ]);
                        const sunlightLambert = Math.max(pixelNormal[0] * sunlightDir[0] + pixelNormal[1] * sunlightDir[1] + pixelNormal[2] * sunlightDir[2], 0);
                        const pixelColor = [0, 0, 0];

                        for (let v = 0; v < 3; v++) {
                            pixelColor[v] += ambientColor[v] * ambientIntensity * texDiff[sampleIndex + v];
                            pixelColor[v] += sunlightColor[v] * sunlightIntensity * sunlightLambert * texDiff[sampleIndex + v];
                        }

                        zBuffer[bufferIndex] = pZ;
                        imageData[imageIndex] = pixelColor[0];
                        imageData[imageIndex + 1] = pixelColor[1];
                        imageData[imageIndex + 2] = pixelColor[2];
                        imageData[imageIndex + 3] = 255;
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
nextFrame();