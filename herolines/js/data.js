'use strict';
// ============================================================================
//  Static game data: map, creeps, waves, sendable creeps, heroes, items.
// ============================================================================

const WORLD_W = 1600, WORLD_H = 2200;

// Ground path creeps walk (top portal -> bottom gate)
const PATH = [
  [800, -30], [800, 200], [330, 430], [330, 720], [1270, 920], [1270, 1200],
  [330, 1400], [330, 1660], [800, 1880], [800, 2120],
];
const FLY_PATH = [[800, -30], [800, 2120]];
const GATE = { x: 800, y: 2120 };
const SPAWN = { x: 800, y: -30 };
const HERO_SPAWN = { x: 800, y: 1985 };
const FOUNTAIN = { x: 800, y: 1985, r: 200 };

const START_GOLD = 120;
const START_INCOME = 12;
const INCOME_INTERVAL = 15;
const START_LIVES = 30;
const WAVE_FIRST = 12;
const WAVE_INTERVAL = 36;
const MAX_LEVEL = 25;

// ---------------------------------------------------------------------------
// Creep archetypes. Stats are wave-1 values; waves scale them.
// ---------------------------------------------------------------------------
const CREEPS = {
  gnoll:   { name: 'Gnoll Raider',  hp: 130, dmg: 10, armor: 1, speed: 72,  range: 30,  atkCd: 1.3, bounty: 5,  xp: 18, radius: 16 },
  wolf:    { name: 'Dire Wolf',     hp: 100, dmg: 8,  armor: 0, speed: 112, range: 28,  atkCd: 1.0, bounty: 4,  xp: 15, radius: 15 },
  spider:  { name: 'Venom Spider',  hp: 55,  dmg: 5,  armor: 0, speed: 92,  range: 24,  atkCd: 1.0, bounty: 2,  xp: 8,  radius: 11 },
  archer:  { name: 'Troll Archer',  hp: 110, dmg: 13, armor: 0, speed: 68,  range: 300, atkCd: 1.6, bounty: 6,  xp: 20, radius: 15, ranged: true, proj: 'arrow' },
  golem:   { name: 'Stone Golem',   hp: 300, dmg: 16, armor: 8, speed: 52,  range: 30,  atkCd: 1.6, bounty: 10, xp: 34, radius: 22, tag: 'Armored' },
  harpy:   { name: 'Storm Harpy',   hp: 150, dmg: 10, armor: 1, speed: 62,  range: 30,  atkCd: 1.2, bounty: 8,  xp: 26, radius: 17, flying: true, tag: 'Flying' },
  shaman:  { name: 'Troll Shaman',  hp: 170, dmg: 9,  armor: 1, speed: 62,  range: 260, atkCd: 1.8, bounty: 12, xp: 36, radius: 16, ranged: true, proj: 'bolt', heal: 30, healR: 240, tag: 'Healer' },
  ogre:    { name: 'Ogre Smasher',  hp: 520, dmg: 26, armor: 3, speed: 58,  range: 34,  atkCd: 1.8, bounty: 16, xp: 50, radius: 26 },
  wraith:  { name: 'Wraith',        hp: 240, dmg: 14, armor: 2, speed: 80,  range: 30,  atkCd: 1.2, bounty: 14, xp: 40, radius: 17, magicResist: 0.6, tag: 'Spell resistant' },
  drake:   { name: 'Fire Drake',    hp: 650, dmg: 24, armor: 4, speed: 55,  range: 220, atkCd: 1.6, bounty: 26, xp: 80, radius: 24, flying: true, ranged: true, proj: 'fire', tag: 'Flying' },
  titan:   { name: 'Siege Titan',   hp: 2400, dmg: 60, armor: 8, speed: 42, range: 40,  atkCd: 2.0, bounty: 90, xp: 260, radius: 34, lives: 4, boss: true, tag: 'Costs 4 lives' },
  // bosses (wave only)
  warlord:     { name: 'Gnoll Warlord',   hp: 850, dmg: 40, armor: 4, speed: 50, range: 36, atkCd: 1.5, bounty: 80,  xp: 220, radius: 28, lives: 5, boss: true },
  broodmother: { name: 'Broodmother',     hp: 1000, dmg: 34, armor: 3, speed: 50, range: 34, atkCd: 1.3, bounty: 90,  xp: 240, radius: 30, lives: 5, boss: true, onDeathSpawn: { type: 'spider', n: 8 } },
  abomination: { name: 'Abomination',     hp: 1500, dmg: 50, armor: 2, speed: 46, range: 38, atkCd: 1.7, bounty: 110, xp: 280, radius: 32, lives: 5, boss: true, regen: 0.01 },
  dragon:      { name: 'Elder Dragon',    hp: 1700, dmg: 55, armor: 6, speed: 44, range: 240, atkCd: 1.8, bounty: 140, xp: 320, radius: 36, lives: 5, boss: true, flying: true, ranged: true, proj: 'fire' },
};

