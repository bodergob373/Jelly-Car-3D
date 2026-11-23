import * as value3 from "./value3.js";

export function getNormal3(a, b, c) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];

    return value3.norm(value3.cross([ux, uy, uz], [vx, vy, vz]));
}

export function uvMapTriangle(triangle) {
    const cx = (triangle[0] + triangle[3] + triangle[6]) / 3;
    const cy = (triangle[1] + triangle[4] + triangle[7]) / 3;
    const cz = (triangle[2] + triangle[5] + triangle[8]) / 3;
    const ux = triangle[3] - triangle[0];
    const uy = triangle[4] - triangle[1];
    const uz = triangle[5] - triangle[2];
    const vx = triangle[6] - triangle[0];
    const vy = triangle[7] - triangle[1];
    const vz = triangle[8] - triangle[2];
    const normal = value3.norm(value3.cross([ux, uy, uz], [vx, vy, vz]));
    const xAxisDir = value3.norm([ux, uy, uz]);
    const yAxisDir = value3.norm(value3.cross(normal, xAxisDir));
    const rel1 = [triangle[0] - cx, triangle[1] - cy, triangle[2] - cz];
    const rel2 = [triangle[3] - cx, triangle[4] - cy, triangle[5] - cz];
    const rel3 = [triangle[6] - cx, triangle[7] - cy, triangle[8] - cz];
    const x1 = value3.dot(rel1, xAxisDir);
    const y1 = value3.dot(rel1, yAxisDir);
    const x2 = value3.dot(rel2, xAxisDir);
    const y2 = value3.dot(rel2, yAxisDir);
    const x3 = value3.dot(rel3, xAxisDir);
    const y3 = value3.dot(rel3, yAxisDir);
    const uOffset = Math.random() * 64;
    const vOffset = Math.random() * 64;

    triangle[10] = x1 + uOffset;
    triangle[11] = y1 + vOffset;
    triangle[12] = x2 + uOffset;
    triangle[13] = y2 + vOffset;
    triangle[14] = x3 + uOffset;
    triangle[15] = y3 + vOffset;
}