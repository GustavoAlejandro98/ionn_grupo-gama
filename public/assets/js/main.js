/* ==========================================================================
   IONN CONSULTING · main.js
   Splash, navegación, revelados y el recorrido de El Cambio.
   Sin type="module": IIFE sobre window.__IONN__ · abre con doble clic.
   ========================================================================== */
(function (root, doc) {
  "use strict";

  root.__IONN__ = root.__IONN__ || {};

  /* ---------- Utilidades ---------- */

  // Si un inicializador truena, el resto sigue vivo.
  function safe(fn, name) {
    try {
      fn();
    } catch (err) {
      if (root.console && console.warn) {
        console.warn("[IONN] " + name + " no pudo inicializar:", err);
      }
    }
  }

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var reduceMotion = false;
  try {
    reduceMotion = root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  // Un solo bucle de scroll para toda la página.
  var scrollJobs = [];
  var ticking = false;

  function onScrollFrame() {
    ticking = false;
    for (var i = 0; i < scrollJobs.length; i++) {
      try { scrollJobs[i](); } catch (e) {}
    }
  }

  function requestScroll() {
    if (ticking) return;
    ticking = true;
    root.requestAnimationFrame(onScrollFrame);
  }

  function addScrollJob(fn) {
    scrollJobs.push(fn);
    fn();
  }

  root.addEventListener("scroll", requestScroll, { passive: true });
  root.addEventListener("resize", requestScroll, { passive: true });


  /* ---------- 1. Splash ----------
     El CSS ya lo desvanece solo. Esto únicamente lo retira del DOM. */
  function initSplash() {
    var splash = $("#splash");
    if (!splash) return;

    var kill = function () {
      splash.classList.add("is-done");
      root.setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 600);
    };

    if (doc.readyState === "complete") {
      root.setTimeout(kill, 400);
    } else {
      root.addEventListener("load", function () {
        root.setTimeout(kill, 400);
      });
    }

    // Fail-safe: pase lo que pase, a los 3 s no queda nada tapando la pantalla.
    root.setTimeout(kill, 3000);
  }


  /* ---------- 2. Navegación ---------- */
  function initNav() {
    var nav = $("#nav");
    var toggle = $("#navToggle");
    var panel = $("#navPanel");

    if (nav) {
      addScrollJob(function () {
        var stuck = (root.pageYOffset || doc.documentElement.scrollTop) > 8;
        nav.classList.toggle("is-stuck", stuck);
      });
    }

    if (!toggle || !panel) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Cada enlace se enlaza individualmente al renderizarse — sin temporizadores globales.
    $$("a", panel).forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }


  /* ---------- 3. Revelados ----------
     threshold bajo + red de seguridad a los 6 s: nada se queda invisible. */
  function initReveal() {
    var items = $$("[data-reveal]");
    if (!items.length) return;

    var show = function (el) { el.classList.add("is-in"); };

    if (reduceMotion || !("IntersectionObserver" in root)) {
      items.forEach(show);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (el) { io.observe(el); });

    root.setTimeout(function () { items.forEach(show); }, 6000);
  }


  /* ---------- 4. El camino de tu cliente ----------
     Sticky nativo + progreso de scroll. Sin librerías, sin scroll inercial.

     Cada parada vive en su propia "página" del recorrido: el ancho de la
     pista es N veces el ancho real del viewport, y la parada i se centra
     exactamente a la mitad de su página (vw·(i+0.5)). Así, sea cual sea el
     ancho de pantalla, la parada 1 queda centrada al llegar a la sección
     (p=0), la del medio a la mitad del recorrido (p=0.5) y la última al
     final (p=1) — nunca se queda una parada arrancando fuera de cuadro
     ni empujada contra el borde donde el viewport se desvanece.
     Antes las tres posiciones venían fijas en píxeles (pensadas para un
     ancho que no coincidía con el real) y solo la parada del medio llegaba
     a centrarse: la 1 arrancaba ya corrida a la izquierda y la 3 nunca
     alcanzaba el centro. Por eso se recalculan aquí, no en el HTML.

     El alto tiene el mismo problema: change__viewport puede encogerse
     hasta min-height (240px en una pantalla baja como una laptop de 13").
     Las paradas cuyo texto caía cerca del borde inferior del espacio
     de 420px originalmente autorado quedaban recortadas por el
     overflow:hidden — eso es lo que se veía como "la etapa 3 incompleta".
     data-y ya no es un píxel fijo: es una fracción (0–1) de dónde poner
     el ancla dentro del alto REAL, dejando siempre debajo el espacio que
     el contenido de esa parada necesita para no cortarse. */
  function initChange() {
    var section = $("#cliente");
    if (!section || reduceMotion) return;

    var stage = $(".change__stage", section);
    var viewport = $(".change__viewport", section);
    var track = $("#changeTrack");
    var svg = $(".change__path", section);
    var pathBase = $(".change__path-base", section);
    var path = $("#changePath");
    var bar = $("#changeBar");
    var stops = $$(".change__stop", section);

    if (!stage || !viewport || !track || !stops.length) return;

    var maxShift = 0;
    var pathLen = 0;

    // Curva suave entre N puntos, con un pequeño margen de entrada y
    // salida — el mismo trazo en "C" que ya traía el diseño original,
    // pero calculado sobre las coordenadas reales en vez de fijas.
    function buildPath(pts, margin) {
      var d = "M " + (pts[0].x - margin) + " " + pts[0].y + " L " + pts[0].x + " " + pts[0].y;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var c1 = a.x + (b.x - a.x) / 3;
        var c2 = b.x - (b.x - a.x) / 3;
        d += " C " + c1 + " " + a.y + ", " + c2 + " " + b.y + ", " + b.x + " " + b.y;
      }
      var last = pts[pts.length - 1];
      d += " L " + (last.x + margin) + " " + last.y;
      return d;
    }

    function layout() {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var n = stops.length;
      if (!vw || !vh) return;

      var trackW = vw * n;
      track.style.width = trackW + "px";
      track.style.height = vh + "px";
      track.style.top = "0";
      track.style.marginTop = "0";
      maxShift = Math.max(0, trackW - vw);

      // El ancla del punto es donde empieza el contenido (el punto vive
      // 7px arriba del ancla; el resto del bloque crece hacia abajo).
      // Se mide el más alto de los tres para que ninguno se corte.
      var contentH = 0;
      for (var m = 0; m < n; m++) contentH = Math.max(contentH, stops[m].offsetHeight);

      var topMargin = 12, bottomMargin = 10;
      var safeMin = topMargin;
      var safeMax = Math.max(safeMin + 8, vh - contentH - bottomMargin);

      var pts = [];
      for (var i = 0; i < n; i++) {
        var cx = Math.round(vw * (i + 0.5));
        var frac = parseFloat(stops[i].getAttribute("data-y"));
        if (isNaN(frac)) frac = 0.5;
        var cy = Math.round(safeMin + frac * (safeMax - safeMin));
        stops[i].style.setProperty("--x", cx + "px");
        stops[i].style.setProperty("--y", cy + "px");
        pts.push({ x: cx, y: cy });
      }

      if (svg) {
        svg.setAttribute("viewBox", "0 0 " + trackW + " " + vh);
        svg.style.width = trackW + "px";
        svg.style.height = vh + "px";
      }

      var d = buildPath(pts, vw * 0.12);
      if (pathBase) pathBase.setAttribute("d", d);
      if (path) {
        path.setAttribute("d", d);
        pathLen = 0;
        if (typeof path.getTotalLength === "function") {
          try {
            pathLen = path.getTotalLength();
            path.style.strokeDasharray = pathLen + " " + pathLen;
            path.style.strokeDashoffset = pathLen;
          } catch (e) {
            pathLen = 0;
          }
        }
      }
    }

    var lastP = -1;

    function update() {
      var rect = section.getBoundingClientRect();
      var runway = section.offsetHeight - stage.offsetHeight;
      if (runway <= 0) return;

      var p = clamp(-rect.top / runway, 0, 1);
      if (Math.abs(p - lastP) < 0.0004) return;
      lastP = p;

      // Desplazamiento horizontal del recorrido
      track.style.transform = "translate3d(" + (-p * maxShift).toFixed(2) + "px,0,0)";

      // La línea se dibuja conforme avanzas
      if (pathLen) {
        path.style.strokeDashoffset = (pathLen * (1 - p)).toFixed(2);
      }

      // Cada parada se activa al llegar a ella y se queda encendida
      for (var i = 0; i < stops.length; i++) {
        var at = parseFloat(stops[i].getAttribute("data-at")) || 0;
        stops[i].classList.toggle("is-active", p >= at - 0.02);
      }

      if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
    }

    layout();
    addScrollJob(update);

    // Safari fix: relayout después de que las fuentes se carguen (para asegurar
    // que los stops tengan sus alturas finales antes de calcular posiciones)
    root.setTimeout(function () {
      layout();
      lastP = -1;
      update();
    }, 800);

    var rt = 0;
    root.addEventListener("resize", function () {
      root.clearTimeout(rt);
      rt = root.setTimeout(function () {
        layout();
        lastP = -1;
        update();
      }, 180);
    }, { passive: true });

    // Red de seguridad: si algo impidiera el cálculo, la primera parada
    // queda visible en vez de dejar la sección apagada.
    root.setTimeout(function () {
      if (stops.length && !$(".change__stop.is-active", section)) {
        stops[0].classList.add("is-active");
      }
    }, 6000);
  }


  /* ---------- 5. Secciones que se arman al entrar en pantalla ----------
     Marca la sección con .is-in y el CSS orquesta el resto. */
  function initInView() {
    var sections = $$("[data-inview]");
    if (!sections.length) return;

    var mark = function (el) { el.classList.add("is-in"); };

    if (!("IntersectionObserver" in root)) {
      sections.forEach(mark);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          mark(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -12% 0px" });

    sections.forEach(function (el) { io.observe(el); });

    root.setTimeout(function () { sections.forEach(mark); }, 6000);
  }


  /* ---------- 6. Cómo trabajamos: la línea que se construye ---------- */
  function initProcess() {
    var track = $("#processTrack");
    var fill = $("#processFill");
    if (!track || !fill) return;

    var steps = $$(".process__step", track);

    if (reduceMotion) {
      steps.forEach(function (s) { s.classList.add("is-active"); });
      return;
    }

    var lastP = -1;

    function update() {
      var rect = track.getBoundingClientRect();
      var vh = root.innerHeight || doc.documentElement.clientHeight;

      // Progreso desde que el bloque entra por abajo hasta que su base
      // cruza el centro de la pantalla.
      var start = vh * 0.85;
      var end = vh * 0.35;
      var span = (rect.height + start - end) || 1;
      var p = clamp((start - rect.top) / span, 0, 1);

      if (Math.abs(p - lastP) < 0.004) return;
      lastP = p;

      fill.style.setProperty("--p", p.toFixed(3));

      for (var i = 0; i < steps.length; i++) {
        var at = parseFloat(steps[i].getAttribute("data-at")) || 0;
        steps[i].classList.toggle("is-active", p >= at);
      }
    }

    addScrollJob(update);

    root.setTimeout(function () {
      if (!$(".process__step.is-active", track)) {
        steps.forEach(function (s) { s.classList.add("is-active"); });
      }
    }, 6000);
  }


  /* ---------- 7. Contadores ----------
     Los números arrancan en cero en el HTML y se animan al entrar. */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function format(el, value) {
      var decimals = parseInt(el.getAttribute("data-decimals"), 10) || 0;
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      return prefix + value.toFixed(decimals) + suffix;
    }

    function run(el) {
      if (el.getAttribute("data-done")) return;
      el.setAttribute("data-done", "1");

      var target = parseFloat(el.getAttribute("data-count"));
      if (isNaN(target)) return;

      if (reduceMotion) {
        el.textContent = format(el, target);
        return;
      }

      var duration = 1400;
      var t0 = 0;

      function frame(now) {
        if (!t0) t0 = now;
        var t = clamp((now - t0) / duration, 0, 1);
        // easeOutExpo: arranca rápido y aterriza suave
        var e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        el.textContent = format(el, target * e);
        if (t < 1) root.requestAnimationFrame(frame);
        else el.textContent = format(el, target);
      }

      root.requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in root)) {
      nodes.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });

    nodes.forEach(function (el) { io.observe(el); });

    root.setTimeout(function () { nodes.forEach(run); }, 6000);
  }


  /* ---------- Arranque ---------- */
  function boot() {
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initReveal, "reveal");
    safe(initChange, "change");
    safe(initInView, "inview");
    safe(initProcess, "process");
    safe(initCounters, "counters");
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  root.__IONN__.safe = safe;

})(window, document);
