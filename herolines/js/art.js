'use strict';
// ============================================================================
//  Procedural art: terrain, creature sprites, hero drawing, glow sprites.
// ============================================================================
const Art = (() => {
  const TAU = Math.PI * 2;
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, rot = 0, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function shade(ctx, x, y, r, light, dark) {
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    return g;
  }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, w, cap = 'round') {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap; ctx.stroke();
  }
  function shadeColor(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  // ------------------------------------------------------------- glow sprites
  const glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const c = mk(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color); g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    // white hot core
    const g2 = x.createRadialGradient(32, 32, 0, 32, 32, 12);
    g2.addColorStop(0, 'rgba(255,255,255,0.8)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g2; x.fillRect(0, 0, 64, 64);
    return (glowCache[color] = c);
  }
  const softCache = {};
  function soft(color) { // soft disk without hot core
    if (softCache[color]) return softCache[color];
    const c = mk(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (softCache[color] = c);
  }

  // ------------------------------------------------------------- terrain
  function nearPath(x, y, pad) {
    for (let i = 1; i < PATH.length; i++) {
      if (U.segDist(x, y, PATH[i - 1][0], PATH[i - 1][1], PATH[i][0], PATH[i][1]).d < pad) return true;
    }
    return false;
  }
  function pointOnPath(R) {
    const d = R() * GROUND.total;
    let i = 1;
    while (i < GROUND.cum.length - 1 && GROUND.cum[i] < d) i++;
    const a = PATH[i - 1], b = PATH[i];
    const t = (d - GROUND.cum[i - 1]) / (GROUND.cum[i] - GROUND.cum[i - 1]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang };
  }
  function strokePath(x, w, color, dash) {
    x.beginPath();
    x.moveTo(PATH[0][0], PATH[0][1]);
    for (let i = 1; i < PATH.length; i++) x.lineTo(PATH[i][0], PATH[i][1]);
    x.lineWidth = w; x.strokeStyle = color; x.lineJoin = 'round'; x.lineCap = 'round';
    if (dash) x.setLineDash(dash); else x.setLineDash([]);
    x.stroke(); x.setLineDash([]);
  }

  function drawTree(x, cx, cy, s, R, kind) {
    ellipse(x, cx + s * 0.35, cy + s * 0.35, s * 1.05, s * 0.8, 'rgba(0,0,0,0.28)');
    if (kind === 'pine') {
      const layers = 4;
      for (let l = 0; l < layers; l++) {
        const rr = s * (1 - l * 0.2), pts = [];
        const n = 9;
        for (let i = 0; i < n * 2; i++) {
          const a = i / (n * 2) * TAU + l * 0.3;
          const rad = i % 2 ? rr * 0.62 : rr;
          pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad - l * s * 0.06]);
        }
        const c = ['#1f4a2a', '#265c32', '#2f6e3a', '#3b8045'][l];
        poly(x, pts, c);
      }
      circle(x, cx - s * 0.05, cy - s * 0.25, s * 0.12, '#4c9655');
    } else {
      const base = ['#2c5e2a', '#356b2e', '#3f7a33', '#2f6a37'][Math.floor(R() * 4)];
      const blobs = 5 + Math.floor(R() * 3);
      for (let i = 0; i < blobs; i++) {
        const a = R() * TAU, d = R() * s * 0.45;
        circle(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * (0.45 + R() * 0.25), shadeColor(base, -0.15));
      }
      for (let i = 0; i < blobs; i++) {
        const a = R() * TAU, d = R() * s * 0.35;
        const bx = cx + Math.cos(a) * d - s * 0.08, by = cy + Math.sin(a) * d - s * 0.12;
        circle(x, bx, by, s * (0.32 + R() * 0.2), shade(x, bx, by, s * 0.5, shadeColor(base, 0.18), base));
      }
      for (let i = 0; i < 14; i++) {
        const a = R() * TAU, d = R() * s * 0.7;
        circle(x, cx + Math.cos(a) * d - s * 0.1, cy + Math.sin(a) * d - s * 0.15, s * 0.06, 'rgba(160,220,120,0.25)');
      }
    }
  }

  function drawRock(x, cx, cy, s, R) {
    ellipse(x, cx + s * 0.25, cy + s * 0.3, s * 1.0, s * 0.6, 'rgba(0,0,0,0.3)');
    const pts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, rr = s * (0.75 + R() * 0.3);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75]);
    }
    poly(x, pts, shade(x, cx, cy, s, '#a7a49b', '#5d5a55'));
    ellipse(x, cx - s * 0.2, cy - s * 0.25, s * 0.35, s * 0.18, 'rgba(255,255,255,0.18)', -0.3);
    if (R() < 0.5) ellipse(x, cx + s * 0.2, cy - s * 0.05, s * 0.25, s * 0.15, 'rgba(90,130,60,0.6)');
  }

  function buildTerrain(scale) {
    const c = mk(WORLD_W * scale, WORLD_H * scale), x = c.getContext('2d');
    x.scale(scale, scale);
    const R = rng(1337);
    // base grass
    const bg = x.createLinearGradient(0, 0, 0, WORLD_H);
    bg.addColorStop(0, '#2f4d2a'); bg.addColorStop(0.15, '#3d6630'); bg.addColorStop(0.85, '#43702f'); bg.addColorStop(1, '#3b632c');
    x.fillStyle = bg; x.fillRect(0, 0, WORLD_W, WORLD_H);
    const blot = ['rgba(85,130,55,0.22)', 'rgba(40,75,30,0.25)', 'rgba(100,140,60,0.18)', 'rgba(60,95,40,0.25)', 'rgba(120,130,60,0.14)'];
    for (let i = 0; i < 320; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H, rr = 40 + R() * 200;
      x.drawImage(soft(blot[i % blot.length]), px - rr, py - rr, rr * 2, rr * 2);
    }
    // grass blades
    const gcol = ['#4f7f38', '#5c8f40', '#3a6429', '#6b9a48', '#456f31', '#2f5524'];
    x.lineCap = 'round';
    for (let i = 0; i < 26000; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H;
      const len = 3 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 1.1;
      x.strokeStyle = gcol[(R() * gcol.length) | 0];
      x.globalAlpha = 0.5 + R() * 0.5;
      x.lineWidth = 1 + R();
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
    }
    x.globalAlpha = 1;

    // path
    strokePath(x, 182, 'rgba(30,25,15,0.35)');
    strokePath(x, 166, '#5b4630');
    strokePath(x, 150, '#7d6142');
    strokePath(x, 128, '#8e714d');
    const pcol = ['#a3845b', '#6f563a', '#94764f', '#7a5f40', '#b09068'];
    for (let i = 0; i < 9000; i++) {
      const p = pointOnPath(R), off = (R() - 0.5) * 140;
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      x.globalAlpha = 0.25 + R() * 0.5;
      ellipse(x, px, py, 1 + R() * 3, 1 + R() * 2, pcol[(R() * pcol.length) | 0], R() * 3);
    }
    x.globalAlpha = 1;
    // ruts
    for (const o of [-26, 26]) {
      x.save(); x.globalAlpha = 0.18;
      x.beginPath();
      for (let i = 0; i < PATH.length; i++) {
        const a = PATH[Math.max(0, i - 1)], b = PATH[Math.min(PATH.length - 1, i + 1)];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        const px = PATH[i][0] + Math.cos(ang) * o, py = PATH[i][1] + Math.sin(ang) * o;
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.lineWidth = 9; x.strokeStyle = '#3e2f1e'; x.lineJoin = 'round'; x.stroke();
      x.restore();
    }
    // pebbles
    for (let i = 0; i < 420; i++) {
      const p = pointOnPath(R), off = (R() - 0.5) * 150;
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      const s = 2 + R() * 4;
      ellipse(x, px + 1, py + 1.5, s, s * 0.7, 'rgba(0,0,0,0.25)');
      ellipse(x, px, py, s, s * 0.7, shade(x, px, py, s, '#c9c0ad', '#77705f'));
    }
    // grass tufts on path edges
    for (let i = 0; i < 1600; i++) {
      const p = pointOnPath(R), side = R() < 0.5 ? -1 : 1, off = side * (70 + R() * 18);
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 1.4, len = 4 + R() * 7;
        line(x, px, py, px + Math.cos(a) * len, py + Math.sin(a) * len, gcol[(R() * 4) | 0], 1.5);
      }
    }

    // flowers
    const fl = ['#f4f1de', '#f2cc4f', '#c88de0', '#ef8fa8', '#8fd0f0'];
    for (let i = 0; i < 900; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H;
      if (nearPath(px, py, 95)) continue;
      const col = fl[(R() * fl.length) | 0];
      for (let k = 0; k < 3; k++) circle(x, px + (R() - 0.5) * 10, py + (R() - 0.5) * 10, 1.6 + R(), col);
    }

    // fountain plaza
    const F = FOUNTAIN;
    circle(x, F.x, F.y, 150, 'rgba(0,0,0,0.25)');
    circle(x, F.x, F.y, 142, shade(x, F.x, F.y, 142, '#a9a49a', '#77736b'));
    for (let ring = 0; ring < 4; ring++) {
      const rr = 40 + ring * 26, n = 10 + ring * 7;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + ring;
        x.beginPath(); x.arc(F.x, F.y, rr + 12, a, a + TAU / n - 0.05);
        x.arc(F.x, F.y, rr - 12, a + TAU / n - 0.05, a, true); x.closePath();
        x.fillStyle = ['#9d988d', '#b2ad a2'.replace(' ', ''), '#8d897f'][(i + ring) % 3];
        x.fill();
        x.strokeStyle = 'rgba(40,35,30,0.35)'; x.lineWidth = 1.5; x.stroke();
      }
    }
    circle(x, F.x, F.y, 46, '#6b675f');
    circle(x, F.x, F.y, 40, shade(x, F.x, F.y, 40, '#7fd4f5', '#1d6f9e'));

    // top spawn ring
    circle(x, SPAWN.x, 60, 92, 'rgba(0,0,0,0.35)');
    circle(x, SPAWN.x, 60, 86, '#4a4450');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      circle(x, SPAWN.x + Math.cos(a) * 78, 60 + Math.sin(a) * 78, 12, shade(x, SPAWN.x + Math.cos(a) * 78, 60 + Math.sin(a) * 78, 12, '#8b8494', '#3f3946'));
    }
    circle(x, SPAWN.x, 60, 66, '#1b1020');

    // decorations: rocks + trees
    const placed = [];
    const ok = (px, py, pad) => {
      if (nearPath(px, py, pad)) return false;
      if (U.dist(px, py, F.x, F.y) < 230) return false;
      if (U.dist(px, py, SPAWN.x, 60) < 160) return false;
      if (py > WORLD_H - 120) return false;
      for (const p of placed) if (U.dist(px, py, p[0], p[1]) < p[2] + 18) return false;
      return true;
    };
    for (let i = 0; i < 110; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H, s = 8 + R() * 14;
      if (!ok(px, py, 100)) continue;
      placed.push([px, py, s]); drawRock(x, px, py, s, R);
    }
    const trees = [];
    // border forest
    for (let i = 0; i < 260; i++) {
      const side = i % 4;
      let px, py;
      if (side === 0) { px = R() * 110; py = R() * WORLD_H; }
      else if (side === 1) { px = WORLD_W - R() * 110; py = R() * WORLD_H; }
      else if (side === 2) { px = R() * WORLD_W; py = R() * 90; }
      else { px = R() * WORLD_W; py = R() * WORLD_H; }
      const s = 34 + R() * 30;
      if (!ok(px, py, 120 + s * 0.4)) continue;
      trees.push([px, py, s, R() < 0.35 ? 'pine' : 'oak']);
      placed.push([px, py, s * 0.8]);
    }
    trees.sort((a, b) => a[1] - b[1]);
    for (const t of trees) drawTree(x, t[0], t[1], t[2], R, t[3]);

    // southern wall with gate
    const wy = WORLD_H - 70;
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, wy - 8, WORLD_W, 90);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 60; col++) {
        const bw = 44, bh = 18, bx = col * bw - (row % 2) * 22, by = wy + row * bh;
        if (bx + bw > 690 && bx < 910) continue;
        const t = R();
        x.fillStyle = t < 0.33 ? '#8a8378' : t < 0.66 ? '#7a7368' : '#958e82';
        x.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(bx + 1, by + 1, bw - 2, 3);
      }
    }
    x.fillStyle = '#5d564c'; x.fillRect(0, wy - 6, 690, 8); x.fillRect(910, wy - 6, 690, 8);
    for (const tx of [660, 940]) {
      circle(x, tx, wy + 28, 46, 'rgba(0,0,0,0.35)');
      circle(x, tx, wy + 22, 42, shade(x, tx, wy + 22, 42, '#a59e92', '#5f594f'));
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        circle(x, tx + Math.cos(a) * 36, wy + 22 + Math.sin(a) * 36, 6, '#6a645a');
      }
      circle(x, tx, wy + 22, 26, '#3f3a33');
      // banner
      poly(x, [[tx - 10, wy + 10], [tx + 10, wy + 10], [tx + 10, wy + 36], [tx, wy + 30], [tx - 10, wy + 36]], '#2f5fa8');
    }
    // gate opening
    x.fillStyle = '#2a2018'; x.fillRect(700, wy + 4, 200, 66);
    for (let i = 0; i < 9; i++) line(x, 708 + i * 23, wy + 4, 708 + i * 23, wy + 70, '#4a3a2a', 4);

    // edge darkening
    const vg = x.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.35, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = vg; x.fillRect(0, 0, WORLD_W, WORLD_H);
    return c;
  }

  // ------------------------------------------------------------- creatures
  // all drawn facing +x, centred at 0,0, unit radius r, frame f (0/1) for walk
  const C = {
    gnoll(x, r, f, boss) {
      const leg = f ? 1 : -1;
      ellipse(x, -r * 0.15 + leg * r * 0.18, -r * 0.5, r * 0.22, r * 0.14, '#4d321a');
      ellipse(x, -r * 0.15 - leg * r * 0.18, r * 0.5, r * 0.22, r * 0.14, '#4d321a');
      const body = boss ? ['#c0392b', '#6e1d16'] : ['#a06a35', '#5a3a1c'];
      ellipse(x, -r * 0.1, 0, r * 0.72, r * 0.62, shade(x, -r * 0.1, 0, r * 0.7, body[0], body[1]));
      // fur mane
      for (let i = -3; i <= 3; i++) circle(x, -r * 0.35, i * r * 0.15, r * 0.14, boss ? '#3a1a12' : '#6a4422');
      // arms + weapon
      ellipse(x, r * 0.25, r * 0.55, r * 0.2, r * 0.16, '#8b5a2b');
      if (boss) {
        line(x, r * 0.1, r * 0.6, r * 1.2, r * 0.6, '#4a3420', r * 0.14);
        poly(x, [[r * 1.1, r * 0.25], [r * 1.45, r * 0.45], [r * 1.45, r * 0.75], [r * 1.1, r * 0.95]], '#c9ced6', '#555', 1);
        poly(x, [[r * 1.1, r * 0.25], [r * 0.85, r * 0.45], [r * 0.85, r * 0.75], [r * 1.1, r * 0.95]], '#aeb4bd', '#555', 1);
        ellipse(x, -r * 0.1, 0, r * 0.45, r * 0.55, 'rgba(60,60,70,0.55)');
      } else {
        line(x, -r * 0.3, r * 0.6, r * 1.35, r * 0.6, '#6e4b2a', r * 0.1);
        poly(x, [[r * 1.35, r * 0.48], [r * 1.65, r * 0.6], [r * 1.35, r * 0.72]], '#cfd3d8');
      }
      // head
      circle(x, r * 0.45, 0, r * 0.4, shade(x, r * 0.45, 0, r * 0.4, boss ? '#c88a4a' : '#b07a42', '#6a4422'));
      ellipse(x, r * 0.85, 0, r * 0.22, r * 0.16, '#c9965c');
      circle(x, r * 1.02, 0, r * 0.07, '#222');
      poly(x, [[r * 0.25, -r * 0.3], [r * 0.15, -r * 0.6], [r * 0.45, -r * 0.35]], '#6a4422');
      poly(x, [[r * 0.25, r * 0.3], [r * 0.15, r * 0.6], [r * 0.45, r * 0.35]], '#6a4422');
      circle(x, r * 0.66, -r * 0.16, r * 0.06, '#ff3b1f'); circle(x, r * 0.66, r * 0.16, r * 0.06, '#ff3b1f');
    },
    wolf(x, r, f) {
      const leg = f ? 1 : -1;
      for (const [lx, ly, s] of [[0.45, -0.38, 1], [0.45, 0.38, -1], [-0.45, -0.38, -1], [-0.45, 0.38, 1]]) {
        ellipse(x, (lx + s * leg * 0.12) * r, ly * r * 1.05, r * 0.18, r * 0.1, '#3f3f48');
      }
      // tail
      ellipse(x, -r * 1.05, leg * r * 0.08, r * 0.38, r * 0.13, '#5d5d68', leg * 0.15);
      ellipse(x, 0, 0, r * 0.9, r * 0.45, shade(x, 0, 0, r * 0.9, '#9a9aa6', '#4a4a55'));
      ellipse(x, -r * 0.1, 0, r * 0.55, r * 0.18, 'rgba(40,40,48,0.45)');
      circle(x, r * 0.78, 0, r * 0.34, shade(x, r * 0.78, 0, r * 0.34, '#a6a6b2', '#55555f'));
      ellipse(x, r * 1.12, 0, r * 0.24, r * 0.14, '#8a8a95');
      circle(x, r * 1.32, 0, r * 0.07, '#111');
      poly(x, [[r * 0.6, -r * 0.18], [r * 0.5, -r * 0.45], [r * 0.78, -r * 0.25]], '#5a5a66');
      poly(x, [[r * 0.6, r * 0.18], [r * 0.5, r * 0.45], [r * 0.78, r * 0.25]], '#5a5a66');
      circle(x, r * 0.95, -r * 0.13, r * 0.06, '#ffd23f'); circle(x, r * 0.95, r * 0.13, r * 0.06, '#ffd23f');
    },
    spider(x, r, f, boss) {
      const leg = f ? 0.18 : -0.18;
      x.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
          const a0 = (-0.9 + i * 0.6) + (i % 2 ? leg : -leg);
          const bx = r * 0.15, by = side * r * 0.2;
          const kx = bx + Math.cos(a0) * r * 0.7, ky = by + side * Math.abs(Math.sin(a0 + 1.6)) * r * 0.75;
          const ex = kx + Math.cos(a0) * r * 0.45, ey = ky + side * r * 0.45;
          x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(kx, ky - side * r * 0.1, ex, ey);
          x.strokeStyle = boss ? '#2a3a1a' : '#26172e'; x.lineWidth = r * 0.12; x.stroke();
        }
      }
      ellipse(x, -r * 0.4, 0, r * 0.62, r * 0.52, shade(x, -r * 0.4, 0, r * 0.6, boss ? '#6b8a3a' : '#6a3f80', boss ? '#22300f' : '#2a1636'));
      if (boss) { for (const e of [[-0.7, -0.3], [-0.75, 0.25], [-0.45, 0.05]]) circle(x, e[0] * r, e[1] * r, r * 0.16, 'rgba(200,255,140,0.75)'); }
      else poly(x, [[-r * 0.65, 0], [-r * 0.4, -r * 0.16], [-r * 0.15, 0], [-r * 0.4, r * 0.16]], '#c0392b');
      circle(x, r * 0.25, 0, r * 0.32, shade(x, r * 0.25, 0, r * 0.32, boss ? '#55702e' : '#5a3470', boss ? '#1c280c' : '#21102b'));
      for (const e of [[0.45, -0.1], [0.45, 0.1], [0.38, -0.2], [0.38, 0.2]]) circle(x, e[0] * r, e[1] * r, r * 0.06, boss ? '#d4ff5c' : '#ff4d4d');
    },
    archer(x, r, f) {
      const leg = f ? 1 : -1;
      ellipse(x, leg * r * 0.15, -r * 0.4, r * 0.2, r * 0.13, '#3c5b36');
      ellipse(x, -leg * r * 0.15, r * 0.4, r * 0.2, r * 0.13, '#3c5b36');
      // quiver
      ellipse(x, -r * 0.55, -r * 0.2, r * 0.35, r * 0.12, '#5a3a20', 0.4);
      for (let i = 0; i < 3; i++) line(x, -r * 0.85, -r * 0.35 + i * 0.08 * r, -r * 0.95, -r * 0.45 + i * 0.08 * r, '#e8e2d0', 1.5);
      circle(x, 0, 0, r * 0.62, shade(x, 0, 0, r * 0.62, '#7ab872', '#3a6a35'));
      ellipse(x, -r * 0.05, 0, r * 0.4, r * 0.55, '#6d4b2c');
      // bow
      x.beginPath(); x.arc(r * 0.35, 0, r * 0.75, -1.1, 1.1);
      x.strokeStyle = '#7b4a1e'; x.lineWidth = r * 0.12; x.stroke();
      line(x, r * 0.35 + Math.cos(-1.1) * r * 0.75, Math.sin(-1.1) * r * 0.75, r * 0.35 + Math.cos(1.1) * r * 0.75, Math.sin(1.1) * r * 0.75, '#ddd', 1);
      circle(x, r * 0.35, 0, r * 0.34, shade(x, r * 0.35, 0, r * 0.34, '#8ccf84', '#3f7a3a'));
      // mohawk & tusks
      ellipse(x, r * 0.25, 0, r * 0.3, r * 0.08, '#d9422b');
      line(x, r * 0.6, -r * 0.12, r * 0.78, -r * 0.2, '#fff', 2); line(x, r * 0.6, r * 0.12, r * 0.78, r * 0.2, '#fff', 2);
      circle(x, r * 0.55, -r * 0.12, r * 0.05, '#ffea70'); circle(x, r * 0.55, r * 0.12, r * 0.05, '#ffea70');
    },
    golem(x, r, f) {
      const s = f ? 0.06 : -0.06;
      circle(x, r * (0.1 + s), -r * 0.72, r * 0.36, shade(x, r * 0.1, -r * 0.72, r * 0.36, '#a5a8ae', '#55585e'));
      circle(x, r * (0.1 - s), r * 0.72, r * 0.36, shade(x, r * 0.1, r * 0.72, r * 0.36, '#a5a8ae', '#55585e'));
      poly(x, [[-r * 0.7, -r * 0.5], [-r * 0.2, -r * 0.75], [r * 0.5, -r * 0.55], [r * 0.7, 0], [r * 0.5, r * 0.55], [-r * 0.2, r * 0.75], [-r * 0.7, r * 0.5], [-r * 0.85, 0]],
        shade(x, 0, 0, r * 0.8, '#9da1a8', '#4f525a'), '#3a3c42', 2);
      line(x, -r * 0.4, -r * 0.3, -r * 0.05, r * 0.05, 'rgba(30,30,35,0.7)', 2);
      line(x, -r * 0.05, r * 0.05, r * 0.15, -r * 0.25, 'rgba(30,30,35,0.7)', 2);
      ellipse(x, -r * 0.45, r * 0.3, r * 0.2, r * 0.12, 'rgba(100,150,70,0.8)');
      ellipse(x, r * 0.15, -r * 0.45, r * 0.15, r * 0.1, 'rgba(100,150,70,0.8)');
      circle(x, r * 0.5, 0, r * 0.28, shade(x, r * 0.5, 0, r * 0.28, '#8a8d94', '#45474d'));
      circle(x, r * 0.65, -r * 0.1, r * 0.06, '#7ff3ff'); circle(x, r * 0.65, r * 0.1, r * 0.06, '#7ff3ff');
    },
    harpy(x, r, f) {
      const flap = f ? 1 : 0.55;
      for (const side of [-1, 1]) {
        const pts = [[r * 0.1, side * r * 0.2], [r * 0.2, side * r * 1.3 * flap], [-r * 0.25, side * r * 1.45 * flap], [-r * 0.55, side * r * 1.0 * flap], [-r * 0.35, side * r * 0.25]];
        poly(x, pts, side < 0 ? '#7d4d99' : '#8e5ea8', '#4a2a5e', 1.5);
        for (let i = 1; i < 4; i++) line(x, -r * 0.05, side * r * 0.25, r * 0.15 - i * r * 0.2, side * r * (0.6 + i * 0.25) * flap, 'rgba(60,30,80,0.6)', 1);
      }
      ellipse(x, -r * 0.6, 0, r * 0.35, r * 0.15, '#6a3d85');
      ellipse(x, 0, 0, r * 0.5, r * 0.32, shade(x, 0, 0, r * 0.5, '#e0b4c8', '#8a5a70'));
      circle(x, r * 0.45, 0, r * 0.25, shade(x, r * 0.45, 0, r * 0.25, '#f0c8d8', '#9a6a80'));
      poly(x, [[r * 0.65, -r * 0.07], [r * 0.9, 0], [r * 0.65, r * 0.07]], '#f2c14e');
      ellipse(x, r * 0.3, 0, r * 0.2, r * 0.22, '#5a2a70');
    },
    shaman(x, r, f) {
      const leg = f ? 1 : -1;
      ellipse(x, leg * r * 0.12, -r * 0.38, r * 0.18, r * 0.12, '#3c5b36');
      ellipse(x, -leg * r * 0.12, r * 0.38, r * 0.18, r * 0.12, '#3c5b36');
      circle(x, 0, 0, r * 0.66, shade(x, 0, 0, r * 0.66, '#9a6bc0', '#3d2456'));
      // feathers
      for (let i = -2; i <= 2; i++) ellipse(x, -r * 0.45, i * r * 0.13, r * 0.25, r * 0.06, ['#e74c3c', '#f1c40f', '#2ecc71'][(i + 2) % 3], i * 0.2);
      // staff
      line(x, -r * 0.2, r * 0.6, r * 1.1, r * 0.6, '#6e4b2a', r * 0.1);
      circle(x, r * 1.15, r * 0.6, r * 0.18, '#7ff9e5');
      circle(x, r * 0.35, 0, r * 0.32, shade(x, r * 0.35, 0, r * 0.32, '#8ccf84', '#3f7a3a'));
      ellipse(x, r * 0.3, 0, r * 0.36, r * 0.2, 'rgba(255,255,255,0.85)');
      circle(x, r * 0.55, -r * 0.1, r * 0.05, '#222'); circle(x, r * 0.55, r * 0.1, r * 0.05, '#222');
    },
    ogre(x, r, f) {
      const leg = f ? 1 : -1;
      ellipse(x, leg * r * 0.15, -r * 0.48, r * 0.24, r * 0.17, '#6b4a2a');
      ellipse(x, -leg * r * 0.15, r * 0.48, r * 0.24, r * 0.17, '#6b4a2a');
      ellipse(x, -r * 0.05, 0, r * 0.75, r * 0.8, shade(x, 0, 0, r * 0.8, '#d6ad7b', '#7c5a35'));
      ellipse(x, -r * 0.1, 0, r * 0.5, r * 0.55, 'rgba(120,80,40,0.35)');
      line(x, -r * 0.35, -r * 0.75, -r * 0.35, r * 0.75, '#5a3a1a', r * 0.12, 'butt');
      // arms
      circle(x, r * 0.3, -r * 0.7, r * 0.24, '#c49a6c');
      circle(x, r * 0.35, r * 0.72, r * 0.26, '#c49a6c');
      // club
      line(x, r * 0.35, r * 0.72, r * 1.3, r * 0.55, '#5a3a20', r * 0.2);
      circle(x, r * 1.3, r * 0.55, r * 0.26, shade(x, r * 1.3, r * 0.55, r * 0.26, '#8a6040', '#4a2a10'));
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; circle(x, r * 1.3 + Math.cos(a) * r * 0.26, r * 0.55 + Math.sin(a) * r * 0.26, r * 0.05, '#ccc'); }
      circle(x, r * 0.45, 0, r * 0.3, shade(x, r * 0.45, 0, r * 0.3, '#dcb688', '#8a6640'));
      circle(x, r * 0.62, -r * 0.1, r * 0.05, '#222'); circle(x, r * 0.62, r * 0.1, r * 0.05, '#222');
      line(x, r * 0.68, -r * 0.08, r * 0.78, -r * 0.14, '#fff', 2); line(x, r * 0.68, r * 0.08, r * 0.78, r * 0.14, '#fff', 2);
    },
    wraith(x, r, f) {
      const w = f ? 1 : -1;
      x.globalAlpha = 0.75;
      for (let i = 0; i < 4; i++) {
        const yy = (i - 1.5) * r * 0.28;
        x.beginPath(); x.moveTo(-r * 0.2, yy);
        x.quadraticCurveTo(-r * 0.8, yy + w * r * 0.25 * (i % 2 ? 1 : -1), -r * 1.35, yy * 1.4);
        x.strokeStyle = 'rgba(140,230,255,0.6)'; x.lineWidth = r * 0.16; x.lineCap = 'round'; x.stroke();
      }
      ellipse(x, -r * 0.1, 0, r * 0.7, r * 0.6, shade(x, 0, 0, r * 0.7, 'rgba(200,250,255,0.95)', 'rgba(60,150,200,0.7)'));
      x.globalAlpha = 1;
      circle(x, r * 0.35, 0, r * 0.36, '#16213a');
      ellipse(x, r * 0.15, 0, r * 0.3, r * 0.4, 'rgba(120,200,240,0.8)');
      circle(x, r * 0.5, -r * 0.12, r * 0.07, '#b8fbff'); circle(x, r * 0.5, r * 0.12, r * 0.07, '#b8fbff');
      // scythe
      line(x, -r * 0.1, -r * 0.65, r * 0.9, -r * 0.65, '#3a3a4a', r * 0.08);
      x.beginPath(); x.arc(r * 0.9, -r * 0.3, r * 0.38, -Math.PI / 2, Math.PI * 0.2);
      x.strokeStyle = '#d5e6f0'; x.lineWidth = r * 0.1; x.stroke();
    },
    drake(x, r, f, boss) {
      const flap = f ? 1 : 0.6;
      const c1 = boss ? '#4a2f6b' : '#b8322b', c2 = boss ? '#1c1030' : '#5a1510', m = boss ? '#2e1d48' : '#8a2620';
      // tail
      x.beginPath(); x.moveTo(-r * 0.4, 0);
      x.quadraticCurveTo(-r * 1.1, (f ? 0.3 : -0.3) * r, -r * 1.6, 0);
      x.strokeStyle = c1; x.lineWidth = r * 0.22; x.lineCap = 'round'; x.stroke();
      poly(x, [[-r * 1.6, 0], [-r * 1.85, -r * 0.15], [-r * 1.8, r * 0.15]], c2);
      for (const side of [-1, 1]) {
        const pts = [[r * 0.25, side * r * 0.2], [r * 0.05, side * r * 1.5 * flap], [-r * 0.35, side * r * 1.6 * flap], [-r * 0.5, side * r * 1.1 * flap], [-r * 0.65, side * r * 0.7 * flap], [-r * 0.35, side * r * 0.2]];
        poly(x, pts, m, c2, 1.5);
        for (let i = 0; i < 3; i++) line(x, r * 0.15, side * r * 0.25, -r * (0.15 + i * 0.18), side * r * (1.5 - i * 0.25) * flap, c2, 1.5);
      }
      ellipse(x, 0, 0, r * 0.62, r * 0.38, shade(x, 0, 0, r * 0.6, shadeColor(c1, 0.25), c2));
      ellipse(x, 0, 0, r * 0.35, r * 0.15, boss ? 'rgba(242,193,78,0.6)' : 'rgba(255,190,90,0.6)');
      line(x, r * 0.4, 0, r * 0.8, 0, c1, r * 0.22);
      ellipse(x, r * 0.92, 0, r * 0.26, r * 0.18, shade(x, r * 0.92, 0, r * 0.25, shadeColor(c1, 0.2), c2));
      poly(x, [[r * 0.8, -r * 0.12], [r * 0.6, -r * 0.35], [r * 0.85, -r * 0.18]], boss ? '#f2c14e' : '#eee');
      poly(x, [[r * 0.8, r * 0.12], [r * 0.6, r * 0.35], [r * 0.85, r * 0.18]], boss ? '#f2c14e' : '#eee');
      circle(x, r * 1.0, -r * 0.08, r * 0.04, '#ffdd33'); circle(x, r * 1.0, r * 0.08, r * 0.04, '#ffdd33');
    },
    titan(x, r, f) {
      const leg = f ? 1 : -1;
      ellipse(x, leg * r * 0.15, -r * 0.5, r * 0.26, r * 0.18, '#2c2e35');
      ellipse(x, -leg * r * 0.15, r * 0.5, r * 0.26, r * 0.18, '#2c2e35');
      circle(x, 0, 0, r * 0.8, shade(x, 0, 0, r * 0.8, '#6a6e7a', '#24262c'));
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; circle(x, Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65, r * 0.07, '#9aa0ad'); }
      circle(x, 0, 0, r * 0.28, glowFill(x, 0, 0, r * 0.28, '#ffb347'));
      for (const s of [-1, 1]) {
        circle(x, r * 0.25, s * r * 0.82, r * 0.32, shade(x, r * 0.25, s * r * 0.82, r * 0.32, '#7d828f', '#2c2e35'));
        poly(x, [[r * 0.2, s * r * 0.95], [r * 0.05, s * r * 1.35], [r * 0.4, s * r * 1.05]], '#c9ced6');
      }
      circle(x, r * 0.55, 0, r * 0.28, shade(x, r * 0.55, 0, r * 0.28, '#7d828f', '#2c2e35'));
      poly(x, [[r * 0.5, -r * 0.2], [r * 0.3, -r * 0.55], [r * 0.6, -r * 0.25]], '#e8e2d0');
      poly(x, [[r * 0.5, r * 0.2], [r * 0.3, r * 0.55], [r * 0.6, r * 0.25]], '#e8e2d0');
      line(x, r * 0.68, -r * 0.1, r * 0.68, r * 0.1, '#ff8c1a', 3);
    },
    abomination(x, r, f) {
      const leg = f ? 1 : -1;
      ellipse(x, leg * r * 0.15, -r * 0.55, r * 0.24, r * 0.17, '#5a6e4a');
      ellipse(x, -leg * r * 0.15, r * 0.55, r * 0.24, r * 0.17, '#5a6e4a');
      ellipse(x, -r * 0.05, 0, r * 0.8, r * 0.85, shade(x, 0, 0, r * 0.85, '#b4cf9c', '#566b47'));
      for (let i = 0; i < 4; i++) {
        const yy = -r * 0.5 + i * r * 0.33;
        line(x, -r * 0.4, yy, r * 0.2, yy + r * 0.12, '#4a2a2a', 2);
        for (let k = 0; k < 4; k++) line(x, -r * 0.35 + k * r * 0.17, yy - 3, -r * 0.33 + k * r * 0.17, yy + r * 0.04 + 3, '#4a2a2a', 1);
      }
      circle(x, r * 0.1, r * 0.2, r * 0.18, 'rgba(160,40,40,0.6)');
      // cleaver + hook
      line(x, r * 0.35, r * 0.75, r * 1.1, r * 0.75, '#5a3a20', r * 0.1);
      poly(x, [[r * 0.9, r * 0.55], [r * 1.45, r * 0.55], [r * 1.45, r * 0.95], [r * 0.9, r * 0.9]], '#b9c0c8', '#444', 1);
      line(x, r * 0.35, -r * 0.75, r * 1.0, -r * 0.8, '#555', r * 0.06);
      x.beginPath(); x.arc(r * 1.1, -r * 0.65, r * 0.18, Math.PI, Math.PI * 2.4); x.strokeStyle = '#999'; x.lineWidth = r * 0.07; x.stroke();
      circle(x, r * 0.5, 0, r * 0.26, shade(x, r * 0.5, 0, r * 0.26, '#c4dcae', '#6a8058'));
      circle(x, r * 0.65, -r * 0.08, r * 0.05, '#ff3030'); circle(x, r * 0.63, r * 0.1, r * 0.04, '#ff3030');
    },
  };
  C.warlord = (x, r, f) => C.gnoll(x, r, f, true);
  C.broodmother = (x, r, f) => C.spider(x, r, f, true);
  C.dragon = (x, r, f) => C.drake(x, r, f, true);
  function glowFill(x, cx, cy, r, color) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  }

  const SPR_SCALE = 2;
  const sprCache = {};
  function creepSprite(type, frame) {
    const key = type + frame;
    if (sprCache[key]) return sprCache[key];
    const r = CREEPS[type].radius;
    const span = r * 4.2;
    const c = mk(span * SPR_SCALE, span * SPR_SCALE), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.scale(SPR_SCALE, SPR_SCALE);
    C[type](x, r, frame);
    c.span = span;
    return (sprCache[key] = c);
  }
  // icon (facing up-right) for UI
  function creepIcon(type, size) {
    const c = mk(size, size), x = c.getContext('2d');
    const r = CREEPS[type].radius;
    const span = r * 3.6;
    x.translate(size / 2, size / 2); x.scale(size / span, size / span); x.rotate(-Math.PI / 4);
    C[type](x, r, 0);
    return c;
  }

  // ------------------------------------------------------------- heroes
  // drawn each frame. ctx already translated to hero pos & rotated to facing.
  function drawHero(x, h, t, r) {
    const id = h.def.id;
    const atk = Math.max(0, h.animAtk || 0);
    const swing = Math.sin((1 - atk) * Math.PI) * (atk > 0 ? 1 : 0);
    const step = Math.sin(h.walk || 0);
    const col = h.def.color, acc = h.def.accent;
    // feet
    if (h.moving) {
      ellipse(x, step * r * 0.25, -r * 0.42, r * 0.2, r * 0.13, '#2a2420');
      ellipse(x, -step * r * 0.25, r * 0.42, r * 0.2, r * 0.13, '#2a2420');
    }
    if (id === 'warden') {
      // cape
      poly(x, [[-r * 0.2, -r * 0.7], [-r * 1.15, -r * 0.55 + step * 3], [-r * 1.2, r * 0.55 - step * 3], [-r * 0.2, r * 0.7]], '#2f5fa8', '#1b3a6a', 1.5);
      // shield (left = -y)
      circle(x, r * 0.35, -r * 0.78, r * 0.5, shade(x, r * 0.35, -r * 0.78, r * 0.5, '#f7d77a', '#a67c1a'), '#5a4010', 2);
      circle(x, r * 0.35, -r * 0.78, r * 0.2, '#2f5fa8');
      // body
      circle(x, 0, 0, r * 0.78, shade(x, 0, 0, r * 0.78, '#e6edf5', '#6b7c90'), '#3a4656', 1.5);
      for (const s of [-1, 1]) ellipse(x, 0, s * r * 0.6, r * 0.4, r * 0.28, shade(x, 0, s * r * 0.6, r * 0.4, '#f2f6fa', '#7c8ea2'), 0, '#3a4656', 1);
      // hammer arm
      const a = -0.9 + swing * 1.9;
      x.save(); x.rotate(a);
      line(x, 0, r * 0.6, r * 1.55, r * 0.6, '#6b4a2a', r * 0.14);
      x.fillStyle = shade(x, r * 1.55, r * 0.6, r * 0.4, '#d9dee5', '#5d6670');
      x.fillRect(r * 1.35, r * 0.25, r * 0.42, r * 0.72);
      x.strokeStyle = '#333'; x.lineWidth = 1; x.strokeRect(r * 1.35, r * 0.25, r * 0.42, r * 0.72);
      x.restore();
      // helmet
      circle(x, r * 0.1, 0, r * 0.42, shade(x, r * 0.1, 0, r * 0.42, '#f4f7fa', '#7d8a98'), '#3a4656', 1);
      ellipse(x, r * 0.05, 0, r * 0.4, r * 0.08, acc);
      line(x, r * 0.4, -r * 0.1, r * 0.4, r * 0.1, '#222', 2);
    } else if (id === 'shade') {
      poly(x, [[-r * 0.2, -r * 0.6], [-r * 1.3, -r * 0.35 + step * 4], [-r * 1.0, 0], [-r * 1.3, r * 0.35 - step * 4], [-r * 0.2, r * 0.6]], '#2a1840', '#120a20', 1);
      circle(x, 0, 0, r * 0.7, shade(x, 0, 0, r * 0.7, '#6a4a9a', '#22143a'), '#120a20', 1.5);
      for (const s of [-1, 1]) {
        const a = s * (0.6 - (s > 0 ? swing : swing * 0.6) * 1.2);
        x.save(); x.rotate(a);
        line(x, r * 0.2, s * r * 0.55, r * 0.55, s * r * 0.55, '#3a2a20', r * 0.12);
        x.shadowColor = '#c59bff'; x.shadowBlur = 8;
        poly(x, [[r * 0.55, s * r * 0.45], [r * 1.45, s * r * 0.55], [r * 0.55, s * r * 0.65]], '#e8dcff');
        x.shadowBlur = 0;
        x.restore();
      }
      circle(x, r * 0.15, 0, r * 0.4, shade(x, r * 0.15, 0, r * 0.4, '#3a2a5a', '#0e0818'));
      circle(x, r * 0.38, -r * 0.12, r * 0.06, '#d6b3ff'); circle(x, r * 0.38, r * 0.12, r * 0.06, '#d6b3ff');
    } else if (id === 'ranger') {
      poly(x, [[-r * 0.2, -r * 0.65], [-r * 1.15, -r * 0.45 + step * 3], [-r * 1.2, r * 0.45 - step * 3], [-r * 0.2, r * 0.65]], '#2f6a34', '#1a3f1d', 1);
      // quiver
      ellipse(x, -r * 0.55, r * 0.35, r * 0.4, r * 0.14, '#6b4423', 0.5);
      for (let i = 0; i < 3; i++) line(x, -r * 0.9, r * 0.1 + i * 4, -r * 1.05, -r * 0.0 + i * 4, '#f0f0f0', 1.5);
      circle(x, 0, 0, r * 0.7, shade(x, 0, 0, r * 0.7, '#7bc47f', '#2d5e31'), '#1a3f1d', 1.5);
      // bow
      const pull = swing * r * 0.35;
      x.beginPath(); x.arc(r * 0.3, 0, r * 0.95, -1.15, 1.15);
      x.strokeStyle = '#8a5a2b'; x.lineWidth = r * 0.14; x.stroke();
      const bx = r * 0.3 + Math.cos(1.15) * r * 0.95, by = Math.sin(1.15) * r * 0.95;
      x.beginPath(); x.moveTo(bx, -by); x.lineTo(r * 0.3 - pull, 0); x.lineTo(bx, by);
      x.strokeStyle = '#eee'; x.lineWidth = 1; x.stroke();
      if (atk > 0.3) line(x, r * 0.3 - pull, 0, r * 1.3, 0, '#f5e6c8', 2);
      circle(x, r * 0.1, 0, r * 0.4, shade(x, r * 0.1, 0, r * 0.4, '#4f9a55', '#1f4a24'));
      ellipse(x, r * 0.32, 0, r * 0.12, r * 0.2, '#f1c9a5');
    } else if (id === 'pyro') {
      circle(x, -r * 0.15, 0, r * 0.85, shade(x, -r * 0.15, 0, r * 0.85, '#c0392b', '#5a120a'), '#3a0a05', 1.5);
      ellipse(x, -r * 0.2, 0, r * 0.55, r * 0.2, '#f2c14e');
      const a = 0.5 - swing * 0.6;
      x.save(); x.rotate(a);
      line(x, -r * 0.3, r * 0.65, r * 1.3, r * 0.65, '#4a2a14', r * 0.12);
      x.drawImage(glow('rgba(255,140,30,0.9)'), r * 1.3 - r * 0.7, r * 0.65 - r * 0.7, r * 1.4, r * 1.4);
      circle(x, r * 1.3, r * 0.65, r * 0.16, '#fff3b0');
      x.restore();
      circle(x, r * 0.15, 0, r * 0.4, shade(x, r * 0.15, 0, r * 0.4, '#a32a1e', '#4a0c06'));
      ellipse(x, r * 0.38, 0, r * 0.1, r * 0.18, '#f1c9a5');
      circle(x, r * 0.4, -r * 0.55, r * 0.14, '#ffb347');
    } else if (id === 'oracle') {
      circle(x, -r * 0.15, 0, r * 0.85, shade(x, -r * 0.15, 0, r * 0.85, '#f4fbff', '#6aa8c8'), '#2a5a78', 1.5);
      ellipse(x, -r * 0.25, 0, r * 0.6, r * 0.14, '#6fd3f2');
      const a = 0.45 - swing * 0.6;
      x.save(); x.rotate(a);
      line(x, -r * 0.3, r * 0.65, r * 1.3, r * 0.65, '#cfe8f5', r * 0.1);
      poly(x, [[r * 1.3, r * 0.4], [r * 1.55, r * 0.65], [r * 1.3, r * 0.9], [r * 1.12, r * 0.65]], '#aef0ff', '#3aa0c8', 1);
      x.drawImage(glow('rgba(120,220,255,0.7)'), r * 1.35 - r * 0.6, r * 0.65 - r * 0.6, r * 1.2, r * 1.2);
      x.restore();
      circle(x, r * 0.15, 0, r * 0.38, shade(x, r * 0.15, 0, r * 0.38, '#ffffff', '#9ccbe0'));
      ellipse(x, r * 0.38, 0, r * 0.1, r * 0.17, '#f6dcc8');
      // orbiting shards
      for (let i = 0; i < 3; i++) {
        const oa = t * 2 + i * TAU / 3;
        x.save(); x.rotate(-h.facing); // keep orbit world aligned
        poly(x, [[Math.cos(oa) * r * 1.3, Math.sin(oa) * r * 1.3 - 5], [Math.cos(oa) * r * 1.3 + 3, Math.sin(oa) * r * 1.3], [Math.cos(oa) * r * 1.3, Math.sin(oa) * r * 1.3 + 5], [Math.cos(oa) * r * 1.3 - 3, Math.sin(oa) * r * 1.3]], 'rgba(190,245,255,0.9)');
        x.restore();
      }
    } else if (id === 'berserker') {
      circle(x, 0, 0, r * 0.8, shade(x, 0, 0, r * 0.8, '#e0a87a', '#7a4a2a'), '#3a1a0a', 1.5);
      line(x, -r * 0.5, -r * 0.5, r * 0.3, r * 0.5, 'rgba(180,30,30,0.85)', r * 0.12);
      ellipse(x, -r * 0.35, 0, r * 0.25, r * 0.7, '#5a3a1a');
      for (const s of [-1, 1]) {
        const ph = s > 0 ? swing : Math.max(0, swing - 0.3) * 1.4;
        const a = s * (0.7 - ph * 1.5);
        x.save(); x.rotate(a);
        circle(x, r * 0.25, s * r * 0.7, r * 0.26, '#d89a6a');
        line(x, r * 0.25, s * r * 0.7, r * 1.35, s * r * 0.7, '#4a2a14', r * 0.12);
        x.beginPath(); x.moveTo(r * 1.1, s * r * 0.7); x.quadraticCurveTo(r * 1.35, s * r * 1.25, r * 1.6, s * r * 0.7); x.closePath();
        x.fillStyle = '#c9ced6'; x.fill(); x.strokeStyle = '#555'; x.lineWidth = 1; x.stroke();
        x.restore();
      }
      circle(x, r * 0.25, 0, r * 0.36, shade(x, r * 0.25, 0, r * 0.36, '#e8b088', '#8a5634'));
      ellipse(x, r * 0.15, 0, r * 0.36, r * 0.08, '#c0392b');
      line(x, r * 0.45, -r * 0.12, r * 0.45, r * 0.12, 'rgba(180,20,20,0.9)', 2);
    }
  }

  // portrait for menus / HUD
  function heroPortrait(defId, size) {
    const c = mk(size, size), x = c.getContext('2d');
    const bg = x.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.7);
    const def = HERO_BY_ID[defId];
    bg.addColorStop(0, shadeColor(def.color, 0.1)); bg.addColorStop(1, shadeColor(def.color, -0.75));
    x.fillStyle = bg; x.fillRect(0, 0, size, size);
    const fake = { def, animAtk: 0.5, walk: 0, moving: false, facing: -Math.PI / 2 };
    x.translate(size / 2, size * 0.55);
    x.rotate(-Math.PI / 2);
    drawHero(x, fake, 0, size * 0.3);
    return c;
  }

  return { buildTerrain, creepSprite, creepIcon, drawHero, heroPortrait, glow, soft, circle, ellipse, line, poly, shadeColor, mk, SPR_SCALE };
})();
