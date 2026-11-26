'use strict';
// ============================================================================
//  Ability implementations + smart targeting
//  Each fn(hero, level, def, target) -> false to abort (no mana/cd spent)
// ============================================================================
const ABIL = {
  // ---------------------------------------------------------- Iron Warden
  thunderslam(h, lv, a) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    for (const c of L.enemiesInRadius(h.x, h.y, a.radius)) {
      L.spell(h, c, v('dmg') + h.str * 1.5);
      c.addStun(v('stun'));
    }
    L.addFx('shockwave', { x: h.x, y: h.y, r: a.radius, color: '#9fd0ff' }, 0.6);
    L.shake(7);
  },
  bulwark(h, lv, a) {
    const v = k => a.vals[k][lv - 1];
    h.addBuff({ id: 'bulwark', t: 8, stats: { armor: v('armor'), reflect: v('reflect') / 100, hpRegen: v('regen') } });
    h.lane.addFx('shieldup', { x: h.x, y: h.y, follow: h }, 0.6);
  },
  earthsplitter(h, lv, a, t) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    const x1 = h.x, y1 = h.y, x2 = t.x, y2 = t.y;
    L.addFx('crack', { x1, y1, x2, y2, w: a.width }, 1.6);
    L.timer(0.75, () => {
      for (const c of L.enemiesInLine(x1, y1, x2, y2, a.width)) {
        L.spell(h, c, v('dmg'));
        c.addStun(v('stun'));
      }
      L.addFx('erupt', { x1, y1, x2, y2, w: a.width }, 0.9);
      L.shake(14);
      h.game.emit('sfx', { name: 'erupt', lane: L.id });
    });
  },

  // ---------------------------------------------------------- Shadow Dancer
  shadowstep(h, lv, a, t) {
    const L = h.lane;
    L.addFx('blink', { x: h.x, y: h.y }, 0.6);
    h.x = t.x; h.y = t.y; h.clampPos();
    h.cmd = null;
    for (const c of L.enemiesInRadius(h.x, h.y, a.radius)) L.spell(h, c, a.vals.dmg[lv - 1]);
    L.addFx('blink', { x: h.x, y: h.y, big: true }, 0.7);
    h.atkT = 0;
  },
  bladefury(h, lv, a) {
    const dps = a.vals.dps[lv - 1];
    h.addBuff({
      id: 'bladefury', t: 3, stats: { dmgTaken: 0.5 }, interval: 0.25,
      onTick(hero) {
        for (const c of hero.lane.enemiesInRadius(hero.x, hero.y, a.radius)) hero.lane.spell(hero, c, dps * 0.25, true);
      },
    });
  },
  phantom(h, lv, a) {
    const L = h.lane;
    if (!L.enemiesInRadius(h.x, h.y, a.radius).length) return false;
    const hits = a.vals.hits[lv - 1], mult = a.vals.mult[lv - 1];
    const home = { x: h.x, y: h.y };
    let n = 0, acc = 0, last = null;
    h.channel = {
      update(dt) {
        acc += dt;
        while (acc >= 0.14 && h.channel) {
          acc -= 0.14;
          const pool = L.enemiesInRadius(home.x, home.y, a.radius);
          if (!pool.length || n >= hits) { h.channel = null; return; }
          let c = U.pick(pool);
          if (c === last && pool.length > 1) c = U.pick(pool);
          last = c;
          const ang = Math.random() * Math.PI * 2;
          L.addFx('afterimage', { x: h.x, y: h.y, ang: h.facing }, 0.5);
          h.x = c.x + Math.cos(ang) * (c.r + 18); h.y = c.y + Math.sin(ang) * (c.r + 18);
          h.clampPos();
          h.facing = U.angle(h.x, h.y, c.x, c.y);
          h.animAtk = 1;
          h.hit(c, h.damage * mult, false);
          L.addFx('slash', { x: c.x, y: c.y, ang: h.facing }, 0.3);
          h.game.emit('sfx', { name: 'swing', lane: L.id });
          n++;
        }
      },
    };
  },

  // ---------------------------------------------------------- Wind Ranger
  piercing(h, lv, a, t) {
    const L = h.lane, dmg = a.vals.dmg[lv - 1];
    const ang = U.angle(h.x, h.y, t.x, t.y);
    L.sweeps.push({ x: h.x, y: h.y, ang, speed: 1500, dist: a.range, trav: 0, w: a.width, hit: new Set(), kind: 'piercing',
      onHit: c => L.spell(h, c, dmg + h.agi * 1.5) });
    L.addFx('piercetrail', { x1: h.x, y1: h.y, x2: t.x, y2: t.y }, 0.7);
  },
  frosttrap(h, lv, a, t) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    L.projectiles.push(new Projectile(L, { x: h.x, y: h.y, tx: t.x, ty: t.y, speed: 900, kind: 'iceball',
      onHit: (_, x, y) => {
        for (const c of L.enemiesInRadius(x, y, a.radius)) { L.spell(h, c, v('dmg')); c.addSlow(v('slow') / 100, 4); }
        L.addFx('frostburst', { x, y, r: a.radius }, 0.8);
        h.game.emit('sfx', { name: 'ice', lane: L.id });
      } }));
  },
  arrowstorm(h, lv, a, t) {
    const L = h.lane, dmg = a.vals.dmg[lv - 1];
    L.zones.push({ x: t.x, y: t.y, r: a.radius, t: 0, dur: 6, acc: 0.5, interval: 0.5, kind: 'arrowstorm',
      onTick(z) {
        for (const c of L.enemiesInRadius(z.x, z.y, z.r)) c.takeDamage(dmg * (0.85 + h.spellAmp * 0.15), 'phys', h);
        h.game.emit('sfx', { name: 'arrowrain', lane: L.id });
      } });
  },

  // ---------------------------------------------------------- Pyromancer
  fireball(h, lv, a, t) {
    const L = h.lane, dmg = a.vals.dmg[lv - 1];
    L.projectiles.push(new Projectile(L, { x: h.x, y: h.y, tx: t.x, ty: t.y, speed: 850, kind: 'fireball', size: 1.4,
      onHit: (_, x, y) => {
        for (const c of L.enemiesInRadius(x, y, a.radius)) L.spell(h, c, dmg);
        L.addFx('explosion', { x, y, r: a.radius }, 0.7);
        L.shake(5);
        h.game.emit('sfx', { name: 'boom', lane: L.id });
      } }));
  },
  flamewave(h, lv, a, t) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    const ang = U.angle(h.x, h.y, t.x, t.y);
    L.sweeps.push({ x: h.x, y: h.y, ang, speed: 900, dist: a.range, trav: 0, w: a.width, hit: new Set(), kind: 'flamewave',
      onHit: c => { L.spell(h, c, v('dmg')); c.addBurn(v('burn') * h.spellAmp, 3, h); } });
  },
  meteor(h, lv, a, t) {
    const L = h.lane, dmg = a.vals.dmg[lv - 1];
    for (let i = 0; i < 4; i++) {
      L.timer(0.15 + i * 0.4, () => {
        const ang = Math.random() * Math.PI * 2, rr = Math.random() * a.radius * 0.6;
        const x = t.x + Math.cos(ang) * rr, y = t.y + Math.sin(ang) * rr;
        L.addFx('meteor', { x, y, r: 200 }, 0.55);
        L.timer(0.5, () => {
          for (const c of L.enemiesInRadius(x, y, 200)) { L.spell(h, c, dmg); c.addStun(1.2); }
          L.addFx('explosion', { x, y, r: 210, big: true }, 0.9);
          L.addFx('scorch', { x, y, r: 150 }, 6);
          L.shake(12);
          h.game.emit('sfx', { name: 'boom', lane: L.id });
        });
      });
    }
  },

  // ---------------------------------------------------------- Frost Oracle
  frostnova(h, lv, a, t) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    for (const c of L.enemiesInRadius(t.x, t.y, a.radius)) { L.spell(h, c, v('dmg')); c.addSlow(v('slow') / 100, 3); }
    L.addFx('frostburst', { x: t.x, y: t.y, r: a.radius }, 0.8);
  },
  blizzard(h, lv, a, t) {
    const L = h.lane, dmg = a.vals.dmg[lv - 1];
    L.zones.push({ x: t.x, y: t.y, r: a.radius, t: 0, dur: 4.8, acc: 0.8, interval: 0.8, kind: 'blizzard',
      onTick(z) {
        for (const c of L.enemiesInRadius(z.x, z.y, z.r)) { L.spell(h, c, dmg, true); c.addSlow(0.3, 1.5); }
        h.game.emit('sfx', { name: 'ice', lane: L.id });
      } });
  },
  glacial(h, lv, a) {
    const L = h.lane, v = k => a.vals[k][lv - 1];
    for (const c of L.enemiesInRadius(h.x, h.y, a.radius)) { L.spell(h, c, v('dmg')); c.addStun(v('stun'), 'freeze'); }
    L.addFx('glacial', { x: h.x, y: h.y, r: a.radius }, 1.2);
    L.shake(10);
  },

  // ---------------------------------------------------------- Blood Berserker
  bloodwhirl(h, lv, a) {
    const L = h.lane;
    let total = 0;
    for (const c of L.enemiesInRadius(h.x, h.y, a.radius)) total += L.spell(h, c, a.vals.dmg[lv - 1] + h.str * 1.5);
    h.heal(total * 0.35);
    if (total > 0) L.addText(h.x, h.y - 44, '+' + Math.round(total * 0.35), '#6dff8a', 14);
    L.addFx('whirl', { x: h.x, y: h.y, r: a.radius, follow: h }, 0.5);
  },
  frenzy(h, lv, a) {
    h.addBuff({ id: 'frenzy', t: 10, stats: { ias: a.vals.ias[lv - 1] / 100, msPct: 0.15 } });
    h.lane.addFx('roar', { x: h.x, y: h.y, follow: h }, 0.6);
  },
  rampage(h, lv, a) {
    const v = k => a.vals[k][lv - 1];
    h.addBuff({ id: 'rampage', t: 12, stats: { dmg: v('dmg'), armor: v('armor'), cleave: 0.5, size: 0.3 } });
    h.lane.addFx('roar', { x: h.x, y: h.y, follow: h, big: true }, 0.9);
    h.lane.shake(8);
  },

  // ---------------------------------------------------------- shared
  _chain(h, first, dmg, n) {
    const L = h.lane, pts = [{ x: h.x, y: h.y }];
    const hit = new Set();
    let cur = first;
    for (let i = 0; i < n && cur; i++) {
      hit.add(cur);
      pts.push({ x: cur.x, y: cur.y });
      cur.takeDamage(dmg * h.spellAmp, 'magic', h);
      let best = null, bd = 300 * 300;
      for (const c of L.creeps) {
        if (!c.alive || hit.has(c)) continue;
        const d = U.dist2(c.x, c.y, pts[pts.length - 1].x, pts[pts.length - 1].y);
        if (d < bd) { bd = d; best = c; }
      }
      cur = best;
    }
    L.addFx('lightning', { pts }, 0.35);
    h.game.emit('sfx', { name: 'zap', lane: L.id });
  },
};

