export class TextureLoader {
    static async decode(path) {
        const image = new Image();

        image.src = path;

        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });

        const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
        const context = canvas.getContext("2d");

        context.drawImage(image, 0, 0);

        const pixels = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);

        return { width: image.naturalWidth, height: image.naturalHeight, data: pixels.data };
    }

    static generateMipLevels(image, normalize = false) {
        const levels = [image];

        let width = image.width;
        let height = image.height;
        let data = image.data;

        while (width > 1 || height > 1) {
            const newWidth = Math.max(1, Math.floor(width / 2));
            const newHeight = Math.max(1, Math.floor(height / 2));
            const newData = new Uint8Array(newWidth * newHeight * 4);

            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < newWidth; x++) {
                    const i = (y * newWidth + x) * 4;
                    const x0 = x * 2;
                    const y0 = y * 2;
                    let count = 0;
                    let r = 0;
                    let g = 0;
                    let b = 0;
                    let a = 0;

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

                    r /= count;
                    g /= count;
                    b /= count;
                    a /= count;

                    if (normalize) {
                        let nx = (r / 255) * 2 - 1;
                        let ny = (g / 255) * 2 - 1;
                        let nz = (b / 255) * 2 - 1;

                        const length = Math.hypot(nx, ny, nz);

                        if (length > 0) {
                            nx /= length;
                            ny /= length;
                            nz /= length;
                        }

                        r = (nx * 0.5 + 0.5) * 255;
                        g = (ny * 0.5 + 0.5) * 255;
                        b = (nz * 0.5 + 0.5) * 255;
                    }

                    newData[i] = r;
                    newData[i + 1] = g;
                    newData[i + 2] = b;
                    newData[i + 3] = a;
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