// Dibuja el pastel dentro de un <svg viewBox="0 0 260 150">. Lo usan la tarjeta y la
// vista previa, para que ambas muestren exactamente el mismo pastel.
//
// Cada piso es un cilindro visto un poco desde arriba: costado con sombra en los bordes
// y brillo, cara superior elíptica glaseada, glaseado que gotea siguiendo la curva del
// frente y un borde de crema en la base. Los colores salen de pastel.css (clases y
// var(--...)), no de aquí; las animaciones también están en CSS.
//
// La cara de arriba del piso alto está centrada en y = 12: ahí se apoyan las velas.
function drawCake(svg) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    parent.appendChild(node);
    return node;
  };

  // ---------- Degradados ----------
  const defs = el("defs", {});
  function gradient(tag, id, stops, attrs = {}) {
    const g = el(tag, { id, ...attrs }, defs);
    for (const [offset, color, opacity] of stops) {
      el("stop", { offset, style: `stop-color: ${color}; stop-opacity: ${opacity}` }, g);
    }
  }
  // Sombra de cilindro: los bordes se oscurecen, el centro no.
  gradient("linearGradient", "cakeShade", [[0, "var(--ink)", 0.4], [0.28, "var(--ink)", 0], [0.62, "var(--ink)", 0], [1, "var(--ink)", 0.48]]);
  // Brillo fijo (la luz viene de la izquierda) y reflejo que recorre el pastel.
  gradient("linearGradient", "cakeShine", [[0, "#fff", 0], [0.5, "#fff", 0.26], [1, "#fff", 0]]);
  gradient("linearGradient", "cakeSheen", [[0, "#fff", 0], [0.5, "#fff", 0.38], [1, "#fff", 0]]);
  // Luz suave sobre el glaseado de arriba y luz de las velas.
  gradient("radialGradient", "frostingLight", [[0, "#fff", 0.55], [1, "#fff", 0]], { cx: "0.38", cy: "0.35", r: "0.6" });
  gradient("radialGradient", "candleLight", [[0, "var(--flame)", 0.6], [1, "var(--flame)", 0]]);

  // y del borde delantero de una elipse (cx, cy, rx, ry) en la posición x
  const frontY = (cx, cy, rx, ry, x) => cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));

  // ---------- Un piso ----------
  function tier({ id, cx, rx, ry, top, h, sponge, frosting, drips, decorate }) {
    const x0 = cx - rx, x1 = cx + rx, bottom = top + h;
    const side = `M${x0} ${top} V${bottom} A${rx} ${ry} 0 0 0 ${x1} ${bottom} V${top} Z`;
    el("path", { d: side }, el("clipPath", { id: id + "Clip" }, defs));
    const g = el("g", {});

    // Costado: color, sombra de cilindro, brillo fijo y reflejo animado
    el("path", { d: side, class: sponge }, g);
    if (decorate) decorate(g);
    el("path", { d: side, fill: "url(#cakeShade)" }, g);
    const clipped = el("g", { "clip-path": `url(#${id}Clip)` }, g);
    el("rect", { x: x0 + rx * 0.3, y: top, width: rx * 0.24, height: h + ry, fill: "url(#cakeShine)" }, clipped);
    el("rect", {
      x: x0 - 36, y: top - ry, width: 36, height: h + 2 * ry, fill: "url(#cakeSheen)",
      class: "sheen", style: `--d: ${2 * rx + 36}px`
    }, clipped);

    // Glaseado que gotea: franja que sigue el borde delantero curvo y gotas redondeadas
    const band = 7;
    const n = drips.length;
    const w = (x1 - x0) / n;
    const r = w * 0.3;
    const edge = (x) => frontY(cx, top, rx, ry, x) + band;
    const dripGroup = el("g", { class: "drips" }, g);
    const glosses = [];
    let d = `M${x1} ${top} L${x1} ${edge(x1)}`;
    for (let i = n - 1; i >= 0; i--) {
      const a = x0 + w * i, b = a + w, c = a + w / 2;
      const tip = Math.max(edge(c - r), edge(c + r)) + drips[i];
      const right = (b + c + r) / 2, left = (a + c - r) / 2;
      d += ` L${right} ${edge(right)} L${c + r} ${edge(c + r)} V${tip}`;
      d += ` A${r} ${r} 0 0 1 ${c - r} ${tip} V${edge(c - r)}`;
      d += ` L${left} ${edge(left)} L${a} ${edge(a)}`;
      if (drips[i] > 10) glosses.push([c - r * 0.35, tip - 2, r * 0.28]);
    }
    d += ` L${x0} ${top} Z`;
    el("path", { d, class: frosting }, dripGroup);
    for (const [gx, gy, gr] of glosses) {
      el("ellipse", { cx: gx, cy: gy, rx: gr, ry: 2.4, class: "gloss" }, dripGroup);
    }

    // Cara de arriba glaseada, con su luz
    el("ellipse", { cx, cy: top, rx, ry, class: frosting }, g);
    el("ellipse", { cx, cy: top, rx, ry, fill: "url(#frostingLight)" }, g);

    return { g, x0, x1, bottom };
  }

  // Borde de crema (bolitas con brillo) a lo largo del frente de la base de un piso
  function piping(cx, rx, ry, y, count, cls, parent) {
    for (let k = 0; k < count; k++) {
      const x = cx - rx + 4 + (k / (count - 1)) * (2 * rx - 8);
      const py = frontY(cx, y, rx, ry, x);
      el("circle", { cx: x, cy: py, r: 5.4, class: cls }, parent);
      el("circle", { cx: x - 1.6, cy: py - 1.8, r: 1.7, class: "gloss" }, parent);
    }
  }

  // ---------- Plato ----------
  el("ellipse", { cx: 130, cy: 140, rx: 126, ry: 10, class: "plate" });
  el("ellipse", { cx: 130, cy: 137, rx: 121, ry: 8, class: "plate-rim" });
  el("ellipse", { cx: 130, cy: 133, rx: 110, ry: 8, class: "shade" }); // sombra del pastel

  // ---------- Piso de abajo, con chispas ----------
  // Posiciones fijas (no aleatorias) para que el pastel se vea igual siempre.
  const sprinkles = [
    [42, 112, -30], [60, 126, 20], [78, 108, 60], [98, 122, -10], [118, 114, 45],
    [140, 128, -50], [160, 110, 15], [182, 122, 70], [204, 112, -25], [220, 124, 35],
    [52, 98, 80], [210, 100, -60]
  ];
  const lower = tier({
    id: "tierBottom", cx: 130, rx: 106, ry: 12, top: 70, h: 58,
    sponge: "sponge-bottom", frosting: "frosting",
    drips: [10, 18, 8, 22, 12, 6, 16, 24, 9, 14],
    decorate: (g) => sprinkles.forEach(([sx, sy, rot], i) => el("rect", {
      x: sx - 4, y: sy - 1.5, width: 8, height: 3, rx: 1.5,
      class: "s" + ((i % 3) + 1), transform: `rotate(${rot} ${sx} ${sy})`
    }, g))
  });
  piping(130, 106, 12, 128, 15, "frosting", lower.g);

  // Sombra que proyecta el piso de arriba sobre el de abajo
  el("ellipse", { cx: 130, cy: 74, rx: 80, ry: 8, class: "shade" });

  // ---------- Piso de arriba, con una fila de puntos ----------
  const upper = tier({
    id: "tierTop", cx: 130, rx: 74, ry: 9, top: 12, h: 56,
    sponge: "sponge-top", frosting: "frosting-pink",
    drips: [14, 7, 18, 10, 20, 8, 15],
    decorate: (g) => {
      for (let i = 0; i < 9; i++) {
        const x = 70 + i * 15;
        el("circle", { cx: x, cy: frontY(130, 48, 74, 9, x), r: 3, class: i % 2 ? "s2" : "s1" }, g);
      }
    }
  });
  piping(130, 74, 9, 68, 11, "frosting-pink", upper.g);

  // Frutos con crema sobre el borde de arriba (detrás y a los lados de las velas)
  for (const angle of [200, 235, 305, 340, 25, 155]) {
    const t = (angle * Math.PI) / 180;
    const x = 130 + 74 * 0.8 * Math.cos(t);
    const y = 12 + 9 * 0.8 * Math.sin(t);
    el("circle", { cx: x, cy: y, r: 5, class: "frosting" });
    el("circle", { cx: x, cy: y - 4, r: 3.8, class: "berry" });
    el("circle", { cx: x - 1.2, cy: y - 5.4, r: 1.2, class: "gloss" });
  }

  // Luz de las velas sobre el glaseado (se apaga al soplar: clase "lit" en el <svg>)
  el("ellipse", { cx: 130, cy: 12, rx: 64, ry: 9, fill: "url(#candleLight)", class: "candlelight" });
}
