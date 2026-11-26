import * as value3 from "./value3.js";
import * as triangleFunctions from "./triangle_functions.js";
import * as softbodyGenerator from "./softbody_generator.js";
import { Material } from "./material.js";
import { Sky } from "./sky.js";
import { Renderer } from "./renderer_v3.js";
import { Camera } from "./camera.js";
import { ProceduralTerrain } from "./procedural_terrain.js";
import { SoftbodyPhysics } from "./softbody_physics.js";
import { NodeProperties } from "./node_properties.js";
import { SpringProperties } from "./spring_properties.js";
import { WheelAxle } from "./wheel_axle.js";

const canvas3D = document.getElementById("canvas3D");
const titleScreen = document.getElementById("titleScreen");
const renderer = new Renderer(canvas3D);
const canvasOverlay = document.getElementById("canvasOverlay");
const overlayContext = canvasOverlay.getContext("2d");

let lastFrameTime = performance.now();
let dt;

const STEPS_PER_SECOND = 2048;

const CAM_ZOOM_SPEED = 0.01;
const CAMERA_ROT_SPEED = 0.01;

const DAY_LENGTH = 240;
const nightSpeedMultiplier = 16.0;

const TERRAIN_LAYERS = [
    { Frequency: 0.002, Amplitude: 64 },
    { Frequency: 0.004, Amplitude: 32 },
    { Frequency: 0.008, Amplitude: 16 },
    { Frequency: 0.02, Amplitude: 8 },
    { Frequency: 0.04, Amplitude: 4 },
    { Frequency: 0.08, Amplitude: 2 },
    { Frequency: 0.16, Amplitude: 1 },
]

const TERRAIN_SEED = Date.now();
const terrain = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 2, 10, 40, 40);
const terrainFar1 = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 4, 9, 80, 80, 40, 40);
const terrainFar2 = new ProceduralTerrain(TERRAIN_SEED, TERRAIN_LAYERS, 16, 7, 640, 640, 80, 80);

const keyData = [];
let mouseDelta = [0, 0];

let physics = null;
let sphereCenter = null;
let carData = null;
let camera = new Camera([0, 0, 10], 10, 0, 1000);
let resolutionScale = 0.4;
let controlType = "Car";
let carModelIndex = 0;
let xRayEnabled = false;