// Wave composition. Every 5th wave is a boss wave.
const WAVES = [
  null,
  [{ t: 'gnoll', n: 10 }],
  [{ t: 'wolf', n: 12 }],
  [{ t: 'spider', n: 18 }],
  [{ t: 'gnoll', n: 5 }, { t: 'archer', n: 7 }],
  [{ t: 'warlord', n: 1 }, { t: 'gnoll', n: 6 }],
  [{ t: 'golem', n: 8 }],
  [{ t: 'harpy', n: 10 }],
  [{ t: 'ogre', n: 5 }, { t: 'shaman', n: 3 }],
  [{ t: 'wraith', n: 10 }],
  [{ t: 'broodmother', n: 1 }, { t: 'spider', n: 12 }],
  [{ t: 'wolf', n: 16 }],
  [{ t: 'golem', n: 6 }, { t: 'archer', n: 6 }],
  [{ t: 'drake', n: 4 }, { t: 'harpy', n: 6 }],
  [{ t: 'ogre', n: 8 }, { t: 'shaman', n: 3 }],
  [{ t: 'abomination', n: 1 }, { t: 'wraith', n: 6 }],
  [{ t: 'spider', n: 26 }],
  [{ t: 'golem', n: 10 }, { t: 'shaman', n: 3 }],
  [{ t: 'wraith', n: 8 }, { t: 'archer', n: 6 }],
  [{ t: 'drake', n: 8 }],
  [{ t: 'dragon', n: 1 }, { t: 'drake', n: 4 }],
  [{ t: 'ogre', n: 10 }, { t: 'shaman', n: 4 }],
  [{ t: 'wolf', n: 20 }, { t: 'harpy', n: 8 }],
  [{ t: 'golem', n: 12 }, { t: 'archer', n: 8 }],
  [{ t: 'wraith', n: 14 }, { t: 'shaman', n: 4 }],
  [{ t: 'titan', n: 2 }, { t: 'abomination', n: 1 }],
];

function waveDef(n) {
  if (n < WAVES.length) return WAVES[n];
  return WAVES[16 + ((n - 16) % 10)];
}
function waveMul(n) {
  const k = n - 1;
  const late = n > 20 ? Math.pow(1.15, n - 20) : 1; // endgame escalation
  return {
    hp: (1 + 0.22 * k + 0.012 * k * k) * late,
    dmg: (1 + 0.12 * k + 0.005 * k * k) * Math.sqrt(late),
    armor: Math.floor(k / 6),
    gold: 1 + 0.14 * k,
    xp: 1 + 0.14 * k,
  };
}

