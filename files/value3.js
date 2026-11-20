export function norm(vector) {
    let magnitude = Math.hypot(vector[0], vector[1], vector[2]) || 1;

    if (magnitude == 0) {
        return [0, 0, 0];
    }

    return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

export function dot(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

export function cross(u, v) {
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];

    return [nx, ny, nz];
}

export function mul(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

export function add(vector1, vector2) {
    return [vector1[0] + vector2[0], vector1[1] + vector2[1], vector1[2] + vector2[2]];
}

export function sub(vector1, vector2) {
    return [vector1[0] - vector2[0], vector1[1] - vector2[1], vector1[2] - vector2[2]];
}

export function interpolate(points, t) {
    if (t <= points[0][0]) {
        return points[0][1];
    }

    if (t >= points[points.length - 1][0]) {
        return points[points.length - 1][1];
    }

    let i = 0;

    while (points[i + 1][0] < t) i++;

    const [p0, c0] = points[i];
    const [p1, c1] = points[i + 1];
    const u = (1 - Math.cos((t - p0) / (p1 - p0) * Math.PI)) / 2;

    return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u];
}