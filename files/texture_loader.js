import { readExr } from "hdrify";

export class TextureLoader {
    static async decode(path) {
        const response = await fetch(path);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to load texture: ${response.status}`);
        }

        const extension = path
            .split("?")[0]
            .split(".")
            .pop()
            .toLowerCase();

        if (extension === "exr") {
            const buffer = new Uint8Array(
                await response.arrayBuffer()
            );

            return readExr(buffer);
        }

        if (extension === "png" || extension === "jpg" || extension === "jpeg") {
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);

            const canvas = new OffscreenCanvas(
                bitmap.width,
                bitmap.height
            );

            const context = canvas.getContext("2d");

            context.drawImage(bitmap, 0, 0);

            const image = context.getImageData(
                0,
                0,
                bitmap.width,
                bitmap.height
            );

            const convertedData = new Float32Array(image.data.length);

            for (let i = 0; i < convertedData.length; i++) {
                convertedData[i] = image.data[i] / 255;
            }

            return {
                width: bitmap.width,
                height: bitmap.height,
                data: convertedData
            };
        }

        throw new Error(`Unsupported texture format: .${extension}`);
    }

    static generateMipLevels(image, normalize = false) {
        const levels = [image];

        let width = image.width;
        let height = image.height;
        let data = image.data;

        while (width > 1 || height > 1) {
            const newWidth = Math.max(1, Math.floor(width / 2));
            const newHeight = Math.max(1, Math.floor(height / 2));
            const newData = new Float32Array(newWidth * newHeight * 4);

            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < newWidth; x++) {
                    const x0 = x * 2;
                    const y0 = y * 2;

                    let r = 0;
                    let g = 0;
                    let b = 0;
                    let a = 0;
                    let count = 0;

                    for (let oy = 0; oy < 2; oy++) {
                        const sy = y0 + oy;
                        if (sy >= height) continue;

                        for (let ox = 0; ox < 2; ox++) {
                            const sx = x0 + ox;
                            if (sx >= width) continue;

                            const i = (sy * width + sx) * 4;

                            r += data[i];
                            g += data[i + 1];
                            b += data[i + 2];
                            a += data[i + 3];

                            count++;
                        }
                    }

                    const i = (y * newWidth + x) * 4;

                    newData[i] = r / count;
                    newData[i + 1] = g / count;
                    newData[i + 2] = b / count;
                    newData[i + 3] = a / count;

                    if (normalize) {
                        let nx = newData[i] * 2 - 1;
                        let ny = newData[i + 1] * 2 - 1;
                        let nz = newData[i + 2] * 2 - 1;

                        const length = Math.hypot(nx, ny, nz);

                        if (length > 0) {
                            nx /= length;
                            ny /= length;
                            nz /= length;
                        }

                        newData[i] = nx * 0.5 + 0.5;
                        newData[i + 1] = ny * 0.5 + 0.5;
                        newData[i + 2] = nz * 0.5 + 0.5;
                    }
                }
            }

            const level = { width: newWidth, height: newHeight, data: newData };

            levels.push(level);

            width = newWidth;
            height = newHeight;
            data = newData;
        }

        return levels;
    }
}