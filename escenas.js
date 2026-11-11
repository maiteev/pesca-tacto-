// =====================================================================
//  PESCA TACTO · dibujo de todas las escenas (canvas). La lógica está en juego.js
// =====================================================================
// =====================================================================
//  DIBUJO · PRIMERA PERSONA
//  Ves el lago con los ojos del pescador: tu caña y tus manos abajo a la derecha.
//  La cámara se mueve con lo que haces: sube al lanzar, baja siguiendo la línea, tiembla con la picada
//  y, mientras enrollas, se inclina y se va hacia adelante cuando el pez tira más fuerte que tú.
// =====================================================================
const cv = $('#c'), ctx = cv.getContext('2d');
let W = 0, H = 0, W2 = 0, DPR = 1, frameDt = 0.016;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; W2 = W / 2; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
addEventListener('resize', resize); resize();

const ease = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const font = (px, w = 700) => `${w} ${Math.round(px)}px 'Trebuchet MS', system-ui, sans-serif`;
function txt(s, x, y, px, col = '#fff', align = 'center', w = 800) {
  ctx.font = font(px, w); ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = 'rgba(5,20,40,.65)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// El agua se describe con (lx, f): lx = izquierda/derecha, f = 0 en el horizonte y 1 a tus pies.
function proj(lx, f, w, h, hor) { return { x: w / 2 + lx * w * (0.25 + 1.4 * f), y: hor + (h - hor) * 0.93 * Math.pow(f, 1.6), sc: lerp(0.3, 2.6, f) }; }
function bobWorld(p) { // dónde está la boya en el agua; al enrollar se acerca a tus pies
  const u = p.state === 'capturado' ? 1 : p.state === 'enrollar' ? ease(p.prog) : 0;
  return { lx: lerp(p.lx || 0, 0.05, u), f: lerp(p.f0 || 0.3, 0.9, u) };
}
function addSplash(p, lx, f, k) {
  const t = now(); p.fx.push({ k: 'ring', lx, f, t0: t, max: 1400 * (0.7 + k * 0.4), s: k });
  if (k > 0.4) p.fx.push({ k: 'ring', lx, f, t0: t + 180, max: 1500, s: k * 0.7 });
  for (let i = 0; i < 8 * k + 2; i++) p.fx.push({ k: 'drop', lx, f, vx: rnd(-60, 60), vy: rnd(-230, -90) * (0.5 + k * 0.5), t0: t, max: 900 });
}

// ---------- cámara: cada acción mueve la vista ----------
function camFor(p, t, h) {
  const el = (t - p.t0) / 1000, st = p.state, sw = p.sw || 0, rate = p.rate || 0;
  let y = 0, roll = 0, zoom = 1, sx = 0, sy = 0, tens = 0, losing = 0, burst = false;
  if (st === 'lanzar') { y = Math.sin(t / 1700 + p.seed) * h * 0.004; sx = Math.sin(t / 37) * sw * 4; sy = Math.cos(t / 41) * sw * 3; roll = Math.sin(t / 29) * sw * 0.004; }
  else if (st === 'vuelo') { // la vista sube con el golpe y luego baja siguiendo la línea hasta el agua
    y = el < 0.35 ? h * 0.24 * (1 - Math.pow(1 - el / 0.35, 2)) : h * lerp(0.24, -0.045, ease((el - 0.35) / 0.8));
    zoom = 1 + 0.05 * Math.sin(clamp(el / 0.7) * Math.PI); roll = 0.03 * Math.sin(clamp(el / 0.9) * Math.PI);
  } else if (st === 'espera') { y = Math.sin(t / 1300 + p.seed) * h * 0.003; }
  else if (st === 'picada') { sx = Math.sin(t / 38) * 5; y = -h * 0.012 * (Math.floor(t / 150) % 2); roll = Math.sin(t / 60) * 0.006; tens = 0.6; }
  else if (st === 'enrollar') {
    const pull = p.pullNow || 0.1; burst = t < (p.burstUntil || 0);
    tens = clamp(pull / 0.2); losing = clamp((pull - rate * REEL_GAIN) / 0.15);   // losing: el pez gana
    sx = Math.sin(t / 33) * (2 + 7 * tens); sy = Math.cos(t / 29) * (1 + 5 * tens);
    y = -h * (0.06 * losing + (burst ? 0.05 : 0)) + Math.sin(p.reelShow || 0) * h * 0.004 * Math.min(rate, 4);
    zoom = 1 + 0.04 * losing + (burst ? 0.03 : 0);
    roll = Math.sin(t / 90) * 0.012 * tens + (burst ? Math.sin(t / 55) * 0.025 : 0);
  } else if (st === 'capturado') { y = h * 0.05 * ease(el / 0.8); }
  else if (st === 'escapo') { y = h * 0.09 * Math.exp(-el * 2.2); roll = Math.sin(el * 14) * 0.02 * Math.exp(-el * 2); }
  const c = p.cam || (p.cam = { y: 0, zoom: 1 }), k = 1 - Math.exp(-frameDt * (st === 'vuelo' ? 14 : 9));
  c.y += (y - c.y) * k; c.zoom += (zoom - c.zoom) * k; p.tensV = tens; p.losing = losing; p.burstNow = burst;
  return { y: c.y, zoom: c.zoom, roll, sx, sy };
}
const toScreen = (x, y, w, h, c) => { const dx = (x - w / 2) * c.zoom, dy = (y - h / 2) * c.zoom, co = Math.cos(c.roll), si = Math.sin(c.roll); return { x: w / 2 + c.sx + dx * co - dy * si, y: h / 2 + c.sy + dx * si + dy * co }; };

function montanas(w, hor, col, amp, f, ph) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w * 0.5, hor + 2);
  for (let x = -w * 0.5; x <= w * 1.5; x += 8) ctx.lineTo(x, hor - amp * (0.55 + 0.45 * Math.sin(x * f + ph)) * (0.65 + 0.35 * Math.sin(x * f * 2.7 + ph * 1.7)));
  ctx.lineTo(w * 1.5, hor + 2); ctx.closePath(); ctx.fill();
}

