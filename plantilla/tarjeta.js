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

// Velas: con "numero" (ej. 18) una vela por cifra; si no, "velas" velas normales.
const candlesEl = $("candles");
const cakeEl = $("cake");
const cifras = TARJETA.numero ? String(TARJETA.numero).split("") : null;
candlesEl.classList.toggle("numbers", !!cifras);
function buildCandles() {
  candlesEl.textContent = "";
  const total = cifras ? cifras.length : TARJETA.velas;
  for (let i = 0; i < total; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "candle";
    if (cifras) {
      c.classList.add("digit");
      c.textContent = cifras[i];
      c.setAttribute("aria-label", "Apagar la vela del " + cifras[i]);
    } else {
      c.setAttribute("aria-label", "Apagar vela " + (i + 1));
    }
    const smoke = document.createElement("span");
    smoke.className = "smoke";
    c.appendChild(smoke);
    c.addEventListener("click", () => blowOut(c));
    candlesEl.appendChild(c);
  }
  wish.textContent = "Toca cada vela para apagarla.";
  wish.classList.remove("done");
  blowAllBtn.disabled = false;
  cakeEl.classList.add("lit"); // velas encendidas: su luz se refleja en el glaseado
  cakeEl.classList.remove("celebrate");
}

function blowOut(candle) {
  if (candle.classList.contains("out")) return;
  candle.classList.add("out");
  candle.setAttribute("aria-label", "Vela apagada");
  const left = candlesEl.querySelectorAll(".candle:not(.out)").length;
  if (left === 0) {
    wish.textContent = "¡Que se cumpla tu deseo!";
    wish.classList.add("done");
    // Final elegido en el JSON: "fuegos" (cielo estrellado y fuegos) o confeti (por defecto)
    if (TARJETA.final === "fuegos") Fuegos.start({ onBurst: playBoom });
    else launchConfetti();
    vibrate();
    cakeEl.classList.remove("lit");
    cakeEl.classList.add("celebrate"); // saltito del pastel (estilos.css)
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
  Fuegos.stop(); // si estaba la noche de fuegos, el fondo vuelve a la normalidad
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

// Sonido de los estallidos de los fuegos (también sintetizado). Mientras la canción
// suena (master != null) van de fondo, más bajos que ella; cuando termina, suenan fuerte.
// Las notas de la canción llegan a 0.22, así que 0.07 queda claramente por debajo.
const BOOM_VOL_CON_CANCION = 0.07;
const BOOM_VOL_SOLO = 0.45;
let noiseBuffer = null; // 1 s de ruido blanco, se crea una vez y se reutiliza

function playBoom(posX) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    return; // sin Web Audio: fuegos sin sonido
  }
  if (!noiseBuffer) {
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const vol = (master ? BOOM_VOL_CON_CANCION : BOOM_VOL_SOLO) * (0.75 + Math.random() * 0.5);
  const t = audioCtx.currentTime;

  // Se oye a la izquierda o a la derecha según dónde estalla
  const out = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createGain();
  if (out.pan) out.pan.value = (posX * 2 - 1) * 0.6;
  out.connect(audioCtx.destination);

  // 1. Golpe grave: tono que cae de 110 a 40 Hz
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.frequency.setValueAtTime(110, t);
  thump.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  thumpGain.gain.setValueAtTime(vol, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  thump.connect(thumpGain).connect(out);
  thump.start(t);
  thump.stop(t + 0.5);

  // 2. Estruendo: ruido que se oscurece y se apaga
  const boom = audioCtx.createBufferSource();
  boom.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(250, t + 0.9);
  const boomGain = audioCtx.createGain();
  boomGain.gain.setValueAtTime(0, t);
  boomGain.gain.linearRampToValueAtTime(vol, t + 0.01);
  boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  boom.connect(filter).connect(boomGain).connect(out);
  boom.start(t);
  boom.stop(t + 1.1);

  // 3. A veces, chisporroteo: chasquidos cortos y agudos que llegan después
  if (Math.random() < 0.5) {
    for (let i = 0; i < 10; i++) {
      const at = t + 0.3 + Math.random() * 0.7;
      const crackle = audioCtx.createBufferSource();
      crackle.buffer = noiseBuffer;
      const high = audioCtx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 3000;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(vol * 0.5, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
      crackle.connect(high).connect(g).connect(out);
      crackle.start(at, Math.random() * 0.9, 0.05);
    }
  }
}

// Confeti
const canvas = $("confetti");
const ctx = canvas.getContext("2d");
const css = getComputedStyle(document.documentElement);
const colors = ["--accent", "--marigold", "--mint", "--paper"].map((v) => css.getPropertyValue(v).trim());
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
