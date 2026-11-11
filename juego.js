'use strict';
// =====================================================================
//  PESCA TACTO · lógica del juego (computador)
//  Dos teléfonos (control.html) se unen a la misma sala por MQTT (EMQX).
//  Cada jugador avanza solo por 5 pasos y gana quien termina primero:
//    1. PESCA    lanzar (giro/aceleración) → picada (vibra) → enrollar (círculos con el dedo)
//    2. CORTAR   5 trazos con el dedo → pescado en 6 partes
//    3. COCINAR  mover el teléfono como una sartén y voltear 5 veces (cada 5–10 s)
//    4. SERVIR   arrastrar el pescado al plato
//    5. DECORAR  arrastrar 5 extras al plato (tomate, lechuga, papas, salsa, perejil)
//  El dibujo de cada escena está en escenas.js.
// =====================================================================
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ---------- reglas (ajusta aquí la dificultad) ----------
const PICADA_MIN = 3, PICADA_MAX = 6;    // segundos de espera hasta que pique
const VENTANA_REACCION = 3.2;            // segundos para empezar a enrollar tras la picada
const REEL_GAIN = 0.12;                  // progreso por segundo y por vuelta/s del dedo
const SWING_GIRO = 320, SWING_ACEL = 14; // °/s y m/s² que cuentan como "golpe de muñeca" (swing = 1)
const CORTES = 5;                        // trazos exactos para cortar el pescado
const VOLTEOS = 5, VOLTEO_MIN = 5, VOLTEO_MAX = 10; // vueltas en la sartén y segundos entre una y otra
const CUT_AR = 1.6, PLATO_AR = 4 / 3;    // proporción (ancho/alto) del área táctil en el teléfono
const PLATE = { x: 0.5, y: 0.64, r: 0.26 }; // el plato en el área táctil (x, y de 0 a 1; r en unidades de ancho)
const PASOS = ['Pesca', 'Cortar', 'Cocinar', 'Servir', 'Decorar'];
const EXTRAS = [ // los 5 extras, en fila arriba del plato
  { k: 'tomate', hx: 0.14 }, { k: 'lechuga', hx: 0.32 }, { k: 'papas', hx: 0.5 }, { k: 'salsa', hx: 0.68 }, { k: 'perejil', hx: 0.86 },
];

const ESPECIES = [ // peso en kg, largo en cm, "pull" = fuerza con que tira (progreso/s), freq = qué tan común es
  { n: 'Pejerrey',        w: [0.12, 0.45], l: [18, 32],  pull: 0.07, freq: 30, c: '#b8c6d6', b: '#eef3f8' },
  { n: 'Trucha arcoíris', w: [0.8, 3.2],   l: [34, 62],  pull: 0.10, freq: 26, c: '#6fae8d', b: '#f0a6a6' },
  { n: 'Róbalo',          w: [2, 6],       l: [50, 80],  pull: 0.12, freq: 18, c: '#7b8794', b: '#dde3e8' },
  { n: 'Corvina',         w: [3, 9],       l: [60, 95],  pull: 0.14, freq: 12, c: '#9aa5b1', b: '#f1dcaa' },
  { n: 'Congrio colorado',w: [4, 10],      l: [80, 120], pull: 0.15, freq: 8,  c: '#d1603d', b: '#f2b38d' },
  { n: 'Salmón chinook',  w: [6, 16],      l: [75, 110], pull: 0.17, freq: 6,  c: '#8e9aaf', b: '#ee8f8f' },
];
function elegirPez(power) { // lanzar más fuerte = más chance de peces grandes
  const pesos = ESPECIES.map((e, i) => e.freq * (i < 2 ? 1.25 - power * 0.5 : 0.6 + power * 0.9));
  let r = Math.random() * pesos.reduce((a, b) => a + b, 0), k = 0;
  for (; k < pesos.length - 1; k++) { r -= pesos[k]; if (r <= 0) break; }
  const e = ESPECIES[k], t = Math.random();
  return { esp: e, n: e.n, w: +lerp(e.w[0], e.w[1], t).toFixed(2), l: Math.round(lerp(e.l[0], e.l[1], t)), pull: e.pull, t };
}

