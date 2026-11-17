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
}