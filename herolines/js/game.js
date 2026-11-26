'use strict';
// ============================================================================
//  Core simulation (no DOM). Two lanes; player i defends lane i.
// ============================================================================
let _uid = 1;

// ---------------------------------------------------------------- base unit
class Unit {
  initStatus() {
    this.stun = 0; this.stunKind = 'stun';
    this.slows = []; this.burns = [];
    this.hitFlash = 0;
  }
  addStun(t, kind = 'stun') {
    if (t > this.stun) { this.stun = t; this.stunKind = kind; }
  }
  addSlow(p, t) {
    const s = this.slows.find(s => s.p === p);
    if (s) s.t = Math.max(s.t, t); else this.slows.push({ p, t });
  }
  addBurn(dps, t, src) {
    const b = this.burns.find(b => b.src === src);
    if (b) { b.dps = Math.max(b.dps, dps); b.t = t; } else this.burns.push({ dps, t, src });
  }
  slowPct() {
    let m = 0;
    for (const s of this.slows) if (s.p > m) m = s.p;
    return m;
  }
  tickStatus(dt) {
    for (let i = this.slows.length - 1; i >= 0; i--) {
      if ((this.slows[i].t -= dt) <= 0) this.slows.splice(i, 1);
    }
    for (let i = this.burns.length - 1; i >= 0; i--) {
      const b = this.burns[i];
      this.takeDamage(b.dps * dt, 'magic', b.src, true);
      if ((b.t -= dt) <= 0) this.burns.splice(i, 1);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }
}

// ---------------------------------------------------------------- creep
class Creep extends Unit {
  constructor(lane, type, mul, opts = {}) {
    super();
    const T = CREEPS[type];
    this.id = _uid++;
    this.lane = lane; this.type = type; this.T = T;
    this.isCreep = true;
    this.flying = !!T.flying;
    this.route = this.flying ? AIR : GROUND;
    this.x = opts.x !== undefined ? opts.x : SPAWN.x + U.rand(-30, 30);
    this.y = opts.y !== undefined ? opts.y : SPAWN.y;
    this.r = T.radius;
    this.maxHp = this.hp = Math.round(T.hp * mul.hp);
    this.dmg = T.dmg * mul.dmg;
    this.armor = T.armor + (mul.armor || 0);
    this.baseSpeed = T.speed * U.rand(0.96, 1.04);
    this.range = T.range; this.ranged = !!T.ranged;
    this.atkCd = T.atkCd; this.atkT = U.rand(0.2, T.atkCd);
    this.bounty = Math.max(1, Math.round(T.bounty * mul.gold));
    this.xp = Math.round(T.xp * mul.xp);
    this.lives = T.lives || 1;
    this.magicResist = T.magicResist || 0;
    this.boss = !!T.boss;
    this.healAmt = T.heal ? T.heal * Math.pow(mul.hp, 0.85) : 0;
    this.healT = 1.5;
    this.wp = Math.min(opts.wp || 1, this.route.path.length - 1);
    this.ox = U.rand(-38, 38); this.oy = U.rand(-22, 22);
    this.alive = true;
    this.facing = Math.PI / 2;
    this.anim = Math.random() * 10;
    this.animAtk = 0;
    this.lastHeroHit = -99;
    this.sentBy = opts.sentBy !== undefined ? opts.sentBy : -1;
    this.progress = 0;
    this.initStatus();
  }

  takeDamage(amount, type, src, silent) {
    if (!this.alive) return 0;
    let d = amount;
    if (type === 'phys') d *= U.armorMult(this.armor);
    else if (type === 'magic') d *= 1 - this.magicResist;
    if (d <= 0) return 0;
    this.hp -= d;
    if (!silent) this.hitFlash = 0.1;
    if (src && src.isHero) this.lastHeroHit = this.lane.game.time;
    if (this.hp <= 0) this.lane.killCreep(this, src);
    return d;
  }

  update(dt) {
    const L = this.lane, g = L.game;
    this.anim += dt;
    if (this.animAtk > 0) this.animAtk -= dt * 3;
    this.tickStatus(dt);
    if (!this.alive) return;
    if (this.T.regen) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.T.regen * dt);
    if (this.stun > 0) { this.stun -= dt; return; }

