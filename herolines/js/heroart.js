'use strict';
// ============================================================================
//  Hero figures: upright, rigged 2D characters (3/4 side view).
//  A simple skeleton (hips, knees, ankles, shoulders, elbows, hands) is posed
//  every frame from the hero's state (walk / attack / cast / idle), then body
//  parts, armour, cloth and weapons are drawn over the bones.
//  Design space: ~100 units tall, feet at (0,0), facing +x.
// ============================================================================
const HeroArt = (() => {
  const TAU = Math.PI * 2;
  const { mk } = Art;

  // ---------------------------------------------------------------- helpers
  function lg(x, x1, y1, x2, y2, stops) {
    const g = x.createLinearGradient(x1, y1, x2, y2);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  function rg(x, cx, cy, r, c1, c2) {
    const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  }
  const OL = 'rgba(18,12,10,0.9)';
  function fillStroke(x, fill, lw = 1.2, stroke = OL) {
    x.fillStyle = fill; x.fill();
    if (lw) { x.lineWidth = lw; x.strokeStyle = stroke; x.lineJoin = 'round'; x.stroke(); }
  }
  // tapered limb with rounded ends, shaded across its width
  function limb(x, ax, ay, bx, by, w1, w2, light, dark, lw = 1.1) {
    const ang = Math.atan2(by - ay, bx - ax), nx = -Math.sin(ang), ny = Math.cos(ang);
    x.beginPath();
    x.moveTo(ax + nx * w1, ay + ny * w1);
    x.lineTo(bx + nx * w2, by + ny * w2);
    x.arc(bx, by, w2, ang + Math.PI / 2, ang - Math.PI / 2, true);
    x.lineTo(ax - nx * w1, ay - ny * w1);
    x.arc(ax, ay, w1, ang - Math.PI / 2, ang + Math.PI / 2, true);
    x.closePath();
    fillStroke(x, lg(x, ax - nx * w1, ay - ny * w1, ax + nx * w1, ay + ny * w1, [light, dark]), lw);
  }
  function blob(x, pts, fill, lw = 1.2, stroke = OL) { // smooth closed curve through points
    x.beginPath();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % n];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (i === 0) x.moveTo(mx, my); else x.quadraticCurveTo(p0[0], p0[1], mx, my);
    }
    const p0 = pts[0], p1 = pts[1];
    x.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    x.closePath();
    fillStroke(x, fill, lw, stroke);
  }
  function poly(x, pts, fill, lw = 1.2, stroke = OL) {
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath(); fillStroke(x, fill, lw, stroke);
  }
  function seg(x, x1, y1, x2, y2, col, w, cap = 'round') {
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2);
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = cap; x.stroke();
  }
  const pt = (o, ang, len) => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len]; // ang from straight-down, + = forward
  const ease = t => 1 - Math.pow(1 - t, 3);

  // ---------------------------------------------------------------- heads
  // 3/4 profile head facing +x, centred at (0,0), radius ~10
  function head(x, P, skin, skinDark, opts = {}) {
    const s = opts.scale || 1;
    x.save(); x.translate(P[0], P[1]); x.scale(s, s);
    // ear
    if (!opts.noEar) blob(x, [[-3.5, -2.5], [-1, -3], [-0.5, 1.5], [-3, 2]], skinDark, 0.9);
    // skull + face
    blob(x, [[0, -11], [-8.5, -6], [-9, 2], [-5, 8.5], [2, 10], [6.5, 8], [8.2, 4], [10.2, 0.5], [8.6, -2.5], [8.4, -6.5], [5, -10.5]],
      rg(x, 2, -2, 13, skin, skinDark), 1.1);
    // jaw shadow
    x.beginPath(); x.moveTo(-5, 8); x.quadraticCurveTo(1, 11, 6.5, 7.6); x.quadraticCurveTo(1, 8.5, -5, 8);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fill();
    if (!opts.noFace) {
      // brow, eye, nose, mouth
      seg(x, 3.6, -4.6, 8.1, -4.2, opts.browCol || 'rgba(60,35,20,0.85)', 1.3);
      x.beginPath(); x.ellipse(6.1, -2.1, 1.35, 1.05, 0, 0, TAU); x.fillStyle = opts.eyeCol || '#1c1410'; x.fill();
      if (opts.eyeGlow) { x.save(); x.shadowColor = opts.eyeGlow; x.shadowBlur = 6; x.fillStyle = opts.eyeGlow; x.fill(); x.restore(); }
      x.beginPath(); x.arc(6.5, -2.5, 0.4, 0, TAU); x.fillStyle = 'rgba(255,255,255,0.8)'; x.fill();
      seg(x, 9.6, 0.6, 8.2, 2.6, 'rgba(90,50,30,0.45)', 0.9);
      seg(x, 5.6, 5.4, 7.6, 5.1, 'rgba(110,50,40,0.75)', 1);
    }
    x.restore();
  }

  // ---------------------------------------------------------------- skeleton
  function pose(h, t, D) {
    const mv = h.moving ? 1 : 0;
    const ph = mv ? h.walk * 0.9 : 0;
    const breathe = Math.sin(t * 2.2);
    const bob = mv ? -Math.abs(Math.sin(ph)) * 2.6 : breathe * 0.5;
    const lean = mv ? 0.1 : 0;
    const legL = D.leg || 23;
    const hip = [0, -legL * 2 + bob];
    const L = {};
    for (const [k, off] of [['F', 0], ['B', Math.PI]]) {
      const p = ph + off;
      const thigh = mv ? Math.sin(p) * 0.4 * (D.stride || 1) : (k === 'F' ? 0.14 : -0.1) * (D.stance || 1);
      const knee = mv ? Math.max(0, -Math.cos(p)) * 0.7 * (D.stride || 1) + 0.08 : 0.06 * (D.stance || 1);
      const hipP = [hip[0] + (k === 'F' ? 1.5 : -1.5), hip[1]];
      const kneeP = pt(hipP, thigh, legL);
      const ank = pt(kneeP, thigh - knee, legL);
      const lift = mv ? Math.max(0, Math.sin(p)) * 0.25 : 0;
      L[k] = { hip: hipP, knee: kneeP, ank, toe: [ank[0] + 8.5 * Math.cos(lift), ank[1] + 1.5 - 8.5 * Math.sin(lift) * 0.4] };
    }
    const neck = [hip[0] + Math.sin(lean) * 30, hip[1] - 30 * Math.cos(lean) + breathe * 0.4];
    const sh = [neck[0] - 0.5, neck[1] + 3.5];
    const armSwing = mv ? Math.sin(ph) * 0.55 : breathe * 0.04;
    return { mv, ph, bob, lean, hip, neck, sh, legs: L, armSwing, headP: [neck[0] + 2.5, neck[1] - 9.5] };
  }
  function arm(sh, upper, fore, L1 = 16, L2 = 15) {
    const el = pt(sh, upper, L1), hand = pt(el, fore, L2);
    return { sh, el, hand };
  }

  // shared body parts ------------------------------------------------------------
  function legs(x, S, side, c) {
    const l = S.legs[side];
    limb(x, l.hip[0], l.hip[1], l.knee[0], l.knee[1], c.thighW || 5.2, 4.2, c.leg, c.legD);
    limb(x, l.knee[0], l.knee[1], l.ank[0], l.ank[1], 4.2, 3.4, c.leg, c.legD);
    // boot
    const a = l.ank, tp = l.toe;
    blob(x, [[a[0] - 4, a[1] - 7], [a[0] + 3.5, a[1] - 6.5], [tp[0] + 1.5, tp[1] - 2.5], [tp[0] + 2, tp[1] + 1], [a[0] - 4.5, a[1] + 1.8]],
      lg(x, a[0], a[1] - 7, a[0], a[1] + 2, [c.boot, c.bootD]), 1.1);
    if (c.bootCuff) limb(x, a[0] - 4.2, a[1] - 7, a[0] + 3.8, a[1] - 7, 2.2, 2.2, c.bootCuff, c.bootD, 0.9);
  }
  function hand(x, P, col, colD, r = 3.4) {
    x.beginPath(); x.arc(P[0], P[1], r, 0, TAU); fillStroke(x, rg(x, P[0], P[1], r, col, colD), 1);
  }

  // ---------------------------------------------------------------- weapons
  function hammer(x, hd, ang, D) {
    x.save(); x.translate(hd[0], hd[1]); x.rotate(ang);
    limb(x, 0, 10, 0, -40, 1.8, 1.8, '#8a6440', '#4a3018');
    for (const y of [-8, 0, 8]) seg(x, -2, y, 2, y + 2, 'rgba(30,18,8,0.7)', 1);
    // head
    poly(x, [[-11, -52], [11, -52], [12, -40], [-12, -40]], lg(x, -12, -52, 12, -40, ['#f1f4f8', '#9aa6b4', '#5c6673']), 1.3);
    poly(x, [[-12, -48.5], [12, -48.5], [12, -43.5], [-12, -43.5]], lg(x, 0, -48, 0, -43, ['#ffe08a', '#b8862b']), 0.8);
    poly(x, [[12, -50], [19, -46], [12, -42]], '#cfd6de', 1);
    poly(x, [[-2.5, -52], [0, -59], [2.5, -52]], '#cfd6de', 1);
    x.restore();
  }
  function shield(x, P, flip) {
    x.save(); x.translate(P[0] + 3, P[1] - 4);
    const pts = [[-11, -17], [11, -17], [12, -2], [0, 18], [-12, -2]];
    poly(x, pts, lg(x, -12, -17, 12, 18, ['#3f78d0', '#1d3f80']), 1.4);
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] * 0.82, p[1] * 0.82) : x.moveTo(p[0] * 0.82, p[1] * 0.82)); x.closePath();
    x.lineWidth = 2.2; x.strokeStyle = '#e2b33c'; x.stroke();
    seg(x, 0, -13, 0, 13, '#e2b33c', 3, 'butt'); seg(x, -8, -4, 8, -4, '#e2b33c', 3, 'butt');
    x.beginPath(); x.arc(0, -4, 2.6, 0, TAU); x.fillStyle = '#fff3c4'; x.fill();
    x.beginPath(); x.moveTo(-9, -15); x.lineTo(-3, -15); x.lineTo(-8, 0); x.closePath(); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fill();
    x.restore();
  }
  function dagger(x, hd, ang, glow) {
    x.save(); x.translate(hd[0], hd[1]); x.rotate(ang);
    limb(x, 0, 4, 0, -3, 1.4, 1.4, '#3a2a20', '#1a120c', 0.8);
    seg(x, -4, -3.5, 4, -3.5, '#8a7a9a', 2);
    x.save(); x.shadowColor = glow; x.shadowBlur = 8;
    x.beginPath(); x.moveTo(-1.8, -4); x.quadraticCurveTo(-2.5, -14, 2.5, -22); x.quadraticCurveTo(2.2, -12, 1.8, -4); x.closePath();
    fillStroke(x, lg(x, -2, -4, 2, -22, ['#ffffff', '#c9b6ff']), 0.9, '#3a2a55');
    x.restore();
    x.restore();
  }
  function axe(x, hd, ang) {
    x.save(); x.translate(hd[0], hd[1]); x.rotate(ang);
    limb(x, 0, 7, 0, -26, 1.7, 1.6, '#7a5530', '#3a2410');
    seg(x, -2, 2, 2, 3, '#2a1a0a', 1.2); seg(x, -2, -2, 2, -1, '#2a1a0a', 1.2);
    x.beginPath(); x.moveTo(1, -27); x.quadraticCurveTo(14, -32, 15, -20); x.quadraticCurveTo(13, -12, 1, -15); x.closePath();
    fillStroke(x, lg(x, 1, -27, 15, -15, ['#f2f4f6', '#8a929c']), 1.2);
    x.beginPath(); x.moveTo(-1, -26); x.quadraticCurveTo(-7, -23, -6, -18); x.lineTo(-1, -17); x.closePath();
    fillStroke(x, '#9aa2ac', 1);
    seg(x, 13.5, -29, 14.5, -14, 'rgba(255,255,255,0.7)', 1);
    x.restore();
  }
  function staff(x, hd, ang, kind, t) {
    x.save(); x.translate(hd[0], hd[1]); x.rotate(ang);
    if (kind === 'fire') {
      limb(x, 0, 30, 0, -40, 1.7, 1.9, '#7a4a24', '#3a200c');
      for (const y of [-34, 20]) limb(x, -2.4, y, 2.4, y, 1.4, 1.4, '#e2b33c', '#8a6418', 0.7);
      // claw holding the flame
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, -40); x.quadraticCurveTo(s * 7, -44, s * 4.5, -51); x.strokeStyle = '#3a200c'; x.lineWidth = 2; x.stroke(); }
      const fl = 1 + Math.sin(t * 14) * 0.12;
      x.drawImage(Art.glow('rgba(255,140,30,0.9)'), -12 * fl, -60 * fl, 24 * fl, 24 * fl);
      x.beginPath(); x.moveTo(-4, -46); x.quadraticCurveTo(-5, -54, 0, -60 - Math.sin(t * 11) * 2); x.quadraticCurveTo(5, -54, 4, -46); x.closePath();
      x.fillStyle = '#ffdd66'; x.fill();
      x.beginPath(); x.arc(0, -48, 2.4, 0, TAU); x.fillStyle = '#fff'; x.fill();
    } else {
      limb(x, 0, 30, 0, -40, 1.5, 1.6, '#eef4f8', '#8aa0b0');
      for (const y of [-30, 10]) limb(x, -2.2, y, 2.2, y, 1.2, 1.2, '#bfe9ff', '#4a8aaa', 0.7);
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, -38); x.quadraticCurveTo(s * 8, -44, s * 3, -53); x.strokeStyle = '#cfe0ea'; x.lineWidth = 1.8; x.stroke(); }
      x.drawImage(Art.glow('rgba(140,225,255,0.85)'), -12, -60, 24, 24);
      poly(x, [[0, -59], [4, -48], [0, -41], [-4, -48]], lg(x, -4, -59, 4, -41, ['#ffffff', '#7fdcff', '#2a8ac0']), 1, '#1a5a80');
    }
    x.restore();
  }
  function bow(x, grip, drawPt, pull) {
    // bow held vertically-ish at grip, string pulled toward drawPt
    const top = [grip[0] - 2, grip[1] - 26], bot = [grip[0] - 2, grip[1] + 26];
    x.beginPath(); x.moveTo(top[0], top[1]);
    x.quadraticCurveTo(grip[0] + 13, grip[1] - 14, grip[0] + 1, grip[1]);
    x.quadraticCurveTo(grip[0] + 13, grip[1] + 14, bot[0], bot[1]);
    x.strokeStyle = '#3a2410'; x.lineWidth = 4.4; x.lineCap = 'round'; x.stroke();
    x.strokeStyle = '#a0703a'; x.lineWidth = 2.6; x.stroke();
    const sx = pull > 0 ? drawPt[0] : grip[0] - 4, sy = pull > 0 ? drawPt[1] : grip[1];
    x.beginPath(); x.moveTo(top[0], top[1]); x.lineTo(sx, sy); x.lineTo(bot[0], bot[1]);
    x.strokeStyle = 'rgba(240,240,230,0.9)'; x.lineWidth = 0.8; x.stroke();
    if (pull > 0.15) { // nocked arrow
      seg(x, sx, sy, grip[0] + 16, grip[1], '#d8c49a', 1.4);
      poly(x, [[grip[0] + 20, grip[1]], [grip[0] + 15, grip[1] - 2.5], [grip[0] + 15, grip[1] + 2.5]], '#e8e8e8', 0.6);
      poly(x, [[sx, sy], [sx - 4, sy - 2.5], [sx - 2, sy], [sx - 4, sy + 2.5]], '#5cb85c', 0.5);
    }
  }

  // ---------------------------------------------------------------- hero builds
  const BUILDS = {
    // ===================== Iron Warden ======================
    warden(x, h, t, S) {
      const c = { leg: '#c9d2dc', legD: '#5d6a78', boot: '#aeb8c4', bootD: '#4a5562', thighW: 6, bootCuff: '#e2b33c' };
      const atk = 1 - Math.max(0, h.animAtk || 0), at = h.animAtk > 0;
      const sw = at ? (atk < 0.35 ? -2.5 + ease(atk / 0.35) * 3.4 : 0.9 - (atk - 0.35) / 0.65 * 0.6) : 0.35 + S.armSwing * 0.3;
      const cast = Math.max(0, h.animCast || 0);
      const F = arm([S.sh[0] + 3, S.sh[1]], at ? sw : 0.35 + S.armSwing * 0.3 - cast * 2, at ? sw + 0.9 : 1.2 - cast);
      const B = arm([S.sh[0] - 3, S.sh[1]], 0.75 - S.armSwing * 0.3, 1.5);
      // cape
      const fl = S.mv ? Math.sin(S.ph * 2) * 3 : Math.sin(t * 1.5);
      blob(x, [[S.sh[0] - 4, S.sh[1] - 2], [S.sh[0] - 12, S.hip[1] + 6], [S.sh[0] - 17 - fl, S.hip[1] + 28], [S.sh[0] - 4, S.hip[1] + 30], [S.sh[0] + 2, S.hip[1] + 4]],
        lg(x, 0, S.sh[1], 0, S.hip[1] + 30, ['#3a6fc0', '#1b3a70']), 1.2);
      limb(x, B.sh[0], B.sh[1], B.el[0], B.el[1], 4.6, 3.8, '#aeb8c4', '#4a5562');
      limb(x, B.el[0], B.el[1], B.hand[0], B.hand[1], 3.8, 3.2, '#aeb8c4', '#4a5562');
      legs(x, S, 'B', c); legs(x, S, 'F', c);
      // tasset / skirt of plates
      poly(x, [[S.hip[0] - 9, S.hip[1] - 2], [S.hip[0] + 10, S.hip[1] - 2], [S.hip[0] + 12, S.hip[1] + 12], [S.hip[0] - 11, S.hip[1] + 12]],
        lg(x, 0, S.hip[1], 0, S.hip[1] + 12, ['#2f5fa8', '#1b3a70']), 1.2);
      seg(x, S.hip[0], S.hip[1] + 1, S.hip[0], S.hip[1] + 12, '#e2b33c', 1.6);
      // breastplate
      blob(x, [[S.neck[0] - 9, S.neck[1] + 2], [S.neck[0] + 9, S.neck[1] + 1], [S.neck[0] + 12, S.neck[1] + 14], [S.hip[0] + 9, S.hip[1] - 1], [S.hip[0] - 9, S.hip[1] - 1], [S.neck[0] - 11, S.neck[1] + 14]],
        lg(x, S.neck[0] - 10, S.neck[1], S.neck[0] + 12, S.hip[1], ['#ffffff', '#c3ccd6', '#6b7888']), 1.3);
      seg(x, S.neck[0] + 2, S.neck[1] + 4, S.hip[0] + 2, S.hip[1] - 2, 'rgba(90,100,115,0.6)', 1);
      limb(x, S.hip[0] - 9, S.hip[1] - 2, S.hip[0] + 9, S.hip[1] - 2, 2.4, 2.4, '#ffe08a', '#a8741f', 0.9);
      // shield on far arm
      shield(x, B.hand);
      // helmet
      const H = S.headP;
      head(x, H, '#e8b996', '#a8765a', { noFace: true });
      blob(x, [[H[0] - 9, H[1] - 1], [H[0] - 8, H[1] - 9], [H[0] + 1, H[1] - 12.5], [H[0] + 9, H[1] - 8], [H[0] + 10.5, H[1] + 2], [H[0] + 8.5, H[1] + 9], [H[0] - 6, H[1] + 9]],
        lg(x, H[0] - 9, H[1] - 12, H[0] + 10, H[1] + 9, ['#ffffff', '#b8c3ce', '#5d6a78']), 1.3);
      seg(x, H[0] + 3, H[1] - 1.5, H[0] + 10.5, H[1] - 1.5, '#141018', 2.2, 'butt');
      seg(x, H[0] + 5.5, H[1] + 1.5, H[0] + 9.5, H[1] + 1.5, '#141018', 1.4, 'butt');
      seg(x, H[0] - 2, H[1] - 12, H[0] - 2, H[1] + 8, '#e2b33c', 1.6);
      // plume
      const pf = S.mv ? Math.sin(S.ph * 2) * 2 : Math.sin(t * 2);
      blob(x, [[H[0] - 1, H[1] - 12], [H[0] - 8, H[1] - 20], [H[0] - 20 - pf, H[1] - 16], [H[0] - 15, H[1] - 11], [H[0] - 5, H[1] - 10]], lg(x, H[0], H[1] - 20, H[0], H[1] - 10, ['#5a9af0', '#1b3a70']), 1);
      // pauldrons + weapon arm
      blob(x, [[S.sh[0] - 6, S.sh[1] - 3], [S.sh[0] + 3, S.sh[1] - 6], [S.sh[0] + 10, S.sh[1] - 1], [S.sh[0] + 8, S.sh[1] + 6], [S.sh[0] - 3, S.sh[1] + 5]],
        lg(x, S.sh[0], S.sh[1] - 6, S.sh[0], S.sh[1] + 6, ['#ffffff', '#8996a6']), 1.3);
      hammer(x, F.hand, at ? sw + 1.45 : 0.25 + S.armSwing * 0.2 - cast * 0.8);
      limb(x, F.sh[0], F.sh[1], F.el[0], F.el[1], 4.8, 4, '#dfe6ee', '#5d6a78');
      limb(x, F.el[0], F.el[1], F.hand[0], F.hand[1], 4, 3.4, '#dfe6ee', '#5d6a78');
      hand(x, F.hand, '#c9d2dc', '#4a5562', 3.8);
    },

    // ===================== Shadow Dancer ======================
    shade(x, h, t, S) {
      const c = { leg: '#4a3566', legD: '#1e142c', boot: '#2a1d3a', bootD: '#0e0816', thighW: 4.6 };
      const atk = 1 - Math.max(0, h.animAtk || 0), at = h.animAtk > 0;
      const slash = at ? -1.9 + ease(Math.min(1, atk / 0.5)) * 3.2 : 0;
      const F = arm([S.sh[0] + 2.5, S.sh[1]], at ? slash : 0.55 + S.armSwing * 0.5, at ? slash + 0.5 : 1.7);
      const B = arm([S.sh[0] - 2.5, S.sh[1]], at ? 0.9 - slash * 0.3 : -0.2 - S.armSwing * 0.5, at ? 1.8 : 1.6);
      // trailing scarf
      const fl = S.mv ? Math.sin(t * 12) * 3 : Math.sin(t * 3) * 1.5;
      blob(x, [[S.neck[0] - 3, S.neck[1] + 1], [S.neck[0] - 16, S.neck[1] + 2 + fl], [S.neck[0] - 30, S.neck[1] + 8 - fl], [S.neck[0] - 22, S.neck[1] + 9 + fl], [S.neck[0] - 4, S.neck[1] + 6]],
        lg(x, S.neck[0], 0, S.neck[0] - 30, 0, ['#7a4ab8', '#2e1a4a']), 1);
      limb(x, B.sh[0], B.sh[1], B.el[0], B.el[1], 3.4, 3, '#3d2b56', '#140c20');
      limb(x, B.el[0], B.el[1], B.hand[0], B.hand[1], 3, 2.6, '#3d2b56', '#140c20');
      dagger(x, B.hand, at ? 3.2 - slash * 0.3 : 3.7, '#b98aff');
      hand(x, B.hand, '#2a1d3a', '#0e0816', 2.8);
      legs(x, S, 'B', c); legs(x, S, 'F', c);
      // torso: wrapped leather
      blob(x, [[S.neck[0] - 6.5, S.neck[1] + 2], [S.neck[0] + 6.5, S.neck[1] + 2], [S.neck[0] + 8, S.neck[1] + 14], [S.hip[0] + 7, S.hip[1] + 2], [S.hip[0] - 7, S.hip[1] + 2], [S.neck[0] - 8, S.neck[1] + 14]],
        lg(x, S.neck[0] - 7, 0, S.neck[0] + 8, 0, ['#5a3f80', '#22143a']), 1.2);
      for (let i = 0; i < 4; i++) seg(x, S.neck[0] - 6, S.neck[1] + 8 + i * 5, S.neck[0] + 7, S.neck[1] + 5 + i * 5, 'rgba(10,5,20,0.55)', 1.2);
      limb(x, S.hip[0] - 7.5, S.hip[1], S.hip[0] + 7.5, S.hip[1] - 1, 1.8, 1.8, '#8a6ab8', '#3a2a55', 0.8);
      // hood
      const H = S.headP;
      head(x, H, '#d8c2b0', '#8a6a5a', { eyeCol: '#d6b3ff', eyeGlow: '#c08aff', browCol: 'rgba(0,0,0,0)' });
      blob(x, [[H[0] - 10, H[1] + 6], [H[0] - 10, H[1] - 6], [H[0] - 2, H[1] - 13], [H[0] + 8, H[1] - 10], [H[0] + 11, H[1] - 3], [H[0] + 4, H[1] - 6], [H[0] + 1, H[1] + 2], [H[0] - 2, H[1] + 10]],
        lg(x, H[0] - 10, H[1] - 12, H[0] + 8, H[1] + 8, ['#6a4a9a', '#1c1028']), 1.2);
      // mask over lower face
      blob(x, [[H[0] + 2, H[1] + 0.5], [H[0] + 10.5, H[1] + 0.5], [H[0] + 8.5, H[1] + 8], [H[0] + 1, H[1] + 9]], '#2a1d3a', 1);
      // front arm + dagger
      limb(x, F.sh[0], F.sh[1], F.el[0], F.el[1], 3.6, 3.1, '#5a3f80', '#22143a');
      limb(x, F.el[0], F.el[1], F.hand[0], F.hand[1], 3.1, 2.7, '#5a3f80', '#22143a');
      dagger(x, F.hand, at ? slash + 1.6 : 2.5, '#d6b3ff');
      hand(x, F.hand, '#3a2a50', '#120a1c', 2.9);
    },

    // ===================== Wind Ranger ======================
    ranger(x, h, t, S) {
      const c = { leg: '#6b4a2a', legD: '#3a2614', boot: '#7a5230', bootD: '#3a2410', thighW: 4.8, bootCuff: '#9a6a3a' };
      const at = h.animAtk > 0, a = Math.max(0, h.animAtk || 0);
      const pull = at ? (a > 0.75 ? 0 : Math.min(1, (0.75 - a) * 3)) : 0;
      // far arm extends the bow forward, near arm draws the string
      const B = arm([S.sh[0] - 2, S.sh[1]], at ? 1.45 : 0.6 + S.armSwing * 0.2, at ? 1.55 : 1.1);
      const F = arm([S.sh[0] + 2, S.sh[1]], at ? 1.25 - pull * 0.9 : 0.25 + S.armSwing * 0.4, at ? 2.6 + pull * 0.4 : 1.1);
      // cloak
      const fl = S.mv ? Math.sin(S.ph * 2) * 3 : Math.sin(t * 1.4);
      blob(x, [[S.sh[0] - 3, S.sh[1] - 3], [S.sh[0] - 13, S.hip[1] - 2], [S.sh[0] - 16 - fl, S.hip[1] + 24], [S.sh[0] - 3, S.hip[1] + 22], [S.sh[0] + 3, S.hip[1] + 2]],
        lg(x, 0, S.sh[1], 0, S.hip[1] + 24, ['#3c7a40', '#173a1a']), 1.2);
      // quiver
      x.save(); x.translate(S.sh[0] - 7, S.sh[1] + 2); x.rotate(-0.35);
      poly(x, [[-3.5, -6], [3.5, -6], [3, 18], [-3, 18]], lg(x, -3, 0, 3, 0, ['#9a6a3a', '#4a2e14']), 1);
      for (let i = -1; i <= 1; i++) { seg(x, i * 2, -6, i * 2, -12, '#d8c49a', 1.2); poly(x, [[i * 2 - 1.5, -12], [i * 2, -16], [i * 2 + 1.5, -12]], '#e8e2d0', 0.5); }
      x.restore();
      limb(x, B.sh[0], B.sh[1], B.el[0], B.el[1], 3.4, 3, '#3f7a3c', '#1d3f1c');
      limb(x, B.el[0], B.el[1], B.hand[0], B.hand[1], 3, 2.6, '#f0c8a0', '#a8784e');
      legs(x, S, 'B', c); legs(x, S, 'F', c);
      // tunic + belt
      blob(x, [[S.neck[0] - 6.5, S.neck[1] + 2], [S.neck[0] + 7, S.neck[1] + 2], [S.neck[0] + 8.5, S.neck[1] + 14], [S.hip[0] + 9, S.hip[1] + 8], [S.hip[0] - 9, S.hip[1] + 8], [S.neck[0] - 8, S.neck[1] + 14]],
        lg(x, S.neck[0] - 8, 0, S.neck[0] + 9, 0, ['#5ca25a', '#2a5a2a']), 1.2);
      seg(x, S.neck[0] + 2, S.neck[1] + 3, S.hip[0] + 3, S.hip[1] + 7, 'rgba(20,50,20,0.5)', 1);
      seg(x, S.sh[0] - 5, S.sh[1] - 1, S.hip[0] + 7, S.hip[1] - 3, '#6b4423', 2.4); // quiver strap
      limb(x, S.hip[0] - 8, S.hip[1], S.hip[0] + 8, S.hip[1] - 1, 1.9, 1.9, '#8a5a2a', '#3a2410', 0.8);
      x.beginPath(); x.rect(S.hip[0] + 1, S.hip[1] - 2.5, 3.5, 4); fillStroke(x, '#e2b33c', 0.7);
      // head with braid + hood down
      const H = S.headP;
      blob(x, [[H[0] - 6, H[1] + 4], [H[0] - 12, H[1] + 10], [H[0] - 10, H[1] + 18], [H[0] - 7, H[1] + 10]], '#8a4a22', 1);
      head(x, H, '#f3cba5', '#b07a52');
      blob(x, [[H[0] - 9, H[1] + 2], [H[0] - 8, H[1] - 8], [H[0] + 1, H[1] - 12], [H[0] + 8.5, H[1] - 8.5], [H[0] + 9, H[1] - 5], [H[0] + 2, H[1] - 6.5], [H[0] - 3, H[1] - 2]],
        lg(x, H[0] - 9, H[1] - 12, H[0] + 8, H[1], ['#b86a30', '#6a3414']), 1);
      blob(x, [[S.neck[0] - 8, S.neck[1] + 3], [S.neck[0] - 9, S.neck[1] - 3], [S.neck[0] + 1, S.neck[1] - 1], [S.neck[0] + 7, S.neck[1] + 3], [S.neck[0], S.neck[1] + 6]],
        '#2f5a30', 1.1); // hood folded at the shoulders
      // bow in the far hand, string drawn by near hand
      bow(x, B.hand, F.hand, pull);
      limb(x, F.sh[0], F.sh[1], F.el[0], F.el[1], 3.6, 3.1, '#4f944c', '#234a22');
      limb(x, F.el[0], F.el[1], F.hand[0], F.hand[1], 3.1, 2.7, '#f0c8a0', '#a8784e');
      hand(x, F.hand, '#7a5230', '#3a2410', 2.8);
    },

    // ===================== Pyromancer ======================
    pyro(x, h, t, S) {
      return robed(x, h, t, S, {
        robe: ['#d0412f', '#6e1a14'], trim: '#f2c14e', sleeve: ['#b8322b', '#5a120c'], skin: ['#e6a984', '#9a5a3a'],
        hood: ['#a82a20', '#4a0c08'], hair: null, staffKind: 'fire', eyeGlow: '#ffb347', sash: '#2a1208',
      });
    },
    // ===================== Frost Oracle ======================
    oracle(x, h, t, S) {
      return robed(x, h, t, S, {
        robe: ['#ffffff', '#8fb8d0'], trim: '#5fc8ef', sleeve: ['#eef6fb', '#7fa6c0'], skin: ['#f6dfcf', '#b88a76'],
        hood: null, hair: ['#ffffff', '#a8b8cc'], staffKind: 'ice', eyeGlow: '#bff3ff', sash: '#3a8ac0', circlet: true,
      });
    },

    // ===================== Blood Berserker ======================
    berserker(x, h, t, S) {
      const skin = '#d99a68', skinD = '#7a4a2a';
      const c = { leg: '#5a3a22', legD: '#2a1a0c', boot: '#8a6a4a', bootD: '#3a2814', thighW: 6.2, bootCuff: '#d8c8a8' };
      const atk = 1 - Math.max(0, h.animAtk || 0), at = h.animAtk > 0;
      const swA = at ? -2.4 + ease(Math.min(1, atk / 0.45)) * 3.4 : 0.4 + S.armSwing * 0.5;
      const swB = at ? -2.4 + ease(Math.max(0, Math.min(1, (atk - 0.25) / 0.45))) * 3.4 : -0.1 - S.armSwing * 0.5;
      const F = arm([S.sh[0] + 4, S.sh[1] + 1], swA, swA + (at ? 0.5 : 0.9), 16, 15);
      const B = arm([S.sh[0] - 4, S.sh[1] + 1], swB, swB + (at ? 0.5 : 0.9), 16, 15);
      limb(x, B.sh[0], B.sh[1], B.el[0], B.el[1], 5.8, 4.6, skin, skinD);
      limb(x, B.el[0], B.el[1], B.hand[0], B.hand[1], 4.6, 3.8, skin, skinD);
      axe(x, B.hand, at ? swB + 1.2 : 2.7);
      hand(x, B.hand, skin, skinD, 3.8);
      legs(x, S, 'B', c); legs(x, S, 'F', c);
      // fur kilt
      const k = [];
      for (let i = 0; i <= 8; i++) k.push([S.hip[0] - 11 + i * 2.8, S.hip[1] + 12 + (i % 2 ? 3 : 0)]);
      poly(x, [[S.hip[0] - 10, S.hip[1] - 3], [S.hip[0] + 11, S.hip[1] - 3], ...k.reverse()], lg(x, 0, S.hip[1], 0, S.hip[1] + 14, ['#9a7a5a', '#4a3420']), 1.1);
      // bare muscular torso
      blob(x, [[S.neck[0] - 10, S.neck[1] + 2], [S.neck[0] + 10, S.neck[1] + 1], [S.neck[0] + 13, S.neck[1] + 10], [S.hip[0] + 9, S.hip[1] - 2], [S.hip[0] - 9, S.hip[1] - 2], [S.neck[0] - 12, S.neck[1] + 10]],
        lg(x, S.neck[0] - 12, S.neck[1], S.neck[0] + 13, S.hip[1], ['#f0b888', skin, skinD]), 1.3);
      // pecs, abs, war paint
      x.beginPath(); x.moveTo(S.neck[0] - 4, S.neck[1] + 11); x.quadraticCurveTo(S.neck[0] + 4, S.neck[1] + 14, S.neck[0] + 11, S.neck[1] + 9);
      x.strokeStyle = 'rgba(90,45,20,0.6)'; x.lineWidth = 1.2; x.stroke();
      for (let i = 0; i < 3; i++) seg(x, S.neck[0] + 1, S.neck[1] + 16 + i * 4, S.neck[0] + 7, S.neck[1] + 15 + i * 4, 'rgba(90,45,20,0.4)', 1);
      seg(x, S.neck[0] - 8, S.neck[1] + 4, S.hip[0] + 6, S.hip[1] - 4, 'rgba(190,20,20,0.85)', 2.6);
      seg(x, S.neck[0] - 2, S.neck[1] + 4, S.neck[0] + 9, S.neck[1] + 12, 'rgba(190,20,20,0.85)', 2.2);
      limb(x, S.hip[0] - 10, S.hip[1] - 3, S.hip[0] + 10, S.hip[1] - 3, 2.6, 2.6, '#6b4a2a', '#2a1a0a', 0.9);
      x.beginPath(); x.arc(S.hip[0] + 2, S.hip[1] - 3, 3, 0, TAU); fillStroke(x, '#cfd6de', 0.8);
      // fur shoulder mantle
      blob(x, [[S.neck[0] - 12, S.neck[1] + 4], [S.neck[0] - 9, S.neck[1] - 3], [S.neck[0] + 2, S.neck[1] - 4], [S.neck[0] + 9, S.neck[1] + 1], [S.neck[0] + 2, S.neck[1] + 6], [S.neck[0] - 6, S.neck[1] + 7]],
        lg(x, 0, S.neck[1] - 4, 0, S.neck[1] + 7, ['#e8dcc8', '#8a7458']), 1.1);
      // head: beard, mohawk, paint
      const H = S.headP;
      head(x, H, '#e0a674', '#8a5634', { browCol: 'rgba(30,15,5,0.95)' });
      seg(x, H[0] + 3, H[1] - 2, H[0] + 8, H[1] - 1, 'rgba(190,20,20,0.85)', 1.6);
      blob(x, [[H[0] - 3, H[1] + 3], [H[0] + 9, H[1] + 4], [H[0] + 8, H[1] + 13], [H[0] + 2, H[1] + 16], [H[0] - 4, H[1] + 9]],
        lg(x, 0, H[1] + 3, 0, H[1] + 16, ['#4a2a14', '#1a0c04']), 1);
      seg(x, H[0] + 5, H[1] + 4.5, H[0] + 8.5, H[1] + 4.5, '#2a1208', 1.2);
      blob(x, [[H[0] - 9, H[1] - 4], [H[0] - 6, H[1] - 14], [H[0] + 1, H[1] - 17], [H[0] + 6, H[1] - 13], [H[0] + 3, H[1] - 9], [H[0] - 4, H[1] - 7]],
        lg(x, 0, H[1] - 17, 0, H[1] - 5, ['#3a1a0a', '#0c0602']), 1);
      // front arm + axe
      axe(x, F.hand, at ? swA + 1.2 : 2.4);
      limb(x, F.sh[0], F.sh[1], F.el[0], F.el[1], 6.2, 4.8, '#f0b888', skinD);
      limb(x, F.el[0], F.el[1], F.hand[0], F.hand[1], 4.8, 3.9, '#f0b888', skinD);
      limb(x, F.el[0] + (F.hand[0] - F.el[0]) * 0.4, F.el[1] + (F.hand[1] - F.el[1]) * 0.4, F.el[0] + (F.hand[0] - F.el[0]) * 0.85, F.el[1] + (F.hand[1] - F.el[1]) * 0.85, 4.4, 4, '#7a5a3a', '#3a2814', 0.9); // bracer
      hand(x, F.hand, '#e8a878', skinD, 4);
    },
  };

  // shared robed caster (pyro / oracle)
  function robed(x, h, t, S, o) {
    const cast = Math.max(0, h.animCast || 0), at = h.animAtk > 0, a = Math.max(0, h.animAtk || 0);
    const thrust = Math.max(cast, at ? Math.sin(a * Math.PI) : 0);
    const F = arm([S.sh[0] + 2.5, S.sh[1]], 0.45 + S.armSwing * 0.25 + thrust * 0.9, 1.2 + thrust * 0.5);
    const B = arm([S.sh[0] - 2.5, S.sh[1]], cast ? 1.9 * cast : -0.15 - S.armSwing * 0.3, cast ? 2.6 : 1.3);
    // hair (long, oracle) behind
    const H = S.headP;
    if (o.hair) {
      const fl = S.mv ? Math.sin(t * 10) * 2 : Math.sin(t * 2) * 1;
      blob(x, [[H[0] - 6, H[1] - 9], [H[0] - 12, H[1] + 4], [H[0] - 15 - fl, H[1] + 22], [H[0] - 7, H[1] + 26], [H[0] - 2, H[1] + 6]],
        lg(x, 0, H[1] - 9, 0, H[1] + 26, o.hair), 1.1);
    }
    // back sleeve + hand
    limb(x, B.sh[0], B.sh[1], B.el[0], B.el[1], 3.6, 4.2, o.sleeve[0], o.sleeve[1]);
    limb(x, B.el[0], B.el[1], B.hand[0], B.hand[1], 4.4, 4.8, o.sleeve[0], o.sleeve[1]);
    hand(x, B.hand, o.skin[0], o.skin[1], 2.8);
    if (cast > 0.05) x.drawImage(Art.glow(o.staffKind === 'fire' ? 'rgba(255,140,40,0.9)' : 'rgba(140,225,255,0.9)'), B.hand[0] - 12, B.hand[1] - 12, 24, 24);
    // feet peeking under the robe
    for (const side of ['B', 'F']) {
      const l = S.legs[side], a2 = l.ank, tp = l.toe;
      blob(x, [[a2[0] - 3.5, a2[1] - 4], [a2[0] + 3, a2[1] - 4], [tp[0] + 1.5, tp[1] - 1.5], [tp[0] + 1.5, tp[1] + 1], [a2[0] - 4, a2[1] + 1.8]], '#3a2418', 1);
    }
    // robe body with swaying hem
    const sway = S.mv ? Math.sin(S.ph) * 4 : Math.sin(t * 1.6) * 0.8;
    const hemY = -5;
    const robePts = [
      [S.neck[0] - 6.5, S.neck[1] + 2], [S.neck[0] + 7, S.neck[1] + 2], [S.neck[0] + 8.5, S.neck[1] + 15], [S.hip[0] + 9, S.hip[1]],
      [S.hip[0] + 14 + sway, hemY + 1], [S.hip[0] + 3 + sway * 0.5, hemY + 3], [S.hip[0] - 8 - sway * 0.3, hemY + 2], [S.hip[0] - 14 - sway * 0.6, hemY],
      [S.hip[0] - 9, S.hip[1]], [S.neck[0] - 8.5, S.neck[1] + 15],
    ];
    poly(x, robePts, lg(x, S.neck[0] - 10, 0, S.neck[0] + 14, 0, [o.robe[0], o.robe[1]]), 1.3);
    // folds + trim
    for (const fx of [-5, 1, 7]) {
      x.beginPath(); x.moveTo(S.hip[0] + fx * 0.6, S.hip[1] + 2); x.quadraticCurveTo(S.hip[0] + fx + sway * 0.3, (S.hip[1] + hemY) / 2, S.hip[0] + fx * 1.4 + sway * 0.6, hemY + 1);
      x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1.2; x.stroke();
    }
    seg(x, S.hip[0] - 14 - sway * 0.6, hemY, S.hip[0] + 14 + sway, hemY + 1, o.trim, 2.4);
    seg(x, S.neck[0] + 4, S.neck[1] + 3, S.hip[0] + 6, hemY + 2, o.trim, 1.6);
    limb(x, S.hip[0] - 9, S.hip[1], S.hip[0] + 9, S.hip[1] - 1, 2.2, 2.2, o.sash, '#000', 0.9);
    // collar
    blob(x, [[S.neck[0] - 7, S.neck[1] + 4], [S.neck[0] - 6, S.neck[1] - 2], [S.neck[0] + 6, S.neck[1] - 2], [S.neck[0] + 8, S.neck[1] + 4], [S.neck[0], S.neck[1] + 6]],
      lg(x, 0, S.neck[1] - 2, 0, S.neck[1] + 6, [o.trim, '#000']), 1);
    // head
    head(x, H, o.skin[0], o.skin[1], { eyeGlow: o.eyeGlow });
    if (o.hood) {
      blob(x, [[H[0] - 11, H[1] + 8], [H[0] - 11, H[1] - 6], [H[0] - 3, H[1] - 14.5], [H[0] + 8, H[1] - 11], [H[0] + 12, H[1] - 2], [H[0] + 5, H[1] - 6.5], [H[0] + 1, H[1] + 3], [H[0] - 3, H[1] + 11]],
        lg(x, H[0] - 11, H[1] - 14, H[0] + 10, H[1] + 10, o.hood), 1.3);
      seg(x, H[0] + 5, H[1] - 6.5, H[0] + 1, H[1] + 3, o.trim, 1.4);
    }
    if (o.hair) {
      blob(x, [[H[0] - 9, H[1] + 2], [H[0] - 8.5, H[1] - 8], [H[0] + 1, H[1] - 12], [H[0] + 9, H[1] - 8], [H[0] + 9, H[1] - 4.5], [H[0] + 2, H[1] - 6.5], [H[0] - 2, H[1] + 1]],
        lg(x, H[0], H[1] - 12, H[0], H[1] + 2, o.hair), 1);
    }
    if (o.circlet) {
      seg(x, H[0] - 7, H[1] - 6, H[0] + 8, H[1] - 6.5, '#d8e6f0', 1.4);
      poly(x, [[H[0] + 6, H[1] - 6.5], [H[0] + 7.5, H[1] - 10], [H[0] + 9, H[1] - 6.5]], '#8fe3ff', 0.7);
    }
    // staff + front arm
    staff(x, F.hand, 0.35 + S.armSwing * 0.1 - thrust * 0.25, o.staffKind, t);
    limb(x, F.sh[0], F.sh[1], F.el[0], F.el[1], 3.8, 4.4, o.sleeve[0], o.sleeve[1]);
    limb(x, F.el[0], F.el[1], F.hand[0], F.hand[1], 4.6, 5.2, o.sleeve[0], o.sleeve[1]);
    hand(x, F.hand, o.skin[0], o.skin[1], 2.9);
  }

  const DESIGN = { warden: { stance: 1.4 }, berserker: { stance: 1.5 }, shade: { stance: 1.1, leg: 22 }, ranger: {}, pyro: { stride: 0.6 }, oracle: { stride: 0.6 } };

  function drawFigure(x, h, t) {
    const D = DESIGN[h.def.id] || {};
    const S = pose(h, t, D);
    BUILDS[h.def.id](x, h, t, S);
  }

  // ---------------------------------------------------------------- world draw with outline
  const bufs = {};
  // ctx origin should be at the hero's feet. height = on-screen world height of the figure.
  function draw(ctx, h, t, height, scale) {
    const S = Math.max(1, Math.min(3, scale || 2));
    const k = height / 100;                       // design → world
    const wW = 190 * k, wH = 165 * k;             // world-size of buffer
    const bw = Math.ceil(wW * S), bh = Math.ceil(wH * S);
    let B = bufs[h.id];
    if (!B || B.raw.width !== bw || B.raw.height !== bh) B = bufs[h.id] = { raw: mk(bw, bh), sil: mk(bw, bh) };
    const fx = Math.cos(h.facing);
    if (fx > 0.2) h._flip = 1; else if (fx < -0.2) h._flip = -1; else if (!h._flip) h._flip = 1;
    const x = B.raw.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, bw, bh);
    x.translate(bw / 2, bh * 0.86);
    x.scale(S * k * h._flip, S * k);
    drawFigure(x, h, t);
    const sx = B.sil.getContext('2d');
    sx.globalCompositeOperation = 'source-over';
    sx.clearRect(0, 0, bw, bh);
    sx.drawImage(B.raw, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = 'rgba(10,6,4,0.9)'; sx.fillRect(0, 0, bw, bh);
    const ox = -wW / 2, oy = -wH * 0.86, o = 0.9;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.drawImage(B.sil, ox + Math.cos(a) * o, oy + Math.sin(a) * o, wW, wH);
    }
    ctx.drawImage(B.raw, ox, oy, wW, wH);
  }

  // head-and-shoulders portrait
  function portrait(defId, size) {
    const c = mk(size, size), x = c.getContext('2d');
    const def = HERO_BY_ID[defId];
    const bg = x.createRadialGradient(size * 0.45, size * 0.35, 2, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, Art.shadeColor(def.color, 0.15)); bg.addColorStop(1, Art.shadeColor(def.color, -0.8));
    x.fillStyle = bg; x.fillRect(0, 0, size, size);
    x.drawImage(Art.glow('rgba(255,240,210,0.35)'), size * 0.05, -size * 0.1, size * 0.9, size * 0.9);
    const fake = { id: 'portrait-' + defId, def, animAtk: 0, animCast: 0, walk: 0, moving: false, facing: 0 };
    const S = pose(fake, 0.4, DESIGN[defId] || {});
    const k = size / 46;
    x.save();
    x.translate(size * 0.47 - S.headP[0] * k, size * 0.42 - S.headP[1] * k);
    x.scale(k, k);
    BUILDS[defId](x, fake, 0.4, S);
    x.restore();
    // frame shading
    const v = x.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = v; x.fillRect(0, 0, size, size);
    return c;
  }

  // full-body card art (menu)
  function fullBody(defId, w, hgt) {
    const c = mk(w, hgt), x = c.getContext('2d');
    const def = HERO_BY_ID[defId];
    const fake = { id: 'full-' + defId, def, animAtk: 0, animCast: 0, walk: 0, moving: false, facing: 0 };
    const k = hgt / 118;
    x.translate(w / 2, hgt * 0.93); x.scale(k, k);
    x.drawImage(Art.soft('rgba(0,0,0,0.6)'), -26, -6, 52, 12);
    drawFigure(x, fake, 0.4);
    return c;
  }

  return { draw, portrait, fullBody, drawFigure, pose };
})();

// Route the existing renderer/UI hooks to the new figures.
Art.heroPortrait = (defId, size) => HeroArt.portrait(defId, size);