// ---------- sonido (Web Audio, sin archivos) ----------
let ac = null;
const audio = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return ac; };
['pointerdown', 'keydown'].forEach(n => addEventListener(n, () => audio(), { once: true }));
function tone(f, d, type = 'sine', v = 0.15, slide = 0, delay = 0) {
  const c = audio(); if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, f = 1200) {
  const c = audio(); if (!c) return; const b = c.createBuffer(1, Math.max(1, c.sampleRate * d), c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = f; g.gain.value = v;
  s.connect(fl).connect(g).connect(c.destination); s.start();
}
const sfx = {
  cast: () => noise(0.35, 0.12, 2600), splash: () => noise(0.5, 0.22, 900),
  bite: () => { tone(880, 0.12, 'triangle', 0.2); tone(1175, 0.2, 'triangle', 0.2, 0, 0.14); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.18, 0, i * 0.12)),
  lose: () => tone(330, 0.6, 'sawtooth', 0.1, 0.5), start: () => { tone(600, 0.1, 'square', 0.08); tone(900, 0.18, 'square', 0.08, 0, 0.12); },
  chop: () => { noise(0.12, 0.3, 700); tone(160, 0.12, 'square', 0.12, 0.5); }, flip: () => noise(0.4, 0.14, 1800),
  pick: () => tone(700, 0.06, 'triangle', 0.1), place: () => { tone(420, 0.1, 'triangle', 0.16, 0.7); noise(0.1, 0.08, 500); }, pour: () => noise(0.9, 0.12, 1400),
};

