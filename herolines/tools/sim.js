// Headless AI-vs-AI balance simulator.
// Usage: node tools/sim.js [gamesPerPair=4] [difficulty=normal]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Object, Array, JSON };
vm.createContext(ctx);
for (const f of ['data.js', 'util.js', 'game.js', 'abilities.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('this.Game = Game; this.HEROES = HEROES;', ctx);

const N = +(process.argv[2] || 4);
const diff = process.argv[3] || 'normal';
const ids = ctx.HEROES.map(h => h.id);
const wins = Object.fromEntries(ids.map(i => [i, 0]));
const games = Object.fromEntries(ids.map(i => [i, 0]));
const deaths = Object.fromEntries(ids.map(i => [i, 0]));
let totalT = 0, totalW = 0, played = 0;
const levels = Object.fromEntries(ids.map(i => [i, []]));

function play(a, b) {
  const g = new ctx.Game({ heroes: [a, b], ai: [true, true], difficulty: [diff, diff] });
  g.emit = function (type, d) { if (type === 'herodeath') deaths[g.players[d.player].heroId]++; };
  const dt = 1 / 30;
  while (!g.over && g.time < 60 * 45) g.update(dt);
  played++; totalT += g.time; totalW += g.waveNum;
  for (const p of g.players) { games[p.heroId]++; levels[p.heroId].push(p.hero.level); }
  if (g.winner >= 0) wins[g.players[g.winner].heroId]++;
  return g;
}

const t0 = Date.now();
for (const a of ids) for (const b of ids) {
  if (a === b) continue;
  for (let k = 0; k < N; k++) {
    const g = play(a, b);
    if (process.env.V) console.log(a, 'vs', b, 'winner', g.winner >= 0 ? g.players[g.winner].heroId : 'none',
      'wave', g.waveNum, 'lives', g.players.map(p => p.lives).join('/'), 'lv', g.players.map(p => p.hero.level).join('/'),
      'inc', g.players.map(p => p.income).join('/'));
  }
}
console.log(`games=${played} avgMinutes=${(totalT / played / 60).toFixed(1)} avgWave=${(totalW / played).toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
for (const i of ids) {
  const lv = levels[i].reduce((a, b) => a + b, 0) / levels[i].length;
  console.log(i.padEnd(10), 'winrate', (wins[i] / games[i] * 100).toFixed(0).padStart(3) + '%',
    ' deaths/game', (deaths[i] / games[i]).toFixed(1), ' endLevel', lv.toFixed(1));
}