    // healer pulse
    if (this.healAmt) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = 2.5;
        let any = false;
        for (const c of L.creeps) {
          if (c.alive && c !== this && c.hp < c.maxHp && U.dist2(c.x, c.y, this.x, this.y) < this.T.healR ** 2) {
            c.hp = Math.min(c.maxHp, c.hp + this.healAmt);
            any = true;
          }
        }
        if (any) L.addFx('healpulse', { x: this.x, y: this.y, r: this.T.healR }, 0.7);
      }
    }

    this.atkT -= dt;
    const h = L.hero;
    if (h && h.alive && !h.untargetable) {
      const d = U.dist(this.x, this.y, h.x, h.y);
      const reach = this.range + this.r + h.r;
      if (d <= reach) {
        this.facing = U.angle(this.x, this.y, h.x, h.y);
        if (this.atkT <= 0) this.attack(h);
        return;
      }
      if (!this.ranged && g.time - this.lastHeroHit < 2.5 && d < 300) {
        this.moveToward(h.x, h.y, dt);
        return;
      }
    }
    this.followPath(dt);
  }

  attack(h) {
    this.atkT = this.atkCd;
    this.animAtk = 1;
    if (this.ranged) {
      this.lane.projectiles.push(new Projectile(this.lane, {
        x: this.x, y: this.y, target: h, speed: 620, kind: this.T.proj || 'arrow', hostile: true,
        onHit: (t) => { if (t) t.takeDamage(this.dmg, 'phys', this); },
      }));
    } else {
      h.takeDamage(this.dmg, 'phys', this);
    }
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.baseSpeed * (1 - this.slowPct()) * dt;
    if (d < 1) return true;
    this.facing = Math.atan2(dy, dx);
    if (d <= step) { this.x = tx; this.y = ty; return true; }
    this.x += dx / d * step; this.y += dy / d * step;
    return false;
  }

  followPath(dt) {
    const R = this.route, P = R.path, last = P.length - 1;
    const useOff = this.wp < last && this.wp > 0;
    const tx = P[this.wp][0] + (useOff ? this.ox : 0);
    const ty = P[this.wp][1] + (useOff ? this.oy : 0);
    const arrived = this.moveToward(tx, ty, dt);
    const dLeft = U.dist(this.x, this.y, P[this.wp][0], P[this.wp][1]);
    const segLen = R.cum[this.wp] - R.cum[this.wp - 1];
    this.progress = (R.cum[this.wp - 1] + Math.max(0, segLen - dLeft)) / R.total;
    if (arrived || dLeft < 12) {
      this.wp++;
      if (this.wp > last) this.lane.leak(this);
    }
  }
}

// ---------------------------------------------------------------- projectile
class Projectile {
  constructor(lane, o) {
    this.lane = lane;
    this.x = o.x; this.y = o.y;
    this.target = o.target || null;
    this.tx = o.tx !== undefined ? o.tx : (o.target ? o.target.x : o.x);
    this.ty = o.ty !== undefined ? o.ty : (o.target ? o.target.y : o.y);
    this.speed = o.speed || 800;
    this.kind = o.kind || 'arrow';
    this.onHit = o.onHit;
    this.hostile = !!o.hostile;
    this.alive = true;
    this.angle = U.angle(this.x, this.y, this.tx, this.ty);
    this.size = o.size || 1;
    this.age = 0;
  }
  update(dt) {
    this.age += dt;
    if (this.target) {
      if (this.target.alive) { this.tx = this.target.x; this.ty = this.target.y; }
      else this.target = null;
    }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d > 0.01) this.angle = Math.atan2(dy, dx);
    if (d <= step + 4) {
      this.x = this.tx; this.y = this.ty;
      this.alive = false;
      if (this.onHit) this.onHit(this.target && this.target.alive ? this.target : null, this.x, this.y);
    } else {
      this.x += dx / d * step; this.y += dy / d * step;
    }
  }
}

// ---------------------------------------------------------------- hero
class Hero extends Unit {
  constructor(game, player, defId) {
    super();
    this.id = _uid++;
    this.game = game; this.player = player;
    this.def = HERO_BY_ID[defId];
    this.isHero = true;
    this.x = HERO_SPAWN.x; this.y = HERO_SPAWN.y; this.r = 20;
    this.level = 1; this.xp = 0; this.skillPoints = 1;
    this.abilLv = [0, 0, 0, 0]; this.cds = [0, 0, 0, 0];
    this.items = [null, null, null, null, null, null];
    this.potions = { hp: 0, mp: 0 };
    this.tome = { str: 0, agi: 0, int: 0 };
    this.buffs = [];
    this.alive = true; this.respawnT = 0;
    this.cmd = null; this.target = null;
    this.atkT = 0; this.animAtk = 0; this.animCast = 0; this.walk = 0; this.moving = false;
    this.facing = -Math.PI / 2;
    this.channel = null;
    this.size = 1;
    this.initStatus();
    this.recalc();
    this.hp = this.maxHp; this.mana = this.maxMana;
  }