// ---------------------------------------------------------------------------
// Creeps a player can send into the opponent's lane (+ permanent income).
// ---------------------------------------------------------------------------
const SENDS = [
  { id: 'wolf',   creep: 'wolf',   count: 1, cost: 15,  income: 2,  unlock: 1,  stock: 8, restock: 2.5 },
  { id: 'gnoll',  creep: 'gnoll',  count: 1, cost: 25,  income: 3,  unlock: 1,  stock: 8, restock: 3 },
  { id: 'spider', creep: 'spider', count: 3, cost: 40,  income: 5,  unlock: 2,  stock: 6, restock: 4 },
  { id: 'archer', creep: 'archer', count: 1, cost: 55,  income: 7,  unlock: 3,  stock: 6, restock: 4 },
  { id: 'golem',  creep: 'golem',  count: 1, cost: 80,  income: 10, unlock: 5,  stock: 5, restock: 5 },
  { id: 'harpy',  creep: 'harpy',  count: 1, cost: 110, income: 13, unlock: 7,  stock: 5, restock: 5 },
  { id: 'shaman', creep: 'shaman', count: 1, cost: 150, income: 17, unlock: 9,  stock: 4, restock: 6 },
  { id: 'ogre',   creep: 'ogre',   count: 1, cost: 210, income: 23, unlock: 11, stock: 4, restock: 6 },
  { id: 'wraith', creep: 'wraith', count: 1, cost: 290, income: 31, unlock: 13, stock: 4, restock: 7 },
  { id: 'drake',  creep: 'drake',  count: 1, cost: 420, income: 44, unlock: 15, stock: 3, restock: 9 },
  { id: 'titan',  creep: 'titan',  count: 1, cost: 800, income: 80, unlock: 18, stock: 2, restock: 20 },
];
function sendMul(wave) {
  const k = Math.max(0, wave - 1);
  return { hp: 1 + 0.10 * k, dmg: 1 + 0.06 * k, armor: 0, gold: 1, xp: 1 };
}

