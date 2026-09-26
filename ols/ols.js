/* Ordinary Least Squares lesson — interactive labs. Uses window.Kit (lesson/labkit.js). */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, out = K.out, note = K.note, fmt = K.fmt;

  /* ─── Ice-cream data: temperature (°C), weekend flag, sales ─── */
  var T = [12.4, 14, 15.8, 16.6, 17.8, 18.7, 19.8, 21.5, 22.5, 23.5, 25.1, 26.2, 27.2, 28, 29.9, 30.4, 32.7, 32.9];
  var WK = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
  var S = [178, 131, 161, 215, 173, 197, 239, 226, 205, 284, 246, 242, 318, 256, 293, 329, 309, 314];
  var XD = [10, 36], YD = [100, 380];

  function fit(xs, ys) {
    var n = xs.length, mx = 0, my = 0, sxy = 0, sxx = 0, sse = 0, sst = 0;
    for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    var w = sxy / sxx, b = my - w * mx;
    for (i = 0; i < n; i++) { var r = ys[i] - (w * xs[i] + b); sse += r * r; sst += (ys[i] - my) * (ys[i] - my); }
    return { w: w, b: b, mx: mx, my: my, sxy: sxy, sxx: sxx, sse: sse, r2: 1 - sse / sst };
  }
  function sse(xs, ys, w, b) { var s = 0; for (var i = 0; i < xs.length; i++) { var r = ys[i] - (w * xs[i] + b); s += r * r; } return s; }
  var BEST = fit(T, S);

  function plotFrame(ctx, w, h, xd, yd) {
    return K.frame(ctx, w, h, xd || XD, yd || YD, { xticks: K.range(10, 35, 5), yticks: K.range(100, 350, 50), xfmt: function (t) { return t + '°'; }, xlabel: 'temperature', ylabel: 'sales' });
  }
  function drawLine(ctx, F, w, b, color, width, dash) {
    ctx.save(); ctx.beginPath(); ctx.rect(F.pl, F.pt, 1e4, 1e4); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = width || 3; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(F.X(XD[0]), F.Y(w * XD[0] + b)); ctx.lineTo(F.X(XD[1]), F.Y(w * XD[1] + b)); ctx.stroke();
    ctx.restore();
  }
  function points(ctx, F, xs, ys, c, weekendShapes) {
    for (var i = 0; i < xs.length; i++) {
      var px = F.X(xs[i]), py = F.Y(ys[i]);
      if (weekendShapes && WK[i]) { ctx.fillStyle = c.hl; ctx.fillRect(px - 5, py - 5, 10, 10); }
      else K.dot(ctx, px, py, 4.5, c.accent2);
    }
  }

  /* ═════ Lab 0 — fit by eye ═════ */
  (function () {
    var lab = document.getElementById('lab-eye'); if (!lab) return;
    var el = $(lab, 'canvas'), s, hx = [13, 33], hy, active = 0;
    function line() { var w = (hy[1] - hy[0]) / (hx[1] - hx[0]); return { w: w, b: hy[0] - w * hx[0] }; }
    function update() {
      var l = line(), e = sse(T, S, l.w, l.b), ratio = e / BEST.sse;
      out(lab, 'w', fmt(l.w, 2)); out(lab, 'b', fmt(l.b, 1));
      var m = out(lab, 'sse', Math.round(e).toLocaleString()); m.className = ratio <= 1.08 ? 'good' : '';
      if (ratio <= 1.3) K.done('ols-eye');
      if (ratio <= 1.08) K.done('ols-eye-pro');
      note(lab, ratio <= 1.08 ? '<b>Excellent — within ' + Math.round((ratio - 1) * 100) + '% of the best line.</b> Now imagine doing this for 50 variables. We need a method, not an eye.' :
        'Your line scores <b>' + Math.round((ratio - 1) * 100) + '% worse</b> than the best possible line.', ratio <= 1.08 ? 'good' : ratio <= 1.3 ? 'warn' : '');
      s && s.redraw();
    }
    s = K.canvas(el, function (ctx, w, h) {
      var c = K.col(), F = plotFrame(ctx, w, h), l = line();
      ctx.strokeStyle = K.rgba(c.bad, 0.4); ctx.lineWidth = 1.5;
      for (var i = 0; i < T.length; i++) { ctx.beginPath(); ctx.moveTo(F.X(T[i]), F.Y(S[i])); ctx.lineTo(F.X(T[i]), F.Y(l.w * T[i] + l.b)); ctx.stroke(); }
      drawLine(ctx, F, l.w, l.b, c.hl, 3);
      points(ctx, F, T, S, c);
      for (var j = 0; j < 2; j++) K.dot(ctx, F.X(hx[j]), F.Y(hy[j]), 9, c.bg, c.hl);
    });
    K.drag(s, el, function (p, start) {
      var F = { X: K.scale(XD[0], XD[1], 38, s.w - 12), Y: K.scale(YD[0], YD[1], s.h - 26, 12) };
      if (start) active = Math.abs(p.x - F.X(hx[0])) < Math.abs(p.x - F.X(hx[1])) ? 0 : 1;
      hy[active] = Math.max(YD[0], Math.min(YD[1], F.Y.inv(p.y))); update();
    });
    function reset() { hy = [250, 250]; update(); }
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 1 — the squares ═════ */
  (function () {
    var lab = document.getElementById('lab-squares'); if (!lab) return;
    var el = $(lab, 'canvas'), s, w = 5, b = 100, showSq = false, outlier = false;
    var OX = 14.5, OY = 345;
    function data() { return outlier ? { x: T.concat([OX]), y: S.concat([OY]) } : { x: T, y: S }; }
    function update() {
      var d = data(), best = fit(d.x, d.y), e = sse(d.x, d.y, w, b);
      var m = out(lab, 'sse', Math.round(e).toLocaleString()); m.className = e < 13000 && !outlier ? 'good' : '';
      out(lab, 'best', Math.round(best.sse).toLocaleString());
      if (!outlier && e < 13000) K.done('ols-sq-min');
      if (outlier) note(lab, 'One unusual day (a festival?) pulls the best line: its slope drops from <b>' + BEST.w.toFixed(2) + '</b> to <b>' + best.w.toFixed(2) + '</b> and it tilts towards the outlier. Its square alone is huge.', 'warn');
      else if (showSq) note(lab, 'The SSE is the total purple area. Each square\'s side is one residual.' + (e < 13000 ? ' <b>Nice — below 13,000.</b>' : ''), e < 13000 ? 'good' : '');
      else note(lab, 'Adjust the sliders to shrink the total error.');
      s && s.redraw();
    }
    s = K.canvas(el, function (ctx, cw, ch) {
      var c = K.col(), F = plotFrame(ctx, cw, ch), d = data(), best = fit(d.x, d.y);
      var pxPerUnit = (ch - 38) / (YD[1] - YD[0]);
      for (var i = 0; i < d.x.length; i++) {
        var yh = w * d.x[i] + b, r = d.y[i] - yh, px = F.X(d.x[i]), py = F.Y(d.y[i]), pyh = F.Y(yh);
        if (showSq) {
          var side = Math.abs(r) * pxPerUnit;
          ctx.fillStyle = K.rgba(c.accent, 0.14); ctx.strokeStyle = K.rgba(c.accent, 0.55); ctx.lineWidth = 1;
          ctx.fillRect(px, Math.min(py, pyh), side, side); ctx.strokeRect(px, Math.min(py, pyh), side, side);
        } else { ctx.strokeStyle = K.rgba(c.bad, 0.45); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, pyh); ctx.stroke(); }
      }
      if (outlier) drawLine(ctx, F, best.w, best.b, c.muted, 2, [7, 5]);
      drawLine(ctx, F, w, b, c.hl, 3);
      points(ctx, F, T, S, c);
      if (outlier) { K.dot(ctx, F.X(OX), F.Y(OY), 6, c.bad, c.bg); K.text(ctx, 'outlier', F.X(OX) + 10, F.Y(OY) + 4, c.bad, '600 11px Inter, sans-serif'); }
    });
    K.slider(lab, 'w', function (v) { w = v; out(lab, 'wv', v.toFixed(1)); update(); });
    K.slider(lab, 'b', function (v) { b = v; out(lab, 'bv', v); update(); });
    $(lab, '[data-in="sq"]').addEventListener('change', function (e) { showSq = e.target.checked; if (showSq) K.done('ols-sq-show'); update(); });
    $(lab, '[data-in="out"]').addEventListener('change', function (e) { outlier = e.target.checked; if (outlier) K.done('ols-sq-out'); update(); });
    $(lab, '[data-reset]').addEventListener('click', function () {
      K.setSlider(lab, 'w', 5); K.setSlider(lab, 'b', 100);
      $(lab, '[data-in="sq"]').checked = false; $(lab, '[data-in="out"]').checked = false; showSq = outlier = false; update();
    });
    update();
  })();

  /* ═════ Lab 2 — drag the data ═════ */
  (function () {
    var lab = document.getElementById('lab-formula'); if (!lab) return;
    var el = $(lab, 'canvas'), s, ys, xs, pick = -1, moved = 0, w0 = 0;
    function update() {
      var f = fit(xs, ys);
      out(lab, 'mx', f.mx.toFixed(2) + ' °C'); out(lab, 'my', f.my.toFixed(1));
      out(lab, 'sxy', f.sxy.toFixed(0)); out(lab, 'sxx', f.sxx.toFixed(1));
      out(lab, 'w', f.w.toFixed(3)); out(lab, 'b', f.b.toFixed(2));
      s && s.redraw();
      return f;
    }
    s = K.canvas(el, function (ctx, w, h) {
      var c = K.col(), F = plotFrame(ctx, w, h), f = fit(xs, ys);
      drawLine(ctx, F, f.w, f.b, c.hl, 3);
      points(ctx, F, xs, ys, c);
      if (pick >= 0) K.dot(ctx, F.X(xs[pick]), F.Y(ys[pick]), 8, c.accent2, c.text);
      var mx = F.X(f.mx), my = F.Y(f.my);
      ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(mx - 8, my); ctx.lineTo(mx + 8, my); ctx.moveTo(mx, my - 8); ctx.lineTo(mx, my + 8); ctx.stroke();
      K.text(ctx, '(x̄, ȳ)', mx + 10, my - 8, c.text2);
    });
    K.drag(s, el, function (p, start, end) {
      var F = { X: K.scale(XD[0], XD[1], 38, s.w - 12), Y: K.scale(YD[0], YD[1], s.h - 26, 12) };
      if (start) {
        pick = -1; var bestD = 30;
        for (var i = 0; i < xs.length; i++) { var d = Math.hypot(F.X(xs[i]) - p.x, F.Y(ys[i]) - p.y); if (d < bestD) { bestD = d; pick = i; } }
        moved = 0; w0 = fit(xs, ys).w;
      }
      if (pick < 0) return;
      var ny = Math.max(YD[0], Math.min(YD[1], F.Y.inv(p.y)));
      moved += Math.abs(ny - ys[pick]); ys[pick] = ny;
      var f = update(), dx = Math.abs(xs[pick] - f.mx), dw = f.w - w0;
      if (moved > 40) {
        if (dx < 3) { K.done('ols-f-mid'); note(lab, 'A point near the middle moved the line up or down but the slope changed by only <b>' + fmt(dw, 2) + '</b>. It has little leverage.'); }
        else if (dx > 8) { K.done('ols-f-edge'); note(lab, 'An edge point swung the slope by <b>' + fmt(dw, 2) + '</b>. Points far from x̄ have high leverage: they act like a long lever.', 'warn'); }
      }
      if (end) pick = -1, s.redraw();
    });
    function reset() { xs = T.slice(); ys = S.slice(); pick = -1; update(); note(lab, 'The ✚ marks the average point (x̄, ȳ). The best line always goes through it.'); }
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 3 — the loss bowl ═════ */
  (function () {
    var lab = document.getElementById('lab-bowl'); if (!lab) return;
    var WD = [2, 14], BD = [-100, 200], cur, path = [], player;
    var sd = Math.sqrt(BEST.sxx / T.length);
    var heat = null, heatTheme = '';
    function update() {
      var e = sse(T, S, cur.w, cur.b);
      out(lab, 'w', cur.w.toFixed(2)); out(lab, 'b', cur.b.toFixed(1));
      var m = out(lab, 'sse', Math.round(e).toLocaleString()); m.className = e <= BEST.sse * 1.05 ? 'good' : '';
      fitC.redraw(); bowlC.redraw();
      return e;
    }
    var fitC = K.canvas($(lab, '[data-c="fit"]'), function (ctx, w, h) {
      var c = K.col(), F = plotFrame(ctx, w, h);
      drawLine(ctx, F, BEST.w, BEST.b, K.rgba(c.good, 0.6), 2, [6, 5]);
      drawLine(ctx, F, cur.w, cur.b, c.hl, 3);
      points(ctx, F, T, S, c);
    });
    function bowlFrame(w, h) { return { X: K.scale(WD[0], WD[1], 34, w - 10), Y: K.scale(BD[0], BD[1], h - 24, 10) }; }
    var bowlC = K.canvas($(lab, '[data-c="bowl"]'), function (ctx, w, h) {
      var c = K.col(), F = bowlFrame(w, h);
      // Heat map of log(SSE), cached per size/theme
      var key = w + 'x' + h + c.accent;
      if (!heat || heatTheme !== key) {
        var gw = 240, gh = 180, off = document.createElement('canvas'); off.width = gw; off.height = gh;
        var octx = off.getContext('2d'), img = octx.createImageData(gw, gh);
        var hex = c.accent.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
        var rr = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), bb = parseInt(hex.slice(4, 6), 16);
        // Banded shading so contour rings (and the bottom) are visible
        var lo = Math.log(BEST.sse), hi = Math.log(BEST.sse * 40), bands = 9;
        for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
          var wv = WD[0] + (i + 0.5) / gw * (WD[1] - WD[0]), bv = BD[1] - (j + 0.5) / gh * (BD[1] - BD[0]);
          var t = Math.max(0, Math.min(1, (Math.log(sse(T, S, wv, bv)) - lo) / (hi - lo)));
          t = Math.min(1, Math.floor(Math.sqrt(t) * bands) / bands);
          var k = (j * gw + i) * 4; img.data[k] = rr; img.data[k + 1] = gg; img.data[k + 2] = bb; img.data[k + 3] = Math.round((1 - t) * 215 + 12);
        }
        octx.putImageData(img, 0, 0); heat = off; heatTheme = key;
      }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(heat, F.X(WD[0]), F.Y(BD[1]), F.X(WD[1]) - F.X(WD[0]), F.Y(BD[0]) - F.Y(BD[1]));
      K.text(ctx, 'w →', w - 30, h - 8, c.muted); K.text(ctx, 'b ↑', 38, 22, c.text2);
      [4, 8, 12].forEach(function (v) { K.text(ctx, v, F.X(v), h - 8, c.muted, null, 'center'); });
      [-50, 50, 150].forEach(function (v) { K.text(ctx, v, 28, F.Y(v) + 4, c.muted, null, 'right'); });
      K.text(ctx, '★', F.X(BEST.w), F.Y(BEST.b) + 5, c.good, '15px sans-serif', 'center');
      if (path.length > 1) {
        ctx.strokeStyle = c.accent2; ctx.lineWidth = 2; ctx.beginPath();
        path.forEach(function (p, i) { i ? ctx.lineTo(F.X(p[0]), F.Y(p[1])) : ctx.moveTo(F.X(p[0]), F.Y(p[1])); }); ctx.stroke();
      }
      K.dot(ctx, F.X(cur.w), F.Y(cur.b), 7, c.hl, c.bg);
    });
    var bowlEl = $(lab, '[data-c="bowl"]');
    bowlEl.addEventListener('pointerdown', function (e) {
      player.stop(); var p = bowlC.point(e), F = bowlFrame(bowlC.w, bowlC.h);
      cur = { w: Math.max(WD[0], Math.min(WD[1], F.X.inv(p.x))), b: Math.max(BD[0], Math.min(BD[1], F.Y.inv(p.y))) }; path = [];
      var e2 = update();
      if (e2 <= BEST.sse * 1.05) { K.done('ols-b-click'); note(lab, '<b>That\'s the bottom of the bowl</b> — SSE within ' + Math.max(0, Math.round((e2 / BEST.sse - 1) * 100)) + '% of the best.', 'good'); }
      else note(lab, 'SSE here is ' + (e2 / BEST.sse).toFixed(1) + '× the best. Look for the darkest spot.');
    });
    // Gradient descent on standardized temperature: y ≈ a·z + c, z = (x − x̄)/σ
    function gdStep() {
      var a = cur.w * sd, cc = cur.b + cur.w * BEST.mx, ga = 0, gc = 0, n = T.length;
      for (var i = 0; i < n; i++) { var z = (T[i] - BEST.mx) / sd, r = a * z + cc - S[i]; ga += 2 * r * z / n; gc += 2 * r / n; }
      a -= 0.1 * ga; cc -= 0.1 * gc;
      cur = { w: a / sd, b: cc - (a / sd) * BEST.mx }; path.push([cur.w, cur.b]);
      return Math.hypot(ga, gc);
    }
    player = K.player($(lab, '[data-act="gd"]'), 60, function () {
      var g = gdStep(), e = update();
      if (g < 0.05 || path.length > 400) {
        if (Math.abs(e / BEST.sse - 1) < 0.005) { K.done('ols-b-gd'); note(lab, '<b>Gradient descent stopped at w = ' + cur.w.toFixed(3) + ', b = ' + cur.b.toFixed(2) + '</b> — the same line the formula gives (w = ' + BEST.w.toFixed(3) + ', b = ' + BEST.b.toFixed(2) + '), after ' + path.length + ' steps.', 'good'); }
        return false;
      }
    });
    K.on(lab, 'gd', function () { player.toggle(function () { path = [[cur.w, cur.b]]; }); });
    K.on(lab, 'solve', function () { player.stop(); path = []; cur = { w: BEST.w, b: BEST.b }; update(); note(lab, 'The formula lands on the bottom in one jump: <b>w = ' + BEST.w.toFixed(3) + ', b = ' + BEST.b.toFixed(2) + '</b>.', 'good'); });
    function reset() { player && player.stop(); cur = { w: 3.5, b: 150 }; path = []; update(); note(lab, 'Left: the data and your line (dashed green is the best). Right: the SSE landscape over (w, b) — darker is lower. Click the map to pick a line.'); }
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ─── Tiny linear algebra for the matrix labs ─── */
  function matT(A) { return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); }
  function matMul(A, B) { return A.map(function (r) { return B[0].map(function (_, j) { return r.reduce(function (s, v, k) { return s + v * B[k][j]; }, 0); }); }); }
  function solve(A, y) {
    var m = A.length, M = A.map(function (r, i) { return r.concat([y[i]]); });
    for (var c = 0; c < m; c++) {
      var p = c; for (var r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      for (r = 0; r < m; r++) { if (r === c) continue; var f = M[r][c] / M[c][c]; for (var k = c; k <= m; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (r, i) { return r[m] / r[i]; });
  }
  function matHTML(rows, opts) {
    opts = opts || {};
    var cols = rows[0].length;
    return '<div class="mat-wrap"><div class="mat" style="grid-template-columns:repeat(' + cols + ',auto)">' +
      rows.map(function (r, i) { return r.map(function (v, j) { var cls = (opts.hlCol === j ? 'hl2' : '') + (typeof v === 'string' ? ' dim' : ''); return '<span class="' + cls + '">' + (typeof v === 'string' ? v : fmt(v, opts.d == null ? 2 : opts.d)) + '</span>'; }).join(''); }).join('') +
      '</div><span class="mat-cap">' + opts.cap + '</span></div>';
  }

  /* ═════ Lab 4 — matrix form ═════ */
  (function () {
    var lab = document.getElementById('lab-matrix'); if (!lab) return;
    var el = $(lab, 'canvas'), s, useWk = false, temp = 25, predWk = false, beta;
    function solveModel() {
      var X = T.map(function (t, i) { return useWk ? [1, t, WK[i]] : [1, t]; });
      var Xt = matT(X), XtX = matMul(Xt, X), Xty = matMul(Xt, S.map(function (v) { return [v]; })).map(function (r) { return r[0]; });
      beta = solve(XtX, Xty);
      var pred = X.map(function (r) { return r.reduce(function (sum, v, k) { return sum + v * beta[k]; }, 0); });
      var res = S.map(function (y, i) { return y - pred[i]; });
      var Xtr = matMul(Xt, res.map(function (v) { return [v]; })).map(function (r) { return r[0]; });
      var sseV = res.reduce(function (a, r) { return a + r * r; }, 0), my = S.reduce(function (a, b) { return a + b; }) / S.length;
      var sst = S.reduce(function (a, y) { return a + (y - my) * (y - my); }, 0);
      return { X: X, XtX: XtX, Xty: Xty, Xtr: Xtr, sse: sseV, r2: 1 - sseV / sst };
    }
    function update() {
      var m = solveModel();
      var p = beta[0] + beta[1] * temp + (useWk && predWk ? beta[2] : 0);
      out(lab, 'pred', Math.round(p)); out(lab, 'tv', temp + ' °C');
      var r2 = out(lab, 'r2', m.r2.toFixed(3)); r2.className = m.r2 > 0.95 ? 'good' : '';
      out(lab, 'sse', Math.round(m.sse).toLocaleString());
      var head = m.X.slice(0, 4).concat([m.X[0].map(function () { return '⋮'; })]);
      $(lab, '[data-out="mats"]').innerHTML =
        matHTML(head, { cap: 'X (18 × ' + beta.length + ')', d: 1, hlCol: useWk ? 2 : -1 }) + '<span class="mat-op">·</span>' +
        matHTML(beta.map(function (v) { return [v]; }), { cap: 'β' }) + '<span class="mat-op">&nbsp;&nbsp;</span>' +
        matHTML(m.XtX, { cap: 'XᵀX', d: 1 }) + matHTML(m.Xty.map(function (v) { return [v]; }), { cap: 'Xᵀy', d: 0 }) +
        matHTML(m.Xtr.map(function (v) { return [Math.abs(v) < 1e-6 ? 0 : v]; }), { cap: 'Xᵀr (≈ 0)', d: 4 });
      if (useWk) {
        K.done('ols-m-add');
        if (temp >= 30 && predWk) { K.done('ols-m-pred'); note(lab, 'Prediction: <b>' + beta[0].toFixed(1) + ' + ' + beta[1].toFixed(2) + ' × ' + temp + ' + ' + beta[2].toFixed(1) + ' × 1 ≈ ' + Math.round(p) + '</b> ice creams. Each coefficient is "how much this feature adds".', 'good'); }
        else note(lab, 'With the weekend column, β₂ ≈ <b>' + beta[2].toFixed(1) + '</b>: weekends sell about ' + Math.round(beta[2]) + ' more at the same temperature. R² jumped to ' + m.r2.toFixed(3) + '.', 'good');
      } else note(lab, 'One feature (temperature). Weekend days are drawn as squares — notice they sit above the line.');
      s && s.redraw();
    }
    s = K.canvas(el, function (ctx, w, h) {
      var c = K.col(), F = plotFrame(ctx, w, h);
      if (!beta) return;
      if (useWk) { drawLine(ctx, F, beta[1], beta[0] + beta[2], c.hl, 2.5); drawLine(ctx, F, beta[1], beta[0], c.accent2, 2.5); K.text(ctx, 'weekend', F.X(12), F.Y(beta[0] + beta[2] + beta[1] * 12) - 8, c.hl, '600 11px Inter, sans-serif'); K.text(ctx, 'weekday', F.X(30), F.Y(beta[0] + beta[1] * 30) + 18, c.accent2, '600 11px Inter, sans-serif'); }
      else drawLine(ctx, F, beta[1], beta[0], c.accent, 2.5);
      points(ctx, F, T, S, c, true);
      var p = beta[0] + beta[1] * temp + (useWk && predWk ? beta[2] : 0);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(F.X(temp), h - 26); ctx.lineTo(F.X(temp), F.Y(p)); ctx.stroke(); ctx.setLineDash([]);
      K.dot(ctx, F.X(temp), F.Y(p), 7, c.bg, c.text);
    });
    $(lab, '[data-in="wk"]').addEventListener('change', function (e) { useWk = e.target.checked; update(); });
    $(lab, '[data-in="pw"]').addEventListener('change', function (e) { predWk = e.target.checked; update(); });
    K.slider(lab, 't', function (v) { temp = v; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { $(lab, '[data-in="wk"]').checked = false; $(lab, '[data-in="pw"]').checked = false; useWk = predWk = false; K.setSlider(lab, 't', 25); });
    update();
  })();

  /* ═════ Lab 5 — diagnostics ═════ */
  (function () {
    var lab = document.getElementById('lab-diag'); if (!lab) return;
    var r = K.rng(5), noise = function () { return (r() + r() + r() - 1.5) * 1.15; };
    var xs = K.range(0.5, 10, 0.5);
    var sets = {
      good: { y: xs.map(function (x) { return 3 + 2 * x + noise() * 2; }), note: '<b>A — healthy.</b> The residuals form a shapeless band around zero. A straight line is the right model.', cls: 'good' },
      curve: { y: xs.map(function (x) { return 2 + 0.3 * x * x + noise() * 1.2; }), note: '<b>B — curved.</b> Residuals make a U: positive at both ends, negative in the middle. The true relationship bends, so a line misses systematically — despite a high R².', cls: 'bad' },
      fan: { y: xs.map(function (x) { return 3 + 2 * x + noise() * 0.6 * x; }), note: '<b>C — fanning out.</b> Errors grow as predictions grow (uneven noise, called <em>heteroscedasticity</em>). The line is okay on average, but its uncertainty is not the same everywhere.', cls: 'warn' },
      outlier: { y: xs.map(function (x, i) { return i === 18 ? 1 : 3 + 2 * x + noise() * 1.5; }), note: '<b>D — outlier.</b> One point sits far from the rest and drags the line down at the right end. Check it: data error, or a genuinely unusual case?', cls: 'warn' }
    };
    var ds = 'good', seen = {};
    function current() { var y = sets[ds].y, f = fit(xs, y); return { y: y, f: f }; }
    function update() {
      var d = current();
      out(lab, 'r2', d.f.r2.toFixed(3)); out(lab, 'w', d.f.w.toFixed(2));
      note(lab, sets[ds].note, sets[ds].cls);
      seen[ds] = true; if (Object.keys(seen).length === 4) K.done('ols-d-all');
      fitC.redraw(); resC.redraw();
    }
    var fitC = K.canvas($(lab, '[data-c="fit"]'), function (ctx, w, h) {
      var c = K.col(), d = current(), F = K.frame(ctx, w, h, [0, 10.5], [0, 34], { xticks: [0, 5, 10], yticks: [0, 10, 20, 30], pl: 30 });
      ctx.strokeStyle = c.hl; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(F.X(0), F.Y(d.f.b)); ctx.lineTo(F.X(10.5), F.Y(d.f.w * 10.5 + d.f.b)); ctx.stroke();
      xs.forEach(function (x, i) { K.dot(ctx, F.X(x), F.Y(d.y[i]), 4, c.accent2); });
    });
    var resC = K.canvas($(lab, '[data-c="res"]'), function (ctx, w, h) {
      var c = K.col(), d = current(), preds = xs.map(function (x) { return d.f.w * x + d.f.b; });
      var F = K.frame(ctx, w, h, [Math.min.apply(null, preds) - 1, Math.max.apply(null, preds) + 1], [-12, 12], { xticks: [], yticks: [-10, 0, 10], pl: 30, xlabel: 'prediction →', ylabel: 'residual' });
      ctx.strokeStyle = c.muted; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(F.pl, F.Y(0)); ctx.lineTo(w - F.pr, F.Y(0)); ctx.stroke(); ctx.setLineDash([]);
      xs.forEach(function (x, i) { var rr = d.y[i] - preds[i]; K.dot(ctx, F.X(preds[i]), F.Y(Math.max(-12, Math.min(12, rr))), 4, Math.abs(rr) > 8 ? c.bad : c.accent); });
    });
    K.seg(lab, 'ds', function (v) { ds = v; update(); });
    update();
  })();
})();
