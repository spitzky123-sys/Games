'use strict';
// ============================================================================
//  Alternative hero art: angled (3/4, camera above and in front) painted
//  characters. Same procedural materials as the top-down heroes, but you see
//  faces, armour fronts and full outfits. Motion is whole-body and
//  spring-driven: bob, lean, squash & stretch, smooth turn-around, weapon
//  swings with follow-through. Design space: feet at (0,0), up = -y,
//  facing +x, ~64 units tall.
// ============================================================================
const HeroAngled = (() => {
  const TAU = Math.PI * 2;
  const K = HeroArt.kit;
  const { MAT, P, E, S, Q, C, part, drawPart, glowAt, line, trim } = K;

  // ---------------------------------------------------------------- face
  function face(x, cx, cy, r, skin, o = {}) {
    E(x, cx - r * 0.62, cy + r * 0.12, r * 0.2, r * 0.28, skin, { ao: 0.6 });                 // ear
    E(x, cx, cy, r * 0.92, r, skin, { ao: 1.6 });                                              // head
    if (o.noFace) return;
    x.fillStyle = 'rgba(230,110,100,0.18)';
    x.beginPath(); x.ellipse(cx + r * 0.32, cy + r * 0.38, r * 0.2, r * 0.13, 0, 0, TAU); x.fill();
    const eye = (ex, sc) => {
      if (o.glow) { glowAt(x, ex, cy + r * 0.05, r * 0.35 * sc, o.glow); return; }
      x.fillStyle = '#1c120c';
      x.beginPath(); x.ellipse(ex, cy + r * 0.06, r * 0.1 * sc, r * 0.15 * sc, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.9)';
      x.beginPath(); x.arc(ex + r * 0.03, cy - r * 0.01, r * 0.04 * sc, 0, TAU); x.fill();
    };
    eye(cx + r * 0.12, 1); eye(cx + r * 0.6, 0.8);
    if (!o.noBrows) {
      x.strokeStyle = o.brow || 'rgba(70,40,20,0.85)'; x.lineWidth = r * 0.08; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - r * 0.02, cy - r * 0.2); x.lineTo(cx + r * 0.24, cy - r * 0.24); x.stroke();
      x.beginPath(); x.moveTo(cx + r * 0.5, cy - r * 0.22); x.lineTo(cx + r * 0.7, cy - r * 0.18); x.stroke();
    }
    x.strokeStyle = 'rgba(120,60,40,0.35)'; x.lineWidth = r * 0.06;
    x.beginPath(); x.moveTo(cx + r * 0.52, cy + r * 0.15); x.lineTo(cx + r * 0.6, cy + r * 0.32); x.stroke();
    if (!o.noMouth) {
      x.strokeStyle = 'rgba(110,40,30,0.75)'; x.lineWidth = r * 0.07;
      x.beginPath(); x.moveTo(cx + r * 0.3, cy + r * 0.56); x.quadraticCurveTo(cx + r * 0.42, cy + r * 0.62, cx + r * 0.54, cy + r * 0.55); x.stroke();
    }
  }
  function leg(m, boot) { // hip pivot at (0,0), foot at ~(1, 13)
    return part(-5, -2, 8, 16, x => {
      C(x, 0, 0, 0.5, 10, 3.6, 3.1, m);
      S(x, [[-3.4, 8.5], [3.5, 8.5], [6.8, 11.5], [6.5, 14.6], [-3.6, 14.6]], boot);
    });
  }

  // ---------------------------------------------------------------- builds
  // part pivots: cape at neck, armF at front shoulder, armB at back shoulder, legs at hips.
  const BUILD = {
    warden() {
      const cape = part(-20, -2, 6, 34, x => S(x, [[-4, 0], [4, 0], [3, 18], [-2, 33], [-16, 31], [-19, 14], [-12, 2]], MAT.blueCloth, { folds: [[-6, 6, -9, 18, -10, 30], [-1, 6, -3, 18, -5, 30]] }));
      const body = part(-15, -58, 16, -12, x => {
        S(x, [[-11, -34], [11, -34], [13, -24], [10, -14], [-10, -14], [-13, -24]], MAT.steel, { dir: 1.4 });
        Q(x, [[-4, -29], [8, -29], [7, -12], [-3, -12]], MAT.blueCloth, { folds: [[1, -27, 2, -20, 1, -13]] });
        trim(x, P.poly([[-4, -29], [8, -29], [7, -12], [-3, -12]]), '#e2b33c', 0.7);
        x.strokeStyle = '#e2b33c'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(-3.5, -21); x.lineTo(7.5, -21); x.moveTo(2, -27); x.lineTo(2, -15); x.stroke();
        C(x, -11, -15, 11, -15, 1.7, 1.7, MAT.leather, { ao: 0.5 });
        E(x, 2, -15, 1.6, 1.4, MAT.gold, { ao: 0.3 });
        E(x, -10, -32, 6.5, 5.2, MAT.steel, { seed: 3 });                                           // far pauldron
        face(x, 1, -44, 10, MAT.skin, { noFace: true });
        S(x, [[-9, -50], [-3, -55.5], [6, -55], [11, -49], [11.5, -38], [7, -34], [-6, -34], [-10, -40]], MAT.steel, { seed: 9, dir: 1.3 }); // great helm
        x.strokeStyle = '#141018'; x.lineWidth = 1.3; x.lineCap = 'round';
        x.beginPath(); x.moveTo(0.5, -44.5); x.lineTo(11, -44.5); x.stroke();
        x.lineWidth = 0.8; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(4 + i * 2.5, -42); x.lineTo(4 + i * 2.5, -38.5); x.stroke(); }
        line(x, 1, -55, 1.5, -34.5, '#e2b33c', 1.2);
        S(x, [[0, -55], [-4, -61], [-12, -62], [-18, -57], [-14, -55], [-6, -53.5]], MAT.blueHair, { dir: Math.PI * 0.9 }); // plume
      });
      const armF = part(-7, -7, 8, 40, x => {                                                    // pauldron + gauntlet + hammer
        C(x, 0, 6, 0.5, 15, 3.6, 3.2, MAT.steel);
        C(x, 0.5, 14, 0.5, 33, 1.3, 1.3, MAT.wood, { dir: Math.PI / 2 });
        Q(x, [[-6, 29], [7, 29], [7, 38], [-6, 38]], MAT.darksteel);
        Q(x, [[-6, 32], [7, 32], [7, 35], [-6, 35]], MAT.gold, { ao: 0.4 });
        E(x, 0.5, 16, 3.4, 3.2, MAT.steel);
        E(x, 0, 0, 7, 6, MAT.steel, { seed: 5 });
      });
      const armB = part(-14, -4, 16, 28, x => {                                                  // kite shield on the far arm
        const sh = [[-10, 2], [11, 2], [12, 11], [1, 26], [-11, 11]];
        S(x, sh, MAT.steel, { seed: 22 });
        S(x, sh.map(p => [p[0] * 0.84 + 0.2, p[1] * 0.88 + 1.8]), MAT.blueCloth);
        line(x, 0.5, 5, 0.5, 22, '#e2b33c', 2); line(x, -7, 10, 8, 10, '#e2b33c', 2);
        E(x, 0.5, 10, 1.8, 1.8, MAT.gold, { ao: 0.4 });
      });
      return { cape, body, armF, armB, legF: leg(MAT.steel, MAT.darksteel), legB: leg(MAT.darksteel, MAT.darksteel),
        neck: [-1, -35], shF: [6, -32], shB: [-6, -26], style: 'smash', shield: true, height: 62 };
    },

    shade() {
      const cape = part(-30, -4, 4, 16, x => {
        S(x, [[-2, 0], [-12, 1], [-24, 4], [-30, 10], [-22, 8], [-12, 6], [-1, 4]], MAT.purpleCloth, { dir: Math.PI });
        S(x, [[-2, 4], [-10, 7], [-18, 12], [-24, 16], [-18, 13], [-10, 11], [-1, 8]], MAT.purpleCloth, { dir: Math.PI, seed: 7 });
      });
      const body = part(-14, -56, 14, -12, x => {
        S(x, [[-9, -33], [9, -33], [10, -24], [8, -13], [-8, -13], [-10, -24]], MAT.darkLeather, { dir: 1.4 });
        for (let i = 0; i < 4; i++) line(x, -8, -30 + i * 4.5, 8.5, -32 + i * 4.5, 'rgba(12,6,22,0.55)', 0.7);
        C(x, -9, -14, 9, -14, 1.5, 1.5, MAT.purpleCloth, { ao: 0.4 });
        face(x, 1.5, -43, 9.5, MAT.paleSkin, { glow: 'rgba(200,150,255,0.95)', noBrows: true, noMouth: true });
        S(x, [[-10, -40], [-8, -51], [0, -55], [9, -52], [12, -44], [9.5, -46], [3, -50], [-3, -47], [-4, -38], [-2, -32], [-9, -33]], MAT.purpleCloth, { dir: -Math.PI / 2, folds: [[-6, -48, -7, -42, -6, -35]] }); // hood
        S(x, [[0, -42], [11, -42], [11, -36], [6, -33], [0, -34]], MAT.darkCloth);                  // mask
      });
      const dagger = flip => part(-6, -4, 22, 22, x => {
        C(x, 0, 4, 0.5, 14, 3, 2.7, MAT.darkLeather);
        E(x, 0.5, 15.5, 2.6, 2.6, MAT.darkLeather);
        glowAt(x, 9, 15, 7, 'rgba(190,140,255,0.45)');
        S(x, [[2, 14], [10, 12.5], [19, 14.5], [10, 16.5], [2, 16.5]], MAT.silver, { ao: 0.4 });
        line(x, 1.5, 12.5, 1.5, 18.5, '#8a7a9a', 1);
      });
      return { cape, body, armF: dagger(1), armB: dagger(-1), legF: leg(MAT.darkLeather, MAT.darkCloth), legB: leg(MAT.darkCloth, MAT.darkCloth),
        neck: [-1, -34], shF: [6, -30], shB: [-6, -30], style: 'slash', height: 58 };
    },

    ranger() {
      const cape = part(-18, -2, 6, 30, x => S(x, [[-4, 0], [4, 0], [2, 16], [-2, 29], [-14, 27], [-17, 12], [-11, 2]], MAT.greenCloth, { folds: [[-6, 6, -8, 16, -9, 26]] }));
      const body = part(-18, -58, 14, -12, x => {
        C(x, -12, -40, -6, -18, 3, 3, MAT.leather);                                               // quiver
        for (let i = 0; i < 3; i++) { line(x, -13 + i * 1.4, -40, -14 + i * 1.6, -45, '#d8c49a', 0.8); E(x, -14 + i * 1.6, -46, 1.2, 1.8, MAT.whiteCloth, { ao: 0.3 }); }
        S(x, [[-9, -33], [9, -33], [10, -24], [9, -10], [-9, -10], [-10, -24]], MAT.greenCloth, { dir: 1.4, folds: [[0, -30, 1, -22, 0, -12]] });
        line(x, -8, -32, 8, -16, '#5a3a1c', 1.6);
        C(x, -9.5, -16, 9.5, -16, 1.7, 1.7, MAT.leather, { ao: 0.5 });
        E(x, 2, -16, 1.5, 1.4, MAT.gold, { ao: 0.3 });
        S(x, [[-10, -35], [-4, -37], [6, -36], [10, -33], [0, -31]], MAT.greenCloth, { seed: 4 });  // hood resting on shoulders
        S(x, [[-6, -46], [-10, -40], [-11, -30], [-8, -26], [-6, -32]], MAT.auburn, { dir: Math.PI / 2 }); // braid
        face(x, 1.5, -44, 9.5, MAT.skin);
        S(x, [[-9, -44], [-8, -51], [0, -55], [8, -52], [11, -46], [7, -48.5], [1, -48], [-4, -46], [-7, -38]], MAT.auburn, { dir: Math.PI * 0.85 });
      });
      const armF = part(-5, -4, 6, 20, x => { C(x, 0, 2, 0.5, 13, 3.2, 2.8, MAT.greenCloth); E(x, 0.5, 14.5, 2.4, 2.4, MAT.skin); });
      const armB = part(-26, -4, 26, 22, x => {
        C(x, 0, 2, 0, 13, 3, 2.7, MAT.greenCloth);
        S(x, [[-24, 14], [-12, 12], [0, 11.5], [12, 12], [24, 14], [24, 15.6], [12, 14.2], [0, 14], [-12, 14.2], [-24, 15.6]], MAT.wood, { dir: 0 });
        Q(x, [[-2, 11], [2, 11], [2, 17], [-2, 17]], MAT.leather, { ao: 0.5 });
        E(x, 0, 14.5, 2.4, 2.4, MAT.skin);
      });
      return { cape, body, armF, armB, legF: leg(MAT.leather, MAT.leather), legB: leg(MAT.leather, MAT.leather),
        neck: [-1, -34], shF: [6, -30], shB: [-5, -30], style: 'bow', bow: true, bowTips: [[-24, 14.8], [24, 14.8]], height: 58 };
    },

    pyro() { return robed(true); },
    oracle() { return robed(false); },

    berserker() {
      const body = part(-16, -58, 17, -6, x => {
        S(x, [[-13, -36], [13, -36], [14, -26], [10, -15], [-10, -15], [-14, -26]], MAT.tanSkin, { dir: 1.4 });
        x.strokeStyle = 'rgba(110,55,25,0.45)'; x.lineWidth = 0.8; x.lineCap = 'round';
        x.beginPath(); x.moveTo(-2, -30); x.quadraticCurveTo(4, -27, 11, -30); x.stroke();
        for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(1, -24 + i * 3.4); x.lineTo(8, -24.5 + i * 3.4); x.stroke(); }
        line(x, -9, -33, 9, -18, 'rgba(170,20,20,0.85)', 1.8); line(x, 2, -34, 12, -25, 'rgba(170,20,20,0.85)', 1.3);
        const kilt = [[-12, -17], [12, -17], [13, -9], [9, -5], [4, -8], [0, -4], [-4, -8], [-9, -5], [-13, -9]];
        S(x, kilt, MAT.fur, { dir: Math.PI / 2 });
        C(x, -12, -17, 12, -17, 1.8, 1.8, MAT.leather, { ao: 0.5 });
        E(x, 2, -17, 2, 1.8, MAT.steel, { ao: 0.3 });
        S(x, [[-15, -34], [-10, -40], [0, -41], [9, -39], [14, -35], [8, -32], [-2, -33], [-10, -31]], MAT.fur, { dir: Math.PI }); // fur mantle
        E(x, -12, -31, 6, 5.5, MAT.tanSkin, { seed: 4 });                                             // far shoulder
        face(x, 2, -45, 9.2, MAT.tanSkin, { brow: 'rgba(30,12,4,0.95)' });
        S(x, [[-1, -40], [8, -40], [11, -34], [7, -30], [2, -32]], MAT.brownHair, { dir: Math.PI / 2 }); // beard
        S(x, [[-6, -52], [-3, -57], [3, -58], [8, -55], [5, -52.5], [0, -53]], MAT.blackHair, { dir: -Math.PI / 2 }); // mohawk
        line(x, 2.5, -46, 4, -41, 'rgba(170,20,20,0.85)', 1); line(x, 8, -46, 9, -41.5, 'rgba(170,20,20,0.85)', 0.9);
      });
      const axeArm = () => part(-10, -6, 12, 38, x => {
        E(x, 0, 0, 6.5, 6, MAT.tanSkin);
        C(x, 0, 3, 0.5, 15, 4.4, 3.7, MAT.tanSkin);
        C(x, 0.3, 9, 0.5, 14, 4, 3.8, MAT.leather, { ao: 0.5 });
        C(x, 0.5, 14, 0.5, 31, 1.3, 1.3, MAT.wood, { dir: Math.PI / 2 });
        Q(x, [[0, 22], [9, 16.5], [12.5, 22], [13, 28.5], [10, 36], [0, 30]], MAT.steel);
        S(x, [[0, 25], [-4, 27], [-3, 29], [0, 29]], MAT.darksteel, { ao: 0.4 });
        E(x, 0.5, 16, 3.4, 3.4, MAT.tanSkin);
      });
      return { body, armF: axeArm(), armB: axeArm(), legF: leg(MAT.leather, MAT.fur), legB: leg(MAT.leather, MAT.fur),
        neck: [-1, -36], shF: [8, -32], shB: [-8, -32], style: 'axes', height: 60 };
    },
  };

  function robed(fire) {
    const robe = fire ? MAT.redCloth : MAT.whiteCloth, trimCol = fire ? '#f2c14e' : '#5fc8ef';
    const cape = fire ? null : part(-16, -6, 6, 30, x => S(x, [[-4, -2], [4, -2], [3, 12], [-1, 28], [-12, 26], [-15, 10], [-10, 0]], MAT.silverHair, { dir: Math.PI / 2 }));
    const body = part(-16, -58, 16, 2, x => {
      const gown = [[-9, -33], [9, -33], [11, -22], [14, -6], [16, 0], [6, 1], [-4, 1], [-15, 0], [-13, -8], [-11, -22]];
      S(x, gown, robe, { dir: Math.PI / 2, folds: [[-4, -20, -6, -10, -8, -1], [3, -20, 4, -10, 6, -1], [8, -18, 11, -8, 13, -1]] });
      trim(x, P.poly([[-15, -0.5], [16, -0.5]]), trimCol, 1.6);
      line(x, 2, -32, 4, 0, trimCol, 1.2);
      C(x, -10, -20, 11, -20, 1.6, 1.6, fire ? MAT.leather : MAT.iceMetal, { ao: 0.4 });
      if (fire) {
        face(x, 1.5, -43, 9.5, MAT.tanSkin, { glow: 'rgba(255,170,60,0.95)', noBrows: true });
        S(x, [[-11, -38], [-9, -51], [0, -56], [10, -52], [13, -43], [11, -35], [9, -45], [3, -49.5], [-3, -47], [-5, -37], [-3, -31], [-10, -32]], MAT.redCloth, { dir: -Math.PI / 2, folds: [[-6, -48, -7, -41, -6, -34]] });
        trim(x, x2 => { x2.beginPath(); x2.moveTo(11, -35); x2.quadraticCurveTo(9, -46, 3, -49.5); x2.quadraticCurveTo(-4, -47, -5, -37); }, trimCol, 1);
      } else {
        face(x, 1.5, -44, 9.3, MAT.paleSkin, { brow: 'rgba(160,170,190,0.9)' });
        S(x, [[-10, -44], [-8, -52], [0, -55.5], [8, -52.5], [11, -46], [7, -49], [0, -49], [-5, -46], [-8, -34], [-11, -36]], MAT.silverHair, { dir: Math.PI * 0.7 });
        x.strokeStyle = '#d8e6f0'; x.lineWidth = 1; x.beginPath(); x.ellipse(1.5, -48, 9.5, 3, -0.05, 0.1, Math.PI - 0.1); x.stroke();
        E(x, 9.5, -47.5, 1.4, 1.6, MAT.iceGem, { ao: 0.3 });
        glowAt(x, 9.5, -47.5, 3, 'rgba(140,225,255,0.7)');
      }
    });
    const armF = part(-6, -42, 8, 34, x => {
      C(x, 0, 2, 0.5, 12, 3.2, 4.2, robe);
      trim(x, P.ell(0.5, 12.5, 4.2, 1.2), trimCol, 0.8);
      C(x, 0.5, -32, 0.5, 30, 1.2, 1.4, fire ? MAT.wood : MAT.silver, { dir: Math.PI / 2 });
      for (const y of [-25, 22]) E(x, 0.5, y, 1.8, 1.4, fire ? MAT.gold : MAT.iceGem, { ao: 0.3 });
      if (fire) { for (const s of [-1, 1]) line(x, 0.5, -32, 0.5 + s * 3, -36, '#3a200c', 0.9); }
      else S(x, [[0.5, -39], [3.5, -34], [0.5, -30], [-2.5, -34]], MAT.iceGem, { ao: 0.4 });
      E(x, 0.5, 14, 2.4, 2.4, fire ? MAT.tanSkin : MAT.paleSkin);
    });
    const armB = part(-6, -4, 6, 18, x => {
      C(x, 0, 2, 0, 12, 3.2, 4.2, robe);
      trim(x, P.ell(0, 12.5, 4.2, 1.2), trimCol, 0.8);
      E(x, 0, 14, 2.4, 2.4, fire ? MAT.tanSkin : MAT.paleSkin);
    });
    return { cape, body, armF, armB, legF: null, legB: null, neck: [-1, -34], shF: [6, -30], shB: [-6, -30],
      style: 'staff', fire, robe: true, staffTip: [0.5, -35], height: 60, feet: fire ? MAT.leather : MAT.whiteCloth,
      foot: part(-4, -2, 5, 3, x => S(x, [[-3.4, -1.5], [3, -1.5], [4.6, 0.8], [3, 2.6], [-3.4, 2.2]], fire ? MAT.leather : MAT.silver)) };
  }

  const cache = {};
  function get(id) {
    if (!cache[id]) { K.tiles(); cache[id] = BUILD[id](); }
    return cache[id];
  }

  // ---------------------------------------------------------------- animation
  const ease = K.ease;
  function animate(h, t, B) {
    const st = h._ang || (h._ang = { last: t, ph: 0, flip: Math.cos(h.facing) < 0 ? -1 : 1 });
    const dt = Math.min(0.05, Math.max(0, t - st.last)); st.last = t;
    const fx = Math.cos(h.facing);
    if (fx > 0.25) st.want = 1; else if (fx < -0.25) st.want = -1; else if (!st.want) st.want = st.flip;
    K.spring(st, 'flipS', st.want, dt, 240, 0.9);
    K.spring(st, 'move', h.moving ? 1 : 0, dt, 70, 1);
    st.ph += dt * (h.ms || 280) / 24 * st.move;
    const atk = h.animAtk > 0 ? 1 - h.animAtk : -1;
    const cast = Math.max(0, h.animCast || 0);
    // arm rotations are about the shoulders; 0 = hanging down, negative swings forward/up
    let tF = -0.25 - Math.sin(st.ph) * 0.25 * st.move + Math.sin(t * 1.8) * 0.03;
    let tB = 0.15 + Math.sin(st.ph) * 0.25 * st.move;
    let lunge = 0, squash = 0;
    if (B.shield) tB = -0.55;
    if (B.bow) tB = -1.45;
    if (atk >= 0) {
      if (B.style === 'smash') { tF = atk < 0.32 ? -3.6 + ease(atk / 0.32) * 2.6 : -1.0 + (atk - 0.32) / 0.68 * 0.75; lunge = Math.sin(Math.min(1, atk * 2.4) * Math.PI) * 3; squash = Math.sin(Math.min(1, atk * 3) * Math.PI) * 0.06; }
      else if (B.style === 'slash') { const a = ease(Math.min(1, atk / 0.4)); tF = -2.4 + a * 1.9; tB = -1.4 + a * 1.2; lunge = Math.sin(Math.min(1, atk * 3) * Math.PI) * 3; }
      else if (B.style === 'axes') { tF = -3.2 + ease(Math.min(1, atk / 0.35)) * 2.6; tB = -3.2 + ease(Math.max(0, Math.min(1, (atk - 0.2) / 0.35))) * 2.6; lunge = Math.sin(Math.min(1, atk * 2.4) * Math.PI) * 3; squash = Math.sin(Math.min(1, atk * 3) * Math.PI) * 0.05; }
      else if (B.style === 'bow') { tF = atk < 0.3 ? -1.2 : -1.2 + (atk - 0.3) * 1.4; }
      else if (B.style === 'staff') { tF = -0.9; lunge = Math.sin(Math.min(1, atk * 3) * Math.PI) * 2; }
    }
    if (cast > 0) { tF = Math.min(tF, -1.1 * cast - 0.2); if (B.style === 'staff') tB = -1.6 * cast; }
    if (h.channel) { tF = -1.5 + Math.sin(t * 28) * 1.2; tB = -1.5 - Math.sin(t * 28) * 1.2; }
    K.spring(st, 'aF', tF, dt, atk >= 0 ? 650 : 150, 0.75);
    K.spring(st, 'aB', tB, dt, atk >= 0 ? 650 : 150, 0.75);
    K.spring(st, 'lunge', lunge, dt, 380, 0.8);
    K.spring(st, 'squash', squash, dt, 400, 0.6);
    K.spring(st, 'lean', 0.08 * st.move, dt, 90, 0.9);
    K.spring(st, 'cape', 0.18 * st.move + Math.sin(t * 2) * 0.04, dt, 50, 0.6);
    return st;
  }

  // ---------------------------------------------------------------- draw
  // ctx origin at the hero's feet; height = world height of the figure
  function draw(ctx, h, t, height) {
    const B = get(h.def.id);
    const st = animate(h, t, B);
    const k = height / B.height;
    const bob = -Math.abs(Math.sin(st.ph)) * 2.2 * st.move;
    const breathe = Math.sin(t * 2.2) * 0.012;
    const sq = st.squash + Math.abs(Math.sin(st.ph)) * 0.03 * st.move;
    ctx.save();
    ctx.scale(k * st.flipS, k);
    ctx.rotate(st.lean);
    ctx.translate(st.lunge, bob);
    ctx.scale(1 + sq * 0.6, 1 - sq + breathe);
    // feet / legs
    const stepF = Math.sin(st.ph) * st.move, stepB = -stepF;
    if (B.robe) {
      drawPart(ctx, B.foot, 2 + stepF * 3.5, -Math.max(0, stepF) * 1.5, 0);
      drawPart(ctx, B.foot, -3 + stepB * 3.5, -Math.max(0, stepB) * 1.5, 0);
    } else {
      drawPart(ctx, B.legB, -3, -14 - Math.max(0, stepB) * 1.6, stepB * 0.32);
      drawPart(ctx, B.legF, 3.5, -14 - Math.max(0, stepF) * 1.6, stepF * 0.32);
    }
    if (B.cape) drawPart(ctx, B.cape, B.neck[0], B.neck[1], st.cape);
    if (!B.shield && !B.bow) drawPart(ctx, B.armB, B.shB[0], B.shB[1], st.aB);
    drawPart(ctx, B.body, 0, 0, 0);
    if (B.shield) drawPart(ctx, B.armB, B.shB[0] + 4, B.shB[1] + 2, st.aB * 0.4);
    if (B.bow) {
      drawPart(ctx, B.armB, B.shB[0], B.shB[1], st.aB);
      const rot = (p, piv, a) => [piv[0] + p[0] * Math.cos(a) - p[1] * Math.sin(a), piv[1] + p[0] * Math.sin(a) + p[1] * Math.cos(a)];
      const t1 = rot(B.bowTips[0], B.shB, st.aB), t2 = rot(B.bowTips[1], B.shB, st.aB);
      const hand = rot([0.5, 14.5], B.shF, st.aF);
      const pull = h.animAtk > 0 && st.aF < -0.9;
      const mid = [(t1[0] + t2[0]) / 2 - 1, (t1[1] + t2[1]) / 2];
      const sp = pull ? hand : mid;
      ctx.strokeStyle = 'rgba(245,240,225,0.95)'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(sp[0], sp[1]); ctx.lineTo(t2[0], t2[1]); ctx.stroke();
      if (pull) { ctx.strokeStyle = '#d8c49a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(mid[0] + 12, mid[1]); ctx.stroke(); }
    }
    drawPart(ctx, B.armF, B.shF[0], B.shF[1], st.aF);
    if (B.style === 'staff') {
      const a = st.aF, tp = [B.shF[0] + B.staffTip[0] * Math.cos(a) - B.staffTip[1] * Math.sin(a), B.shF[1] + B.staffTip[0] * Math.sin(a) + B.staffTip[1] * Math.cos(a)];
      const fl = 1 + Math.sin(t * 13) * 0.15;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(Art.glow(B.fire ? 'rgba(255,130,30,0.9)' : 'rgba(130,220,255,0.8)'), tp[0] - 8 * fl, tp[1] - 8 * fl, 16 * fl, 16 * fl);
      if (h.animCast > 0.05) {
        const b = st.aB, hp = [B.shB[0] - 14 * Math.sin(b), B.shB[1] + 14 * Math.cos(b)];
        ctx.drawImage(Art.glow(B.fire ? 'rgba(255,150,40,0.9)' : 'rgba(150,230,255,0.9)'), hp[0] - 7, hp[1] - 7, 14, 14);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (B.fire) {
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath(); ctx.moveTo(tp[0] - 2.4, tp[1] + 1); ctx.quadraticCurveTo(tp[0] - 2, tp[1] - 4 * fl, tp[0] + Math.sin(t * 9), tp[1] - 7 * fl); ctx.quadraticCurveTo(tp[0] + 2, tp[1] - 4 * fl, tp[0] + 2.4, tp[1] + 1); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- portraits
  function portrait(defId, size) {
    const c = Art.mk(size, size), x = c.getContext('2d');
    const def = HERO_BY_ID[defId];
    const bg = x.createRadialGradient(size * 0.45, size * 0.35, 2, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, Art.shadeColor(def.color, 0.12)); bg.addColorStop(1, Art.shadeColor(def.color, -0.8));
    x.fillStyle = bg; x.fillRect(0, 0, size, size);
    x.drawImage(Art.glow('rgba(255,240,210,0.3)'), size * 0.1, -size * 0.05, size * 0.8, size * 0.8);
    const fake = { id: 'ap-' + defId, def, animAtk: 0, animCast: 0, moving: false, facing: 0, ms: 0 };
    const B = get(defId);
    x.save();
    x.translate(size * 0.45, size * 1.97);
    draw(x, fake, 0.6, size * 2.05 * B.height / 60);
    x.restore();
    const v = x.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = v; x.fillRect(0, 0, size, size);
    return c;
  }
  function fullBody(defId, w, hgt) {
    const c = Art.mk(w, hgt), x = c.getContext('2d');
    const fake = { id: 'af-' + defId, def: HERO_BY_ID[defId], animAtk: 0, animCast: 0, moving: false, facing: 0, ms: 0 };
    x.translate(w / 2, hgt * 0.92);
    x.drawImage(Art.soft('rgba(0,0,0,0.6)'), -w * 0.3, -w * 0.08, w * 0.6, w * 0.16);
    draw(x, fake, 0.6, hgt * 0.82);
    return c;
  }

  return { draw, portrait, fullBody, get };
})();

// Which hero art style is active ('top' = top-down painted, 'angled' = 3/4 view). Saved per device.
const HeroStyle = (() => {
  let style = 'angled';
  try { style = localStorage.getItem('lb_heroStyle') || 'angled'; } catch (e) { /* ignore */ }
  return {
    get angled() { return style === 'angled'; },
    get name() { return style === 'angled' ? 'Angled' : 'Top-down'; },
    toggle() { style = style === 'angled' ? 'top' : 'angled'; try { localStorage.setItem('lb_heroStyle', style); } catch (e) { /* ignore */ } },
    portrait: (id, size) => (style === 'angled' ? HeroAngled : HeroArt).portrait(id, size),
    fullBody: (id, w, h) => (style === 'angled' ? HeroAngled : HeroArt).fullBody(id, w, h),
  };
})();
Art.heroPortrait = (defId, size) => HeroStyle.portrait(defId, size);
