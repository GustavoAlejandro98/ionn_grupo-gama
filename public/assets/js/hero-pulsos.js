/* ==========================================================================
   IONN CONSULTING · hero-pulsos.js
   Concepto 3: El Pulso del Descubrimiento
   Ondas concéntricas desde múltiples puntos que interfieren entre sí.
   ========================================================================== */
(function (root, doc) {
  "use strict";

  var canvas = doc.getElementById("heroPulsos");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Configurar canvas
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { passive: true });

  // Estado de ondas
  var waves = [];
  var time = 0;
  var nextWaveTime = 0;

  // Colores para las ondas
  var colors = [
    { r: 24, g: 224, b: 255 },    // Cyan
    { r: 157, g: 92, b: 255 },    // Violet
    { r: 43, g: 255, b: 149 },    // Green
  ];

  // Clase para las ondas
  function Wave(x, y, color) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 200;
    this.speed = 1.2 + Math.random() * 1;
    this.color = color;
    this.alpha = 1;
    this.age = 0;
    this.lifetime = 4;
  }

  Wave.prototype.update = function() {
    this.age += 0.016;
    this.radius += this.speed;
    this.alpha = Math.max(0, 1 - (this.age / this.lifetime));
  };

  Wave.prototype.isAlive = function() {
    return this.age < this.lifetime;
  };

  Wave.prototype.draw = function(ctx) {
    // Círculo principal
    ctx.strokeStyle = "rgba(" + this.color.r + "," + this.color.g + "," + this.color.b + "," + (this.alpha * 0.7) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Resplandor interior
    ctx.strokeStyle = "rgba(" + this.color.r + "," + this.color.g + "," + this.color.b + "," + (this.alpha * 0.2) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  };

  function animate() {
    var w = canvas.width;
    var h = canvas.height;

    // Limpiar con fade
    ctx.fillStyle = "rgba(10, 10, 15, 0.2)";
    ctx.fillRect(0, 0, w, h);

    time += 0.016;

    // Generar nuevas ondas
    if (time > nextWaveTime) {
      var x = Math.random() * w * 0.6 + w * 0.2;
      var y = Math.random() * h * 0.6 + h * 0.2;
      var colorIndex = Math.floor(Math.random() * colors.length);

      var wave = new Wave(x, y, colors[colorIndex]);
      waves.push(wave);

      nextWaveTime = time + (2 + Math.random() * 2);
    }

    // Actualizar y dibujar ondas
    waves = waves.filter(function(w) { return w.isAlive(); });

    waves.forEach(function(wave) {
      wave.update();
      wave.draw(ctx);
    });

    // Detectar interferencias
    for (var i = 0; i < waves.length; i++) {
      for (var j = i + 1; j < waves.length; j++) {
        var w1 = waves[i];
        var w2 = waves[j];

        var dx = w1.x - w2.x;
        var dy = w1.y - w2.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        var minDist = Math.abs(w1.radius - w2.radius);
        var maxDist = w1.radius + w2.radius;

        // Si los círculos se intersectan, dibujar punto de interferencia
        if (dist <= maxDist && dist >= minDist && dist > 0) {
          var t = (w1.radius - minDist) / (maxDist - minDist + 0.01);
          var ix = w1.x + (w2.x - w1.x) * t;
          var iy = w1.y + (w2.y - w1.y) * t;

          // Mezclar colores
          var r = Math.round((w1.color.r + w2.color.r) / 2);
          var g = Math.round((w1.color.g + w2.color.g) / 2);
          var b = Math.round((w1.color.b + w2.color.b) / 2);
          var avgAlpha = (w1.alpha + w2.alpha) / 2;

          // Punto de interferencia
          ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (avgAlpha * 0.9) + ")";
          ctx.beginPath();
          ctx.arc(ix, iy, 4, 0, Math.PI * 2);
          ctx.fill();

          // Resplandor
          ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + (avgAlpha * 0.4) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ix, iy, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();

})(window, document);
