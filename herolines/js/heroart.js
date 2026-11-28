'use strict';
// ============================================================================
//  Hero art: top-down painted characters.
//  Each hero is assembled from pre-rendered, heavily textured parts (cape,
//  body, weapon arm, off-hand, boots). Parts are painted once at high
//  resolution with procedural materials (metal, cloth, leather, fur, hair,
//  skin, wood, glow) and soft ambient occlusion, then animated every frame
//  with springs (smooth turning, weight shift, follow-through on swings).
//  Design units ~= world units; heroes face +x.
// ============================================================================
const HeroArt = (() => {
  const TAU = Math.PI * 2;
  const SC = 4; // sprite pixels per design unit
  const mk = Art.mk;

  // ---------------------------------------------------------------- noise tiles
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function noiseTile(size, cells, octaves, seed) {
    const R = rng(seed), c = mk(size, size), x = c.getContext('2d');
    const img = x.createImageData(size, size), d = img.data;
    const grids = [];
    for (let o = 0; o < octaves; o++) {
      const n = cells << o, g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = R();
      grids.push([n, g]);
    }
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      let v = 0, amp = 1, tot = 0;
      for (const [n, g] of grids) {
        const fx = i / size * n, fy = j / size * n, x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = g[(y0 % n) * n + x0 % n], b = g[(y0 % n) * n + (x0 + 1) % n];
        const cc = g[((y0 + 1) % n) * n + x0 % n], dd = g[((y0 + 1) % n) * n + (x0 + 1) % n];
        v += (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + dd) * sx * sy) * amp; tot += amp; amp *= 0.5;
      }
      v /= tot;
      const k = (j * size + i) * 4, g8 = Math.round(v * 255);
      d[k] = d[k + 1] = d[k + 2] = g8; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  let MOTTLE = null, GRAIN = null;
  function tiles() {
    if (!MOTTLE) { MOTTLE = noiseTile(128, 6, 4, 11); GRAIN = noiseTile(64, 32, 2, 23); }
  }

  // ---------------------------------------------------------------- materials
  const MAT = {
    steel:   { type: 'metal', c: ['#f4f7fa', '#b9c3cf', '#5b6675'], mottle: 0.12, grain: 0.1 },
    darksteel: { type: 'metal', c: ['#c9ced8', '#6a7080', '#2c303a'], mottle: 0.15, grain: 0.12 },
    gold:    { type: 'metal', c: ['#fff1b0', '#e0b040', '#7a5510'], mottle: 0.15, grain: 0.1 },
    silver:  { type: 'metal', c: ['#ffffff', '#cfdbe6', '#7a8ea0'], mottle: 0.1, grain: 0.08 },
    blueCloth: { type: 'cloth', c: ['#5b92e0', '#2f5fa8', '#152c58'], mottle: 0.3, grain: 0.25 },
    purpleCloth: { type: 'cloth', c: ['#8a62c0', '#4c2f78', '#1c0f30'], mottle: 0.35, grain: 0.28 },
    greenCloth: { type: 'cloth', c: ['#78b468', '#3c7a3a', '#173a18'], mottle: 0.35, grain: 0.28 },
    redCloth: { type: 'cloth', c: ['#f07050', '#b8322b', '#4e0e0a'], mottle: 0.3, grain: 0.25 },
    whiteCloth: { type: 'cloth', c: ['#ffffff', '#e6eef5', '#9ab4c8'], mottle: 0.18, grain: 0.18 },
    leather: { type: 'leather', c: ['#a8774a', '#6e4826', '#2e1a0a'], mottle: 0.45, grain: 0.3 },
    darkLeather: { type: 'leather', c: ['#5a4670', '#2e223e', '#100a18'], mottle: 0.4, grain: 0.3 },
    wood:    { type: 'wood', c: ['#a8784a', '#6e4a26', '#3a220c'], mottle: 0.3, grain: 0.2 },
    skin:    { type: 'skin', c: ['#ffd9b8', '#e0a47a', '#8a5434'], mottle: 0.12, grain: 0.06 },
    tanSkin: { type: 'skin', c: ['#f6c08c', '#cf8a58', '#6e3a1a'], mottle: 0.15, grain: 0.07 },
    paleSkin: { type: 'skin', c: ['#fff0e6', '#e8cbb8', '#9a7a68'], mottle: 0.1, grain: 0.05 },
    fur:     { type: 'fur', c: ['#f2e6cf', '#b39a78', '#5a4630'], mottle: 0.3, grain: 0.2 },
    blueHair: { type: 'hair', c: ['#8fc0ff', '#3a6fc0', '#132c5a'], mottle: 0.2, grain: 0.2 },
    auburn:  { type: 'hair', c: ['#e08a4a', '#9a4a1c', '#3e1806'], mottle: 0.2, grain: 0.2 },
    silverHair: { type: 'hair', c: ['#ffffff', '#d8e2ee', '#8696aa'], mottle: 0.15, grain: 0.15 },
    blackHair: { type: 'hair', c: ['#5a3a24', '#2a160a', '#0a0402'], mottle: 0.2, grain: 0.2 },
    brownHair: { type: 'hair', c: ['#8a5a34', '#5a3418', '#200e04'], mottle: 0.2, grain: 0.2 },
    darkCloth: { type: 'cloth', c: ['#2a1d3a', '#140c20', '#050208'], mottle: 0.3, grain: 0.2 },
    emberCloth: { type: 'cloth', c: ['#3a1408', '#1a0602', '#000000'], mottle: 0.3, grain: 0.2 },
    iceGem:  { type: 'metal', c: ['#ffffff', '#8fe3ff', '#2a8ac0'], mottle: 0.05, grain: 0.05 },
    iceMetal: { type: 'metal', c: ['#e6fbff', '#5fc8ef', '#1a5a80'], mottle: 0.1, grain: 0.1 },
  };

  // paint a path with a material: base gradient, texture, detail, ambient occlusion
  function paint(x, path, m, bb, o = {}) {
    const [x0, y0, x1, y1] = bb, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.max(w, h) / 2;
    const R = rng(o.seed || (Math.round(x0 * 31 + y0 * 17) | 0) + 7);
    x.save();
    path(x); x.clip();
    const g = x.createRadialGradient(cx - w * 0.22, cy - h * 0.25, r * 0.05, cx, cy, r * 1.15);
    g.addColorStop(0, m.c[0]); g.addColorStop(0.45, m.c[1]); g.addColorStop(1, m.c[2]);
    x.fillStyle = g; x.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    const tex = (tile, a, op) => {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = a; x.globalCompositeOperation = op;
      x.fillStyle = x.createPattern(tile, 'repeat'); x.fillRect(0, 0, x.canvas.width, x.canvas.height);
      x.restore();
    };
    tex(MOTTLE, m.mottle, 'multiply');
    tex(GRAIN, m.grain, 'overlay');
    const dir = o.dir !== undefined ? o.dir : 0;
    x.lineCap = 'round';
    if (m.type === 'metal') {
      x.save(); x.translate(cx, cy); x.rotate(dir + 0.6);
      for (let i = 0; i < 26; i++) {
        const yy = (R() - 0.5) * r * 2;
        x.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,20,0.08)'; x.lineWidth = 0.25 + R() * 0.4;
        x.beginPath(); x.moveTo(-r, yy); x.lineTo(r, yy + (R() - 0.5) * 2); x.stroke();
      }
      const sb = x.createLinearGradient(-r, 0, r, 0);
      sb.addColorStop(0.28, 'rgba(255,255,255,0)'); sb.addColorStop(0.36, 'rgba(255,255,255,0.55)'); sb.addColorStop(0.44, 'rgba(255,255,255,0)');
      x.fillStyle = sb; x.fillRect(-r, -r, r * 2, r * 2);
      x.restore();
      for (let i = 0; i < 7; i++) {
        const sx = x0 + R() * w, sy = y0 + R() * h, l = 1 + R() * 3, a = R() * TAU;
        x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.2;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
      }
    } else if (m.type === 'cloth') {
      x.globalAlpha = 0.07; x.strokeStyle = '#000'; x.lineWidth = 0.2;
      for (let k = -w - h; k < w + h; k += 0.9) {
        x.beginPath(); x.moveTo(x0 + k, y0); x.lineTo(x0 + k + h, y1); x.stroke();
        x.beginPath(); x.moveTo(x0 + k, y1); x.lineTo(x0 + k + h, y0); x.stroke();
      }
      x.globalAlpha = 1;
      for (const f of (o.folds || [])) {
        x.save(); x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 2.2 * SC;
        x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(f[0], f[1]); x.quadraticCurveTo(f[2], f[3], f[4], f[5]); x.stroke();
        x.restore();
        x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(f[0] - 1, f[1] - 1); x.quadraticCurveTo(f[2] - 1, f[3] - 1, f[4] - 1, f[5] - 1); x.stroke();
      }
    } else if (m.type === 'leather') {
      for (let i = 0; i < 40; i++) {
        const bx = x0 + R() * w, by = y0 + R() * h, br = 0.5 + R() * 2;
        x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,200,0.07)';
        x.beginPath(); x.ellipse(bx, by, br, br * 0.6, R() * 3, 0, TAU); x.fill();
      }
    } else if (m.type === 'wood') {
      x.save(); x.translate(cx, cy); x.rotate(dir);
      for (let i = 0; i < 14; i++) {
        const yy = (R() - 0.5) * r * 2;
        x.strokeStyle = R() < 0.6 ? 'rgba(40,20,5,0.35)' : 'rgba(255,220,170,0.15)'; x.lineWidth = 0.25 + R() * 0.35;
        x.beginPath(); x.moveTo(-r * 1.2, yy); x.bezierCurveTo(-r * 0.3, yy + (R() - 0.5) * 1.5, r * 0.3, yy + (R() - 0.5) * 1.5, r * 1.2, yy); x.stroke();
      }
      x.restore();
    } else if (m.type === 'fur' || m.type === 'hair') {
      const n = Math.round(w * h * (m.type === 'fur' ? 1.4 : 1.1));
      const len = m.type === 'fur' ? 2.2 : 4.5;
      for (let i = 0; i < n; i++) {
        const sx = x0 + R() * w, sy = y0 + R() * h, a = dir + (R() - 0.5) * (m.type === 'fur' ? 1.2 : 0.35), l = len * (0.5 + R());
        x.strokeStyle = R() < 0.5 ? m.c[0] : (R() < 0.5 ? m.c[2] : m.c[1]);
        x.globalAlpha = 0.35 + R() * 0.45; x.lineWidth = m.type === 'fur' ? 0.45 : 0.3;
        x.beginPath(); x.moveTo(sx, sy);
        x.quadraticCurveTo(sx + Math.cos(a) * l * 0.5 + (R() - 0.5), sy + Math.sin(a) * l * 0.5 + (R() - 0.5), sx + Math.cos(a) * l, sy + Math.sin(a) * l);
        x.stroke();
      }
      x.globalAlpha = 1;
    } else if (m.type === 'skin') {
      x.fillStyle = 'rgba(220,90,80,0.07)';
      x.beginPath(); x.ellipse(cx + w * 0.15, cy, w * 0.3, h * 0.3, 0, 0, TAU); x.fill();
    }
    // ambient occlusion along the inside edge
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.75)'; x.shadowBlur = (o.ao || 2.2) * SC;
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.6;
    path(x); x.stroke();
    x.restore();
    // soft sheen
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = m.type === 'metal' ? 0.55 : 0.18;
    x.drawImage(Art.soft('rgba(255,255,255,0.9)'), cx - w * 0.45, cy - h * 0.48, w * 0.55, h * 0.5);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.restore();
    path(x);
    x.lineWidth = 0.55; x.strokeStyle = 'rgba(20,12,8,0.55)'; x.stroke();
  }

  const P = {
    ell: (cx, cy, rx, ry, rot = 0) => x => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); },
    poly: pts => x => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); },
    smooth: pts => x => {
      const n = pts.length; x.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[i], p1 = pts[(i + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        if (i === 0) x.moveTo(mx, my); else x.quadraticCurveTo(p0[0], p0[1], mx, my);
      }
      const p0 = pts[0], p1 = pts[1]; x.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2); x.closePath();
    },
    capsule: (ax, ay, bx, by, w1, w2) => x => {
      const ang = Math.atan2(by - ay, bx - ax), nx = -Math.sin(ang), ny = Math.cos(ang);
      x.beginPath(); x.moveTo(ax + nx * w1, ay + ny * w1); x.lineTo(bx + nx * w2, by + ny * w2);
      x.arc(bx, by, w2, ang + Math.PI / 2, ang - Math.PI / 2, true);
      x.lineTo(ax - nx * w1, ay - ny * w1); x.arc(ax, ay, w1, ang - Math.PI / 2, ang + Math.PI / 2, true); x.closePath();
    },
  };
  const bbE = (cx, cy, rx, ry) => [cx - rx, cy - ry, cx + rx, cy + ry];
  const bbP = pts => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
  const bbC = (ax, ay, bx, by, w) => [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w];
  const E = (x, cx, cy, rx, ry, m, o) => paint(x, P.ell(cx, cy, rx, ry), m, bbE(cx, cy, rx, ry), o);
  const S = (x, pts, m, o) => paint(x, P.smooth(pts), m, bbP(pts), o);
  const Q = (x, pts, m, o) => paint(x, P.poly(pts), m, bbP(pts), o);
  const C = (x, ax, ay, bx, by, w1, w2, m, o) => paint(x, P.capsule(ax, ay, bx, by, w1, w2), m, bbC(ax, ay, bx, by, Math.max(w1, w2)), Object.assign({ dir: Math.atan2(by - ay, bx - ax) }, o || {}));
  function glowAt(x, cx, cy, r, col) { x.drawImage(Art.glow(col), cx - r, cy - r, r * 2, r * 2); }
  function line(x, x1, y1, x2, y2, col, w) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); }
  function trim(x, path, col, w) { path(x); x.strokeStyle = col; x.lineWidth = w; x.stroke(); }

  // a part is painted once into its own canvas (bounds relative to its pivot)
  function part(bx0, by0, bx1, by1, draw) {
    const pad = 3;
    const w = bx1 - bx0 + pad * 2, h = by1 - by0 + pad * 2;
    const c = mk(w * SC, h * SC), x = c.getContext('2d');
    x.setTransform(SC, 0, 0, SC, (-bx0 + pad) * SC, (-by0 + pad) * SC);
    draw(x);
    const out = mk(c.width, c.height), o = out.getContext('2d');
    o.shadowColor = 'rgba(0,0,0,0.5)'; o.shadowBlur = 2.5 * SC; o.shadowOffsetX = 0.8 * SC; o.shadowOffsetY = 1.2 * SC;
    o.drawImage(c, 0, 0);
    return { c: out, x: bx0 - pad, y: by0 - pad, w, h };
  }
  function drawPart(ctx, p, px, py, ang, sx = 1, sy = 1) {
    ctx.save(); ctx.translate(px, py); if (ang) ctx.rotate(ang); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.drawImage(p.c, p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  function boot(m) { return part(-5, -3.5, 5, 3.5, x => S(x, [[-4.5, -2.8], [3, -3.2], [5, 0], [3, 3.2], [-4.5, 2.8]], m)); }

  // ---------------------------------------------------------------- hero builds
  const BUILD = {
    warden() {
      const cape = part(-36, -22, 0, 22, x => {
        const pts = [[-2, -18], [-14, -21], [-30, -19], [-36, -8], [-34, 6], [-30, 19], [-14, 21], [-2, 18]];
        S(x, pts, MAT.blueCloth, { folds: [[-6, -10, -20, -12, -32, -14], [-6, 0, -20, 1, -34, 0], [-6, 10, -20, 12, -32, 14]] });
        trim(x, P.smooth(pts.map(p => [p[0] * 0.94, p[1] * 0.92])), 'rgba(226,179,60,0.75)', 0.9);
      });
      const body = part(-18, -22, 16, 22, x => {
        S(x, [[-10, -12], [4, -14], [11, -8], [12, 8], [4, 14], [-10, 12], [-12, 0]], MAT.steel, { dir: 1.2 });
        Q(x, [[1, -5], [12, -4.5], [12.5, 4.5], [1, 5]], MAT.blueCloth);
        trim(x, P.poly([[1, -5], [12, -4.5], [12.5, 4.5], [1, 5]]), '#e2b33c', 0.8);
        for (const s of [-1, 1]) {
          E(x, -1, s * 14, 8.5, 7.5, MAT.steel, { seed: 3 + s });
          for (const k of [0.62, 0.32]) { x.beginPath(); x.ellipse(-1 - 1.5 * k, s * 14, 8.5 * k, 7.5 * k, 0, 0, TAU); x.strokeStyle = 'rgba(40,45,60,0.45)'; x.lineWidth = 0.6; x.stroke(); }
          for (const a of [0.6, 1.6, 2.6]) E(x, -1 + Math.cos(a) * 6.5, s * 14 + Math.sin(a) * s * 5.5, 0.8, 0.8, MAT.gold, { ao: 0.3 });
        }
        E(x, 3.5, 0, 8.8, 8.4, MAT.steel, { seed: 9 });
        line(x, 3.5, -8, 3.5, 8, '#e2b33c', 1.3); line(x, -5, 0, 12, 0, 'rgba(226,179,60,0.9)', 1.1);
        for (const yy of [-3.6, 3.6]) line(x, 8.5, yy, 11.6, yy * 0.8, '#121018', 1);
        S(x, [[-1, -2.2], [-9, -3], [-17, -1.5], [-18, 0], [-17, 1.5], [-9, 3], [-1, 2.2]], MAT.blueHair, { dir: Math.PI });
      });
      const armR = part(-5, -7, 51, 13, x => {
        C(x, 0, 0, 14, 2, 4.6, 3.8, MAT.steel);
        C(x, 14, 2, 44, 3, 1.4, 1.4, MAT.wood);
        Q(x, [[38, -6], [46, -5], [46, 11], [38, 12]], MAT.darksteel, { dir: Math.PI / 2 });
        Q(x, [[40.5, -6], [43.5, -6], [43.5, 12], [40.5, 12]], MAT.gold, { dir: Math.PI / 2, ao: 0.6 });
        Q(x, [[46, 1], [50, 3], [46, 5]], MAT.steel);
        E(x, 15, 2, 3.6, 3.4, MAT.steel);
      });
      const armL = part(-5, -10, 28, 11, x => {
        C(x, 0, 0, 10, 2, 4.4, 3.6, MAT.steel);
        const sh = [[4, -8], [18, -9], [26, -4], [27, 3], [19, 9], [4, 9], [0, 1]];
        S(x, sh, MAT.steel, { seed: 21 });
        S(x, sh.map(p => [p[0] * 0.86 + 1.8, p[1] * 0.8]), MAT.blueCloth);
        line(x, 4.5, 0, 24, 0, '#e2b33c', 1.6); line(x, 14, -6, 14, 6, '#e2b33c', 1.6);
        E(x, 14, 0, 1.8, 1.8, MAT.gold, { ao: 0.4 });
      });
      return { cape, body, armR, armL, boot: boot(MAT.steel), pivR: [-1, 14], pivL: [-1, -14], style: 'smash' };
    },

    shade() {
      const cape = part(-40, -12, 0, 12, x => {
        S(x, [[-2, -5], [-16, -8], [-30, -6], [-40, -9], [-34, -3], [-16, -2], [-2, -1]], MAT.purpleCloth, { dir: Math.PI, folds: [[-6, -4, -20, -5, -34, -6]] });
        S(x, [[-2, 1], [-16, 3], [-30, 6], [-38, 10], [-32, 3], [-16, 7], [-2, 5]], MAT.purpleCloth, { dir: Math.PI, seed: 5 });
      });
      const body = part(-14, -18, 14, 18, x => {
        S(x, [[-9, -10], [4, -12], [10, -6], [10, 6], [4, 12], [-9, 10], [-11, 0]], MAT.darkLeather, { dir: 1.2 });
        for (let i = -2; i <= 2; i++) line(x, -7, i * 3.5, 8, i * 3.6 - 1, 'rgba(10,5,20,0.5)', 0.6);
        for (const s of [-1, 1]) S(x, [[-6, s * 8], [3, s * 7.5], [5, s * 12.5], [-1, s * 15], [-7, s * 13]], MAT.purpleCloth, { seed: 4 + s });
        S(x, [[-10, 0], [-6, -7], [2, -8.5], [9, -5], [10, 0], [9, 5], [2, 8.5], [-6, 7]], MAT.purpleCloth, { dir: Math.PI, folds: [[-6, -4, 0, -5, 6, -4], [-6, 4, 0, 5, 6, 4]] });
        S(x, [[6, -4], [10.5, -2.5], [11, 2.5], [6, 4], [7.5, 0]], MAT.darkCloth);
        glowAt(x, 9.8, -1.6, 1.8, 'rgba(214,179,255,0.95)'); glowAt(x, 9.8, 1.6, 1.8, 'rgba(214,179,255,0.95)');
      });
      const blade = (x, f) => {
        C(x, 0, 0, 12, f, 3.2, 2.8, MAT.darkLeather);
        E(x, 13, f, 2.6, 2.6, MAT.darkLeather);
        line(x, 13, f * -2, 13, f * 4, '#8a7a9a', 1);
        glowAt(x, 22, f * 2.5, 8, 'rgba(190,140,255,0.45)');
        S(x, [[14, f * 0.2], [22, f * -0.5], [30, f * 2.5], [24, f * 2.6], [14, f * 2]], MAT.silver, { ao: 0.5 });
      };
      const armR = part(-4, -6, 32, 8, x => blade(x, 1));
      const armL = part(-4, -8, 32, 6, x => blade(x, -1));
      return { cape, body, armR, armL, boot: boot(MAT.darkLeather), pivR: [-1, 10], pivL: [-1, -10], style: 'slash' };
    },

    ranger() {
      const cape = part(-30, -18, 0, 18, x => {
        S(x, [[-2, -14], [-14, -17], [-28, -14], [-30, 0], [-28, 14], [-14, 17], [-2, 14]], MAT.greenCloth, { dir: Math.PI, folds: [[-6, -8, -18, -10, -28, -10], [-6, 6, -18, 8, -28, 9]] });
      });
      const body = part(-24, -18, 14, 18, x => {
        C(x, -12, -8, -2, 7, 3.2, 3.2, MAT.leather);
        for (let i = -1; i <= 1; i++) { E(x, -12.5 + i * 1.2, -9 + i * 1.6, 1.4, 1.4, MAT.whiteCloth, { ao: 0.3 }); line(x, -12.5 + i * 1.2, -9 + i * 1.6, -11 + i * 1.2, -7 + i * 1.6, '#8a5a2a', 0.5); }
        S(x, [[-8, -10], [4, -11.5], [10, -6], [10, 6], [4, 11.5], [-8, 10], [-10, 0]], MAT.greenCloth, { folds: [[-6, -6, 0, -8, 6, -7], [-6, 6, 0, 8, 6, 7]] });
        line(x, -8, -9, 7, 9, '#5a3a1c', 1.4);
        for (const s of [-1, 1]) S(x, [[-5, s * 7], [3, s * 7], [4, s * 12], [-1, s * 13], [-6, s * 11]], MAT.leather, { seed: 6 + s });
        S(x, [[-4, 0], [-10, -1.5], [-17, 1], [-22, 3], [-17, 3.5], [-10, 2]], MAT.auburn, { dir: Math.PI });
        S(x, [[-5, 0], [-3, -6.5], [3, -7.6], [8, -4.5], [9, 0], [8, 4.5], [3, 7.6], [-3, 6.5]], MAT.auburn, { dir: Math.PI });
        S(x, [[7, -3.5], [10, -2], [10.3, 2], [7, 3.5]], MAT.skin, { ao: 0.6 });
      });
      const armR = part(-4, -4, 16, 6, x => { C(x, 0, 0, 10, 1, 3.4, 2.9, MAT.greenCloth); E(x, 11, 1, 2.6, 2.6, MAT.leather); });
      const armL = part(-4, -26, 28, 26, x => {
        C(x, 0, 0, 16, 1, 3.4, 2.8, MAT.greenCloth);
        const bow = [[19, -24], [22, -12], [23.5, 1], [22, 14], [19, 25], [20.5, 25], [24.5, 14], [26, 1], [24.5, -12], [20.5, -24]];
        S(x, bow, MAT.wood, { dir: Math.PI / 2 });
        Q(x, [[22.5, -2.5], [26.5, -2.5], [26.5, 4.5], [22.5, 4.5]], MAT.leather, { ao: 0.6 });
        E(x, 17, 1, 2.6, 2.6, MAT.leather);
      });
      return { cape, body, armR, armL, boot: boot(MAT.leather), pivR: [-1, 11], pivL: [-1, -11], style: 'bow', bowTips: [[18.4, -24], [18.4, 25]] };
    },

    pyro() { return robed('pyro'); },
    oracle() { return robed('oracle'); },

    berserker() {
      const cape = part(-22, -24, 2, 24, x => {
        S(x, [[0, -20], [-10, -23], [-20, -18], [-22, 0], [-20, 18], [-10, 23], [0, 20], [-4, 0]], MAT.fur, { dir: Math.PI });
      });
      const body = part(-14, -24, 16, 24, x => {
        S(x, [[-9, -14], [3, -17], [11, -10], [12, 10], [3, 17], [-9, 14], [-11, 0]], MAT.tanSkin, { dir: 1.2 });
        for (const s of [-1, 1]) E(x, 0, s * 15, 7.5, 6.8, MAT.tanSkin, { seed: 8 + s });
        line(x, -6, -12, 8, 6, 'rgba(170,20,20,0.8)', 1.8); line(x, -2, -13, 10, -2, 'rgba(170,20,20,0.8)', 1.3);
        S(x, [[-10, -15], [-4, -19], [3, -18], [0, -10], [-2, 0], [0, 10], [3, 18], [-4, 19], [-10, 15], [-12, 0]], MAT.fur, { dir: Math.PI });
        E(x, 3.5, 0, 7.2, 7, MAT.tanSkin, { seed: 31 });
        S(x, [[-4, -1.5], [3, -2.2], [10, -1.2], [10.5, 0], [10, 1.2], [3, 2.2], [-4, 1.5]], MAT.blackHair, { dir: Math.PI });
        S(x, [[7, -4.5], [11.5, -3], [13, 0], [11.5, 3], [7, 4.5]], MAT.brownHair, { dir: 0 });
        line(x, 8.6, -3.2, 10.2, -2, 'rgba(170,20,20,0.9)', 0.8); line(x, 8.6, 3.2, 10.2, 2, 'rgba(170,20,20,0.9)', 0.8);
      });
      const axeArm = (x, f) => {
        C(x, 0, 0, 13, f, 5.2, 4.3, MAT.tanSkin);
        C(x, 7, f * 0.5, 12, f, 4.5, 4.3, MAT.leather, { ao: 0.6 });
        C(x, 14, f, 34, f * 1.5, 1.4, 1.4, MAT.wood);
        S(x, [[27, f * 1.4], [31, f * -5], [36, f * -9], [38, f * -2], [36, f * 3]], MAT.steel, { dir: Math.PI / 2 });
        S(x, [[29, f * 2], [33, f * 4.5], [32, f * 1.5]], MAT.darksteel, { ao: 0.4 });
        E(x, 14.5, f, 3.8, 3.8, MAT.tanSkin);
      };
      const armR = part(-6, -11, 40, 8, x => axeArm(x, -1));
      const armL = part(-6, -8, 40, 11, x => axeArm(x, 1));
      return { cape, body, armR, armL, boot: boot(MAT.fur), pivR: [0, 15], pivL: [0, -15], style: 'axes' };
    },
  };

  function robed(kind) {
    const fire = kind === 'pyro';
    const robe = fire ? MAT.redCloth : MAT.whiteCloth, trimCol = fire ? '#f2c14e' : '#5fc8ef';
    const cape = part(-30, -20, 0, 20, x => {
      if (!fire) S(x, [[-2, -6], [-12, -9], [-24, -7], [-30, 0], [-24, 7], [-12, 9], [-2, 6]], MAT.silverHair, { dir: Math.PI });
      const hem = [[-2, -16], [-14, -19], [-26, -16], [-28, 0], [-26, 16], [-14, 19], [-2, 16]];
      if (fire) {
        S(x, hem, robe, { dir: Math.PI, folds: [[-6, -10, -16, -12, -26, -12], [-6, 0, -16, 1, -27, 0], [-6, 10, -16, 12, -26, 12]] });
        trim(x, P.smooth(hem.map(p => [p[0] * 0.95, p[1] * 0.94])), trimCol, 0.9);
      }
    });
    const body = part(-14, -18, 14, 18, x => {
      S(x, [[-9, -11], [4, -13], [10, -7], [10, 7], [4, 13], [-9, 11], [-11, 0]], robe, { folds: [[-6, -8, 0, -9, 7, -8], [-6, 8, 0, 9, 7, 8]] });
      trim(x, P.poly([[-6, -12.5], [8, -2], [8, 2], [-6, 12.5]]), trimCol, 1);
      if (fire) {
        S(x, [[-10, 0], [-7, -7.5], [2, -9], [9, -5.5], [10.5, 0], [9, 5.5], [2, 9], [-7, 7.5]], MAT.redCloth, { dir: Math.PI, folds: [[-6, -4, 0, -5, 6, -4], [-6, 4, 0, 5, 6, 4]], seed: 41 });
        trim(x, P.smooth([[6, -6], [10.5, -2.5], [10.5, 2.5], [6, 6]]), trimCol, 1.1);
        S(x, [[6.5, -3.5], [10, -2], [10, 2], [6.5, 3.5]], MAT.emberCloth);
        glowAt(x, 9.4, -1.4, 1.6, 'rgba(255,180,70,0.95)'); glowAt(x, 9.4, 1.4, 1.6, 'rgba(255,180,70,0.95)');
      } else {
        S(x, [[-6, 0], [-4, -7], [3, -8], [8.5, -4.5], [9.5, 0], [8.5, 4.5], [3, 8], [-4, 7]], MAT.silverHair, { dir: Math.PI });
        x.beginPath(); x.ellipse(3, 0, 6.6, 7.2, 0, -1.2, 1.2); x.strokeStyle = '#d8e6f0'; x.lineWidth = 1; x.stroke();
        E(x, 9.4, 0, 1.6, 1.6, MAT.iceMetal, { ao: 0.3 });
        glowAt(x, 9.4, 0, 3, 'rgba(140,225,255,0.7)');
      }
    });
    const armR = part(-5, -14, 43, 10, x => {
      C(x, 0, 0, 12, 1, 3.6, 4.8, robe);
      trim(x, P.ell(12.5, 1, 1.2, 4.6), trimCol, 0.8);
      E(x, 14, 1, 2.4, 2.4, fire ? MAT.tanSkin : MAT.paleSkin);
      C(x, 6, 4, 36, -6, 1.3, 1.5, fire ? MAT.wood : MAT.silver);
      for (const k of [0.35, 0.8]) E(x, 6 + 30 * k, 4 - 10 * k, 1.7, 1.7, fire ? MAT.gold : MAT.iceGem, { ao: 0.3 });
      if (fire) for (const s of [-1, 1]) line(x, 36, -6, 38 + s, -6 + s * 3.5, '#3a200c', 0.9);
      else S(x, [[35, -6], [38, -9.5], [42, -6], [38, -2.5]], MAT.iceGem, { ao: 0.4 });
    });
    const armL = part(-4, -6, 18, 6, x => {
      C(x, 0, 0, 10, -1, 3.6, 4.6, robe);
      trim(x, P.ell(10.5, -1, 1.2, 4.4), trimCol, 0.8);
      E(x, 12, -1, 2.4, 2.4, fire ? MAT.tanSkin : MAT.paleSkin);
    });
    return { cape, body, armR, armL, boot: boot(fire ? MAT.leather : MAT.whiteCloth), pivR: [-1, 11], pivL: [-1, -11], style: 'staff', fire, staffTip: [37, -6] };
  }

  const cache = {};
  function get(id) {
    if (!cache[id]) { tiles(); cache[id] = BUILD[id](); }
    return cache[id];
  }

  // ---------------------------------------------------------------- animation (springs)
  const ease = t => 1 - Math.pow(1 - t, 3);
  function spring(st, key, target, dt, k = 260, damp = 0.85) {
    const v = key + 'V';
    if (st[key] === undefined) { st[key] = target; st[v] = 0; }
    const c = 2 * Math.sqrt(k) * damp;
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { st[v] += (k * (target - st[key]) - c * st[v]) * h; st[key] += st[v] * h; }
  }
  function angLerp(a, b, k) { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; }

  function animate(h, t, B) {
    const st = h._an || (h._an = { face: h.facing, last: t, ph: 0 });
    const dt = Math.min(0.05, Math.max(0, t - st.last)); st.last = t;
    st.face = angLerp(st.face, h.facing, 1 - Math.exp(-11 * dt));
    spring(st, 'move', h.moving ? 1 : 0, dt, 60, 1);
    st.ph += dt * (h.ms || 280) / 26 * st.move;
    const atk = h.animAtk > 0 ? 1 - h.animAtk : -1;
    const cast = Math.max(0, h.animCast || 0);
    let tR = 0.15 + Math.sin(st.ph) * 0.18 * st.move + Math.sin(t * 1.7) * 0.03;
    let tL = -0.15 + Math.sin(st.ph) * 0.18 * st.move - Math.sin(t * 1.7 + 1) * 0.03;
    let lunge = 0;
    if (atk >= 0) {
      if (B.style === 'smash') { tR = atk < 0.3 ? 1.25 - ease(atk / 0.3) * 1.85 : -0.6 + (atk - 0.3) / 0.7 * 0.75; lunge = Math.sin(Math.min(1, atk * 2.5) * Math.PI) * 4; }
      else if (B.style === 'slash') { const a = ease(Math.min(1, atk / 0.4)); tR = 1.1 - a * 1.6; tL = -0.5 + a * 0.7; lunge = Math.sin(Math.min(1, atk * 3) * Math.PI) * 3; }
      else if (B.style === 'axes') { tR = 1.1 - ease(Math.min(1, atk / 0.35)) * 1.6; tL = -1.1 + ease(Math.max(0, Math.min(1, (atk - 0.2) / 0.35))) * 1.6; lunge = Math.sin(Math.min(1, atk * 2.5) * Math.PI) * 3; }
      else if (B.style === 'bow') { tR = 0.15 + (atk < 0.25 ? 0.9 : Math.max(0, 0.9 - (atk - 0.25) * 1.2)); }
      else if (B.style === 'staff') { tR = -0.25; lunge = Math.sin(Math.min(1, atk * 3) * Math.PI) * 2.5; }
    }
    if (cast > 0) {
      if (B.style === 'staff') { tR = -0.35; tL = 0.6 * cast; }
      else tR -= cast * 0.6;
    }
    if (h.channel) { tR = -0.4 + Math.sin(t * 30) * 0.8; tL = 0.4 - Math.sin(t * 30) * 0.8; }
    spring(st, 'aR', tR, dt, atk >= 0 ? 700 : 160, 0.75);
    spring(st, 'aL', tL, dt, atk >= 0 ? 700 : 160, 0.75);
    spring(st, 'lunge', lunge, dt, 400, 0.8);
    spring(st, 'sway', Math.sin(st.ph) * 0.06 * st.move, dt, 120, 0.9);
    return st;
  }

  // ---------------------------------------------------------------- draw
  // ctx origin = hero centre; `size` = world radius of the body
  function draw(ctx, h, t, size, spin) {
    const B = get(h.def.id);
    const st = animate(h, t, B);
    if (spin !== undefined) st.face = spin;
    const k = size / 15;
    const breathe = 1 + Math.sin(t * 2.1) * 0.012;
    ctx.save();
    ctx.rotate(st.face);
    ctx.scale(k, k);
    const step = Math.sin(st.ph) * 5 * st.move;
    drawPart(ctx, B.boot, 2 + step, 6.5, 0);
    drawPart(ctx, B.boot, 2 - step, -6.5, 0);
    ctx.translate(st.lunge, 0);
    ctx.rotate(st.sway);
    const fl = 1 + Math.sin(t * (st.move > 0.3 ? 9 : 2)) * (0.04 + 0.06 * st.move);
    drawPart(ctx, B.cape, -2, 0, Math.sin(t * 1.3) * 0.03 - st.sway * 1.5, 0.62 * fl * (1 + 0.1 * st.move), 0.78 + (fl - 1) * 0.3);
    const aL = st.aL, aR = st.aR;
    if (B.style !== 'bow') drawPart(ctx, B.armL, B.pivL[0], B.pivL[1], aL);
    ctx.save(); ctx.scale(breathe, breathe); drawPart(ctx, B.body, 0, 0, 0); ctx.restore();
    if (B.style === 'bow') {
      const bowA = aL * 0.3;
      drawPart(ctx, B.armL, B.pivL[0], B.pivL[1], bowA);
      const ca = Math.cos(bowA), sa = Math.sin(bowA);
      const tip = p => [B.pivL[0] + p[0] * ca - p[1] * sa, B.pivL[1] + p[0] * sa + p[1] * ca];
      const t1 = tip(B.bowTips[0]), t2 = tip(B.bowTips[1]);
      const cr = Math.cos(aR), sr = Math.sin(aR);
      const handR = [B.pivR[0] + 11 * cr - sr, B.pivR[1] + 11 * sr + cr];
      const pulling = h.animAtk > 0 && aR > 0.45;
      const sp = pulling ? handR : [t1[0] + 0.5, (t1[1] + t2[1]) / 2];
      ctx.strokeStyle = 'rgba(240,235,220,0.9)'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(sp[0], sp[1]); ctx.lineTo(t2[0], t2[1]); ctx.stroke();
      if (pulling) {
        ctx.strokeStyle = '#d8c49a'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(t1[0] + 10, (t1[1] + t2[1]) / 2); ctx.stroke();
      }
    }
    drawPart(ctx, B.armR, B.pivR[0], B.pivR[1], aR);
    if (B.style === 'staff') {
      const cr = Math.cos(aR), sr = Math.sin(aR);
      const tp = [B.pivR[0] + B.staffTip[0] * cr - B.staffTip[1] * sr, B.pivR[1] + B.staffTip[0] * sr + B.staffTip[1] * cr];
      const fl2 = 1 + Math.sin(t * 13) * 0.15;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(Art.glow(B.fire ? 'rgba(255,130,30,0.85)' : 'rgba(130,220,255,0.75)'), tp[0] - 7 * fl2, tp[1] - 7 * fl2, 14 * fl2, 14 * fl2);
      if (h.animCast > 0.05) {
        const lc = Math.cos(aL), ls = Math.sin(aL);
        const hp = [B.pivL[0] + 12 * lc + ls, B.pivL[1] + 12 * ls - lc];
        ctx.drawImage(Art.glow(B.fire ? 'rgba(255,150,40,0.9)' : 'rgba(150,230,255,0.9)'), hp[0] - 6, hp[1] - 6, 12, 12);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (B.fire) {
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath(); ctx.ellipse(tp[0] + 1, tp[1], 2.6 * fl2, 1.8, Math.sin(t * 9) * 0.3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- portraits
  function portrait(defId, size) {
    const c = mk(size, size), x = c.getContext('2d');
    const def = HERO_BY_ID[defId];
    const bg = x.createRadialGradient(size * 0.45, size * 0.38, 2, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, Art.shadeColor(def.color, 0.1)); bg.addColorStop(1, Art.shadeColor(def.color, -0.82));
    x.fillStyle = bg; x.fillRect(0, 0, size, size);
    x.drawImage(Art.glow('rgba(255,240,210,0.3)'), size * 0.1, size * 0.05, size * 0.8, size * 0.8);
    const fake = { id: 'p-' + defId, def, animAtk: 0, animCast: 0, moving: false, facing: -Math.PI / 2 - 0.5, ms: 0 };
    x.save();
    x.translate(size * 0.52, size * 0.6);
    x.drawImage(Art.soft('rgba(0,0,0,0.55)'), -size * 0.32, -size * 0.2, size * 0.64, size * 0.5);
    draw(x, fake, 0.6, size * 0.3);
    x.restore();
    const v = x.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = v; x.fillRect(0, 0, size, size);
    return c;
  }
  function fullBody(defId, w, hgt) {
    const c = mk(w, hgt), x = c.getContext('2d');
    const def = HERO_BY_ID[defId];
    const fake = { id: 'f-' + defId, def, animAtk: 0, animCast: 0, moving: false, facing: -Math.PI / 2 - 0.4, ms: 0 };
    x.translate(w / 2, hgt * 0.55);
    x.drawImage(Art.soft('rgba(0,0,0,0.6)'), -w * 0.4, -w * 0.25, w * 0.8, w * 0.6);
    draw(x, fake, 0.6, w * 0.28);
    return c;
  }

  return { draw, portrait, fullBody, get };
})();

Art.heroPortrait = (defId, size) => HeroArt.portrait(defId, size);