function drawFish(x, y, L, ang, esp, alpha = 1, dark = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
  const body = dark ? '#0b2a4a' : esp.c, belly = dark ? '#0b2a4a' : esp.b;
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-L * 0.5, 0); ctx.lineTo(-L * 0.74, -L * 0.17); ctx.lineTo(-L * 0.7, 0); ctx.lineTo(-L * 0.74, L * 0.17); ctx.closePath(); ctx.fill(); // cola
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, L * 0.19, 0, 0, TAU); ctx.fill();                                                                                            // cuerpo
  ctx.beginPath(); ctx.moveTo(-L * 0.1, -L * 0.17); ctx.lineTo(L * 0.05, -L * 0.3); ctx.lineTo(L * 0.14, -L * 0.15); ctx.closePath(); ctx.fill();                          // aleta
  if (!dark) {
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(L * 0.02, L * 0.07, L * 0.42, L * 0.1, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(L * 0.33, -L * 0.04, L * 0.045, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.34, -L * 0.04, L * 0.022, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function mensaje(p, t) { // [título, subtítulo, color]
  switch (p.state) {
    case 'lanzar': return ['¡Lanza la caña!', 'Mueve tu teléfono hacia adelante', '#fff'];
    case 'vuelo': return ['', '', '#fff'];
    case 'espera': return ['Esperando que pique…', 'No muevas el teléfono', '#cfe8ff'];
    case 'picada': return [Math.floor(t / 130) % 2 ? '¡PICÓ!' : '¡¡PICÓ!!', '¡Gira el dedo en el carrete!', '#ffef5a'];
    case 'enrollar': return [p.losing > 0.5 ? '¡Te gana! ¡Más rápido!' : p.prog < 0.35 ? '¡Sigue girando!' : p.prog < 0.75 ? '¡Ya casi!' : '¡Casi está!', '', p.losing > 0.5 ? '#ff9e9e' : '#e6ff3d'];
    case 'escapo': return ['Se escapó…', p.msg, '#ff8a80'];
    default: return ['', '', '#fff'];
  }
}

// cielo, montañas, lago y muelle (se dibujan con la transformación de la cámara)
function drawWorld(p, w, h, hor, baseHor, s, t) {
  let g = ctx.createLinearGradient(0, hor - h * 0.9, 0, hor); g.addColorStop(0, '#4f9bd0'); g.addColorStop(1, '#fcefd9'); ctx.fillStyle = g; ctx.fillRect(-w, -3 * h, 3 * w, 3 * h + hor + 1);
  const sx = w * 0.72, sy = hor - 40 * s; g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 100 * s); g.addColorStop(0, 'rgba(255,244,200,.95)'); g.addColorStop(0.25, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 110 * s, sy - 110 * s, 220 * s, 220 * s);
  ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(sx, sy, 26 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let k = 0; k < 4; k++) { const cx = ((t / 90) * (0.6 + k * 0.25) + k * w * 0.35) % (w * 1.4 + 240) - 160, cy = hor - baseHor * (0.35 + k * 0.17); for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(cx + j * 28 * s, cy + Math.sin(j * 2) * 5 * s, 36 * s, 14 * s, 0, 0, TAU); ctx.fill(); } }
  montanas(w, hor, '#9db4cf', baseHor * 0.62, 0.0055, p.slot); montanas(w, hor, '#5d7fa3', baseHor * 0.38, 0.009, p.slot * 2.1);
  ctx.fillStyle = '#1f4e3d'; for (let x = -w * 0.5; x < w * 1.5; x += 11 * s) { const th = (8 + 14 * Math.abs(Math.sin(x * 0.37 + p.slot))) * s; ctx.beginPath(); ctx.moveTo(x, hor + 1); ctx.lineTo(x + 6 * s, hor - th); ctx.lineTo(x + 12 * s, hor + 1); ctx.fill(); }
  g = ctx.createLinearGradient(0, hor, 0, hor + h * 0.62); g.addColorStop(0, '#5fa8c7'); g.addColorStop(0.35, '#2a6f97'); g.addColorStop(1, '#0b2f50'); ctx.fillStyle = g; ctx.fillRect(-w, hor, 3 * w, 3 * h);
  for (let i = 0; i < 9; i++) { const k = i / 9; ctx.fillStyle = `rgba(255,244,200,${0.32 - k * 0.2})`; const ww = (80 - i * 6) * s, yy = hor + 4 * s + Math.pow(k, 1.5) * h * 0.2; ctx.fillRect(sx - ww / 2 + Math.sin(t / 500 + i) * 6 * s, yy, ww, 2.4 * s); }
  ctx.lineWidth = 1.5; const wh = h * 0.62;
  for (let i = 1; i < 18; i++) {
    const k = i / 18, y0 = hor + Math.pow(k, 1.6) * wh * 1.1; ctx.strokeStyle = `rgba(255,255,255,${0.05 + k * 0.12})`; ctx.beginPath();
    for (let x = -w * 0.5; x <= w * 1.5; x += 14) { const y = y0 + Math.sin(x / (40 + k * 60) + t / (700 / (0.6 + k)) + i) * (1 + k * 3.5); x > -w * 0.5 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // el muelle donde estás parado (se ve abajo si bajas la vista)
  const dockTop = hor + h * 0.5; g = ctx.createLinearGradient(0, dockTop, 0, dockTop + h * 0.4); g.addColorStop(0, '#a97246'); g.addColorStop(1, '#4e3119'); ctx.fillStyle = g; ctx.fillRect(-w, dockTop, 3 * w, h * 0.8);
  ctx.fillStyle = '#c28a58'; ctx.fillRect(-w, dockTop, 3 * w, 5 * s); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.045, dockTop + 5 * s); ctx.lineTo(w / 2 + i * w * 0.2, dockTop + h * 0.5); ctx.stroke(); }
}

function drawPesca(p, w, h, t) {
  const s = clamp(Math.min(w / 620, h / 560), 0.55, 1.5), st = p.state, el = (t - p.t0) / 1000;
  const cam = camFor(p, t, h), baseHor = h * 0.42, hor = baseHor + cam.y, tens = p.tensV || 0;
  ctx.save();

  ctx.save(); ctx.translate(w / 2 + cam.sx, h / 2 + cam.sy); ctx.rotate(cam.roll); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-w / 2, -h / 2);
  drawWorld(p, w, h, hor, baseHor, s, t); ctx.restore();
  const S = (lx, f) => { const q = proj(lx, f, w, h, hor), m = toScreen(q.x, q.y, w, h, cam); return { x: m.x, y: m.y, sc: q.sc * cam.zoom }; };

  // ---- punta de la caña (suavizada) ----
  const REST = [0.58, 0.30], LOW = [0.54, 0.42], BACK = [0.76, -0.04], FWD = [0.44, 0.48], UP = [0.58, 0.24];
  let tg = LOW;
  if (st === 'lanzar') tg = REST; else if (st === 'capturado') tg = UP;
  else if (st === 'vuelo') {
    const a = el < 0.28 ? [REST, BACK, ease(el / 0.28)] : el < 0.5 ? [BACK, FWD, ease((el - 0.28) / 0.22)] : [FWD, LOW, ease((el - 0.5) / 0.8)];
    tg = [lerp(a[0][0], a[1][0], a[2]), lerp(a[0][1], a[1][1], a[2])];
  }
  const tp = p.tipF || (p.tipF = { x: tg[0], y: tg[1] }), kt = 1 - Math.exp(-frameDt * (st === 'vuelo' ? 30 : 10));
  tp.x += (tg[0] - tp.x) * kt; tp.y += (tg[1] - tp.y) * kt;
  const tip = { x: tp.x * w, y: tp.y * h };
  if (st === 'lanzar') tip.x += Math.sin(t / 35) * (p.sw || 0) * 8 * s;
  if (st === 'picada') { tip.x += Math.sin(t / 45) * 6 * s; tip.y += Math.abs(Math.sin(t / 70)) * 22 * s; }
  if (st === 'enrollar') { tip.x += Math.sin(t / 38) * (2 + 6 * tens) * s; tip.y += ((10 + 22 * tens) + (p.burstNow ? 40 : 0)) * s; }

  // ---- ondas y gotas en el agua ----
  for (const f of p.fx) {
    const a = (t - f.t0) / f.max; if (a < 0) continue; const q = S(f.lx, f.f);
    if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - a)})`; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(q.x, q.y, (10 + a * 70 * (0.6 + f.s * 0.5)) * s * q.sc, (4 + a * 24 * (0.6 + f.s * 0.5)) * s * q.sc, 0, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = `rgba(255,255,255,${1 - a / 0.9})`; ctx.beginPath(); ctx.arc(q.x + f.vx * a * q.sc, q.y + (f.vy * a + 420 * a * a) * q.sc, 3 * s * Math.max(0.6, q.sc), 0, TAU); ctx.fill(); }
  }

  // ---- boya, línea y pez ----
  let B = null;
  if (st === 'lanzar' || st === 'escapo') B = { x: tip.x + Math.sin(t / 700 + p.seed) * 6 * s, y: tip.y + 0.11 * h, sc: 1.1, air: true };
  else if (st === 'vuelo') {
    if (el < 0.5) B = { x: tip.x, y: tip.y + 0.05 * h, sc: 1.2, air: true };
    else {
      if (!p.rel) p.rel = { x: tip.x, y: tip.y }; const u = clamp((el - 0.5) / 0.8), e = S(p.lx, p.f0);
      B = { x: lerp(p.rel.x, e.x, u), y: lerp(p.rel.y, e.y, u) - Math.sin(u * Math.PI) * (0.16 + 0.24 * p.power) * h, sc: lerp(1.3, e.sc, u) };
    }
  } else if (st === 'espera' || st === 'picada' || st === 'enrollar') {
    const bw = bobWorld(p), e = S(bw.lx, bw.f), j = st === 'espera' ? Math.sin(t / 520) * 2.5 : st === 'picada' ? Math.sin(t / 55) * 5 + (Math.floor(t / 400) % 2 ? 4 : 0) : Math.sin(t / 90) * 2;
    B = { x: e.x, y: e.y + j * s * e.sc, sc: e.sc };
    if (st === 'picada') drawFish(e.x + 10 * s * e.sc, e.y + 22 * s * e.sc, 60 * s * e.sc, Math.sin(t / 90) * 0.4, ESPECIES[0], 0.5, true);
    if (st === 'enrollar') { // la sombra del pez bajo el agua, más cerca mientras enrollas
      const f = p.fish, sh = S(bw.lx + Math.sin(t / 310 + p.seed) * 0.05 * (1 - p.prog * 0.6), Math.max(0.05, bw.f - 0.04));
      drawFish(sh.x, sh.y + 18 * s * sh.sc, lerp(50, 130, clamp((f.l - 18) / 100)) * s * sh.sc * 1.1, Math.sin(t / 120) * 0.25 + 0.1, ESPECIES[0], 0.55, true);
    }
  }
  if (st === 'capturado') { // el pez salta del agua hacia ti y queda colgando de la caña
    const bw = bobWorld(p), e = S(bw.lx, bw.f), u = clamp(el / 1.0), c = p.catchInfo, hang = { x: tip.x, y: tip.y + 0.1 * h + 0.14 * h };
    const L = lerp(150, 290, clamp((c.l - 18) / 100)) * s, Lc = lerp(L * 0.3, L, ease(u));
    const px = lerp(e.x, hang.x, ease(u)), py = lerp(e.y, hang.y, ease(u)) - Math.sin(u * Math.PI) * 0.2 * h;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(px, py - Lc * 0.45); ctx.stroke();
    drawFish(px, py, Lc, u < 1 ? lerp(-0.4, -Math.PI / 2, ease(u)) : -Math.PI / 2 + Math.sin(t / 200) * 0.1, c.esp);
    if (el < 0.12) addSplash(p, bw.lx, bw.f, 1.1);
  } else if (B) {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    const sag = B.air ? 6 * s : (34 * (1 - tens) + 4) * s; ctx.quadraticCurveTo((tip.x + B.x) / 2, Math.max(tip.y, B.y) + sag, B.x, B.y); ctx.stroke();
    const r = 7 * s * clamp(B.sc, 0.5, 2.2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(B.x, B.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(B.x, B.y, r, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ---- tu caña, tus manos y el carrete (en primer plano) ----
  const P0 = { x: w * 0.83, y: h * 1.07 }, bend = (10 + 70 * tens + (st === 'capturado' ? 40 : 0)) * s, C = { x: (P0.x + tip.x) / 2, y: (P0.y + tip.y) / 2 + bend };
  const Pt = u => ({ x: (1 - u) * (1 - u) * P0.x + 2 * (1 - u) * u * C.x + u * u * tip.x, y: (1 - u) * (1 - u) * P0.y + 2 * (1 - u) * u * C.y + u * u * tip.y });
  const rh = Pt(0.14), lh = Pt(0.46), shk = (st === 'enrollar' ? tens : 0) * 3 * s;
  ctx.lineCap = 'round'; ctx.strokeStyle = p.color; ctx.lineWidth = 50 * s; ctx.beginPath(); ctx.moveTo(w * 1.05, h * 1.12); ctx.lineTo(rh.x + 8 * s, rh.y + 8 * s); ctx.stroke();   // manga derecha
  ctx.lineWidth = 44 * s; ctx.beginPath(); ctx.moveTo(w * 0.52, h * 1.15); ctx.lineTo(lh.x, lh.y + 10 * s); ctx.stroke();                                                       // manga izquierda
  const N = 28; ctx.strokeStyle = '#2b1d12';
  for (let i = 0; i < N; i++) { const a = Pt(i / N), b = Pt((i + 1) / N); ctx.lineWidth = lerp(17, 3, i / N) * s; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2 * s; ctx.beginPath(); const hl0 = Pt(0.1); ctx.moveTo(hl0.x - 3 * s, hl0.y); for (let i = 2; i <= N; i += 2) { const a = Pt(i / N); ctx.lineTo(a.x - 3 * s * (1 - i / N), a.y); } ctx.stroke();
  ctx.fillStyle = '#f1c9a5'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
  for (const [hp, r] of [[lh, 21], [rh, 23]]) { ctx.beginPath(); ctx.arc(hp.x + shk, hp.y, r * s, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(hp.x + shk - 12 * s, hp.y - 14 * s, 8 * s, 14 * s, -0.5, 0, TAU); ctx.fill(); }
  const rc = Pt(0.27), rx = rc.x + 38 * s, ry = rc.y + 8 * s, ra = p.reelShow || 0;   // carrete: gira con tu dedo
  ctx.fillStyle = '#1b2430'; ctx.strokeStyle = '#6c7f95'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(rx, ry, 27 * s, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#8fa3b8'; ctx.lineWidth = 3 * s; for (let k = 0; k < 3; k++) { const a = ra + k * TAU / 3; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a) * 22 * s, ry + Math.sin(a) * 22 * s); ctx.stroke(); }
  ctx.strokeStyle = '#d9e2ec'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(ra) * 40 * s, ry + Math.sin(ra) * 40 * s); ctx.stroke();
  ctx.fillStyle = '#e6ff3d'; ctx.beginPath(); ctx.arc(rx + Math.cos(ra) * 40 * s, ry + Math.sin(ra) * 40 * s, 8 * s, 0, TAU); ctx.fill(); ctx.lineCap = 'butt';

  // ---- viñeta: el borde se pone rojo cuando el pez te gana, amarillo cuando pica ----
  const va = st === 'enrollar' ? clamp((p.losing || 0) * 0.55 + (p.burstNow ? 0.25 : 0)) : st === 'picada' ? (Math.floor(t / 130) % 2 ? 0.25 : 0.05) : 0;
  if (va > 0.01) { const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); g.addColorStop(0, 'rgba(230,57,70,0)'); g.addColorStop(1, st === 'picada' ? `rgba(255,220,60,${va})` : `rgba(230,57,70,${va})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

  {
    const [m1, m2, col] = mensaje(p, t), big = clamp(w / 14, 24, 54);
    if (m1) { txt(m1, w / 2, h * 0.15, big, col); if (m2) txt(m2, w / 2, h * 0.15 + big * 0.85, clamp(w / 34, 14, 22), '#e6f1fb', 'center', 600); }
    if (st === 'enrollar' || st === 'picada') { // barra de progreso del carrete
      const bw = w * 0.5, bx = w * 0.05, by = h - 62, pr = st === 'enrollar' ? p.prog : 0;
      ctx.fillStyle = 'rgba(5,20,40,.7)'; rrect(bx - 6, by - 6, bw + 12, 38, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; rrect(bx, by, bw, 26, 10); ctx.fill();
      if (pr > 0.01) { ctx.fillStyle = pr < 0.3 ? '#ff6b6b' : pr < 0.65 ? '#ffd166' : '#8ce99a'; rrect(bx, by, Math.max(20, bw * pr), 26, 10); ctx.fill(); }
      txt('🐟', bx + bw * pr, by + 14, 22);
      if (st === 'enrollar') { const need = (p.pullNow || 0.1) / REEL_GAIN; txt(`dedo ${p.rate.toFixed(1)} v/s · el pez tira ${need.toFixed(1)} v/s`, bx + bw / 2, by - 20, 14, p.rate > need ? '#8ce99a' : '#ff9e9e', 'center', 600); }
    }
    if (st === 'capturado' && el > 1.2) { // tarjeta con los datos de la captura
      const c = p.catchInfo, cw = Math.min(w * 0.5, 310), ch = 152, cx = w * 0.04, cy = h * 0.2;
      ctx.fillStyle = 'rgba(8,24,48,.88)'; rrect(cx, cy, cw, ch, 18); ctx.fill(); ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.stroke();
      txt('¡ATRAPASTE!', cx + cw / 2, cy + 26, 17, '#bde0fe'); txt(c.n, cx + cw / 2, cy + 58, clamp(cw / 10, 20, 32), '#fff');
      txt(`Peso: ${kg(c.w)}`, cx + cw / 2, cy + 94, 21, '#e6ff3d'); txt(`Largo: ${c.l} cm`, cx + cw / 2, cy + 122, 19, '#fff', 'center', 700);
    }
  }
  ctx.restore();
}


