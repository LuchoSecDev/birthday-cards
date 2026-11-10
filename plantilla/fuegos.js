// Final "fuegos" (campo "final": "fuegos" del JSON): al apagar la última vela el fondo
// se oscurece, aparece un cielo estrellado y luego suben fuegos artificiales.
//
// - El cielo (#nightsky + canvas #stars) va DETRÁS de la tarjeta.
// - Los fuegos se dibujan en #fireworks, DELANTE de la tarjeta (sin bloquear los toques),
//   para que también se vean en el celular, donde la tarjeta ocupa casi toda la pantalla.
// Uso: Fuegos.start() al apagar la última vela, Fuegos.stop() al cerrar la tarjeta.

const Fuegos = (() => {
  const SKY_FADE_MS = 1400;   // igual que la transición de #nightsky en estilos.css
  const FIRST_ROCKET_MS = 2200;
  const SHOW_MS = 12000;      // cuánto tiempo siguen saliendo cohetes
  const GRAVITY = 0.045;

  const starsCanvas = document.getElementById("stars");
  const fwCanvas = document.getElementById("fireworks");
  const starsCtx = starsCanvas.getContext("2d");
  const fwCtx = fwCanvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const css = getComputedStyle(document.documentElement);
  const palette = ["--accent", "--marigold", "--mint", "--paper", "--flame"]
    .map((v) => css.getPropertyValue(v).trim());

  let running = false;
  let rafId = null;
  let timers = [];
  let startTime = 0;
  let stars = [];
  let rockets = [];
  let sparks = [];

  function sizeCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeStars() {
    const count = Math.round((innerWidth * innerHeight) / 3200);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight * 0.85,
      r: 0.4 + Math.random() * 1.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 2.2
    }));
  }

  function drawStars(seconds) {
    starsCtx.clearRect(0, 0, innerWidth, innerHeight);
    // las estrellas aparecen poco a poco mientras el cielo se oscurece
    const fadeIn = Math.min(1, Math.max(0, (seconds - 0.5) / 1.5));
    starsCtx.fillStyle = "#fff";
    for (const s of stars) {
      const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(seconds * s.speed + s.phase);
      starsCtx.globalAlpha = fadeIn * twinkle;
      starsCtx.beginPath();
      starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starsCtx.fill();
    }
    starsCtx.globalAlpha = 1;
  }

  function launchRocket() {
    const x = innerWidth * (0.12 + Math.random() * 0.76);
    rockets.push({
      x,
      y: innerHeight + 10,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(innerHeight * 0.011 + 4 + Math.random() * 2.5),
      targetY: innerHeight * (0.1 + Math.random() * 0.32),
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  function explode(rocket) {
    const count = 70 + Math.floor(Math.random() * 40);
    const power = 2.2 + Math.random() * 2.3;
    // segundo color para que cada estallido tenga dos tonos
    const second = palette[Math.floor(Math.random() * palette.length)];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      const speed = power * (0.55 + Math.random() * 0.45);
      sparks.push({
        x: rocket.x, y: rocket.y, px: rocket.x, py: rocket.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.011 + Math.random() * 0.01,
        color: i % 3 === 0 ? second : rocket.color
      });
    }
  }

  function scheduleRockets() {
    // una salva cada 0,45–1 s; a veces dos cohetes a la vez
    const next = () => {
      if (!running || performance.now() - startTime > FIRST_ROCKET_MS + SHOW_MS) return;
      launchRocket();
      if (Math.random() < 0.3) launchRocket();
      timers.push(setTimeout(next, 450 + Math.random() * 550));
    };
    timers.push(setTimeout(next, FIRST_ROCKET_MS));
  }

  function drawFireworks() {
    fwCtx.clearRect(0, 0, innerWidth, innerHeight);
    fwCtx.globalCompositeOperation = "lighter"; // los colores que se cruzan brillan más

    rockets = rockets.filter((r) => {
      r.x += r.vx;
      r.y += r.vy;
      r.vy += GRAVITY * 2;
      fwCtx.fillStyle = r.color;
      fwCtx.beginPath();
      fwCtx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
      fwCtx.fill();
      if (r.y <= r.targetY || r.vy >= -1) {
        explode(r);
        return false;
      }
      return true;
    });

    sparks = sparks.filter((s) => {
      s.px = s.x;
      s.py = s.y;
      s.vx *= 0.985;
      s.vy = s.vy * 0.985 + GRAVITY;
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.decay;
      if (s.life <= 0) return false;
      // estela corta: línea desde la posición anterior
      fwCtx.globalAlpha = s.life;
      fwCtx.strokeStyle = s.color;
      fwCtx.lineWidth = 2;
      fwCtx.beginPath();
      fwCtx.moveTo(s.px - s.vx * 2, s.py - s.vy * 2);
      fwCtx.lineTo(s.x, s.y);
      fwCtx.stroke();
      return true;
    });

    fwCtx.globalAlpha = 1;
    fwCtx.globalCompositeOperation = "source-over";
  }

  function frame(now) {
    if (!running) return;
    const seconds = (now - startTime) / 1000;
    drawStars(seconds);
    drawFireworks();
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    sizeCanvas(starsCanvas, starsCtx);
    sizeCanvas(fwCanvas, fwCtx);
    makeStars();
  }
  addEventListener("resize", resize);
  resize();

  function start() {
    if (running) return;
    running = true;
    startTime = performance.now();
    document.body.classList.add("fiesta");
    if (reduceMotion) {
      // sin movimiento: solo el cielo estrellado, quieto
      drawStars(2);
      return;
    }
    scheduleRockets();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(rafId);
    rockets = [];
    sparks = [];
    document.body.classList.remove("fiesta");
    fwCtx.clearRect(0, 0, innerWidth, innerHeight);
    // las estrellas se borran cuando el cielo ya se desvaneció
    setTimeout(() => { if (!running) starsCtx.clearRect(0, 0, innerWidth, innerHeight); }, SKY_FADE_MS);
  }

  return { start, stop };
})();