// ---------- jugadores ----------
const COLORES = ['#2ec4b6', '#ff9f1c'];
const players = [1, 2].map(slot => ({ slot, color: COLORES[slot - 1], dev: null, kb: false, name: 'Jugador ' + slot, step: 'lobby', state: 'lobby', t0: 0, fx: [], rate: 0, revBuf: 0, prev: null, sw: 0, seed: slot * 3.7, sent: '', sentAt: 0, res: null, tFin: 0 }));
let phase = 'lobby', gameT0 = 0, firstFinisher = null, endAt = 0;
const now = () => performance.now();
const setState = (p, s) => { p.state = s; p.t0 = now(); };
const distP = (a, b, ar) => Math.hypot(a.x - b.x, (a.y - b.y) / ar); // distancia en el área táctil (en unidades de ancho)
const fmtT = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// ---------- conexión (Tacto / MQTT) ----------
const Q = new URLSearchParams(location.search);
const SALA = Tacto.clean(Q.get('sala')) || Tacto.rand(8);
const tacto = new Tacto({ sala: SALA });
const online = p => !!(p.dev && tacto.devices[p.dev] && tacto.devices[p.dev].online);
const ready = p => p.kb || online(p);
function sendCmd(p, obj) { if (p.dev && tacto.client && tacto.client.connected) tacto.client.publish(`tacto/${tacto.sala}/${p.dev}/cmd`, JSON.stringify(obj)); }
const buzz = (p, pattern) => sendCmd(p, { vibe: pattern });
function phonePayload(p) { // lo que el teléfono necesita saber de este jugador ahora mismo
  if (phase === 'lobby') return { estado: 'lobby' };
  switch (p.step) {
    case 'pesca': return { estado: ({ lanzar: 'lanzar', vuelo: 'espera', espera: 'espera', picada: 'picada', enrollar: 'enrollar', capturado: 'capturado', escapo: 'escapo' })[p.state] || 'espera' };
    case 'corte': return { estado: 'corte', cuts: p.cuts, ar: CUT_AR };
    case 'cocina': return { estado: 'cocina', voltea: p.state === 'prompt', flips: p.flips };
    case 'plato': return { estado: p.fase, ar: PLATO_AR, plate: PLATE, items: p.items.filter(i => i.spawned).map(i => ({ k: i.k, x: i.hx, y: i.hy, d: i.done ? 1 : 0 })) };
    case 'fin': return { estado: 'fin', res: p.res, t: fmtT(p.tFin) };
  }
  return { estado: 'lobby' };
}
function syncPhones(force) { // avisa a cada teléfono en qué fase está (y repite cada 1,5 s por si perdió algo)
  const t = now();
  for (const p of players) {
    const msg = JSON.stringify({ slot: p.slot, ...phonePayload(p) });
    if (force || msg !== p.sent || t - p.sentAt > 1500) { p.sent = msg; p.sentAt = t; if (p.dev && tacto.client && tacto.client.connected) tacto.client.publish(`tacto/${tacto.sala}/${p.dev}/cmd`, msg); }
  }
}
function assign() { // el primer teléfono que habla es J1, el segundo J2; si uno se cae, el nuevo toma su lugar
  for (const d of Object.values(tacto.devices)) {
    if (!d.online || players.some(p => p.dev === d.id)) continue;
    const p = players.find(p => !p.dev) || players.find(p => p.dev && !online(p));
    if (p) { p.dev = d.id; p.kb = false; p.sentAt = 0; }
  }
  for (const p of players) { const d = p.dev && tacto.devices[p.dev]; if (d && d.name && d.name !== d.id) p.name = d.name; }
  updateLobby();
}
tacto.on('dispositivo', assign);
tacto.on('estado', s => { const e = $('#conn'); e.textContent = '● ' + (s === 'conectado' ? 'conectado al broker (' + (tacto.broker || '').replace(/^wss?:\/\//, '') + ')' : s); });
tacto.on('error', e => { $('#conn').textContent = '● ' + (e.message || 'error de conexión con el broker'); });
tacto.on('datos', (d, kind, m) => {
  const p = players.find(p => p.dev === d.id); if (!p) return;
  if (kind === 'motion') onMotion(p, m); else if (kind === 'touch') onTouch(p, m);
});
tacto.connect().catch(e => { $('#conn').textContent = '● sin conexión: ' + (e.message || e); });

// ---------- entradas del teléfono ----------
function onMotion(p, m) { // fuerza del movimiento = el mayor entre velocidad de giro y aceleración (sin gravedad); swing ≥ 1 = golpe de muñeca
  const r = Array.isArray(m.r) ? m.r : [0, 0, 0], c = Array.isArray(m.c) ? m.c : null;
  const giro = Math.hypot(r[0] || 0, r[1] || 0, r[2] || 0) / SWING_GIRO;
  const acel = c ? Math.abs(Math.hypot(c[0] || 0, c[1] || 0, c[2] || 0) - 9.8) / SWING_ACEL : 0;
  const s = Math.max(giro, acel); p.sw = Math.max(p.sw || 0, Math.min(2, s));
  if (p.step === 'pesca') swingFeed(p, s);
  else if (p.step === 'cocina' && p.state === 'prompt' && s >= 1 && now() - p.t0 > 250) startFlip(p); // voltear como en una sartén
}
function swingFeed(p, s) {
  if (p.state !== 'lanzar' || now() - p.t0 < 600) return;
  if (!p.cast) { if (s >= 1) p.cast = { t: now(), peak: s }; } else p.cast.peak = Math.max(p.cast.peak, s);
}
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
function onTouch(p, m) {
  if (p.step === 'pesca') reelFeed(p, m); else if (p.step === 'corte') strokeFeed(p, m); else if (p.step === 'plato') dragFeed(p, m);
}
function reelFeed(p, m) { // vueltas del dedo alrededor del centro del pad (cualquier sentido)
  const f = Array.isArray(m.p) && m.n > 0 ? m.p[0] : null;
  if (!f) { p.prev = null; return; }
  const dx = f.x - 0.5, dy = f.y - 0.5;
  if (Math.hypot(dx, dy) < 0.12) { p.prev = null; return; } // muy cerca del centro: el ángulo no es fiable
  const a = Math.atan2(dy, dx);
  if (p.prev != null) { const da = Math.abs(wrap(a - p.prev)); if (da < 1.6) p.revBuf += da / TAU; }
  p.prev = a;
}
function strokeFeed(p, m) { // un trazo = dedo apoyado, arrastrado y levantado
  if (p.state !== 'cortar') { p.stroke = null; return; }
  const f = Array.isArray(m.p) && m.n > 0 ? m.p[0] : null;
  if (f) {
    if (!p.stroke) p.stroke = { len: 0, x0: f.x, y0: f.y, x: f.x, y: f.y, last: now() };
    else { p.stroke.len += distP(f, p.stroke, CUT_AR); p.stroke.x = f.x; p.stroke.y = f.y; p.stroke.last = now(); }
  } else if (p.stroke) endStroke(p);
}
function endStroke(p) {
  const s = p.stroke; p.stroke = null; if (!s) return;
  if (s.len >= 0.28 && distP({ x: s.x, y: s.y }, { x: s.x0, y: s.y0 }, CUT_AR) >= 0.18) queueCut(p); // ignora toques y garabatos muy cortos
}
function queueCut(p) { if (p.cuts + p.pending < CORTES) p.pending++; }
function dragFeed(p, m) { // arrastrar pescado y extras hasta el plato
  if (p.state !== 'jugando') return;
  const f = Array.isArray(m.p) && m.n > 0 ? m.p[0] : null;
  if (!f) { p.lock = false; if (p.drag) release(p); return; }
  if (p.lock) return;
  if (!p.drag) {
    let best = null, bd = 0.17;
    for (const it of p.items) { if (it.done || !it.spawned) continue; const d = distP(f, { x: it.hx, y: it.hy }, PLATO_AR); if (d < bd) { bd = d; best = it; } }
    if (best) { p.drag = { it: best, x: f.x, y: f.y }; sfx.pick(); }
  } else { p.drag.x = f.x; p.drag.y = f.y; }
}
function release(p) { // soltar: si cae sobre el plato se acomoda sola; si no, vuelve a su lugar
  const d = p.drag; p.drag = null; if (!d) return;
  if (distP(d, PLATE, PLATO_AR) < PLATE.r * 1.1) placeItem(p, d.it, d.x, d.y);
}
function placeItem(p, it, x, y) {
  it.done = true; it.dx = x; it.dy = y; it.placeT0 = now(); p.bump = now(); sfx.place(); buzz(p, [40]);
  if (it.k === 'salsa') { it.pourT0 = now(); sfx.pour(); }
}

// ---------- teclado (modo de prueba sin teléfono) ----------
// Q = golpe de muñeca (lanzar / voltear) · W = acción (enrollar / cortar / mover sartén / poner en el plato)
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { q: [0, 'a'], w: [0, 'b'], p: [1, 'a'], o: [1, 'b'] }[k];
  if (map) { const p = players[map[0]]; if (p.kb && phase === 'play') kbAction(p, map[1]); return; }
  if (k === 'f') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  if (k === 'enter') { if (phase === 'lobby') { if (players.every(ready)) startGame(); } else if (phase === 'final') startGame(); }
  if (phase === 'play' && '1234'.includes(k) && k) jumpAll(['pesca', 'corte', 'cocina', 'plato'][+k - 1]); // atajo para probar cada escena
});
function kbAction(p, a) {
  if (a === 'a') {
    if (p.step === 'pesca') { p.sw = 1.5; swingFeed(p, 1.5 + Math.random() * 1.5); }
    else if (p.step === 'cocina') { if (p.state === 'prompt') startFlip(p); else p.sw = 1.1; }
  } else {
    if (p.step === 'pesca') p.revBuf += 0.22;
    else if (p.step === 'corte') queueCut(p);
    else if (p.step === 'cocina') p.sw = 0.9;
    else if (p.step === 'plato' && p.state === 'jugando') { const it = p.items.find(i => i.spawned && !i.done); if (it) placeItem(p, it, PLATE.x + rnd(-0.1, 0.1), PLATE.y + rnd(-0.08, 0.08)); }
  }
}

// ---------- flujo de la partida ----------
function startGame() {
  for (const p of players) { p.res = null; p.tFin = 0; p.fishInfo = null; p.sw = 0; }
  firstFinisher = null; endAt = 0; gameT0 = now(); phase = 'play'; $('#lobby').hidden = true; $('#final').hidden = true; sfx.start();
  for (const p of players) startStep(p, 'pesca');
  if (Q.get('paso')) jumpAll(Q.get('paso')); // ?paso=corte|cocina|plato|fin para probar una escena directo
  syncPhones(true);
}
function fullItems() { const t = now() - 6000; return [{ id: 'pez', k: 'pez', hx: 0.5, hy: 0.15, done: true, spawned: true, placeT0: t, dx: 0.5, dy: 0.64 }, ...EXTRAS.map(e => ({ id: e.k, k: e.k, hx: e.hx, hy: 0.14, done: true, spawned: true, placeT0: t, pourT0: t, dx: 0.5, dy: 0.64 }))]; }
function jumpAll(paso) {
  if (!['pesca', 'corte', 'cocina', 'plato', 'fin'].includes(paso)) return;
  for (const p of players) {
    if (!p.fishInfo) { const e = ESPECIES[1]; p.fishInfo = { n: e.n, w: 1.9, l: 48, esp: e }; }
    p.res = null; startStep(p, paso);
    if (paso === 'fin') { p.fase = 'decorar'; p.items = fullItems(); }
  }
  syncPhones(true);
}
function startStep(p, step) {
  p.step = step; setState(p, 'intro'); p.sent = ''; p.sw = 0;
  switch (step) {
    case 'pesca': resetPesca(p); break;
    case 'corte': Object.assign(p, { cuts: 0, pending: 0, cutAnim: null, stroke: null, gapV: 0, lastCut: 0 }); break;
    case 'cocina': Object.assign(p, { flips: 0, cook: [0, 0], side: 0, fireA: 0, nextFlip: 0, pan: { x: 0, y: 0 } }); break;
    case 'plato': Object.assign(p, { fase: 'servir', drag: null, lock: false, bump: 0, items: [{ id: 'pez', k: 'pez', hx: 0.5, hy: 0.15, done: false, spawned: true }] }); break;
    case 'fin': finishPlayer(p); break;
  }
}
function finishPlayer(p) {
  p.tFin = now() - gameT0;
  if (!firstFinisher) { firstFinisher = p; p.res = 'gano'; sfx.win(); } else { p.res = 'perdio'; sfx.lose(); }
  buzz(p, p.res === 'gano' ? [100, 60, 100, 60, 400] : [500]);
}

// ---- 1 · pesca ----
function resetPesca(p) { Object.assign(p, { state: 'lanzar', t0: now(), cast: null, prog: 0, rate: 0, revBuf: 0, prev: null, fish: null, catchInfo: null, msg: '', fx: [], power: 0.5, rel: null, f0: 0.3, lx: 0, burstUntil: 0, nextBurst: 0, lastBuzz: 0 }); }
function doCast(p, power) {
  p.power = power; p.f0 = lerp(0.56, 0.14, power); p.lx = rnd(-0.12, 0.16); p.rel = null; // dónde cae la boya: f = distancia (0 horizonte, 1 a tus pies), lx = izquierda/derecha
  setState(p, 'vuelo'); sfx.cast();
}
function land(p) {
  const f = p.fish;
  p.catchInfo = p.fishInfo = { n: f.n, w: f.w, l: f.l, esp: f.esp };
  setState(p, 'capturado'); buzz(p, [80, 60, 80, 60, 250]); sfx.win();
}
function escape(p, msg) { p.msg = msg; p.catchInfo = null; setState(p, 'escapo'); buzz(p, [450]); sfx.lose(); } // se escapó: vuelve a lanzar, hay que atrapar uno para seguir
function updatePesca(p, dt, t, moved) {
  const el = (t - p.t0) / 1000;
  p.reelAng = (p.reelAng || 0) + moved * TAU; p.reelShow = lerp(p.reelShow || 0, p.reelAng, clamp(dt * 20)); // el carrete de la pantalla gira con tu dedo
  p.rate = clamp(p.rate + (moved / Math.max(dt, 0.001) - p.rate) * clamp(dt * 8), 0, 5.5);
  switch (p.state) {
    case 'lanzar':
      if (p.cast && t - p.cast.t > 220) { doCast(p, clamp(0.3 + ((p.cast.peak - 1) / 2.2) * 0.7, 0.3, 1)); p.cast = null; }
      break;
    case 'vuelo':
      if (el >= 1.3) { setState(p, 'espera'); p.biteAt = t + rnd(PICADA_MIN, PICADA_MAX) * 1000; addSplash(p, p.lx, p.f0, 0.6); sfx.splash(); }
      break;
    case 'espera':
      if (t >= p.biteAt) {
        p.fish = elegirPez(p.power); setState(p, 'picada'); addSplash(p, p.lx, p.f0, 1.2); sfx.splash(); sfx.bite(); buzz(p, [350, 120, 350, 120, 600]);
      }
      break;
    case 'picada':
      if (moved > 0.04) { setState(p, 'enrollar'); p.prog = 0.18; p.nextBurst = t + rnd(1500, 3000); }
      else if (el > VENTANA_REACCION) escape(p, 'Reaccionaste tarde: el pez se fue');
      break;
    case 'enrollar': {
      if (t > p.nextBurst) { p.burstUntil = t + 700; p.nextBurst = t + rnd(2200, 4200); buzz(p, [120]); } // tirón fuerte del pez
      const ya = t < p.burstUntil ? 2.1 : 1;
      p.pullNow = p.fish.pull * ya * (1 + 0.4 * Math.sin(t / 280 + p.seed));
      p.prog += (p.rate * REEL_GAIN - p.pullNow) * dt;
      if (p.rate < 1 && t - (p.lastBuzz || 0) > 900) { p.lastBuzz = t; buzz(p, [50]); } // si frenas, el pez tira (se siente en la mano)
      if (p.prog >= 1) { p.prog = 1; land(p); }
      else if (p.prog <= 0) { p.prog = 0; escape(p, 'Dejaste de enrollar y el pez se soltó'); }
      else if (el > 40) escape(p, 'El pez se cansó… de esperarte');
      if (Math.random() < dt * 6) { const bw = bobWorld(p); addSplash(p, bw.lx, bw.f, 0.25); }
      break;
    }
    case 'capturado': if (el > 4.5) startStep(p, 'corte'); break;
    case 'escapo': if (el > 2.6) resetPesca(p); break;
  }
  p.fx = p.fx.filter(f => t - f.t0 < f.max); // partículas y ondas
}

// ---- 2 · cortar ----
function updateCorte(p, dt, t) {
  const el = (t - p.t0) / 1000;
  if (p.state === 'intro') { if (el > 1.0) setState(p, 'cortar'); return; }
  if (p.state === 'cortar') {
    if (p.stroke && t - p.stroke.last > 350) endStroke(p); // el dedo se quedó quieto/desapareció: cierra el trazo
    const libre = !p.cutAnim || t - p.cutAnim.t0 > 520;
    if (p.pending > 0 && libre) { p.pending--; p.cuts++; p.cutAnim = { t0: t, k: p.cuts }; sfx.chop(); buzz(p, [70]); }
    if (p.cuts >= CORTES && (!p.cutAnim || t - p.cutAnim.t0 > 700)) { setState(p, 'listo'); sfx.win(); }
  } else if (p.state === 'listo' && el > 1.8) startStep(p, 'cocina');
}

// ---- 3 · cocinar ----
function startFlip(p) { setState(p, 'volteo'); sfx.flip(); buzz(p, [60]); }
function updateCocina(p, dt, t) {
  const el = (t - p.t0) / 1000, k = p.sw;
  const objetivo = clamp((k - 0.12) / 0.45); // el fuego solo se ve cuando mueves la sartén
  p.fireA += (objetivo - p.fireA) * clamp(dt * (objetivo > p.fireA ? 10 : 2.2));
  p.pan.x = lerp(p.pan.x, Math.sin(t / 130) * Math.min(k, 1.2), clamp(dt * 10)); p.pan.y = lerp(p.pan.y, Math.cos(t / 110) * Math.min(k, 1.2) * 0.7, clamp(dt * 10));
  const sube = () => { p.cook[p.side] = Math.min(1, p.cook[p.side] + dt * 0.045); };
  switch (p.state) {
    case 'intro': if (el > 1.1) { setState(p, 'cocinando'); p.nextFlip = t + rnd(VOLTEO_MIN, VOLTEO_MAX) * 1000; } break;
    case 'cocinando': sube(); if (t >= p.nextFlip) { setState(p, 'prompt'); sfx.bite(); buzz(p, [200, 100, 200]); } break;
    case 'prompt': sube(); break;
    case 'volteo':
      if (el > 0.78) p.sw = Math.max(p.sw, 1.2); // al caer, el fuego se aviva
      if (el >= 0.9) {
        p.flips++; p.side = 1 - p.side;
        if (p.flips >= VOLTEOS) { setState(p, 'listo'); p.cook = [1, 1]; sfx.win(); buzz(p, [80, 60, 80, 60, 250]); }
        else { setState(p, 'cocinando'); p.nextFlip = t + rnd(VOLTEO_MIN, VOLTEO_MAX) * 1000; }
      }
      break;
    case 'listo': if (el > 3.2) startStep(p, 'plato'); break;
  }
}

// ---- 4 y 5 · servir y decorar ----
function updatePlato(p, dt, t) {
  const el = (t - p.t0) / 1000;
  if (p.state === 'intro') { if (el > 1.0) setState(p, 'jugando'); return; }
  if (p.state === 'jugando') {
    if (p.drag && p.drag.it.k === 'salsa' && distP(p.drag, PLATE, PLATO_AR) < PLATE.r * 0.55) { // el jarro llega encima del pescado: cae la salsa
      const it = p.drag.it, d = p.drag; p.drag = null; p.lock = true; placeItem(p, it, d.x, d.y);
    }
    const pez = p.items[0];
    if (p.fase === 'servir' && pez.done && t - pez.placeT0 > 900) {
      p.fase = 'decorar'; sfx.start();
      for (const e of EXTRAS) p.items.push({ id: e.k, k: e.k, hx: e.hx, hy: 0.14, done: false, spawned: true, spawnT0: t + p.items.length * 90 });
    }
    if (p.fase === 'decorar') {
      const sal = p.items.find(i => i.k === 'salsa');
      if (p.items.every(i => i.done) && (!sal || t - sal.pourT0 > 1200)) { setState(p, 'listo'); sfx.win(); }
    }
  } else if (p.state === 'listo' && el > 1.6) startStep(p, 'fin');
}

function updatePlayer(p, dt, t) {
  const moved = p.revBuf; p.revBuf = 0;
  switch (p.step) {
    case 'pesca': updatePesca(p, dt, t, moved); break;
    case 'corte': updateCorte(p, dt, t); break;
    case 'cocina': updateCocina(p, dt, t); break;
    case 'plato': updatePlato(p, dt, t); break;
  }
  p.sw = (p.sw || 0) * Math.exp(-dt * 5);
}
function updateGame(dt, t) {
  if (phase === 'lobby') { syncPhones(); return; }
  for (const p of players) if (phase !== 'lobby') updatePlayer(p, dt, t);
  syncPhones();
  if (phase === 'play' && players.every(p => p.step === 'fin')) { if (!endAt) endAt = t + 5000; else if (t > endAt) { phase = 'final'; showFinal(); } } // el juego termina cuando LOS DOS completan todo
}

// ---------- resultado final (HTML) ----------
function showFinal() {
  const win = players.find(p => p.res === 'gano');
  $('#fiTitle').textContent = `🏆 ¡Gana ${win.name}!`;
  $('#fiBody').innerHTML = players.map(p => `<div class="col ${p.res === 'gano' ? 'win' : ''}" style="color:${p.color}"><h3>${p.name}</h3><div class="big" style="color:${p.res === 'gano' ? '#7CFF8A' : '#ff7b7b'} !important">${p.res === 'gano' ? 'GANASTE' : 'PERDISTE'}</div><div>Tiempo: <b>${fmtT(p.tFin)}</b></div></div>`).join('');
  $('#final').hidden = false;
}
$('#again').onclick = startGame;

// ---------- lobby ----------
function updateLobby() {
  for (const p of players) {
    const el = $('#s' + p.slot), ok = ready(p);
    el.className = 'slot' + (ok ? ' ok' : '');
    el.innerHTML = `<b>${p.name}</b><small>${online(p) ? '📱 teléfono conectado' : p.kb ? '⌨ teclado' : 'esperando teléfono…'}</small>`;
  }
  $('#go').disabled = !players.every(ready);
}
$('#kb').onclick = () => { const vacios = players.filter(p => !p.dev); const on = !vacios.every(p => p.kb); vacios.forEach(p => { p.kb = on; }); $('#kb').textContent = on ? 'Quitar teclado' : 'Probar con teclado'; updateLobby(); };
$('#go').onclick = () => { if (players.every(ready)) startGame(); };
setInterval(() => { if (phase === 'lobby') assign(); }, 700);

// QR para el teléfono: con node server.js usa /qr.svg y la IP local; publicado, se genera en el navegador
const qrLib = () => window.qrcode ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function updateJoin() {
  const CFG = window.TACTO_CONFIG || {}; let base = null, local = false;
  try { const i = await (await fetch('info', { cache: 'no-store' })).json(); if (i.baseUrl) { base = i.baseUrl + '/control.html'; local = true; } } catch {}
  if (CFG.phoneUrl) base = new URL('control.html', CFG.phoneUrl).href;
  if (!base) base = new URL('control.html', location.href).href;
  let u = base + '?sala=' + tacto.sala; if (Q.get('broker')) u += '&broker=' + encodeURIComponent(Q.get('broker'));
  $('#url').textContent = u;
  if (local && !CFG.phoneUrl) { $('#qr').src = 'qr.svg?u=' + encodeURIComponent(u); $('#qr').hidden = false; return; }
  try { await qrLib(); const q = window.qrcode(0, 'M'); q.addData(u); q.make(); $('#qr').src = q.createDataURL(5, 2); $('#qr').hidden = false; } catch { $('#qr').hidden = true; }
}
updateJoin(); updateLobby();
// (el bucle de dibujo arranca al final de escenas.js)