// =====================================================================
//  ESCENAS NUEVAS · cortar, cocinar, servir/decorar y final (primera persona)
//  Todas se dibujan dentro de una "cámara" (sceneBegin/sceneEnd) que se mueve con la acción.
// =====================================================================
const kg = v => v.toFixed(2).replace('.', ',') + ' kg';
function hexMix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); return `rgb(${lerp(pa >> 16, pb >> 16, t) | 0},${lerp((pa >> 8) & 255, (pb >> 8) & 255, t) | 0},${lerp(pa & 255, pb & 255, t) | 0})`; }
function sceneBegin(w, h, c) { ctx.save(); ctx.translate(w / 2 + c.sx, h / 2 + c.sy + c.y); ctx.rotate(c.roll); ctx.scale(c.zoom, c.zoom); ctx.translate(-w / 2, -h / 2); }
const sceneEnd = () => ctx.restore();
function smoothCam(p, y, zoom, roll, sx, sy) { const c = p.cam || (p.cam = { y: 0, zoom: 1 }), k = 1 - Math.exp(-frameDt * 9); c.y += (y - c.y) * k; c.zoom += (zoom - c.zoom) * k; return { y: c.y, zoom: c.zoom, roll, sx, sy }; }
function mensajeGrande(w, h, m1, m2, col) { const big = clamp(w / 14, 24, 54); if (m1) txt(m1, w / 2, h * 0.15, big, col); if (m2) txt(m2, w / 2, h * 0.15 + big * 0.85, clamp(w / 34, 14, 22), '#e6f1fb', 'center', 600); }
function drawHand(x, y, r, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#f1c9a5'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-r * 0.55, -r * 0.7, r * 0.36, r * 0.62, -0.5, 0, TAU); ctx.fill(); ctx.restore();
}
function sleeve(x1, y1, x2, y2, wd, col) { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineCap = 'butt'; }