const carModels = [
    {
        bodyShape: [
            [-1.8, 0],
            [1.8, 0],
            [2, 0.2],
            [1.8, 0.6],
            [0.8, 0.8],
            [0.2, 1.2],
            [-1.4, 1.2],
            [-2.1, 0.8],
            [-2, 0.2]
        ]
    },
    {
        bodyShape: [
            [-1.6, 0],
            [1.8, 0],
            [2, 0.2],
            [1.8, 0.6],
            [0.8, 0.8],
            [0.2, 1.2],
            [-1.4, 1.2],
            [-2, 0.8],
            [-1.8, 0.2],
        ]
    },
    {
        bodyShape: [
            [-1.8, 0.3],
            [-1.9, 0.2],
            [-1.9, 0.1],
            [0.6, 0],
            [1.8, 0],
            [1.8, 0.1],
            [1.7, 0.2],
            [1.7, 0.4],
            [1.5, 0.6],
            [1.1, 0.7],
            [0.6, 0.7],
            [0.3, 1.1],
            [0.1, 1.2],
            [-1, 1.2],
            [-1.2, 1.1],
            [-1.5, 0.8]
        ]
    },
    {
        bodyShape: [
            [-2.3, 0.4],
            [-2.4, 0.3],
            [-2.3, 0.1],
            [-1, 0],
            [1.1, 0],
            [2.1, 0.1],
            [2.2, 0.3],
            [2.1, 0.4],
            [2.1, 0.7],
            [2, 0.8],
            [0.8, 0.9],
            [0.5, 1.3],
            [0.1, 1.4],
            [-2, 1.4],
            [-2.3, 0.9]
        ]
    },
    {
        bodyShape: [
            [-2.1, 0.3],
            [-2.2, 0.2],
            [-2.1, 0.1],
            [-1.6, 0],
            [1.9, 0],
            [1.9, 0.1],
            [2, 0.2],
            [2, 0.3],
            [1.9, 0.5],
            [0.8, 0.7],
            [0.1, 1.1],
            [-0.8, 1.1],
            [-1.8, 0.7],
            [-2, 0.7],
            [-2.1, 0.5]
        ]
    },
    {
        bodyShape: [
            [-1.6, 0],
            [1.5, 0],
            [1.5, 0.4],
            [1.4, 0.7],
            [1.1, 1.6],
            [0, 1.6],
            [0, 0.9],
            [-1.6, 0.9]
        ]
    },
    {
        bodyShape: [
            [-1.4, 0.4],
            [-1.4, 0.1],
            [-1.3, 0],
            [1.3, 0],
            [1.4, 0.3],
            [1.4, 0.5],
            [0.7, 0.6],
            [0.4, 1],
            [-1, 1],
            [-1.3, 0.6]
        ]
    },
    {
        bodyShape: [
            [-0.8, 0.3],
            [-0.7, 0.1],
            [0.4, 0],
            [0.8, 0.1],
            [0.7, 0.6],
            [0.5, 0.6],
            [0, 1.2],
            [-0.7, 1.2],
            [-0.7, 0.9]
        ]
    },
    {
        bodyShape: [
            [-2.8, 0.4],
            [-2.9, 0.3],
            [-2.9, 0.2],
            [-1, 0],
            [1.7, 0],
            [2.6, 0.1],
            [2.6, 0.3],
            [2.5, 0.4],
            [2.5, 0.7],
            [0.8, 0.8],
            [0.3, 1.1],
            [-1.1, 1.1],
            [-1.6, 0.8],
            [-2.7, 0.8]
        ]
    },
    {
        bodyShape: [
            [-2.6, 0.4],
            [-2.8, 0.3],
            [-2.7, 0.1],
            [-2, 0.1],
            [-1.6, 0.2],
            [-1.5, 0.2],
            [-1.1, 0],
            [1.9, 0],
            [2.2, 0.1],
            [2.3, 0.3],
            [2.1, 0.4],
            [2.2, 0.7],
            [0.9, 0.8],
            [0.4, 1.1],
            [-0.9, 1.1],
            [-1.2, 1],
            [-1.6, 0.7],
            [-1.9, 0.7],
            [-2.6, 0.8],
            [-2.8, 0.8]
        ]
    },
    {
        bodyShape: [
            [-3.9, 0],
            [-0.8, 0],
            [-0.8, -0.3],
            [0.5, -0.3],
            [0.9, 0],
            [3.1, 0],
            [3.9, 0],
            [4.6, 0.6],
            [4.6, 0.9],
            [4.2, 1.7],
            [0.8, 1.7],
            [0.8, 0.4],
            [-3.9, 0.4]
        ]
    },
]

const SPHERE_FORCE = 5;
let maxVehicleSpeed = 40;
let vehicleSteerSpeed = 40;
let vehicleAcceleration = 0.2;

