/* ==========================================================================
   IONN CONSULTING · chat.js
   Asesor digital + botón de WhatsApp.

   Dos modos:
     · conectado — habla con /api/chat, que a su vez habla con Gemini.
     · guiado    — si /api/chat no responde, usa la base de conocimiento
                   que vive en el <template id="chatKB"> del HTML.
   El visitante nunca ve un error: el chat siempre responde algo útil.

   Sin type="module": IIFE sobre window.__IONN__
   ========================================================================== */
(function (root, doc) {
  "use strict";

  root.__IONN__ = root.__IONN__ || {};

  var toggle = doc.getElementById("chatToggle");
  var panel = doc.getElementById("chatPanel");
  var log = doc.getElementById("chatLog");
  var form = doc.getElementById("chatForm");
  var input = doc.getElementById("chatInput");
  var suggest = doc.getElementById("chatSuggest");
  var closeBtn = doc.getElementById("chatClose");
  var kb = doc.getElementById("chatKB");

  if (!toggle || !panel || !log || !form || !input) return;

  /* ---------- Estado ---------- */
  var history = [];        // [{role:'user'|'model', text}]
  var userTurns = 0;       // cuántas veces ha escrito la persona
  var bridgeShown = false; // el puente al diagnóstico va una sola vez
  var guided = false;      // ¿ya sabemos que el proxy no está disponible?
  var busy = false;
  var open = false;

  // En file:// no hay backend posible: arrancamos guiados desde el inicio.
  if (root.location.protocol === "file:") guided = true;

  /* ---------- Base de conocimiento del modo guiado ---------- */
  var KB = {};
  var KB_FALLBACK = null;

  (function readKB() {
    if (!kb || !kb.content) return;
    var articles = kb.content.querySelectorAll("article[data-q]");
    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      var entry = {
        html: a.innerHTML,
        bridge: a.getAttribute("data-bridge") === "1"
      };
      if (a.getAttribute("data-q") === "__fallback__") KB_FALLBACK = entry;
      else KB[a.getAttribute("data-q")] = entry;
    }
  })();

  /* ---------- Pintar mensajes ---------- */

  function el(tag, cls) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function addUser(text) {
    var box = el("div", "msg msg--user");
    var p = el("p");
    p.textContent = text;
    box.appendChild(p);
    log.appendChild(box);
    scrollDown();
  }

  function addAI(text, isHTML) {
    var box = el("div", "msg msg--ai");
    if (isHTML) {
      box.innerHTML = text;
    } else {
      // Texto plano del modelo: cada renglón vacío separa párrafo.
      var chunks = String(text).split(/\n{2,}|\n/).filter(function (s) { return s.trim(); });
      for (var i = 0; i < chunks.length; i++) {
        var p = el("p");
        p.textContent = chunks[i].trim();
        box.appendChild(p);
      }
    }
    log.appendChild(box);
    scrollDown();
    return box;
  }

  function addTyping() {
    var box = el("div", "msg msg--ai msg--typing");
    box.setAttribute("aria-label", "Escribiendo");
    box.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(box);
    scrollDown();
    return box;
  }

  /* ---------- Puente al diagnóstico ----------
     Regla: nunca en la primera respuesta, nunca más de una vez. */
  function maybeBridge(box, allowed) {
    if (!allowed || bridgeShown || userTurns < 2) return;
    bridgeShown = true;

    var a = el("a", "msg__cta");
    a.href = "diagnostico.html";
    a.textContent = "Analizar mi negocio";
    box.appendChild(a);
    scrollDown();
  }

  /* ---------- Responder ---------- */

  function answerGuided(question) {
    var entry = KB[question] || KB_FALLBACK;
    if (!entry) {
      entry = { html: "<p>Cuéntame un poco más de tu negocio y lo vemos.</p>", bridge: false };
    }
    var box = addAI(entry.html, true);
    history.push({ role: "model", text: box.textContent });
    maybeBridge(box, entry.bridge);
  }

  function answerRemote(question) {
    var typing = addTyping();

    var controller = null;
    var timer = 0;
    if (root.AbortController) {
      controller = new root.AbortController();
      timer = root.setTimeout(function () { controller.abort(); }, 22000);
    }

    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12) }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error("http_" + r.status);
        return r.json();
      })
      .then(function (data) {
        if (timer) root.clearTimeout(timer);
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        if (!data || !data.reply) throw new Error("empty");

        var box = addAI(data.reply, false);
        history.push({ role: "model", text: data.reply });
        maybeBridge(box, !!data.bridge);
      })
      .catch(function () {
        if (timer) root.clearTimeout(timer);
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        // A partir de aquí el chat sigue siendo útil, sin mostrar un error.
        guided = true;
        answerGuided(question);
      });
  }

  function send(question) {
    var text = String(question || "").trim().slice(0, 700);
    if (!text || busy) return;

    busy = true;
    form.classList.add("is-busy");

    addUser(text);
    history.push({ role: "user", text: text });
    userTurns++;
    input.value = "";

    // Las sugerencias siguen disponibles, pero una vez que la conversación
    // arrancó pasan a una sola fila que se desliza: no se comen el panel.
    if (suggest) {
      var used = suggest.querySelector('button[data-q="' + text.replace(/"/g, '\\"') + '"]');
      if (used && used.parentNode) used.parentNode.removeChild(used);
      suggest.classList.add("is-compact");
      suggest.scrollLeft = 0;
      suggest.hidden = !suggest.querySelector("button[data-q]");
    }

    var done = function () {
      busy = false;
      form.classList.remove("is-busy");
      if (open) input.focus();
    };

    if (guided) {
      root.setTimeout(function () { answerGuided(text); done(); }, 420);
    } else {
      answerRemote(text).then(done, done);
    }
  }

  /* ---------- Abrir y cerrar ---------- */

  function setOpen(next) {
    open = next;
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    toggle.classList.toggle("is-open", next);

    if (next) {
      panel.removeAttribute("hidden");
      // Un cuadro que se abre debe poder escribirse de inmediato.
      root.requestAnimationFrame(function () {
        panel.classList.add("is-open");
        input.focus({ preventScroll: true });
      });
    } else {
      panel.classList.remove("is-open");
      root.setTimeout(function () {
        if (!open) panel.setAttribute("hidden", "");
      }, 260);
      toggle.focus();
    }
  }

  toggle.addEventListener("click", function () { setOpen(!open); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });

  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) setOpen(false);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send(input.value);
  });

  /* Cada sugerencia se enlaza una por una al renderizarse. */
  if (suggest) {
    var chips = suggest.querySelectorAll("button[data-q]");
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener("click", function () {
          send(chip.getAttribute("data-q"));
        });
      })(chips[i]);
    }
  }

  root.__IONN__.chat = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    ask: send,
    isGuided: function () { return guided; }
  };

})(window, document);
