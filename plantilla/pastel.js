// Dibuja el pastel dentro de un <svg viewBox="0 0 260 150">. Lo usan la tarjeta y la
// vista previa, para que ambas muestren exactamente el mismo pastel.
// Cada piso: bizcocho, sombra inferior, brillo lateral y glaseado que gotea.
// Los colores salen de pastel.css (clases), no de aquí.
function drawCake(svg) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    parent.appendChild(node);
    return node;
  };

  // Glaseado: franja superior con gotas redondeadas de largo variable.
  function dripPath(x0, x1, y, band, lengths) {
    const n = lengths.length;
    const w = (x1 - x0) / n;
    const r = w * 0.32;
    let d = `M${x0} ${y} H${x1} V${y + band}`;
    for (let i = n - 1; i >= 0; i--) {
      const cx = x0 + w * (i + 0.5);
      const L = lengths[i];
      d += ` L${cx + r} ${y + band} V${y + band + L}`;
      d += ` A${r} ${r} 0 0 1 ${cx - r} ${y + band + L}`;
      d += ` V${y + band} L${x0 + w * i} ${y + band}`;
    }
    return d + " Z";
  }

  function tier({ x, y, w, h, id, sponge, frosting, drips }) {
    const clip = el("clipPath", { id }, el("defs", {}));
    el("rect", { x, y, width: w, height: h, rx: 10 }, clip);
    const g = el("g", { "clip-path": `url(#${id})` });
    el("rect", { x, y, width: w, height: h, class: sponge }, g);
    el("rect", { x, y: y + h - 9, width: w, height: 9, class: "shade" }, g);
    el("rect", { x: x + 8, y, width: 9, height: h, class: "shine" }, g);
    el("path", { d: dripPath(x, x + w, y, 9, drips), class: frosting }, g);
    return g;
  }

  // Plato
  el("ellipse", { cx: 130, cy: 138, rx: 124, ry: 10, class: "plate" });
  el("ellipse", { cx: 130, cy: 134, rx: 120, ry: 8, class: "plate-rim" });

  // Piso de abajo, con chispas
  const bottomTier = tier({
    x: 22, y: 60, w: 216, h: 74, id: "tierBottom",
    sponge: "sponge-bottom", frosting: "frosting",
    drips: [10, 18, 8, 22, 12, 6, 16, 24, 9, 14]
  });
  // Posiciones fijas (no aleatorias) para que el pastel se vea igual siempre.
  const sprinkles = [
    [40, 108, -30], [58, 122, 20], [76, 104, 60], [96, 118, -10], [118, 110, 45],
    [140, 124, -50], [160, 106, 15], [182, 118, 70], [204, 108, -25], [222, 122, 35],
    [48, 92, 80], [212, 94, -60]
  ];
  sprinkles.forEach(([sx, sy, rot], i) => {
    el("rect", {
      x: sx - 4, y: sy - 1.5, width: 8, height: 3, rx: 1.5,
      class: "s" + ((i % 3) + 1),
      transform: `rotate(${rot} ${sx} ${sy})`
    }, bottomTier);
  });

  // Sombra que proyecta el piso de arriba sobre el de abajo
  el("ellipse", { cx: 130, cy: 62, rx: 76, ry: 5, class: "shade" });

  // Piso de arriba, con una fila de puntos.
  // (no se llama "top": como global chocaría con window.top del navegador)
  const topTier = tier({
    x: 54, y: 2, w: 152, h: 60, id: "tierTop",
    sponge: "sponge-top", frosting: "frosting-pink",
    drips: [14, 7, 18, 10, 20, 8, 15]
  });
  for (let i = 0; i < 7; i++) {
    el("circle", { cx: 66 + i * 21.3, cy: 46, r: 3.2, class: i % 2 ? "s2" : "s1" }, topTier);
  }
}
