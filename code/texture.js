import { TextureLoader } from "./texture_loader";

export class Texture {
    static MAPS = [
        "ao",
        "diff",
        "disp",
        "metal",
        "nor_gl",
        "rough"
    ];

    constructor(path) {
        this.path = path;

        this.width = 0;
        this.height = 0;

        this.ao = null;
        this.diff = null;
        this.disp = null;
        this.metal = null;
        this.nor_gl = null;
        this.rough = null;
    }

    async load() {
        const basePath = this.path.replace(/\/+$/, "");

        const results = await Promise.all(
            Texture.MAPS.map(async (name) => {
                try {
                    const image = await TextureLoader.decode(`${basePath}/${name}.exr`);

                    return [name, image];
                } catch (error) {
                    if (error.status === 404) {
                        return [name, null];
                    }

                    throw error;
                }
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
                throw new Error(`texture map "${name}" has inconsistent dimensions`);
            }

            this[name] = image;
        }

        return this;
    }
}