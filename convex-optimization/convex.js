/* Convex Optimization lesson — interactive labs. Uses window.Kit (lesson/labkit.js). */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, out = K.out, note = K.note, fmt = K.fmt;

  function plotCurve(ctx, F, f, x0, x1, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width || 3; ctx.beginPath();
    for (var i = 0; i <= 240; i++) { var x = x0 + i / 240 * (x1 - x0), y = f(x); i ? ctx.lineTo(F.X(x), F.Y(y)) : ctx.moveTo(F.X(x), F.Y(y)); }
    ctx.stroke();
  }

  /* ═════ Lab 0 — drop a ball ═════ */
  (function () {
    var lab = document.getElementById('lab-trap'); if (!lab) return;
    var lands = {
      bumpy: { f: function (x) { return 0.03 * Math.pow(x, 4) - 0.55 * x * x + 0.9 * Math.sin(2.3 * x) + 0.25 * x + 5; }, global: -3.31 },
      bowl: { f: function (x) { return 0.32 * (x + 0.8) * (x + 0.8) + 1.2; }, global: -0.8 }
    };
    var land = 'bumpy', balls, anim = null, s;
    var XD = [-5, 5], YD = [0, 11];
    function f(x) { return lands[land].f(x); }
    function d(x) { return (f(x + 1e-5) - f(x - 1e-5)) / 2e-5; }
    function reset() { if (anim) { clearInterval(anim); anim = null; } balls = []; update(); note(lab, 'Click anywhere above the curve to drop a ball. It rolls downhill with gradient descent.'); }
    function update() {
      var fin = balls.filter(function (b) { return b.done; });
      var ends = {}; fin.forEach(function (b) { ends[Math.round(b.x * 2) / 2] = 1; });
      out(lab, 'n', balls.length); out(lab, 'uniq', Object.keys(ends).length);
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), F = K.frame(ctx, w, h, XD, YD, { xticks: K.range(-4, 4, 2), yticks: K.range(2, 10, 2), xlabel: 'parameter →', ylabel: 'loss' });
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, K.rgba(c.accent, 0.03)); g.addColorStop(1, K.rgba(c.accent, 0.18));
      ctx.beginPath(); for (var i = 0; i <= 240; i++) { var x = XD[0] + i / 240 * 10; i ? ctx.lineTo(F.X(x), F.Y(f(x))) : ctx.moveTo(F.X(x), F.Y(f(x))); }
      ctx.lineTo(F.X(XD[1]), h - F.pb); ctx.lineTo(F.X(XD[0]), h - F.pb); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      plotCurve(ctx, F, f, XD[0], XD[1], c.accent, 3);
      var gx = lands[land].global; K.text(ctx, '★ global', F.X(gx), F.Y(f(gx)) + 22, c.good, '600 11px Inter, sans-serif', 'center');
      balls.forEach(function (b) {
        ctx.strokeStyle = K.rgba(c.muted, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(F.X(b.x0), F.Y(f(b.x0)) - 10); ctx.lineTo(F.X(b.x), F.Y(f(b.x)) - 10); ctx.stroke(); ctx.setLineDash([]);
        var trapped = b.done && Math.abs(b.x - gx) > 0.5;
        K.dot(ctx, F.X(b.x), F.Y(f(b.x)) - 9, 8, trapped ? c.bad : b.done ? c.good : c.hl, c.bg);
      });
    });
    $(lab, 'canvas').addEventListener('pointerdown', function (e) {
      var p = s.point(e), X = K.scale(XD[0], XD[1], 38, s.w - 12), x0 = Math.max(-4.9, Math.min(4.9, X.inv(p.x)));
      balls.push({ x0: x0, x: x0, done: false });
      if (!anim) anim = setInterval(function () {
        var moving = false;
        balls.forEach(function (b) {
          if (b.done) return;
          for (var i = 0; i < 12; i++) { var step = 0.02 * d(b.x); b.x -= step; if (Math.abs(step) < 1e-4) { b.done = true; break; } }
          if (!b.done) moving = true; else settle(b);
        });
        update();
        if (!moving) { clearInterval(anim); anim = null; }
      }, K.reduce ? 0 : 30);
    });
    function settle(b) {
      var gx = lands[land].global, trapped = Math.abs(b.x - gx) > 0.5;
      if (land === 'bumpy') {
        if (trapped) { K.done('cv-t-local'); note(lab, '<b>Trapped!</b> The ball stopped at x = ' + b.x.toFixed(2) + ' (loss ' + f(b.x).toFixed(2) + '), but the global minimum is at x = ' + gx + ' (loss ' + f(gx).toFixed(2) + '). The gradient is zero here, so gradient descent thinks it\'s done.', 'bad'); }
        else note(lab, 'This ball reached the global minimum — because it happened to start in the right valley. Try starting somewhere else.', 'good');
      } else {
        var starts = balls.filter(function (x) { return x.done; }).map(function (x) { return x.x0; });
        if (starts.length >= 3 && Math.max.apply(null, starts) - Math.min.apply(null, starts) >= 4) { K.done('cv-t-bowl'); note(lab, '<b>Every ball ends at the same bottom</b>, no matter where it starts. That\'s the convex guarantee.', 'good'); }
        else note(lab, 'Ball settled at x = ' + b.x.toFixed(2) + '. Drop more from far-apart places.');
      }
    }
    K.seg(lab, 'land', function (v) { land = v; reset(); });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ─── Test functions for chapters 1–2 ─── */
  var FNS = {
    sq: { name: 'x²', f: function (x) { return x * x; }, xd: [-3, 3], yd: [-0.5, 9.5], convex: true, why: 'x² curves upward everywhere (f″ = 2).' },
    abs: { name: '|x|', f: function (x) { return Math.abs(x); }, xd: [-3, 3], yd: [-0.4, 3.4], convex: true, why: '|x| is convex even with its sharp corner — the chord never dips below it.' },
    exp: { name: 'eˣ', f: function (x) { return Math.exp(x); }, xd: [-3, 2.2], yd: [-0.5, 9.5], convex: true, why: 'eˣ curves upward everywhere (f″ = eˣ > 0), even though it has no minimum.' },
    wave: { name: 'wave', f: function (x) { return 0.3 * x * x + Math.sin(1.8 * x) + 1.4; }, xd: [-3.5, 3.5], yd: [-0.2, 6], convex: false, why: 'The wiggles bend downward in places.' },
    dw: { name: 'double well', f: function (x) { return 0.25 * Math.pow(x, 4) - 1.5 * x * x + 3; }, xd: [-2.8, 2.8], yd: [0, 7], convex: false, why: 'The hump in the middle bends downward (f″ = 3x² − 3 < 0 for |x| < 1).' }
  };
  function d2(f, x) { var h = 1e-3; return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h); }

  /* ═════ Lab 1 — the chord test ═════ */
  (function () {
    var lab = document.getElementById('lab-chord'); if (!lab) return;
    var fn = 'sq', a, b, t = 0.5, s, seen = {}, pick = 0;
    // Non-convex functions start inside a locally convex stretch, so the reader has to find the violation
    var defaults = { sq: [-2, 2.5], abs: [-2, 1.5], exp: [-2.5, 1.8], wave: [-1.5, -0.3], dw: [1.2, 2.5] };
    function F(w, h) { var o = FNS[fn]; return { X: K.scale(o.xd[0], o.xd[1], 38, w - 12), Y: K.scale(o.yd[0], o.yd[1], h - 26, 12) }; }
    function viol() { var o = FNS[fn], worst = 0; for (var i = 1; i < 100; i++) { var tt = i / 100, m = tt * a + (1 - tt) * b; worst = Math.max(worst, o.f(m) - (tt * o.f(a) + (1 - tt) * o.f(b))); } return worst; }
    function update() {
      var o = FNS[fn], m = t * a + (1 - t) * b, fc = o.f(m), ch = t * o.f(a) + (1 - t) * o.f(b), v = viol();
      out(lab, 'tv', t.toFixed(2));
      var e1 = out(lab, 'fc', fc.toFixed(3)); e1.className = fc > ch + 1e-9 ? 'bad' : '';
      out(lab, 'ch', ch.toFixed(3));
      if (v > 0.02) {
        note(lab, '<b>Broken!</b> Between these handles the curve rises above the ruler (red) by up to ' + v.toFixed(2) + '. So <b>' + o.name + '</b> is not convex.', 'bad');
        if (!o.convex) K.done('cv-c-break');
      } else note(lab, 'Curve stays below the chord here. ' + (o.convex ? 'Keep trying — for ' + o.name + ' you won\'t break it. ' + o.why : 'Try other handle positions — this one can be broken.'), o.convex ? 'good' : '');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), o = FNS[fn];
      var Fr = K.frame(ctx, w, h, o.xd, o.yd, { xticks: K.range(Math.ceil(o.xd[0]), Math.floor(o.xd[1]), 1), yticks: [], xlabel: 'x' });
      var lo = Math.min(a, b), hi = Math.max(a, b), fa = o.f(a), fb = o.f(b);
      // shade between curve and chord
      for (var i = 0; i < 160; i++) {
        var x1 = lo + i / 160 * (hi - lo), x2 = lo + (i + 1) / 160 * (hi - lo);
        var chord = function (x) { return fa + (fb - fa) * (x - a) / (b - a || 1e-9); };
        var above = o.f((x1 + x2) / 2) > chord((x1 + x2) / 2) + 1e-9;
        ctx.fillStyle = above ? K.rgba(c.bad, 0.35) : K.rgba(c.good, 0.14);
        ctx.beginPath(); ctx.moveTo(Fr.X(x1), Fr.Y(o.f(x1))); ctx.lineTo(Fr.X(x2), Fr.Y(o.f(x2))); ctx.lineTo(Fr.X(x2), Fr.Y(chord(x2))); ctx.lineTo(Fr.X(x1), Fr.Y(chord(x1))); ctx.closePath(); ctx.fill();
      }
      plotCurve(ctx, Fr, o.f, o.xd[0], o.xd[1], c.accent, 3);
      ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Fr.X(a), Fr.Y(fa)); ctx.lineTo(Fr.X(b), Fr.Y(fb)); ctx.stroke();
      var m = t * a + (1 - t) * b, ch = t * fa + (1 - t) * fb;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Fr.X(m), Fr.Y(o.f(m))); ctx.lineTo(Fr.X(m), Fr.Y(ch)); ctx.stroke(); ctx.setLineDash([]);
      K.dot(ctx, Fr.X(m), Fr.Y(ch), 5, c.text); K.dot(ctx, Fr.X(m), Fr.Y(o.f(m)), 5, o.f(m) > ch + 1e-9 ? c.bad : c.accent2);
      K.dot(ctx, Fr.X(a), Fr.Y(fa), 9, c.bg, c.hl); K.dot(ctx, Fr.X(b), Fr.Y(fb), 9, c.bg, c.hl);
      K.text(ctx, 'a', Fr.X(a), Fr.Y(fa) - 14, c.hl, '700 12px Inter, sans-serif', 'center'); K.text(ctx, 'b', Fr.X(b), Fr.Y(fb) - 14, c.hl, '700 12px Inter, sans-serif', 'center');
    });
    K.drag(s, $(lab, 'canvas'), function (p, start) {
      var o = FNS[fn], Fr = F(s.w, s.h), x = Math.max(o.xd[0] + 0.05, Math.min(o.xd[1] - 0.05, Fr.X.inv(p.x)));
      if (start) pick = Math.abs(p.x - Fr.X(a)) < Math.abs(p.x - Fr.X(b)) ? 0 : 1;
      if (pick === 0) a = x; else b = x;
      update();
    });
    K.slider(lab, 't', function (v) { t = v; if (a != null) update(); });
    function setFn(v) { fn = v; a = defaults[v][0]; b = defaults[v][1]; seen[v] = 1; if (Object.keys(seen).length === 5) K.done('cv-c-all'); update(); }
    K.seg(lab, 'fn', setFn);
    $(lab, '[data-reset]').addEventListener('click', function () { setFn(fn); });
    setFn('sq');
  })();

  /* ═════ Lab 2 — curvature ═════ */
  (function () {
    var lab = document.getElementById('lab-curv'); if (!lab) return;
    var fn = 'sq', s;
    var notes = {
      sq: 'x²: curvature f″ = 2 everywhere — always smiling, so convex.',
      exp: 'eˣ: f″ = eˣ is always positive, so convex, even though the curve flattens out to the left.',
      wave: 'The wave\'s curvature dips below zero in several places (red): each red stretch bends like a frown, so it is <b>not</b> convex.',
      dw: '<b>Double well:</b> f″ = 3x² − 3 is negative for −1 &lt; x &lt; 1 — the hump in the middle frowns. That hump is exactly what creates two separate valleys.'
    };
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), o = FNS[fn], split = h * 0.6;
      var X = K.scale(o.xd[0], o.xd[1], 38, w - 12), Y1 = K.scale(o.yd[0], o.yd[1], split - 10, 12);
      var ks = [], kmin = 0, kmax = 0;
      for (var i = 0; i <= 240; i++) { var x = o.xd[0] + i / 240 * (o.xd[1] - o.xd[0]), k = d2(o.f, x); ks.push([x, k]); kmin = Math.min(kmin, k); kmax = Math.max(kmax, k); }
      var span = Math.max(Math.abs(kmin), Math.abs(kmax), 1), Y2 = K.scale(-span, span, h - 14, split + 16);
      for (i = 0; i < ks.length - 1; i++) {
        var neg = ks[i][1] < 0;
        ctx.strokeStyle = neg ? c.bad : c.accent; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X(ks[i][0]), Y1(o.f(ks[i][0]))); ctx.lineTo(X(ks[i + 1][0]), Y1(o.f(ks[i + 1][0]))); ctx.stroke();
        ctx.fillStyle = neg ? K.rgba(c.bad, 0.35) : K.rgba(c.good, 0.25);
        ctx.fillRect(X(ks[i][0]), Math.min(Y2(0), Y2(ks[i][1])), X(ks[i + 1][0]) - X(ks[i][0]) + 0.5, Math.abs(Y2(ks[i][1]) - Y2(0)));
      }
      ctx.strokeStyle = c.border; ctx.beginPath(); ctx.moveTo(38, split); ctx.lineTo(w - 12, split); ctx.stroke();
      ctx.strokeStyle = c.muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(38, Y2(0)); ctx.lineTo(w - 12, Y2(0)); ctx.stroke(); ctx.setLineDash([]);
      K.text(ctx, 'f(x)', 42, 22, c.text2); K.text(ctx, 'curvature f″(x)', 42, split + 14, c.text2); K.text(ctx, '0', 32, Y2(0) + 4, c.muted, null, 'right');
    });
    K.seg(lab, 'fn', function (v) { fn = v; note(lab, notes[v], FNS[v].convex ? 'good' : 'bad'); if (v === 'dw') K.done('cv-k-dw'); s.redraw(); });
    note(lab, notes.sq, 'good');
  })();

  /* ═════ Lab 3 — convex sets ═════ */
  (function () {
    var lab = document.getElementById('lab-sets'); if (!lab) return;
    function poly(pts) { return function (x, y) { var inside = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }; }
    var star = []; for (var i = 0; i < 10; i++) { var r = i % 2 ? 0.38 : 0.9, ang = -Math.PI / 2 + i * Math.PI / 5; star.push([r * Math.cos(ang), r * Math.sin(ang)]); }
    var SH = {
      disk: { inside: function (x, y) { return x * x + y * y <= 0.8 * 0.8; }, convex: true, pts: [[-0.5, 0.3], [0.45, -0.4]] },
      tri: { inside: poly([[0, 0.85], [-0.8, -0.6], [0.8, -0.6]]), convex: true, pts: [[-0.4, -0.4], [0.1, 0.5]] },
      star: { inside: poly(star), convex: false, pts: [[0, -0.7], [0.1, 0]] },
      moon: { inside: function (x, y) { return x * x + y * y <= 0.72 && (x - 0.38) * (x - 0.38) + (y - 0.12) * (y - 0.12) > 0.42; }, convex: false, pts: [[-0.3, 0.5], [-0.4, -0.3]] },
      ell: { inside: poly([[-0.8, -0.8], [0.8, -0.8], [0.8, -0.3], [-0.3, -0.3], [-0.3, 0.8], [-0.8, 0.8]]), convex: false, pts: [[-0.6, -0.55], [-0.55, 0.5]] }
    };
    var shape = 'disk', P, pick = 0, seen = {}, s, img = null, imgKey = '';
    function map(w, h) { var sz = Math.min(w, h) - 30, ox = (w - sz) / 2, oy = (h - sz) / 2; return { X: function (x) { return ox + (x + 1) / 2 * sz; }, Y: function (y) { return oy + (1 - y) / 2 * sz; }, ix: function (px) { return (px - ox) / sz * 2 - 1; }, iy: function (py) { return 1 - (py - oy) / sz * 2; } }; }
    function leaves() { var sh = SH[shape]; for (var i = 0; i <= 200; i++) { var t = i / 200, x = P[0][0] + t * (P[1][0] - P[0][0]), y = P[0][1] + t * (P[1][1] - P[0][1]); if (!sh.inside(x, y)) return true; } return false; }
    function update() {
      var sh = SH[shape], inA = sh.inside(P[0][0], P[0][1]), inB = sh.inside(P[1][0], P[1][1]);
      if (!inA || !inB) note(lab, 'Keep both points <b>inside</b> the shape.', 'warn');
      else if (leaves()) { note(lab, '<b>The straight line leaves the shape!</b> Both points are members, but the path between them isn\'t — so this shape is <b>not convex</b>.', 'bad'); if (!sh.convex) K.done('cv-s-break'); }
      else note(lab, sh.convex ? 'The line stays inside. For this shape it always will: it\'s <b>convex</b>.' : 'The line stays inside here — but this shape has a spot where it won\'t. Keep looking.', sh.convex ? 'good' : '');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), M = map(w, h), sh = SH[shape], key = w + 'x' + h + shape + c.accent;
      if (imgKey !== key) {
        var n = 200, off = document.createElement('canvas'); off.width = off.height = n;
        var o = off.getContext('2d'), id = o.createImageData(n, n), hex = c.accent.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
        var rr = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), bb = parseInt(hex.slice(4, 6), 16);
        for (var j = 0; j < n; j++) for (var i2 = 0; i2 < n; i2++) { var k = (j * n + i2) * 4, inn = sh.inside(i2 / n * 2 - 1, 1 - j / n * 2); id.data[k] = rr; id.data[k + 1] = gg; id.data[k + 2] = bb; id.data[k + 3] = inn ? 70 : 0; }
        o.putImageData(id, 0, 0); img = off; imgKey = key;
      }
      ctx.imageSmoothingEnabled = true; ctx.drawImage(img, M.X(-1), M.Y(1), M.X(1) - M.X(-1), M.Y(-1) - M.Y(1));
      ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (var q = 0; q < 120; q++) {
        var t1 = q / 120, t2 = (q + 1) / 120, xm = P[0][0] + (t1 + t2) / 2 * (P[1][0] - P[0][0]), ym = P[0][1] + (t1 + t2) / 2 * (P[1][1] - P[0][1]);
        ctx.strokeStyle = sh.inside(xm, ym) ? c.good : c.bad; ctx.beginPath();
        ctx.moveTo(M.X(P[0][0] + t1 * (P[1][0] - P[0][0])), M.Y(P[0][1] + t1 * (P[1][1] - P[0][1]))); ctx.lineTo(M.X(P[0][0] + t2 * (P[1][0] - P[0][0])), M.Y(P[0][1] + t2 * (P[1][1] - P[0][1]))); ctx.stroke();
      }
      P.forEach(function (p) { K.dot(ctx, M.X(p[0]), M.Y(p[1]), 9, c.bg, sh.inside(p[0], p[1]) ? c.hl : c.bad); });
    });
    K.drag(s, $(lab, 'canvas'), function (p, start) {
      var M = map(s.w, s.h), x = Math.max(-1, Math.min(1, M.ix(p.x))), y = Math.max(-1, Math.min(1, M.iy(p.y)));
      if (start) pick = Math.hypot(x - P[0][0], y - P[0][1]) < Math.hypot(x - P[1][0], y - P[1][1]) ? 0 : 1;
      P[pick] = [x, y]; update();
    });
    function setShape(v) { shape = v; P = SH[v].pts.map(function (p) { return p.slice(); }); seen[v] = 1; if (Object.keys(seen).length === 5) K.done('cv-s-all'); update(); }
    K.seg(lab, 'shape', setShape);
    $(lab, '[data-reset]').addEventListener('click', function () { setShape(shape); });
    setShape('disk');
  })();

  /* ═════ Lab 4 — condition number ═════ */
  (function () {
    var lab = document.getElementById('lab-kappa'); if (!lab) return;
    var kappa = 4, path = [], player, s, START = [4.2, 2.6];
    function loss(p) { return 0.5 * (p[0] * p[0] + kappa * p[1] * p[1]); }
    function reset() { player && player.stop(); path = [START.slice()]; update(); }
    function update() {
      var rate = (kappa - 1) / (kappa + 1);
      out(lab, 'kv', kappa); out(lab, 'rate', rate.toFixed(3));
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), sc = Math.min(w / 10.4, h / 6.8), X = function (x) { return w / 2 + x * sc; }, Y = function (y) { return h / 2 - y * sc; };
      [0.05, 0.3, 1, 2.5, 5, 9, 14].forEach(function (lv) {
        var L0 = loss(START), L = lv / 14 * L0;
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, Math.sqrt(2 * L) * sc, Math.sqrt(2 * L / kappa) * sc, 0, 0, Math.PI * 2);
        ctx.fillStyle = K.rgba(c.accent, 0.05); ctx.fill(); ctx.strokeStyle = K.rgba(c.accent, 0.4); ctx.lineWidth = 1; ctx.stroke();
      });
      K.text(ctx, '★', w / 2, h / 2 + 5, c.good, '14px sans-serif', 'center');
      ctx.strokeStyle = c.accent2; ctx.lineWidth = 2; ctx.beginPath();
      path.forEach(function (p, i) { i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke();
      if (path.length < 150) path.forEach(function (p) { K.dot(ctx, X(p[0]), Y(p[1]), 2.5, c.accent2); });
      var last = path[path.length - 1]; K.dot(ctx, X(last[0]), Y(last[1]), 7, c.hl, c.bg);
      K.text(ctx, 'κ = ' + kappa + (kappa === 1 ? '  (round bowl)' : kappa >= 50 ? '  (narrow valley)' : ''), 12, 20, c.text2, '600 12px Inter, sans-serif');
    });
    player = K.player($(lab, '[data-act="run"]'), 25, function () {
      var eta = 2 / (1 + kappa), L0 = loss(START);
      for (var i = 0; i < (path.length < 30 ? 1 : 4); i++) {
        var p = path[path.length - 1], np = [p[0] - eta * p[0], p[1] - eta * kappa * p[1]];
        path.push(np);
        if (loss(np) <= 1e-4 * L0 || path.length > 2000) {
          var steps = path.length - 1; out(lab, 'steps', steps); s.redraw();
          if (kappa === 1) { K.done('cv-k-one'); note(lab, '<b>One step.</b> A round bowl: the gradient points straight at the minimum, and the best learning rate jumps right to it.', 'good'); }
          else if (kappa >= 50) { K.done('cv-k-big'); note(lab, '<b>' + steps + ' steps</b> for κ = ' + kappa + '. Each step only removes ' + Math.round(100 * (1 - (kappa - 1) / (kappa + 1))) + '% of the error along the gentle direction.', 'warn'); }
          else note(lab, '<b>' + steps + ' steps</b> for κ = ' + kappa + '. Try κ = 1 and κ ≥ 50 to compare.');
          return false;
        }
      }
      s.redraw();
    });
    K.on(lab, 'run', function () { player.toggle(function () { path = [START.slice()]; out(lab, 'steps', '…'); }); });
    K.slider(lab, 'k', function (v) { kappa = Math.max(1, Math.round(Math.pow(10, v / 50))); out(lab, 'steps', '—'); reset(); });
    $(lab, '[data-reset]').addEventListener('click', function () { K.setSlider(lab, 'k', 30); });
    reset();
  })();

  /* ═════ Lab 5 — ML losses ═════ */
  (function () {
    var lab = document.getElementById('lab-ml'); if (!lab) return;
    var X = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2], noise = [0.1, -0.2, 0.15, -0.1, 0.05, 0.2, -0.15, 0.1];
    var Ylin = X.map(function (x, i) { return 1.5 * x + noise[i] * 3; });
    var Ylog = [0, 0, 1, 0, 1, 0, 1, 1];
    var Ynn = X.map(function (x, i) { return 2 * Math.tanh(1.5 * x) + noise[i]; });
    var models = {
      lin: { f: function (w) { return X.reduce(function (s, x, i) { return s + Math.pow(w * x - Ylin[i], 2); }, 0) / X.length; }, wd: [-2, 5], name: 'Linear regression (mean squared error)',
        good: 'No chord ever goes below the curve: the MSE of a linear model is a perfect parabola in each weight. <b>Convex.</b>' },
      log: { f: function (w) { return X.reduce(function (s, x, i) { var z = w * x; return s + (Ylog[i] ? Math.log(1 + Math.exp(-z)) : Math.log(1 + Math.exp(z))); }, 0) / X.length; }, wd: [-3, 6], name: 'Logistic regression (log loss)',
        good: 'The log loss curves upward everywhere — no violations. <b>Convex</b>, so training always reaches the same answer.' },
      nn: { f: function (w) { return X.reduce(function (s, x, i) { return s + Math.pow(2 * Math.tanh(w * x) - Ynn[i], 2); }, 0) / X.length; }, wd: [-4, 6], name: 'Tiny neural network (tanh unit)',
        good: '' }
    };
    var model = 'lin', seen = {}, worst, s;
    function scan() {
      var m = models[model], n = 0, v = 0; worst = null; var wv = 0;
      for (var i = 0; i <= 50; i++) for (var j = i + 1; j <= 50; j++) {
        var a = m.wd[0] + i / 50 * (m.wd[1] - m.wd[0]), b = m.wd[0] + j / 50 * (m.wd[1] - m.wd[0]), fa = m.f(a), fb = m.f(b);
        for (var k = 1; k < 10; k++) { var t = k / 10, gap = m.f(t * a + (1 - t) * b) - (t * fa + (1 - t) * fb); n++; if (gap > 1e-9) { v++; if (gap > wv) { wv = gap; worst = [a, b]; } } }
      }
      return { n: n, v: v };
    }
    function update() {
      var r = scan(), m = models[model];
      out(lab, 'tests', r.n.toLocaleString()); var e = out(lab, 'viol', r.v.toLocaleString()); e.className = r.v ? 'bad' : 'good';
      note(lab, r.v ? '<b>' + m.name + ':</b> ' + r.v.toLocaleString() + ' chords poke below the curve (worst one in red). The loss flattens out where the tanh unit saturates, creating plateaus and extra dips. <b>Not convex.</b>' : '<b>' + m.name + ':</b> ' + m.good, r.v ? 'bad' : 'good');
      seen[model] = 1; if (Object.keys(seen).length === 3) K.done('cv-m-all');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), m = models[model], ys = [], lo = Infinity, hi = -Infinity;
      for (var i = 0; i <= 200; i++) { var x = m.wd[0] + i / 200 * (m.wd[1] - m.wd[0]), y = m.f(x); ys.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      var F = K.frame(ctx, w, h, m.wd, [lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.08], { xticks: K.range(Math.ceil(m.wd[0]), Math.floor(m.wd[1]), 1), yticks: [], xlabel: 'weight w', ylabel: 'loss' });
      plotCurve(ctx, F, m.f, m.wd[0], m.wd[1], c.accent, 3);
      if (worst) {
        var a = worst[0], b = worst[1];
        ctx.strokeStyle = c.bad; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(F.X(a), F.Y(m.f(a))); ctx.lineTo(F.X(b), F.Y(m.f(b))); ctx.stroke();
        K.dot(ctx, F.X(a), F.Y(m.f(a)), 5, c.bad); K.dot(ctx, F.X(b), F.Y(m.f(b)), 5, c.bad);
      } else {
        [[0.15, 0.55], [0.4, 0.95], [0.05, 0.9]].forEach(function (pr) {
          var a2 = m.wd[0] + pr[0] * (m.wd[1] - m.wd[0]), b2 = m.wd[0] + pr[1] * (m.wd[1] - m.wd[0]);
          ctx.strokeStyle = K.rgba(c.good, 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(F.X(a2), F.Y(m.f(a2))); ctx.lineTo(F.X(b2), F.Y(m.f(b2))); ctx.stroke();
        });
      }
    });
    K.seg(lab, 'model', function (v) { model = v; update(); });
    update();
  })();
})();
