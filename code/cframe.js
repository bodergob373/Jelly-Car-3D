export class CFrame {
    static #rotationOrders = [[0, 1, 2], [0, 2, 1], [1, 2, 0], [1, 0, 2], [2, 0, 1], [2, 1, 0]];

    static #getAxisCF(angle, axis) {
        if (axis == 0) {
            return new CFrame(
                0, 0, 0,
                1, 0, 0,
                0, Math.cos(angle), -Math.sin(angle),
                0, Math.sin(angle), Math.cos(angle)
            );
        }
        else if (axis == 1) {
            return new CFrame(
                0, 0, 0,
                Math.cos(angle), 0, Math.sin(angle),
                0, 1, 0,
                -Math.sin(angle), 0, Math.cos(angle)
            );
        }
        else if (axis == 2) {
            return new CFrame(
                0, 0, 0,
                Math.cos(angle), -Math.sin(angle), 0,
                Math.sin(angle), Math.cos(angle), 0,
                0, 0, 1
            );
        }
    }

    constructor(x = 0, y = 0, z = 0, r00 = 1, r01 = 0, r02 = 0, r10 = 0, r11 = 1, r12 = 0, r20 = 0, r21 = 0, r22 = 1) {
        this.values = new Float64Array([x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22]);
    }

    get position() {
        return [this.values[0], this.values[1], this.values[2]];
    }

    mult(otherCF) {
        const a = this.values;
        const b = otherCF.values;

        return new CFrame(
            a[0] + a[3] * b[0] + a[4] * b[1] + a[5] * b[2],
            a[1] + a[6] * b[0] + a[7] * b[1] + a[8] * b[2],
            a[2] + a[9] * b[0] + a[10] * b[1] + a[11] * b[2],
            a[3] * b[3] + a[4] * b[6] + a[5] * b[9],
            a[3] * b[4] + a[4] * b[7] + a[5] * b[10],
            a[3] * b[5] + a[4] * b[8] + a[5] * b[11],
            a[6] * b[3] + a[7] * b[6] + a[8] * b[9],
            a[6] * b[4] + a[7] * b[7] + a[8] * b[10],
            a[6] * b[5] + a[7] * b[8] + a[8] * b[11],
            a[9] * b[3] + a[10] * b[6] + a[11] * b[9],
            a[9] * b[4] + a[10] * b[7] + a[11] * b[10],
            a[9] * b[5] + a[10] * b[8] + a[11] * b[11]
        );
    }

    inverse() {
        const v = this.values;

        return new CFrame(
            -(v[3] * v[0] + v[6] * v[1] + v[9] * v[2]),
            -(v[4] * v[0] + v[7] * v[1] + v[10] * v[2]),
            -(v[5] * v[0] + v[8] * v[1] + v[11] * v[2]),

            v[3], v[6], v[9],
            v[4], v[7], v[10],
            v[5], v[8], v[11]
        );
    }

    pointToWorldSpace(x, y, z) {
        const v = this.values;

        return [
            v[0] + v[3] * x + v[4] * y + v[5] * z,
            v[1] + v[6] * x + v[7] * y + v[8] * z,
            v[2] + v[9] * x + v[10] * y + v[11] * z
        ]
    }

    pointToLocalSpace(x, y, z) {
        const v = this.values;

        x -= v[0];
        y -= v[1];
        z -= v[2];

        return [
            v[3] * x + v[6] * y + v[9] * z,
            v[4] * x + v[7] * y + v[10] * z,
            v[5] * x + v[8] * y + v[11] * z
        ]
    }

    static fromEulerAngles(x = 0, y = 0, z = 0, rotOrderIndex = 0) {
        const rotationOrder = this.#rotationOrders[rotOrderIndex];
        const angles = [x, y, z];
        const cf1 = this.#getAxisCF(angles[rotationOrder[0]], rotationOrder[0]);
        const cf2 = this.#getAxisCF(angles[rotationOrder[1]], rotationOrder[1]);
        const cf3 = this.#getAxisCF(angles[rotationOrder[2]], rotationOrder[2]);

        return cf3.mult(cf2).mult(cf1);
    }
}