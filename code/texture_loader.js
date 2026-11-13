import { readExr } from "hdrify";

export class TextureLoader {
    static async decode(path) {
        if (!path.toLowerCase().endsWith(".exr")) {
            throw new Error("bad texture format");
        }

        const response = await fetch(path);

        if (!response.ok) {
            const error = new Error(`failed to load texture: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const buffer = new Uint8Array(await response.arrayBuffer());

        return readExr(buffer);
    }
}