// ---------- pescado plano (visto desde arriba, cabeza a la izquierda), entero o en 6 partes ----------
function fishBody(L, body, belly, cook, o) {
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-L * 0.5, 0); ctx.lineTo(-L * 0.74, -L * 0.17); ctx.lineTo(-L * 0.7, 0); ctx.lineTo(-L * 0.74, L * 0.17); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, L * 0.19, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.1, -L * 0.17); ctx.lineTo(L * 0.05, -L * 0.3); ctx.lineTo(L * 0.14, -L * 0.15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(L * 0.02, L * 0.07, L * 0.42, L * 0.1, 0, 0, Math.PI); ctx.fill();
  if (cook < 0.3 && o.eye !== false) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(L * 0.33, -L * 0.04, L * 0.045, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.34, -L * 0.04, L * 0.022, 0, TAU); ctx.fill(); }
  if (o.marks) { // marcas de cocción
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, L * 0.19, 0, 0, TAU); ctx.clip(); ctx.strokeStyle = 'rgba(70,35,12,.55)'; ctx.lineWidth = L * 0.022; ctx.lineCap = 'round';
    for (let i = -4; i <= 4; i++) { const x = i * L * 0.11; ctx.beginPath(); ctx.moveTo(x - L * 0.07, -L * 0.2); ctx.lineTo(x + L * 0.07, L * 0.2); ctx.stroke(); }
    ctx.restore();
  }
}
// o: { esp, n (partes), cuts (cortes hechos, puede ser decimal), gap (separación), cook 0..1, marks, flipY, shadow }
function fishFlat(x, y, L, o = {}) {
  const n = o.n || 1, cuts = o.cuts == null ? n - 1 : o.cuts, gap = o.gap || 0, esp = o.esp || ESPECIES[1], cook = o.cook || 0, fy = o.flipY == null ? 1 : o.flipY;
  const sw = 1.24 * L / n, body = hexMix(esp.c, '#b4792f', cook), belly = hexMix(esp.b, '#e7bf73', cook);
  ctx.save(); ctx.translate(x, y);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(-0.1 * L, L * 0.2, L * 0.66, L * 0.07, 0, 0, TAU); ctx.fill(); }
  ctx.scale(-1, fy);
  for (let j = 0; j < n; j++) {
    const off = gap * (Math.min(j, cuts) - cuts / 2), hi = 0.5 * L - j * sw, lo = hi - sw;  // rebanada j contada desde la cabeza (izquierda de la pantalla)
    ctx.save(); ctx.translate(-off, 0);
    const x0 = lo - (j === n - 1 ? L : 0), x1 = hi + (j === 0 ? L : 0); ctx.beginPath(); ctx.rect(x0, -L, x1 - x0, 2 * L); ctx.clip();
    fishBody(L, body, belly, cook, o); ctx.restore();
    if (j >= 1 && j <= cuts) { // cara del corte (clara y discreta)
      ctx.save(); ctx.translate(-off, 0); const xx = hi, hh = 2 * L * 0.19 * Math.sqrt(Math.max(0, 1 - Math.pow(xx / (0.5 * L), 2)));
      ctx.fillStyle = cook > 0.5 ? '#d8b27a' : '#f6e7d2'; ctx.fillRect(xx - 1.5, -hh / 2, 3, hh); ctx.restore();
    }
  }
  ctx.restore();
}

