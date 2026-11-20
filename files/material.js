import { TextureLoader } from "./texture_loader.js";

export class Material {
    static MAPS = [
        //"ao",
        "diff",
        //"disp",
        //"metal",
        "nor_gl",
        //"rough"
    ];

    static FORMATS = [
        "exr",
        "png",
        "jpg",
        "jpeg"
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

                    const image = await TextureLoader.decode(path);

                    if (image !== null) {
                        return [name, image];
                    }
                }

                return [name, null];
            })
        );

        for (const [name, image] of results) {
            if (image) {
                const normalize = name == "nor_gl";
                const mipLevels = TextureLoader.generateMipLevels(image, normalize);

                this[name] = mipLevels;
            }
        }

        return this;
    }
}