/* Gradient Descent lesson — interactive labs. Uses window.Lesson (lesson/lesson.js). */
(function () {
  'use strict';
  var L = window.Lesson;

  /* ─── small helpers ─── */
  function $(root, sel) { return root.querySelector(sel); }
  function out(lab, name, v) { var el = $(lab, '[data-out="' + name + '"]'); if (el) el.textContent = v; return el; }
  function note(lab, html, cls) { var el = $(lab, '[data-out="note"]'); el.innerHTML = html; el.className = 'lab-note' + (cls ? ' ' + cls : ''); }
  function fmt(n, d) {
    if (d == null) d = 3;
    if (!isFinite(n)) return n > 0 ? '∞' : '−∞';
    if (Math.abs(n) >= 1e5) return n.toExponential(2);
    return (Math.abs(n) < 5e-4 && n !== 0 && d > 2) ? n.toExponential(1) : n.toFixed(d);
  }
  function col() {
    var v = L.cssVar;
    return { accent: v('--accent'), accent2: v('--accent2'), hl: v('--highlight'), text: v('--text'), muted: v('--text-muted'),
             border: v('--border'), grid: v('--border-light'), good: v('--good'), bad: v('--bad'), bg: v('--lab-bg') };
  }
  function rgba(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function arrow(ctx, x1, y1, x2, y2, color, width) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (len < 2) return;
    var ux = dx / len, uy = dy / len, hs = Math.min(10, len * 0.4);
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width || 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * hs * 0.6, y2 - uy * hs * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux * hs - uy * hs * 0.55, y2 - uy * hs + ux * hs * 0.55); ctx.lineTo(x2 - ux * hs + uy * hs * 0.55, y2 - uy * hs - ux * hs * 0.55); ctx.closePath(); ctx.fill();
  }
  function dot(ctx, x, y, r, fill, ring) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    if (ring) { ctx.lineWidth = 2.5; ctx.strokeStyle = ring; ctx.stroke(); }
  }
  function drag(canvasApi, el, onPoint) {
    var down = false;
    el.addEventListener('pointerdown', function (e) { down = true; el.setPointerCapture(e.pointerId); onPoint(canvasApi.point(e), true); });
    el.addEventListener('pointermove', function (e) { if (down) onPoint(canvasApi.point(e), false); });
    el.addEventListener('pointerup', function (e) { if (down) onPoint(canvasApi.point(e), false); down = false; });
    el.addEventListener('pointercancel', function () { down = false; });
  }
  function slider(lab, name, fn) { var s = $(lab, '[data-in="' + name + '"]'); s.addEventListener('input', function () { fn(+s.value); }); fn(+s.value); return s; }
  /* ─── 1-D valley used in chapters 0–2 ─── */
  var f = function (x) { return 0.5 * (x - 3) * (x - 3) + 1; };
  var df = function (x) { return x - 3; };
  var X0 = -2, X1 = 8, Y0 = 0, Y1 = 14;
  function frame1D(w, h) {
    var pl = 34, pr = 14, pt = 14, pb = 26;
    return {
      X: function (x) { return pl + (x - X0) / (X1 - X0) * (w - pl - pr); },
      Y: function (y) { return h - pb - (y - Y0) / (Y1 - Y0) * (h - pt - pb); },
      inv: function (px) { return X0 + (px - pl) / (w - pl - pr) * (X1 - X0); },
      pl: pl, pr: pr, pt: pt, pb: pb
    };
  }
  function axes1D(ctx, w, h, F, c, ylabel) {
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = '11px JetBrains Mono, monospace';
    for (var x = X0; x <= X1; x++) { var px = F.X(x); ctx.beginPath(); ctx.moveTo(px, F.pt); ctx.lineTo(px, h - F.pb); ctx.stroke(); if (x % 2 === 0) ctx.fillText(x, px - 4, h - 8); }
    for (var y = 0; y <= Y1; y += 2) { var py = F.Y(y); ctx.beginPath(); ctx.moveTo(F.pl, py); ctx.lineTo(w - F.pr, py); ctx.stroke(); ctx.fillText(y, 8, py + 4); }
    ctx.save(); ctx.fillStyle = c.muted; ctx.fillText('x →', w - F.pr - 26, h - F.pb - 6); ctx.fillText(ylabel || 'loss', F.pl + 4, F.pt + 10); ctx.restore();
  }
  function curve1D(ctx, w, h, F, c, fillIt) {
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) { var x = X0 + i / 200 * (X1 - X0), px = F.X(x), py = F.Y(Math.min(Y1 + 2, f(x))); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    if (fillIt) {
      var g = ctx.createLinearGradient(0, F.pt, 0, h - F.pb); g.addColorStop(0, rgba(c.accent, 0.02)); g.addColorStop(1, rgba(c.accent, 0.16));
      ctx.save(); ctx.lineTo(F.X(X1), h - F.pb); ctx.lineTo(F.X(X0), h - F.pb); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.beginPath();
      for (var j = 0; j <= 200; j++) { var x2 = X0 + j / 200 * (X1 - X0); j ? ctx.lineTo(F.X(x2), F.Y(Math.min(Y1 + 2, f(x2)))) : ctx.moveTo(F.X(x2), F.Y(Math.min(Y1 + 2, f(x2)))); }
    }
    ctx.strokeStyle = c.accent; ctx.lineWidth = 3; ctx.stroke();
  }

  /* ═════ Lab 0 — find the bottom blindfolded ═════ */
  (function () {
    var lab = document.getElementById('lab-blind'); if (!lab) return;
    var el = $(lab, 'canvas'), s;
    var st;
    function reset() { st = { x: -1, probes: [], revealed: false, lastProbe: null }; probe(st.x); update(); }
    function probe(x) { if (st.lastProbe == null || Math.abs(x - st.lastProbe) > 0.12) { st.probes.push(x); st.lastProbe = x; } }
    function update() {
      out(lab, 'x', fmt(st.x, 2)); out(lab, 'h', fmt(f(st.x), 3)); out(lab, 'n', st.probes.length);
      if (!st.revealed && f(st.x) < 1.05 && L.done('gd-feel')) note(lab, '<b>Found it!</b> It took ' + st.probes.length + ' checks to find the bottom of one knob. A real model has millions — checking every spot is hopeless. We need to know which way is downhill.', 'good');
      s && s.redraw();
    }
    s = L.canvas(el, function (ctx, w, h) {
      var c = col(), F = frame1D(w, h);
      axes1D(ctx, w, h, F, c, 'height');
      if (st.revealed) curve1D(ctx, w, h, F, c, true);
      else { ctx.fillStyle = rgba(c.muted, 0.08); ctx.fillRect(F.pl, F.pt, w - F.pl - F.pr, h - F.pt - F.pb); ctx.fillStyle = c.muted; ctx.font = '600 12px Inter, sans-serif'; ctx.fillText('🙈  landscape hidden', F.pl + 12, F.pt + 22); }
      st.probes.forEach(function (x) { dot(ctx, F.X(x), F.Y(f(x)), 3, rgba(c.muted, 0.7)); });
      var px = F.X(st.x), py = F.Y(f(st.x));
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.hl; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, h - F.pb); ctx.stroke(); ctx.setLineDash([]);
      dot(ctx, px, py, 9, c.hl, c.bg);
      ctx.fillStyle = c.text; ctx.font = '600 12px JetBrains Mono, monospace'; ctx.fillText('height ' + f(st.x).toFixed(2), Math.min(px + 12, w - 110), py - 12);
    });
    drag(s, el, function (p) { st.x = Math.max(X0 + 0.1, Math.min(X1 - 0.1, frame1D(s.w, s.h).inv(p.x))); probe(st.x); update(); });
    $(lab, '[data-act="reveal"]').addEventListener('click', function () {
      st.revealed = true; L.done('gd-reveal');
      note(lab, 'There\'s the valley: its lowest point is at <b>x = 3</b>, height 1. The dots are the places you checked.', 'good'); s.redraw();
    });
    $(lab, '[data-reset]').addEventListener('click', function () { reset(); note(lab, 'You can only feel the height where you stand. Walk around and find the lowest spot.'); });
    reset();
  })();

  /* ═════ Lab 1 — measure the slope ═════ */
  (function () {
    var lab = document.getElementById('lab-slope'); if (!lab) return;
    var el = $(lab, 'canvas'), s, x = 6, h = 1;
    function update() {
      var sec = (f(x + h) - f(x)) / h, tan = df(x);
      out(lab, 'sec', fmt(sec, 3)); out(lab, 'tan', fmt(tan, 3)); out(lab, 'hv', fmt(h, 3));
      if (tan > 0.05) note(lab, 'Slope is <b>positive (+' + tan.toFixed(2) + ')</b>: the ground rises to the right, so <b>downhill is to the left</b>.');
      else if (tan < -0.05) note(lab, 'Slope is <b>negative (' + tan.toFixed(2) + ')</b>: the ground falls to the right, so <b>downhill is to the right</b>.');
      else note(lab, '<b>Flat ground</b> — slope ≈ 0. You are at the bottom of the valley.', 'good');
      if (tan > 0.5) L.done('gd-s-right');
      if (Math.abs(tan) < 0.05) L.done('gd-s-flat');
      if (h <= 0.01) L.done('gd-s-h');
      s && s.redraw();
    }
    s = L.canvas(el, function (ctx, w, hh) {
      var c = col(), F = frame1D(w, hh);
      axes1D(ctx, w, hh, F, c); curve1D(ctx, w, hh, F, c, true);
      var px = F.X(x), py = F.Y(f(x)), qx = F.X(x + h), qy = F.Y(f(x + h));
      // rise/run triangle
      ctx.strokeStyle = c.accent2; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, py); ctx.lineTo(qx, qy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.accent2; ctx.font = '600 11px JetBrains Mono, monospace';
      if (Math.abs(qx - px) > 30) ctx.fillText('run h', (px + qx) / 2 - 16, py + 16);
      if (Math.abs(qy - py) > 18) ctx.fillText('rise', qx + 6, (py + qy) / 2 + 4);
      // tangent
      var t = df(x), x1 = x - 1.6, x2 = x + 1.6;
      ctx.strokeStyle = c.hl; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(F.X(x1), F.Y(f(x) + t * (x1 - x))); ctx.lineTo(F.X(x2), F.Y(f(x) + t * (x2 - x))); ctx.stroke();
      dot(ctx, qx, qy, 5, c.accent2);
      // downhill arrow
      if (Math.abs(t) > 0.05) { var dir = t > 0 ? -1 : 1; arrow(ctx, px, py - 26, px + dir * 42, py - 26, c.good, 3); ctx.fillStyle = c.good; ctx.fillText('downhill', px + dir * 42 - (dir < 0 ? 58 : 0), py - 34); }
      dot(ctx, px, py, 9, c.hl, c.bg);
    });
    drag(s, el, function (p) { x = Math.max(X0 + 0.2, Math.min(X1 - 0.5, frame1D(s.w, s.h).inv(p.x))); update(); });
    slider(lab, 'h', function (v) { h = Math.pow(10, -3 + v / 100 * 3.5); update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { x = 6; var sl = $(lab, '[data-in="h"]'); sl.value = 86; h = Math.pow(10, -3 + 86 / 100 * 3.5); update(); });
    $(lab, '[data-in="h"]').value = 86; h = Math.pow(10, -3 + 0.86 * 3.5); update();
  })();

  /* ═════ Lab 2 — gradient descent in 1-D ═════ */
  (function () {
    var lab = document.getElementById('lab-step'); if (!lab) return;
    var el = $(lab, 'canvas'), s, lr = 0.3, st, timer = null;
    var tbody = $(lab, '[data-out="rows"]');
    function reset(x0) { stop(); st = { x: x0 == null ? -1 : x0, hist: [], k: 0, dead: false }; st.hist.push(st.x); tbody.innerHTML = ''; update(); note(lab, 'Press "Take 1 step" and watch the numbers in the table.'); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function step() {
      if (st.dead) return false;
      var g = df(st.x), mv = lr * g, nx = st.x - mv;
      st.k++;
      var tr = document.createElement('tr'); tr.className = 'new';
      tr.innerHTML = '<td>' + st.k + '</td><td>' + fmt(st.x) + '</td><td>' + fmt(g) + '</td><td>' + fmt(mv) + '</td><td>' + fmt(nx) + '</td><td>' + fmt(f(nx)) + '</td>';
      if (tbody.children.length > 200) tbody.removeChild(tbody.firstChild);
      tbody.appendChild(tr); tr.parentNode.parentNode.parentNode.scrollTop = 1e9;
      st.x = nx; st.hist.push(nx);
      var err = Math.abs(st.x - 3);
      if (err > 50) {
        st.dead = true; L.done('gd-g-div');
        note(lab, '<b>Diverged!</b> With η = ' + lr.toFixed(2) + ' every step overshoots by more than it started, so the loss explodes. For this valley anything above η = 2 does this.', 'bad');
      } else if (err < 0.01) {
        L.done('gd-g-conv'); if (lr <= 0.1) L.done('gd-g-slow');
        note(lab, '<b>Arrived</b> at x = ' + st.x.toFixed(3) + ' in <b>' + st.k + ' steps</b> with η = ' + lr.toFixed(2) + '.' + (lr <= 0.1 ? ' Small steps are safe but slow.' : lr > 0.9 && lr < 1.1 ? ' η = 1 is perfect here: one step lands on the bottom.' : ''), 'good');
      } else {
        var e = st.hist.slice(-4).map(function (v) { return Math.sign(v - 3); });
        var alt = e.length === 4 && e[0] !== e[1] && e[1] !== e[2] && e[2] !== e[3];
        if (alt && lr >= 1.1 && lr <= 1.9) { L.done('gd-g-osc'); note(lab, '<b>Overshooting!</b> Each step jumps past the bottom to the other side. It still gets there because each jump is smaller than the last.', 'warn'); }
        else note(lab, 'Slope at x = ' + fmt(st.x + mv) + ' was <b>' + fmt(g) + '</b>, so we moved by η × slope = <b>' + fmt(mv) + '</b> ' + (mv > 0 ? 'to the left' : 'to the right') + '.');
      }
      update();
      return !st.dead && err >= 0.01;
    }
    function update() { out(lab, 'k', st.k); out(lab, 'x', fmt(st.x)); var fe = out(lab, 'f', fmt(f(st.x))); fe.className = st.dead ? 'bad' : Math.abs(st.x - 3) < 0.01 ? 'good' : ''; s && s.redraw(); }
    s = L.canvas(el, function (ctx, w, h) {
      var c = col(), F = frame1D(w, h);
      axes1D(ctx, w, h, F, c); curve1D(ctx, w, h, F, c, true);
      var clampX = function (x) { return Math.max(X0, Math.min(X1, x)); };
      for (var i = 1; i < st.hist.length; i++) {
        var a = st.hist[i - 1], b = st.hist[i];
        if (Math.abs(a) > 1e4) break;
        var ax = F.X(clampX(a)), ay = F.Y(Math.min(Y1, f(a))), bx = F.X(clampX(b)), by = F.Y(Math.min(Y1, f(b)));
        arrow(ctx, ax, ay, bx, by, rgba(c.accent2, 0.85), 2);
        dot(ctx, ax, ay, 3.5, c.accent2);
      }
      var cx = clampX(st.x), off = cx !== st.x;
      dot(ctx, F.X(cx), F.Y(Math.min(Y1, f(st.x))), 9, off ? c.bad : c.hl, c.bg);
      if (off) { ctx.fillStyle = c.bad; ctx.font = '600 12px Inter, sans-serif'; ctx.fillText('off the chart', Math.max(8, Math.min(w - 90, F.X(cx) - 40)), F.pt + 30); }
    });
    drag(s, el, function (p) { reset(Math.max(X0 + 0.2, Math.min(X1 - 0.2, frame1D(s.w, s.h).inv(p.x)))); });
    slider(lab, 'lr', function (v) { lr = v; out(lab, 'lrv', v.toFixed(2)); });
    $(lab, '[data-act="step"]').addEventListener('click', function () { stop(); step(); });
    $(lab, '[data-act="run"]').addEventListener('click', function () {
      stop(); var n = 0;
      timer = setInterval(function () { n++; if (step() === false || n >= 10) stop(); }, L.reduce ? 0 : 160);
    });
    $(lab, '[data-reset]').addEventListener('click', function () { reset(); });
    reset();
  })();

  /* ─── 2-D valley used in chapters 3–7 ─── */
  var L2 = function (a, b) { return 0.1 * a * a + 2 * b * b; };
  var G2 = function (a, b) { return [0.2 * a, 4 * b]; };
  var START = [-5.5, 2.5];
  function frame2D(w, h) {
    var sc = Math.min(w / 13, h / 7.5);
    return { sc: sc, P: function (a, b) { return [w / 2 + a * sc, h / 2 - b * sc]; }, inv: function (px, py) { return [(px - w / 2) / sc, -(py - h / 2) / sc]; } };
  }
  function surface(ctx, w, h, F, c) {
    var levels = [30, 22, 16, 11, 7, 4.5, 2.5, 1.2, 0.5, 0.15];
    levels.forEach(function (lv) {
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, Math.sqrt(lv / 0.1) * F.sc, Math.sqrt(lv / 2) * F.sc, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c.accent, 0.045); ctx.fill();
      ctx.strokeStyle = rgba(c.accent, 0.35); ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.fillStyle = c.muted; ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('θ₁ →', w - 38, h / 2 - 6); ctx.fillText('θ₂ ↑', w / 2 + 6, 14);
    ctx.fillStyle = c.good; ctx.font = '14px sans-serif'; ctx.fillText('★', w / 2 - 6, h / 2 + 5);
  }
  function path2D(ctx, F, pts, color, width, faint) {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineJoin = 'round'; ctx.globalAlpha = faint ? 0.55 : 1;
    ctx.beginPath();
    pts.forEach(function (p, i) { var q = F.P(Math.max(-40, Math.min(40, p[0])), Math.max(-40, Math.min(40, p[1]))); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
    if (pts.length < 120) pts.forEach(function (p) { var q = F.P(p[0], p[1]); dot(ctx, q[0], q[1], faint ? 2 : 2.8, color); });
    ctx.globalAlpha = 1;
    var last = pts[pts.length - 1], q = F.P(Math.max(-40, Math.min(40, last[0])), Math.max(-40, Math.min(40, last[1])));
    dot(ctx, q[0], q[1], faint ? 5 : 7.5, color, col().bg);
  }
  // Optimizers share one interface: step() mutates state; state.p is [θ1, θ2].
  function optimizer(kind, p, opts) {
    var s = { kind: kind, p: p.slice(), path: [p.slice()], k: 0, v: [0, 0], m: [0, 0], s2: [0, 0], done: null, dead: false, last: [0, 0] };
    s.step = function () {
      if (s.done != null || s.dead) return;
      var g = G2(s.p[0], s.p[1]), lr = opts.lr(), d = [0, 0];
      s.k++;
      for (var i = 0; i < 2; i++) {
        if (kind === 'gd') d[i] = lr * g[i];
        else if (kind === 'mom') { s.v[i] = opts.beta() * s.v[i] + g[i]; d[i] = lr * s.v[i]; }
        else {
          s.m[i] = 0.9 * s.m[i] + 0.1 * g[i]; s.s2[i] = 0.999 * s.s2[i] + 0.001 * g[i] * g[i];
          var mh = s.m[i] / (1 - Math.pow(0.9, s.k)), vh = s.s2[i] / (1 - Math.pow(0.999, s.k));
          d[i] = lr * mh / (Math.sqrt(vh) + 1e-8);
        }
        s.p[i] -= d[i];
      }
      s.last = d; s.path.push(s.p.slice());
      var l = L2(s.p[0], s.p[1]);
      if (!isFinite(l) || l > 1e4) s.dead = true;
      else if (l < opts.tol) s.done = s.k;
    };
    return s;
  }
  function lab2D(id, height) {
    var lab = document.getElementById(id); if (!lab) return null;
    return { lab: lab, el: $(lab, 'canvas') };
  }

  /* ═════ Lab 3 — feel the gradient ═════ */
  (function () {
    var o = lab2D('lab-surface'); if (!o) return;
    var lab = o.lab, s, p = [-4, 2];
    function update() {
      var g = G2(p[0], p[1]), l = L2(p[0], p[1]);
      out(lab, 'a', fmt(p[0], 2)); out(lab, 'b', fmt(p[1], 2)); out(lab, 'L', fmt(l, 3)); out(lab, 'ga', fmt(g[0], 2)); out(lab, 'gb', fmt(g[1], 2));
      if (Math.abs(g[1]) > 5 * Math.abs(g[0]) && Math.abs(g[1]) > 0.5) { L.done('gd-sf-steep'); note(lab, 'Here the θ₂ slope dominates, so the arrow points almost straight <b>across</b> the valley — not towards the ★ at the bottom. Keep that in mind.', 'warn'); }
      else if (l < 0.05) { L.done('gd-sf-flat'); note(lab, '<b>Bottom reached.</b> Both slopes are nearly zero, so the arrows shrink to nothing. That\'s how gradient descent knows it has arrived.', 'good'); }
      else note(lab, '<span style="color:var(--bad)">Red arrow</span>: the gradient (uphill). <span style="color:var(--accent2)">Teal arrow</span>: the negative gradient — the way we will step.');
      s && s.redraw();
    }
    s = L.canvas(o.el, function (ctx, w, h) {
      var c = col(), F = frame2D(w, h); surface(ctx, w, h, F, c);
      var g = G2(p[0], p[1]), q = F.P(p[0], p[1]), k = 0.9, len = Math.hypot(g[0], g[1]) * k * F.sc, cap = 130;
      var sc = len > cap ? cap / len : 1;
      arrow(ctx, q[0], q[1], q[0] + g[0] * k * F.sc * sc, q[1] - g[1] * k * F.sc * sc, c.bad, 2.5);
      arrow(ctx, q[0], q[1], q[0] - g[0] * k * F.sc * sc, q[1] + g[1] * k * F.sc * sc, c.accent2, 3);
      dot(ctx, q[0], q[1], 8, c.hl, c.bg);
    });
    drag(s, o.el, function (pt) { var F = frame2D(s.w, s.h); p = F.inv(pt.x, pt.y); update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { p = [-4, 2]; update(); });
    update();
  })();

  /* Shared set-up for the four descent labs */
  function descentLab(id, kinds, cfg) {
    var o = lab2D(id); if (!o) return null;
    var lab = o.lab, s, start = START.slice(), opts = { lr: function () { return cfg.lr; }, beta: function () { return cfg.beta; }, tol: cfg.tol }, runs, timer = null;
    var colors = { gd: function (c) { return kinds.length > 1 ? c.muted : c.accent2; }, mom: function (c) { return c.accent2; }, adam: function (c) { return c.hl; } };
    function reset() { stop(); runs = kinds.map(function (k) { return optimizer(k, start, opts); }); cfg.onReset && cfg.onReset(runs); s && s.redraw(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; var b = $(lab, '[data-act="play"]'); if (b) b.innerHTML = b.dataset.label; } }
    function tick() {
      var n = 0, active = true;
      var perTick = runs[0].k < 30 ? 1 : runs[0].k < 120 ? 2 : 5;
      for (var t = 0; t < perTick; t++) {
        runs.forEach(function (r) { r.step(); });
        n++;
        active = runs.some(function (r) { return r.done == null && !r.dead; }) && runs[0].k < cfg.max;
        if (!active) break;
      }
      cfg.onStep && cfg.onStep(runs, !active);
      s.redraw();
      if (!active) { stop(); cfg.onFinish && cfg.onFinish(runs); }
      return active;
    }
    s = L.canvas(o.el, function (ctx, w, h) {
      var c = col(), F = frame2D(w, h); surface(ctx, w, h, F, c);
      var sq = F.P(start[0], start[1]); ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; ctx.strokeRect(sq[0] - 5, sq[1] - 5, 10, 10);
      runs.slice().reverse().forEach(function (r, i) { path2D(ctx, F, r.path, colors[r.kind](c), r.kind === 'gd' && kinds.length > 1 ? 1.5 : 2.2, r.kind === 'gd' && kinds.length > 1); });
    });
    o.el.addEventListener('pointerdown', function (e) { var pt = s.point(e), F = frame2D(s.w, s.h); start = F.inv(pt.x, pt.y); reset(); cfg.onStart && cfg.onStart(); });
    var play = $(lab, '[data-act="play"]');
    if (play) { play.dataset.label = play.innerHTML; play.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (runs.every(function (r) { return r.done != null || r.dead; }) || runs[0].k >= cfg.max) reset();
      play.innerHTML = '❚❚ Pause';
      timer = setInterval(tick, L.reduce ? 0 : 45);
    }); }
    var stepBtn = $(lab, '[data-act="step"]');
    if (stepBtn) stepBtn.addEventListener('click', function () { stop(); if (runs.every(function (r) { return r.done != null || r.dead; })) reset(); runs.forEach(function (r) { r.step(); }); cfg.onStep && cfg.onStep(runs, runs.every(function (r) { return r.done != null || r.dead; })); if (runs.every(function (r) { return r.done != null || r.dead; })) cfg.onFinish && cfg.onFinish(runs); s.redraw(); });
    $(lab, '[data-reset]').addEventListener('click', function () { start = START.slice(); reset(); cfg.onStart && cfg.onStart(); });
    return { lab: lab, reset: reset, stop: stop, get runs() { return runs; } };
  }

  /* ═════ Lab 4 — plain gradient descent ═════ */
  (function () {
    var cfg = { lr: 0.1, tol: 1e-3, max: 1500 }, flips = 0;
    var d = descentLab('lab-descent', ['gd'], cfg); if (!d) return;
    var lab = d.lab;
    cfg.onReset = function () { flips = 0; out(lab, 'k', 0); out(lab, 'L', fmt(L2(START[0], START[1]))); };
    cfg.onStep = function (runs) {
      var r = runs[0], l = L2(r.p[0], r.p[1]), prev = r.path[r.path.length - 2];
      if (prev && Math.sign(prev[1]) !== Math.sign(r.p[1])) flips++;
      out(lab, 'k', r.k); var e = out(lab, 'L', fmt(l)); e.className = r.dead ? 'bad' : r.done ? 'good' : '';
    };
    cfg.onFinish = function (runs) {
      var r = runs[0];
      if (r.dead) { L.done('gd-2-div'); note(lab, '<b>Diverged.</b> With η = ' + cfg.lr.toFixed(2) + ' the steep θ₂ direction overshoots more each step. It needs η &lt; 2 ÷ 4 = 0.5.', 'bad'); }
      else if (r.done) {
        L.done('gd-2-conv');
        var zig = flips >= 3 && cfg.lr >= 0.3 && cfg.lr <= 0.45;
        if (zig) L.done('gd-2-zig');
        note(lab, '<b>Arrived in ' + r.done + ' steps</b> (η = ' + cfg.lr.toFixed(2) + ').' + (zig ? ' Notice the zig-zag across the steep direction — θ₂ flipped sign ' + flips + ' times.' : cfg.lr < 0.2 ? ' Most of those steps were spent crawling along the gentle θ₁ floor.' : ''), zig ? 'warn' : 'good');
      } else note(lab, 'Stopped after ' + r.k + ' steps without arriving — a learning rate this small is very slow.', 'warn');
    };
    slider(lab, 'lr', function (v) { cfg.lr = v; out(lab, 'lrv', v.toFixed(2)); });
    d.reset();
  })();

  /* ═════ Lab 5 — momentum ═════ */
  (function () {
    var cfg = { lr: 0.2, beta: 0.7, tol: 1e-3, max: 1500 };
    var d = descentLab('lab-momentum', ['gd', 'mom'], cfg); if (!d) return;
    var lab = d.lab;
    function show(runs) {
      runs.forEach(function (r) { var e = out(lab, r.kind, r.done ? r.done + ' steps' : r.dead ? 'diverged' : r.k ? '… ' + r.k : '—'); e.className = r.done ? 'good' : r.dead ? 'bad' : ''; });
    }
    cfg.onReset = show; cfg.onStep = show;
    cfg.onFinish = function (runs) {
      var gd = runs[0], mom = runs[1];
      if (cfg.beta >= 0.9) L.done('gd-m-high');
      if (gd.done && mom.done && mom.done * 2 <= gd.done) { L.done('gd-m-beat'); note(lab, '<b>Momentum wins: ' + mom.done + ' vs ' + gd.done + ' steps.</b> The ball damped the side-to-side wobble and picked up speed along the valley floor.', 'good'); }
      else if (mom.dead) note(lab, 'Momentum diverged — with β close to 1 the effective step is η ÷ (1 − β), which is too big here. Lower η or β.', 'bad');
      else if (cfg.beta >= 0.9) note(lab, 'With β = ' + cfg.beta.toFixed(2) + ' the ball carries so much speed that it overshoots and spirals around the minimum before settling.', 'warn');
      else note(lab, 'Plain GD: ' + (gd.done || 'not arrived') + ' · Momentum: ' + (mom.done || 'not arrived') + '. Try β around 0.7 with η = 0.2.');
    };
    slider(lab, 'lr', function (v) { cfg.lr = v; out(lab, 'lrv', v.toFixed(2)); });
    slider(lab, 'beta', function (v) { cfg.beta = v; out(lab, 'bv', v.toFixed(2)); });
    d.reset();
  })();

  /* ═════ Lab 6 — Adam ═════ */
  (function () {
    var cfg = { lr: 0.2, tol: 1e-2, max: 800 };
    var d = descentLab('lab-adam', ['gd', 'adam'], cfg); if (!d) return;
    var lab = d.lab;
    cfg.onReset = function () { out(lab, 'k', 0); out(lab, 'L', fmt(L2(START[0], START[1]))); out(lab, 'd1', '—'); out(lab, 'd2', '—'); note(lab, 'Take one step and compare how far each knob moved.'); };
    cfg.onStep = function (runs) {
      var a = runs[1];
      out(lab, 'k', a.k); var e = out(lab, 'L', fmt(L2(a.p[0], a.p[1]))); e.className = a.done ? 'good' : '';
      out(lab, 'd1', fmt(Math.abs(a.last[0]), 3)); out(lab, 'd2', fmt(Math.abs(a.last[1]), 3));
      if (a.k === 1) {
        var g = G2(a.path[0][0], a.path[0][1]);
        L.done('gd-a-first');
        note(lab, '<b>Step 1:</b> the slopes were ' + fmt(Math.abs(g[0]), 2) + ' and ' + fmt(Math.abs(g[1]), 2) + ' (' + (Math.abs(g[1] / g[0])).toFixed(0) + '× apart), yet Adam moved both knobs by <b>≈ ' + cfg.lr.toFixed(2) + '</b> = η. The faint path is plain GD with the same η.', 'good');
      }
    };
    cfg.onFinish = function (runs) {
      var a = runs[1];
      if (a.done) { L.done('gd-a-conv'); note(lab, '<b>Adam arrived in ' + a.done + ' steps.</b> Its path heads for the ★ far more directly than plain GD\'s.', 'good'); }
    };
    slider(lab, 'lr', function (v) { cfg.lr = v; out(lab, 'lrv', v.toFixed(2)); });
    d.reset();
  })();

  /* ═════ Lab 7 — the race ═════ */
  (function () {
    var cfg = { lr: 0.1, beta: 0.9, tol: 1e-2, max: 800 };
    var d = descentLab('lab-race', ['gd', 'mom', 'adam'], cfg); if (!d) return;
    var lab = d.lab;
    function show(runs) { runs.forEach(function (r) { var e = out(lab, r.kind, r.done ? r.done + ' steps' : r.dead ? 'crashed' : r.k ? '… ' + r.k : '—'); e.className = r.done ? 'good' : r.dead ? 'bad' : ''; }); }
    cfg.onReset = show; cfg.onStep = show;
    cfg.onFinish = function (runs) {
      L.done('gd-r-run');
      var score = function (r) { return r.done || Infinity; };
      var order = runs.slice().sort(function (a, b) { return score(a) - score(b); });
      var names = { gd: 'Plain GD', mom: 'Momentum', adam: 'Adam' };
      if (order[2].kind !== 'gd' && runs[0].done) L.done('gd-r-gdwin');
      note(lab, '🏁 ' + order.map(function (r, i) { return (i + 1) + '. ' + names[r.kind] + (r.done ? ' (' + r.done + ')' : r.dead ? ' (crashed)' : ' (DNF)'); }).join(' · '), 'good');
    };
    slider(lab, 'lr', function (v) { cfg.lr = v; out(lab, 'lrv', v.toFixed(2)); });
    d.reset();
  })();

  /* ═════ Lab 8 — train a real model ═════ */
  (function () {
    var lab = document.getElementById('lab-train'); if (!lab) return;
    var X = [0.35,0.83,1.33,1.59,1.96,2.4,2.9,3.2,3.55,4,4.43,4.98,5.31,5.63,6.02,6.57,6.99,7.21,7.82,8.24,8.57,8.8,9.44,9.82];
    var Y = [38.6,41.2,48.2,41.1,54,53.2,49.8,58.4,52.6,57.8,58.4,72,71,78.3,68.6,74.4,74.9,88.1,81.7,81.8,95.7,87.4,90.7,99.1];
    var n = X.length, mu = X.reduce(function (a, b) { return a + b; }) / n;
    var sd = Math.sqrt(X.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / n);
    var TARGET = 21;
    var mode = 'raw', lr = 0.02, st, timer = null;
    var feats = function () { return mode === 'std' ? X.map(function (x) { return (x - mu) / sd; }) : X; };
    function mse(w, b) { var xs = feats(), s = 0; for (var i = 0; i < n; i++) { var r = w * xs[i] + b - Y[i]; s += r * r; } return s / n; }
    function reset() { stop(); st = { w: 0, b: 0, k: 0, losses: [mse(0, 0)], dead: false }; show(); note(lab, 'Goal: MSE below 21 (within 10% of the best possible line).'); }
    function stop() { if (timer) { clearInterval(timer); timer = null; var b = $(lab, '[data-act="play"]'); b.innerHTML = '▶ Train'; } }
    function epoch() {
      if (st.dead) return false;
      var xs = feats(), gw = 0, gb = 0;
      for (var i = 0; i < n; i++) { var r = st.w * xs[i] + st.b - Y[i]; gw += 2 * r * xs[i] / n; gb += 2 * r / n; }
      st.w -= lr * gw; st.b -= lr * gb; st.k++;
      var m = mse(st.w, st.b); st.losses.push(m);
      if (!isFinite(m) || m > 1e7) {
        st.dead = true;
        if (mode === 'raw' && lr >= 0.03) L.done('gd-h-div');
        note(lab, '<b>Diverged at epoch ' + st.k + '.</b> In raw hours, w\'s gradient is scaled by x (up to 10), so w overshoots once η passes ≈ 0.025. Lower η, or standardize the input.', 'bad');
        return false;
      }
      if (m < TARGET) {
        L.done('gd-h-fit');
        if (mode === 'std' && st.k <= 10) L.done('gd-h-std');
        note(lab, '<b>Trained in ' + st.k + ' epochs</b> with η = ' + lr.toFixed(3) + (mode === 'std' ? ' on standardized input.' : ' on raw hours.') + ' The model predicts about <b>' + rawW().toFixed(1) + ' extra points per hour</b> of study.', 'good');
        return false;
      }
      return true;
    }
    function rawW() { return mode === 'std' ? st.w / sd : st.w; }
    function rawB() { return mode === 'std' ? st.b - st.w * mu / sd : st.b; }
    function show() {
      out(lab, 'k', st.k); out(lab, 'w', fmt(rawW(), 2)); out(lab, 'b', fmt(rawB(), 2));
      var e = out(lab, 'L', fmt(st.losses[st.losses.length - 1], 1)); e.className = st.dead ? 'bad' : st.losses[st.losses.length - 1] < TARGET ? 'good' : '';
      fit && fit.redraw(); curve && curve.redraw();
    }
    var fit = L.canvas($(lab, '[data-c="fit"]'), function (ctx, w, h) {
      var c = col(), pl = 36, pb = 24, pt = 10, pr = 10;
      var PX = function (x) { return pl + x / 10.5 * (w - pl - pr); }, PY = function (y) { return h - pb - (y - 20) / 90 * (h - pb - pt); };
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = '10px JetBrains Mono, monospace';
      for (var gx = 0; gx <= 10; gx += 2) { ctx.beginPath(); ctx.moveTo(PX(gx), pt); ctx.lineTo(PX(gx), h - pb); ctx.stroke(); ctx.fillText(gx + 'h', PX(gx) - 6, h - 8); }
      for (var gy = 30; gy <= 110; gy += 20) { ctx.beginPath(); ctx.moveTo(pl, PY(gy)); ctx.lineTo(w - pr, PY(gy)); ctx.stroke(); ctx.fillText(gy, 6, PY(gy) + 3); }
      if (!st) return;
      ctx.save(); ctx.beginPath(); ctx.rect(pl, pt, w - pl - pr, h - pt - pb); ctx.clip();
      var W = rawW(), B = rawB();
      for (var i = 0; i < n; i++) { var yh = W * X[i] + B; ctx.strokeStyle = rgba(c.bad, 0.35); ctx.beginPath(); ctx.moveTo(PX(X[i]), PY(Y[i])); ctx.lineTo(PX(X[i]), PY(yh)); ctx.stroke(); }
      if (isFinite(W) && isFinite(B)) { ctx.strokeStyle = c.hl; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(PX(0), PY(B)); ctx.lineTo(PX(10.5), PY(W * 10.5 + B)); ctx.stroke(); }
      ctx.restore();
      for (var j = 0; j < n; j++) dot(ctx, PX(X[j]), PY(Y[j]), 4, c.accent2);
    });
    var curve = L.canvas($(lab, '[data-c="loss"]'), function (ctx, w, h) {
      var c = col(), pl = 34, pb = 24, pt = 10, pr = 10;
      if (!st) return;
      var ls = st.losses, maxK = Math.max(20, ls.length - 1);
      var lo = Math.log10(10), hi = Math.log10(1e4);
      var PX = function (k) { return pl + k / maxK * (w - pl - pr); }, PY = function (v) { var lv = Math.log10(Math.max(10, Math.min(1e4, v))); return h - pb - (lv - lo) / (hi - lo) * (h - pb - pt); };
      ctx.fillStyle = c.muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.strokeStyle = c.grid;
      [10, 100, 1000, 10000].forEach(function (v) { ctx.beginPath(); ctx.moveTo(pl, PY(v)); ctx.lineTo(w - pr, PY(v)); ctx.stroke(); ctx.fillText(v >= 1000 ? v / 1000 + 'k' : v, 4, PY(v) + 3); });
      ctx.fillText('epoch ' + maxK, w - 70, h - 8); ctx.fillText('MSE (log)', pl + 4, pt + 10);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = c.good; ctx.beginPath(); ctx.moveTo(pl, PY(TARGET)); ctx.lineTo(w - pr, PY(TARGET)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = st.dead ? c.bad : c.accent; ctx.lineWidth = 2; ctx.beginPath();
      ls.forEach(function (v, k) { var y = PY(isFinite(v) ? v : 1e4); k ? ctx.lineTo(PX(k), y) : ctx.moveTo(PX(k), y); });
      ctx.stroke();
    });
    var seg = $(lab, '[data-in="mode"]');
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      mode = b.dataset.v; seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      reset();
      if (mode === 'std') note(lab, 'Inputs are now standardized: <b>x′ = (x − ' + mu.toFixed(2) + ') ÷ ' + sd.toFixed(2) + '</b>. The valley is round, so a much larger η is safe — try 0.3.');
    });
    slider(lab, 'lr', function (v) { lr = Math.pow(10, -3 + v / 100 * (Math.log10(1.2) + 3)); out(lab, 'lrv', lr.toFixed(3)); });
    $(lab, '[data-act="step"]').addEventListener('click', function () { stop(); if (st.dead || st.losses[st.losses.length - 1] < TARGET) reset(); epoch(); show(); });
    $(lab, '[data-act="play"]').addEventListener('click', function () {
      var btn = this;
      if (timer) { stop(); return; }
      if (st.dead || st.losses[st.losses.length - 1] < TARGET || st.k >= 3000) reset();
      btn.innerHTML = '❚❚ Pause';
      timer = setInterval(function () {
        var go = true;
        for (var i = 0; i < (st.k < 20 ? 1 : 6) && go; i++) go = epoch();
        if (st.k >= 3000) go = false;
        show();
        if (!go) stop();
      }, L.reduce ? 0 : 40);
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();
})();