// ---------- ESCENA · CORTAR ----------
function corteGeom(w, h) { const L = w * 0.78 / 1.24, cx = w / 2 - 0.12 * L, cy = h * 0.56; return { L, cx, cy, left: cx - 0.5 * L, sw: 1.24 * L / 6, top: cy - 0.19 * L, bot: cy + 0.19 * L }; }
function knifePose(p, t, w, h, s) {
  const g = corteGeom(w, h), rest = { x: w * 0.8, y: h * 0.58 + Math.sin(t / 900) * 3 * s, rot: 0.75, imp: 0, wt: 0 }, a = p.cutAnim;
  if (!a || p.step !== 'corte') return rest;
  const u = (t - a.t0) / 600; if (u >= 1) return rest;
  const bl = 175 * s, cutX = g.left + a.k * g.sw, up = { x: cutX, y: g.top - 50 * s - bl }, dn = { x: cutX, y: g.bot + 30 * s - bl };
  let pose;
  if (u < 0.3) { const e = ease(u / 0.3); pose = { x: lerp(rest.x, up.x, e), y: lerp(rest.y, up.y, e), rot: lerp(rest.rot, 0, e) }; }           // levanta el cuchillo sobre el corte
  else if (u < 0.52) { const e = ease((u - 0.3) / 0.22); pose = { x: up.x, y: lerp(up.y, dn.y, e * e), rot: 0 }; }                            // baja de golpe
  else { const e = ease((u - 0.52) / 0.48); pose = { x: lerp(dn.x, rest.x, e), y: lerp(dn.y, rest.y, e), rot: lerp(0, rest.rot, e) }; }      // vuelve a su lugar
  pose.imp = u >= 0.5 && u < 0.72 ? Math.sin((u - 0.5) / 0.22 * Math.PI) : 0; pose.wt = Math.sin(u * Math.PI);
  return pose;
}
function drawKnife(x, y, rot, s, w, h, col) {
  const bl = 175 * s, bw = 34 * s, hl = 95 * s, a = hl * 0.55, hx = x + Math.sin(rot) * a, hy = y - Math.cos(rot) * a;
  sleeve(w * 1.12, h * 1.2, hx + 6 * s, hy + 10 * s, 52 * s, col);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#3a2a1f'; rrect(-bw * 0.34, -hl, bw * 0.68, hl, 8 * s); ctx.fill(); ctx.fillStyle = '#c9a15a'; for (const k of [0.25, 0.6]) { ctx.beginPath(); ctx.arc(0, -hl * k, 3 * s, 0, TAU); ctx.fill(); }
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.5, '#c9d3dc'); g.addColorStop(1, '#8c9eb0'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0); ctx.lineTo(bw / 2, bl * 0.7); ctx.quadraticCurveTo(bw / 2, bl * 0.98, -bw * 0.15, bl); ctx.quadraticCurveTo(-bw / 2, bl * 0.8, -bw / 2, bl * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  drawHand(hx, hy, 24 * s, rot);
}
function drawCorte(p, w, h, t, s) {
  const g = corteGeom(w, h), st = p.state, el = (t - p.t0) / 1000, kp = knifePose(p, t, w, h, s), fi = p.fishInfo || { esp: ESPECIES[1] };
  let y = 0, zoom = 1.02, roll = 0, sx = 0, sy = 0;
  if (st === 'intro') { const e = ease(el / 1.0); y = lerp(-h * 0.14, 0, e); zoom = lerp(1.14, 1.02, e); }
  else if (st === 'cortar') { sx = -(kp.x - w / 2) * 0.08 * kp.wt; y = -h * 0.03 * kp.imp; zoom = 1.02 + 0.04 * kp.imp; roll = ((p.cutAnim ? p.cutAnim.k : 0) % 2 ? 1 : -1) * 0.012 * kp.imp; sy = Math.sin(t / 37) * 3 * kp.imp; }
  else if (st === 'listo') { zoom = lerp(1.02, 0.99, ease(el / 1.2)); }
  const cam = smoothCam(p, y, zoom, roll, sx, sy);
  sceneBegin(w, h, cam);
  // pared de azulejos y mesón
  let gr = ctx.createLinearGradient(0, -h, 0, h * 0.22); gr.addColorStop(0, '#c9d3d8'); gr.addColorStop(1, '#e6ecee'); ctx.fillStyle = gr; ctx.fillRect(-w, -2 * h, 3 * w, 2.22 * h);
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2; for (let x = -w; x < 2 * w; x += 52 * s) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h * 0.22); ctx.stroke(); } for (let yy = h * 0.22; yy > -h; yy -= 52 * s) { ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(2 * w, yy); ctx.stroke(); }
  gr = ctx.createLinearGradient(0, h * 0.2, 0, h * 1.5); gr.addColorStop(0, '#4a3b32'); gr.addColorStop(1, '#1d1713'); ctx.fillStyle = gr; ctx.fillRect(-w, h * 0.22, 3 * w, 3 * h);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w, h * 0.22, 3 * w, 3 * s);
  // tabla de madera, horizontal
  const th = 16 * s, pts = [[w * 0.06, h * 0.25], [w * 0.94, h * 0.25], [w * 1.1, h * 0.95], [-w * 0.1, h * 0.95]];
  ctx.fillStyle = '#9b6a36'; ctx.beginPath(); pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy + th) : ctx.moveTo(x, yy + th))); ctx.closePath(); ctx.fill();
  gr = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.95); gr.addColorStop(0, '#e6b97a'); gr.addColorStop(1, '#c48c50'); ctx.fillStyle = gr; ctx.beginPath(); pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(110,65,25,.16)'; ctx.lineWidth = 2 * s; for (let i = 1; i < 12; i++) { const k = i / 12, yy = lerp(h * 0.25, h * 0.95, k), x0 = lerp(w * 0.06, -w * 0.1, k), x1 = lerp(w * 0.94, w * 1.1, k); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo(w / 2, yy + Math.sin(i * 2.1) * 10 * s, x1, yy); ctx.stroke(); }
  // el pescado
  const shown = p.cutAnim && (t - p.cutAnim.t0) / 600 < 0.5 ? p.cuts - 1 : p.cuts;
  p.cutsV = lerp(p.cutsV == null ? 0 : p.cutsV, shown, clamp(frameDt * 14));
  fishFlat(g.cx, g.cy, g.L, { esp: fi.esp, n: 6, cuts: p.cutsV, gap: 0.03 * g.L });
  // cuchillo y mano
  drawKnife(kp.x, kp.y, kp.rot, s, w, h, p.color);
  sceneEnd();
  if (st !== 'listo') mensajeGrande(w, h, `¡Deben ser ${CORTES} cortes!`, `Traza líneas con el dedo en tu teléfono · Cortes: ${p.cuts}/${CORTES}`, '#fff');
  else mensajeGrande(w, h, '¡Listo! 6 porciones', '', '#8ce99a');
  for (let i = 0; i < CORTES; i++) { ctx.fillStyle = i < p.cuts ? '#e6ff3d' : 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(w / 2 + (i - 2) * 30 * s, h * 0.15 + clamp(w / 14, 24, 54) * 1.75, 9 * s, 0, TAU); ctx.fill(); }
}