function reset() {
    physics = new SoftbodyPhysics(9.81, terrain);

    if (controlType == "Ball") {
        const mass = 0.01;
        const friction = 200;
        const stiffness = 8;
        const centerStiffness = 1;
        const damping = 0.04;

        sphereCenter = softbodyGenerator.createIcosphere(physics, [0, 2, 0], 2, 1, mass, friction, stiffness, centerStiffness, damping);
    }
    else if (controlType == "Car") {
        if (carModelIndex == 0) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(1600, 32);
            const rearSuspensionProperties = new SpringProperties(1600, 32);
            const tireSpringProperties = new SpringProperties(800, 8);
            const baseSpringProperties = new SpringProperties(800, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 400);

            const frontAxle = new WheelAxle(0.4, 0.2, 1.6, -1.2, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.4, 0.2, 1.6, 1.2, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 40;
            vehicleSteerSpeed = 40;
            vehicleAcceleration = 0.4;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.6, 0, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[5][9] = 6; // side window
            physics.renderTriangles[6][9] = 6;

            physics.renderTriangles[length + 5][9] = 6; // side window
            physics.renderTriangles[length + 6][9] = 6;

            physics.renderTriangles[length * 2 + 10][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 11][9] = 6;

            physics.renderTriangles[length * 2 + 14][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 15][9] = 6;

            physics.renderTriangles[length * 2 + 2][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 3][9] = 8;

            physics.renderTriangles[length * 2 + 4][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 5][9] = 7;

            physics.renderTriangles[length * 2][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 7;
        }
        else if (carModelIndex == 1) {
            const axleSpringProperties = new SpringProperties(200, 1);
            const chassisSpringProperties = new SpringProperties(0, 0);
            const frontSuspensionProperties = new SpringProperties(6400, 8);
            const rearSuspensionProperties = new SpringProperties(6400, 8);
            const tireSpringProperties = new SpringProperties(3200, 4);
            const baseSpringProperties = new SpringProperties(1600, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(0.8, 400);
            const tireNodeProperties = new NodeProperties(0.4, 400);

            const frontAxle = new WheelAxle(0.4, 0.4, 1.8, -1.2, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.4, 0.4, 1.8, 1.2, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 80;
            vehicleSteerSpeed = 60;
            vehicleAcceleration = 0.1;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.6, 0.2, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[5][9] = 7; // side window
            physics.renderTriangles[6][9] = 7;

            physics.renderTriangles[length + 5][9] = 7; // side window
            physics.renderTriangles[length + 6][9] = 7;

            physics.renderTriangles[length * 2 + 10][9] = 7; // windshield
            physics.renderTriangles[length * 2 + 11][9] = 7;

            physics.renderTriangles[length * 2 + 14][9] = 7; // rear window
            physics.renderTriangles[length * 2 + 15][9] = 7;

            physics.renderTriangles[length * 2 + 2][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 3][9] = 8;

            physics.renderTriangles[length * 2 + 4][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 5][9] = 7;

            physics.renderTriangles[length * 2][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 7;
        }
        else if (carModelIndex == 2) {
            const axleSpringProperties = new SpringProperties(400, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(1200, 32);
            const rearSuspensionProperties = new SpringProperties(800, 32);
            const tireSpringProperties = new SpringProperties(800, 4);
            const baseSpringProperties = new SpringProperties(800, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 800);

            const frontAxle = new WheelAxle(0.35, 0.15, 1.4, -1.2, 8, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.35, 0.15, 1.2, 1.2, 8, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 40;
            vehicleSteerSpeed = 40;
            vehicleAcceleration = 0.4;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.4, 0.15, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[10][9] = 6; // side window
            physics.renderTriangles[11][9] = 6;
            physics.renderTriangles[12][9] = 6;
            physics.renderTriangles[13][9] = 6;
            physics.renderTriangles[14][9] = 6;

            physics.renderTriangles[length + 10][9] = 6; // side window
            physics.renderTriangles[length + 11][9] = 6;
            physics.renderTriangles[length + 12][9] = 6;
            physics.renderTriangles[length + 13][9] = 6;
            physics.renderTriangles[length + 14][9] = 6;

            physics.renderTriangles[length * 2 + 6][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 7][9] = 8;

            physics.renderTriangles[length * 2 + 8][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 9][9] = 7;
            physics.renderTriangles[length * 2 + 10][9] = 7;
            physics.renderTriangles[length * 2 + 11][9] = 7;

            physics.renderTriangles[length * 2 + 20][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 21][9] = 6;

            physics.renderTriangles[length * 2 + 28][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 29][9] = 6;

            physics.renderTriangles[length * 2 + 0][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 7;
            physics.renderTriangles[length * 2 + 2][9] = 7;
            physics.renderTriangles[length * 2 + 3][9] = 7;
        }
        else if (carModelIndex == 3) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(800, 32);
            const rearSuspensionProperties = new SpringProperties(800, 32);
            const tireSpringProperties = new SpringProperties(800, 4);
            const baseSpringProperties = new SpringProperties(800, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 800);

            const frontAxle = new WheelAxle(0.5, 0.3, 1.8, -1.4, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.5, 0.3, 1.8, 1.4, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 20;
            vehicleSteerSpeed = 20;
            vehicleAcceleration = 0.8;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.8, 0.2, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[10][9] = 6; // side window
            physics.renderTriangles[11][9] = 6;
            physics.renderTriangles[12][9] = 6;
            physics.renderTriangles[13][9] = 6;

            physics.renderTriangles[length + 10][9] = 6; // side window
            physics.renderTriangles[length + 11][9] = 6;
            physics.renderTriangles[length + 12][9] = 6;
            physics.renderTriangles[length + 13][9] = 6;

            physics.renderTriangles[length * 2 + 4][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 5][9] = 8;
            physics.renderTriangles[length * 2 + 6][9] = 8;
            physics.renderTriangles[length * 2 + 7][9] = 8;
            physics.renderTriangles[length * 2 + 8][9] = 8;
            physics.renderTriangles[length * 2 + 9][9] = 8;

            physics.renderTriangles[length * 2 + 10][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 11][9] = 7;
            physics.renderTriangles[length * 2 + 12][9] = 7;
            physics.renderTriangles[length * 2 + 13][9] = 7;

            physics.renderTriangles[length * 2 + 14][9] = 8; // grill
            physics.renderTriangles[length * 2 + 15][9] = 8;

            physics.renderTriangles[length * 2 + 20][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 21][9] = 6;

            physics.renderTriangles[length * 2 + 26][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 27][9] = 6;

            physics.renderTriangles[length * 2][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 7;
            physics.renderTriangles[length * 2 + 2][9] = 7;
            physics.renderTriangles[length * 2 + 3][9] = 7;
        }
        else if (carModelIndex == 4) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(3200, 32);
            const rearSuspensionProperties = new SpringProperties(3200, 32);
            const tireSpringProperties = new SpringProperties(3200, 4);
            const baseSpringProperties = new SpringProperties(800, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 100);

            const frontAxle = new WheelAxle(0.35, 0.25, 1.4, -1.2, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.35, 0.25, 1.4, 1.2, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 80;
            vehicleSteerSpeed = 80;
            vehicleAcceleration = 0.1;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.5, 0, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[9][9] = 6; // side window
            physics.renderTriangles[10][9] = 6;
            physics.renderTriangles[11][9] = 6;

            physics.renderTriangles[0][9] = 7; // side trim
            physics.renderTriangles[6][9] = 7;

            physics.renderTriangles[length][9] = 7; // side trim
            physics.renderTriangles[length + 6][9] = 7;

            physics.renderTriangles[length + 9][9] = 6; // side window
            physics.renderTriangles[length + 10][9] = 6;
            physics.renderTriangles[length + 11][9] = 6;

            physics.renderTriangles[length * 2 + 4][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 5][9] = 8;
            physics.renderTriangles[length * 2 + 6][9] = 8;
            physics.renderTriangles[length * 2 + 7][9] = 8;

            physics.renderTriangles[length * 2 + 8][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 9][9] = 7;
            physics.renderTriangles[length * 2 + 10][9] = 7;
            physics.renderTriangles[length * 2 + 11][9] = 7;
            physics.renderTriangles[length * 2 + 12][9] = 7;
            physics.renderTriangles[length * 2 + 13][9] = 7;

            physics.renderTriangles[length * 2 + 18][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 19][9] = 6;

            physics.renderTriangles[length * 2 + 22][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 23][9] = 6;

            physics.renderTriangles[length * 2][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 7;
            physics.renderTriangles[length * 2 + 2][9] = 7;
            physics.renderTriangles[length * 2 + 3][9] = 7;
        }
        else if (carModelIndex == 5) {
            const axleSpringProperties = new SpringProperties(200, 2);
            const chassisSpringProperties = new SpringProperties(100, 8);
            const frontSuspensionProperties = new SpringProperties(1600, 32);
            const rearSuspensionProperties = new SpringProperties(1600, 32);
            const tireSpringProperties = new SpringProperties(800, 4);
            const baseSpringProperties = new SpringProperties(200, 1);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(0.8, 100);
            const tireNodeProperties = new NodeProperties(0.1, 400);

            const frontAxle = new WheelAxle(0.65, 0.4, 1.5, -0.9, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.65, 0.4, 1.5, 0.9, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 20;
            vehicleSteerSpeed = 10;
            vehicleAcceleration = 0.2;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 7, [0, 1, 0], carModels[carModelIndex].bodyShape, 2, 0.35, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[3][9] = 6; // side window
            physics.renderTriangles[4][9] = 6;

            physics.renderTriangles[length + 3][9] = 6; // side window
            physics.renderTriangles[length + 4][9] = 6;

            physics.renderTriangles[length * 2 + 6][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 7][9] = 6;

            physics.renderTriangles[length * 2 + 10][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 11][9] = 6;
        }
        else if (carModelIndex == 6) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(800, 32);
            const rearSuspensionProperties = new SpringProperties(800, 32);
            const tireSpringProperties = new SpringProperties(1600, 8);
            const baseSpringProperties = new SpringProperties(800, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 400);

            const frontAxle = new WheelAxle(0.3, 0.2, 1.25, -0.95, 8, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.3, 0.2, 1.25, 0.95, 8, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 80;
            vehicleSteerSpeed = 60;
            vehicleAcceleration = 0.15;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.3, 0.1, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[6][9] = 6; // side window
            physics.renderTriangles[7][9] = 6;
            physics.renderTriangles[8][9] = 6;

            physics.renderTriangles[length + 6][9] = 6; // side window
            physics.renderTriangles[length + 7][9] = 6;
            physics.renderTriangles[length + 8][9] = 6;

            physics.renderTriangles[length * 2 + 12][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 13][9] = 6;

            physics.renderTriangles[length * 2 + 16][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 17][9] = 6;

            physics.renderTriangles[length * 2 + 4][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 5][9] = 8;

            physics.renderTriangles[length * 2 + 6][9] = 7; // front bumper
            physics.renderTriangles[length * 2 + 7][9] = 7;

            physics.renderTriangles[length * 2 + 2][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 3][9] = 7;
        }
        else if (carModelIndex == 7) {
            const axleSpringProperties = new SpringProperties(1600, 1);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(200, 4);
            const rearSuspensionProperties = new SpringProperties(100, 16);
            const tireSpringProperties = new SpringProperties(1600, 4);
            const baseSpringProperties = new SpringProperties(100, 1);

            const chassisNodeProperties = new NodeProperties(0.8, 0, false);
            const baseNodeProperties = new NodeProperties(0.4, 20);
            const tireNodeProperties = new NodeProperties(0.1, 200);

            const frontAxle = new WheelAxle(0.2, 0.15, 1.1, -0.6, 8, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.2, 0.2, 0.05, 0.6, 8, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 40;
            vehicleSteerSpeed = 40;
            vehicleAcceleration = 0.05;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1, 0.05, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[5][9] = 6; // side window
            physics.renderTriangles[6][9] = 6;
            physics.renderTriangles[7][9] = 6;

            physics.renderTriangles[length + 5][9] = 6; // side window
            physics.renderTriangles[length + 6][9] = 6;
            physics.renderTriangles[length + 7][9] = 6;

            physics.renderTriangles[length * 2 + 10][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 11][9] = 6;

            physics.renderTriangles[length * 2 + 14][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 15][9] = 6;

            physics.renderTriangles[length * 2 + 2][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 3][9] = 8;
            physics.renderTriangles[length * 2 + 4][9] = 8;
            physics.renderTriangles[length * 2 + 5][9] = 8;
        }
        else if (carModelIndex == 8) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(1600, 32);
            const rearSuspensionProperties = new SpringProperties(1600, 32);
            const tireSpringProperties = new SpringProperties(1600, 8);
            const baseSpringProperties = new SpringProperties(1600, 4);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 800);

            const frontAxle = new WheelAxle(0.4, 0.25, 1.8, -1.5, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.4, 0.25, 1.8, 1.5, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 60;
            vehicleSteerSpeed = 60;
            vehicleAcceleration = 0.2;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.9, 0, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[9][9] = 6; // side window
            physics.renderTriangles[10][9] = 6;

            physics.renderTriangles[length + 9][9] = 6; // side window
            physics.renderTriangles[length + 10][9] = 6;

            physics.renderTriangles[length * 2 + 4][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 5][9] = 8;
            physics.renderTriangles[length * 2 + 6][9] = 8;
            physics.renderTriangles[length * 2 + 7][9] = 8;
            physics.renderTriangles[length * 2 + 8][9] = 8;
            physics.renderTriangles[length * 2 + 9][9] = 8;

            physics.renderTriangles[length * 2 + 10][9] = 8; // front bumper
            physics.renderTriangles[length * 2 + 11][9] = 8;
            physics.renderTriangles[length * 2 + 12][9] = 8;
            physics.renderTriangles[length * 2 + 13][9] = 8;

            physics.renderTriangles[length * 2 + 18][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 19][9] = 6;

            physics.renderTriangles[length * 2 + 22][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 23][9] = 6;

            physics.renderTriangles[length * 2][9] = 8; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 8;
            physics.renderTriangles[length * 2 + 2][9] = 8;
            physics.renderTriangles[length * 2 + 3][9] = 8;
        }
        else if (carModelIndex == 9) {
            const axleSpringProperties = new SpringProperties(800, 2);
            const chassisSpringProperties = new SpringProperties(12800, 8);
            const frontSuspensionProperties = new SpringProperties(3200, 32);
            const rearSuspensionProperties = new SpringProperties(3200, 32);
            const tireSpringProperties = new SpringProperties(1600, 8);
            const baseSpringProperties = new SpringProperties(1600, 4);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 400);

            const frontAxle = new WheelAxle(0.35, 0.25, 1.7, -1.5, 12, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const rearAxle = new WheelAxle(0.35, 0.25, 1.4, 1.5, 12, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [frontAxle, rearAxle];

            maxVehicleSpeed = 60;
            vehicleSteerSpeed = 40;
            vehicleAcceleration = 0.4;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 1.8, -0.05, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[12][9] = 6; // side window
            physics.renderTriangles[13][9] = 6;
            physics.renderTriangles[14][9] = 6;
            physics.renderTriangles[15][9] = 6;

            physics.renderTriangles[length + 12][9] = 6; // side window
            physics.renderTriangles[length + 13][9] = 6;
            physics.renderTriangles[length + 14][9] = 6;
            physics.renderTriangles[length + 15][9] = 6;

            physics.renderTriangles[length * 2 + 4][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 5][9] = 8;
            physics.renderTriangles[length * 2 + 6][9] = 8;
            physics.renderTriangles[length * 2 + 7][9] = 8;
            physics.renderTriangles[length * 2 + 8][9] = 8;
            physics.renderTriangles[length * 2 + 9][9] = 8;
            physics.renderTriangles[length * 2 + 10][9] = 8;
            physics.renderTriangles[length * 2 + 11][9] = 8;
            physics.renderTriangles[length * 2 + 12][9] = 8;
            physics.renderTriangles[length * 2 + 13][9] = 8;
            physics.renderTriangles[length * 2 + 14][9] = 8;
            physics.renderTriangles[length * 2 + 15][9] = 8;

            physics.renderTriangles[length * 2 + 16][9] = 8; // front bumper
            physics.renderTriangles[length * 2 + 17][9] = 8;
            physics.renderTriangles[length * 2 + 18][9] = 8;
            physics.renderTriangles[length * 2 + 19][9] = 8;

            physics.renderTriangles[length * 2 + 20][9] = 7; // grill
            physics.renderTriangles[length * 2 + 21][9] = 7;

            physics.renderTriangles[length * 2 + 24][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 25][9] = 6;

            physics.renderTriangles[length * 2 + 30][9] = 6; // rear window
            physics.renderTriangles[length * 2 + 31][9] = 6;

            physics.renderTriangles[length * 2][9] = 8; // rear bumper
            physics.renderTriangles[length * 2 + 1][9] = 8;
            physics.renderTriangles[length * 2 + 2][9] = 8;
            physics.renderTriangles[length * 2 + 3][9] = 8;
        }
        else if (carModelIndex == 10) {
            const axleSpringProperties = new SpringProperties(1600, 2);
            const chassisSpringProperties = new SpringProperties(51200, 8);
            const frontSuspensionProperties = new SpringProperties(800, 32);
            const rearSuspensionProperties = new SpringProperties(800, 32);
            const tireSpringProperties = new SpringProperties(800, 8);
            const baseSpringProperties = new SpringProperties(400, 2);

            const chassisNodeProperties = new NodeProperties(6.4, 0, false);
            const baseNodeProperties = new NodeProperties(1.6, 20);
            const tireNodeProperties = new NodeProperties(0.1, 1600);

            const axle1 = new WheelAxle(0.7, 0.4, 2.4, -3.1, 16, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const axle2 = new WheelAxle(0.7, 0.4, 2.4, -1.5, 16, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const axle3 = new WheelAxle(0.7, 0.4, 2.4, 1.5, 16, frontSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);
            const axle4 = new WheelAxle(0.7, 0.4, 2.4, 3.1, 16, rearSuspensionProperties, tireNodeProperties, tireSpringProperties, axleSpringProperties);

            const axleData = [axle1, axle2, axle3, axle4];

            maxVehicleSpeed = 30;
            vehicleSteerSpeed = 30;
            vehicleAcceleration = 0.4;
            carData = softbodyGenerator.createVehicle(physics, 5, 7, 8, [0, 1, 0], carModels[carModelIndex].bodyShape, 2.2, 0.6, axleData, chassisNodeProperties, chassisSpringProperties, baseNodeProperties, baseSpringProperties);

            const length = carModels[carModelIndex].bodyShape.length;

            physics.renderTriangles[0][9] = 8; // side frame
            physics.renderTriangles[1][9] = 8;
            physics.renderTriangles[2][9] = 8;
            physics.renderTriangles[3][9] = 8;
            physics.renderTriangles[4][9] = 8;
            physics.renderTriangles[5][9] = 8;
            physics.renderTriangles[11][9] = 8;
            physics.renderTriangles[12][9] = 8;

            physics.renderTriangles[length][9] = 8; // side frame
            physics.renderTriangles[length + 1][9] = 8;
            physics.renderTriangles[length + 2][9] = 8;
            physics.renderTriangles[length + 3][9] = 8;
            physics.renderTriangles[length + 4][9] = 8;
            physics.renderTriangles[length + 5][9] = 8;
            physics.renderTriangles[length + 11][9] = 8;
            physics.renderTriangles[length + 12][9] = 8;

            physics.renderTriangles[8][9] = 6; // side window

            physics.renderTriangles[length + 8][9] = 6; // side window

            physics.renderTriangles[length * 2 + 16][9] = 6; // windshield
            physics.renderTriangles[length * 2 + 17][9] = 6;

            physics.renderTriangles[length * 2 + 20][9] = 7; // cab back
            physics.renderTriangles[length * 2 + 21][9] = 7;

            physics.renderTriangles[length * 2 + 22][9] = 7; // bed
            physics.renderTriangles[length * 2 + 23][9] = 7;

            physics.renderTriangles[length * 2 + 24][9] = 7; // rear bumper
            physics.renderTriangles[length * 2 + 25][9] = 7;

            physics.renderTriangles[length * 2][9] = 8; // bottom
            physics.renderTriangles[length * 2 + 1][9] = 8;
            physics.renderTriangles[length * 2 + 2][9] = 8;
            physics.renderTriangles[length * 2 + 3][9] = 8;
            physics.renderTriangles[length * 2 + 4][9] = 8;
            physics.renderTriangles[length * 2 + 5][9] = 8;
            physics.renderTriangles[length * 2 + 6][9] = 8;
            physics.renderTriangles[length * 2 + 7][9] = 8;
            physics.renderTriangles[length * 2 + 8][9] = 8;
            physics.renderTriangles[length * 2 + 9][9] = 8;
            physics.renderTriangles[length * 2 + 10][9] = 8;
            physics.renderTriangles[length * 2 + 11][9] = 8;
        }
    }
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

function drawSprings() {
    overlayContext.strokeStyle = "rgb(160, 250, 220)";
    overlayContext.lineWidth = 0.4;
    overlayContext.beginPath();
    const viewScale = canvasOverlay.height / (2 * Math.tan(camera.fov * Math.PI / 360));

    for (const spring of physics.springs) {
        const a = renderer.projectPoint(renderer.toLocalSpace(spring.nodeA.position, camera.cframe), viewScale);
        const b = renderer.projectPoint(renderer.toLocalSpace(spring.nodeB.position, camera.cframe), viewScale);

        if (a[2] >= 0 || b[2] >= 0) continue;

        overlayContext.moveTo(canvasOverlay.width / 2 - renderer.width / 2 + a[0], canvasOverlay.height / 2 - renderer.height / 2 + a[1]);
        overlayContext.lineTo(canvasOverlay.width / 2 - renderer.width / 2 + b[0], canvasOverlay.height / 2 - renderer.height / 2 + b[1]);
    }

    overlayContext.stroke();
}

function updateOverlay() {
    overlayContext.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    overlayContext.imageSmoothingEnabled = false;
    overlayContext.drawImage(canvas3D, 0, 0, canvasOverlay.width, canvasOverlay.height);

    if (xRayEnabled) {
        drawSprings();
    }

    overlayContext.fillStyle = "rgb(0, 0, 200)";
    overlayContext.font = "32px system-ui";
    overlayContext.fillText(Math.round(1 / dt) + " FPS", 20, canvasOverlay.height - 20);
    overlayContext.font = "28px system-ui";

    if (keyData["c"]) {
        overlayContext.fillText("Controls:", canvasOverlay.width - 300, 40);
        overlayContext.font = "20px system-ui";
        overlayContext.fillText("Movement: WASD", canvasOverlay.width - 300, 80);
        overlayContext.fillText("Camera Zoom: Mouse Wheel", canvasOverlay.width - 300, 110);
        overlayContext.fillText("Change Resolution: P/O", canvasOverlay.width - 300, 140);
        overlayContext.fillText("Toggle X-Ray: X", canvasOverlay.width - 300, 170);
        overlayContext.fillText("Reload Car: R", canvasOverlay.width - 300, 200);
        overlayContext.fillText("Reload Ball: T", canvasOverlay.width - 300, 230);
        overlayContext.fillText("Change Car: Q/E", canvasOverlay.width - 300, 260);
    }
    else {
        overlayContext.fillText("See Controls (C)", canvasOverlay.width - 300, 40);
    }
}

function updateCamera() {
    const center = [0, 0, 0];
    let nodes = [];

    if (controlType == "Ball") {
        nodes = physics.nodes;
    }
    else if (controlType == "Car") {
        nodes = carData.chassis;
    }

    const nodeCount = nodes.length;

    if (nodeCount > 0) {
        for (const node of nodes) {
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

function updateControlForces() {
    if (controlType == "Ball") {
        let moveDir = [0, 0, 0];

        moveDir[0] = (keyData["d"] & 1) - (keyData["a"] & 1);
        moveDir[2] = (keyData["s"] & 1) - (keyData["w"] & 1);
        moveDir = camera.rotation.vectorToWorldSpace(...moveDir);
        moveDir[1] = 0;
        moveDir = value3.norm(moveDir)
        physics.applyForce(sphereCenter, moveDir, SPHERE_FORCE);
    }
    else if (controlType == "Car") {
        let throttle = (keyData["s"] & 1) - (keyData["w"] & 1);
        let steering = (keyData["d"] & 1) - (keyData["a"] & 1);

        if (throttle != 0 || steering != 0) {
            let leftSpeed = throttle * maxVehicleSpeed - steering * vehicleSteerSpeed;
            let rightSpeed = throttle * maxVehicleSpeed + steering * vehicleSteerSpeed;

            for (const axle of carData.axles) {
                for (const disk of axle.leftWheel) {
                    softbodyGenerator.applyDiskSpin(physics, disk, leftSpeed, vehicleAcceleration);
                }

                for (const disk of axle.rightWheel) {
                    softbodyGenerator.applyDiskSpin(physics, disk, rightSpeed, vehicleAcceleration);
                }
            }
        }
    }
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
    const subDt = 1 / STEPS_PER_SECOND;

    for (let i = 0; i < substeps; i++) {
        updateControlForces();
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
        controlType = "Car";
        reset();
    }
    if (upEvent.key == "t") {
        controlType = "Ball";
        reset();
    }
    if (upEvent.key == "x") {
        xRayEnabled = !xRayEnabled;
    }
    else if (upEvent.key == "o") {
        resolutionScale = Math.max(Math.min(resolutionScale * 0.8, 1), 0.01);
        resize();
    }
    else if (upEvent.key == "p") {
        resolutionScale = Math.max(Math.min(resolutionScale * 1.2, 1), 0.01);
        resize();
    }
    else if (upEvent.key == "q") {
        if (controlType == "Car") {
            carModelIndex = ((carModelIndex - 1) % carModels.length + carModels.length) % carModels.length;
            reset();
        }
    }
    else if (upEvent.key == "e") {
        if (controlType == "Car") {
            carModelIndex = (carModelIndex + 1) % carModels.length;
            reset();
        }
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
    await new Material("./assets/materials/rocky_grass", 4).load(),
    await new Material("./assets/materials/rockier_grass", 4).load(),
    await new Material("./assets/materials/rockiest_grass", 4).load(),
    await new Material("./assets/materials/pebbles", 8).load(),
    await new Material("./assets/materials/car", 1).load(),
    await new Material("./assets/materials/painted_metal", 2).load(),
    await new Material("./assets/materials/glass", 1).load(),
    await new Material("./assets/materials/rubber", 0.5).load(),
    await new Material("./assets/materials/steel", 4).load(),
    //await new Material("./assets/materials/test", 1).load(),
]
titleScreen.style.display = "none";
resize();
renderer.geographicLatitude = 20;
reset();
nextFrame();