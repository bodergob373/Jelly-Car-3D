import { TextureLoader } from "./texture_loader_v2.js";

export class Material {
    static MAPS = [
        "diff",
        "nor_gl",
    ];

    static FORMATS = [
        "png",
        "jpg",
        "jpeg",
    ];

    constructor(path, scale = 1) {
        this.path = path;
        this.scale = scale;
    }

    async load() {
        const basePath = this.path.replace(/\/+$/, "");

        const results = await Promise.all(
            Material.MAPS.map(async (name) => {
                for (const format of Material.FORMATS) {
                    const path = `${basePath}/${name}.${format}`;

                    try {
                        const image = await TextureLoader.decode(path);

                        if (image !== null) {
                            return [name, image];
                        }
                    } catch (error) {
                        return [name, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) }];
                    }
                }

                return [name, null];
            })
        );

        for (const [name, image] of results) {
            if (image) {
                const normalize = name === "nor_gl";
                const mipLevels =
                    TextureLoader.generateMipLevels(image, normalize);

                this[name] = mipLevels;
            }
        }

        return this;
    }
}