// ---------- ESCENA · COCINAR ----------
function tongue(px, py, fl, wd, t, i) {
  const g = ctx.createLinearGradient(0, py, 0, py - fl); g.addColorStop(0, 'rgba(255,235,130,.95)'); g.addColorStop(0.5, 'rgba(255,140,30,.85)'); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(px - wd, py); ctx.quadraticCurveTo(px - wd * 0.6, py - fl * 0.5, px + Math.sin(t / 70 + i) * wd * 0.4, py - fl); ctx.quadraticCurveTo(px + wd * 0.6, py - fl * 0.5, px + wd, py); ctx.closePath(); ctx.fill();
}
function drawCocina(p, w, h, t, s) {
  const st = p.state, el = (t - p.t0) / 1000, fi = p.fishInfo || { esp: ESPECIES[1] }, pan = p.pan || { x: 0, y: 0 };
  const fu = st === 'volteo' ? el / 0.9 : 0;
  let y = 0, zoom = 1.0, roll = 0, sx = 0, sy = 0;
  if (st === 'intro') { const e = ease(el / 1.1); y = lerp(h * 0.12, 0, e); zoom = lerp(1.12, 1.0, e); }
  else if (st === 'cocinando') { sx = -pan.x * 4 * s; sy = -pan.y * 3 * s; roll = Math.sin(t / 700) * 0.003 + pan.x * 0.004; }
  else if (st === 'prompt') { sx = Math.sin(t / 45) * 2.5; zoom = 1.02; roll = Math.sin(t / 60) * 0.004; }
  else if (st === 'volteo') { y = h * 0.09 * Math.sin(Math.PI * fu); zoom = 1 + 0.045 * Math.sin(Math.PI * fu); roll = Math.sin(Math.PI * fu) * 0.012; }
  else if (st === 'listo') { zoom = lerp(1.0, 1.05, ease(el / 1.0)); y = h * 0.02; }
  const cam = smoothCam(p, y, zoom, roll, sx, sy);
  sceneBegin(w, h, cam);
  let gr = ctx.createLinearGradient(0, -h, 0, h * 1.4); gr.addColorStop(0, '#2c3037'); gr.addColorStop(1, '#14171b'); ctx.fillStyle = gr; ctx.fillRect(-w, -2 * h, 3 * w, 4 * h);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 2; for (let x = -w; x < 2 * w; x += 70 * s) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x + 120 * s, 2 * h); ctx.stroke(); }
  const bx = w * 0.46, by = h * 0.5, rx = 0.34 * w, ry = 0.255 * w, wall = 0.05 * w, px = bx + pan.x * 10 * s, py = by + pan.y * 7 * s;
  ctx.strokeStyle = '#3b4048'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.ellipse(bx, by + wall, rx * 0.9, ry * 0.9, 0, 0, TAU); ctx.stroke();                 // hornilla
  ctx.strokeStyle = '#1e2126'; ctx.lineWidth = 12 * s; ctx.beginPath(); ctx.moveTo(bx - rx * 1.2, by + wall); ctx.lineTo(bx + rx * 1.2, by + wall); ctx.moveTo(bx, by - ry * 1.1); ctx.lineTo(bx, by + ry * 1.3); ctx.stroke();
  // mango hacia la mano
  const hand = { x: w * 0.9, y: h * 0.88 }, hs = { x: px + rx * Math.cos(0.6), y: py + wall + ry * Math.sin(0.6) };
  ctx.lineCap = 'round'; ctx.strokeStyle = '#0c0d0f'; ctx.lineWidth = 30 * s; ctx.beginPath(); ctx.moveTo(hs.x, hs.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(hs.x, hs.y - 8 * s); ctx.lineTo(hand.x, hand.y - 8 * s); ctx.stroke(); ctx.lineCap = 'butt';
  // sartén negra
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px + 10 * s, py + wall + 16 * s, rx * 1.02, ry * 1.02, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#08090b'; ctx.beginPath(); ctx.ellipse(px, py + wall, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillRect(px - rx, py, 2 * rx, wall); ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, TAU); ctx.fillStyle = '#17191d'; ctx.fill();
  gr = ctx.createRadialGradient(px - rx * 0.25, py - ry * 0.3, 0, px, py, rx * 0.95); gr.addColorStop(0, '#2d3138'); gr.addColorStop(1, '#14161a'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(px, py, rx * 0.92, ry * 0.9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(px, py, rx * 0.97, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.6); ctx.stroke();
  // pescado (se ve la cara que está arriba)
  const topCook = st === 'listo' ? 1 : st === 'volteo' ? (fu < 0.5 ? p.cook[1 - p.side] : p.cook[p.side]) : p.cook[1 - p.side];
  const Lf = 0.34 * w, jump = st === 'volteo' ? Math.sin(Math.PI * fu) : 0;
  ctx.save(); ctx.translate(px, py + 0.01 * h - jump * 0.28 * h); ctx.scale(1, 0.85); ctx.rotate(jump * 0.12 * (p.side ? -1 : 1));
  fishFlat(0, 0, Lf * (1 + 0.2 * jump), { esp: fi.esp, n: 6, cuts: 5, gap: 0.014 * Lf, cook: topCook, marks: topCook > 0.7, flipY: st === 'volteo' ? Math.cos(Math.PI * fu) : 1, shadow: false, eye: false });
  ctx.restore();
  if (jump > 0.02) { ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - jump)})`; ctx.beginPath(); ctx.ellipse(px, py + 0.04 * h, Lf * 0.55, Lf * 0.1, 0, 0, TAU); ctx.fill(); }
  if (p.fireA > 0.3 && st !== 'intro') { // burbujas de aceite y vapor
    for (let i = 0; i < 7; i++) { const a = t / 300 + i * 2.1, bxp = px + Math.cos(a * 1.3) * rx * 0.55, byp = py + Math.sin(a * 1.1) * ry * 0.5; ctx.fillStyle = `rgba(255,255,255,${0.35 * p.fireA * (0.5 + 0.5 * Math.sin(t / 120 + i))})`; ctx.beginPath(); ctx.arc(bxp, byp, (2 + (i % 3)) * s, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 3; i++) { const u = ((t / 1800) + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.14 * (1 - u) * p.fireA})`; ctx.beginPath(); ctx.ellipse(px + (i - 1) * rx * 0.3 + Math.sin(u * 6 + i) * 10 * s, py - u * h * 0.22, (24 + u * 30) * s, (14 + u * 18) * s, 0, 0, TAU); ctx.fill(); }
  }
  // el fuego: solo se ve al mover la sartén
  const amt = p.fireA;
  if (amt > 0.03) {
    const gl = ctx.createRadialGradient(bx, by + wall + ry * 0.9, 0, bx, by + wall + ry * 0.9, rx * 1.3); gl.addColorStop(0, `rgba(255,150,40,${0.5 * amt})`); gl.addColorStop(1, 'rgba(255,100,20,0)'); ctx.fillStyle = gl; ctx.fillRect(bx - rx * 1.6, by - ry, rx * 3.2, ry * 3.4);
    const N = 22; for (let i = 0; i < N; i++) { const a = lerp(0.12, Math.PI - 0.12, i / (N - 1)), fl = (0.55 + 0.45 * Math.sin(t / 90 + i * 1.7)) * (0.045 + 0.03 * Math.abs(Math.sin(i * 2.3))) * w * amt; tongue(px + Math.cos(a) * rx * 0.97, py + wall + Math.sin(a) * ry * 0.97, fl, 0.03 * w, t, i); }
  }
  // tu mano en el mango
  sleeve(w * 1.12, h * 1.2, hand.x + 10 * s, hand.y + 12 * s, 56 * s, p.color); drawHand(hand.x, hand.y, 25 * s, -0.3);
  sceneEnd();
  if (st === 'prompt') mensajeGrande(w, h, Math.floor(t / 150) % 2 ? '¡VOLTEA EL PESCADO!' : '¡¡VOLTEA!!', 'Sube el teléfono rápido, como voltear en una sartén', '#ffd23f');
  else if (st === 'listo') mensajeGrande(w, h, '¡Ya está listo!', 'Pescado cocinado', '#8ce99a');
  else if (st !== 'volteo') mensajeGrande(w, h, 'Cocinando…', `Mueve la sartén (el teléfono) · Vueltas: ${p.flips}/${VOLTEOS}`, '#fff');
  if (st === 'prompt') { const g2 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); g2.addColorStop(0, 'rgba(255,210,63,0)'); g2.addColorStop(1, `rgba(255,210,63,${Math.floor(t / 150) % 2 ? 0.28 : 0.08})`); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h); }
  for (let i = 0; i < VOLTEOS; i++) { ctx.fillStyle = i < p.flips ? '#e6ff3d' : 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(w / 2 + (i - 2) * 30 * s, h * 0.15 + clamp(w / 14, 24, 54) * 1.75, 9 * s, 0, TAU); ctx.fill(); }
}

