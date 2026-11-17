import { TextureLoader } from "./texture_loader.js";

export class Sky {
    static TEXTURES = [
        "left",
        "right",
        "down",
        "up",
        "front",
        "back",
        "sun"
    ];

    static FORMATS = [
        "exr",
        "png",
        "jpg",
        "jpeg"
    ];

    constructor(path, sunAngularSize = 20) {
        this.path = path;

        this.sunAngularSize = sunAngularSize;
    }

    async load() {
        const basePath = this.path.replace(/\/+$/, "");

        const results = await Promise.all(
            Sky.TEXTURES.map(async (name) => {
                for (const format of Sky.FORMATS) {
                    const path = `${basePath}/${name}.${format}`;

                    const image = await TextureLoader.decode(path);

                    if (image !== null) {
                        return [name, image];
                    }
                }

                return [name, null];
            })
        );

        for (const [name, image] of results) {
            if (!image) continue;

            this[name] = image;
        }

        return this;
    }
}