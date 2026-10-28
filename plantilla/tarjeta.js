// Comportamiento de la tarjeta: abrir/cerrar, velas, confeti, vibración y canción.
// Los textos de cada persona llegan en window.TARJETA desde datos.js, que
// preparar-sitio.ps1 genera a partir de personas/<persona>.json.

const TARJETA = window.TARJETA;
if (!TARJETA) {
  throw new Error("Falta datos.js: genera el sitio con preparar-sitio.ps1 <persona>.");
}

const $ = (id) => document.getElementById(id);
const card = $("card");
const cover = $("cover");
const actions = $("actions");
const blowAllBtn = $("blowAll");
const wish = $("wish");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Contenido (textContent: el texto nunca se interpreta como HTML)
$("coverTo").textContent = "para " + TARJETA.nombre;
$("greeting").textContent = TARJETA.saludo;
$("signature").textContent = TARJETA.firma;
for (const parrafo of TARJETA.mensaje) {
  const p = document.createElement("p");
  p.textContent = parrafo;
  $("body").appendChild(p);
}

// Velas
const candlesEl = $("candles");
function buildCandles() {
  candlesEl.textContent = "";
  for (let i = 0; i < TARJETA.velas; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "candle";
    c.setAttribute("aria-label", "Apagar vela " + (i + 1));
    const smoke = document.createElement("span");
    smoke.className = "smoke";
    c.appendChild(smoke);
    c.addEventListener("click", () => blowOut(c));
    candlesEl.appendChild(c);
  }
  wish.textContent = "Toca cada vela para apagarla.";
  wish.classList.remove("done");
  blowAllBtn.disabled = false;
}

function blowOut(candle) {
  if (candle.classList.contains("out")) return;
  candle.classList.add("out");
  candle.setAttribute("aria-label", "Vela apagada");
  const left = candlesEl.querySelectorAll(".candle:not(.out)").length;
  if (left === 0) {
    wish.textContent = "¡Que se cumpla tu deseo!";
    wish.classList.add("done");
    launchConfetti();
    vibrate();
    actions.hidden = true; // ya no quedan velas: "Soplar todas" desaparece
  } else {
    wish.textContent = left === 1 ? "Queda 1 vela." : "Quedan " + left + " velas.";
  }
}

// Vibración al saltar el confeti, solo en pantallas táctiles (celulares).
// Android la admite; Safari en iPhone no tiene esta API y simplemente no vibra.
function vibrate() {
  if (!("vibrate" in navigator) || !window.matchMedia("(pointer: coarse)").matches) return;
  try {
    navigator.vibrate([90, 50, 140]); // vibra, pausa, vibra
  } catch (e) {
    // algunos navegadores o marcos incrustados la bloquean: no pasa nada
  }
}

// Abrir / cerrar
const TURN_MS = reduceMotion ? 200 : 1100; // igual que la transición de .cover
let resetTimer = null;
function openCard() {
  clearTimeout(resetTimer);
  card.classList.add("open");
  playSong();
  // Solo mostrar "Soplar todas" si queda alguna vela encendida
  actions.hidden = !candlesEl.querySelector(".candle:not(.out)");
  setTimeout(() => {
    const first = candlesEl.querySelector(".candle");
    if (first) first.focus({ preventScroll: true });
  }, reduceMotion ? 50 : 900);
}
function closeCard() {
  card.classList.remove("open");
  actions.hidden = true;
  stopSong();
  cover.focus({ preventScroll: true });
  // Reencender las velas cuando la portada ya tapó el interior, no a la vista
  resetTimer = setTimeout(buildCandles, TURN_MS);
}
cover.addEventListener("click", openCard);
// Cerrar: un clic en cualquier parte del interior, salvo en una vela (esas se apagan).
$("inside").addEventListener("click", (e) => {
  if (!card.classList.contains("open") || e.target.closest(".candle")) return;
  closeCard();
});
// Con teclado: Escape cierra.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && card.classList.contains("open")) closeCard();
});
blowAllBtn.addEventListener("click", () => {
  blowAllBtn.disabled = true; // evita una segunda tanda mientras se apagan
  candlesEl.querySelectorAll(".candle:not(.out)").forEach((c, i) => {
    setTimeout(() => blowOut(c), i * 120);
  });
});

// Canción (sintetizada con Web Audio). Los navegadores solo dejan sonar audio
// después de un gesto del usuario; por eso arranca en el mismo clic que abre la tarjeta
// y se detiene al cerrarla.
let audioCtx = null;
let master = null;   // ganancia de la reproducción actual; desconectarla la silencia
let songTimer = null;

function stopSong() {
  clearTimeout(songTimer);
  if (master) {
    const m = master;
    m.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03); // fundido corto, sin "clic"
    setTimeout(() => m.disconnect(), 200);
    master = null;
  }
}

function playSong() {
  stopSong();
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) {
    return;
  }
  master = audioCtx.createGain();
  master.connect(audioCtx.destination);
  const N = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  const melody = [
    ["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
    ["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
    ["G4", .75], ["G4", .25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2],
    ["F5", .75], ["F5", .25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 2.5]
  ];
  const beat = 0.42;
  let t = audioCtx.currentTime + 0.05;
  for (const [note, dur] of melody) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = N[note];
    const len = dur * beat;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len * 0.95);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + len);
    t += len;
  }
  songTimer = setTimeout(stopSong, (t - audioCtx.currentTime) * 1000);
}

// Confeti
const canvas = $("confetti");
const ctx = canvas.getContext("2d");
const css = getComputedStyle(document.documentElement);
const colors = ["--coral", "--marigold", "--mint", "--paper"].map((v) => css.getPropertyValue(v).trim());
let pieces = [];
let rafId = null;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

function launchConfetti() {
  const count = reduceMotion ? 40 : 160;
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
      life: 0
    });
  }
  if (!rafId) rafId = requestAnimationFrame(tick);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of pieces) {
    p.vy += 0.28;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.1)));
    ctx.restore();
  }
  pieces = pieces.filter((p) => p.y < innerHeight + 40);
  rafId = pieces.length ? requestAnimationFrame(tick) : null;
  if (!rafId) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

drawCake($("cake"));
buildCandles();