// ---------- ESCENA · SERVIR Y DECORAR ----------
const platoMap = (w, h) => { const aw = w * 0.88, ah = aw * 0.75, ax = w * 0.06, ay = (h - ah) / 2 + h * 0.03; return { aw, ah, X: l => ax + l * aw, Y: l => ay + l * ah, R: PLATE.r * aw }; };
// cómo queda cada cosa en el plato, sin importar dónde la sueltes (posiciones relativas al radio R)
const CANON = {
  lechuga: [{ x: -0.3, y: -0.34, r: -0.55, s: 0.58 }, { x: 0.14, y: -0.41, r: 0.35, s: 0.52 }],
  tomate: [{ x: 0.44, y: 0.33 }, { x: 0.2, y: 0.47 }, { x: 0.6, y: 0.12 }],
  papas: [{ x: -0.5, y: 0.3 }],
  perejil: [{ x: 0.2, y: -0.04, r: 0.6 }],
};
function sliceTomato(x, y, r) {
  ctx.fillStyle = '#d63a2c'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#ee6b57'; ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f6c9a8'; for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.2, r * 0.12, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#f8d8c3'; ctx.beginPath(); ctx.arc(x, y, r * 0.1, 0, TAU); ctx.fill();
}
function leaf(x, y, len, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#6fbf4a'; ctx.strokeStyle = '#4f9a35'; ctx.lineWidth = len * 0.025;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); for (let i = 0; i <= 8; i++) { const u = i / 8, xx = lerp(-len / 2, len / 2, u), hh = Math.sin(u * Math.PI) * len * 0.3 * (1 + 0.18 * Math.sin(u * 17)); ctx.lineTo(xx, -hh); } for (let i = 8; i >= 0; i--) { const u = i / 8, xx = lerp(-len / 2, len / 2, u), hh = Math.sin(u * Math.PI) * len * 0.3 * (1 + 0.18 * Math.sin(u * 17 + 2)); ctx.lineTo(xx, hh); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#b6e28f'; ctx.lineWidth = len * 0.03; ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.lineTo(len * 0.45, 0); ctx.stroke(); ctx.restore();
}
function fries(x, y, len) {
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const a = (i - 4.5) * 0.17 + Math.sin(i * 3.1) * 0.08, ox = (i - 4.5) * len * 0.07, oy = Math.sin(i * 2.3) * len * 0.1; ctx.strokeStyle = i % 2 ? '#f2c84b' : '#e9b93a'; ctx.lineWidth = len * 0.11; ctx.beginPath(); ctx.moveTo(ox - Math.sin(a) * len * 0.4, oy + Math.cos(a) * len * 0.4); ctx.lineTo(ox + Math.sin(a) * len * 0.4, oy - Math.cos(a) * len * 0.4); ctx.stroke(); }
  ctx.restore();
}
function jug(x, y, sc) { // jarro pequeño con salsa café claro
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#f4f1ea'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-sc * 0.3, -sc * 0.3); ctx.quadraticCurveTo(-sc * 0.42, sc * 0.1, -sc * 0.22, sc * 0.35); ctx.lineTo(sc * 0.22, sc * 0.35); ctx.quadraticCurveTo(sc * 0.42, sc * 0.1, sc * 0.3, -sc * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-sc * 0.3, -sc * 0.3); ctx.lineTo(-sc * 0.46, -sc * 0.42); ctx.lineTo(-sc * 0.24, -sc * 0.3); ctx.fill(); ctx.stroke();
  ctx.lineWidth = sc * 0.07; ctx.beginPath(); ctx.arc(sc * 0.36, -sc * 0.02, sc * 0.17, -1.2, 1.2); ctx.stroke();
  ctx.fillStyle = '#b98a5a'; ctx.beginPath(); ctx.ellipse(0, -sc * 0.3, sc * 0.3, sc * 0.07, 0, 0, TAU); ctx.fill(); ctx.restore();
}
function parsley(x, y, len, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#2f8a3a'; ctx.lineWidth = len * 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.quadraticCurveTo(0, -len * 0.12, len * 0.35, 0); ctx.stroke();
  for (const [ux, uy, a] of [[0.38, 0, 0], [0.12, -0.05, -0.9], [-0.14, -0.06, 0.8]]) for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#2e9a3d' : '#3fb04e'; ctx.beginPath(); ctx.ellipse(len * ux + Math.cos(a + k * 2.1) * len * 0.1, len * uy + Math.sin(a + k * 2.1) * len * 0.1, len * 0.11, len * 0.06, a + k * 2.1, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function rowItem(k, x, y, sc) { // cómo se ve cada cosa antes de ponerla (en la fila de arriba)
  if (k === 'tomate') { sliceTomato(x - sc * 0.2, y + sc * 0.08, sc * 0.26); sliceTomato(x + sc * 0.18, y + sc * 0.12, sc * 0.26); sliceTomato(x, y - sc * 0.14, sc * 0.26); }
  else if (k === 'lechuga') { leaf(x - sc * 0.05, y + sc * 0.05, sc * 0.95, -0.35); leaf(x + sc * 0.08, y - sc * 0.08, sc * 0.85, 0.3); }
  else if (k === 'papas') fries(x, y, sc * 0.95);
  else if (k === 'salsa') jug(x, y, sc * 0.95);
  else if (k === 'perejil') parsley(x, y, sc * 0.95, 0.4);
}
function drawPlateBase(cx, cy, R) {
  const sh = ctx.createRadialGradient(cx + 0.05 * R, cy + 0.1 * R, R * 0.6, cx + 0.05 * R, cy + 0.1 * R, R * 1.12); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx + 0.05 * R, cy + 0.1 * R, R * 1.12, 0, TAU); ctx.fill();
  let g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3e7ea'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fbfcfc'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.76, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 3; ctx.stroke();
}
// el plato con lo que ya está puesto, siempre en la misma composición. cx, cy, R: dónde y de qué tamaño se dibuja
function drawPlated(p, cx, cy, R, t, m) {
  drawPlateBase(cx, cy, R);
  const fi = p.fishInfo || { esp: ESPECIES[1] };
  const anim = it => ({ e: ease((t - it.placeT0) / 350), dx: m.X(it.dx == null ? PLATE.x : it.dx), dy: m.Y(it.dy == null ? PLATE.y : it.dy) });
  const at = (it, c, i) => { const a = anim(it), tx = cx + c.x * R, ty = cy + c.y * R; return { x: lerp(a.dx, tx, a.e), y: lerp(a.dy, ty, a.e), k: lerp(1.15, 1, a.e) }; };
  for (const k of ['lechuga', 'tomate', 'papas']) { // debajo del pescado
    const it = p.items.find(i => i.k === k); if (!it || !it.done) continue;
    CANON[k].forEach((c, i) => { const q = at(it, c, i); if (k === 'lechuga') leaf(q.x, q.y, R * c.s * q.k, c.r); else if (k === 'tomate') sliceTomato(q.x, q.y, R * 0.17 * q.k); else fries(q.x, q.y, R * 0.52 * q.k); });
  }
  const pez = p.items.find(i => i.k === 'pez');
  if (pez && pez.done) { const q = at(pez, { x: 0, y: 0 }, 0); fishFlat(q.x, q.y, R * 1.17 * q.k, { esp: fi.esp, n: 6, cuts: 5, gap: 0.012 * R * 1.17, cook: 1, marks: true, shadow: false, eye: false }); }
  const sal = p.items.find(i => i.k === 'salsa');
  if (sal && sal.done) { // la salsa cae en líneas sobre el pescado
    const q = clamp((t - sal.pourT0) / 1000); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const qi = clamp(q * 4 - i); if (qi <= 0) continue; const x0 = cx + (-0.45 + i * 0.3) * R;
      for (const [col, wd] of [['#b98a5a', 0.038], ['#d3a875', 0.015]]) { ctx.strokeStyle = col; ctx.lineWidth = R * wd; ctx.beginPath(); for (let s = 0; s <= qi + 1e-6; s += 0.1) { const u = Math.min(s, qi), x = x0 + 0.22 * R * u + Math.sin(u * 6 + i) * 0.03 * R, yy = cy - 0.22 * R + 0.44 * R * u; s ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    }
    ctx.lineCap = 'butt';
  }
  const per = p.items.find(i => i.k === 'perejil');
  if (per && per.done) { const c = CANON.perejil[0], qq = at(per, c, 0); parsley(qq.x, qq.y, R * 0.42 * qq.k, c.r); }
}
function drawPlato(p, w, h, t, s) {
  const st = p.state, el = (t - p.t0) / 1000, m = platoMap(w, h), R = m.R, cx = m.X(PLATE.x), cy = m.Y(PLATE.y), fi = p.fishInfo || { esp: ESPECIES[1] };
  const d = p.drag; let y = 0, zoom = 1, sx = 0, sy = 0, roll = 0;
  if (st === 'intro') { const e = ease(el / 1.0); y = lerp(-h * 0.12, 0, e); zoom = lerp(1.12, 1, e); }
  else if (st === 'jugando') { if (d) { sx = -(d.x - 0.5) * w * 0.06; sy = -(d.y - 0.5) * h * 0.04; zoom = 1.02; } zoom += 0.03 * Math.max(0, 1 - (t - (p.bump || 0)) / 400); }
  else if (st === 'listo') { zoom = lerp(1, 1.05, ease(el / 1.2)); y = h * 0.02; }
  const cam = smoothCam(p, y, zoom, roll, sx, sy);
  sceneBegin(w, h, cam);
  let gr = ctx.createLinearGradient(0, -h * 0.5, 0, h * 1.3); gr.addColorStop(0, '#c99660'); gr.addColorStop(1, '#8a5a2f'); ctx.fillStyle = gr; ctx.fillRect(-w, -2 * h, 3 * w, 4 * h);
  ctx.strokeStyle = 'rgba(70,40,15,.25)'; ctx.lineWidth = 3 * s; for (let x = -w; x < 2 * w; x += 120 * s) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, 2 * h); ctx.stroke(); }
  drawPlated(p, cx, cy, R, t, m);
  // lo que todavía no está puesto: fila de arriba o en la mano
  let hp = null;
  for (const it of p.items) {
    if (it.done || !it.spawned) continue;
    const drag = d && d.it === it, tgx = m.X(drag ? d.x : it.hx), tgy = m.Y(drag ? d.y : it.hy);
    if (it.vx == null) { it.vx = tgx; it.vy = tgy; } const k = 1 - Math.exp(-frameDt * (drag ? 24 : 12)); it.vx += (tgx - it.vx) * k; it.vy += (tgy - it.vy) * k;
    const pop = it.spawnT0 ? ease((t - it.spawnT0) / 300) : 1; if (pop <= 0) continue;
    const lift = drag ? 1.15 : 1; if (drag) hp = { x: it.vx, y: it.vy };
    ctx.save(); ctx.globalAlpha = pop; ctx.translate(it.vx, it.vy - (drag ? 8 * s : 0)); ctx.scale(pop * lift, pop * lift);
    if (drag) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(8 * s, 24 * s, R * 0.4, R * 0.1, 0, 0, TAU); ctx.fill(); }
    if (it.k === 'pez') fishFlat(0, 0, R * 1.17, { esp: fi.esp, n: 6, cuts: 5, gap: 0.012 * R * 1.17, cook: 1, marks: true, shadow: false, eye: false });
    else rowItem(it.k, 0, 0, R * 0.5);
    ctx.restore();
  }
  // tu mano: sigue a lo que arrastras
  const rest = { x: w * 0.82, y: h * 0.93 + Math.sin(t / 700) * 3 * s }, hx = hp ? hp.x + R * 0.12 : rest.x, hy = hp ? hp.y + R * 0.16 : rest.y;
  p.hx = lerp(p.hx == null ? rest.x : p.hx, hx, clamp(frameDt * 18)); p.hy = lerp(p.hy == null ? rest.y : p.hy, hy, clamp(frameDt * 18));
  sleeve(w * 1.12, h * 1.25, p.hx + 8 * s, p.hy + 12 * s, 56 * s, p.color); drawHand(p.hx, p.hy, hp ? 26 * s : 24 * s, hp ? -0.5 : -0.2);
  sceneEnd();
  const hechos = p.items.filter(i => i.k !== 'pez' && i.done).length;
  if (st === 'listo') mensajeGrande(w, h, '¡Plato listo!', '', '#8ce99a');
  else if (p.fase === 'servir') mensajeGrande(w, h, 'Sirve el pescado', 'Arrástralo con el dedo hasta el plato', '#fff');
  else mensajeGrande(w, h, 'Decora el plato', `Pon los 5 extras en el plato · ${hechos}/5`, '#fff');
}

