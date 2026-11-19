export class PerlinNoise2D {
    constructor(seed = 0) {
        const p = new Uint8Array(256);

        for (let i = 0; i < 256; i++) p[i] = i;

        let s = seed || 1;

        const rand = () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 0xffffffff;
        };

        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        this.perm = new Uint8Array(512);

        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);

        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const p = this.perm;

        const A = p[X] + Y;
        const B = p[X + 1] + Y;

        return this.lerp(
            this.lerp(
                this.grad(p[A], x, y),
                this.grad(p[B], x - 1, y),
                u
            ),
            this.lerp(
                this.grad(p[A + 1], x, y - 1),
                this.grad(p[B + 1], x - 1, y - 1),
                u
            ),
            v
        );
    }
}