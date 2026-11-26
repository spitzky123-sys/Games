'use strict';
// ============================================================================
//  Boot + main loop
// ============================================================================
(() => {
  const STEP = 1 / 60;
  const canvas = document.getElementById('game');
  let game = null;          // the real match
  let demo = null;          // attract-mode match behind the menu
  const pauseReasons = new Set();
  let acc = 0, last = performance.now();

  Render.init(canvas);

  function newDemo() {
    const ids = HEROES.map(h => h.id);
    const a = U.pick(ids);
    let b = U.pick(ids); while (b === a) b = U.pick(ids);
    demo = new Game({ heroes: [a, b], ai: [true, true], difficulty: ['hard', 'hard'] });
    // fast-forward a little so there is action on screen
    for (let i = 0; i < 60 * 70; i++) demo.update(STEP);
    demo.events.length = 0;
  }

  function start(heroId, diff) {
    const others = HEROES.map(h => h.id).filter(id => id !== heroId);
    const foe = U.pick(others);
    game = new Game({ heroes: [heroId, foe], ai: [false, true], difficulty: [null, diff] });
    demo = null;
    pauseReasons.clear();
    UI.buildHud(game);
    window.__game = game; // debug handle
    UI.toast(`You: ${HERO_BY_ID[heroId].name} vs ${HERO_BY_ID[foe].name} (${diff})`, 'big');
    UI.toast('First wave in ' + WAVE_FIRST + 's — learn a skill and send some creeps!', 'good');
  }
  function quit() {
    game = null;
    pauseReasons.clear();
    newDemo();
    UI.showMenu();
  }
  function setPaused(on, reason) {
    if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
    document.getElementById('pause').classList.toggle('hidden', !pauseReasons.has('menu'));
  }
  function togglePause() {
    if (!game || game.over) return;
    if (!document.getElementById('modal').classList.contains('hidden')) { UI.closeModal(); return; }
    setPaused(!pauseReasons.has('menu'), 'menu');
  }

  UI.initMenu({ start, quit, resume: () => setPaused(false, 'menu'), togglePause, setPaused });
  UI.initHudButtons();
  UI.initInput(canvas);
  newDemo();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && !game.over) setPaused(true, 'menu');
  });

  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const g = game || demo;
    const running = g && !(game && pauseReasons.size) && !g.over;
    if (running) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) { g.update(STEP); acc -= STEP; n++; }
      if (n >= 5) acc = 0;
    }
    if (g) {
      if (game) UI.processEvents(game); else { demo.events.length = 0; if (demo.over) newDemo(); }
      Render.draw(g, game ? UI.state.viewLane : 0, running ? dt : 0, game ? UI.state : { myLane: 0 });
      if (game) UI.update(game, dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
