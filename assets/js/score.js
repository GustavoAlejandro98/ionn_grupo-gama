/* ==========================================================================
   IONN CONSULTING · score.js
   Diagnóstico de Crecimiento + IONN Growth Score™

   El motor es determinista: puntúa las señales que la persona declara.
   No inventa un análisis que no hizo. Cuando /api/diagnostico esté
   encendido, se suma encima la capa cualitativa que sí lee las páginas.

   Sin type="module": IIFE sobre window.__IONN__
   ========================================================================== */
(function (root, doc) {
  "use strict";

  root.__IONN__ = root.__IONN__ || {};

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Si la capa opcional truena, el resultado determinista sigue en pantalla.
  function safeCall(fn) {
    try { fn(); } catch (e) { if (root.console && console.warn) console.warn("[IONN]", e); }
  }

  var reduceMotion = false;
  try { reduceMotion = root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ══════════════════════════════════════════════════════════════
     1. Niveles de madurez
     El semáforo rojo→azul del planteamiento original no separaba bien
     para daltonismo (naranja y rojo quedaban a ΔE 12.8, por debajo del
     piso de 15). Esta escala sí pasa, y además evita el tono de
     auditoría "bueno vs malo": va de oportunidad a madurez.
     ══════════════════════════════════════════════════════════════ */
  var LEVELS = [
    { min: 0,  max: 29,  key: "construir",  label: "Por construir",     color: "#FF8C42" },
    { min: 30, max: 49,  key: "desarrollo", label: "En desarrollo",     color: "#FFD84D" },
    { min: 50, max: 69,  key: "crecimiento",label: "En crecimiento",    color: "#18E0FF" },
    { min: 70, max: 84,  key: "posicionado",label: "Bien posicionado",  color: "#2BFF95" },
    { min: 85, max: 100, key: "potencial",  label: "Potencial alto",    color: "#9D5CFF" }
  ];

  function levelOf(score) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (score <= LEVELS[i].max) return LEVELS[i];
    }
    return LEVELS[LEVELS.length - 1];
  }

  function bandOf(score) {
    return score < 50 ? "bajo" : score < 75 ? "medio" : "alto";
  }

  /* Qué tan rápido se mueve cada dimensión. Arreglar una ficha de Google
     es cuestión de días; reconstruir una marca, de meses. */
  var EASE = { google: 1, redes: 0.85, ia: 0.7, web: 0.55, marca: 0.5, conexion: 0.9 };

  /* ══════════════════════════════════════════════════════════════
     2. Contenido — se lee del <template id="scoreCopy"> del HTML
     ══════════════════════════════════════════════════════════════ */
  var COPY = {};
  var CLOSING = {};

  (function readCopy() {
    var tpl = doc.getElementById("scoreCopy");
    if (!tpl || !tpl.content) return;

    $$("div[data-dim]", tpl.content).forEach(function (block) {
      var dim = block.getAttribute("data-dim");

      if (dim === "__cierre__") {
        $$("p[data-band]", block).forEach(function (p) {
          CLOSING[p.getAttribute("data-band")] = p.textContent.trim();
        });
        return;
      }

      var entry = {
        label: block.getAttribute("data-label") || dim,
        weight: parseFloat(block.getAttribute("data-weight")) || 0,
        bands: {},
        signals: []
      };

      $$("p[data-band]", block).forEach(function (p) {
        entry.bands[p.getAttribute("data-band")] = p.textContent.trim();
      });

      $$("li[data-signal]", block).forEach(function (li) {
        var span = li.querySelector("span");
        var opp = span ? span.textContent.trim() : "";
        if (span) span.remove();
        entry.signals.push({
          id: li.getAttribute("data-signal"),
          w: parseFloat(li.getAttribute("data-w")) || 0,
          label: li.textContent.trim(),
          opportunity: opp
        });
      });

      COPY[dim] = entry;
    });
  })();

  /* ══════════════════════════════════════════════════════════════
     3. Rúbrica — de lo que la persona declara a señales presentes
     ══════════════════════════════════════════════════════════════ */

  var PLATFORM_HOSTS = [
    "wixsite.com", "blogspot.", "wordpress.com", "weebly.com", "mystrikingly.com",
    "webnode.", "jimdosite.com", "square.site", "godaddysites.com", "linktr.ee",
    "beacons.ai", "carrd.co", "notion.site", "github.io", "netlify.app", "vercel.app"
  ];

  function normalizeUrl(value) {
    var v = String(value || "").trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { return new URL(v); } catch (e) { return null; }
  }

  function evaluate(data) {
    var present = {};
    var mark = function (id) { present[id] = true; };

    var web = normalizeUrl(data.web);
    var socials = (data.socials || []).filter(Boolean);
    var hasGoogle = !!data.google;
    var hasBrand = (data.brandAssets || []).length > 0;
    var found = data.foundBy || [];
    var describes = String(data.what || "").trim().length >= 35;

    /* — Marca — */
    if (hasBrand) mark("marca_material");
    if (socials.length + (web ? 1 : 0) + (hasGoogle ? 1 : 0) >= 2) mark("marca_multicanal");
    if (describes) mark("marca_propuesta");
    if (web) mark("marca_casa");

    /* — Web — */
    if (web) {
      mark("web_existe");
      var host = web.hostname.toLowerCase();
      var onPlatform = PLATFORM_HOSTS.some(function (h) { return host.indexOf(h) !== -1; });
      if (!onPlatform) mark("web_dominio");
      // El campo se normaliza a https, así que solo cuenta si la persona
      // no escribió explícitamente http://
      if (!/^http:\/\//i.test(String(data.web || "").trim())) mark("web_segura");
      if (found.indexOf("web") !== -1) mark("web_destino");
    }

    /* — Google — */
    if (hasGoogle) mark("google_ficha");
    if (found.indexOf("google") !== -1) mark("google_canal");
    if (web) mark("google_indexable");
    if (String(data.city || "").trim()) mark("google_local");

    /* — Redes — */
    if (socials.length >= 1) mark("redes_presencia");
    if (socials.length >= 2) mark("redes_varias");
    if (found.indexOf("redes") !== -1) mark("redes_canal");
    if (found.indexOf("whatsapp") !== -1 || data.whatsapp) mark("redes_contacto");

    /* — Nuevas formas de búsqueda — */
    var touchpoints = socials.length + (web ? 1 : 0) + (hasGoogle ? 1 : 0) + (hasBrand ? 1 : 0);
    if (touchpoints >= 3) mark("ia_cobertura");
    if (web) mark("ia_web");
    if (hasGoogle) mark("ia_google");
    if (describes) mark("ia_claridad");

    /* — ¿Qué es evaluable? —
       Sin página web, WEB no vale cero: no se evalúa y su peso se
       reparte entre las demás. Un negocio que vive de redes y Google
       puede sacar 80 sin tener página. */
    var evaluable = {
      marca: true,
      web: !!web,
      google: true,
      redes: socials.length > 0 || found.indexOf("redes") !== -1,
      ia: true
    };

    /* — Puntaje por dimensión — */
    var dims = [];
    Object.keys(COPY).forEach(function (key) {
      if (key === "conexion") return;
      var def = COPY[key];
      var got = 0, missing = [];

      def.signals.forEach(function (sig) {
        if (present[sig.id]) got += sig.w;
        else missing.push(sig);
      });

      dims.push({
        key: key,
        label: def.label,
        weight: def.weight,
        evaluable: evaluable[key] !== false,
        // Techo declarativo: este motor puntúa presencia y consistencia
        // a partir de lo que la persona declara, no la calidad de lo que
        // hay dentro. Por eso ninguna dimensión llega a 100 sin que
        // alguien haya mirado de verdad. La capa de IA sí puede subirlo.
        score: Math.round(got * 0.92),
        missing: missing.sort(function (a, b) { return b.w - a.w; }),
        signals: def.signals,
        present: present
      });
    });

    /* — Puntaje general: solo con lo que se pudo evaluar — */
    var live = dims.filter(function (d) { return d.evaluable; });
    var totalWeight = live.reduce(function (s, d) { return s + d.weight; }, 0) || 1;
    var overall = Math.round(
      live.reduce(function (s, d) { return s + d.score * d.weight; }, 0) / totalWeight
    );
    overall = clamp(overall, 0, 100);

    /* — Dispersión: ¿los canales van parejos? — */
    var mean = live.reduce(function (s, d) { return s + d.score; }, 0) / (live.length || 1);
    var spread = Math.sqrt(
      live.reduce(function (s, d) { return s + Math.pow(d.score - mean, 2); }, 0) / (live.length || 1)
    );

    /* — Oportunidades: brecha × peso × facilidad — */
    var opportunities = live
      .filter(function (d) { return d.missing.length; })
      .map(function (d) {
        var gap = (100 - d.score) / 100;
        return {
          key: d.key,
          label: d.label,
          priority: gap * (d.weight / 100) * (EASE[d.key] || 0.7),
          title: d.missing[0].opportunity,
          text: COPY[d.key].bands[bandOf(d.score)]
        };
      })
      .sort(function (a, b) { return b.priority - a.priority; });

    /* Si los canales están muy desparejos, el problema real no es
       ninguna dimensión: es que trabajan por separado. */
    if (spread > 18 && COPY.conexion) {
      opportunities.splice(Math.min(1, opportunities.length), 0, {
        key: "conexion",
        label: COPY.conexion.label,
        priority: 99,
        title: COPY.conexion.signals[0].opportunity,
        text: COPY.conexion.bands.unica
      });
    }

    return {
      overall: overall,
      level: levelOf(overall),
      dims: dims,
      opportunities: opportunities.slice(0, 3),
      coverage: live.length,
      coverageTotal: dims.length,
      spread: Math.round(spread),
      closing: CLOSING[bandOf(overall)] || ""
    };
  }

  /* ══════════════════════════════════════════════════════════════
     4. Estado del formulario
     ══════════════════════════════════════════════════════════════ */
  var STEPS = ["intro", "activos", "datos", "analisis", "resultado"];

  // Avance visible en la barra superior. La gente abandona cuando no sabe
  // cuánto falta, así que el porcentaje es explícito desde el primer paso.
  var PCT = { intro: 0, activos: 25, datos: 65, analisis: 92, resultado: 100 };
  var state = { assets: [], result: null };

  function currentData() {
    var socials = $$("[data-social]").map(function (i) { return i.value.trim(); }).filter(Boolean);
    var brand = $$("[data-brand]:checked").map(function (i) { return i.value; });
    var found = $$("[data-found]:checked").map(function (i) { return i.value; });
    return {
      web: ($("#fWeb") || {}).value || "",
      google: ($("#fGoogle") || {}).value || "",
      socials: socials,
      brandAssets: brand,
      foundBy: found,
      whatsapp: found.indexOf("whatsapp") !== -1,
      name: ($("#fName") || {}).value || "",
      what: ($("#fWhat") || {}).value || "",
      city: ($("#fCity") || {}).value || "",
      industry: "",
      goal: "",
      note: ""
    };
  }

  /* ══════════════════════════════════════════════════════════════
     5. Navegación entre pasos
     ══════════════════════════════════════════════════════════════ */
  function goTo(name) {
    $$(".step").forEach(function (s) {
      s.classList.toggle("is-active", s.getAttribute("data-step") === name);
    });

    var idx = STEPS.indexOf(name);
    var pct = PCT[name] || 0;

    var bar = $("#diagProgress");
    if (bar) {
      bar.style.setProperty("--p", (pct / 100).toFixed(3));
      bar.hidden = idx === 0;
      var lab = $("#diagStepLabel");
      if (lab) {
        lab.textContent = name === "activos" ? "Paso 1 de 2"
          : name === "datos" ? "Paso 2 de 2"
          : name === "analisis" ? "Analizando"
          : "Tu diagnóstico";
      }
      var pctNode = $("#diagPct");
      if (pctNode) pctNode.textContent = pct + "%";
    }

    // El CTA flotante solo tiene sentido mientras se lee el resultado
    var sticky = $("#stickyCta");
    if (sticky && name !== "resultado") {
      sticky.hidden = true;
      var dk = $("#dock");
      if (dk) dk.classList.remove("is-lifted");
    }

    var head = $(".step.is-active .step__head");
    if (head && idx > 0) {
      head.setAttribute("tabindex", "-1");
      head.focus({ preventScroll: true });
    }
    root.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ══════════════════════════════════════════════════════════════
     6. Paso 1 · Qué analizamos
     ══════════════════════════════════════════════════════════════ */
  var ASSET_DIM = {
    web: "web", google: "google", marca: "marca",
    instagram: "redes", facebook: "redes", linkedin: "redes", tiktok: "redes"
  };

  function refreshCoverage() {
    var covered = {};
    state.assets.forEach(function (a) {
      if (ASSET_DIM[a]) covered[ASSET_DIM[a]] = true;
    });
    covered.ia = true; // siempre se puede leer algo sobre el negocio

    var n = Object.keys(covered).length;
    var meter = $("#coverageBar");
    var label = $("#coverageLabel");
    var note = $("#coverageNote");

    if (meter) meter.style.setProperty("--p", (n / 5).toFixed(3));
    if (label) label.textContent = n + " de 5 áreas";
    if (note) {
      note.textContent = n >= 4
        ? "Con esto podemos revisar casi todo."
        : n >= 2
          ? "Mientras más marques, más completo será."
          : "Con poco también sirve. Mientras más marques, más completo será.";
    }

    var next = $("#toDatos");
    if (next) next.disabled = state.assets.length === 0;
  }

  function initAssets() {
    $$("[data-asset]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var id = chip.getAttribute("data-asset");
        var i = state.assets.indexOf(id);

        if (id === "nose") {
          // "No estoy seguro" es excluyente: limpia lo demás.
          state.assets = i === -1 ? ["nose"] : [];
        } else {
          state.assets = state.assets.filter(function (a) { return a !== "nose"; });
          if (i === -1) state.assets.push(id); else state.assets.splice(i, 1);
        }

        $$("[data-asset]").forEach(function (c) {
          c.classList.toggle("is-on", state.assets.indexOf(c.getAttribute("data-asset")) !== -1);
          c.setAttribute("aria-pressed", state.assets.indexOf(c.getAttribute("data-asset")) !== -1 ? "true" : "false");
        });

        var unsure = $("#unsureNote");
        if (unsure) unsure.hidden = state.assets.indexOf("nose") === -1;

        refreshCoverage();
      });
    });
    refreshCoverage();
  }

  /* ══════════════════════════════════════════════════════════════
     7. Paso 2 · Los campos aparecen según lo que elegiste
     ══════════════════════════════════════════════════════════════ */
  function buildFields() {
    $$("[data-field]").forEach(function (f) {
      var id = f.getAttribute("data-field");
      var on = state.assets.indexOf(id) !== -1;
      f.hidden = !on;
      if (!on) {
        $$("input", f).forEach(function (i) {
          if (i.type === "checkbox") i.checked = false; else i.value = "";
        });
      }
    });

    // Con "no estoy seguro" no hay enlaces que pedir, pero el nombre,
    // la ciudad y el resto del paso siguen ahí: no hay pantalla vacía.
  }

  /* ══════════════════════════════════════════════════════════════
     8. Análisis y resultado
     ══════════════════════════════════════════════════════════════ */
  function runAnalysis() {
    goTo("analisis");

    var beats = $$(".analysis__beat");
    var step = reduceMotion ? 60 : 520;

    beats.forEach(function (b, i) {
      root.setTimeout(function () { b.classList.add("is-on"); }, i * step);
    });

    root.setTimeout(function () {
      state.result = evaluate(currentData());
      render(state.result);
      goTo("resultado");
      safeCall(function () { enhance(state.result); });
    }, beats.length * step + (reduceMotion ? 60 : 420));
  }


  /* ══════════════════════════════════════════════════════════════
     8b. Capa de IA — opcional
     El resultado determinista ya está en pantalla. Si /api/diagnostico
     contesta, reemplaza las interpretaciones por las que sí leyeron la
     página. Si no contesta, no pasa nada y nadie se entera.
     ══════════════════════════════════════════════════════════════ */
  function enhance(r) {
    if (root.location.protocol === "file:") return;

    var d = currentData();
    var scores = {};
    r.dims.forEach(function (x) { scores[x.key] = x.evaluable ? x.score : null; });

    var controller = root.AbortController ? new root.AbortController() : null;
    var timer = controller ? root.setTimeout(function () { controller.abort(); }, 28000) : 0;

    var flag = $("#aiFlag");
    if (flag) flag.hidden = false;

    fetch("/api/diagnostico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        web: d.web, google: d.google, socials: d.socials,
        brandAssets: d.brandAssets, foundBy: d.foundBy,
        name: d.name, what: d.what, industry: d.industry,
        city: d.city, goal: d.goal, note: d.note,
        scores: scores, overall: r.overall
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) { if (!res.ok) throw new Error("no"); return res.json(); })
      .then(function (ai) {
        if (timer) root.clearTimeout(timer);

        if (ai.dims) {
          $$(".dim").forEach(function (li, i) {
            var key = r.dims[i] && r.dims[i].key;
            var txt = key && ai.dims[key];
            var node = li.querySelector(".dim__text");
            if (txt && node && r.dims[i].evaluable) node.textContent = txt;
          });
        }

        if (ai.opportunities && ai.opportunities.length) {
          var opps = $("#opportunities");
          if (opps) {
            opps.innerHTML = "";
            ai.opportunities.forEach(function (o, i) {
              var li = doc.createElement("li");
              li.className = "opp";
              li.innerHTML =
                '<span class="opp__num">0' + (i + 1) + '</span>' +
                '<span class="opp__dim">' + (COPY[o.dim] ? COPY[o.dim].label : "Oportunidad") + '</span>' +
                '<h3 class="opp__title"></h3><p class="opp__text"></p>';
              li.querySelector(".opp__title").textContent = o.title || "";
              li.querySelector(".opp__text").textContent = o.text || "";
              opps.appendChild(li);
            });
          }
        }

        var closing = $("#resultClosing");
        if (ai.closing && closing) closing.textContent = ai.closing;

        if (flag) {
          flag.textContent = ai.site && ai.site.reachable
            ? "Análisis con IA · revisamos tu página en vivo"
            : "Análisis con IA · no alcanzamos tu página, interpretamos lo que compartiste";
          flag.classList.add("is-done");
        }
      })
      .catch(function () {
        if (timer) root.clearTimeout(timer);
        if (flag) flag.hidden = true;
      });
  }

  function countUp(node, target) {
    if (reduceMotion) { node.textContent = target; return; }
    var t0 = 0, dur = 1500;
    function frame(now) {
      if (!t0) t0 = now;
      var t = clamp((now - t0) / dur, 0, 1);
      var e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = Math.round(target * e);
      if (t < 1) root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  function render(r) {
    var data = currentData();

    /* — Cabecera del resultado — */
    var who = $("#resultWho");
    if (who) who.textContent = data.name ? data.name : "tu negocio";

    var ring = $("#scoreRing");
    if (ring) {
      var len = 2 * Math.PI * 86;
      ring.style.strokeDasharray = len + " " + len;
      ring.style.strokeDashoffset = reduceMotion
        ? len * (1 - r.overall / 100)
        : len;
      ring.style.stroke = r.level.color;
      if (!reduceMotion) {
        root.setTimeout(function () {
          ring.style.transition = "stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)";
          ring.style.strokeDashoffset = len * (1 - r.overall / 100);
        }, 60);
      }
    }

    var num = $("#scoreNumber");
    if (num) countUp(num, r.overall);

    var lvl = $("#scoreLevel");
    if (lvl) {
      lvl.textContent = r.level.label;
      lvl.style.setProperty("--c", r.level.color);
    }

    var cov = $("#resultCoverage");
    if (cov) cov.textContent = "Analizamos " + r.coverage + " de " + r.coverageTotal + " áreas";

    /* — Desglose — */
    var list = $("#breakdown");
    if (list) {
      list.innerHTML = "";
      r.dims.forEach(function (d, i) {
        var li = doc.createElement("li");
        li.className = "dim" + (d.evaluable ? "" : " dim--na");

        if (!d.evaluable) {
          li.innerHTML =
            '<div class="dim__head"><h3 class="dim__name">' + d.label + '</h3>' +
            '<span class="dim__na">No evaluable</span></div>' +
            '<div class="dim__bar"><i style="--p:0"></i></div>' +
            '<p class="dim__text">Todavía no tienes este punto de contacto, así que no entra en el promedio. ' +
            'Dependiendo de tu modelo de negocio, esto puede ser justo tu mayor oportunidad.</p>' +
            '<p class="dim__opp"><b>Oportunidad principal</b> ' + (d.missing[0] ? d.missing[0].opportunity : "") + '</p>';
        } else {
          var lv = levelOf(d.score);
          li.innerHTML =
            '<div class="dim__head"><h3 class="dim__name">' + d.label + '</h3>' +
            '<span class="dim__score">' + d.score + '<small>/100</small></span>' +
            '<span class="dim__level" style="--c:' + lv.color + '">' + lv.label + '</span></div>' +
            '<div class="dim__bar"><i style="--p:0;--c:' + lv.color + '"></i></div>' +
            '<p class="dim__text">' + COPY[d.key].bands[bandOf(d.score)] + '</p>' +
            (d.missing.length
              ? '<p class="dim__opp"><b>Oportunidad principal</b> ' + d.missing[0].opportunity + '</p>'
              : '<p class="dim__opp"><b>Sin brechas</b> Esta dimensión está completa según lo que compartiste.</p>');
        }

        list.appendChild(li);

        var bar = li.querySelector(".dim__bar i");
        var target = d.evaluable ? d.score / 100 : 0;
        root.setTimeout(function () {
          bar.style.setProperty("--p", target.toFixed(3));
        }, reduceMotion ? 0 : 400 + i * 130);
      });
    }

    /* — Oportunidades — */
    var oppHead = $("#oppHead");
    if (oppHead) {
      var n = r.opportunities.length;
      oppHead.textContent = n === 1 ? "Tu principal oportunidad"
        : n === 2 ? "Tus dos principales oportunidades"
        : "Tus tres principales oportunidades";
    }

    var opps = $("#opportunities");
    if (opps) {
      opps.innerHTML = "";
      r.opportunities.forEach(function (o, i) {
        var li = doc.createElement("li");
        li.className = "opp";
        li.innerHTML =
          '<span class="opp__num">0' + (i + 1) + '</span>' +
          '<span class="opp__dim">' + o.label + '</span>' +
          '<h3 class="opp__title">' + o.title + '</h3>' +
          '<p class="opp__text">' + o.text + '</p>';
        opps.appendChild(li);
      });
      var none = $("#oppNone");
      if (none) none.hidden = r.opportunities.length > 0;
    }

    /* — Cuando casi no compartieron nada, hay que decirlo — */
    var thin = $("#thinNote");
    if (thin) thin.hidden = !(r.coverage <= 2 || r.overall === 0);

    /* — Cierre — */
    var closing = $("#resultClosing");
    if (closing) closing.textContent = r.closing;

    /* — WhatsApp con el diagnóstico dentro — */
    var wa = $("#leadWhats");
    if (wa) {
      wa.setAttribute("data-score", r.overall);
      wa.setAttribute("data-level", r.level.label);
      wa.setAttribute("data-opp", r.opportunities.map(function (o) { return o.label; }).join(", "));
    }
  }

  /* ══════════════════════════════════════════════════════════════
     9. Captura del lead — después del resultado, nunca antes
     ══════════════════════════════════════════════════════════════ */
  function initLead() {
    var form = $("#leadForm");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = currentData();
      var r = state.result;

      var lines = [
        "Hola IONN, acabo de hacer el diagnóstico y quiero revisarlo con ustedes.",
        "",
        "Nombre: " + (($("#lName") || {}).value || ""),
        "Empresa: " + (($("#lCompany") || {}).value || d.name || ""),
        "Correo: " + (($("#lEmail") || {}).value || ""),
        "Teléfono: " + (($("#lPhone") || {}).value || "")
      ];

      if (r) {
        lines.push("");
        lines.push("IONN Growth Score: " + r.overall + "/100 — " + r.level.label);
        lines.push("Oportunidades: " + r.opportunities.map(function (o) { return o.label; }).join(" · "));
      }

      var url = "https://wa.me/522296478519?text=" + encodeURIComponent(lines.join("\n"));
      root.open(url, "_blank", "noopener");

      var ok = $("#leadDone");
      if (ok) ok.hidden = false;
    });
  }


  /* ══════════════════════════════════════════════════════════════
     9b. CTA flotante del resultado
     Aparece al pasar el puntaje y se retira cuando el formulario
     ya está en pantalla: si te convence a la mitad, no tienes que
     bajar hasta el final para actuar.
     ══════════════════════════════════════════════════════════════ */
  function initSticky() {
    var sticky = $("#stickyCta");
    var lead = $("#leadSection");
    var go = $("#stickyGo");
    var dock = $("#dock");
    var score = $(".score");
    if (!sticky || !lead || !go || !score) return;

    function show(on) {
      sticky.hidden = !on;
      if (dock) dock.classList.toggle("is-lifted", on);
    }

    go.addEventListener("click", function () {
      lead.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      var first = $("#lName");
      if (first) root.setTimeout(function () { first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 600);
    });

    if (!("IntersectionObserver" in root)) return;

    var pastScore = false, leadVisible = false;
    var sync = function () { show(pastScore && !leadVisible); };

    new IntersectionObserver(function (e) {
      pastScore = e[0].boundingClientRect.top < 0;
      sync();
    }, { threshold: 0 }).observe(score);

    new IntersectionObserver(function (e) {
      leadVisible = e[0].isIntersecting;
      sync();
    }, { threshold: 0.12 }).observe(lead);
  }

  /* ══════════════════════════════════════════════════════════════
     10. Arranque
     ══════════════════════════════════════════════════════════════ */
  function boot() {
    if (!$(".step")) return;

    initAssets();
    initLead();
    safeCall(initSticky);

    $$("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-goto");
        if (target === "datos") buildFields();
        if (target === "analisis") { runAnalysis(); return; }
        goTo(target);
      });
    });

    goTo("intro");
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  root.__IONN__.score = { evaluate: evaluate, levels: LEVELS, goTo: goTo };

})(window, document);
