'use strict';
// ============================================================================
//  DOM UI: menus, HUD, touch controls, shop
// ============================================================================
const UI = (() => {
  const $ = id => document.getElementById(id);
  const state = { myLane: 0, viewLane: 0, aim: null, camOffset: null };
  let game = null;
  let hooks = {};
  let selHero = 'warden', diff = 'normal';
  try { selHero = localStorage.getItem('lb_hero') || 'warden'; diff = localStorage.getItem('lb_diff') || 'normal'; } catch (e) { /* ignore */ }
  if (!HERO_BY_ID[selHero]) selHero = 'warden';

  const cache = new Map();
  function setText(el, v) { if (cache.get(el) !== v) { cache.set(el, v); el.textContent = v; } }
  function setStyle(el, prop, v) { const k = el.id + prop + (el.dataset.i || ''); if (cache.get(k) !== v) { cache.set(k, v); el.style[prop] = v; } }
  function setClass(el, cls, on) { el.classList.toggle(cls, !!on); }

  // ---------------------------------------------------------------- menu
  const ATTR_NAME = { str: 'STR', agi: 'AGI', int: 'INT' };
  function fmtDesc(a, lv) {
    return a.desc.replace(/\{(\w+)\}/g, (_, k) => {
      const arr = a.vals[k];
      if (!arr) return k;
      return arr.map((v, i) => (i === lv - 1 ? `<b>${v}</b>` : `${v}`)).join('/');
    });
  }
  function abilityMeta(a) {
    if (a.type === 'passive') return '<span class="tag">PASSIVE</span>';
    let s = `<span class="tag">${a.ult ? 'ULTIMATE · ' : ''}${a.mana[0]} mana · ${a.cd[0]}s</span>`;
    return s;
  }
  function buildMenu() {
    const grid = $('heroGrid');
    grid.innerHTML = '';
    for (const h of HEROES) {
      const b = document.createElement('button');
      b.className = 'hcard' + (h.id === selHero ? ' on' : '');
      const pc = Art.heroPortrait(h.id, 184);
      b.appendChild(pc);
      b.insertAdjacentHTML('beforeend', `<div class="hn">${h.name}</div><div class="ht">${h.title}</div><span class="attr ${h.primary}">${ATTR_NAME[h.primary]}</span>`);
      b.onclick = () => { selHero = h.id; buildMenu(); Sfx.unlock(); Sfx.play('buy'); };
      grid.appendChild(b);
    }
    const h = HERO_BY_ID[selHero];
    const sr = (k, col) => `<div class="statRow"><span>${ATTR_NAME[k]}</span><div class="statBar"><div style="width:${Math.min(100, h[k] / 26 * 100)}%;background:${col}"></div></div><span>${h[k]} +${h[k + 'G'].toFixed(1)}</span></div>`;
    $('heroDetail').innerHTML = `
      <div>
        <h3>${h.name}, ${h.title}</h3>
        <div class="role">${h.role} · ${h.melee ? 'Melee' : 'Ranged'} · Primary <span class="attr ${h.primary}">${ATTR_NAME[h.primary]}</span></div>
        <p>${h.blurb}</p>
        ${sr('str', '#d9533f')}${sr('agi', '#4fc25a')}${sr('int', '#4f86e0')}
      </div>
      <div class="abList">${h.abilities.map(a => `<div class="abItem"><div class="ai">${a.icon}</div><div><b>${a.name}</b>${abilityMeta(a)}<br>${fmtDesc(a, 0)}</div></div>`).join('')}</div>`;
    for (const b of $('diffSeg').children) b.classList.toggle('on', b.dataset.d === diff);
  }

  function initMenu(h) {
    hooks = h;
    buildMenu();
    for (const b of $('diffSeg').children) b.onclick = () => { diff = b.dataset.d; buildMenu(); };
    $('btnStart').onclick = () => {
      Sfx.unlock();
      try { localStorage.setItem('lb_hero', selHero); localStorage.setItem('lb_diff', diff); } catch (e) { /* ignore */ }
      goFullscreen();
      hooks.start(selHero, diff);
    };
    $('btnHow').onclick = () => $('how').classList.remove('hidden');
    $('btnHowClose').onclick = () => $('how').classList.add('hidden');
    $('btnResume').onclick = () => hooks.resume();
    $('btnSound').onclick = () => { Sfx.setEnabled(!Sfx.enabled); updateSoundBtn(); };
    $('btnQuit').onclick = () => hooks.quit();
    $('btnAgain').onclick = () => hooks.start(selHero, diff);
    $('btnMenu').onclick = () => hooks.quit();
    $('btnRotateOk').onclick = () => { $('rotate').classList.add('hidden'); rotateDismissed = true; };
    updateSoundBtn();
    checkRotate();
    window.addEventListener('resize', checkRotate);
  }
  let rotateDismissed = false;
  function checkRotate() {
    const touch = 'ontouchstart' in window;
    const portrait = window.innerHeight > window.innerWidth;
    $('rotate').classList.toggle('hidden', !(touch && portrait && window.innerWidth < 700 && !rotateDismissed && game));
  }
  function goFullscreen() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen && 'ontouchstart' in window) {
        el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }
  function updateSoundBtn() { $('btnSound').textContent = 'Sound: ' + (Sfx.enabled ? 'On' : 'Off'); }

  function showMenu() {
    game = null;
    for (const id of ['hud', 'pause', 'over', 'modal']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden');
    buildMenu();
    checkRotate();
  }

  // ---------------------------------------------------------------- HUD build
  let abilBtns = [], sendCards = [];
  function buildHud(g) {
    game = g;
    state.myLane = 0; state.viewLane = 0; state.aim = null;
    cache.clear();
    $('menu').classList.add('hidden');
    for (const id of ['pause', 'over', 'modal']) $(id).classList.add('hidden');
    $('hud').classList.remove('hidden');
    const h = me().hero;
    const pc = Art.heroPortrait(h.def.id, 112);
    $('portrait').getContext('2d').drawImage(pc, 0, 0);
    setText($('heroName'), `${h.def.name} · ${h.def.title}`);
    state.freeCam = null;
    syncView();

    // abilities
    const wrap = $('abilities');
    wrap.innerHTML = '';
    abilBtns = [];
    const keys = ['Q', 'W', 'E', 'R'];
    h.def.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'abil' + (a.ult ? ' ult' : '') + (a.type === 'passive' ? ' passive' : '');
      b.dataset.i = i;
      const max = a.ult ? 3 : 4;
      b.innerHTML = `<span class="key">${keys[i]}</span>${a.icon}<div class="cd" data-i="${i}"></div><div class="cdt"></div>` +
        (a.type !== 'passive' ? `<div class="mana"></div>` : '') +
        `<div class="pips">${'<i></i>'.repeat(max)}</div>`;
      const learn = document.createElement('button');
      learn.className = 'learn hidden'; learn.textContent = '+';
      learn.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        if (me().hero.learn(i)) { Sfx.play('buy'); toast(`Learned ${a.name} (level ${me().hero.abilLv[i]})`, 'good'); }
      });
      b.appendChild(learn);
      wrap.appendChild(b);
      abilBtns.push({ b, a, cd: b.querySelector('.cd'), cdt: b.querySelector('.cdt'), mana: b.querySelector('.mana'), pips: [...b.querySelectorAll('.pips i')], learn });
      bindAbility(b, i);
    });

    // send tray
    const tray = $('sendTray');
    tray.innerHTML = '';
    sendCards = [];
    for (const s of SENDS) {
      const c = document.createElement('button');
      c.className = 'send';
      c.appendChild(Art.creepIcon(s.creep, 76));
      c.insertAdjacentHTML('beforeend', `<span class="cost">${s.cost}</span><span class="inc">+${s.income}</span><span class="stock"></span>${s.count > 1 ? `<span class="cnt">×${s.count}</span>` : ''}<div class="rst"></div>`);
      c.dataset.lock = 'W' + s.unlock;
      bindSend(c, s);
      tray.appendChild(c);
      sendCards.push({ c, s, stock: c.querySelector('.stock'), rst: c.querySelector('.rst') });
    }
    tray.classList.remove('hidden');
    $('btnSendToggle').classList.add('on');
    checkRotate();
  }
  function me() { return game.players[state.myLane]; }

  // ---------------------------------------------------------------- toasts
  function toast(text, cls = '') {
    const t = $('toasts');
    while (t.children.length > 3) t.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.textContent = text;
    t.appendChild(d);
    setTimeout(() => d.remove(), 3100);
  }

  // ---------------------------------------------------------------- tooltip
  function showTip(html, x, y) {
    const t = $('tooltip');
    t.innerHTML = html;
    t.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    t.style.left = U.clamp(x - r.width / 2, 6, window.innerWidth - r.width - 6) + 'px';
    t.style.top = U.clamp(y - r.height - 14, 6, window.innerHeight - r.height - 6) + 'px';
  }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  // ---------------------------------------------------------------- send cards
  function bindSend(c, s) {
    let lp = null, longFired = false;
    c.addEventListener('pointerdown', e => {
      longFired = false;
      const sx = e.clientX, sy = e.clientY;
      lp = setTimeout(() => {
        longFired = true;
        const T = CREEPS[s.creep], m = sendMul(game.waveNum);
        showTip(`<h4>${T.name}${s.count > 1 ? ' ×' + s.count : ''}</h4><div class="tt-sub">${T.tag || (T.ranged ? 'Ranged' : 'Melee')}</div>
          HP ${Math.round(T.hp * m.hp)} · Armor ${T.armor} · Speed ${T.speed}<br>Cost <b style="color:var(--gold)">${s.cost}</b> · Income <b style="color:#9cf07a">+${s.income}</b><br>Stock ${game.players[0].stock[s.id]}/${s.stock} · Unlocks wave ${s.unlock}`, sx, sy);
      }, 420);
    });
    const clear = () => { clearTimeout(lp); setTimeout(hideTip, 900); };
    c.addEventListener('pointerup', clear);
    c.addEventListener('pointercancel', clear);
    c.addEventListener('pointerleave', () => clearTimeout(lp));
    c.addEventListener('click', () => {
      if (longFired) return;
      if (!game || game.over) return;
      const p = me();
      if (!game.sendUnlocked(s)) return toast(`Unlocks at wave ${s.unlock}`, 'bad');
      if (p.stock[s.id] <= 0) return toast('Out of stock — restocking', 'bad');
      if (p.gold < s.cost) return toast('Not enough gold', 'bad');
      if (game.send(0, s.id)) {
        c.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 160 });
      }
    });
  }

  // ---------------------------------------------------------------- abilities
  function bindAbility(b, i) {
    let aim = null;
    const cz = $('cancelZone');
    const inCancel = (x, y) => {
      if (cz.classList.contains('hidden')) return false;
      const r = cz.getBoundingClientRect();
      return x > r.left - 10 && x < r.right + 10 && y > r.top - 10 && y < r.bottom + 10;
    };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sfx.unlock();
      if (!game || game.over || state.viewLane !== state.myLane) return;
      b.setPointerCapture(e.pointerId);
      const h = me().hero, a = h.def.abilities[i];
      aim = { i, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      if (a.type === 'passive' || !h.abilLv[i]) return;
      const t = Targeting.best(h, i);
      const fx = h.x + Math.cos(h.facing) * (a.range || 0) * 0.6, fy = h.y + Math.sin(h.facing) * (a.range || 0) * 0.6;
      state.aim = { i, x: t ? t.x : fx, y: t ? t.y : fy, cancel: false };
      if (a.type !== 'self') cz.classList.remove('hidden');
    });
    b.addEventListener('pointermove', e => {
      if (!aim || e.pointerId !== aim.pid || !state.aim) return;
      const dx = e.clientX - aim.sx, dy = e.clientY - aim.sy, len = Math.hypot(dx, dy);
      const h = me().hero, a = h.def.abilities[i];
      if (len > 14) aim.moved = true;
      if (aim.moved && a.type !== 'self') {
        const k = Math.min(1, len / 110) * (a.range || 0);
        state.aim.x = h.x + dx / (len || 1) * k;
        state.aim.y = h.y + dy / (len || 1) * k;
      }
      state.aim.cancel = inCancel(e.clientX, e.clientY);
      cz.classList.toggle('hot', state.aim.cancel);
    });
    const end = e => {
      if (!aim || e.pointerId !== aim.pid) return;
      const h = me().hero, a = h.def.abilities[i];
      const cur = state.aim;
      state.aim = null;
      cz.classList.add('hidden'); cz.classList.remove('hot');
      const wasMoved = aim.moved;
      aim = null;
      if (e.type === 'pointercancel') return;
      if (a.type === 'passive' || !h.abilLv[i]) {
        const r = b.getBoundingClientRect();
        showTip(`<h4>${a.icon} ${a.name} <span class="tt-sub">${a.type === 'passive' ? 'Passive' : ''}</span></h4>${fmtDesc(a, h.abilLv[i])}${!h.abilLv[i] ? '<br><i class="tt-sub">Not learned yet</i>' : ''}`, r.left + r.width / 2, r.top);
        setTimeout(hideTip, 2200);
        return;
      }
      if (cur && cur.cancel) return;
      castAbility(i, wasMoved ? cur : null);
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
  }

  function castAbility(i, at) {
    const h = me().hero, a = h.def.abilities[i];
    if (!h.alive) return;
    if (!h.abilLv[i]) return toast('Ability not learned yet', 'bad');
    if (h.cds[i] > 0) return toast(`${a.name} is on cooldown`, 'bad');
    if (h.mana < a.mana[h.abilLv[i] - 1]) return toast('Not enough mana', 'bad');
    let t = at;
    if (!t) {
      const best = Targeting.best(h, i);
      if (best) t = best;
      else if (a.type === 'self') t = { x: h.x, y: h.y };
      else t = { x: h.x + Math.cos(h.facing) * a.range * 0.6, y: h.y + Math.sin(h.facing) * a.range * 0.6 };
    }
    if (!h.cast(i, t) && a.id === 'phantom') toast('No enemies nearby', 'bad');
  }

  // ---------------------------------------------------------------- canvas input
  function initInput(canvas) {
    const ptrs = new Map();
    let pinch = null;
    const joyBase = $('joyBase'), knob = $('joyKnob');
    canvas.addEventListener('pointerdown', e => {
      Sfx.unlock();
      if (!game) return;
      hideTip();
      canvas.setPointerCapture(e.pointerId);
      const p = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, joy: false };
      ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d0: Math.hypot(a.sx - b.sx, a.sy - b.sy), z0: Render.cam.zoom };
        for (const q of ptrs.values()) if (q.joy) { q.joy = false; joyBase.classList.add('hidden'); me().hero.cmd = null; }
        return;
      }
      if (state.viewLane !== state.myLane) {
        p.pan = { x: Render.cam.x, y: Render.cam.y };
      } else if (e.clientX < window.innerWidth * 0.45) {
        p.joy = true;
        joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px';
        knob.style.transform = '';
      }
    });
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p || !game) return;
      p.cx = e.clientX; p.cy = e.clientY;
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const ax = a.cx !== undefined ? a.cx : a.sx, ay = a.cy !== undefined ? a.cy : a.sy;
        const bx = b.cx !== undefined ? b.cx : b.sx, by = b.cy !== undefined ? b.cy : b.sy;
        const d = Math.hypot(ax - bx, ay - by);
        Render.setZoom(pinch.z0 * d / (pinch.d0 || 1));
        return;
      }
      const dx = e.clientX - p.sx, dy = e.clientY - p.sy, len = Math.hypot(dx, dy);
      if (len > 10) p.moved = true;
      if (p.pan && p.moved) {
        state.freeCam = { x: p.pan.x - dx / Render.cam.scale, y: p.pan.y - dy / Render.cam.scale };
        return;
      }
      if (p.joy && p.moved) {
        joyBase.classList.remove('hidden');
        const k = Math.min(len, 50);
        knob.style.transform = `translate(${dx / len * k}px, ${dy / len * k}px)`;
        me().hero.cmd = { type: 'dir', dx: dx / len, dy: dy / len, mag: Math.min(1, len / 40) };
      }
    });
    const up = e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (!game) return;
      if (p.joy) {
        joyBase.classList.add('hidden');
        if (p.moved) me().hero.cmd = null;
      }
      if (!p.moved && performance.now() - p.t0 < 350 && e.type === 'pointerup') tapWorld(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { Render.setZoom(Render.cam.zoom * (e.deltaY > 0 ? 0.92 : 1.08)); e.preventDefault(); }, { passive: false });

    // keyboard (desktop)
    const keys = new Set();
    let mouse = { x: 0, y: 0 };
    canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('keydown', e => {
      if (!game || game.over) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { hooks.togglePause(); return; }
      if (!$('modal').classList.contains('hidden')) { if (k === 'b') closeModal(); return; }
      if (k === 'tab') { e.preventDefault(); toggleView(); return; }
      if (k === 'b') { openModal('shop'); return; }
      if (k === '1') me().hero.usePotion('hp');
      if (k === '2') me().hero.usePotion('mp');
      const qi = ['q', 'w', 'e', 'r'].indexOf(k);
      if (qi >= 0 && !keys.has('shift')) {
        const h = me().hero, a = h.def.abilities[qi];
        if (e.shiftKey) { h.learn(qi); return; }
        const w = Render.screenToLane(mouse.x, mouse.y, state.myLane);
        castAbility(qi, a.type === 'self' ? null : w);
        return;
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'a', 's', 'd', 'z'].includes(k)) { keys.add(k); updKeys(); }
    });
    window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); if (game) updKeys(true); });
    function updKeys(release) {
      let dx = 0, dy = 0;
      if (keys.has('arrowleft') || keys.has('a')) dx--;
      if (keys.has('arrowright') || keys.has('d')) dx++;
      if (keys.has('arrowup') || keys.has('z')) dy--;
      if (keys.has('arrowdown') || keys.has('s')) dy++;
      const h = me().hero;
      if (dx || dy) { const l = Math.hypot(dx, dy); h.cmd = { type: 'dir', dx: dx / l, dy: dy / l, mag: 1 }; }
      else if (release && h.cmd && h.cmd.type === 'dir') h.cmd = null;
    }
  }

  function tapWorld(sx, sy) {
    if (state.viewLane !== state.myLane) { state.freeCam = null; return; } // tap = recentre on enemy hero
    const w = Render.screenToLane(sx, sy, state.myLane);
    const h = me().hero;
    if (!h.alive) return;
    let best = null, bd = Infinity;
    for (const c of h.lane.creeps) {
      if (!c.alive) continue;
      const d = U.dist(w.x, w.y, c.x, c.y - (c.flying ? 24 : 0));
      if (d < c.r + 34 && d < bd) { bd = d; best = c; }
    }
    if (best) { h.cmd = { type: 'attack', target: best }; h.target = best; }
    else h.cmd = { type: 'move', x: U.clamp(w.x, 30, WORLD_W - 30), y: U.clamp(w.y, 30, WORLD_H - 40) };
  }

  function setView(lane) {
    if (!game) return;
    state.viewLane = lane;
    state.freeCam = null;
    state.aim = null;
    syncView();
  }
  function toggleView() { setView(state.viewLane === state.myLane ? 1 - state.myLane : state.myLane); }
  let portraitFor = null;
  function syncView() {
    const enemy = state.viewLane !== state.myLane;
    $('btnView').classList.toggle('on', enemy);
    $('btnViewLbl').textContent = enemy ? 'My lane' : 'Enemy';
    $('viewBanner').classList.toggle('hidden', !enemy);
    $('joyBase').classList.add('hidden');
    const vh = game.lanes[state.viewLane].hero;
    if (enemy) $('viewName').textContent = vh.def.name;
    if (portraitFor !== vh) {
      portraitFor = vh;
      const pc = Art.heroPortrait(vh.def.id, 112), x = $('portrait').getContext('2d');
      x.clearRect(0, 0, 112, 112); x.drawImage(pc, 0, 0);
      setText($('heroName'), (enemy ? 'Enemy · ' : '') + `${vh.def.name} · ${vh.def.title}`);
      $('heroPanel').classList.toggle('enemy', enemy);
    }
  }

  // ---------------------------------------------------------------- HUD buttons
  function initHudButtons() {
    $('btnView').onclick = toggleView;
    $('viewBanner').onclick = () => setView(state.myLane);
    $('minimap').addEventListener('pointerdown', e => {
      e.stopPropagation();
      const r = $('minimap').getBoundingClientRect();
      const wx = (e.clientX - r.left) / r.width * Render.FULL_W;
      const lane = wx < WORLD_W + Render.GAP / 2 ? 0 : 1;
      if (lane !== state.viewLane) setView(lane);
    });
    $('btnPause').onclick = () => hooks.togglePause();
    $('btnShop').onclick = () => openModal('shop');
    $('portraitWrap').onclick = () => openModal('hero');
    $('btnSendToggle').onclick = () => {
      const t = $('sendTray');
      t.classList.toggle('hidden');
      $('btnSendToggle').classList.toggle('on', !t.classList.contains('hidden'));
    };
    $('potHp').onclick = () => { if (game && !me().hero.usePotion('hp')) toast(me().hero.potions.hp ? 'Already drinking' : 'No healing potions — buy in shop', 'bad'); };
    $('potMp').onclick = () => { if (game && !me().hero.usePotion('mp')) toast(me().hero.potions.mp ? 'Already drinking' : 'No mana potions — buy in shop', 'bad'); };
    $('modalClose').onclick = closeModal;
    for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => openModal(b.dataset.tab);
  }

  // ---------------------------------------------------------------- modal (shop / hero)
  let modalTab = 'shop', sellPending = -1, sellTimer = null;
  function openModal(tab) {
    if (!game || game.over) return;
    modalTab = tab;
    $('modal').classList.remove('hidden');
    hooks.setPaused(true, 'modal');
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    renderModal();
  }
  function closeModal() {
    $('modal').classList.add('hidden');
    hideTip();
    hooks.setPaused(false, 'modal');
  }
  function statsHtml(h) {
    const red = Math.round((1 - U.armorMult(h.armor)) * 100);
    return `<div class="statsBox">
      <b>STR</b> ${Math.floor(h.str)} · <b>AGI</b> ${Math.floor(h.agi)} · <b>INT</b> ${Math.floor(h.int)}<br>
      Damage <b>${Math.round(h.damage * (h.def.melee ? 1.2 : 1))}</b> · ${(1 / h.atkCd).toFixed(2)} atk/s<br>
      Armor <b>${h.armor.toFixed(1)}</b> (${red}% reduction)<br>
      HP <b>${Math.round(h.maxHp)}</b> (+${h.hpRegen.toFixed(1)}/s) · Mana <b>${Math.round(h.maxMana)}</b> (+${h.manaRegen.toFixed(1)}/s)<br>
      Spell damage <b>+${Math.round((h.spellAmp - 1) * 100)}%</b> · Cooldowns <b>−${Math.round(h.cdr * 100)}%</b> · Speed <b>${Math.round(h.ms)}</b>
      ${h.lifesteal ? `<br>Lifesteal <b>${Math.round(h.lifesteal * 100)}%</b>` : ''}${h.cleave ? ` · Cleave <b>${Math.round(h.cleave * 100)}%</b>` : ''}
    </div>`;
  }
  function renderModal() {
    const p = me(), h = p.hero, body = $('modalBody');
    $('mGold').textContent = p.gold;
    if (modalTab === 'shop') {
      const tiers = [[0, 'Potions & Tomes'], [1, 'Basic items'], [2, 'Advanced items'], [3, 'Legendary items']];
      let html = '<div class="shopList">';
      for (const [t, name] of tiers) {
        const locked = game.waveNum < TIER_UNLOCK[t];
        html += `<h4>${name}${locked ? `<small>🔒 unlocks at wave ${TIER_UNLOCK[t]}</small>` : ''}</h4><div class="itemGrid">`;
        for (const it of ITEMS.filter(x => x.tier === t)) {
          const can = game.canBuy(0, it.id);
          const extra = it.consumable ? ` (have ${h.potions[it.consumable]})` : '';
          html += `<button class="item ${locked ? 'locked' : can ? '' : 'cant'}" data-buy="${it.id}"><div class="ii">${it.icon}</div><div><div class="in">${it.name}</div><div class="id">${it.desc}${extra}</div><div class="ic">🪙 ${it.cost}</div></div></button>`;
        }
        html += '</div>';
      }
      html += '</div>';
      html += `<div class="invPanel"><div class="inv">${h.items.map((id, k) => id
        ? `<button class="slot filled" data-sell="${k}">${ITEM_BY_ID[id].icon}<small>${sellPending === k ? 'Sell ' + Math.floor(ITEM_BY_ID[id].cost / 2) + '?' : ITEM_BY_ID[id].name}</small></button>`
        : `<div class="slot"></div>`).join('')}</div>
        <div class="tt-sub" style="font-size:11px;color:var(--muted)">Tap an item to sell it for half price.</div>
        ${statsHtml(h)}</div>`;
      body.innerHTML = html;
      body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        const it = ITEM_BY_ID[b.dataset.buy];
        if (!game.itemUnlocked(it)) return toast(`Unlocks at wave ${TIER_UNLOCK[it.tier]}`, 'bad');
        if (p.gold < it.cost) return toast('Not enough gold', 'bad');
        if (!it.consumable && !it.tome && !h.items.includes(null)) return toast('Inventory full — sell an item first', 'bad');
        if (game.buy(0, it.id)) { Sfx.play('buy'); renderModal(); }
      });
      body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
        const k = +b.dataset.sell;
        if (sellPending === k) { game.sell(0, k); sellPending = -1; Sfx.play('income'); }
        else { sellPending = k; clearTimeout(sellTimer); sellTimer = setTimeout(() => { sellPending = -1; if (!$('modal').classList.contains('hidden')) renderModal(); }, 2500); }
        renderModal();
      });
    } else {
      const pc = Art.heroPortrait(h.def.id, 160);
      body.innerHTML = `<div class="heroTab"><div>
          <div id="htPortrait"></div>
          <h3 style="font-family:Cinzel,serif;color:var(--gold);margin:6px 0 2px">${h.def.name}, ${h.def.title}</h3>
          <div class="tt-sub" style="color:var(--muted);font-size:12px">Level ${h.level} · ${h.skillPoints} skill point(s) · XP ${Math.floor(h.xp)}/${h.xpToNext()}</div>
          ${statsHtml(h)}
        </div><div>${h.def.abilities.map((a, i) => `<div class="abItem" style="margin-bottom:8px"><div class="ai">${a.icon}</div>
          <div><b>${a.name}</b> <span class="lvTag">Lv ${h.abilLv[i]}/${a.ult ? 3 : 4}</span>${abilityMeta(a)}<br>${fmtDesc(a, h.abilLv[i])}
          ${a.ult ? '<br><span class="tt-sub" style="color:var(--muted)">Requires hero level 6 / 11 / 16</span>' : ''}</div>
          ${h.canLearn(i) ? `<button data-learn="${i}" class="big" style="font-size:13px;padding:5px 10px">Learn</button>` : ''}</div>`).join('')}</div></div>`;
      pc.style.borderRadius = '12px'; pc.style.width = '96px'; pc.style.border = '2px solid var(--gold)';
      $('htPortrait').appendChild(pc);
      body.querySelectorAll('[data-learn]').forEach(b => b.onclick = () => { h.learn(+b.dataset.learn); Sfx.play('buy'); renderModal(); });
    }
  }

  // ---------------------------------------------------------------- events
  let pendingSends = {}, sendFlushT = 0, lastSP = 0;
  function processEvents(g) {
    for (const ev of g.events) {
      switch (ev.type) {
        case 'sfx':
          if (ev.lane === -1 || ev.lane === state.viewLane) Sfx.play(ev.name);
          break;
        case 'wave':
          toast(ev.boss ? `⚠ BOSS WAVE ${ev.n}: ${ev.name}` : `Wave ${ev.n}: ${ev.name}`, 'big');
          if (ev.n === TIER_UNLOCK[2] || ev.n === TIER_UNLOCK[3]) toast('New items available in the shop!', 'good');
          {
            const un = SENDS.filter(s => s.unlock === ev.n && s.unlock > 1);
            for (const s of un) toast(`New send unlocked: ${CREEPS[s.creep].name}`, 'good');
          }
          break;
        case 'send':
          if (ev.from !== state.myLane) {
            pendingSends[ev.creep] = (pendingSends[ev.creep] || 0) + ev.count;
            if (!sendFlushT) sendFlushT = 1.2;
          }
          break;
        case 'leak':
          if (ev.lane === state.myLane) toast(`Leak! −${ev.lives} ${ev.lives > 1 ? 'lives' : 'life'}`, 'bad');
          break;
        case 'income':
          toast(`Income +${me().income} gold`, 'good');
          break;
        case 'herodeath':
          if (ev.player === state.myLane) toast('Your hero has fallen!', 'bad');
          else toast('Enemy hero slain!', 'good');
          break;
        case 'gameover':
          setTimeout(() => showGameOver(g), 900);
          break;
      }
    }
    g.events.length = 0;
  }

  function showGameOver(g) {
    if (game !== g) return;
    const win = g.winner === state.myLane;
    const t = $('overTitle');
    t.textContent = win ? 'Victory!' : 'Defeat';
    t.className = win ? 'win' : 'lose';
    const [a, b] = g.players;
    const row = (k, f) => `<tr><td>${k}</td><td>${f(a)}</td><td>${f(b)}</td></tr>`;
    $('overStats').innerHTML = `<table><tr><th></th><th>You</th><th>Enemy</th></tr>
      ${row('Hero', p => p.hero.def.name)}${row('Level', p => p.hero.level)}${row('Lives left', p => p.lives)}
      ${row('Creeps killed', p => p.stats.kills)}${row('Creeps sent', p => p.stats.sent)}${row('Final income', p => p.income)}
      ${row('Gold earned', p => U.fmt(p.stats.goldEarned))}</table>
      <div style="margin-top:6px;color:var(--muted);font-size:12px">Reached wave ${g.waveNum} · ${Math.floor(g.time / 60)}m ${Math.floor(g.time % 60)}s</div>`;
    $('over').classList.remove('hidden');
    Sfx.play(win ? 'levelup' : 'herodeath');
  }

  // ---------------------------------------------------------------- per-frame HUD
  let slowT = 0;
  function update(g, dt) {
    if (!g || g !== game) return;
    const p = me(), h = p.hero, foe = g.players[1 - state.myLane];
    if (sendFlushT > 0) {
      sendFlushT -= dt;
      if (sendFlushT <= 0) {
        sendFlushT = 0;
        const parts = Object.entries(pendingSends).map(([k, n]) => `${n}× ${CREEPS[k].name}`);
        if (parts.length) toast('Enemy sent ' + parts.join(', '), 'bad');
        pendingSends = {};
      }
    }
    setText($('gold'), String(p.gold));
    setText($('income'), String(p.income));
    $('incArc').style.strokeDashoffset = String(94.2 * (g.incomeT / INCOME_INTERVAL));
    setText($('waveLbl'), 'Wave ' + g.waveNum);
    setText($('waveT'), 'next in ' + Math.max(0, Math.ceil(g.nextWaveT - g.time)) + 's');
    setText($('livesMe'), String(p.lives));
    setText($('livesFoe'), String(foe.lives));

    // hero panel (shows viewed hero)
    const vh = g.lanes[state.viewLane].hero;
    setStyle($('hpFill'), 'width', (vh.hp / vh.maxHp * 100).toFixed(1) + '%');
    setStyle($('mpFill'), 'width', (vh.mana / vh.maxMana * 100).toFixed(1) + '%');
    setStyle($('xpFill'), 'width', (vh.level >= MAX_LEVEL ? 100 : vh.xp / vh.xpToNext() * 100).toFixed(1) + '%');
    setText($('hpText'), `${Math.ceil(vh.hp)} / ${vh.maxHp}`);
    setText($('mpText'), `${Math.floor(vh.mana)} / ${vh.maxMana}`);
    setText($('lvl'), String(vh.level));
    $('deadOverlay').classList.toggle('hidden', vh.alive);
    if (!vh.alive) setText($('respawnT'), Math.ceil(vh.respawnT) + 's');
    $('spBadge').classList.toggle('hidden', !(h.skillPoints > 0 && state.viewLane === state.myLane));
    if (h.skillPoints > lastSP) toast('Skill point available — tap a gold +', 'good');
    lastSP = h.skillPoints;

    // abilities
    for (let i = 0; i < abilBtns.length; i++) {
      const A = abilBtns[i], a = A.a, lv = h.abilLv[i];
      setClass(A.b, 'unlearned', !lv);
      A.pips.forEach((pp, k) => setClass(pp, 'on', k < lv));
      A.learn.classList.toggle('hidden', !h.canLearn(i));
      if (a.type !== 'passive') {
        const cost = a.mana[Math.max(0, lv - 1)];
        setText(A.mana, String(cost));
        const cdMax = a.cd[Math.max(0, lv - 1)];
        const cd = Math.max(0, h.cds[i]);
        const pct = cd > 0 ? Math.round(cd / cdMax * 100) : 0;
        setStyle(A.cd, 'background', pct > 0 ? `conic-gradient(rgba(0,0,0,0.68) ${pct}%, rgba(0,0,0,0) ${pct}%)` : 'none');
        setText(A.cdt, cd > 0 ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : '');
        setClass(A.b, 'nomana', lv && h.mana < cost);
        setClass(A.b, 'ready', lv && cd <= 0 && h.mana >= cost && h.alive);
      }
    }
    setText($('potHpN'), String(h.potions.hp));
    setText($('potMpN'), String(h.potions.mp));
    setClass($('potHp'), 'empty', !h.potions.hp);
    setClass($('potMp'), 'empty', !h.potions.mp);

    slowT -= dt;
    if (slowT <= 0) {
      slowT = 0.15;
      for (const S of sendCards) {
        const s = S.s, unlocked = g.sendUnlocked(s);
        setClass(S.c, 'locked', !unlocked);
        setClass(S.c, 'off', unlocked && (p.gold < s.cost || p.stock[s.id] <= 0));
        setText(S.stock, String(p.stock[s.id]));
        S.rst.style.width = p.stock[s.id] < s.stock ? (p.stockT[s.id] / s.restock * 100).toFixed(0) + '%' : '0';
      }
      Render.drawMinimap($('minimap'), g, state.viewLane, state.myLane);
    }
  }

  return { state, initMenu, initInput, initHudButtons, showMenu, buildHud, update, processEvents, toast, closeModal, $ };
})();