// ---------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------
// Ability types: self | point | dir | passive
const HEROES = [
  {
    id: 'warden', name: 'Thorne', title: 'Iron Warden', primary: 'str', role: 'Tank / Crowd control',
    color: '#7fa6d8', accent: '#f2c14e',
    str: 24, strG: 3.0, agi: 13, agiG: 1.4, int: 14, intG: 1.5,
    baseDmg: 25, range: 70, bat: 1.6, ms: 270, armor: 4, melee: true,
    blurb: 'Heavily armored defender. Stuns packs, reflects damage and cleaves through crowds.',
    abilities: [
      { id: 'thunderslam', name: 'Thunder Slam', icon: '🔨', type: 'self', radius: 230,
        mana: [70, 80, 90, 100], cd: [8, 8, 7, 7],
        vals: { dmg: [85, 145, 215, 295], stun: [1, 1.25, 1.5, 1.75] },
        desc: 'Slams the ground, dealing {dmg} + 150% STR damage and stunning nearby enemies for {stun}s.' },
      { id: 'bulwark', name: 'Bulwark', icon: '🛡️', type: 'self', radius: 0,
        mana: [60, 60, 60, 60], cd: [18, 17, 16, 15],
        vals: { armor: [4, 7, 10, 13], reflect: [20, 30, 40, 50], regen: [5, 10, 15, 20] },
        desc: 'For 8s gain +{armor} armor, +{regen} HP regen and reflect {reflect}% of damage taken.' },
      { id: 'cleave', name: 'Great Cleave', icon: '🪓', type: 'passive',
        vals: { cleave: [30, 45, 60, 75] },
        desc: 'Attacks splash {cleave}% damage to enemies near the target.' },
      { id: 'earthsplitter', name: 'Earthsplitter', icon: '⛰️', type: 'dir', ult: true, range: 700, width: 150,
        mana: [150, 200, 250], cd: [60, 55, 50],
        vals: { dmg: [300, 520, 800], stun: [2, 2.25, 2.5] },
        desc: 'Splits the earth in a line. After a moment it erupts for {dmg} damage and {stun}s stun.' },
    ],
    skillOrder: [0, 2, 0, 1, 0, 2, 0, 2, 2, 1, 1, 1],
    build: ['hpot', 'gauntlets', 'claws', 'boots', 'gloves', 'greatsword', 'belt', 'cleaver', 'runeblade', 'crown', 'aegis'],
  },
  {
    id: 'shade', name: 'Vex', title: 'Shadow Dancer', primary: 'agi', role: 'Assassin / Burst',
    color: '#9b6bd6', accent: '#e0d0ff',
    str: 18, strG: 2.0, agi: 23, agiG: 2.5, int: 15, intG: 1.4,
    baseDmg: 18, range: 70, bat: 1.5, ms: 290, armor: 3, melee: true,
    blurb: 'Lightning-fast blade master. Blinks into packs, spins to win and crits hard.',
    abilities: [
      { id: 'shadowstep', name: 'Shadow Step', icon: '🌀', type: 'point', range: 520, radius: 200,
        mana: [60, 60, 60, 60], cd: [8, 7, 6, 5],
        vals: { dmg: [100, 170, 250, 340] },
        desc: 'Blink to a location, dealing {dmg} damage to enemies there.' },
      { id: 'bladefury', name: 'Blade Fury', icon: '🌪️', type: 'self', radius: 200,
        mana: [90, 100, 110, 120], cd: [16, 15, 14, 13],
        vals: { dps: [55, 80, 110, 145] },
        desc: 'Spin for 3s dealing {dps} damage per second around you and taking 50% less damage.' },
      { id: 'crit', name: 'Deadly Edge', icon: '🗡️', type: 'passive',
        vals: { mult: [1.7, 2.0, 2.3, 2.6] },
        desc: '25% chance to strike for {mult}x damage.' },
      { id: 'phantom', name: 'Phantom Assault', icon: '👤', type: 'self', ult: true, radius: 600,
        mana: [150, 175, 200], cd: [55, 50, 45],
        vals: { hits: [8, 11, 14], mult: [1.2, 1.5, 1.8] },
        desc: 'Become untouchable and strike {hits} times between nearby enemies for {mult}x attack damage (can crit).' },
    ],
    skillOrder: [2, 1, 2, 0, 2, 1, 2, 1, 1, 0, 0, 0],
    build: ['hpot', 'slippers', 'claws', 'gloves', 'boots', 'band', 'greatsword', 'cleaver', 'vampfang', 'runeblade', 'crown'],
  },
  {
    id: 'ranger', name: 'Lyra', title: 'Wind Ranger', primary: 'agi', role: 'Ranged carry',
    color: '#5cb85c', accent: '#d9f2b4',
    str: 16, strG: 1.8, agi: 23, agiG: 2.8, int: 17, intG: 1.6,
    baseDmg: 16, range: 520, bat: 1.6, ms: 280, armor: 0, melee: false, proj: 'arrow',
    blurb: 'Long range archer. Multishot shreds waves while traps and arrow storms control the lane.',
    abilities: [
      { id: 'piercing', name: 'Piercing Shot', icon: '🏹', type: 'dir', range: 950, width: 80,
        mana: [70, 75, 80, 85], cd: [7, 7, 6, 6],
        vals: { dmg: [100, 170, 250, 340] },
        desc: 'Fires an arrow that pierces every enemy in a line for {dmg} + 150% AGI damage.' },
      { id: 'multishot', name: 'Multishot', icon: '🎯', type: 'passive',
        vals: { extra: [1, 2, 2, 3] },
        desc: 'Attacks fire at {extra} extra target(s) for 60% damage.' },
      { id: 'frosttrap', name: 'Frost Trap', icon: '❄️', type: 'point', range: 620, radius: 240,
        mana: [80, 85, 90, 95], cd: [12, 11, 10, 9],
        vals: { dmg: [60, 100, 150, 200], slow: [40, 45, 50, 55] },
        desc: 'Explodes in a frost burst for {dmg} damage and slows by {slow}% for 4s.' },
      { id: 'arrowstorm', name: 'Arrow Storm', icon: '☄️', type: 'point', ult: true, range: 720, radius: 320,
        mana: [175, 225, 275], cd: [60, 55, 50],
        vals: { dmg: [45, 75, 110] },
        desc: 'Rains arrows for 6s, dealing {dmg} physical damage every 0.5s to enemies in the area.' },
    ],
    skillOrder: [1, 0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 2],
    build: ['hpot', 'slippers', 'claws', 'gloves', 'boots', 'band', 'greatsword', 'frostbrand', 'stormhammer', 'runeblade', 'crown'],
  },
  {
    id: 'pyro', name: 'Ignis', title: 'Pyromancer', primary: 'int', role: 'Burst caster',
    color: '#e0553a', accent: '#ffcf5c',
    str: 15, strG: 1.6, agi: 14, agiG: 1.2, int: 25, intG: 3.2,
    baseDmg: 17, range: 500, bat: 1.7, ms: 270, armor: 0, melee: false, proj: 'flame',
    blurb: 'Master of fire. Huge burst damage, lingering burns and devastating meteors.',
    abilities: [
      { id: 'fireball', name: 'Fireball', icon: '🔥', type: 'point', range: 650, radius: 160,
        mana: [75, 85, 95, 105], cd: [5, 5, 4.5, 4],
        vals: { dmg: [110, 190, 280, 380] },
        desc: 'Hurls a fireball that explodes for {dmg} damage in an area.' },
      { id: 'flamewave', name: 'Flame Wave', icon: '🌋', type: 'dir', range: 560, width: 170,
        mana: [100, 110, 120, 130], cd: [10, 10, 9, 9],
        vals: { dmg: [80, 140, 210, 290], burn: [15, 25, 35, 45] },
        desc: 'A wave of fire deals {dmg} damage and burns for {burn}/s over 3s.' },
      { id: 'kindling', name: 'Kindling', icon: '✨', type: 'passive',
        vals: { regen: [1, 2, 3, 4], burn: [8, 15, 22, 30] },
        desc: '+{regen} mana regen. Attacks ignite enemies for {burn} damage/s over 3s.' },
      { id: 'meteor', name: 'Meteor Rain', icon: '🌠', type: 'point', ult: true, range: 720, radius: 300,
        mana: [200, 250, 300], cd: [70, 65, 60],
        vals: { dmg: [220, 360, 520] },
        desc: 'Calls 4 meteors, each dealing {dmg} damage and stunning 1.2s.' },
    ],
    skillOrder: [0, 2, 0, 1, 0, 1, 0, 1, 1, 2, 2, 2],
    build: ['mpot', 'mantle', 'sagemask', 'boots', 'ringregen', 'staff', 'circlet', 'arcaneorb', 'crown', 'aegis', 'runeblade'],
  },
  {
    id: 'oracle', name: 'Seraphine', title: 'Frost Oracle', primary: 'int', role: 'Control caster',
    color: '#6fd3f2', accent: '#ffffff',
    str: 16, strG: 1.7, agi: 15, agiG: 1.4, int: 24, intG: 3.0,
    baseDmg: 16, range: 520, bat: 1.7, ms: 270, armor: 1, melee: false, proj: 'ice',
    blurb: 'Freezes the battlefield. Endless mana, blizzards and a massive area freeze.',
    abilities: [
      { id: 'frostnova', name: 'Frost Nova', icon: '💠', type: 'point', range: 600, radius: 210,
        mana: [80, 90, 100, 110], cd: [7, 7, 6, 6],
        vals: { dmg: [80, 140, 210, 290], slow: [40, 45, 50, 55] },
        desc: 'Blast of cold dealing {dmg} damage and slowing {slow}% for 3s.' },
      { id: 'blizzard', name: 'Blizzard', icon: '🌨️', type: 'point', range: 650, radius: 270,
        mana: [120, 140, 160, 180], cd: [15, 14, 13, 12],
        vals: { dmg: [40, 65, 95, 130] },
        desc: '6 waves of ice shards, each dealing {dmg} damage and slowing enemies.' },
      { id: 'brilliance', name: 'Brilliance', icon: '🔮', type: 'passive',
        vals: { regen: [1.5, 3, 4.5, 6], amp: [5, 10, 15, 20] },
        desc: '+{regen} mana regen and +{amp}% spell damage.' },
      { id: 'glacial', name: 'Glacial Tomb', icon: '🧊', type: 'self', ult: true, radius: 520,
        mana: [200, 250, 300], cd: [70, 65, 60],
        vals: { dmg: [220, 380, 560], stun: [2.5, 3, 3.5] },
        desc: 'Freezes all enemies around you for {stun}s, dealing {dmg} damage.' },
    ],
    skillOrder: [0, 1, 0, 2, 1, 0, 1, 0, 1, 2, 2, 2],
    build: ['mpot', 'mantle', 'sagemask', 'boots', 'ringprot', 'staff', 'circlet', 'arcaneorb', 'crown', 'aegis', 'runeblade'],
  },
  {
    id: 'berserker', name: 'Grokk', title: 'Blood Berserker', primary: 'str', role: 'Bruiser / Sustain',
    color: '#c0392b', accent: '#f0b27a',
    str: 25, strG: 2.8, agi: 18, agiG: 2.0, int: 12, intG: 1.2,
    baseDmg: 21, range: 70, bat: 1.6, ms: 280, armor: 3, melee: true,
    blurb: 'Unstoppable brute who heals by dealing damage and grows stronger as he rages.',
    abilities: [
      { id: 'bloodwhirl', name: 'Blood Whirl', icon: '🩸', type: 'self', radius: 230,
        mana: [60, 70, 80, 90], cd: [6, 6, 5, 5],
        vals: { dmg: [90, 150, 220, 300] },
        desc: 'Spins his axes dealing {dmg} + 150% STR damage around him, healing for 35% of damage dealt.' },
      { id: 'frenzy', name: 'Frenzy', icon: '💢', type: 'self', radius: 0,
        mana: [60, 60, 60, 60], cd: [18, 17, 16, 15],
        vals: { ias: [40, 60, 80, 100] },
        desc: 'For 10s gain +{ias}% attack speed and +15% move speed.' },
      { id: 'vampirism', name: 'Vampirism', icon: '🦇', type: 'passive',
        vals: { ls: [10, 15, 20, 25], cleave: [15, 20, 25, 30] },
        desc: 'Attacks heal for {ls}% of damage dealt and splash {cleave}% to nearby enemies.' },
      { id: 'rampage', name: 'Rampage', icon: '👹', type: 'self', ult: true, radius: 0,
        mana: [150, 150, 150], cd: [70, 65, 60],
        vals: { dmg: [40, 70, 110], armor: [5, 8, 11] },
        desc: 'Grows huge for 12s: +{dmg} damage, +{armor} armor and attacks cleave 50%.' },
    ],
    skillOrder: [0, 2, 0, 1, 0, 2, 0, 2, 2, 1, 1, 1],
    build: ['hpot', 'gauntlets', 'claws', 'gloves', 'boots', 'belt', 'greatsword', 'cleaver', 'vampfang', 'aegis', 'crown'],
  },
];
const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));

