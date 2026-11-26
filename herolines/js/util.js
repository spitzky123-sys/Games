'use strict';
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: p => Math.random() < p,
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  // Warcraft-style armor: each point ~6% effective HP
  armorMult(armor) {
    return armor >= 0 ? 1 - (0.06 * armor) / (1 + 0.06 * armor) : 2 - Math.pow(0.94, -armor);
  },
  // distance from point to segment, and projection t
  segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
  },
  fmt(n) {
    n = Math.floor(n);
    return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  },
};

// cumulative lengths of a polyline
function pathInfo(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  return { path, cum, total: cum[cum.length - 1] };
}
const GROUND = pathInfo(PATH);
const AIR = pathInfo(FLY_PATH);
