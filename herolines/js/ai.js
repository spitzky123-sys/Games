'use strict';
// ============================================================================
//  AI opponent: defends its lane with its hero, buys items, sends creeps.
// ============================================================================
const AI_DIFF = {
  easy:   { think: 0.7, greed: 0.38, castMin: 4, potAt: 0.25, mistakes: 0.25 },
  normal: { think: 0.35, greed: 0.5, castMin: 3, potAt: 0.35, mistakes: 0.08 },
  hard:   { think: 0.15, greed: 0.55, castMin: 2, potAt: 0.4, mistakes: 0 },
};

class AIController {
  constructor(game, player, diff) {
    this.game = game; this.p = player;
    this.d = AI_DIFF[diff] || AI_DIFF.normal;
    this.thinkT = 0; this.econT = 1;
    this.sendBank = 0; this.itemBank = player.gold * 0.4;
    this.sendBank = player.gold * 0.6;
    this.buildIdx = 0;
    this.retreating = false;
  }

  onGold(g) {
    const greed = this.currentGreed();
    this.sendBank += g * greed;
    this.itemBank += g * (1 - greed);
  }

  currentGreed() {
    let g = this.d.greed;
    const p = this.p, foe = this.game.players[1 - p.id];
    if (p.lives < 12) g -= 0.15;                  // under pressure: invest in hero
    if (foe.lives < 10) g += 0.15;                // smell blood: push harder
    if (this.buildIdx >= this.p.hero.def.build.length) g += 0.2;
    return U.clamp(g, 0.15, 0.85);
  }

  update(dt) {
    this.thinkT -= dt;
    this.econT -= dt;
    if (this.thinkT <= 0) { this.thinkT = this.d.think; this.thinkHero(); }
    if (this.econT <= 0) { this.econT = 1; this.thinkEcon(); }
  }

  thinkHero() {
    const h = this.p.hero, L = h.lane;
    if (!h.alive) return;
    // skill points
    let guard = 10;
    while (h.skillPoints > 0 && guard--) {
      if (h.canLearn(3)) { h.learn(3); continue; }
      const order = h.def.skillOrder;
      const learned = h.abilLv[0] + h.abilLv[1] + h.abilLv[2];
      let done = false;
      if (learned < order.length && h.canLearn(order[learned])) done = h.learn(order[learned]);
      if (!done) for (const i of [0, 1, 2]) if (h.canLearn(i)) { done = h.learn(i); break; }
      if (!done) break;
    }
    // potions
    if (h.hp < h.maxHp * this.d.potAt) h.usePotion('hp');
    if (h.mana < h.maxMana * 0.2) h.usePotion('mp');

    // retreat / return
    const hpf = h.hp / h.maxHp;
    const danger = L.creeps.some(c => c.progress > 0.85);
    if (hpf < 0.22 && !danger) this.retreating = true;
    if (this.retreating && (hpf > 0.85 || danger && hpf > 0.45)) this.retreating = false;
    if (this.retreating) {
      h.cmd = { type: 'move', x: FOUNTAIN.x + U.rand(-40, 40), y: FOUNTAIN.y + U.rand(-30, 30) };
      // still use defensive spells
      this.tryCasts(true);
      return;
    }

    this.tryCasts(false);

    // pick target: protect the gate first
    let target = null;
    const live = L.creeps.filter(c => c.alive);
    if (live.length) {
      const urgent = live.filter(c => c.progress > 0.72).sort((a, b) => b.progress - a.progress);
      if (urgent.length) target = urgent[0];
      else {
        let bd = Infinity;
        for (const c of live) {
          const d = U.dist(h.x, h.y, c.x, c.y) - c.progress * 600;
          if (d < bd) { bd = d; target = c; }
        }
      }
    }
    if (Math.random() < this.d.mistakes) return; // occasionally hesitate
    if (target) {
      if (!h.cmd || h.cmd.type !== 'attack' || h.cmd.target !== target) h.cmd = { type: 'attack', target };
    } else {
      // idle near the middle of the lane bottom
      const idle = { x: 800, y: 1700 };
      if (U.dist(h.x, h.y, idle.x, idle.y) > 80) h.cmd = { type: 'move', x: idle.x, y: idle.y };
    }
  }