// ---------------------------------------------------------------------------
// Smart targeting: used by the AI and by "tap to cast" on mobile.
// Returns { x, y, count, boss } or null.
// ---------------------------------------------------------------------------
const Targeting = {
  best(h, i) {
    const a = h.def.abilities[i], L = h.lane;
    const live = L.creeps.filter(c => c.alive);
    if (a.type === 'passive') return null;
    if (a.type === 'self') {
      const r = a.radius || 420;
      const hits = L.enemiesInRadius(h.x, h.y, r);
      return { x: h.x, y: h.y, count: hits.length, boss: hits.some(c => c.boss) };
    }
    let best = null;
    const range = a.range;
    for (const c of live) {
      const d = U.dist(h.x, h.y, c.x, c.y);
      if (d > range + (a.radius || 0) * 0.5) continue;
      let hits;
      if (a.type === 'point') hits = L.enemiesInRadius(c.x, c.y, a.radius);
      else {
        const ang = U.angle(h.x, h.y, c.x, c.y);
        hits = L.enemiesInLine(h.x, h.y, h.x + Math.cos(ang) * range, h.y + Math.sin(ang) * range, a.width);
      }
      let score = hits.length + (hits.some(x => x.boss) ? 3 : 0) + c.progress;
      if (!best || score > best.score) best = { x: c.x, y: c.y, count: hits.length, boss: hits.some(x => x.boss), score };
    }
    if (best && a.type === 'point') {
      // centre on the cluster rather than one creep
      const hits = L.enemiesInRadius(best.x, best.y, a.radius);
      let sx = 0, sy = 0;
      for (const c of hits) { sx += c.x; sy += c.y; }
      best.x = sx / hits.length; best.y = sy / hits.length;
    }
    return best;
  },
};
