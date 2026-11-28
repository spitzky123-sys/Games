'use strict';
// ============================================================================
//  Canvas renderer. Both lanes live on one big map, separated by a river:
//  [ lane 0 ][ river ][ lane 1 ]. Simulation stays lane-local; we offset.
// ============================================================================
const Render = (() => {
  const TAU = Math.PI * 2;
  let canvas, ctx, W = 0, H = 0, dpr = 1, TS = 1;
  let terrain = null, canopy = null, river = null, clouds = null;
  const GAP = 440;
  const LANE_OX = [0, WORLD_W + GAP];
  const FULL_W = WORLD_W * 2 + GAP;
  const cam = { x: HERO_SPAWN.x, y: HERO_SPAWN.y - 200, scale: 1, zoom: 1 };
  const parts = [[], []];
  const lights = [[], []];
  let curParts = parts[0], curLane = 0, viewLaneNow = 0;
  let vignette = null, sunlight = null;
  let time = 0, flash = 0, flashCol = '255,255,255';
  const PMAX = 700;
  const HERO_BADGE = ['#46e06e', '#ff4d4d'];
  const LANE_BANNER = ['#2f6fd0', '#c0392b'];
  const motes = [];

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 2);
    TS = lowMem ? 1 : 1.5;
    const t = Art.buildTerrain(TS);
    terrain = t.ground; canopy = t.canopy;
    river = Art.buildRiver(GAP, Math.min(TS, 1.25));
    clouds = Art.buildClouds();
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cam.scale = Math.min(W, H) / 540 * cam.zoom;
    const cw = canvas.width, ch = canvas.height;
    vignette = Art.mk(cw, ch);
    let v = vignette.getContext('2d');
    let g = v.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.38, cw / 2, ch / 2, Math.max(cw, ch) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,0,15,0.6)');
    v.fillStyle = g; v.fillRect(0, 0, cw, ch);
    sunlight = Art.mk(cw, ch);
    v = sunlight.getContext('2d');
    g = v.createRadialGradient(cw * 0.15, -ch * 0.2, 0, cw * 0.15, -ch * 0.2, Math.max(cw, ch) * 1.1);
    g.addColorStop(0, 'rgba(255,214,150,0.30)'); g.addColorStop(0.5, 'rgba(255,200,140,0.08)'); g.addColorStop(1, 'rgba(60,80,160,0.06)');
    v.fillStyle = g; v.fillRect(0, 0, cw, ch);
  }
  function setZoom(z) { cam.zoom = U.clamp(z, 0.6, 1.8); cam.scale = Math.min(W, H) / 540 * cam.zoom; }

  function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / cam.scale + cam.x, y: (sy - H / 2) / cam.scale + cam.y };
  }
  function screenToLane(sx, sy, lane) {
    const w = screenToWorld(sx, sy);
    return { x: w.x - LANE_OX[lane], y: w.y };
  }
  function worldToScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.scale + W / 2, y: (wy - cam.y) * cam.scale + H / 2 };
  }

  // ------------------------------------------------------------ particles
  function P(o) {
    const arr = curParts;
    if (arr.length >= PMAX) arr.shift();
    o.life = o.max = o.life || 0.6;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.z = o.z || 0; o.vz = o.vz || 0;
    o.size = o.size || 6; o.mode = o.mode || 'glow'; o.grav = o.grav || 0; o.drag = o.drag || 0;
    arr.push(o);
    return o;
  }
  function burst(x, y, n, color, spd, life, size, extra) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = spd * (0.3 + Math.random() * 0.7);
      P(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color }, extra));
    }
  }
  function light(x, y, r, color, life) {
    lights[curLane].push({ x, y, r, color, life, max: life });
  }
  function updateParticles(dt) {
    for (let li = 0; li < 2; li++) {
      for (const p of parts[li]) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.z < 0 && p.grav) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      }
      parts[li] = parts[li].filter(p => p.life > 0);
      for (const l of lights[li]) l.life -= dt;
      lights[li] = lights[li].filter(l => l.life > 0);
    }
    curParts = parts[curLane];
  }
  function drawParticles(additive) {
    for (const p of curParts) {
      const add = p.mode === 'glow' || p.mode === 'spark';
      if (add !== additive) continue;
      const k = Math.max(0, p.life / p.max);
      const s = p.size * (p.grow ? (1 + (1 - k) * p.grow) : (0.4 + k * 0.6));
      ctx.globalAlpha = Math.min(1, k * 1.4) * (p.alpha || 1);
      if (p.mode === 'glow') ctx.drawImage(Art.glow(p.color), p.x - s, p.y - p.z - s, s * 2, s * 2);
      else if (p.mode === 'soft') ctx.drawImage(Art.soft(p.color), p.x - s, p.y - p.z - s, s * 2, s * 2);
      else if (p.mode === 'spark') {
        ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - p.z); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.z - p.vy * 0.04); ctx.stroke();
      } else if (p.mode === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.4, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.4, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.mode === 'arrow') {
        ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot);
        ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y - p.z, s, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // lights + screen flashes that accompany logic fx
  const FX_LIGHT = {
    shockwave: [1.1, 'rgba(150,210,255,0.55)', 0.5], explosion: [1.5, 'rgba(255,150,60,0.7)', 0.7],
    frostburst: [1.2, 'rgba(150,230,255,0.55)', 0.7], glacial: [1.3, 'rgba(160,230,255,0.6)', 1.1],
    blink: [0, 'rgba(180,120,255,0.6)', 0.5], levelup: [0, 'rgba(255,220,100,0.6)', 1], leak: [0, 'rgba(255,40,60,0.7)', 0.7],
    whirl: [1.2, 'rgba(255,40,40,0.45)', 0.4], roar: [0, 'rgba(255,60,40,0.5)', 0.5], healpulse: [0.8, 'rgba(110,255,140,0.35)', 0.6],
    shieldup: [0, 'rgba(255,215,100,0.5)', 0.6], potion: [0, 'rgba(255,255,255,0.25)', 0.5],
  };
  function fxExtras(f) {
    const L = FX_LIGHT[f.kind];
    if (L) light(f.x, f.y, L[0] ? f.r * L[0] : 120, L[1], L[2]);
    if (f.kind === 'erupt') {
      for (let i = 0; i <= 4; i++) light(U.lerp(f.x1, f.x2, i / 4), U.lerp(f.y1, f.y2, i / 4), 160, 'rgba(255,140,50,0.6)', 0.9);
    }
    if (curLane === viewLaneNow) {
      if (f.kind === 'glacial') { flash = 0.35; flashCol = '200,240,255'; }
      if (f.kind === 'erupt' || (f.kind === 'explosion' && f.big)) { flash = Math.max(flash, 0.18); flashCol = '255,200,140'; }
    }
  }

  // spawn particles when a logic fx first appears
  const DEATH_COL = { gnoll: '#8b5a2b', wolf: '#777', spider: '#5a3470', archer: '#5f9a5a', golem: '#999', harpy: '#a070c0',
    shaman: '#8a5ab0', ogre: '#c49a6c', wraith: '#9fe8ff', drake: '#c0392b', titan: '#555', warlord: '#a03020',
    broodmother: '#6b8a3a', abomination: '#8fae7a', dragon: '#5a3a80' };
  function onFx(f) {
    switch (f.kind) {
      case 'shockwave':
        burst(f.x, f.y, 30, 'rgba(170,150,110,0.7)', f.r * 2.2, 0.6, 10, { mode: 'soft', drag: 3 });
        burst(f.x, f.y, 24, 'rgba(150,210,255,0.9)', f.r * 2.5, 0.4, 7, { mode: 'spark', drag: 2 });
        break;
      case 'blink':
        burst(f.x, f.y, f.big ? 30 : 18, 'rgba(150,90,220,0.8)', 160, 0.7, 14, { mode: 'soft', drag: 2 });
        burst(f.x, f.y, 14, 'rgba(210,170,255,0.9)', 220, 0.4, 6, { mode: 'glow' });
        break;
      case 'hitspark':
        burst(f.x, f.y, 5, 'rgba(255,240,200,0.9)', 220, 0.18, 6, { mode: 'spark' });
        break;
      case 'critslash':
        burst(f.x, f.y, 10, 'rgba(255,80,80,0.95)', 300, 0.3, 8, { mode: 'spark' });
        break;
      case 'frostburst':
        burst(f.x, f.y, 28, 'rgba(190,240,255,0.95)', f.r * 2.2, 0.7, 7, { mode: 'shard', rot: 0, vr: 6, drag: 3 });
        burst(f.x, f.y, 16, 'rgba(120,210,255,0.6)', f.r * 1.5, 0.8, 22, { mode: 'glow', drag: 3 });
        break;
      case 'explosion':
        burst(f.x, f.y, f.big ? 40 : 26, 'rgba(255,140,40,0.85)', f.r * 2.2, 0.6, f.big ? 26 : 18, { mode: 'glow', drag: 3 });
        burst(f.x, f.y, 18, 'rgba(255,230,140,0.95)', f.r * 3, 0.35, 6, { mode: 'spark', drag: 2 });
        burst(f.x, f.y, f.big ? 20 : 10, 'rgba(60,50,45,0.6)', f.r * 1.2, 1.1, 22, { mode: 'soft', drag: 2, grow: 1 });
        if (f.big) burst(f.x, f.y, 14, '#5a4636', 240, 1, 4, { mode: 'solid', vz: 260, grav: 700 });
        break;
      case 'erupt': {
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const x = U.lerp(f.x1, f.x2, i / n), y = U.lerp(f.y1, f.y2, i / n);
          burst(x, y, 2, '#6a5340', 120, 1, 5, { mode: 'solid', vz: 300 + Math.random() * 200, grav: 900 });
          burst(x, y, 1, 'rgba(255,150,60,0.8)', 60, 0.6, 22, { mode: 'glow' });
          burst(x, y, 1, 'rgba(120,100,80,0.5)', 60, 1.2, 26, { mode: 'soft', grow: 1 });
        }
        break;
      }
      case 'glacial':
        burst(f.x, f.y, 60, 'rgba(200,245,255,0.95)', f.r * 2, 0.9, 9, { mode: 'shard', rot: 0, vr: 5, drag: 2.5 });
        burst(f.x, f.y, 30, 'rgba(120,210,255,0.6)', f.r * 1.6, 1, 30, { mode: 'glow', drag: 2.5 });
        break;
      case 'whirl':
        burst(f.x, f.y, 26, 'rgba(200,20,30,0.9)', f.r * 2.5, 0.4, 6, { mode: 'solid', drag: 3 });
        break;
      case 'levelup':
        for (let i = 0; i < 24; i++) P({ x: f.x + U.rand(-22, 22), y: f.y + U.rand(-10, 10), vz: U.rand(60, 160), life: U.rand(0.6, 1.2), size: U.rand(4, 8), color: 'rgba(255,220,90,0.9)', mode: 'glow' });
        break;
      case 'potion':
        for (let i = 0; i < 14; i++) P({ x: f.x + U.rand(-16, 16), y: f.y + U.rand(-6, 6), vz: U.rand(40, 110), life: U.rand(0.5, 1), size: U.rand(4, 7), color: f.color, mode: 'glow' });
        break;
      case 'death': {
        const col = DEATH_COL[f.type] || '#888';
        burst(f.x, f.y, Math.round(f.r * 0.8), col, 120, 0.6, f.r * 0.3, { mode: 'solid', vz: 120, grav: 500 });
        burst(f.x, f.y, 4, 'rgba(80,70,60,0.45)', 40, 0.8, f.r * 0.9, { mode: 'soft', grow: 1 });
        if (f.type === 'wraith') burst(f.x, f.y, 12, 'rgba(160,240,255,0.8)', 80, 0.9, 10, { mode: 'glow', vz: 40 });
        if (f.r > 25) burst(f.x, f.y, 20, 'rgba(255,220,120,0.9)', 220, 0.6, 9, { mode: 'glow' });
        break;
      }
      case 'herodeath':
        burst(f.x, f.y, 40, 'rgba(120,20,20,0.8)', 160, 1, 10, { mode: 'soft', drag: 2 });
        break;
      case 'healpulse':
        for (let i = 0; i < 8; i++) P({ x: f.x + U.rand(-f.r * 0.6, f.r * 0.6), y: f.y + U.rand(-f.r * 0.6, f.r * 0.6), vz: 50, life: 0.8, size: 6, color: 'rgba(110,255,140,0.8)', mode: 'glow' });
        break;
      case 'leak':
        burst(f.x, f.y - 20, 30, 'rgba(255,60,80,0.8)', 220, 0.7, 12, { mode: 'glow', drag: 2 });
        break;
      case 'roar':
        burst(f.x, f.y, f.big ? 30 : 16, 'rgba(255,60,40,0.7)', 260, 0.5, 10, { mode: 'glow', drag: 3 });
        break;
      case 'shieldup':
        burst(f.x, f.y, 18, 'rgba(255,220,120,0.9)', 120, 0.6, 7, { mode: 'glow', drag: 2 });
        break;
    }
  }

  // ------------------------------------------------------------ units
  function drawShadow(x, y, r, lift = 0, a = 1) {
    ctx.globalAlpha = a;
    ctx.drawImage(Art.soft('rgba(0,0,0,0.6)'), x - r * 1.15 + 3 + lift * 0.4, y - r * 0.2 + lift, r * 2.3, r * 1.2);
    ctx.globalAlpha = 1;
  }

  function drawCreep(c) {
    const fly = c.flying ? 24 + Math.sin(c.anim * 3) * 4 : 0;
    const moving = c.stun <= 0 && c.animAtk <= 0;
    const spr = Art.creepSprite(c.type, moving ? Math.floor(c.anim * (c.flying ? 6 : 5)) % 2 : 0);
    const span = spr.span;
    if (c.sentBy >= 0) {
      ctx.strokeStyle = 'rgba(255,120,60,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * 0.35, c.r * 0.95, c.r * 0.48, 0, 0, TAU); ctx.stroke();
    }
    if (c.boss) ctx.drawImage(Art.glow('rgba(255,60,40,0.35)'), c.x - c.r * 2, c.y - c.r * 2 - fly, c.r * 4, c.r * 4);
    if (c.slows.length) {
      ctx.fillStyle = 'rgba(110,190,255,0.28)';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * 0.3, c.r * 1.1, c.r * 0.55, 0, 0, TAU); ctx.fill();
    }
    ctx.save();
    const bob = moving && !c.flying ? Math.abs(Math.sin(c.anim * 10)) * 1.6 : 0;
    ctx.translate(c.x, c.y - fly - bob);
    const lunge = c.animAtk > 0 ? Math.sin(c.animAtk * Math.PI) * 6 : 0;
    ctx.rotate(c.facing);
    ctx.translate(lunge, 0);
    const sq = moving ? 1 + Math.sin(c.anim * 10) * 0.025 : 1;
    ctx.scale(sq, 2 - sq);
    ctx.drawImage(spr, -span / 2, -span / 2, span, span);
    if (c.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
      ctx.drawImage(spr, -span / 2, -span / 2, span, span);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (c.stun > 0) {
      if (c.stunKind === 'freeze') {
        const s = c.r * 1.3, y = c.y - fly;
        const g = ctx.createLinearGradient(c.x - s, y - s, c.x + s, y + s);
        g.addColorStop(0, 'rgba(230,250,255,0.75)'); g.addColorStop(1, 'rgba(120,200,255,0.45)');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(240,252,255,0.95)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(c.x - s, y - s * 0.5); ctx.lineTo(c.x - s * 0.3, y - s * 1.15); ctx.lineTo(c.x + s * 0.8, y - s * 0.9);
        ctx.lineTo(c.x + s, y + s * 0.7); ctx.lineTo(c.x - s * 0.7, y + s * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x - s * 0.5, y - s * 0.6); ctx.lineTo(c.x + s * 0.2, y + s * 0.4); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
      } else {
        for (let i = 0; i < 3; i++) {
          const a = time * 5 + i * TAU / 3;
          ctx.drawImage(Art.glow('rgba(255,230,90,0.9)'), c.x + Math.cos(a) * c.r * 0.7 - 5, c.y - fly - c.r - 6 + Math.sin(a) * 4 - 5, 10, 10);
        }
      }
    }
    if (c.burns.length && Math.random() < 0.35) {
      P({ x: c.x + U.rand(-c.r * 0.5, c.r * 0.5), y: c.y - fly + U.rand(-4, 4), vz: U.rand(40, 90), life: 0.45, size: U.rand(5, 9), color: 'rgba(255,120,30,0.85)', mode: 'glow' });
    }
    if (c.type === 'wraith' && Math.random() < 0.18) P({ x: c.x, y: c.y, vz: 20, life: 0.6, size: 6, color: 'rgba(150,230,255,0.6)', mode: 'glow' });
    if ((c.type === 'drake' || c.type === 'dragon') && Math.random() < 0.08) P({ x: c.x + Math.cos(c.facing) * c.r, y: c.y - fly + Math.sin(c.facing) * c.r, vz: 20, life: 0.4, size: 6, color: 'rgba(255,120,40,0.7)', mode: 'glow' });
    if (c.type === 'shaman' && Math.random() < 0.1) P({ x: c.x, y: c.y, vz: 50, life: 0.6, size: 5, color: 'rgba(120,255,220,0.7)', mode: 'glow' });
  }

  function drawHeroUnit(h, badge) {
    if (!h.alive) return;
    const r = h.r * h.size * 1.15;
    // ground aura
    ctx.drawImage(Art.glow(badge === HERO_BADGE[0] ? 'rgba(70,224,110,0.28)' : 'rgba(255,77,77,0.28)'), h.x - r * 2, h.y - r * 1.6 + 6, r * 4, r * 3.2);
    ctx.strokeStyle = badge; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -time * 20;
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 5, r * 1.3, r * 0.72, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (h.hasBuff('bulwark')) ctx.drawImage(Art.glow('rgba(255,210,90,0.4)'), h.x - r * 2.4, h.y - r * 2.4, r * 4.8, r * 4.8);
    if (h.hasBuff('frenzy') || h.hasBuff('rampage')) ctx.drawImage(Art.glow('rgba(255,40,30,0.4)'), h.x - r * 2.4, h.y - r * 2.4, r * 4.8, r * 4.8);
    if (h.atFountain && h.hp < h.maxHp && Math.random() < 0.3) P({ x: h.x + U.rand(-14, 14), y: h.y, vz: 60, life: 0.7, size: 5, color: 'rgba(140,255,170,0.8)', mode: 'glow' });
    // footstep dust
    if (h.moving && Math.random() < 0.25) P({ x: h.x - Math.cos(h.facing) * r * 0.6, y: h.y - Math.sin(h.facing) * r * 0.6 + 6, life: 0.5, size: 7, color: 'rgba(150,130,95,0.35)', mode: 'soft', grow: 1 });
    let face = h.facing;
    if (h.hasBuff('bladefury')) face = time * 22;
    const bob = h.moving ? Math.abs(Math.sin(h.walk)) * 2 : Math.sin(time * 2) * 0.6;
    ctx.save();
    ctx.translate(h.x, h.y - bob);
    Art.drawHeroOutlined(ctx, h, time, r, face, cam.scale * dpr);
    if (h.hitFlash > 0) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#f33';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (h.hasBuff('bladefury')) {
      ctx.strokeStyle = 'rgba(210,180,255,0.65)'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const a = time * 20 + i * TAU / 3;
        ctx.beginPath(); ctx.arc(h.x, h.y, 70 + i * 30, a, a + 1.2); ctx.stroke();
      }
      if (Math.random() < 0.5) P({ x: h.x + U.rand(-150, 150), y: h.y + U.rand(-150, 150), life: 0.3, size: 7, color: 'rgba(200,160,255,0.8)', mode: 'glow' });
    }
    if (h.def.id === 'pyro' && Math.random() < 0.45) {
      P({ x: h.x + Math.cos(h.facing + 0.5) * r * 1.4, y: h.y + Math.sin(h.facing + 0.5) * r * 1.4, vz: 50, life: 0.4, size: 5, color: 'rgba(255,150,40,0.9)', mode: 'glow' });
    }
    if (h.def.id === 'oracle' && Math.random() < 0.2) P({ x: h.x + U.rand(-20, 20), y: h.y + U.rand(-20, 20), vz: 30, life: 0.7, size: 4, color: 'rgba(180,240,255,0.8)', mode: 'glow' });
    if (h.def.id === 'shade' && h.moving && Math.random() < 0.3) P({ x: h.x, y: h.y, life: 0.5, size: 12, color: 'rgba(90,50,140,0.35)', mode: 'soft' });
    if (h.hasBuff('hpot') && Math.random() < 0.3) P({ x: h.x + U.rand(-12, 12), y: h.y, vz: 70, life: 0.6, size: 5, color: 'rgba(255,90,110,0.9)', mode: 'glow' });
    if (h.hasBuff('mpot') && Math.random() < 0.3) P({ x: h.x + U.rand(-12, 12), y: h.y, vz: 70, life: 0.6, size: 5, color: 'rgba(90,170,255,0.9)', mode: 'glow' });
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function bar(x, y, w, h, frac, col, ticks) {
    rrect(x - 1.5, y - 1.5, w + 3, h + 3, 2.5);
    ctx.fillStyle = 'rgba(8,5,12,0.85)'; ctx.fill();
    const fw = w * U.clamp(frac, 0, 1);
    if (fw > 0) {
      ctx.fillStyle = col; ctx.fillRect(x, y, fw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, fw, Math.max(1, h * 0.35));
    }
    if (ticks) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 1; i < ticks; i++) ctx.fillRect(x + w * i / ticks, y, 1, h);
    }
  }
  function hpColor(f) { return f > 0.6 ? '#52d65a' : f > 0.3 ? '#e8c53a' : '#e8463a'; }

  function drawProjectile(p) {
    const k = p.kind;
    if (k === 'arrow') {
      ctx.save(); ctx.translate(p.x, p.y - 10); ctx.rotate(p.angle);
      const g = ctx.createLinearGradient(-40, 0, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, p.hostile ? 'rgba(255,200,160,0.35)' : 'rgba(200,255,190,0.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-12, 0); ctx.stroke();
      ctx.strokeStyle = p.hostile ? '#c9b48a' : '#f2ead0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(6, -3.5); ctx.lineTo(6, 3.5); ctx.fill();
      ctx.fillStyle = p.hostile ? '#a33' : '#5cb85c'; ctx.fillRect(-15, -2.5, 5, 5);
      ctx.restore();
    } else {
      const map = { flame: ['rgba(255,140,40,0.95)', 12], ice: ['rgba(130,220,255,0.95)', 11], bolt: ['rgba(120,255,200,0.95)', 10],
        fire: ['rgba(255,90,30,0.95)', 14], fireball: ['rgba(255,120,30,0.95)', 24], iceball: ['rgba(150,230,255,0.95)', 17] };
      const [col, s] = map[k] || map.flame;
      ctx.drawImage(Art.glow(col), p.x - s * 1.6, p.y - 12 - s * 1.6, s * 3.2, s * 3.2);
      ctx.drawImage(Art.glow('rgba(255,255,255,0.9)'), p.x - s * 0.45, p.y - 12 - s * 0.45, s * 0.9, s * 0.9);
      P({ x: p.x + U.rand(-3, 3), y: p.y - 12 + U.rand(-3, 3), life: 0.32, size: s * 0.65, color: col, mode: 'glow' });
      if (k === 'fireball') { P({ x: p.x, y: p.y - 12, life: 0.7, size: 13, color: 'rgba(60,50,50,0.4)', mode: 'soft', grow: 1 }); light(p.x, p.y, 110, 'rgba(255,140,50,0.35)', 0.05); }
    }
  }

  function jag(x1, y1, x2, y2, n, amp) {
    const pts = [[x1, y1]];
    const ang = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    for (let i = 1; i < n; i++) {
      const t = i / n, o = (Math.random() - 0.5) * amp;
      pts.push([U.lerp(x1, x2, t) + Math.cos(ang) * o, U.lerp(y1, y2, t) + Math.sin(ang) * o]);
    }
    pts.push([x2, y2]);
    return pts;
  }
  function strokePts(pts, col, w) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }

  // ground-layer fx (under units)
  function drawGroundFx(L) {
    for (const f of L.fx) {
      const k = f.t / f.dur;
      if (f.kind === 'scorch') {
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.drawImage(Art.soft('rgba(20,10,5,0.9)'), f.x - f.r, f.y - f.r * 0.8, f.r * 2, f.r * 1.6);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'crack') {
        if (!f.pts) f.pts = jag(f.x1, f.y1, f.x2, f.y2, 18, 30);
        const prog = Math.min(1, f.t / 0.75);
        const n = Math.max(2, Math.ceil(f.pts.length * prog));
        const pts = f.pts.slice(0, n);
        ctx.globalAlpha = 1 - Math.max(0, (f.t - 0.9) / 0.7);
        strokePts(pts, 'rgba(40,20,10,0.8)', 14);
        strokePts(pts, `rgba(255,${120 + 80 * prog | 0},40,0.95)`, 5);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'meteor') {
        ctx.strokeStyle = `rgba(255,80,30,${0.4 + k * 0.5})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + k * 0.7), 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,60,20,${0.12 + k * 0.15})`; ctx.fill();
      } else if (f.kind === 'frostburst' || f.kind === 'glacial') {
        ctx.globalAlpha = 0.4 * (1 - k);
        ctx.drawImage(Art.soft('rgba(200,240,255,0.9)'), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const z of L.zones) {
      const fade = Math.min(1, z.t * 3, (z.dur - z.t) * 3);
      if (z.kind === 'blizzard') {
        ctx.globalAlpha = 0.35 * fade;
        ctx.drawImage(Art.soft('rgba(180,230,255,0.9)'), z.x - z.r, z.y - z.r, z.r * 2, z.r * 2);
        ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = '#cdf3ff'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, time, time + TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r;
          P({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, z: 220, vz: -520, life: 0.42, size: 7, color: 'rgba(220,250,255,0.95)', mode: 'shard', rot: 0.3 });
        }
      } else if (z.kind === 'arrowstorm') {
        ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = '#e8f5c8'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, -time, -time + TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 0.12 * fade; ctx.fillStyle = '#d0ffb0'; ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r;
          P({ x: z.x + Math.cos(a) * d - 60, y: z.y + Math.sin(a) * d - 100, vx: 300, vy: 500, life: 0.2, mode: 'arrow', rot: Math.atan2(500, 300) });
        }
      }
    }
  }

  // overlay fx (above units)
  function drawTopFx(L) {
    for (const f of L.fx) {
      const k = f.t / f.dur;
      const fx = f.follow ? f.follow.x : f.x, fy = f.follow ? f.follow.y : f.y;
      switch (f.kind) {
        case 'shockwave':
          ctx.strokeStyle = `rgba(170,220,255,${1 - k})`; ctx.lineWidth = 10 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.2 + k * 0.9), 0, TAU); ctx.stroke();
          break;
        case 'shieldup':
          ctx.strokeStyle = `rgba(255,215,100,${1 - k})`; ctx.lineWidth = 4;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU, rr = 30 + k * 30; ctx.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr); }
          ctx.stroke();
          break;
        case 'erupt':
          ctx.globalAlpha = 1 - k;
          strokePts([[f.x1, f.y1], [f.x2, f.y2]], 'rgba(255,170,60,0.5)', f.w * (1 - k));
          ctx.globalAlpha = 1;
          break;
        case 'slash': case 'cleave': {
          const rr = f.kind === 'cleave' ? 60 : 34;
          ctx.strokeStyle = f.kind === 'cleave' ? `rgba(255,240,200,${0.8 * (1 - k)})` : `rgba(220,190,255,${1 - k})`;
          ctx.lineWidth = 5 * (1 - k) + 1;
          ctx.beginPath(); ctx.arc(f.x, f.y, rr, f.ang - 1 + k, f.ang + 1 + k); ctx.stroke();
          break;
        }
        case 'critslash':
          ctx.strokeStyle = `rgba(255,70,70,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath(); ctx.moveTo(f.x - 30, f.y - 30); ctx.lineTo(f.x + 30, f.y + 30); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(f.x + 30, f.y - 30); ctx.lineTo(f.x - 30, f.y + 30); ctx.stroke();
          break;
        case 'afterimage':
          ctx.globalAlpha = 0.5 * (1 - k);
          ctx.drawImage(Art.soft('rgba(140,80,220,0.9)'), f.x - 26, f.y - 26, 52, 52);
          ctx.globalAlpha = 1;
          break;
        case 'piercetrail':
          ctx.globalAlpha = 1 - k;
          strokePts([[f.x1, f.y1], [f.x2, f.y2]], 'rgba(190,255,170,0.35)', 18 * (1 - k));
          strokePts([[f.x1, f.y1], [f.x2, f.y2]], 'rgba(255,255,255,0.8)', 2);
          ctx.globalAlpha = 1;
          break;
        case 'frostburst':
          ctx.strokeStyle = `rgba(200,245,255,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * Math.sqrt(k)), 0, TAU); ctx.stroke();
          break;
        case 'glacial':
          ctx.strokeStyle = `rgba(200,245,255,${1 - k})`; ctx.lineWidth = 14 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * Math.sqrt(k), 0, TAU); ctx.stroke();
          ctx.globalAlpha = 0.5 * (1 - k);
          ctx.drawImage(Art.glow('rgba(160,230,255,0.8)'), f.x - f.r * k, f.y - f.r * k, f.r * 2 * k, f.r * 2 * k);
          ctx.globalAlpha = 1;
          break;
        case 'explosion':
          if (k < 0.3) {
            ctx.globalAlpha = 1 - k / 0.3;
            ctx.drawImage(Art.glow('rgba(255,200,100,0.9)'), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = `rgba(255,180,80,${1 - k})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, TAU); ctx.stroke();
          break;
        case 'meteor': {
          const sx = f.x + 260 * (1 - k), sy = f.y - 520 * (1 - k);
          const s = 26;
          ctx.drawImage(Art.glow('rgba(255,110,30,0.95)'), sx - s * 1.6, sy - s * 1.6, s * 3.2, s * 3.2);
          Art.circle(ctx, sx, sy, s * 0.55, '#4a2a1a');
          Art.circle(ctx, sx - 3, sy - 3, s * 0.3, '#ff9a3a');
          for (let i = 0; i < 3; i++) P({ x: sx + U.rand(-8, 8), y: sy + U.rand(-8, 8), life: 0.5, size: 16, color: 'rgba(255,120,40,0.8)', mode: 'glow' });
          P({ x: sx, y: sy, life: 0.8, size: 14, color: 'rgba(50,40,40,0.5)', mode: 'soft', grow: 1.2 });
          break;
        }
        case 'whirl': {
          ctx.strokeStyle = `rgba(220,30,40,${1 - k})`; ctx.lineWidth = 8 * (1 - k) + 2;
          for (let i = 0; i < 3; i++) {
            const a = k * 12 + i * TAU / 3;
            ctx.beginPath(); ctx.arc(fx, fy, f.r * (0.5 + k * 0.5), a, a + 1.4); ctx.stroke();
          }
          break;
        }
        case 'roar':
          ctx.strokeStyle = `rgba(255,60,40,${1 - k})`; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(fx, fy, (f.big ? 180 : 100) * k + 20, 0, TAU); ctx.stroke();
          break;
        case 'levelup': {
          const a = (1 - k);
          const g = ctx.createLinearGradient(fx, fy - 140, fx, fy);
          g.addColorStop(0, 'rgba(255,220,100,0)'); g.addColorStop(1, `rgba(255,220,100,${0.55 * a})`);
          ctx.fillStyle = g; ctx.fillRect(fx - 26, fy - 140, 52, 140);
          ctx.strokeStyle = `rgba(255,230,120,${a})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(fx, fy + 6, 30 + k * 20, 15 + k * 10, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'healpulse':
          ctx.strokeStyle = `rgba(110,255,140,${0.7 * (1 - k)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, TAU); ctx.stroke();
          break;
        case 'lightning':
          ctx.globalAlpha = 1 - k;
          for (let i = 1; i < f.pts.length; i++) {
            const pts = jag(f.pts[i - 1].x, f.pts[i - 1].y - 10, f.pts[i].x, f.pts[i].y - 10, 7, 22);
            strokePts(pts, 'rgba(120,180,255,0.6)', 7);
            strokePts(pts, '#eef6ff', 2);
          }
          ctx.globalAlpha = 1;
          break;
        case 'leak':
          ctx.globalAlpha = 1 - k;
          ctx.drawImage(Art.glow('rgba(255,40,60,0.8)'), f.x - 120, f.y - 120, 240, 240);
          ctx.globalAlpha = 1;
          break;
        case 'death': {
          if (k > 0.6) break;
          const spr = Art.creepSprite(f.type, 0), s = spr.span * (1 - k * 0.6);
          ctx.save(); ctx.globalAlpha = 0.7 * (1 - k / 0.6);
          ctx.translate(f.x, f.y); ctx.rotate(f.ang + k * 2);
          ctx.filter = 'brightness(0.4)';
          ctx.drawImage(spr, -s / 2, -s / 2, s, s);
          ctx.filter = 'none';
          ctx.restore();
          break;
        }
      }
    }
    for (const s of L.sweeps) {
      if (s.kind === 'piercing') {
        ctx.drawImage(Art.glow('rgba(190,255,150,0.95)'), s.x - 22, s.y - 22, 44, 44);
        P({ x: s.x, y: s.y, life: 0.35, size: 12, color: 'rgba(180,255,140,0.7)', mode: 'glow' });
      } else if (s.kind === 'flamewave') {
        const px = Math.cos(s.ang + Math.PI / 2), py = Math.sin(s.ang + Math.PI / 2);
        for (let i = 0; i < 6; i++) {
          const o = U.rand(-s.w / 2, s.w / 2);
          P({ x: s.x + px * o, y: s.y + py * o, vx: Math.cos(s.ang) * 120, vy: Math.sin(s.ang) * 120, vz: 60, life: 0.5, size: U.rand(12, 22), color: 'rgba(255,110,30,0.85)', mode: 'glow' });
        }
      }
    }
  }

  function drawAim(h, aim) {
    const a = h.def.abilities[aim.i];
    ctx.save();
    ctx.globalAlpha = 0.9;
    if (a.range) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(h.x, h.y, a.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const col = aim.cancel ? 'rgba(255,80,80,' : 'rgba(120,220,255,';
    if (a.type === 'point') {
      let tx = aim.x, ty = aim.y;
      const d = U.dist(h.x, h.y, tx, ty);
      if (d > a.range) { const g = U.angle(h.x, h.y, tx, ty); tx = h.x + Math.cos(g) * a.range; ty = h.y + Math.sin(g) * a.range; }
      ctx.fillStyle = col + '0.18)'; ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tx, ty, a.radius, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (a.type === 'dir') {
      const g = U.angle(h.x, h.y, aim.x, aim.y);
      ctx.translate(h.x, h.y); ctx.rotate(g);
      ctx.fillStyle = col + '0.18)'; ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 3;
      ctx.fillRect(0, -a.width / 2, a.range, a.width); ctx.strokeRect(0, -a.width / 2, a.range, a.width);
    } else if (a.type === 'self' && a.radius) {
      ctx.fillStyle = col + '0.15)'; ctx.strokeStyle = col + '0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, h.y, a.radius, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ environment
  function drawRiverFx(vy0, vy1) {
    const x0 = WORLD_W;
    // flowing light streaks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const seed = (i * 9301 + 49297) % 233280 / 233280;
      const y = ((seed * WORLD_H + time * (35 + seed * 25)) % (WORLD_H + 200)) - 100;
      if (y < vy0 - 60 || y > vy1 + 60) continue;
      const l = river.bankL(y), r = river.bankR(y);
      const x = x0 + U.lerp(l + 25, r - 25, (seed * 7.3) % 1);
      const len = 30 + seed * 50;
      const g = ctx.createLinearGradient(x, y - len, x, y);
      g.addColorStop(0, 'rgba(160,220,255,0)'); g.addColorStop(1, 'rgba(180,230,255,0.22)');
      ctx.strokeStyle = g; ctx.lineWidth = 2 + seed * 2;
      ctx.beginPath(); ctx.moveTo(x + Math.sin(time + i) * 3, y - len); ctx.lineTo(x, y); ctx.stroke();
    }
    // glints
    for (let i = 0; i < 14; i++) {
      const y = vy0 + ((i * 137 + Math.floor(time * 2 + i) * 61) % Math.max(1, vy1 - vy0));
      const l = river.bankL(y), r = river.bankR(y);
      const x = x0 + U.lerp(l + 20, r - 20, ((i * 0.618 + Math.floor(time * 2 + i) * 0.37) % 1));
      const a = Math.sin((time * 2 + i) % 1 * Math.PI);
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(Art.glow('rgba(220,245,255,0.8)'), x - 6, y - 6, 12, 12);
    }
    ctx.restore();
  }

  function drawPortal(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.drawImage(Art.glow('rgba(170,60,255,0.65)'), -110, -110, 220, 220);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(20,0,30,1)'); g.addColorStop(0.6, 'rgba(90,30,140,0.9)'); g.addColorStop(1, 'rgba(190,120,255,0.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${190 + i * 12},${110 + i * 25},255,${0.75 - i * 0.12})`;
      ctx.lineWidth = 5 - i * 0.7;
      ctx.beginPath(); ctx.arc(0, 0, 14 + i * 11, time * (2 + i) + i, time * (2 + i) + i + 3.8); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.35) P({ x: x + U.rand(-60, 60), y: y + U.rand(-50, 50), vz: 30, life: 0.9, size: 6, color: 'rgba(190,120,255,0.8)', mode: 'glow' });
  }
  function drawFountain() {
    const F = FOUNTAIN;
    const pulse = 0.55 + Math.sin(time * 2) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.drawImage(Art.glow('rgba(110,210,255,0.6)'), F.x - 90, F.y - 90, 180, 180);
    ctx.globalAlpha = 1;
    // water ripples
    for (let i = 0; i < 3; i++) {
      const k = (time * 0.6 + i / 3) % 1;
      ctx.strokeStyle = `rgba(210,245,255,${0.5 * (1 - k)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(F.x, F.y, 8 + k * 30, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#9fe4ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(F.x, F.y, F.r, time * 0.2, time * 0.2 + TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (Math.random() < 0.3) P({ x: F.x + U.rand(-30, 30), y: F.y + U.rand(-30, 30), vz: 45, life: 1, size: 4, color: 'rgba(170,235,255,0.9)', mode: 'glow' });
  }
  function drawBanners(laneIdx) {
    const wy = WORLD_H - 70, col = LANE_BANNER[laneIdx];
    for (const tx of [660, 940]) {
      const sway = Math.sin(time * 2 + tx) * 2;
      Art.poly(ctx, [[tx - 11, wy + 6], [tx + 11, wy + 6], [tx + 11 + sway, wy + 36], [tx + sway, wy + 29], [tx - 11 + sway, wy + 36]], col, 'rgba(0,0,0,0.6)', 1.5);
      Art.circle(ctx, tx, wy + 16, 4, '#f2c14e');
      ctx.drawImage(Art.glow('rgba(255,190,90,0.5)'), tx - 30, wy - 8, 60, 60); // torch
    }
  }
  function drawPonds() {
    for (const p of Art.PONDS) {
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.5 + i * 0.33 + p.x) % 1;
        const a = (i * 2.1 + Math.floor(time * 0.5 + i * 0.33)) % TAU;
        const x = p.x + Math.cos(a) * p.r * 0.45, y = p.y + Math.sin(a) * p.r * 0.3;
        ctx.strokeStyle = `rgba(220,245,255,${0.45 * (1 - ph)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(x, y, 4 + ph * 16, (4 + ph * 16) * 0.6, 0, 0, TAU); ctx.stroke();
      }
    }
  }

  function drawLights(laneIdx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights[laneIdx]) {
      ctx.globalAlpha = Math.min(1, l.life / l.max * 1.5);
      ctx.drawImage(Art.glow(l.color), l.x - l.r, l.y - l.r * 0.8, l.r * 2, l.r * 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ lane draw
  function drawLaneWorld(game, i, ui) {
    const L = game.lanes[i], h = L.hero, mine = i === ui.myLane;
    drawPortal(SPAWN.x, 60);
    drawFountain();
    drawPonds();
    drawBanners(i);
    drawLights(i);
    drawGroundFx(L);

    if (mine && h.cmd && h.cmd.type === 'move') {
      ctx.strokeStyle = 'rgba(120,255,140,0.85)'; ctx.lineWidth = 2;
      const r = 10 + Math.sin(time * 8) * 3;
      ctx.beginPath(); ctx.ellipse(h.cmd.x, h.cmd.y, r, r * 0.55, 0, 0, TAU); ctx.stroke();
    }
    if (mine && h.alive && h.target && h.target.alive && h.cmd && h.cmd.type === 'attack') {
      const t = h.target;
      ctx.strokeStyle = 'rgba(255,70,70,0.9)'; ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]); ctx.lineDashOffset = time * 20;
      ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r * 0.3, t.r * 1.25, t.r * 0.62, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const c of L.creeps) if (!c.flying) drawShadow(c.x, c.y, c.r);
    if (h.alive) drawShadow(h.x, h.y, h.r * h.size * 1.1);
    for (const c of L.creeps) if (c.flying) drawShadow(c.x, c.y + 10, c.r * 0.85, 12, 0.6);

    const items = [];
    for (const c of L.creeps) if (!c.flying) items.push({ y: c.y, c });
    if (h.alive) items.push({ y: h.y, hero: true });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.hero) drawHeroUnit(h, mine ? HERO_BADGE[0] : HERO_BADGE[1]);
      else drawCreep(it.c);
    }
    for (const c of L.creeps) if (c.flying) drawCreep(c);
    for (const p of L.projectiles) drawProjectile(p);

    drawParticles(false);
    ctx.globalCompositeOperation = 'lighter';
    drawParticles(true);
    ctx.globalCompositeOperation = 'source-over';
    drawTopFx(L);
  }

  function drawLaneOverlay(game, i, ui) {
    const L = game.lanes[i], h = L.hero, mine = i === ui.myLane;
    ctx.textAlign = 'center';
    for (const c of L.creeps) {
      if (c.hp >= c.maxHp && !c.boss) continue;
      const w = c.boss ? 76 : Math.max(26, c.r * 2), fy = c.flying ? 26 : 0;
      const y = c.y - c.r - 13 - fy;
      bar(c.x - w / 2, y, w, c.boss ? 6 : 4, c.hp / c.maxHp, c.boss ? '#e8463a' : hpColor(c.hp / c.maxHp), c.boss ? 10 : 0);
      if (c.boss) {
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(c.T.name, c.x, y - 5); ctx.fillStyle = '#ffcf7a'; ctx.fillText(c.T.name, c.x, y - 5);
      }
    }
    if (h.alive) {
      const w = 60, y = h.y - h.r * h.size - 26;
      bar(h.x - w / 2, y, w, 6, h.hp / h.maxHp, mine ? '#46e06e' : '#ff5a4a', Math.min(20, Math.floor(h.maxHp / 250)));
      bar(h.x - w / 2, y + 8.5, w, 3, h.mana / h.maxMana, '#4aa3ff');
      ctx.font = '900 11px system-ui, sans-serif';
      rrect(h.x - w / 2 - 19, y - 3, 15, 15, 4); ctx.fillStyle = 'rgba(8,5,12,0.85)'; ctx.fill();
      ctx.fillStyle = '#ffe066'; ctx.fillText(h.level, h.x - w / 2 - 11.5, y + 8.5);
      if (!mine) {
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(h.def.name, h.x, y - 6); ctx.fillStyle = '#ff9a8a'; ctx.fillText(h.def.name, h.x, y - 6);
      }
    }
    for (const t of L.texts) {
      const k = t.t / t.dur;
      const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.6 : k < 0.25 ? 1.2 - (k - 0.12) / 0.13 * 0.2 : 1;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    if (mine && ui.aim && h.alive) drawAim(h, ui.aim);
  }

  function drawMotes(vx0, vy0, vx1, vy1, dt) {
    while (motes.length < 40) motes.push({ x: U.rand(vx0, vx1), y: U.rand(vy0, vy1), ph: Math.random() * TAU, s: U.rand(1.5, 3.5), vx: U.rand(-8, 8), vy: U.rand(-10, 4) });
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.x += (m.vx + Math.sin(time + m.ph) * 6) * dt; m.y += m.vy * dt;
      if (m.x < vx0 - 30 || m.x > vx1 + 30 || m.y < vy0 - 30 || m.y > vy1 + 30) { m.x = U.rand(vx0, vx1); m.y = U.rand(vy0, vy1); }
      const a = 0.35 + 0.35 * Math.sin(time * 2.5 + m.ph);
      ctx.globalAlpha = a;
      ctx.drawImage(Art.glow('rgba(255,240,170,0.8)'), m.x - m.s * 2, m.y - m.s * 2, m.s * 4, m.s * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ main draw
  function draw(game, viewLane, dt, ui) {
    time += dt;
    viewLaneNow = viewLane;
    for (let i = 0; i < 2; i++) {
      curLane = i; curParts = parts[i];
      for (const f of game.lanes[i].fx) if (!f._seen) { f._seen = true; onFx(f); fxExtras(f); }
    }
    updateParticles(dt);

    // camera
    const vw = W / cam.scale, vh = H / cam.scale;
    let tx, ty;
    if (ui.freeCam) { tx = ui.freeCam.x; ty = ui.freeCam.y; }
    else {
      const h = game.lanes[viewLane].hero;
      tx = (h.alive ? h.x : FOUNTAIN.x) + LANE_OX[viewLane];
      ty = h.alive ? h.y : FOUNTAIN.y;
    }
    const clampC = (v, lo, hi, view) => (hi - lo) <= view ? (lo + hi) / 2 : U.clamp(v, lo + view / 2, hi - view / 2);
    tx = clampC(tx, -GAP * 0.3, FULL_W + GAP * 0.3, vw); ty = clampC(ty, 0, WORLD_H, vh);
    if (ui.freeCam) { ui.freeCam.x = tx; ui.freeCam.y = ty; }
    const far = Math.abs(tx - cam.x) > vw;
    const kk = 1 - Math.pow(far ? 0.02 : 0.0015, dt || 0.016);
    cam.x += (tx - cam.x) * kk; cam.y += (ty - cam.y) * kk;
    const sh = game.lanes[viewLane].shakeAmt;
    const sx = sh ? U.rand(-sh, sh) : 0, sy = sh ? U.rand(-sh, sh) : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16240f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = cam.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (W / 2 - cam.x * cam.scale + sx) * dpr, (H / 2 - cam.y * cam.scale + sy) * dpr);
    const vx0 = cam.x - vw / 2 - 20, vx1 = cam.x + vw / 2 + 20, vy0 = cam.y - vh / 2 - 20, vy1 = cam.y + vh / 2 + 20;
    const y0 = U.clamp(vy0, 0, WORLD_H), y1 = U.clamp(vy1, 0, WORLD_H);

    // ground layers
    const visible = [];
    for (let i = 0; i < 2; i++) {
      const ox = LANE_OX[i];
      const a = U.clamp(vx0 - ox, 0, WORLD_W), b = U.clamp(vx1 - ox, 0, WORLD_W);
      if (b > a && y1 > y0) {
        visible.push(i);
        ctx.drawImage(terrain, a * TS, y0 * TS, (b - a) * TS, (y1 - y0) * TS, ox + a, y0, b - a, y1 - y0);
      }
    }
    {
      const ra = U.clamp(vx0 - WORLD_W, 0, GAP), rb = U.clamp(vx1 - WORLD_W, 0, GAP);
      if (rb > ra && y1 > y0) {
        const rs = river.width / GAP;
        ctx.drawImage(river, ra * rs, y0 * rs, (rb - ra) * rs, (y1 - y0) * rs, WORLD_W + ra, y0, rb - ra, y1 - y0);
        drawRiverFx(y0, y1);
      }
    }
    // lanes
    for (const i of visible) {
      ctx.save(); ctx.translate(LANE_OX[i], 0);
      curLane = i; curParts = parts[i];
      drawLaneWorld(game, i, ui);
      ctx.restore();
    }
    // canopy (above units) + overlays
    for (const i of visible) {
      const ox = LANE_OX[i];
      const a = U.clamp(vx0 - ox, 0, WORLD_W), b = U.clamp(vx1 - ox, 0, WORLD_W);
      ctx.drawImage(canopy, a, y0, b - a, y1 - y0, ox + a, y0, b - a, y1 - y0);
    }
    // drifting cloud shadows
    {
      const T = 1700, ox = (time * 16) % T, oy = (time * 7) % T;
      ctx.globalAlpha = 0.2;
      for (let gx = Math.floor((vx0 - ox) / T) * T + ox; gx < vx1; gx += T) {
        for (let gy = Math.floor((vy0 - oy) / T) * T + oy; gy < vy1; gy += T) ctx.drawImage(clouds, gx, gy, T, T);
      }
      ctx.globalAlpha = 1;
    }
    for (const i of visible) {
      ctx.save(); ctx.translate(LANE_OX[i], 0);
      curLane = i; curParts = parts[i];
      drawLaneOverlay(game, i, ui);
      ctx.restore();
    }
    drawMotes(vx0, vy0, vx1, vy1, dt);

    // screen space grading
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(sunlight, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vignette, 0, 0);
    if (flash > 0) {
      ctx.fillStyle = `rgba(${flashCol},${flash})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      flash = Math.max(0, flash - dt * 1.2);
    }
  }

  // ------------------------------------------------------------ minimap (both lanes)
  let mmBase = null;
  function drawMinimap(mc, game, viewLane, myLane) {
    const m = mc.getContext('2d');
    const w = mc.width, hgt = mc.height;
    const sx = w / FULL_W, sy = hgt / WORLD_H;
    if (!mmBase || mmBase.width !== w || mmBase.height !== hgt) {
      mmBase = Art.mk(w, hgt);
      const b = mmBase.getContext('2d');
      b.drawImage(terrain, 0, 0, WORLD_W * sx, hgt);
      b.drawImage(river, WORLD_W * sx, 0, GAP * sx, hgt);
      b.drawImage(terrain, LANE_OX[1] * sx, 0, WORLD_W * sx, hgt);
      b.drawImage(canopy, 0, 0, WORLD_W * sx, hgt);
      b.drawImage(canopy, LANE_OX[1] * sx, 0, WORLD_W * sx, hgt);
      b.fillStyle = 'rgba(0,0,0,0.2)'; b.fillRect(0, 0, w, hgt);
    }
    m.drawImage(mmBase, 0, 0);
    for (let i = 0; i < 2; i++) {
      const L = game.lanes[i], ox = LANE_OX[i];
      for (const c of L.creeps) {
        m.fillStyle = c.boss ? '#ff3b3b' : c.sentBy >= 0 ? '#ff9a3d' : '#ffd84d';
        const s = c.boss ? 5 : 2.5;
        m.fillRect((c.x + ox) * sx - s / 2, c.y * sy - s / 2, s, s);
      }
      const h = L.hero;
      if (h.alive) {
        m.fillStyle = i === myLane ? '#46e06e' : '#ff5a4a';
        m.beginPath(); m.arc((h.x + ox) * sx, h.y * sy, 3.5, 0, TAU); m.fill();
        m.strokeStyle = '#fff'; m.lineWidth = 1; m.stroke();
      }
    }
    const vw = W / cam.scale, vh = H / cam.scale;
    m.strokeStyle = 'rgba(255,255,255,0.85)'; m.lineWidth = 1.5;
    m.strokeRect((cam.x - vw / 2) * sx, (cam.y - vh / 2) * sy, vw * sx, vh * sy);
  }

  return {
    init, resize, draw, drawMinimap, screenToWorld, screenToLane, worldToScreen, setZoom, cam,
    LANE_OX, GAP, FULL_W, get W() { return W; }, get H() { return H; },
  };
})();