  av(i, key) { // ability value at current level
    const lv = this.abilLv[i];
    if (!lv) return 0;
    return this.def.abilities[i].vals[key][lv - 1];
  }
  passiveIdx(id) { return this.def.abilities.findIndex(a => a.id === id); }
  pv(id, key) { const i = this.passiveIdx(id); return i < 0 ? 0 : this.av(i, key); }

  recalc() {
    const D = this.def, L = this.level - 1;
    const b = { dmg: 0, armor: 0, str: 0, agi: 0, int: 0, ms: 0, msPct: 0, ias: 0, hpRegen: 0, manaRegen: 0,
      hp: 0, spellAmp: 0, lifesteal: 0, cleave: 0, slowOnHit: 0, chain: 0, reflect: 0, dmgTaken: 1, size: 0 };
    for (const it of this.items) {
      if (!it) continue;
      const s = ITEM_BY_ID[it].stats;
      for (const k in s) b[k] += s[k];
    }
    for (const bf of this.buffs) {
      if (!bf.stats) continue;
      for (const k in bf.stats) {
        if (k === 'dmgTaken') b.dmgTaken *= bf.stats[k];
        else b[k] += bf.stats[k];
      }
    }
    // passives
    b.cleave += this.pv('cleave', 'cleave') / 100 + this.pv('vampirism', 'cleave') / 100;
    b.lifesteal += this.pv('vampirism', 'ls') / 100;
    b.manaRegen += this.pv('kindling', 'regen') + this.pv('brilliance', 'regen');
    b.spellAmp += this.pv('brilliance', 'amp') / 100;

    this.str = D.str + D.strG * L + this.tome.str + b.str;
    this.agi = D.agi + D.agiG * L + this.tome.agi + b.agi;
    this.int = D.int + D.intG * L + this.tome.int + b.int;
    const prim = this[D.primary];

    const oldMax = this.maxHp || 1, oldMana = this.maxMana || 1;
    this.maxHp = Math.round(180 + this.str * 20 + b.hp);
    this.maxMana = Math.round(60 + this.int * 13);
    if (this.hp !== undefined) {
      if (this.maxHp !== oldMax) this.hp = Math.min(this.maxHp, this.hp * this.maxHp / oldMax);
      if (this.maxMana !== oldMana) this.mana = Math.min(this.maxMana, this.mana * this.maxMana / oldMana);
    }
    this.hpRegen = 0.5 + this.str * 0.05 + b.hpRegen;
    this.manaRegen = 0.4 + this.int * 0.045 + b.manaRegen;
    this.armor = D.armor + this.agi * 0.16 + b.armor;
    this.damage = D.baseDmg + prim + 2.5 * L + b.dmg;
    this.ias = Math.min(4, this.agi * 0.02 + b.ias);
    this.atkCd = D.bat / (1 + this.ias);
    this.ms = (D.ms + b.ms) * (1 + b.msPct);
    this.spellAmp = 1 + this.int * 0.013 + b.spellAmp;
    this.cdr = Math.min(0.45, this.int * 0.0022);
    this.lifesteal = b.lifesteal;
    this.cleave = b.cleave;
    this.slowOnHit = b.slowOnHit;
    this.chainChance = b.chain;
    this.reflect = b.reflect;
    this.dmgTaken = b.dmgTaken;
    this.size = 1 + b.size;
    this.range = D.range;
  }

  get untargetable() { return !!this.channel; }
  xpToNext() { return 80 + 60 * this.level; }

  gainXp(x) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += x;
    while (this.level < MAX_LEVEL && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.skillPoints++;
      this.recalc();
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
      if (this.lane) {
        this.lane.addFx('levelup', { x: this.x, y: this.y, follow: this }, 1.2);
        this.lane.addText(this.x, this.y - 40, 'LEVEL ' + this.level, '#ffe066', 18);
      }
      this.game.emit('sfx', { name: 'levelup', lane: this.player.id });
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
  }

