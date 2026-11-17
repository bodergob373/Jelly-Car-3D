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

let dayLength = 60;
let geographicLatitude = 20;

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
    [0.1, [255, 220, 140]],
    [1, [200, 240, 255]]
];

let sunlightIntensity = 0;
let sunlightDir = [0, 0, 0];
let sunlightColor = [255, 250, 240];
let ambientIntensity = 0;
let ambientColor = [255, 255, 255];
let timeOfDay = 0.2;
let daytimeAmountModifier = 0;

let daySky = await new Sky("./assets/day_sky", 20).load();
let nightSky = await new Sky("./assets/night_sky", 0).load();

let materials = [
    await new Material("./assets/materials/rocky_grass").load(),
    //await new Texture("./assets/materials/rocky_grass").load(),
    //await new Texture("./assets/materials/diamond_plate").load(),
    //await new Texture("./assets/materials/rock").load(),
    //await new Texture("./assets/materials/pebbles").load()
]

let triangles = [
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

let lastFrameTime = performance.now();
let dt;

let mouseLeft = false;
let mouseRight = false;
let mouseDelta = [0, 0];

let cameraFocus = [0, 0, 10];
let cameraPitch = 0;
let cameraYaw = 0;
let cameraRotation = new CFrame();
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

function updateLighting() {
    const latitudeRad = geographicLatitude * Math.PI / 180;
    const hourAngle = (timeOfDay - 0.5) * Math.PI * 2;
    const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRad));
    const sunElevation = Math.asin(Math.cos(latitudeRad) * Math.cos(hourAngle));
    const ambientIntensityModifier = Math.pow((sunElevation + 1) / 2, AMBIENT_INTENSITY_POW);

    daytimeAmountModifier = Math.max(1 - Math.pow(Math.min((sunElevation - SUN_I_ELEV_START) / (SUN_I_ELEV_END - SUN_I_ELEV_START) - 1, 0), 2), 0);
    sunlightDir = [Math.cos(sunElevation) * Math.sin(azimuth), Math.sin(sunElevation), Math.cos(sunElevation) * Math.cos(azimuth)];
    sunlightIntensity = MAX_SUNLIGHT_INTENSITY * daytimeAmountModifier;
    ambientIntensity = ambientIntensityModifier * (MAX_AMBIENT_INTENSITY - MIN_AMBIENT_INTENSITY) + MIN_AMBIENT_INTENSITY;
    ambientColor = interpolateValue3(AMBIENT_COLOR_CURVE, sunElevation);
}