  tryCasts(defensiveOnly) {
    const h = this.p.hero;
    for (const i of [3, 0, 1]) {
      if (!h.canCast(i)) continue;
      const a = h.def.abilities[i];
      const t = Targeting.best(h, i);
      if (!t) continue;
      const isBuff = a.type === 'self' && !a.radius;
      let want;
      if (defensiveOnly) want = isBuff || a.id === 'bloodwhirl' || a.id === 'glacial';
      else if (isBuff) want = t.count >= 2 || t.boss;
      else if (a.ult) want = t.count >= this.d.castMin + 2 || t.boss || (t.count >= 2 && this.leakRisk());
      else want = t.count >= this.d.castMin || t.boss || (t.count >= 1 && this.leakRisk()) ||
        (h.mana > h.maxMana * 0.9 && t.count >= 1);
      if (a.id === 'shadowstep' && t.count < 2) want = false;
      if (want) { h.cast(i, t); break; }
    }
  }

  leakRisk() { return this.p.hero.lane.creeps.some(c => c.progress > 0.8); }

  thinkEcon() {
    const g = this.game, p = this.p, h = p.hero;
    // keep banks consistent with actual gold
    const total = this.sendBank + this.itemBank;
    if (total > p.gold) { const k = p.gold / (total || 1); this.sendBank *= k; this.itemBank *= k; }

    // --- items
    const build = h.def.build;
    let guard = 6;
    while (guard--) {
      if (h.potions.hp < 1 && g.waveNum > 0 && this.itemBank >= 50 && (this.potBuys = (this.potBuys || 0)) < 2 + g.waveNum / 4) {
        this.potBuys++;
        if (g.buy(p.id, 'hpot')) { this.itemBank -= 50; continue; }
      }
      if (this.buildIdx < build.length) {
        const id = build[this.buildIdx], it = ITEM_BY_ID[id];
        if (it.consumable) {
          if (this.itemBank >= it.cost && g.buy(p.id, id)) { this.itemBank -= it.cost; this.buildIdx++; continue; }
          break;
        }
        if (!g.itemUnlocked(it) || this.itemBank < it.cost || p.gold < it.cost) break;
        if (!h.items.includes(null)) {
          // sell the cheapest item to make room
          let si = -1, sc = Infinity;
          h.items.forEach((x, k) => { if (x && ITEM_BY_ID[x].cost < sc) { sc = ITEM_BY_ID[x].cost; si = k; } });
          if (sc >= it.cost) { this.buildIdx++; continue; }
          g.sell(p.id, si);
          this.itemBank += Math.floor(sc / 2);
        }
        if (g.buy(p.id, id)) { this.itemBank -= it.cost; this.buildIdx++; continue; }
        break;
      } else {
        const tome = { str: 'tstr', agi: 'tagi', int: 'tint' }[h.def.primary];
        if (this.itemBank >= 150 && g.buy(p.id, tome)) { this.itemBank -= 150; continue; }
        break;
      }
    }

    // stock-limited: move idle send budget to items
    if (this.sendBank > 300 + g.waveNum * 40) { const m = this.sendBank * 0.3; this.sendBank -= m; this.itemBank += m; }
    // --- sends: favour the highest unlocked tier we can afford, keep some variety
    guard = 12;
    while (guard--) {
      const opts = SENDS.filter(s => g.sendUnlocked(s) && p.stock[s.id] > 0 && s.cost <= this.sendBank && s.cost <= p.gold);
      if (!opts.length) break;
      // weight toward higher tiers
      opts.sort((a, b) => b.cost - a.cost);
      const s = Math.random() < 0.7 ? opts[0] : U.pick(opts.slice(0, 3));
      if (g.send(p.id, s.id)) this.sendBank -= s.cost; else break;
    }
  }
}