  canLearn(i) {
    if (this.skillPoints <= 0) return false;
    const a = this.def.abilities[i], lv = this.abilLv[i];
    if (a.ult) return lv < 3 && this.level >= [6, 11, 16][lv];
    return lv < 4 && this.level >= 2 * lv + 1;
  }
  learn(i) {
    if (!this.canLearn(i)) return false;
    this.abilLv[i]++;
    this.skillPoints--;
    this.recalc();
    return true;
  }

  canCast(i) {
    const a = this.def.abilities[i], lv = this.abilLv[i];
    if (!lv || a.type === 'passive' || !this.alive || this.stun > 0 || this.channel) return false;
    return this.cds[i] <= 0 && this.mana >= a.mana[lv - 1];
  }
  cast(i, target) {
    if (!this.canCast(i)) return false;
    const a = this.def.abilities[i], lv = this.abilLv[i];
    let t = target;
    if (a.type === 'point' || a.type === 'dir') {
      if (!t) return false;
      const ang = U.angle(this.x, this.y, t.x, t.y);
      const d = U.dist(this.x, this.y, t.x, t.y);
      if (a.type === 'point' && d > a.range) t = { x: this.x + Math.cos(ang) * a.range, y: this.y + Math.sin(ang) * a.range };
      if (a.type === 'dir') t = { x: this.x + Math.cos(ang) * a.range, y: this.y + Math.sin(ang) * a.range, ang };
      t.x = U.clamp(t.x, 20, WORLD_W - 20); t.y = U.clamp(t.y, 20, WORLD_H - 20);
      this.facing = ang;
    }
    const ok = ABIL[a.id](this, lv, a, t);
    if (ok === false) return false;
    this.mana -= a.mana[lv - 1];
    this.cds[i] = a.cd[lv - 1] * (1 - this.cdr);
    this.animCast = 1;
    this.game.emit('sfx', { name: a.id, lane: this.player.id });
    return true;
  }

  addBuff(b) {
    const ex = this.buffs.findIndex(x => x.id === b.id);
    if (ex >= 0) this.buffs.splice(ex, 1);
    b.max = b.t; b.acc = 0;
    this.buffs.push(b);
    this.recalc();
  }
  hasBuff(id) { return this.buffs.some(b => b.id === id); }

  usePotion(kind) {
    if (!this.alive || this.potions[kind] <= 0) return false;
    if (kind === 'hp' && this.hasBuff('hpot')) return false;
    if (kind === 'mp' && this.hasBuff('mpot')) return false;
    this.potions[kind]--;
    if (kind === 'hp') this.addBuff({ id: 'hpot', t: 3, hps: this.maxHp * 0.4 / 3 });
    else this.addBuff({ id: 'mpot', t: 3, mps: this.maxMana * 0.5 / 3 });
    this.lane.addFx('potion', { x: this.x, y: this.y, follow: this, color: kind === 'hp' ? '#ff5d73' : '#5db7ff' }, 1);
    this.game.emit('sfx', { name: 'potion', lane: this.player.id });
    return true;
  }

  takeDamage(amount, type, src) {
    if (!this.alive || this.channel) return 0;
    let d = amount;
    if (type === 'phys') d *= U.armorMult(this.armor);
    d *= this.dmgTaken;
    if (this.def.melee && src && src.isCreep) d *= 0.85; // melee heroes are built to brawl
    this.hp -= d;
    this.hitFlash = 0.08;
    if (this.reflect > 0 && src && src.alive && src.isCreep) src.takeDamage(d * this.reflect, 'magic', this, true);
    if (this.hp <= 0) this.die();
    return d;
  }

