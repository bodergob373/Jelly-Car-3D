import * as value3 from "./value3.js";
import { PerlinNoise2D } from "./perlin_noise_3d.js";

export class ProceduralTerrain {
    constructor(seed = Math.random(), terrainLayers = [], tileSize = 10, yOffset = 0, maxLoadRadius = 100, maxUnloadRadius = 200, minLoadRadius = 0, minUnloadRadius = 0) {
        this.noise = new PerlinNoise2D(seed);
        this.terrainLayers = terrainLayers;
        this.tileSize = tileSize;
        this.yOffset = yOffset;
        this.maxLoadRadius = maxLoadRadius;
        this.minLoadRadius = minLoadRadius;
        this.maxUnloadRadius = maxUnloadRadius;
        this.minUnloadRadius = minUnloadRadius;
        this.spawnPadUpperRadius = 50;
        this.spawnPadLowerRadius = 100;
        this.spawnPadHeight = 0;
        this.tiles = new Map();
        this.triangles = [];
        this.tileHeight = this.tileSize * Math.sqrt(3) / 2;
    }

    worldToGrid(x, z) {
        const zIndex = z / this.tileHeight;
        const xIndex = (x - zIndex * this.tileSize * 0.5) / this.tileSize;

        return [xIndex, zIndex];
    }

    updateTriangles() {
        this.triangles.length = 0;

        for (const column of this.tiles.values()) {
            for (const tile of column.values()) {
                this.triangles.push(...tile.triangles);
            }
        }
    }

    getHeight(x, z) {
        let y = this.yOffset;

        for (let layer of this.terrainLayers) {
            const freq = layer.Frequency;
            const amp = layer.Amplitude;

            y += this.noise.noise(x * freq, z * freq) * amp;
        }

        if (Math.abs(x) < this.spawnPadLowerRadius + this.tileSize || Math.abs(z) < this.spawnPadLowerRadius + this.tileSize) {
            const cone = (Math.hypot(x, z) - this.spawnPadUpperRadius) / (this.spawnPadLowerRadius - this.spawnPadUpperRadius);
            const a = Math.max(Math.min(cone, 1), 0);

            y = y * a + this.spawnPadHeight * (1 - a);
        }

        return y;
    }

    getVertex(xIndex, zIndex) {
        const x = (xIndex + zIndex * 0.5) * this.tileSize;
        const z = zIndex * this.tileHeight;

        return [x, this.getHeight(x, z), z];
    }

    getNormal(a, b, c) {
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];

        return value3.norm(value3.cross([ux, uy, uz], [vx, vy, vz]));
    }

    generateTile(xIndex, zIndex) {
        const p00 = this.getVertex(xIndex, zIndex);
        const p10 = this.getVertex(xIndex + 1, zIndex);
        const p01 = this.getVertex(xIndex, zIndex + 1);
        const p11 = this.getVertex(xIndex + 1, zIndex + 1);
        const vertices = [[p00, p01, p10], [p10, p01, p11]];
        const triangles = [];
        const normals = [];

        /*for (const points of vertices) {
            const normal = this.getNormal(...points);

            normals.push(normal);
            triangles.push([...points[0], ...points[1], ...points[2], 0, 0, 0, 0, 0, 0, 0]);
        }*/



        const normal1 = this.getNormal(...vertices[0]);

        normals.push(normal1);
        triangles.push([...vertices[0][2], ...vertices[0][1], ...vertices[0][0], 0, 0, 0, 0, 0, 0, 0]);

        const normal2 = this.getNormal(...vertices[1]);

        normals.push(normal2);
        triangles.push([...vertices[1][0], ...vertices[1][1], ...vertices[1][2], 0, 0, 0, 0, 0, 0, 0]);




        return { xIndex, zIndex, triangles, normals, vertices };
    }

    getTile(xIndex, zIndex) {
        return this.tiles.get(xIndex)?.get(zIndex);
    }

    setTile(xIndex, zIndex, tile) {
        let column = this.tiles.get(xIndex);

        if (!column) {
            column = new Map();
            this.tiles.set(xIndex, column);
        }

        column.set(zIndex, tile);
    }

    deleteTile(xIndex, zIndex) {
        const column = this.tiles.get(xIndex);

        if (!column) return;

        column.delete(zIndex);

        if (column.size === 0) {
            this.tiles.delete(xIndex);
        }
    }

    getTileAt(x, z) {
        const [gridX, gridZ] = this.worldToGrid(x, z);

        const i = Math.floor(gridX);
        const j = Math.floor(gridZ);

        const tile = this.getTile(i, j);

        if (tile) {
            const localX = gridX - i;
            const localZ = gridZ - j;

            const triangleIndex = localX + localZ <= 1 ? 0 : 1;

            return { tile, triangleIndex, triangle: tile.triangles[triangleIndex], normal: tile.normals[triangleIndex] };
        }
        else {
            return null;
        }
    }

    loadTiles(center) {
        const cx = Array.isArray(center) ? center[0] : center.x;
        const cz = Array.isArray(center) ? center[2] : center.z;
        const centerJ = cz / this.tileHeight;
        const jRadius = Math.ceil(this.maxLoadRadius / this.tileHeight) + 2;
        const iRadius = Math.ceil(this.maxLoadRadius / this.tileSize) + 2;
        const minJ = Math.floor(centerJ - jRadius);
        const maxJ = Math.ceil(centerJ + jRadius);
        let loaded = 0;
        let newTiles = [];

        for (let j = minJ; j <= maxJ; j++) {
            const centerI = (cx - (j + 0.5) * this.tileSize * 0.5) / this.tileSize;
            const minI = Math.floor(centerI - iRadius);
            const maxI = Math.ceil(centerI + iRadius);

            for (let i = minI; i <= maxI; i++) {
                if (this.getTile(i, j)) continue;

                const tileX = (i + 0.5 + (j + 0.5) * 0.5) * this.tileSize;
                const tileZ = (j + 0.5) * this.tileHeight;
                const dx = tileX - cx;
                const dz = tileZ - cz;
                const distance = Math.sqrt(dx * dx + dz * dz);

                if (distance + this.tileSize < this.minLoadRadius || distance - this.tileSize > this.maxLoadRadius) {
                    continue;
                }

                const tile = this.generateTile(i, j);

                this.setTile(i, j, tile);
                newTiles.push(tile)
                loaded++;
            }
        }

        this.updateTriangles();

        return newTiles;
    }

    unloadTiles(center) {
        const cx = Array.isArray(center) ? center[0] : center.x;
        const cz = Array.isArray(center) ? center[2] : center.z;

        let unloaded = 0;

        for (const [xIndex, column] of this.tiles) {
            for (const [zIndex, tile] of column) {
                const tileX = (xIndex + 0.5 + (zIndex + 0.5) * 0.5) * this.tileSize;
                const tileZ = (zIndex + 0.5) * this.tileHeight;
                const dx = tileX - cx;
                const dz = tileZ - cz;

                const distance = Math.sqrt(dx * dx + dz * dz);

                if (distance + this.tileSize < this.minUnloadRadius || distance - this.tileSize > this.maxUnloadRadius) {
                    this.deleteTile(xIndex, zIndex);
                    unloaded++;
                }
            }
        }

        this.updateTriangles();

        return unloaded;
    }
}