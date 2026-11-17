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
    await new Material("./assets/materials/rocky_grass", 8).load(),
    //await new Texture("./assets/materials/rocky_grass", 8).load(),
    //await new Texture("./assets/materials/diamond_plate", 4).load(),
    //await new Texture("./assets/materials/rock", 8).load(),
    //await new Texture("./assets/materials/pebbles", 4).load()
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

function dotValue3(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function crossValue3(u, v) {
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];

    return normValue3([nx, ny, nz]);
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

function updateTriangleUVs() {
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
        const normal = crossValue3([ux, uy, uz], [vx, vy, vz]);
        const xAxisDir = normValue3([ux, uy, uz]);
        const yAxisDir = crossValue3(normal, xAxisDir);
        const rel1 = [triangle[0] - cx, triangle[1] - cy, triangle[2] - cz];
        const rel2 = [triangle[3] - cx, triangle[4] - cy, triangle[5] - cz];
        const rel3 = [triangle[6] - cx, triangle[7] - cy, triangle[8] - cz];
        const x1 = dotValue3(rel1, xAxisDir);
        const y1 = dotValue3(rel1, yAxisDir);
        const x2 = dotValue3(rel2, xAxisDir);
        const y2 = dotValue3(rel2, yAxisDir);
        const x3 = dotValue3(rel3, xAxisDir);
        const y3 = dotValue3(rel3, yAxisDir);

        triangle[10] = x1;
        triangle[11] = y1;
        triangle[12] = x2;
        triangle[13] = y2;
        triangle[14] = x3;
        triangle[15] = y3;
    }
}

function clipTriangleNear(p1, p2, p3, planeZ) {
    const inputs = [p1, p2, p3];
    const output = [];

    for (let i = 0; i < inputs.length; i++) {
        const current = inputs[i];
        const previous = inputs[(i + inputs.length - 1) % inputs.length];
        const currIn = current[0][2] < planeZ;
        const prevIn = previous[0][2] < planeZ;

        if (currIn && prevIn) {
            output.push(current);

        }
        else if (prevIn && !currIn) {
            output.push(intersectNearPlane(previous, current, planeZ));

        }
        else if (!prevIn && currIn) {
            output.push(intersectNearPlane(previous, current, planeZ));
            output.push(current);
        }
    }

    return output;
}