function updateCamera() {
    let cameraMovementVector = [0, 0, 0];

    cameraYaw += mouseDelta[0] * CAMERA_ROT_SPEED;
    cameraPitch = Math.max(Math.min(cameraPitch - mouseDelta[1] * CAMERA_ROT_SPEED, Math.PI / 2), -Math.PI / 2);
    cameraRotation = CFrame.fromEulerAngles(cameraPitch, -cameraYaw, 0, Enum.RotationOrder.XYZ);
    cameraMovementVector[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
    cameraMovementVector[1] = (keyData[" "] & 1) - (keyData["Shift"] & 1);
    cameraMovementVector[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
    cameraMovementVector = cameraRotation.pointToWorldSpace(...cameraMovementVector);
    cameraMovementVector = mulValue3(normValue3(cameraMovementVector), CAM_MOVE_SPEED * dt);
    cameraFocus = addValue3(cameraFocus, cameraMovementVector);
    cameraCF = new CFrame(...cameraFocus).mult(cameraRotation).mult(new CFrame(0, 0, cameraZoom));
    mouseDelta[0] = 0;
    mouseDelta[1] = 0;
}

function mainUpdate(dt) {
    timeOfDay = (timeOfDay + dt / dayLength) % 1;
    updateLighting();
    updateCamera();
}

function clearDisplay() {
    imageData.fill(0);
    zBuffer.fill(-Infinity);
}

function projectPoint(point, cf) {
    const localPoint = cf.pointToLocalSpace(...point);
    const x = DISPLAY_WIDTH / 2 - localPoint[0] / localPoint[2] * VIEW_SCALE;
    const y = DISPLAY_HEIGHT / 2 + localPoint[1] / localPoint[2] * VIEW_SCALE;
    const z = localPoint[2];

    return [x, y, z];
}

function renderTriangles() {
    const transformedTriangles = [];

    for (const triangle of triangles) {
        const texture = triangle[9];
        const uv = [triangle[10], triangle[11], triangle[12], triangle[13], triangle[14], triangle[15]];
        const p1 = [triangle[0], triangle[1], triangle[2]];
        const p2 = [triangle[3], triangle[4], triangle[5]];
        const p3 = [triangle[6], triangle[7], triangle[8]];
        const projP1 = projectPoint(p1, cameraCF);
        const projP2 = projectPoint(p2, cameraCF);
        const projP3 = projectPoint(p3, cameraCF);

        if (projP1[2] < -MIN_Z && projP2[2] < -MIN_Z && projP3[2] < -MIN_Z) {
            transformedTriangles.push([p1, p2, p3, projP1, projP2, projP3, texture, uv]);
        }
    }

    for (const triangle of transformedTriangles) {
        const minX = Math.min(triangle[3][0], triangle[4][0], triangle[5][0]);
        const maxX = Math.max(triangle[3][0], triangle[4][0], triangle[5][0]);
        const minY = Math.min(triangle[3][1], triangle[4][1], triangle[5][1]);
        const maxY = Math.max(triangle[3][1], triangle[4][1], triangle[5][1]);
        const x0 = Math.max(Math.floor(minX), 0);
        const x1 = Math.min(Math.ceil(maxX), DISPLAY_WIDTH);
        const y0 = Math.max(Math.floor(minY), 0);
        const y1 = Math.min(Math.ceil(maxY), DISPLAY_HEIGHT);
        const u1 = 0;
        const v1 = 0;
        const u2 = 1;
        const v2 = 0;
        const u3 = 0;
        const v3 = 1;
        const texture = materials[0];
        const texDiffMap = texture.diff.data;
        const texNormMap = texture.nor_gl.data;
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
        const invDet = 1 / ((triangle[4][1] - triangle[5][1]) * (triangle[3][0] - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (triangle[3][1] - triangle[5][1]));
        const aX = (triangle[4][1] - triangle[5][1]) * invDet;
        const aY = (triangle[5][0] - triangle[4][0]) * invDet;
        const aC = -aX * triangle[5][0] - aY * triangle[5][1];
        const bX = (triangle[5][1] - triangle[3][1]) * invDet;
        const bY = (triangle[3][0] - triangle[5][0]) * invDet;
        const bC = -bX * triangle[5][0] - bY * triangle[5][1];
        const iz1 = 1 / triangle[3][2];
        const iz2 = 1 / triangle[4][2];
        const iz3 = 1 / triangle[5][2];
        const ambientR = ambientColor[0] * ambientIntensity;
        const ambientG = ambientColor[1] * ambientIntensity;
        const ambientB = ambientColor[2] * ambientIntensity;
        const sunlightR = sunlightColor[0] * sunlightIntensity;
        const sunlightG = sunlightColor[1] * sunlightIntensity;
        const sunlightB = sunlightColor[2] * sunlightIntensity;

        if ((triangle[4][0] - triangle[3][0]) * (triangle[5][1] - triangle[3][1]) - (triangle[4][1] - triangle[3][1]) * (triangle[5][0] - triangle[3][0]) > 0) {
            triangleNormal = mulValue3(triangleNormal, -1);
            tan = mulValue3(tan, -1);
            bitan = mulValue3(bitan, -1);
        }

        for (let y = y0; y < y1; y++) {
            let baryA = aX * x0 + aY * y + aC;
            let baryB = bX * x0 + bY * y + bC;

            for (let x = x0; x < x1; x++) {
                const baryC = 1 - baryA - baryB;

                if (baryA >= 0 && baryB >= 0 && baryC >= 0) {
                    const invZ = baryA * iz1 + baryB * iz2 + baryC * iz3;
                    const pZ = 1 / invZ;
                    const bufferIndex = y * DISPLAY_WIDTH + x;

                    if (pZ > zBuffer[bufferIndex]) {
                        const imageIndex = (y * DISPLAY_WIDTH + x) * 4;
                        const pA = baryA * iz1 / invZ;
                        const pB = baryB * iz2 / invZ;
                        const pC = 1 - pA - pB;
                        const u = pA * u1 + pB * u2 + pC * u3;
                        const v = pA * v1 + pB * v2 + pC * v3;
                        const sampleX = Math.floor((u % 1) * (texture.width - 1));
                        const sampleY = Math.floor((v % 1) * (texture.height - 1));
                        const sampleIndex = (sampleY * texture.width + sampleX) * 4;
                        const texR = texDiffMap[sampleIndex];
                        const texG = texDiffMap[sampleIndex + 1];
                        const texB = texDiffMap[sampleIndex + 2];
                        const texNormX = texNormMap[sampleIndex] * 2 - 1;
                        const texNormY = texNormMap[sampleIndex + 1] * 2 - 1;
                        const texNormZ = texNormMap[sampleIndex + 2] * 2 - 1;
                        const normX = tan[0] * texNormX + bitan[0] * texNormY + triangleNormal[0] * texNormZ;
                        const normY = tan[1] * texNormX + bitan[1] * texNormY + triangleNormal[1] * texNormZ;
                        const normZ = tan[2] * texNormX + bitan[2] * texNormY + triangleNormal[2] * texNormZ;
                        const sunlightLambert = Math.max(normX * sunlightDir[0] + normY * sunlightDir[1] + normZ * sunlightDir[2], 0);
                        const lightR = ambientR + sunlightR * sunlightLambert;
                        const lightG = ambientG + sunlightG * sunlightLambert;
                        const lightB = ambientB + sunlightB * sunlightLambert;

                        zBuffer[bufferIndex] = pZ;
                        imageData[imageIndex] = texR * lightR;
                        imageData[imageIndex + 1] = texG * lightG;
                        imageData[imageIndex + 2] = texB * lightB;
                        imageData[imageIndex + 3] = 255;
                    }
                }

                baryA += aX;
                baryB += bX;
            }
        }
    }
}

function renderSky() {
    const localStep = 1 / VIEW_SCALE;
    const startLocalX = (0.5 - DISPLAY_WIDTH / 2) * localStep;
    let localY = (DISPLAY_HEIGHT / 2 - 0.5) * localStep;
    let primarySky;
    let secondarySky;
    let a1;

    if (daytimeAmountModifier > 0.5) {
        primarySky = daySky;
        secondarySky = nightSky;
        a1 = daytimeAmountModifier;
    }
    else {
        primarySky = nightSky;
        secondarySky = daySky;
        a1 = 1 - daytimeAmountModifier;
    }

    const primaryFaces = [primarySky.left, primarySky.right, primarySky.down, primarySky.up, primarySky.front, primarySky.back];
    const secondaryFaces = [secondarySky.left, secondarySky.right, secondarySky.down, secondarySky.up, secondarySky.front, secondarySky.back];

    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
        let localX = startLocalX;
        let i = y * DISPLAY_WIDTH * 4;

        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            if (imageData[i + 3] == 0) {
                const worldPoint = cameraRotation.pointToWorldSpace(localX, localY, -1);
                const awx = Math.abs(worldPoint[0]);
                const awy = Math.abs(worldPoint[1]);
                const awz = Math.abs(worldPoint[2]);
                const absMax = Math.max(awx, awy, awz);
                let skyboxFace;
                let fwx;
                let fwy;

                if (absMax == awx) {
                    fwy = -worldPoint[1];

                    if (worldPoint[0] < 0) {
                        skyboxFace = 0;
                        fwx = -worldPoint[2];
                    }
                    else {
                        skyboxFace = 1;
                        fwx = worldPoint[2];
                    }
                }
                else if (absMax == awy) {
                    fwx = worldPoint[0];

                    if (worldPoint[1] < 0) {
                        skyboxFace = 2;
                        fwy = worldPoint[2];
                    }
                    else {
                        skyboxFace = 3;
                        fwy = -worldPoint[2];
                    }
                }
                else {
                    fwy = -worldPoint[1];

                    if (worldPoint[2] < 0) {
                        skyboxFace = 4;
                        fwx = worldPoint[0];
                    }
                    else {
                        skyboxFace = 5;
                        fwx = -worldPoint[0];
                    }
                }

                const faceX = fwx / absMax / 2 + 0.5;
                const faceY = fwy / absMax / 2 + 0.5;
                const primaryTexture = primaryFaces[skyboxFace];
                const primaryU = Math.floor(faceX * primaryTexture.width);
                const primaryV = Math.floor(faceY * primaryTexture.height);
                const primaryIndex = (primaryV * primaryTexture.width + primaryU) * 4;

                let r = primaryTexture.data[primaryIndex] * 255;
                let g = primaryTexture.data[primaryIndex + 1] * 255;
                let b = primaryTexture.data[primaryIndex + 2] * 255;

                if (a1 < 1) {
                    const secondaryTexture = secondaryFaces[skyboxFace];
                    const secondaryU = Math.floor(faceX * secondaryTexture.width);
                    const secondaryV = Math.floor(faceY * secondaryTexture.height);
                    const secondaryIndex = (secondaryV * secondaryTexture.width + secondaryU) * 4;
                    const a2 = 1 - a1;

                    r = r * a1 + secondaryTexture.data[secondaryIndex] * 255 * a2;
                    g = g * a1 + secondaryTexture.data[secondaryIndex + 1] * 255 * a2;
                    b = b * a1 + secondaryTexture.data[secondaryIndex + 2] * 255 * a2;
                }

                imageData[i] = r;
                imageData[i + 1] = g;
                imageData[i + 2] = b;
                imageData[i + 3] = 255;
            }

            localX += localStep;
            i += 4;
        }

        localY -= localStep;
    }

    const relSunDir = cameraRotation.pointToLocalSpace(...sunlightDir);

    if (relSunDir[2] < 0) {
        const sunTexture = daySky.sun;
        const screenX = DISPLAY_WIDTH / 2 - relSunDir[0] / relSunDir[2] * VIEW_SCALE;
        const screenY = DISPLAY_HEIGHT / 2 + relSunDir[1] / relSunDir[2] * VIEW_SCALE;
        const sunTextureAvgSize = (sunTexture.width + sunTexture.height) / 2;
        const sunPixelDiameter = 2 * VIEW_SCALE * Math.tan(daySky.sunAngularSize * Math.PI / 360);
        const sunBoundWidth = sunTexture.width * sunPixelDiameter / sunTextureAvgSize;
        const sunBoundHeight = sunTexture.height * sunPixelDiameter / sunTextureAvgSize;
        const minX = Math.floor(screenX - sunBoundWidth / 2);
        const minY = Math.floor(screenY - sunBoundHeight / 2);
        const maxX = Math.ceil(screenX + sunBoundWidth / 2);
        const maxY = Math.ceil(screenY + sunBoundHeight / 2);

        for (let y = Math.max(Math.floor(minY), 0); y < Math.min(Math.ceil(maxY), DISPLAY_HEIGHT); y++) {
            for (let x = Math.max(Math.floor(minX), 0); x < Math.min(Math.ceil(maxX), DISPLAY_WIDTH); x++) {
                if (zBuffer[y * DISPLAY_WIDTH + x] == -Infinity) {
                    const u = (x + 0.5 - (screenX - sunBoundWidth / 2)) / sunBoundWidth;

                    const v = (y + 0.5 - (screenY - sunBoundHeight / 2)) / sunBoundHeight;

                    const tx = Math.floor(u * sunTexture.width);
                    const ty = Math.floor(v * sunTexture.height);

                    if (tx < 0 || tx >= sunTexture.width || ty < 0 || ty >= sunTexture.height) {
                        continue;
                    }

                    const pixelIndex = (y * DISPLAY_WIDTH + x) * 4;
                    const textureIndex = (ty * sunTexture.width + tx) * 4;
                    const sunR = sunTexture.data[textureIndex] * 255;
                    const sunG = sunTexture.data[textureIndex + 1] * 255;
                    const sunB = sunTexture.data[textureIndex + 2] * 255;
                    const sunA = sunTexture.data[textureIndex + 3] * daytimeAmountModifier;
                    const skyA = 1 - sunA;

                    imageData[pixelIndex] = sunR * sunA + imageData[pixelIndex] * skyA;
                    imageData[pixelIndex + 1] = sunG * sunA + imageData[pixelIndex + 1] * skyA;
                    imageData[pixelIndex + 2] = sunB * sunA + imageData[pixelIndex + 2] * skyA;
                    imageData[pixelIndex + 3] = 255;
                }
            }
        }
    }
}


function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    overlayContext.fillStyle = "rgb(100, 100, 100)";
    overlayContext.font = "20px monospace";
    overlayContext.fillText("FPS: " + Math.round(1 / dt), 10, DISPLAY_HEIGHT - 10);
    overlayContext.fillText("Camera Position: " + cameraCF.position, 10, 20);
    overlayContext.fillText("Time of Day: " + (Math.round(timeOfDay * 24 * 100) / 100 - 12), 10, 40);
}

function nextFrame() {
    dt = Math.max((performance.now() - lastFrameTime) / 1000, 0.001);
    lastFrameTime = performance.now();
    mainUpdate(dt);
    clearDisplay();
    renderTriangles();
    renderSky();
    canvas3DContext.putImageData(screenImage, 0, 0);
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