import * as value3 from "./value3.js";

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");

        this.MIN_Z = 0.1;

        this.DAY_FADE_START = -0.2;
        this.DAY_FADE_END = 0.2;
        this.MAX_SUNLIGHT_INTENSITY = 1.2;
        this.AMBIENT_INTENSITY_POW = 2;
        this.MIN_AMBIENT_INTENSITY = 0.3;
        this.MAX_AMBIENT_INTENSITY = 0.6;
        this.AMBIENT_COLOR_CURVE = [
            [-1, [200, 220, 255]],
            [-0.2, [180, 200, 255]],
            [-0.1, [255, 180, 120]],
            [0.1, [255, 220, 140]],
            [1, [200, 240, 255]]
        ];

        this.sunlightIntensity = 0;
        this.sunlightDir = [0, 0, 0];
        this.sunlightColor = [255, 250, 240];
        this.ambientIntensity = 0;
        this.ambientColor = [255, 255, 255];
        this.daytimeAmountModifier = 0;
        this.geographicLatitude = 20;
        this.timeOfDay = 0.4;

        this.daySky = null;
        this.nightSky = null;
        this.materials = [];

        this.resize();
    }

    resize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.image = this.context.createImageData(this.width, this.height);
        this.imageData = this.image.data;
        this.zBuffer = new Float32Array(this.width * this.height);
    }

    updateLighting() {
        const latitudeRad = this.geographicLatitude * Math.PI / 180;
        const hourAngle = (this.timeOfDay - 0.5) * Math.PI * 2;
        const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRad));
        const sunElevation = Math.asin(Math.cos(latitudeRad) * Math.cos(hourAngle));
        const ambientIntensityModifier = Math.pow((sunElevation + 1) / 2, this.AMBIENT_INTENSITY_POW);

        this.daytimeAmountModifier = Math.max(1 - Math.pow(Math.min((sunElevation - this.DAY_FADE_START) / (this.DAY_FADE_END - this.DAY_FADE_START) - 1, 0), 2), 0);
        this.sunlightDir = [Math.cos(sunElevation) * Math.sin(azimuth), Math.sin(sunElevation), Math.cos(sunElevation) * Math.cos(azimuth)];
        this.sunlightIntensity = this.MAX_SUNLIGHT_INTENSITY * this.daytimeAmountModifier;
        this.ambientIntensity = ambientIntensityModifier * (this.MAX_AMBIENT_INTENSITY - this.MIN_AMBIENT_INTENSITY) + this.MIN_AMBIENT_INTENSITY;
        this.ambientColor = value3.interpolate(this.AMBIENT_COLOR_CURVE, sunElevation);
    }

    clearDisplay() {
        this.imageData.fill(0);
        this.zBuffer.fill(-Infinity);
    }

    clipTriangleNear(p1, p2, p3, planeZ) {
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
                output.push(this.intersectNearPlane(previous, current, planeZ));

            }
            else if (!prevIn && currIn) {
                output.push(this.intersectNearPlane(previous, current, planeZ));
                output.push(current);
            }
        }

        return output;
    }

    intersectNearPlane(a, b, planeZ) {
        const t = (planeZ - a[0][2]) / (b[0][2] - a[0][2]);
        const intersectLocal = [a[0][0] + (b[0][0] - a[0][0]) * t, a[0][1] + (b[0][1] - a[0][1]) * t, planeZ];
        const intersectWorld = [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
        const intersectUV = [a[2][0] + (b[2][0] - a[2][0]) * t, a[2][1] + (b[2][1] - a[2][1]) * t];

        return [intersectLocal, intersectWorld, intersectUV];
    }

    toLocalSpace(point, cf) {
        const cfv = cf.values;
        const tx = point[0] - cfv[0];
        const ty = point[1] - cfv[1];
        const tz = point[2] - cfv[2];
        const localX = cfv[3] * tx + cfv[6] * ty + cfv[9] * tz;
        const localY = cfv[4] * tx + cfv[7] * ty + cfv[10] * tz;
        const localZ = cfv[5] * tx + cfv[8] * ty + cfv[11] * tz;

        return [localX, localY, localZ];
    }

    projectPoint(lp, viewScale) {
        const px = this.width / 2 - lp[0] / lp[2] * viewScale;
        const py = this.height / 2 + lp[1] / lp[2] * viewScale;
        const pz = lp[2];

        return [px, py, pz];
    }

    renderTriangles(triangles, cameraCFrame, viewScale) {
        const transformedTriangles = [];

        for (const triangle of triangles) {
            const planeZ = -this.MIN_Z;
            const texture = triangle[9];
            const uv1 = [triangle[10], triangle[11]];
            const uv2 = [triangle[12], triangle[13]];
            const uv3 = [triangle[14], triangle[15]];
            const wp1 = [triangle[0], triangle[1], triangle[2]];
            const wp2 = [triangle[3], triangle[4], triangle[5]];
            const wp3 = [triangle[6], triangle[7], triangle[8]];
            const lp1 = this.toLocalSpace(wp1, cameraCFrame);
            const lp2 = this.toLocalSpace(wp2, cameraCFrame);
            const lp3 = this.toLocalSpace(wp3, cameraCFrame);

            if (lp1[2] > planeZ && lp2[2] > planeZ && lp3[2] > planeZ) {
                continue;
            }

            if (lp1[2] <= planeZ && lp2[2] <= planeZ && lp3[2] <= planeZ) {
                const proj1 = this.projectPoint(lp1, viewScale);
                const proj2 = this.projectPoint(lp2, viewScale);
                const proj3 = this.projectPoint(lp3, viewScale);

                transformedTriangles.push([wp1, wp2, wp3, proj1, proj2, proj3, uv1, uv2, uv3, texture]);
            }
            else {
                const clipped = this.clipTriangleNear([lp1, wp1, uv1], [lp2, wp2, uv2], [lp3, wp3, uv3], planeZ);

                for (let i = 1; i < clipped.length - 1; i++) {
                    const c1 = clipped[0];
                    const c2 = clipped[i];
                    const c3 = clipped[i + 1];
                    const proj1 = this.projectPoint(c1[0], viewScale);
                    const proj2 = this.projectPoint(c2[0], viewScale);
                    const proj3 = this.projectPoint(c3[0], viewScale);

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
            const x1 = Math.min(Math.ceil(maxX), this.width);
            const y0 = Math.max(Math.floor(minY), 0);
            const y1 = Math.min(Math.ceil(maxY), this.height);
            const material = this.materials[triangle[9]];
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
            let tan = value3.norm([f * (dv2 * edge1X - dv1 * edge2X), f * (dv2 * edge1Y - dv1 * edge2Y), f * (dv2 * edge1Z - dv1 * edge2Z)]);
            let bitan = value3.norm([f * (-du2 * edge1X + du1 * edge2X), f * (-du2 * edge1Y + du1 * edge2Y), f * (-du2 * edge1Z + du1 * edge2Z)]);
            const wu = [triangle[1][0] - triangle[0][0], triangle[1][1] - triangle[0][1], triangle[1][2] - triangle[0][2]];
            const wv = [triangle[2][0] - triangle[0][0], triangle[2][1] - triangle[0][1], triangle[2][2] - triangle[0][2]];
            let triangleNormal = value3.norm([wu[1] * wv[2] - wu[2] * wv[1], wu[2] * wv[0] - wu[0] * wv[2], wu[0] * wv[1] - wu[1] * wv[0]]);
            const invDet = 1 / ((triangle[4][1] - triangle[5][1]) * (triangle[3][0] - triangle[5][0]) + (triangle[5][0] - triangle[4][0]) * (triangle[3][1] - triangle[5][1]));
            const ax = (triangle[4][1] - triangle[5][1]) * invDet;
            const ay = (triangle[5][0] - triangle[4][0]) * invDet;
            const ac = -ax * triangle[5][0] - ay * triangle[5][1];
            const bx = (triangle[5][1] - triangle[3][1]) * invDet;
            const by = (triangle[3][0] - triangle[5][0]) * invDet;
            const bc = -bx * triangle[5][0] - by * triangle[5][1];
            const iza = 1 / triangle[3][2];
            const izb = 1 / triangle[4][2];
            const izc = 1 / triangle[5][2];
            const ambientR = this.ambientColor[0] * this.ambientIntensity;
            const ambientG = this.ambientColor[1] * this.ambientIntensity;
            const ambientB = this.ambientColor[2] * this.ambientIntensity;
            const sunlightR = this.sunlightColor[0] * this.sunlightIntensity;
            const sunlightG = this.sunlightColor[1] * this.sunlightIntensity;
            const sunlightB = this.sunlightColor[2] * this.sunlightIntensity;

            if ((triangle[4][0] - triangle[3][0]) * (triangle[5][1] - triangle[3][1]) - (triangle[4][1] - triangle[3][1]) * (triangle[5][0] - triangle[3][0]) > 0) {
                triangleNormal = value3.mul(triangleNormal, -1);
                tan = value3.mul(tan, -1);
                bitan = value3.mul(bitan, -1);
            }

            for (let y = y0; y < y1; y++) {
                let baryA = ax * x0 + ay * y + ac;
                let baryB = bx * x0 + by * y + bc;

                for (let x = x0; x < x1; x++) {
                    const baryC = 1 - baryA - baryB;

                    if (baryA >= 0 && baryB >= 0 && baryC >= 0) {
                        const invZ = baryA * iza + baryB * izb + baryC * izc;
                        const pZ = 1 / invZ;
                        const bufferIndex = y * this.width + x;

                        if (pZ > this.zBuffer[bufferIndex]) {
                            const imageIndex = (y * this.width + x) * 4;
                            const pA = baryA * iza / invZ;
                            const pB = baryB * izb / invZ;
                            const pC = 1 - pA - pB;
                            const u = pA * u1 + pB * u2 + pC * u3;
                            const v = pA * v1 + pB * v2 + pC * v3;
                            const sampleX = Math.floor((u - Math.floor(u)) * material.width);
                            const sampleY = Math.floor((v - Math.floor(v)) * material.height);
                            const sampleIndex = (sampleY * material.width + sampleX) * 4;
                            const texR = texDiffMap[sampleIndex] + 0.05;
                            const texG = texDiffMap[sampleIndex + 1] + 0.05;
                            const texB = texDiffMap[sampleIndex + 2] + 0.05;
                            const texNormX = texNormMap[sampleIndex] * 2 - 1;
                            const texNormY = texNormMap[sampleIndex + 1] * 2 - 1;
                            const texNormZ = texNormMap[sampleIndex + 2] * 2 - 1;
                            const normX = tan[0] * texNormX + bitan[0] * texNormY + triangleNormal[0] * texNormZ;
                            const normY = tan[1] * texNormX + bitan[1] * texNormY + triangleNormal[1] * texNormZ;
                            const normZ = tan[2] * texNormX + bitan[2] * texNormY + triangleNormal[2] * texNormZ;
                            const sunlightLambert = Math.max(normX * this.sunlightDir[0] + normY * this.sunlightDir[1] + normZ * this.sunlightDir[2], 0);
                            const lightR = ambientR + sunlightR * sunlightLambert;
                            const lightG = ambientG + sunlightG * sunlightLambert;
                            const lightB = ambientB + sunlightB * sunlightLambert;

                            this.zBuffer[bufferIndex] = pZ;
                            this.imageData[imageIndex] = texR * lightR;
                            this.imageData[imageIndex + 1] = texG * lightG;
                            this.imageData[imageIndex + 2] = texB * lightB;
                            this.imageData[imageIndex + 3] = 255;
                        }
                    }

                    baryA += ax;
                    baryB += bx;
                }
            }
        }
    }

    renderSky(cameraRotation, viewScale) {
        const rm = cameraRotation.values;
        const localStep = 1 / viewScale;
        const startLocalX = (0.5 - this.width / 2) * localStep;
        const startLocalY = (this.height / 2 - 0.5) * localStep;
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

        if (this.daytimeAmountModifier > 0.5) {
            primarySky = this.daySky;
            secondarySky = this.nightSky;
            a1 = this.daytimeAmountModifier;
        }
        else {
            primarySky = this.nightSky;
            secondarySky = this.daySky;
            a1 = 1 - this.daytimeAmountModifier;
        }

        const primaryFaces = [primarySky.left, primarySky.right, primarySky.down, primarySky.up, primarySky.front, primarySky.back];
        const secondaryFaces = [secondarySky.left, secondarySky.right, secondarySky.down, secondarySky.up, secondarySky.front, secondarySky.back];

        for (let y = 0; y < this.height; y++) {
            let wx = worldX;
            let wy = worldY;
            let wz = worldZ;
            let i = y * this.width * 4;

            for (let x = 0; x < this.width; x++) {
                if (this.imageData[i + 3] == 0) {
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

                    this.imageData[i] = r;
                    this.imageData[i + 1] = g;
                    this.imageData[i + 2] = b;
                    this.imageData[i + 3] = 255;
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

        const relSunDir = cameraRotation.pointToLocalSpace(...this.sunlightDir);

        if (relSunDir[2] < 0) {
            const sunTexture = this.daySky.sun;
            const screenX = this.width / 2 - relSunDir[0] / relSunDir[2] * viewScale;
            const screenY = this.height / 2 + relSunDir[1] / relSunDir[2] * viewScale;
            const sunTextureAvgSize = (sunTexture.width + sunTexture.height) / 2;
            const sunPixelDiameter = 2 * viewScale * Math.tan(this.daySky.sunAngularSize * Math.PI / 360);
            const sunBoundWidth = sunTexture.width * sunPixelDiameter / sunTextureAvgSize;
            const sunBoundHeight = sunTexture.height * sunPixelDiameter / sunTextureAvgSize;
            const minX = Math.floor(screenX - sunBoundWidth / 2);
            const minY = Math.floor(screenY - sunBoundHeight / 2);
            const maxX = Math.ceil(screenX + sunBoundWidth / 2);
            const maxY = Math.ceil(screenY + sunBoundHeight / 2);

            for (let y = Math.max(Math.floor(minY), 0); y < Math.min(Math.ceil(maxY), this.height); y++) {
                for (let x = Math.max(Math.floor(minX), 0); x < Math.min(Math.ceil(maxX), this.width); x++) {
                    if (this.zBuffer[y * this.width + x] == -Infinity) {
                        const u = (x + 0.5 - (screenX - sunBoundWidth / 2)) / sunBoundWidth;

                        const v = (y + 0.5 - (screenY - sunBoundHeight / 2)) / sunBoundHeight;

                        const tx = Math.floor(u * sunTexture.width);
                        const ty = Math.floor(v * sunTexture.height);

                        if (tx < 0 || tx >= sunTexture.width || ty < 0 || ty >= sunTexture.height) {
                            continue;
                        }

                        const pixelIndex = (y * this.width + x) * 4;
                        const textureIndex = (ty * sunTexture.width + tx) * 4;
                        const sunR = sunTexture.data[textureIndex] * 255;
                        const sunG = sunTexture.data[textureIndex + 1] * 255;
                        const sunB = sunTexture.data[textureIndex + 2] * 255;
                        const sunA = sunTexture.data[textureIndex + 3] * this.daytimeAmountModifier;
                        const skyA = 1 - sunA;

                        this.imageData[pixelIndex] = sunR * sunA + this.imageData[pixelIndex] * skyA;
                        this.imageData[pixelIndex + 1] = sunG * sunA + this.imageData[pixelIndex + 1] * skyA;
                        this.imageData[pixelIndex + 2] = sunB * sunA + this.imageData[pixelIndex + 2] * skyA;
                        this.imageData[pixelIndex + 3] = 255;
                    }
                }
            }
        }
    }

    render(triangleSets, camera) {
        const viewScale = this.height / (2 * Math.tan(camera.fov * Math.PI / 360));

        this.clearDisplay();
        this.updateLighting();

        for (let triangles of triangleSets) {
            this.renderTriangles(triangles, camera.cframe, viewScale);
        }

        this.renderSky(camera.rotation, viewScale);
        this.context.putImageData(this.image, 0, 0);
    }
}