/* ==========================================================================
   IONN CONSULTING · bg-video.js
   Fondo de video fijo (efecto parallax): el video permanece estático
   en viewport mientras el contenido se desliza encima.
   ========================================================================== */
(function (doc) {
  "use strict";

  var video = doc.getElementById("bgVideo");
  if (!video) return;

  // Respeta "reducir movimiento" del sistema operativo
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    video.pause();
    video.removeAttribute("autoplay");
    return;
  }

  // Intento explícito de reproducción por si el navegador bloquea
  // el autoplay declarativo (ocurre en algunos casos aun con muted).
  function tryPlay() {
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
        // Sin autoplay disponible: el poster queda como fondo estático.
      });
    }
  }

  if (video.readyState >= 2) {
    tryPlay();
  } else {
    video.addEventListener("loadeddata", tryPlay, { once: true });
  }

  // Pausar cuando la pestaña no está visible (ahorro de batería/CPU)
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) {
      video.pause();
    } else if (!reduceMotion) {
      tryPlay();
    }
  });

})(document);
