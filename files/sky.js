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
        "png",
        "jpg",
        "jpeg",
        "exr",
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

                    try {
                        const image = await TextureLoader.decode(path);

                        if (image !== null) {
                            return [name, image];
                        }
                    } catch (error) {
                        return [name, { width: 1, height: 1, data: [0, 0, 0, 1] }]
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