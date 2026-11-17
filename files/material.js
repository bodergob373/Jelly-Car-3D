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

    constructor(path) {
        this.path = path;

        this.width = 0;
        this.height = 0;
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
            if (!image) continue;

            if (this.width === 0) {
                this.width = image.width;
                this.height = image.height;
            } else if (
                image.width !== this.width ||
                image.height !== this.height
            ) {
                throw new Error(
                    `Texture map "${name}" has wrong dimensions`
                );
            }

            this[name] = image;
        }

        return this;
    }
}