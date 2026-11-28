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
  // ------------------------------------------------------------- terrain
  function nearPath(x, y, pad) {
    for (let i = 1; i < PATH.length; i++) {
      if (U.segDist(x, y, PATH[i - 1][0], PATH[i - 1][1], PATH[i][0], PATH[i][1]).d < pad) return true;
    }
    return false;
  }
  function pathDist(x, y) {
    let m = Infinity;
    for (let i = 1; i < PATH.length; i++) m = Math.min(m, U.segDist(x, y, PATH[i - 1][0], PATH[i - 1][1], PATH[i][0], PATH[i][1]).d);
    return m;
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
  function pathTrace(x) {
    x.beginPath();
    x.moveTo(PATH[0][0], PATH[0][1]);
    for (let i = 1; i < PATH.length; i++) x.lineTo(PATH[i][0], PATH[i][1]);
  }
  function strokePath(x, w, color) {
    pathTrace(x);
    x.lineWidth = w; x.strokeStyle = color; x.lineJoin = 'round'; x.lineCap = 'round';
    x.stroke();
  }

  // value noise (seeded, fractal)
  function makeNoise(seed) {
    const R = rng(seed), vals = new Float32Array(256), perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) { vals[i] = R(); perm[i] = i; }
    for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const h = (i, j) => vals[perm[(perm[i & 255] + j) & 255]];
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    return (x, y, oct = 4) => {
      let amp = 1, f = 1, s = 0, n = 0;
      for (let o = 0; o < oct; o++) { s += n2(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; }
      return s / n;
    };
  }
  // low-res colour field upscaled smoothly
  function fieldCanvas(w, h, cell, fn) {
    const cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
    const c = mk(cw, ch), x = c.getContext('2d');
    const img = x.createImageData(cw, ch), d = img.data;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const col = fn(i * cell, j * cell), k = (j * cw + i) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col[3] === undefined ? 255 : col[3];
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function drawRock(x, cx, cy, s, R) {
    x.drawImage(soft('rgba(0,0,0,0.55)'), cx - s * 1.1 + s * 0.3, cy - s * 0.7 + s * 0.35, s * 2.2, s * 1.4);
    const pts = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, rr = s * (0.72 + R() * 0.32);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.78]);
    }
    poly(x, pts, shade(x, cx, cy, s, '#b9b5aa', '#4d4a45'), 'rgba(30,28,25,0.6)', 1.2);
    // facet highlight + crack
    poly(x, [pts[4], pts[5], pts[6], [cx - s * 0.1, cy - s * 0.1]], 'rgba(255,255,255,0.13)');
    line(x, cx - s * 0.2, cy - s * 0.05, cx + s * 0.25, cy + s * 0.2, 'rgba(40,35,30,0.45)', 1);
    if (R() < 0.6) ellipse(x, cx + s * (R() - 0.5) * 0.6, cy - s * 0.25, s * 0.38, s * 0.2, 'rgba(96,140,60,0.75)');
  }
  function drawBush(x, cx, cy, s, R) {
    x.drawImage(soft('rgba(0,0,0,0.5)'), cx - s * 1.2 + s * 0.3, cy - s * 0.8 + s * 0.4, s * 2.4, s * 1.6);
    const base = ['#2f6a2c', '#3a7533', '#2c5f35'][(R() * 3) | 0];
    for (let i = 0; i < 6; i++) {
      const a = R() * TAU, d = R() * s * 0.45;
      const bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d;
      circle(x, bx, by, s * (0.4 + R() * 0.2), shade(x, bx, by, s * 0.5, shadeColor(base, 0.22), shadeColor(base, -0.3)));
    }
    if (R() < 0.5) {
      const bc = R() < 0.5 ? '#d8344a' : '#4a62d8';
      for (let i = 0; i < 6; i++) circle(x, cx + (R() - 0.5) * s, cy + (R() - 0.5) * s * 0.8, 1.8, bc);
    }
  }
  function drawMushrooms(x, cx, cy, R) {
    const n = 5 + (R() * 6 | 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, rr = 18 + R() * 6;
      const mx = cx + Math.cos(a) * rr, my = cy + Math.sin(a) * rr * 0.8;
      ellipse(x, mx + 1.5, my + 2, 4, 2.4, 'rgba(0,0,0,0.3)');
      circle(x, mx, my, 3.6, shade(x, mx, my, 3.6, '#ffb08a', '#b23a2a'));
      circle(x, mx - 1, my - 1, 0.8, '#fff2e0');
    }
  }
  function drawLog(x, cx, cy, R) {
    const ang = R() * Math.PI, len = 40 + R() * 30;
    x.save(); x.translate(cx, cy); x.rotate(ang);
    x.drawImage(soft('rgba(0,0,0,0.5)'), -len / 2 - 8 + 4, -14 + 5, len + 16, 28);
    const g = x.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, '#9a6b3f'); g.addColorStop(0.5, '#6e4a2a'); g.addColorStop(1, '#3e2915');
    x.fillStyle = g; x.fillRect(-len / 2, -8, len, 16);
    for (let i = 0; i < 4; i++) line(x, -len / 2 + 6 + i * len / 4, -6, -len / 2 + 14 + i * len / 4, 5, 'rgba(40,25,10,0.5)', 1);
    ellipse(x, len / 2, 0, 4, 8, '#c49a6a', 0, '#6e4a2a', 1.5);
    circle(x, len / 2, 0, 2.5, '#9a6b3f');
    ellipse(x, -len / 4, -7, 7, 3, 'rgba(96,140,60,0.8)');
    x.restore();
  }
  function drawPillar(x, cx, cy, R) {
    x.drawImage(soft('rgba(0,0,0,0.55)'), cx - 20 + 10, cy - 14 + 10, 40, 28);
    circle(x, cx, cy, 15, shade(x, cx, cy, 15, '#d4ccbb', '#7a7264'), '#4d473d', 1.5);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; line(x, cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 'rgba(80,72,60,0.6)', 1); }
    circle(x, cx, cy, 8, 'rgba(255,255,255,0.12)');
    // fallen chunk
    const a = R() * TAU;
    const fx = cx + Math.cos(a) * 30, fy = cy + Math.sin(a) * 24;
    x.save(); x.translate(fx, fy); x.rotate(a);
    x.drawImage(soft('rgba(0,0,0,0.45)'), -16, -8, 36, 22);
    x.fillStyle = shade(x, 0, 0, 14, '#cfc7b6', '#7a7264'); x.fillRect(-14, -9, 28, 18);
    x.strokeStyle = '#4d473d'; x.lineWidth = 1.2; x.strokeRect(-14, -9, 28, 18);
    x.restore();
    if (R() < 0.7) ellipse(x, cx + 6, cy - 6, 6, 3, 'rgba(96,140,60,0.8)');
  }

  // canopy (drawn on the overlay layer, above units)
  function drawCanopy(x, cx, cy, s, R, kind) {
    if (kind === 'pine') {
      for (let l = 0; l < 4; l++) {
        const rr = s * (1 - l * 0.2), pts = [], n = 10;
        for (let i = 0; i < n * 2; i++) {
          const a = i / (n * 2) * TAU + l * 0.35;
          const rad = i % 2 ? rr * 0.6 : rr * (0.92 + R() * 0.1);
          pts.push([cx + Math.cos(a) * rad - l * s * 0.03, cy + Math.sin(a) * rad - l * s * 0.06]);
        }
        const c = ['#173d22', '#1f4f2b', '#296235', '#357642'][l];
        poly(x, pts, c, l === 0 ? 'rgba(8,20,10,0.7)' : null, 1.5);
      }
      circle(x, cx - s * 0.12, cy - s * 0.25, s * 0.14, '#4c9655');
    } else {
      const base = ['#2a5c27', '#336a2c', '#3c7631', '#2d6634', '#45732a'][(R() * 5) | 0];
      const blobs = 6 + Math.floor(R() * 3);
      const bl = [];
      for (let i = 0; i < blobs; i++) {
        const a = R() * TAU, d = R() * s * 0.45;
        bl.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * (0.42 + R() * 0.22)]);
      }
      // dark outline & under-layer
      for (const b of bl) circle(x, b[0], b[1], b[2] + 2, 'rgba(10,25,8,0.8)');
      for (const b of bl) circle(x, b[0], b[1], b[2], shadeColor(base, -0.25));
      for (const b of bl) {
        const bx = b[0] - s * 0.1, by = b[1] - s * 0.13;
        circle(x, bx, by, b[2] * 0.8, shade(x, bx, by, b[2] * 0.9, shadeColor(base, 0.25), base));
      }
      // leaf clusters + sun highlights
      for (let i = 0; i < 22; i++) {
        const a = R() * TAU, d = R() * s * 0.75;
        const lx = cx + Math.cos(a) * d - s * 0.12, ly = cy + Math.sin(a) * d - s * 0.16;
        circle(x, lx, ly, s * (0.05 + R() * 0.05), R() < 0.5 ? 'rgba(170,225,120,0.28)' : 'rgba(20,50,15,0.3)');
      }
      if (R() < 0.25) for (let i = 0; i < 5; i++) circle(x, cx + (R() - 0.5) * s, cy + (R() - 0.5) * s, 2.5, R() < 0.5 ? '#f05a5a' : '#ffe17a');
    }
  }

  function drawPond(x, cx, cy, r, R, N) {
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU;
      const rr = r * (0.75 + N(Math.cos(a) * 2 + cx * 0.01, Math.sin(a) * 2 + cy * 0.01, 2) * 0.5);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.78]);
    }
    const expand = (k) => pts.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
    poly(x, expand(1.18), 'rgba(110,90,60,0.85)');
    poly(x, expand(1.08), '#5d5236');
    const g = x.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#3f9ac0'); g.addColorStop(0.7, '#1f5f86'); g.addColorStop(1, '#173e58');
    poly(x, pts, g);
    // shore stones
    for (let i = 0; i < 18; i++) {
      const p = pts[(R() * pts.length) | 0], s = 3 + R() * 5;
      const px = cx + (p[0] - cx) * 1.1, py = cy + (p[1] - cy) * 1.1;
      ellipse(x, px, py, s, s * 0.7, shade(x, px, py, s, '#c9c3b3', '#6d675b'));
    }
    // lily pads
    for (let i = 0; i < 7; i++) {
      const a = R() * TAU, d = R() * r * 0.6;
      const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d * 0.75, s = 6 + R() * 6;
      x.beginPath(); x.moveTo(lx, ly); x.arc(lx, ly, s, a + 0.3, a + TAU - 0.3); x.closePath();
      x.fillStyle = '#4f9a3c'; x.fill(); x.strokeStyle = '#2e6a25'; x.lineWidth = 1; x.stroke();
      if (R() < 0.35) circle(x, lx, ly, 2.6, '#ffb0d8');
    }
    // reeds
    for (let i = 0; i < 26; i++) {
      const p = pts[(R() * pts.length) | 0];
      const px = cx + (p[0] - cx) * 1.12, py = cy + (p[1] - cy) * 1.12;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 0.9, l = 10 + R() * 12;
        line(x, px, py, px + Math.cos(a) * l, py + Math.sin(a) * l, R() < 0.5 ? '#6a8a3a' : '#88a04a', 1.6);
      }
    }
  }

  const PONDS = [{ x: 680, y: 1080, r: 95 }, { x: 1180, y: 1610, r: 80 }, { x: 1230, y: 420, r: 75 }];

  function buildTerrain(scale) {
    const c = mk(WORLD_W * scale, WORLD_H * scale), x = c.getContext('2d');
    const canopy = mk(WORLD_W, WORLD_H), cx2 = canopy.getContext('2d');
    x.scale(scale, scale);
    const R = rng(1337), N = makeNoise(7), N2 = makeNoise(99);

    // ---- ground colour field
    const lush = [34, 70, 30], mid = [68, 112, 44], light = [104, 142, 58], dry = [138, 132, 70], dark = [24, 48, 24];
    const ground = fieldCanvas(WORLD_W, WORLD_H, 6, (px, py) => {
      const n = N(px / 300, py / 300, 4), d = N2(px / 55, py / 55, 3), dr = N(px / 520 + 40, py / 520 + 17, 3);
      let col = n < 0.5 ? mixc(lush, mid, n / 0.5) : mixc(mid, light, (n - 0.5) / 0.5);
      if (dr > 0.6) col = mixc(col, dry, Math.min(1, (dr - 0.6) * 2.2));
      const pd = pathDist(px, py);
      if (pd < 150) col = mixc(col, [96, 120, 52], (1 - pd / 150) * 0.3); // trampled near road
      const edge = Math.min(px, WORLD_W - px, py) / 160;
      if (edge < 1) col = mixc(dark, col, Math.max(0, edge));
      const k = 0.85 + d * 0.3;
      return [col[0] * k, col[1] * k, col[2] * k];
    });
    x.imageSmoothingEnabled = true;
    x.drawImage(ground, 0, 0, WORLD_W, WORLD_H);

    // ---- grass blades (batched)
    const gcol = ['#4f7f38', '#5c8f40', '#3a6429', '#6b9a48', '#456f31', '#2f5524', '#7aa84f'];
    const gb = gcol.map(() => [new Path2D(), new Path2D()]);
    for (let i = 0; i < 32000; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H;
      if (pathDist(px, py) < 64) continue;
      const len = 3 + R() * 7, a = -Math.PI / 2 + (R() - 0.5) * 1.2;
      const path = gb[(R() * gcol.length) | 0][R() < 0.5 ? 0 : 1];
      path.moveTo(px, py); path.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    }
    x.lineCap = 'round'; x.lineWidth = 1.4;
    gcol.forEach((col, k) => { x.strokeStyle = col; x.globalAlpha = 0.55; x.stroke(gb[k][0]); x.globalAlpha = 0.9; x.stroke(gb[k][1]); });
    x.globalAlpha = 1;

    // ---- road: soft AO edge, dirt texture clipped to the road shape, stone edging
    x.save();
    x.shadowColor = 'rgba(10,8,4,0.7)'; x.shadowBlur = 22 * scale;
    strokePath(x, 160, 'rgba(60,45,28,0.9)');
    x.restore();
    const mask = mk(WORLD_W * scale, WORLD_H * scale), mx = mask.getContext('2d');
    mx.scale(scale, scale);
    strokePath(mx, 152, '#fff');
    mx.globalCompositeOperation = 'source-in';
    const dirt = fieldCanvas(WORLD_W, WORLD_H, 5, (px, py) => {
      const n = N2(px / 90, py / 90, 4), d = N(px / 18, py / 18, 2);
      const col = mixc([104, 80, 52], [158, 128, 88], n);
      const k = 0.82 + d * 0.32;
      return [col[0] * k, col[1] * k, col[2] * k];
    });
    mx.imageSmoothingEnabled = true;
    mx.drawImage(dirt, 0, 0, WORLD_W, WORLD_H);
    // worn centre + ruts
    mx.globalCompositeOperation = 'source-atop';
    strokePath(mx, 70, 'rgba(210,180,130,0.13)');
    for (const o of [-28, 28]) {
      mx.beginPath();
      for (let i = 0; i < PATH.length; i++) {
        const a = PATH[Math.max(0, i - 1)], b = PATH[Math.min(PATH.length - 1, i + 1)];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        const px = PATH[i][0] + Math.cos(ang) * o, py = PATH[i][1] + Math.sin(ang) * o;
        if (i === 0) mx.moveTo(px, py); else mx.lineTo(px, py);
      }
      mx.lineWidth = 10; mx.strokeStyle = 'rgba(55,40,22,0.22)'; mx.lineJoin = 'round'; mx.stroke();
    }
    // speckles
    const pcol = ['#a3845b', '#6f563a', '#94764f', '#7a5f40', '#b09068', '#c2a678'];
    const pb = pcol.map(() => new Path2D());
    for (let i = 0; i < 9000; i++) {
      const p = pointOnPath(R), off = (R() - 0.5) * 150;
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      const rx = 0.8 + R() * 2.4, ry = 0.8 + R() * 1.6;
      const path = pb[(R() * pcol.length) | 0];
      path.moveTo(px + rx, py); path.ellipse(px, py, rx, ry, 0, 0, TAU);
    }
    mx.globalAlpha = 0.55;
    pcol.forEach((col, k) => { mx.fillStyle = col; mx.fill(pb[k]); });
    mx.globalAlpha = 1;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(mask, 0, 0);
    x.setTransform(scale, 0, 0, scale, 0, 0);
    mask.width = mask.height = 1; // free memory
    // pebbles
    for (let i = 0; i < 380; i++) {
      const p = pointOnPath(R), off = (R() - 0.5) * 140;
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      const s = 1.5 + R() * 3.5;
      ellipse(x, px + 1, py + 1.5, s, s * 0.7, 'rgba(0,0,0,0.3)');
      ellipse(x, px, py, s, s * 0.7, shade(x, px, py, s, '#d6cebb', '#7a7262'));
    }
    // edging stones along both road borders
    for (let i = 0; i < 1300; i++) {
      const p = pointOnPath(R), side = R() < 0.5 ? -1 : 1, off = side * (74 + R() * 6);
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      if (py < 120 || py > WORLD_H - 140) continue;
      const s = 3.5 + R() * 4;
      ellipse(x, px + 1.5, py + 2, s * 1.1, s * 0.8, 'rgba(0,0,0,0.35)');
      ellipse(x, px, py, s * 1.1, s * 0.8, shade(x, px, py, s, '#bdb6a6', '#6a6458'), R() * 3);
    }
    // grass tufts overhanging the edges
    const tuft = new Path2D();
    for (let i = 0; i < 2200; i++) {
      const p = pointOnPath(R), side = R() < 0.5 ? -1 : 1, off = side * (66 + R() * 22);
      const px = p.x + Math.cos(p.ang + Math.PI / 2) * off, py = p.y + Math.sin(p.ang + Math.PI / 2) * off;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 1.5, len = 4 + R() * 8;
        tuft.moveTo(px, py); tuft.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      }
    }
    x.lineWidth = 1.6; x.strokeStyle = '#4f8236'; x.stroke(tuft);
    x.globalAlpha = 0.6; x.strokeStyle = '#7bab50'; x.lineWidth = 1; x.stroke(tuft); x.globalAlpha = 1;

    // ---- flowers (clusters)
    const fl = ['#f4f1de', '#f2cc4f', '#c88de0', '#ef8fa8', '#8fd0f0', '#ff9a5a'];
    for (let i = 0; i < 260; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H;
      if (nearPath(px, py, 100)) continue;
      const col = fl[(R() * fl.length) | 0];
      for (let k = 0; k < 7; k++) {
        const fx = px + (R() - 0.5) * 34, fy = py + (R() - 0.5) * 26;
        circle(x, fx + 0.6, fy + 0.8, 2.2, 'rgba(0,0,0,0.25)');
        circle(x, fx, fy, 2 + R() * 0.8, col);
        circle(x, fx, fy, 0.8, '#ffe680');
      }
    }

    // ---- fountain plaza
    const F = FOUNTAIN;
    x.drawImage(soft('rgba(0,0,0,0.6)'), F.x - 175, F.y - 165, 350, 340);
    circle(x, F.x, F.y, 146, '#5e5a52');
    circle(x, F.x, F.y, 142, shade(x, F.x, F.y, 142, '#aaa597', '#77736a'));
    for (let ring = 0; ring < 4; ring++) {
      const rr = 40 + ring * 26, n = 10 + ring * 7;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + ring;
        x.beginPath(); x.arc(F.x, F.y, rr + 12, a, a + TAU / n - 0.05);
        x.arc(F.x, F.y, rr - 12, a + TAU / n - 0.05, a, true); x.closePath();
        x.fillStyle = ['#9d988d', '#b2ada2', '#8d897f', '#a6a194'][(i + ring) % 4];
        x.fill();
        x.strokeStyle = 'rgba(40,35,30,0.45)'; x.lineWidth = 1.5; x.stroke();
      }
    }
    for (let i = 0; i < 8; i++) { // little pillars around the plaza
      const a = i / 8 * TAU + 0.2, px = F.x + Math.cos(a) * 150, py = F.y + Math.sin(a) * 150;
      if (py > F.y + 60 && Math.abs(px - F.x) < 90) continue;
      x.drawImage(soft('rgba(0,0,0,0.5)'), px - 10, py - 4, 26, 20);
      circle(x, px, py, 9, shade(x, px, py, 9, '#d8d2c4', '#7c776b'), '#4d473d', 1);
    }
    circle(x, F.x, F.y, 50, '#5d594f');
    circle(x, F.x, F.y, 46, shade(x, F.x, F.y, 46, '#8c877c', '#5d594f'));
    circle(x, F.x, F.y, 40, shade(x, F.x, F.y, 40, '#86dcff', '#165f8c'));

    // ---- spawn ring
    x.drawImage(soft('rgba(0,0,0,0.7)'), SPAWN.x - 120, 60 - 110, 240, 230);
    circle(x, SPAWN.x, 60, 88, '#3e3844');
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, px = SPAWN.x + Math.cos(a) * 80, py = 60 + Math.sin(a) * 80;
      circle(x, px, py, 12, shade(x, px, py, 12, '#948c9e', '#3a3442'), '#221d28', 1);
      if (i % 2) circle(x, px, py, 4, '#a06ad8');
    }
    circle(x, SPAWN.x, 60, 66, '#140b18');

    // ---- props
    const placed = [];
    const ok = (px, py, pad, own) => {
      if (nearPath(px, py, pad)) return false;
      if (U.dist(px, py, F.x, F.y) < 240) return false;
      if (U.dist(px, py, SPAWN.x, 60) < 170) return false;
      if (py > WORLD_H - 130) return false;
      for (const p of PONDS) if (U.dist(px, py, p.x, p.y) < p.r * 1.3 + own) return false;
      for (const p of placed) if (U.dist(px, py, p[0], p[1]) < p[2] + own) return false;
      return true;
    };
    for (const p of PONDS) drawPond(x, p.x, p.y, p.r, R, N);
    // ruins near bends
    for (const [px, py] of [[470, 560], [1130, 1060], [470, 1530], [1100, 760]]) {
      if (!ok(px, py, 95, 30)) continue;
      drawPillar(x, px, py, R); placed.push([px, py, 40]);
    }
    for (let i = 0; i < 26; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H;
      if (!ok(px, py, 100, 40)) continue;
      placed.push([px, py, 40]);
      const t = R();
      if (t < 0.4) drawLog(x, px, py, R); else drawMushrooms(x, px, py, R);
    }
    for (let i = 0; i < 120; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H, s = 7 + R() * 15;
      if (!ok(px, py, 96, s)) continue;
      placed.push([px, py, s]); drawRock(x, px, py, s, R);
    }
    for (let i = 0; i < 90; i++) {
      const px = R() * WORLD_W, py = R() * WORLD_H, s = 12 + R() * 12;
      if (!ok(px, py, 96, s)) continue;
      placed.push([px, py, s]); drawBush(x, px, py, s, R);
    }

    // ---- trees: shadows + trunks on the ground, canopies on the overlay
    const trees = [];
    const tryTree = (px, py, s) => {
      if (!ok(px, py, 112 + s * 0.4, s * 0.7)) return;
      trees.push([px, py, s, R() < 0.35 ? 'pine' : 'oak']);
      placed.push([px, py, s * 0.75]);
    };
    for (let i = 0; i < 320; i++) {
      const side = i % 4;
      let px, py;
      if (side === 0) { px = R() * 120; py = R() * WORLD_H; }
      else if (side === 1) { px = WORLD_W - R() * 120; py = R() * WORLD_H; }
      else if (side === 2) { px = R() * WORLD_W; py = R() * 100; }
      else { px = R() * WORLD_W; py = R() * WORLD_H; }
      tryTree(px, py, 34 + R() * 32);
    }
    // groves
    for (let g = 0; g < 12; g++) {
      const gx = R() * WORLD_W, gy = 150 + R() * (WORLD_H - 400);
      for (let k = 0; k < 7; k++) tryTree(gx + (R() - 0.5) * 160, gy + (R() - 0.5) * 140, 30 + R() * 24);
    }
    trees.sort((a, b) => a[1] - b[1]);
    for (const t of trees) {
      x.drawImage(soft('rgba(0,10,0,0.62)'), t[0] - t[2] * 1.25 + t[2] * 0.45, t[1] - t[2] * 1.0 + t[2] * 0.5, t[2] * 2.5, t[2] * 2.0);
      circle(x, t[0] + 2, t[1] + 4, t[2] * 0.2, '#3a2614');
      circle(x, t[0], t[1], t[2] * 0.16, '#5a3c20');
    }
    for (const t of trees) drawCanopy(cx2, t[0], t[1], t[2], R, t[3]);

    // ---- southern wall with gate
    const wy = WORLD_H - 70;
    x.drawImage(soft('rgba(0,0,0,0.7)'), -100, wy - 60, WORLD_W + 200, 120);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 60; col++) {
        const bw = 44, bh = 18, bx = col * bw - (row % 2) * 22, by = wy + row * bh;
        if (bx + bw > 690 && bx < 910) continue;
        const t = R();
        x.fillStyle = t < 0.33 ? '#8a8378' : t < 0.66 ? '#7a7368' : '#958e82';
        x.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(bx + 1, by + 1, bw - 2, 3);
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(bx + 1, by + bh - 4, bw - 2, 3);
        if (R() < 0.15) ellipse(x, bx + R() * bw, by + 3, 7, 3, 'rgba(96,140,60,0.7)');
      }
    }
    // crenellations
    for (let col = 0; col < 40; col++) {
      const bx = col * 44 + 4;
      if (bx + 34 > 690 && bx < 910) continue;
      x.fillStyle = '#a39b8e'; x.fillRect(bx, wy - 14, 30, 14);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx, wy - 3, 30, 3);
    }
    for (const tx of [660, 940]) {
      x.drawImage(soft('rgba(0,0,0,0.6)'), tx - 60, wy - 30, 130, 120);
      circle(x, tx, wy + 22, 44, '#4f4a42');
      circle(x, tx, wy + 22, 42, shade(x, tx, wy + 22, 42, '#b3ac9f', '#5f594f'));
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        circle(x, tx + Math.cos(a) * 36, wy + 22 + Math.sin(a) * 36, 6, shade(x, tx + Math.cos(a) * 36, wy + 22 + Math.sin(a) * 36, 6, '#a39b8e', '#5a544a'));
      }
      circle(x, tx, wy + 22, 26, '#2e2a25');
    }
    x.fillStyle = '#1e1712'; x.fillRect(700, wy + 4, 200, 66);
    for (let i = 0; i < 9; i++) line(x, 708 + i * 23, wy + 4, 708 + i * 23, wy + 70, '#4a3a2a', 4);
    for (let i = 0; i < 3; i++) line(x, 700, wy + 18 + i * 20, 900, wy + 18 + i * 20, '#3a2c1e', 3);
    return { ground: c, canopy };
  }

  // river that separates the two lanes
  function buildRiver(gap, scale) {
    const c = mk(gap * scale, WORLD_H * scale), x = c.getContext('2d');
    x.scale(scale, scale);
    const R = rng(4242), N = makeNoise(31);
    const bankL = y => 70 + N(3, y / 260, 3) * 70, bankR = y => gap - 70 - N(9, y / 260, 3) * 70;
    // banks (grass to sand)
    const field = fieldCanvas(gap, WORLD_H, 6, (px, py) => {
      const l = bankL(py), r = bankR(py);
      const n = N(px / 60, py / 60, 3);
      if (px > l && px < r) {
        const t = Math.min(px - l, r - px) / ((r - l) / 2);
        return mixc([60, 120, 140], [18, 58, 96], Math.min(1, t * 1.3)).map(v => v * (0.9 + n * 0.2));
      }
      const d = px <= l ? l - px : px - r;
      const sand = [150, 132, 90], grass = [56, 96, 40];
      const col = d < 26 ? mixc([96, 84, 58], sand, d / 26) : mixc(sand, grass, Math.min(1, (d - 26) / 40));
      const k = 0.85 + n * 0.3;
      return [col[0] * k, col[1] * k, col[2] * k];
    });
    x.imageSmoothingEnabled = true;
    x.drawImage(field, 0, 0, gap, WORLD_H);
    // rocks in and along the river
    for (let i = 0; i < 70; i++) {
      const py = R() * WORLD_H, side = R();
      const px = side < 0.4 ? bankL(py) + (R() - 0.3) * 30 : side < 0.8 ? bankR(py) + (R() - 0.7) * 30 : U.lerp(bankL(py), bankR(py), R());
      drawRock(x, px, py, 6 + R() * 14, R);
    }
    // reeds
    const reed = new Path2D();
    for (let i = 0; i < 500; i++) {
      const py = R() * WORLD_H, px = (R() < 0.5 ? bankL(py) - 4 : bankR(py) + 4) + (R() - 0.5) * 16;
      for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (R() - 0.5) * 1, l = 8 + R() * 14; reed.moveTo(px, py); reed.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); }
    }
    x.strokeStyle = '#7a9a44'; x.lineWidth = 1.6; x.stroke(reed);
    c.bankL = bankL; c.bankR = bankR;
    return c;
  }

  function buildClouds() {
    const c = mk(512, 512), x = c.getContext('2d');
    const R = rng(77);
    for (let i = 0; i < 9; i++) {
      const cx = 60 + R() * 392, cy = 60 + R() * 392, r = 50 + R() * 90;
      for (let k = 0; k < 6; k++) {
        const bx = cx + (R() - 0.5) * r, by = cy + (R() - 0.5) * r * 0.6, br = r * (0.5 + R() * 0.5);
        x.drawImage(soft('rgba(0,0,0,0.5)'), bx - br, by - br, br * 2, br * 2);
      }
    }
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

  const SPR_SCALE = 3;
  // draw something into a canvas and give it a crisp dark outline
  function outline(src, px, color = 'rgba(12,8,6,0.9)') {
    const out = mk(src.width, src.height), o = out.getContext('2d');
    const sil = mk(src.width, src.height), sx = sil.getContext('2d');
    sx.drawImage(src, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = color; sx.fillRect(0, 0, sil.width, sil.height);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      o.drawImage(sil, Math.cos(a) * px, Math.sin(a) * px);
    }
    o.drawImage(src, 0, 0);
    // soft top-left rim light
    o.globalCompositeOperation = 'source-atop';
    const g = o.createLinearGradient(0, 0, out.width, out.height);
    g.addColorStop(0, 'rgba(255,245,220,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,20,0.18)');
    o.fillStyle = g; o.fillRect(0, 0, out.width, out.height);
    return out;
  }
  const sprCache = {};
  function creepSprite(type, frame) {
    const key = type + frame;
    if (sprCache[key]) return sprCache[key];
    const r = CREEPS[type].radius;
    const span = r * 4.4;
    const raw = mk(span * SPR_SCALE, span * SPR_SCALE), x = raw.getContext('2d');
    x.translate(raw.width / 2, raw.height / 2); x.scale(SPR_SCALE, SPR_SCALE);
    C[type](x, r, frame);
    const c = outline(raw, SPR_SCALE * 0.9);
    c.span = span;
    return (sprCache[key] = c);
  }
  // icon (facing up-right) for UI
  function creepIcon(type, size) {
    const raw = mk(size, size), x = raw.getContext('2d');
    const r = CREEPS[type].radius;
    const span = r * 3.8;
    x.translate(size / 2, size / 2); x.scale(size / span, size / span); x.rotate(-Math.PI / 4);
    C[type](x, r, 0);
    return outline(raw, Math.max(1.2, size / 40));
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

  // hero rendered via an offscreen buffer so it gets the same outline as creeps
  const heroBuf = {};
  function drawHeroOutlined(ctx, h, t, r, face, scale) {
    const S = Math.max(1, Math.min(3, scale || 2));
    const size = Math.ceil(r * 4.6 * S);
    let B = heroBuf[h.id];
    if (!B || B.raw.width !== size) {
      B = heroBuf[h.id] = { raw: mk(size, size), sil: mk(size, size) };
    }
    const x = B.raw.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, size, size);
    x.translate(size / 2, size / 2); x.scale(S, S); x.rotate(face);
    drawHero(x, h, t, r);
    const sx = B.sil.getContext('2d');
    sx.globalCompositeOperation = 'source-over';
    sx.clearRect(0, 0, size, size);
    sx.drawImage(B.raw, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = 'rgba(10,6,4,0.92)'; sx.fillRect(0, 0, size, size);
    const half = size / S / 2, o = 1.1;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.drawImage(B.sil, -half + Math.cos(a) * o, -half + Math.sin(a) * o, size / S, size / S);
    }
    ctx.drawImage(B.raw, -half, -half, size / S, size / S);
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

  return { buildTerrain, buildRiver, buildClouds, PONDS, creepSprite, creepIcon, drawHero, drawHeroOutlined, heroPortrait, glow, soft, circle, ellipse, line, poly, shadeColor, mk, SPR_SCALE };
})();
