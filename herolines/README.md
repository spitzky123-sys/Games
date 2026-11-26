# Lanebreakers — hero line wars for mobile

A mobile-first take on the classic "hero line wars" custom-game genre. You and an AI opponent each defend your own lane with a hero. You earn gold by killing creeps, and you raise your income by sending creeps into the enemy lane. Each creep that reaches a gate costs that player a life. The first player to run out of lives loses.

Plain HTML5 Canvas + JavaScript. No build step and no dependencies. All art and sound are generated in code.

## Play

Serve the folder over HTTP and open it on your phone:

```bash
cd herolines
python3 -m http.server 8000
# then open http://<your-computer-ip>:8000 on your phone (same Wi-Fi)
```

To play anywhere, host the `herolines/` folder on any static host, for example GitHub Pages. In your phone browser, use "Add to Home Screen" and the game installs as a full-screen, offline-capable app (PWA). Landscape orientation works best.

### Controls
| Touch | Keyboard |
|---|---|
| Drag on the left half of the screen to use the virtual joystick | WASD / arrows |
| Tap the ground to move, tap a creep to focus it | Click |
| Tap an ability to auto-aim it at the best target | Q W E R (aims at the cursor) |
| Press and drag an ability to aim it by hand; drag onto ✖ to cancel | |
| Gold **+** on an ability: learn or upgrade it | Shift+Q/W/E/R |
| Send bar (bottom): tap to send, long-press for creep info | |
| 🛒 Shop (pauses the game) · 👁 view the enemy lane · pinch to zoom | B · Tab · mouse wheel |

## Game systems
- **Waves:** a creep wave arrives every 36s in both lanes. Every 5th wave is a boss. After wave 20 the waves escalate sharply so that games end (usually 15–25 minutes).
- **Economy:** gold comes from kills and from income paid every 15s. Each send costs gold, permanently adds income and uses one stock charge; charges refill over time. Higher send tiers unlock as waves progress.
- **Heroes:** 6 heroes, 2 per attribute. Each has 3 basic abilities (max level 4) and an ultimate (unlocks at hero levels 6/11/16).
  - **Strength** → HP and HP regen. **Agility** → armor and attack speed. **Intelligence** → mana, mana regen, spell damage and cooldown reduction. Your primary attribute also adds attack damage.
  - Melee heroes deal +20% attack damage and take 15% less damage from creeps, to make up for having to stand in the fight.

| Hero | Attr | Style |
|---|---|---|
| Thorne, Iron Warden | STR | Melee tank: AoE stun, armor/reflect buff, cleave, line-stun ultimate |
| Grokk, Blood Berserker | STR | Melee sustain: healing whirl, attack-speed frenzy, lifesteal + splash, Rampage |
| Vex, Shadow Dancer | AGI | Melee assassin: blink strike, spinning Blade Fury, crits, Phantom Assault |
| Lyra, Wind Ranger | AGI | Ranged carry: piercing shot, multishot, frost trap, Arrow Storm |
| Ignis, Pyromancer | INT | Burst caster: fireball, flame wave with burn, burning attacks, Meteor Rain |
| Seraphine, Frost Oracle | INT | Control caster: frost nova, blizzard, mana/spell-amp aura, Glacial Tomb |

- **Creeps** have different traits: armored golems resist attacks, wraiths resist spells, shamans heal, harpies and drakes fly straight to the gate, archers shoot from range, and bosses cost 4–5 lives.
- **Items:** 30 items in 3 tiers (tiers 2 and 3 unlock at waves 5 and 10), plus potions and permanent stat tomes. Items sell back for half price.
- **AI opponent:** Easy, Normal or Hard. The AI defends with its own hero, levels skills, follows a build order and splits its gold between sends and items.

## Balance testing
The game simulation has no DOM dependency, so whole matches can run headless. `tools/sim.js` plays every hero against every other hero, AI vs AI:

```bash
node tools/sim.js 3        # 3 games per matchup → win rates, deaths, end level
```

Use it to check hero parity after changing numbers in `js/data.js`.

## Code layout
```
js/data.js       heroes, abilities, creeps, waves, sends, items (all tuning numbers)
js/game.js       simulation: units, combat, lanes, economy
js/abilities.js  ability implementations + smart auto-targeting
js/ai.js         AI opponent
js/art.js        procedural terrain, creature sprites, hero drawing
js/render.js     camera, particles, spell effects, HUD-in-world
js/audio.js      Web Audio synthesized sound effects
js/ui.js         menus, HUD, touch controls, shop
js/main.js       boot + fixed-timestep loop
```