  heal(amt) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amt);
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.respawnT = 4 + this.level * 0.75;
    this.cmd = null; this.target = null; this.channel = null;
    this.buffs = []; this.slows = []; this.burns = []; this.stun = 0;
    this.recalc();
    this.lane.addFx('herodeath', { x: this.x, y: this.y }, 1.5);
    this.game.emit('sfx', { name: 'herodeath', lane: this.player.id });
    this.game.emit('herodeath', { player: this.player.id });
  }

  respawn() {
    this.alive = true;
    this.x = HERO_SPAWN.x; this.y = HERO_SPAWN.y;
    this.recalc();
    this.hp = this.maxHp; this.mana = this.maxMana;
    this.lane.addFx('levelup', { x: this.x, y: this.y, follow: this }, 1);
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.ms * (1 - this.slowPct()) * dt;
    if (d < 0.5) return true;
    this.facing = Math.atan2(dy, dx);
    this.moving = true;
    if (d <= step) { this.x = tx; this.y = ty; return true; }
    this.x += dx / d * step; this.y += dy / d * step;
    this.clampPos();
    return false;
  }
  clampPos() {
    this.x = U.clamp(this.x, 30, WORLD_W - 30);
    this.y = U.clamp(this.y, 30, WORLD_H - 40);
  }

  inRange(c) { return U.dist(this.x, this.y, c.x, c.y) <= this.range + c.r + this.r * 0.6; }

  acquire() {
    const acq = this.def.melee ? 380 : this.range + 160;
    if (this.target && this.target.alive) {
      if (U.dist(this.x, this.y, this.target.x, this.target.y) < acq * 1.3) return this.target;
    }
    this.target = this.lane.nearestEnemy(this.x, this.y, acq);
    return this.target;
  }

  update(dt) {
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    // buffs
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      if (b.hps) this.heal(b.hps * dt);
      if (b.mps) this.mana = Math.min(this.maxMana, this.mana + b.mps * dt);
      if (b.onTick) {
        b.acc += dt;
        while (b.acc >= b.interval) { b.acc -= b.interval; b.onTick(this, b); }
      }
      if ((b.t -= dt) <= 0) { this.buffs.splice(i, 1); changed = true; }
    }
    this.recalc();
    this.tickStatus(dt);
    if (!this.alive) return;

    // regen (+fountain)
    let hr = this.hpRegen, mr = this.manaRegen;
    if (U.dist2(this.x, this.y, FOUNTAIN.x, FOUNTAIN.y) < FOUNTAIN.r * FOUNTAIN.r) {
      hr += this.maxHp * 0.05; mr += this.maxMana * 0.05;
      this.atFountain = true;
    } else this.atFountain = false;
    this.hp = Math.min(this.maxHp, this.hp + hr * dt);
    this.mana = Math.min(this.maxMana, this.mana + mr * dt);
    for (let i = 0; i < 4; i++) if (this.cds[i] > 0) this.cds[i] -= dt;
    if (this.animAtk > 0) this.animAtk -= dt * 4;
    if (this.animCast > 0) this.animCast -= dt * 3;
    this.atkT -= dt;
    this.moving = false;

    if (this.channel) { this.channel.update(dt); return; }
    if (this.stun > 0) { this.stun -= dt; return; }

    const c = this.cmd;
    if (c && c.type === 'dir') {
      this.target = null;
      this.moveToward(this.x + c.dx * 100, this.y + c.dy * 100, dt * Math.min(1, c.mag || 1));
    } else if (c && c.type === 'move') {
      this.target = null;
      if (this.moveToward(c.x, c.y, dt)) this.cmd = null;
    } else {
      let t = null;
      if (c && c.type === 'attack') {
        t = c.target;
        if (!t || !t.alive) { this.cmd = null; t = null; }
        else this.target = t;
      }
      if (!t) t = this.acquire();
      if (t) {
        if (this.inRange(t)) {
          this.facing = U.angle(this.x, this.y, t.x, t.y);
          if (this.atkT <= 0) this.attack(t);
        } else this.moveToward(t.x, t.y, dt);
      }
    }
    if (this.moving) this.walk += dt * this.ms / 40;
  }

  attack(t) {
    this.atkT = this.atkCd;
    this.animAtk = 1;
    const dmg = this.damage * U.rand(0.94, 1.06) * (this.def.melee ? 1.2 : 1);
    this.game.emit('sfx', { name: this.def.melee ? 'swing' : 'shoot_' + this.def.proj, lane: this.player.id });
    if (this.def.melee) {
      this.hit(t, dmg, true);
    } else {
      this.shoot(t, dmg, true);
      const extra = this.pv('multishot', 'extra');
      if (extra) {
        const others = this.lane.creeps
          .filter(c => c.alive && c !== t && U.dist(this.x, this.y, c.x, c.y) < this.range + 60)
          .sort((a, b) => U.dist2(this.x, this.y, a.x, a.y) - U.dist2(this.x, this.y, b.x, b.y))
          .slice(0, extra);
        for (const o of others) this.shoot(o, dmg * 0.6, false);
      }
    }
  }

  shoot(t, dmg, primary) {
    this.lane.projectiles.push(new Projectile(this.lane, {
      x: this.x + Math.cos(this.facing) * 18, y: this.y + Math.sin(this.facing) * 18,
      target: t, speed: 1000, kind: this.def.proj,
      onHit: (tg) => { if (tg) this.hit(tg, dmg, primary); },
    }));
  }

  // apply an attack's damage + on-hit effects
  hit(t, dmg, primary) {
    let crit = false;
    const cm = this.pv('crit', 'mult');
    if (cm && U.chance(0.25)) { dmg *= cm; crit = true; }
    const dealt = t.takeDamage(dmg, 'phys', this);
    if (crit) {
      this.lane.addText(t.x, t.y - 30, Math.round(dealt) + '!', '#ff4d4d', 18);
      this.lane.addFx('critslash', { x: t.x, y: t.y, ang: this.facing }, 0.35);
    }
    if (this.def.melee) this.lane.addFx('hitspark', { x: t.x, y: t.y, color: this.def.accent }, 0.25);
    if (this.lifesteal > 0) this.heal(dealt * this.lifesteal);
    const burn = this.pv('kindling', 'burn');
    if (burn) t.addBurn(burn, 3, this);
    if (this.slowOnHit) t.addSlow(this.slowOnHit, 2);
    if (primary && this.cleave > 0 && this.def.melee) {
      const cl = dmg * this.cleave;
      for (const o of this.lane.enemiesInRadius(t.x, t.y, 170)) {
        if (o !== t) o.takeDamage(cl, 'phys', this);
      }
      this.lane.addFx('cleave', { x: t.x, y: t.y, ang: this.facing }, 0.3);
    }
    if (primary && this.chainChance && U.chance(this.chainChance)) ABIL._chain(this, t, 220, 4);
  }
}