// ---------------------------------------------------------------------------
// Items. tier unlocks: 1 = start, 2 = wave 5, 3 = wave 10
// ---------------------------------------------------------------------------
const TIER_UNLOCK = { 0: 0, 1: 0, 2: 5, 3: 10 };
const ITEMS = [
  // consumables / tomes (tier 0)
  { id: 'hpot', name: 'Healing Potion', icon: '🧪', tier: 0, cost: 50, consumable: 'hp', desc: 'Restores 40% HP over 3s. Stacks.' },
  { id: 'mpot', name: 'Mana Potion', icon: '💧', tier: 0, cost: 50, consumable: 'mp', desc: 'Restores 50% mana over 3s. Stacks.' },
  { id: 'tstr', name: 'Tome of Strength', icon: '📕', tier: 0, cost: 150, tome: { str: 2 }, desc: 'Permanently +2 Strength.' },
  { id: 'tagi', name: 'Tome of Agility', icon: '📗', tier: 0, cost: 150, tome: { agi: 2 }, desc: 'Permanently +2 Agility.' },
  { id: 'tint', name: 'Tome of Intellect', icon: '📘', tier: 0, cost: 150, tome: { int: 2 }, desc: 'Permanently +2 Intelligence.' },
  { id: 'txp', name: 'Tome of Knowledge', icon: '📜', tier: 0, cost: 250, tome: { xp: 300 }, desc: 'Grants 300 experience.' },
  // tier 1
  { id: 'claws', name: 'Iron Claws', icon: '🦾', tier: 1, cost: 180, stats: { dmg: 10 }, desc: '+10 damage' },
  { id: 'ringprot', name: 'Ring of Guarding', icon: '💍', tier: 1, cost: 160, stats: { armor: 3 }, desc: '+3 armor' },
  { id: 'gauntlets', name: 'Giant Gauntlets', icon: '🧤', tier: 1, cost: 220, stats: { str: 6 }, desc: '+6 Strength' },
  { id: 'slippers', name: 'Swift Slippers', icon: '🥿', tier: 1, cost: 220, stats: { agi: 6 }, desc: '+6 Agility' },
  { id: 'mantle', name: 'Mantle of Wisdom', icon: '🧣', tier: 1, cost: 220, stats: { int: 6 }, desc: '+6 Intelligence' },
  { id: 'boots', name: 'Boots of Haste', icon: '👢', tier: 1, cost: 200, stats: { ms: 55 }, desc: '+55 move speed' },
  { id: 'gloves', name: 'Quickdraw Gloves', icon: '🥊', tier: 1, cost: 260, stats: { ias: 0.18 }, desc: '+18% attack speed' },
  { id: 'ringregen', name: 'Troll Ring', icon: '⭕', tier: 1, cost: 200, stats: { hpRegen: 4 }, desc: '+4 HP regen' },
  { id: 'sagemask', name: 'Sage Mask', icon: '🎭', tier: 1, cost: 200, stats: { manaRegen: 2 }, desc: '+2 mana regen' },
  // tier 2
  { id: 'greatsword', name: 'Greatsword', icon: '⚔️', tier: 2, cost: 650, stats: { dmg: 30 }, desc: '+30 damage' },
  { id: 'plate', name: 'Knight Plate', icon: '🥋', tier: 2, cost: 600, stats: { armor: 8 }, desc: '+8 armor' },
  { id: 'belt', name: 'Belt of the Giant', icon: '🎗️', tier: 2, cost: 600, stats: { str: 15 }, desc: '+15 Strength' },
  { id: 'band', name: 'Band of the Wind', icon: '🪶', tier: 2, cost: 600, stats: { agi: 15 }, desc: '+15 Agility' },
  { id: 'staff', name: 'Staff of Insight', icon: '🪄', tier: 2, cost: 600, stats: { int: 15 }, desc: '+15 Intelligence' },
  { id: 'circlet', name: 'Royal Circlet', icon: '👑', tier: 2, cost: 750, stats: { str: 8, agi: 8, int: 8 }, desc: '+8 all stats' },
  // tier 3
  { id: 'crown', name: 'Crown of Ages', icon: '🔱', tier: 3, cost: 1600, stats: { str: 18, agi: 18, int: 18 }, desc: '+18 all stats' },
  { id: 'runeblade', name: 'Runeblade', icon: '🗡️', tier: 3, cost: 1500, stats: { dmg: 65 }, desc: '+65 damage' },
  { id: 'vampfang', name: 'Vampiric Fang', icon: '🦷', tier: 3, cost: 1300, stats: { dmg: 25, lifesteal: 0.15 }, desc: '+25 damage, 15% lifesteal' },
  { id: 'frostbrand', name: 'Frostbrand', icon: '🥶', tier: 3, cost: 1400, stats: { dmg: 30, slowOnHit: 0.3 }, desc: '+30 damage, attacks slow 30%' },
  { id: 'stormhammer', name: 'Storm Hammer', icon: '⚡', tier: 3, cost: 1600, stats: { dmg: 25, chain: 0.25 }, desc: '+25 damage, 25% chance on hit: chain lightning (220 dmg, 4 targets)' },
  { id: 'arcaneorb', name: 'Arcane Orb', icon: '🌐', tier: 3, cost: 1700, stats: { int: 20, spellAmp: 0.25, manaRegen: 3 }, desc: '+20 Int, +25% spell damage, +3 mana regen' },
  { id: 'cleaver', name: 'Butcher\'s Cleaver', icon: '🔪', tier: 3, cost: 1500, stats: { dmg: 35, cleave: 0.35 }, desc: '+35 damage, attacks cleave 35%' },
  { id: 'aegis', name: 'Aegis of Valor', icon: '🔰', tier: 3, cost: 1700, stats: { armor: 12, hp: 500, hpRegen: 8 }, desc: '+12 armor, +500 HP, +8 HP regen' },
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
