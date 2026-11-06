const canvas3D = document.getElementById("canvas3D");
const canvasOverlay = document.getElementById("canvasOverlay");

const DISPLAY_WIDTH = window.innerWidth;
const DISPLAY_HEIGHT = window.innerHeight;

const canvas3DContext = canvas3D.getContext("2d");
const overlayContext = canvasOverlay.getContext("2d");
const imageData = canvas3DContext.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
const data = imageData.data;

function setPixel(x, y, r, g, b) {
    const i = (y * DISPLAY_WIDTH + x) * 4;

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
}

function clearDisplay() {
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
    }
}

function render() {
    clearDisplay();
    canvas3DContext.putImageData(imageData, 0, 0);
    requestAnimationFrame(render);
}

canvas3D.width = DISPLAY_WIDTH;
canvas3D.height = DISPLAY_HEIGHT;
render();