// ---------------------------------------------------------------- lane
class Lane {
  constructor(game, id) {
    this.game = game; this.id = id;
    this.creeps = []; this.projectiles = []; this.fx = []; this.texts = [];
    this.zones = []; this.timers = []; this.sweeps = [];
    this.waveQueue = []; this.sendQueue = [];
    this.waveSpawnT = 0; this.sendSpawnT = 0;
    this.hero = null; this.player = null;
    this.shakeAmt = 0;
  }

  addFx(kind, props, dur) {
    const f = Object.assign({ kind, t: 0, dur }, props);
    this.fx.push(f);
    return f;
  }
  addText(x, y, text, color, size = 14) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, text, color, size, t: 0, dur: 1.1 });
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  timer(t, fn) { this.timers.push({ t, fn }); }

  enemiesInRadius(x, y, r) {
    const out = [];
    for (const c of this.creeps) {
      if (!c.alive) continue;
      const rr = r + c.r * 0.6;
      if (U.dist2(x, y, c.x, c.y) <= rr * rr) out.push(c);
    }
    return out;
  }
  enemiesInLine(x1, y1, x2, y2, w) {
    const out = [];
    for (const c of this.creeps) {
      if (!c.alive) continue;
      if (U.segDist(c.x, c.y, x1, y1, x2, y2).d <= w / 2 + c.r * 0.6) out.push(c);
    }
    return out;
  }
  nearestEnemy(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    for (const c of this.creeps) {
      if (!c.alive) continue;
      const d = U.dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  spell(h, c, amt, silent) {
    const d = c.takeDamage(amt * h.spellAmp, 'magic', h);
    if (!silent && d >= 1) this.addText(c.x + U.rand(-8, 8), c.y - 26, Math.round(d), '#8fd3ff', 12);
    return d;
  }

  killCreep(c, src) {
    if (!c.alive) return;
    c.alive = false;
    const p = this.player;
    p.addGold(c.bounty);
    p.stats.kills++;
    if (this.hero) this.hero.gainXp(c.xp);
    this.addText(c.x, c.y - 20, '+' + c.bounty, '#ffd84d', c.boss ? 20 : 13);
    this.addFx('death', { x: c.x, y: c.y, r: c.r, type: c.type, ang: c.facing }, c.boss ? 1.4 : 0.8);
    this.game.emit('sfx', { name: c.boss ? 'bossdeath' : 'kill', lane: this.id });
    if (c.T.onDeathSpawn) {
      const s = c.T.onDeathSpawn;
      const mul = waveMul(this.game.waveNum);
      for (let i = 0; i < s.n; i++) {
        const nc = new Creep(this, s.t || s.type, mul, { x: c.x + U.rand(-40, 40), y: c.y + U.rand(-40, 40), wp: c.wp });
        this.creeps.push(nc);
      }
    }
  }

  leak(c) {
    c.alive = false;
    c.leaked = true;
    this.player.lives -= c.lives;
    this.player.stats.leaks += c.lives;
    this.addFx('leak', { x: GATE.x, y: GATE.y }, 0.8);
    this.addText(GATE.x, GATE.y - 60, '-' + c.lives + ' ♥', '#ff4d6d', 22);
    this.game.emit('leak', { lane: this.id, lives: c.lives });
    this.game.emit('sfx', { name: 'leak', lane: this.id });
    this.shake(4);
  }

  spawnFrom(queueName, timerName, dt) {
    const q = this[queueName];
    if (!q.length) return;
    this[timerName] -= dt;
    while (q.length && this[timerName] <= 0) {
      const s = q.shift();
      const c = new Creep(this, s.type, s.mul, { sentBy: s.sentBy });
      this.creeps.push(c);
      this[timerName] += CREEPS[s.type].boss ? 1.0 : 0.42;
      if (!q.length) this[timerName] = 0;
    }
  }

  update(dt) {
    this.spawnFrom('waveQueue', 'waveSpawnT', dt);
    this.spawnFrom('sendQueue', 'sendSpawnT', dt);
    if (this.hero) this.hero.update(dt);
    for (const c of this.creeps) if (c.alive) c.update(dt);
    this.separate();
    for (const p of this.projectiles) p.update(dt);
    for (const s of this.sweeps) {
      const step = s.speed * dt;
      s.x += Math.cos(s.ang) * step; s.y += Math.sin(s.ang) * step; s.trav += step;
      for (const c of this.creeps) {
        if (!c.alive || s.hit.has(c)) continue;
        if (U.dist2(c.x, c.y, s.x, s.y) <= (s.w / 2 + c.r) ** 2) { s.hit.add(c); s.onHit(c); }
      }
      if (s.trav >= s.dist) s.done = true;
    }
    for (const z of this.zones) {
      z.t += dt; z.acc += dt;
      while (z.acc >= z.interval && z.t <= z.dur + 1e-6) { z.acc -= z.interval; z.onTick(z); }
    }
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) { tm.done = true; tm.fn(); } }
    for (const f of this.fx) f.t += dt;
    for (const t of this.texts) { t.t += dt; t.y -= 28 * dt; }
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 20);

    this.creeps = this.creeps.filter(c => c.alive);
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.sweeps = this.sweeps.filter(s => !s.done);
    this.zones = this.zones.filter(z => z.t < z.dur);
    this.timers = this.timers.filter(t => !t.done);
    this.fx = this.fx.filter(f => f.t < f.dur);
    this.texts = this.texts.filter(t => t.t < t.dur);
  }

  separate() {
    const cs = this.creeps, n = cs.length;
    for (let i = 0; i < n; i++) {
      const a = cs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) {
        const b = cs[j];
        if (!b.alive || a.flying !== b.flying) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = (a.r + b.r) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.0001) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        const wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push * wa; a.y -= ny * push * wa;
        b.x += nx * push * wb; b.y += ny * push * wb;
      }
    }
  }
}

