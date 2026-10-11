/* ==========================================================================
   IONN CONSULTING · field.js
   Fondo con profundidad: cinco capas ambientales, todas decorativas.
     1. Volumen        resplandor radial · le da cuerpo a la nube de datos
     2. Malla          red triangulada de bajo poli, tipo terreno de datos
     3. Anillo          circunferencia de señal alrededor del foco de cada sección
     4. Nube de datos  los puntos de contacto, con profundidad (z) propia
     5. Río de datos   flujo continuo en la franja inferior, con hilos brillantes
   El fondo se desplaza con el ratón y con el scroll; el contenido (textos,
   diagramas, botones) no se mueve nunca — esa diferencia de velocidad es
   lo que da la sensación de profundidad. Si algo aquí falla, la página
   no se entera: es puramente decorativo.
   Sin type="module": IIFE sobre window.__IONN__ · abre con doble clic.
   ========================================================================== */
(function (root) {
  "use strict";

  root.__IONN__ = root.__IONN__ || {};

  var reduce = false;
  try {
    reduce = root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var canvas = document.getElementById("field");
  if (!canvas || reduce) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  /* ---------- Intensidad ----------
     Validada con Gus sobre la referencia visual que compartió: malla y
     anillo bien presentes, río con cuerpo — el empuje fuerte, más cercano
     a su imagen, sin perder el negro de fondo ni el contraste del texto.
     mouse  · px que se desplaza la capa más cercana con el cursor
     scroll · fracción del scroll que arrastra el fondo (1 = igual que el contenido)
     mesh / river / cloud / glow / ring · multiplicador de cada capa; 0 la apaga
     riverCore · brillo de los hilos que atraviesan el río */
  var TUNE = { mouse: 46, scroll: 0.22, mesh: 1.5, river: 1.6, cloud: 1.1, glow: 1.2, ring: 1.4, riverCore: 1.4 };

  /* ---------- Configuración por modo ---------- */
  // rk = radio del anillo como fracción del lado menor.
  // orbit concentra el campo alrededor del negocio; drift lo abre hacia
  // los bordes y deja el centro limpio para el contenido.
  var MODES = {
    orbit:    { link: 142, alpha: 0.40, pull: 0.00016, flow: 0.0,   rk: 0.66, fx: 0.72 },
    drift:    { link: 112, alpha: 0.26, pull: 0.00022, flow: 0.045, rk: 0.92, fx: 0.50 },
    system:   { link: 128, alpha: 0.26, pull: 0.00015, flow: 0.0,   rk: 0.80, fx: 0.50 },
    converge: { link: 150, alpha: 0.32, pull: 0.00030, flow: 0.0,   rk: 0.62, fx: 0.60 }
  };

  var mode = MODES.orbit;
  var mix = {
    link: MODES.orbit.link,
    alpha: MODES.orbit.alpha,
    pull: MODES.orbit.pull,
    flow: 0,
    rk: MODES.orbit.rk,
    fx: MODES.orbit.fx
  };

  var W = 0, H = 0, dpr = 1;
  var nodes = [], river = [], mesh = { pts: [], edges: [] };
  var pointer = { x: -9999, y: -9999, active: false };
  var focus = { x: 0, y: 0, unit: 0, wide: false };
  // par = desplazamiento de paralaje. x/y siguen al ratón con retardo; sy al scroll.
  var par = { x: 0, y: 0, tx: 0, ty: 0, sy: 0 };
  var curRingR = 0;      // radio vigente del anillo, lo llena step() y lo lee drawRing()
  var ringRot = 0;       // giro lento del collar de puntos sobre el anillo
  var clock = 0;         // reloj propio para el oleaje suave de la malla
  var running = false;
  var rafId = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Envolvente: cualquier desplazamiento es válido porque el dibujo da la vuelta.
  function wrap(v, max) {
    var m = max + 80;
    var r = (v + 40) % m;
    if (r < 0) r += m;
    return r - 40;
  }

  function measure() {
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || root.innerWidth;
    H = canvas.clientHeight || root.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // En móvil el foco siempre va al centro; en desktop lo decide el modo.
    focus.wide = W >= 1000;
    focus.y = focus.wide ? H * 0.5 : H * 0.44;
    focus.unit = Math.min(W, H);
    glowCv = null;   // cambió el tamaño o el dpr: el resplandor se rehornea
  }

  function seed() {
    // Menos nodos en pantallas chicas: mismo aire, menos trabajo.
    var target = Math.round((W < 700 ? 42 : 70) * TUNE.cloud);
    nodes.length = 0;
    for (var i = 0; i < target; i++) {
      nodes.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-0.16, 0.16),
        vy: rand(-0.16, 0.16),
        r: rand(0.7, 1.9),
        t: rand(0, Math.PI * 2),
        // z = profundidad. 0.32 al fondo, 1 al frente.
        // Manda el tamaño, la opacidad y cuánto se mueve con el paralaje.
        z: rand(0.32, 1),
        dx: 0, dy: 0
      });
    }
  }

  // Malla de bajo poli: una cuadrícula con vértices desplazados al azar y
  // conectados en triángulos, como el terreno de datos de la referencia.
  // Se calcula una sola vez por tamaño de pantalla — no se re-siembra cada
  // cuadro, solo se le aplican oleaje y paralaje al dibujar.
  function seedMesh() {
    var GS = (W < 700 ? 78 : 108) / Math.min(1.5, Math.max(0.75, Math.sqrt(TUNE.mesh || 1)));
    var cols = Math.ceil(W / GS) + 2;
    var rows = Math.ceil(H / GS) + 2;
    var jitter = GS * 0.32;
    var pts = [];
    var row, col, idx;

    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        pts.push({
          x0: col * GS - GS + rand(-jitter, jitter),
          y0: row * GS - GS + rand(-jitter, jitter),
          // La malla vive detrás de la nube: profundidad más corta y más pareja.
          z: rand(0.2, 0.5),
          ph: rand(0, Math.PI * 2),
          dx: 0, dy: 0
        });
      }
    }

    var edges = [];
    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        idx = row * cols + col;
        if (col < cols - 1) edges.push([idx, idx + 1]);                 // horizontal
        if (row < rows - 1) edges.push([idx, idx + cols]);              // vertical
        if (col < cols - 1 && row < rows - 1) {
          // Diagonal alternada: así los cuadros se parten en triángulos
          // reales en vez de leer como una rejilla de papel cuadriculado.
          if ((row + col) % 2 === 0) edges.push([idx, idx + cols + 1]);
          else edges.push([idx + 1, idx + cols]);
        }
      }
    }

    mesh.pts = pts;
    mesh.edges = edges;
  }

  function seedRiver() {
    var target = Math.round((W < 700 ? 44 : 108) * TUNE.river);
    river.length = 0;
    for (var i = 0; i < target; i++) {
      river.push({
        x: rand(-60, W + 60),
        base: rand(0.78, 1.01),     // altura como fracción de H
        z: rand(0.3, 1),
        r: rand(0.4, 1.55),
        sp: rand(0.22, 0.8),        // velocidad base
        ph: rand(0, Math.PI * 2),
        amp: rand(4, 18),           // vaivén vertical
        // Un puñado de partículas en violeta, como en la referencia.
        // No hay rosa: se sale del 70/20/10 de la marca.
        vio: Math.random() < 0.09
      });
    }
  }

  /* ---------- Movimiento ---------- */
  function step() {
    clock += 0.01;

    // Interpolación suave entre modos: nada salta al cambiar de sección.
    mix.link  += (mode.link  - mix.link)  * 0.04;
    mix.alpha += (mode.alpha - mix.alpha) * 0.04;
    mix.pull  += (mode.pull  - mix.pull)  * 0.04;
    mix.flow  += (mode.flow  - mix.flow)  * 0.04;
    mix.rk    += (mode.rk    - mix.rk)    * 0.03;
    mix.fx    += (mode.fx    - mix.fx)    * 0.03;

    // Paralaje de ratón: el destino se persigue con retardo para que
    // el fondo nunca se sienta pegado al cursor.
    if (pointer.active && W) {
      par.tx = ((pointer.x / W) - 0.5) * -2 * TUNE.mouse;
      par.ty = ((pointer.y / H) - 0.5) * -2 * TUNE.mouse * 0.6;
    } else {
      par.tx *= 0.98;
      par.ty *= 0.98;
    }
    par.x += (par.tx - par.x) * 0.055;
    par.y += (par.ty - par.y) * 0.055;

    // Paralaje de scroll: el fondo sube mucho más lento que el contenido.
    var sy = root.pageYOffset || document.documentElement.scrollTop || 0;
    par.sy = -sy * TUNE.scroll;

    curRingR = focus.unit * mix.rk;
    ringRot += 0.0011;
    focus.x = W * (focus.wide ? mix.fx : 0.5);
    var i, n;

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];

      // Deriva orgánica
      n.t += 0.004;
      n.vx += Math.cos(n.t) * 0.0035 + mix.flow * 0.02;
      n.vy += Math.sin(n.t * 0.9) * 0.0035;

      // Atracción hacia el anillo del modo activo
      if (mix.pull > 0.00002) {
        var dx = n.x - focus.x;
        var dy = n.y - focus.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var off = d - curRingR;
        n.vx -= (dx / d) * off * mix.pull;
        n.vy -= (dy / d) * off * mix.pull;
      }

      // Repulsión al cursor. Más suave que antes: ahora el ratón
      // también mueve la capa entera y dos efectos fuertes se pelean.
      if (pointer.active) {
        var px = n.x - pointer.x;
        var py = n.y - pointer.y;
        var pd2 = px * px + py * py;
        if (pd2 < 15000 && pd2 > 0.5) {
          var f = (1 - pd2 / 15000) * 0.55;
          var pd = Math.sqrt(pd2);
          n.vx += (px / pd) * f;
          n.vy += (py / pd) * f;
        }
      }

      // Fricción
      n.vx *= 0.965;
      n.vy *= 0.965;

      n.x += n.vx;
      n.y += n.vy;

      // Envolvente del mundo
      if (n.x < -40) n.x = W + 40;
      if (n.x > W + 40) n.x = -40;
      if (n.y < -40) n.y = H + 40;
      if (n.y > H + 40) n.y = -40;

      // Posición dibujada = mundo + paralaje según profundidad.
      n.dx = wrap(n.x + par.x * n.z, W);
      n.dy = wrap(n.y + (par.y + par.sy) * n.z, H);
    }

    // Malla: oleaje muy lento + paralaje. Sin fricción ni física: los
    // vértices no "viajan", solo respiran sobre su posición de origen.
    for (i = 0; i < mesh.pts.length; i++) {
      var p2 = mesh.pts[i];
      var wx = Math.sin(clock * 0.4 + p2.ph) * 4 * p2.z;
      var wy = Math.cos(clock * 0.33 + p2.ph * 1.3) * 4 * p2.z;
      p2.dx = wrap(p2.x0 + wx + par.x * p2.z, W);
      p2.dy = wrap(p2.y0 + wy + (par.y + par.sy) * p2.z, H);
    }

    // Río: flujo continuo hacia la derecha, sin saltos.
    for (i = 0; i < river.length; i++) {
      var p = river[i];
      p.x += p.sp * (0.45 + p.z);
      if (p.x > W + 60) p.x = -60;
      p.ph += 0.009;
    }
  }

  /* ---------- Dibujo ---------- */

  // 1 · Volumen. Un resplandor radial detrás de la nube. Sin bordes, sin anillo.
  //     Se dibuja UNA vez en un lienzo aparte y luego solo se estampa: pintar
  //     un degradado a pantalla completa en cada cuadro cuesta la mitad del fps.
  var glowCv = null, glowR = 0, glowA = -1;

  function bakeGlow(R, k) {
    var side = Math.round(R * 2);
    if (side < 8) return false;
    if (!glowCv) glowCv = document.createElement("canvas");
    glowCv.width = Math.round(side * dpr);
    glowCv.height = Math.round(side * dpr);
    var g2 = glowCv.getContext("2d");
    if (!g2) return false;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g;
    try {
      g = g2.createRadialGradient(R, R, 0, R, R, R);
    } catch (e) { return false; }
    g.addColorStop(0,    "rgba(30,150,255," + (0.115 * TUNE.glow * k).toFixed(3) + ")");
    g.addColorStop(0.45, "rgba(24,190,255," + (0.055 * TUNE.glow * k).toFixed(3) + ")");
    g.addColorStop(1,    "rgba(24,224,255,0)");
    g2.fillStyle = g;
    g2.fillRect(0, 0, side, side);
    glowR = R;
    glowA = k;
    return true;
  }

  function drawGlow() {
    if (!TUNE.glow) return;
    var k = mix.alpha / 0.32;
    var R = focus.unit * mix.rk * 1.55;

    // Se rehornea solo cuando el modo ya movió el tamaño o el brillo lo bastante.
    if (!glowCv || Math.abs(R - glowR) / (glowR || 1) > 0.04 || Math.abs(k - glowA) > 0.05) {
      if (!bakeGlow(R, k)) return;
    }

    var fx = focus.x + par.x * 0.35;
    var fy = focus.y + (par.y + par.sy) * 0.35;
    ctx.drawImage(glowCv, fx - glowR, fy - glowR, glowR * 2, glowR * 2);
  }

  // 2 · Malla. Red triangulada de bajo poli, pareja en toda la pantalla
  //     (no se apaga hacia los bordes): es terreno, no una viñeta.
  function drawMesh() {
    if (!TUNE.mesh) return;
    var pts = mesh.pts, edges = mesh.edges;
    var base = TUNE.mesh * (mix.alpha / 0.32) * 0.16;
    var i, e, a2, b2, z, o;

    ctx.lineWidth = 1;
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      a2 = pts[e[0]]; b2 = pts[e[1]];
      // Una arista que envuelve de un lado a otro de la pantalla se ve
      // como una línea larga fantasma: se salta si el salto es enorme.
      if (Math.abs(a2.dx - b2.dx) > W * 0.5 || Math.abs(a2.dy - b2.dy) > H * 0.5) continue;
      z = (a2.z + b2.z) * 0.5;
      o = base * (0.4 + 1.5 * z);
      if (o < 0.006) continue;
      ctx.strokeStyle = "rgba(24,224,255," + o.toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(a2.dx, a2.dy);
      ctx.lineTo(b2.dx, b2.dy);
      ctx.stroke();
    }

    // Vértices: pequeños puntos de luz, como estrellas de la retícula.
    for (i = 0; i < pts.length; i++) {
      a2 = pts[i];
      o = base * 1.9 * (0.3 + 0.9 * a2.z);
      if (o < 0.008) continue;
      ctx.fillStyle = "rgba(180,235,255," + o.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(a2.dx, a2.dy, 1 + a2.z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3 · Anillo. La circunferencia de señal alrededor del foco de la sección:
  //     hace visible lo que ya empujaba a los nodos hacia un anillo invisible.
  function drawRing() {
    if (!TUNE.ring || curRingR < 20) return;
    var pullNorm = Math.min(1, mix.pull / 0.00030);
    var k = TUNE.ring * (mix.alpha / 0.32) * (0.5 + 0.5 * pullNorm);
    var fx = focus.x + par.x * 0.35;
    var fy = focus.y + (par.y + par.sy) * 0.35;
    var R = curRingR;
    var i;

    // Tres trazos concéntricos de ancho decreciente: simulan el resplandor
    // suave sin depender de ctx.filter (no todos los navegadores lo soportan).
    var passes = [[5, 0.05], [2.4, 0.09], [1, 0.16]];
    for (i = 0; i < passes.length; i++) {
      ctx.lineWidth = passes[i][0];
      ctx.strokeStyle = "rgba(24,224,255," + (k * passes[i][1]).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(fx, fy, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Collar de puntos sobre la circunferencia, girando muy despacio.
    var count = W < 700 ? 20 : 30;
    for (i = 0; i < count; i++) {
      var ang = ringRot + (i / count) * Math.PI * 2;
      var px = fx + Math.cos(ang) * R;
      var py = fy + Math.sin(ang) * R * (focus.wide ? 1 : 0.94);
      var tw = 0.55 + 0.45 * Math.sin(clock * 1.4 + i * 1.7);
      ctx.fillStyle = "rgba(190,238,255," + (k * 0.4 * tw).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4 · Nube de datos. Las aristas se calculan sobre la posición dibujada,
  //     no sobre la del mundo: si no, el paralaje las rompería.
  function drawCloud() {
    var maxD2 = mix.link * mix.link;
    var a = mix.alpha;
    var i, j, n, m, dx, dy, d2, o;

    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        m = nodes[j];
        dx = n.dx - m.dx;
        dy = n.dy - m.dy;
        d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          // La profundidad promedio de los dos nodos decide qué tan viva
          // se ve la conexión. Las del fondo casi no existen.
          o = (1 - d2 / maxD2) * 0.3 * a * (0.35 + 0.65 * (n.z + m.z) * 0.5);
          ctx.strokeStyle = "rgba(24,224,255," + o.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(n.dx, n.dy);
          ctx.lineTo(m.dx, m.dy);
          ctx.stroke();
        }
      }
    }

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      o = 0.5 * a * (0.3 + 0.7 * n.z);
      ctx.fillStyle = "rgba(148,236,255," + o.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(n.dx, n.dy, n.r * (0.55 + 0.75 * n.z), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5 · Río de datos. Franja inferior, flujo continuo, sin principio ni fin,
  //     con un par de hilos brillantes atravesando la nube de partículas.
  function drawRiver() {
    if (!TUNE.river) return;
    var k = mix.alpha / 0.32;
    var oy = (par.y + par.sy) * 0.55;
    var ox = par.x * 0.55;
    var top = H * 0.68 + oy;
    var g, i, x, y;

    // Cauce: un degradado muy tenue que asienta la franja.
    try {
      g = ctx.createLinearGradient(0, top, 0, H + 30);
      g.addColorStop(0, "rgba(24,224,255,0)");
      g.addColorStop(1, "rgba(24,224,255," + (0.06 * k * TUNE.river).toFixed(3) + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, H - top + 30);
    } catch (e) {}

    // Hilos brillantes: el núcleo de luz que la referencia trae bajo el polvo.
    if (TUNE.riverCore) {
      var cores = [
        { base: 0.855, amp: 13, freq: 0.0034, ph: 0.6, w: 1.6 },
        { base: 0.915, amp: 9,  freq: 0.0046, ph: 2.4, w: 1.2 }
      ];
      for (i = 0; i < cores.length; i++) {
        var c = cores[i];
        var o = Math.min(0.6, 0.3 * k * TUNE.riverCore);
        ctx.strokeStyle = "rgba(190,240,255," + o.toFixed(3) + ")";
        ctx.lineWidth = c.w;
        ctx.beginPath();
        for (x = 0; x <= W; x += 16) {
          y = H * c.base + Math.sin(clock * 0.5 + c.ph + (x + ox) * c.freq) * c.amp + oy;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    for (i = 0; i < river.length; i++) {
      var p = river[i];
      x = p.x + ox * p.z;
      y = H * p.base + Math.sin(p.ph + p.x * 0.0055) * p.amp * p.z + oy * p.z;
      var a = Math.min(0.85, (0.2 + 0.55 * p.z) * k);
      ctx.fillStyle = p.vio
        ? "rgba(157,92,255," + a.toFixed(3) + ")"
        : "rgba(150,238,255," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, p.r * (0.6 + 0.6 * p.z), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGlow();
    drawMesh();
    drawRing();
    drawCloud();
    drawRiver();
  }

  function loop() {
    if (!running) return;
    step();
    draw();
    rafId = root.requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = root.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) root.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ---------- Modo por sección ---------- */
  function setMode(name) {
    var next = MODES[name];
    if (next) mode = next;
  }

  function watchSections() {
    var sections = document.querySelectorAll("[data-field-mode]");
    if (!sections.length || !("IntersectionObserver" in root)) return;

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          setMode(entries[i].target.getAttribute("data-field-mode"));
        }
      }
    }, { threshold: 0.05, rootMargin: "-35% 0px -35% 0px" });

    for (var k = 0; k < sections.length; k++) io.observe(sections[k]);
  }

  /* ---------- Eventos ---------- */
  var resizeTimer = 0;
  root.addEventListener("resize", function () {
    root.clearTimeout(resizeTimer);
    resizeTimer = root.setTimeout(function () {
      measure();
      seed();
      seedMesh();
      seedRiver();
    }, 180);
  }, { passive: true });

  root.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  }, { passive: true });

  root.addEventListener("pointerleave", function () {
    pointer.active = false;
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  /* ---------- Arranque ---------- */
  measure();
  seed();
  seedMesh();
  seedRiver();
  watchSections();
  start();

  // Delay activación del canvas para evitar parpadeos en Safari
  root.setTimeout(function() {
    canvas.classList.add("is-on");
  }, 100);

  root.__IONN__.field = { setMode: setMode, start: start, stop: stop };

})(window);