// ---------- ESCENA · FINAL: el plato servido en alto ----------
function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
function drawFin(p, w, h, t, s) {
  const el = (t - p.t0) / 1000, gano = p.res === 'gano', m = platoMap(w, h), up = ease(el / 1.3);
  const cam = smoothCam(p, lerp(h * 0.16, 0, up), lerp(1.07, 1, up), Math.sin(el * 1.6) * 0.004, 0, 0);
  sceneBegin(w, h, cam);
  let gr = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, Math.max(w, h) * 0.8); gr.addColorStop(0, gano ? '#fff3c8' : '#f3e3d0'); gr.addColorStop(1, gano ? '#d98a3a' : '#7a5a4a'); ctx.fillStyle = gr; ctx.fillRect(-w, -2 * h, 3 * w, 4 * h);
  ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.rotate(t / 6000); ctx.fillStyle = `rgba(255,255,255,${gano ? 0.13 : 0.06})`; for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 1.2, -w * 0.07); ctx.lineTo(w * 1.2, w * 0.07); ctx.closePath(); ctx.fill(); } ctx.restore();
  const cx = w / 2, cy = lerp(h * 1.0, h * 0.5, up) + Math.sin(t / 500) * 5 * s, R = lerp(0.24, 0.34, up) * w;
  for (const sd of [-1, 1]) { sleeve(w / 2 + sd * w * 0.62, h * 1.25, cx + sd * R * 0.62, cy + R * 0.8, 54 * s, p.color); drawHand(cx + sd * R * 0.62, cy + R * 0.8, 26 * s, sd * 0.4); }
  drawPlated(p, cx, cy, R, t, m);
  for (let i = 0; i < 12; i++) { const a = i * 0.9 + t / 1200, rr = R * (1.1 + 0.25 * Math.sin(i * 1.7)), pulse = 0.5 + 0.5 * Math.sin(t / 220 + i); ctx.fillStyle = `rgba(255,255,255,${(gano ? 0.9 : 0.4) * pulse})`; star(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, (6 + (i % 3) * 3) * s); }
  sceneEnd();
  if (el > 0.9) { // anuncio
    const pop = ease((el - 0.9) / 0.35), size = clamp(w / 6.2, 40, 110) * (0.6 + 0.4 * pop);
    ctx.globalAlpha = pop; txt(gano ? 'GANASTE' : 'PERDISTE', w / 2, h * 0.17, size, gano ? '#2ee86a' : '#ff3b3b', 'center', 900);
    txt(`Tiempo: ${fmtT(p.tFin)}`, w / 2, h * 0.17 + size * 0.75, clamp(w / 28, 16, 26), '#fff', 'center', 700);
    const otro = players.find(q => q !== p);
    if (gano && otro.step !== 'fin') txt('Esperando a que tu rival termine…', w / 2, h * 0.93, clamp(w / 30, 15, 24), '#fff', 'center', 700);
    else if (!gano) txt('Tu rival terminó primero', w / 2, h * 0.93, clamp(w / 30, 15, 24), '#fff', 'center', 700);
    ctx.globalAlpha = 1;
  }
}

// ---------- cabecera común: jugador, conexión y pasos ----------
const ICONOS = ['🎣', '🔪', '🍳', '🍽️', '✨'];
const stepIdx = p => ({ pesca: 0, corte: 1, cocina: 2, plato: p.fase === 'decorar' ? 4 : 3, fin: 5 })[p.step] ?? 0;
function drawHud(p, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 78); g.addColorStop(0, 'rgba(5,20,40,.7)'); g.addColorStop(1, 'rgba(5,20,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, 78);
  const nx = p.slot === 2 ? 96 : 26; // en la mitad derecha, el nombre deja sitio al cronómetro del centro
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(nx, 28, 9, 0, TAU); ctx.fill();
  txt(p.name, nx + 18, 28, 24, '#fff', 'left'); txt(online(p) ? '📱 conectado' : p.kb ? '⌨ teclado' : '⚠ sin teléfono', nx + 18, 54, 14, online(p) || p.kb ? '#bde0fe' : '#ffb74d', 'left', 600);
  const idx = stepIdx(p), right = p.slot === 1 ? w - 96 : w - 16;
  for (let i = 0; i < 5; i++) {
    const x = right - (4 - i) * 36 - 14, done = i < idx;
    ctx.fillStyle = done ? '#2e7d32' : i === idx ? p.color : 'rgba(5,20,40,.55)'; ctx.beginPath(); ctx.arc(x, 30, 15, 0, TAU); ctx.fill();
    if (i === idx) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.font = font(15, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = i > idx ? 0.5 : 1; ctx.fillStyle = '#fff'; ctx.fillText(done ? '✓' : ICONOS[i], x, 31); ctx.globalAlpha = 1;
  }
  txt(PASOS[Math.min(idx, 4)], right - 4 * 36 / 2 - 14, 58, 13, '#bde0fe', 'center', 700);
  if (firstFinisher && firstFinisher !== p && p.step !== 'fin') { // el rival ya terminó
    ctx.fillStyle = 'rgba(200,40,40,.85)'; rrect(w / 2 - 110, h - 52, 220, 34, 17); ctx.fill(); txt('¡Tu rival ya terminó!', w / 2, h - 35, 16, '#fff');
  }
}

function drawHalf(p, x0, w, h, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w, h); ctx.clip(); ctx.translate(x0, 0);
  const s = clamp(Math.min(w / 620, h / 560), 0.55, 1.5);
  switch (p.step) {
    case 'corte': drawCorte(p, w, h, t, s); break;
    case 'cocina': drawCocina(p, w, h, t, s); break;
    case 'plato': drawPlato(p, w, h, t, s); break;
    case 'fin': drawFin(p, w, h, t, s); break;
    default: drawPesca(p, w, h, t);
  }
  if (p.step !== 'lobby') drawHud(p, w, h, t);
  ctx.restore();
}

let last = now();
(function loop(t) {
  const dt = clamp((t - last) / 1000, 0.001, 0.05); last = t; frameDt = dt;
  updateGame(dt, t);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  drawHalf(players[0], 0, W2, H, t); drawHalf(players[1], W2, W2, H, t);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(W2 - 1.5, 0, 3, H);
  if (phase !== 'lobby') { const ms = phase === 'final' ? Math.max(players[0].tFin, players[1].tFin) : now() - gameT0; ctx.fillStyle = 'rgba(5,20,40,.75)'; rrect(W2 - 70, 8, 140, 40, 20); ctx.fill(); txt('⏱ ' + fmtT(ms), W2, 29, 20, '#fff'); }
  requestAnimationFrame(loop);
})(now());

window.__pesca = { players, tacto, get phase() { return phase; }, startStep, jumpAll, ESPECIES };