// ---------------------------------------------------------------- player
class Player {
  constructor(game, id, heroId, isAI) {
    this.game = game; this.id = id; this.isAI = isAI;
    this.gold = START_GOLD; this.income = START_INCOME; this.lives = START_LIVES;
    this.stock = {}; this.stockT = {};
    for (const s of SENDS) { this.stock[s.id] = s.stock; this.stockT[s.id] = 0; }
    this.stats = { sent: 0, sentGold: 0, kills: 0, leaks: 0, goldEarned: 0 };
    this.heroId = heroId;
    this.ai = null;
    this.goldMult = 1;
  }
  addGold(g) {
    g = Math.round(g * this.goldMult);
    this.gold += g;
    this.stats.goldEarned += g;
    if (this.ai) this.ai.onGold(g);
  }
}

// ---------------------------------------------------------------- game
class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.time = 0;
    this.waveNum = 0;
    this.nextWaveT = WAVE_FIRST;
    this.incomeT = INCOME_INTERVAL;
    this.events = [];
    this.over = false; this.winner = -1;
    this.lanes = [new Lane(this, 0), new Lane(this, 1)];
    this.players = [0, 1].map(i => new Player(this, i, cfg.heroes[i], !!cfg.ai[i]));
    for (let i = 0; i < 2; i++) {
      const p = this.players[i], L = this.lanes[i];
      p.hero = new Hero(this, p, p.heroId);
      p.hero.lane = L;
      L.hero = p.hero; L.player = p;
      if (cfg.ai[i]) {
        p.ai = new AIController(this, p, cfg.difficulty[i] || 'normal');
        if (cfg.difficulty[i] === 'hard') p.goldMult = 1.12;
        if (cfg.difficulty[i] === 'easy') p.goldMult = 0.9;
      }
    }
  }

  emit(type, data) {
    if (this.events.length < 400) this.events.push({ type, ...data });
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    if (this.time >= this.nextWaveT) {
      this.waveNum++;
      this.nextWaveT += WAVE_INTERVAL;
      this.spawnWave(this.waveNum);
    }
    this.incomeT -= dt;
    if (this.incomeT <= 0) {
      this.incomeT += INCOME_INTERVAL;
      for (const p of this.players) p.addGold(p.income);
      this.emit('income', {});
      this.emit('sfx', { name: 'income', lane: -1 });
    }
    for (const p of this.players) {
      for (const s of SENDS) {
        if (p.stock[s.id] < s.stock) {
          p.stockT[s.id] += dt;
          if (p.stockT[s.id] >= s.restock) { p.stockT[s.id] = 0; p.stock[s.id]++; }
        } else p.stockT[s.id] = 0;
      }
      if (p.ai) p.ai.update(dt);
    }
    for (const L of this.lanes) L.update(dt);
    for (const p of this.players) {
      if (p.lives <= 0 && !this.over) {
        p.lives = 0;
        this.over = true;
        this.winner = 1 - p.id;
        this.emit('gameover', { winner: this.winner });
      }
    }
  }

  spawnWave(n) {
    const def = waveDef(n), mul = waveMul(n);
    for (const L of this.lanes) {
      for (const grp of def) for (let i = 0; i < grp.n; i++) L.waveQueue.push({ type: grp.t, mul, sentBy: -1 });
    }
    const boss = def.some(g => CREEPS[g.t].boss);
    this.emit('wave', { n, boss, name: def.map(g => CREEPS[g.t].name).join(' + ') });
    this.emit('sfx', { name: boss ? 'bosswave' : 'wave', lane: -1 });
  }

  sendUnlocked(s) { return this.waveNum >= s.unlock || (s.unlock <= 1); }

  canSend(pid, sendId) {
    const p = this.players[pid], s = SENDS.find(x => x.id === sendId);
    return !!s && this.sendUnlocked(s) && p.stock[s.id] > 0 && p.gold >= s.cost && !this.over;
  }
  send(pid, sendId) {
    if (!this.canSend(pid, sendId)) return false;
    const p = this.players[pid], s = SENDS.find(x => x.id === sendId);
    p.gold -= s.cost;
    p.income += s.income;
    p.stock[s.id]--;
    p.stats.sent += s.count;
    p.stats.sentGold += s.cost;
    const L = this.lanes[1 - pid];
    const mul = sendMul(this.waveNum);
    for (let i = 0; i < s.count; i++) L.sendQueue.push({ type: s.creep, mul, sentBy: pid });
    this.emit('send', { from: pid, creep: s.creep, count: s.count });
    if (!p.isAI) this.emit('sfx', { name: 'send', lane: -1 });
    return true;
  }

  itemUnlocked(it) { return this.waveNum >= TIER_UNLOCK[it.tier]; }

  canBuy(pid, itemId) {
    const p = this.players[pid], it = ITEM_BY_ID[itemId], h = p.hero;
    if (!it || p.gold < it.cost || !this.itemUnlocked(it) || this.over) return false;
    if (it.consumable) return h.potions[it.consumable] < 9;
    if (it.tome) return true;
    return h.items.includes(null);
  }
  buy(pid, itemId) {
    if (!this.canBuy(pid, itemId)) return false;
    const p = this.players[pid], it = ITEM_BY_ID[itemId], h = p.hero;
    p.gold -= it.cost;
    if (it.consumable) h.potions[it.consumable]++;
    else if (it.tome) {
      for (const k of ['str', 'agi', 'int']) if (it.tome[k]) h.tome[k] += it.tome[k];
      if (it.tome.xp) h.gainXp(it.tome.xp);
      h.recalc();
    } else {
      h.items[h.items.indexOf(null)] = itemId;
      h.recalc();
    }
    this.emit('sfx', { name: 'buy', lane: p.isAI ? 99 : -1 });
    return true;
  }
  sell(pid, slot) {
    const p = this.players[pid], h = p.hero, id = h.items[slot];
    if (!id) return false;
    h.items[slot] = null;
    p.gold += Math.floor(ITEM_BY_ID[id].cost / 2);
    h.recalc();
    return true;
  }
}