function intersectNearPlane(a, b, planeZ) {
    const t = (planeZ - a[0][2]) / (b[0][2] - a[0][2]);
    const intersectLocal = [a[0][0] + (b[0][0] - a[0][0]) * t, a[0][1] + (b[0][1] - a[0][1]) * t, planeZ];
    const intersectWorld = [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
    const intersectUV = [a[2][0] + (b[2][0] - a[2][0]) * t, a[2][1] + (b[2][1] - a[2][1]) * t];

    return [intersectLocal, intersectWorld, intersectUV];
}

function toLocalSpace(point, cf) {
    const cfv = cf.values;
    const tx = point[0] - cfv[0];
    const ty = point[1] - cfv[1];
    const tz = point[2] - cfv[2];
    const localX = cfv[3] * tx + cfv[6] * ty + cfv[9] * tz;
    const localY = cfv[4] * tx + cfv[7] * ty + cfv[10] * tz;
    const localZ = cfv[5] * tx + cfv[8] * ty + cfv[11] * tz;

    return [localX, localY, localZ];
}

function projectPoint(lp) {
    const px = DISPLAY_WIDTH / 2 - lp[0] / lp[2] * VIEW_SCALE;
    const py = DISPLAY_HEIGHT / 2 + lp[1] / lp[2] * VIEW_SCALE;
    const pz = lp[2];

    return [px, py, pz];
}

function renderTriangles() {
    const transformedTriangles = [];

    for (const triangle of triangles) {
        const planeZ = -MIN_Z;
        const texture = triangle[9];
        const uv1 = [triangle[10], triangle[11]];
        const uv2 = [triangle[12], triangle[13]];
        const uv3 = [triangle[14], triangle[15]];
        const wp1 = [triangle[0], triangle[1], triangle[2]];
        const wp2 = [triangle[3], triangle[4], triangle[5]];
        const wp3 = [triangle[6], triangle[7], triangle[8]];
        const lp1 = toLocalSpace(wp1, cameraCF);
        const lp2 = toLocalSpace(wp2, cameraCF);
        const lp3 = toLocalSpace(wp3, cameraCF);

        if (lp1[2] > planeZ && lp2[2] > planeZ && lp3[2] > planeZ) {
            continue;
        }

        if (lp1[2] <= planeZ && lp2[2] <= planeZ && lp3[2] <= planeZ) {
            const proj1 = projectPoint(lp1);
            const proj2 = projectPoint(lp2);
            const proj3 = projectPoint(lp3);

            transformedTriangles.push([wp1, wp2, wp3, proj1, proj2, proj3, uv1, uv2, uv3, texture]);
        }
        else {
            const clipped = clipTriangleNear([lp1, wp1, uv1], [lp2, wp2, uv2], [lp3, wp3, uv3], planeZ);

            for (let i = 1; i < clipped.length - 1; i++) {
                const c1 = clipped[0];
                const c2 = clipped[i];
                const c3 = clipped[i + 1];
                const proj1 = projectPoint(c1[0]);
                const proj2 = projectPoint(c2[0]);
                const proj3 = projectPoint(c3[0]);

                transformedTriangles.push([c1[1], c2[1], c3[1], proj1, proj2, proj3, c1[2], c2[2], c3[2], texture]);
            }
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
        const material = materials[triangle[9]];
        const texDiffMap = material.diff.data;
        const texNormMap = material.nor_gl.data;
        const edge1X = triangle[1][0] - triangle[0][0];
        const edge1Y = triangle[1][1] - triangle[0][1];
        const edge1Z = triangle[1][2] - triangle[0][2];
        const edge2X = triangle[2][0] - triangle[0][0];
        const edge2Y = triangle[2][1] - triangle[0][1];
        const edge2Z = triangle[2][2] - triangle[0][2];
        const u1 = triangle[6][0] / material.scale;
        const v1 = triangle[6][1] / material.scale;
        const u2 = triangle[7][0] / material.scale;
        const v2 = triangle[7][1] / material.scale;
        const u3 = triangle[8][0] / material.scale;
        const v3 = triangle[8][1] / material.scale;
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
                        const sampleX = Math.floor((u - Math.floor(u)) * material.width);
                        const sampleY = Math.floor((v - Math.floor(v)) * material.height);
                        const sampleIndex = (sampleY * material.width + sampleX) * 4;
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
    const rm = cameraRotation.values;
    const localStep = 1 / VIEW_SCALE;
    const startLocalX = (0.5 - DISPLAY_WIDTH / 2) * localStep;
    const startLocalY = (DISPLAY_HEIGHT / 2 - 0.5) * localStep;
    const dirStepX = rm[3] * localStep;
    const dirStepY = rm[6] * localStep;
    const dirStepZ = rm[9] * localStep;
    const dirRowStepX = -rm[4] * localStep;
    const dirRowStepY = -rm[7] * localStep;
    const dirRowStepZ = -rm[10] * localStep;
    const dirStartX = rm[3] * startLocalX + rm[4] * startLocalY - rm[5];
    const dirStartY = rm[6] * startLocalX + rm[7] * startLocalY - rm[8];
    const dirStartZ = rm[9] * startLocalX + rm[10] * startLocalY - rm[11];
    let primarySky;
    let secondarySky;
    let a1;
    let worldX = dirStartX;
    let worldY = dirStartY;
    let worldZ = dirStartZ;

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
        let wx = worldX;
        let wy = worldY;
        let wz = worldZ;
        let i = y * DISPLAY_WIDTH * 4;

        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            if (imageData[i + 3] == 0) {
                const awx = Math.abs(wx);
                const awy = Math.abs(wy);
                const awz = Math.abs(wz);
                const absMax = Math.max(awx, awy, awz);
                let skyboxFace;
                let fwx;
                let fwy;

                if (absMax == awx) {
                    fwy = -wy;

                    if (wx < 0) {
                        skyboxFace = 0;
                        fwx = -wz;
                    }
                    else {
                        skyboxFace = 1;
                        fwx = wz;
                    }
                }
                else if (absMax == awy) {
                    fwx = wx;

                    if (wy < 0) {
                        skyboxFace = 2;
                        fwy = wz;
                    }
                    else {
                        skyboxFace = 3;
                        fwy = -wz;
                    }
                }
                else {
                    fwy = -wy;

                    if (wz < 0) {
                        skyboxFace = 4;
                        fwx = wx;
                    }
                    else {
                        skyboxFace = 5;
                        fwx = -wx;
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

            wx += dirStepX;
            wy += dirStepY;
            wz += dirStepZ;

            i += 4;
        }

        worldX += dirRowStepX;
        worldY += dirRowStepY;
        worldZ += dirRowStepZ;
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
    overlayContext.fillStyle = "rgb(0, 0, 0)";
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
    updateTriangleUVs();
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