/* Backpropagation lesson — interactive labs. Uses window.Kit (lesson/labkit.js). */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, out = K.out, note = K.note, fmt = K.fmt;
  var sig = function (z) { return 1 / (1 + Math.exp(-z)); };

  /* ─── The 2-2-1 network used in chapters 0, 3 and 4 ─── */
  var X = [0.6, 0.9], Y = 1;
  var P0 = { w11: 0.4, w12: -0.3, w21: 0.2, w22: 0.7, b1: 0.1, b2: -0.2, v1: 0.8, v2: -0.5, c: 0.05 };
  var NAMES = { w11: 'w₁₁', w12: 'w₁₂', w21: 'w₂₁', w22: 'w₂₂', b1: 'b₁', b2: 'b₂', v1: 'v₁', v2: 'v₂', c: 'c' };
  function forward(p) {
    var z1 = p.w11 * X[0] + p.w12 * X[1] + p.b1, z2 = p.w21 * X[0] + p.w22 * X[1] + p.b2;
    var h1 = sig(z1), h2 = sig(z2), zo = p.v1 * h1 + p.v2 * h2 + p.c, yh = sig(zo);
    return { z1: z1, z2: z2, h1: h1, h2: h2, zo: zo, yh: yh, L: -(Y * Math.log(yh) + (1 - Y) * Math.log(1 - yh)) };
  }
  function backward(p, f) {
    var dO = f.yh - Y, d1 = dO * p.v1 * f.h1 * (1 - f.h1), d2 = dO * p.v2 * f.h2 * (1 - f.h2);
    return { dO: dO, d1: d1, d2: d2, v1: dO * f.h1, v2: dO * f.h2, c: dO, w11: d1 * X[0], w12: d1 * X[1], w21: d2 * X[0], w22: d2 * X[1], b1: d1, b2: d2 };
  }
  function numGrad(p, k) { var e = 1e-5, a = Object.assign({}, p), b = Object.assign({}, p); a[k] += e; b[k] -= e; return (forward(a).L - forward(b).L) / (2 * e); }

  // Draw the network. show: which values are visible; grads: gradients to print (or null)
  function drawNet(ctx, w, h, p, f, show, grads, extra) {
    var c = K.col(), cols = [w * 0.1, w * 0.4, w * 0.7, w * 0.9];
    var pos = { x1: [cols[0], h * 0.3], x2: [cols[0], h * 0.72], h1: [cols[1], h * 0.3], h2: [cols[1], h * 0.72], o: [cols[2], h * 0.51], L: [cols[3], h * 0.51] };
    var edges = [['x1', 'h1', 'w11'], ['x2', 'h1', 'w12'], ['x1', 'h2', 'w21'], ['x2', 'h2', 'w22'], ['h1', 'o', 'v1'], ['h2', 'o', 'v2']];
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]], val = p[e[2]];
      ctx.strokeStyle = K.rgba(val >= 0 ? c.accent : c.bad, 0.35 + Math.min(0.5, Math.abs(val) * 0.5)); ctx.lineWidth = 1 + Math.abs(val) * 3;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      // Label positions chosen so the two crossing edges' labels don't collide
      var t = { w11: 0.5, w22: 0.5, w21: 0.27, w12: 0.73, v1: 0.45, v2: 0.45 }[e[2]], lx = a[0] + (b[0] - a[0]) * t, ly = a[1] + (b[1] - a[1]) * t;
      ctx.fillStyle = c.surface; ctx.fillRect(lx - 30, ly - 17, 60, grads && grads[e[2]] != null ? 32 : 17);
      K.text(ctx, NAMES[e[2]] + '=' + val.toFixed(2), lx, ly - 4, c.text2, '600 10.5px JetBrains Mono, monospace', 'center');
      if (grads && grads[e[2]] != null) K.text(ctx, '∇' + fmt(grads[e[2]], 3), lx, ly + 11, c.bad, '700 10.5px JetBrains Mono, monospace', 'center');
      if (extra && extra[e[2]] != null) { ctx.fillStyle = K.rgba(c.hl, 0.18); ctx.fillRect(lx - 32, ly + 17, 64, 16); K.text(ctx, 'slope ' + fmt(extra[e[2]], 3), lx, ly + 29, c.hl, '700 10px JetBrains Mono, monospace', 'center'); }
    });
    ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pos.o[0] + 26, pos.o[1]); ctx.lineTo(pos.L[0] - 30, pos.L[1]); ctx.stroke(); ctx.setLineDash([]);
    function node(id, label, value, grad, isLoss) {
      var q = pos[id], r = isLoss ? 30 : 26;
      ctx.beginPath(); if (isLoss) K.roundRect(ctx, q[0] - 30, q[1] - 26, 60, 52, 12); else ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.fillStyle = c.surface; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = value == null ? c.border : isLoss ? c.hl : id[0] === 'x' ? c.accent2 : c.accent; ctx.stroke();
      K.text(ctx, label, q[0], q[1] - 7, c.muted, '600 10px Inter, sans-serif', 'center');
      K.text(ctx, value == null ? '?' : value.toFixed(3), q[0], q[1] + 9, c.text, '700 12px JetBrains Mono, monospace', 'center');
      if (grad != null) K.text(ctx, 'δ=' + fmt(grad, 3), q[0], q[1] + (id === 'h1' ? -34 : 42), c.bad, '700 11px JetBrains Mono, monospace', 'center');
    }
    node('x1', 'x₁', X[0]); node('x2', 'x₂', X[1]);
    node('h1', 'h₁', show.h1 ? f.h1 : null, grads && grads.d1 != null ? grads.d1 : null);
    node('h2', 'h₂', show.h2 ? f.h2 : null, grads && grads.d2 != null ? grads.d2 : null);
    node('o', 'ŷ', show.o ? f.yh : null, grads && grads.dO != null ? grads.dO : null);
    node('L', 'loss', show.L ? f.L : null, null, true);
    K.text(ctx, 'target y = 1', pos.L[0], pos.L[1] + 44, c.muted, '600 10px Inter, sans-serif', 'center');
  }

  /* ═════ Lab 0 — nudging ═════ */
  (function () {
    var lab = document.getElementById('lab-nudge'); if (!lab) return;
    var sel = 'w11', slopes, runs, s;
    function reset() { slopes = {}; runs = 1; update(); note(lab, 'Pick a weight and nudge it.'); }
    function update() { out(lab, 'runs', runs); out(lab, 'count', Object.keys(slopes).length); s && s.redraw(); }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) { drawNet(ctx, w, h, P0, forward(P0), { h1: 1, h2: 1, o: 1, L: 1 }, null, slopes); });
    K.seg(lab, 'wsel', function (v) { sel = v; });
    K.on(lab, 'nudge', function () {
      var p = Object.assign({}, P0); p[sel] += 0.001;
      var L0 = forward(P0).L, L1 = forward(p).L, slope = (L1 - L0) / 0.001;
      slopes[sel] = slope; runs++;
      update();
      note(lab, 'Loss went from ' + L0.toFixed(6) + ' to ' + L1.toFixed(6) + ', so the slope of ' + NAMES[sel] + ' ≈ (' + fmt(L1 - L0, 6) + ') ÷ 0.001 = <b>' + fmt(slope, 3) + '</b>. That cost one more run of the network.');
      if (Object.keys(slopes).length >= 3) { K.done('bp-n-three'); note(lab, '<b>' + Object.keys(slopes).length + ' slopes cost ' + runs + ' runs.</b> This network has only 9 numbers to tune. GPT-scale models have hundreds of billions — nudging would take forever.', 'warn'); }
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 1 — one neuron ═════ */
  (function () {
    var lab = document.getElementById('lab-neuron'); if (!lab) return;
    var v = { x1: 1, w1: 0.5, x2: 1, w2: -1, b: 0 }, s;
    function z() { return v.w1 * v.x1 + v.w2 * v.x2 + v.b; }
    function update() {
      var zz = z(), a = sig(zz);
      if (a > 0.95) K.done('bp-u-high');
      if (a >= 0.49 && a <= 0.51) K.done('bp-u-half');
      if (Math.abs(zz) > 5) K.done('bp-u-flat');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), zz = z(), a = sig(zz);
      var F = K.frame(ctx, w, h, [-8, 8], [-0.05, 1.08], { pt: 70, xticks: K.range(-8, 8, 2), yticks: [0, 0.5, 1], xlabel: 'z', ylabel: '' });
      ctx.strokeStyle = c.accent; ctx.lineWidth = 3; ctx.beginPath();
      for (var i = 0; i <= 200; i++) { var x = -8 + i / 200 * 16; i ? ctx.lineTo(F.X(x), F.Y(sig(x))) : ctx.moveTo(F.X(x), F.Y(sig(x))); } ctx.stroke();
      var zc = Math.max(-8, Math.min(8, zz));
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.X(zc), h - F.pb); ctx.lineTo(F.X(zc), F.Y(a)); ctx.lineTo(F.pl, F.Y(a)); ctx.stroke(); ctx.setLineDash([]);
      // slope indicator
      var sl = a * (1 - a); ctx.strokeStyle = c.hl; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(F.X(zc - 1.5), F.Y(a - sl * 1.5)); ctx.lineTo(F.X(zc + 1.5), F.Y(a + sl * 1.5)); ctx.stroke();
      K.dot(ctx, F.X(zc), F.Y(a), 8, c.hl, c.bg);
      K.text(ctx, 'z = ' + v.w1.toFixed(1) + '·' + v.x1.toFixed(1) + ' + ' + v.w2.toFixed(1) + '·' + v.x2.toFixed(1) + ' + ' + v.b.toFixed(1) + ' = ' + zz.toFixed(2), 14, 24, c.text, '600 13px JetBrains Mono, monospace');
      K.text(ctx, 'output σ(z) = ' + a.toFixed(3) + '     slope σ′(z) = ' + sl.toFixed(3), 14, 46, a > 0.95 ? c.good : c.text2, '600 13px JetBrains Mono, monospace');
    });
    ['x1', 'w1', 'x2', 'w2', 'b'].forEach(function (k) { K.slider(lab, k, function (val) { v[k] = val; out(lab, k + 'v', val.toFixed(1)); update(); }); });
    $(lab, '[data-reset]').addEventListener('click', function () { K.setSlider(lab, 'x1', 1); K.setSlider(lab, 'w1', 0.5); K.setSlider(lab, 'x2', 1); K.setSlider(lab, 'w2', -1); K.setSlider(lab, 'b', 0); });
    update();
  })();

  /* ═════ Lab 2 — chain rule on f = (a + b) · c ═════ */
  (function () {
    var lab = document.getElementById('lab-chain'); if (!lab) return;
    var v = { a: 2, b: -1, c: 3 }, stage = 0, base = null, s;
    function vals() { var q = v.a + v.b; return { q: q, f: q * v.c }; }
    function grads() { var q = v.a + v.b; return { f: 1, q: v.c, c: q, a: v.c, b: v.c }; }
    function update() {
      var fv = vals(), g = grads();
      if (stage === 0) note(lab, 'Forward values are shown in each box. Press "Backward step" to send gradients (in red) from f back to the inputs.');
      if (stage === 1) note(lab, 'Start at the end: <b>∂f/∂f = 1</b> (changing f by 1 changes f by 1).');
      if (stage === 2) note(lab, 'Through the × box: f = q·c. Its local derivatives are the <em>other</em> input: <b>∂f/∂q = c = ' + v.c + '</b>, <b>∂f/∂c = q = ' + fv.q + '</b>.');
      if (stage === 3) {
        if (!base) base = { a: v.a, f: fv.f, ga: g.a };
        var da = v.a - base.a;
        if (Math.abs(da) > 1e-9) {
          note(lab, 'You changed a by <b>' + fmt(da, 1) + '</b>. The gradient predicted f would change by ∂f/∂a × Δa = ' + base.ga + ' × ' + fmt(da, 1) + ' = <b>' + fmt(base.ga * da, 2) + '</b>. It actually changed by <b>' + fmt(fv.f - base.f, 2) + '</b>. ✓', 'good');
          if (da >= 0.5 - 1e-9) K.done('bp-c-test');
        } else note(lab, 'Through the + box: its local derivatives are both 1, so it passes the gradient through: <b>∂f/∂a = ∂f/∂b = ∂f/∂q × 1 = ' + g.q + '</b>. Done — every input has its gradient.', 'good');
        K.done('bp-c-back');
      }
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), fv = vals(), g = grads();
      var P = { a: [w * 0.1, h * 0.25], b: [w * 0.1, h * 0.62], c: [w * 0.45, h * 0.8], q: [w * 0.4, h * 0.42], f: [w * 0.75, h * 0.55] };
      function edge(a, b) { ctx.strokeStyle = c.border; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); }
      edge('a', 'q'); edge('b', 'q'); edge('q', 'f'); edge('c', 'f');
      function box(id, label, val, gv, showG, op) {
        var q = P[id], bw = 92, bh = 50;
        ctx.beginPath(); K.roundRect(ctx, q[0] - bw / 2, q[1] - bh / 2, bw, bh, 12); ctx.fillStyle = c.surface; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = showG ? c.bad : op ? c.accent : c.accent2; ctx.stroke();
        K.text(ctx, label, q[0], q[1] - 6, c.muted, '600 11px Inter, sans-serif', 'center');
        K.text(ctx, val, q[0], q[1] + 12, c.text, '700 13px JetBrains Mono, monospace', 'center');
        if (showG) K.text(ctx, '∂f/∂' + id + ' = ' + gv, q[0], q[1] + bh / 2 + 16, c.bad, '700 12px JetBrains Mono, monospace', 'center');
      }
      box('a', 'a', v.a, g.a, stage >= 3); box('b', 'b', v.b, g.b, stage >= 3); box('c', 'c', v.c, g.c, stage >= 2);
      box('q', 'q = a + b', fv.q, g.q, stage >= 2, true); box('f', 'f = q × c', fv.f, g.f, stage >= 1, true);
    });
    ['a', 'b', 'c'].forEach(function (k) { K.slider(lab, k, function (val) { v[k] = val; out(lab, k + 'v', val); if (stage < 3) base = null; update(); }); });
    K.on(lab, 'back', function () { if (stage < 3) stage++; if (stage === 3) base = null; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { stage = 0; base = null; K.setSlider(lab, 'a', 2); K.setSlider(lab, 'b', -1); K.setSlider(lab, 'c', 3); });
    update();
  })();

  /* ═════ Lab 3 — forward pass ═════ */
  (function () {
    var lab = document.getElementById('lab-forward'); if (!lab) return;
    var stage = 0, s, f = forward(P0), order = ['h1', 'h2', 'o', 'L'];
    var notes = [
      'Press "Forward step" to compute the network one neuron at a time.',
      'Hidden neuron 1: z₁ = 0.4·0.6 + (−0.3)·0.9 + 0.1 = <b>' + f.z1.toFixed(3) + '</b>, so h₁ = σ(' + f.z1.toFixed(3) + ') = <b>' + f.h1.toFixed(3) + '</b>.',
      'Hidden neuron 2: z₂ = 0.2·0.6 + 0.7·0.9 − 0.2 = <b>' + f.z2.toFixed(3) + '</b>, so h₂ = <b>' + f.h2.toFixed(3) + '</b>.',
      'Output: zₒ = 0.8·' + f.h1.toFixed(3) + ' + (−0.5)·' + f.h2.toFixed(3) + ' + 0.05 = <b>' + f.zo.toFixed(3) + '</b>, so ŷ = σ(zₒ) = <b>' + f.yh.toFixed(3) + '</b>. The network is only ' + Math.round(f.yh * 100) + '% sure the answer is 1.',
      'Loss: −ln(' + f.yh.toFixed(3) + ') = <b>' + f.L.toFixed(3) + '</b>. If ŷ were 1, the loss would be 0. Next chapter: which weights should change, and by how much?'
    ];
    function update() { note(lab, notes[stage], stage === 4 ? 'good' : ''); if (stage === 4) K.done('bp-f-done'); s && s.redraw(); }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) { var show = {}; order.slice(0, stage).forEach(function (k) { show[k] = 1; }); drawNet(ctx, w, h, P0, f, show, null); });
    K.on(lab, 'fwd', function () { if (stage < 4) stage++; update(); });
    K.on(lab, 'all', function () { stage = 4; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { stage = 0; update(); });
    update();
  })();

  /* ═════ Lab 4 — backward pass + gradient check ═════ */
  (function () {
    var lab = document.getElementById('lab-backward'); if (!lab) return;
    var stage = 0, s, f = forward(P0), g = backward(P0, f), rows = $(lab, '[data-out="rows"]');
    var keysByStage = [[], ['dO'], ['dO', 'v1', 'v2', 'c'], ['dO', 'v1', 'v2', 'c', 'd1', 'd2'], ['dO', 'v1', 'v2', 'c', 'd1', 'd2', 'w11', 'w12', 'w21', 'w22', 'b1', 'b2']];
    var notes = [
      'Forward values in black, gradients in red. Press "Backward step".',
      'Output signal: δₒ = ŷ − y = ' + f.yh.toFixed(3) + ' − 1 = <b>' + fmt(g.dO, 3) + '</b>. Negative: the output should go <em>up</em>.',
      'Output weights: ∂L/∂v₁ = δₒ·h₁ = ' + fmt(g.dO, 3) + '·' + f.h1.toFixed(3) + ' = <b>' + fmt(g.v1, 3) + '</b>, ∂L/∂v₂ = δₒ·h₂ = <b>' + fmt(g.v2, 3) + '</b>.',
      'Into the hidden layer: δ₁ = δₒ·v₁·h₁(1−h₁) = <b>' + fmt(g.d1, 4) + '</b>, δ₂ = δₒ·v₂·h₂(1−h₂) = <b>' + fmt(g.d2, 4) + '</b>. Note δ₂ is positive because v₂ is negative.',
      'First-layer weights: ∂L/∂w_jk = δ_j · x_k, e.g. ∂L/∂w₁₁ = ' + fmt(g.d1, 4) + ' · 0.6 = <b>' + fmt(g.w11, 4) + '</b>. Every weight now has its gradient — from one backward pass.'
    ];
    function update() {
      note(lab, notes[stage], stage === 4 ? 'good' : '');
      if (stage === 4) K.done('bp-b-done');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var gg = {}; keysByStage[stage].forEach(function (k) { gg[k] = g[k]; });
      drawNet(ctx, w, h, P0, f, { h1: 1, h2: 1, o: 1, L: 1 }, stage ? gg : null);
    });
    K.on(lab, 'back', function () { if (stage < 4) stage++; update(); });
    K.on(lab, 'check', function () {
      var all = true;
      rows.innerHTML = Object.keys(NAMES).map(function (k) {
        var bp = g[k], nm = numGrad(P0, k), ok = Math.abs(bp - nm) < 1e-6 * Math.max(1, Math.abs(bp)); all = all && ok;
        return '<tr class="new"><td>' + NAMES[k] + '</td><td>' + bp.toFixed(6) + '</td><td>' + nm.toFixed(6) + '</td><td style="color:' + (ok ? 'var(--good)' : 'var(--bad)') + '">' + (ok ? '✓' : '✗') + '</td></tr>';
      }).join('');
      if (all) { K.done('bp-b-check'); note(lab, '<b>All 9 gradients match</b> to 6 decimal places. Nudging needed 18 extra runs to get them; backprop needed one backward pass.', 'good'); }
    });
    $(lab, '[data-reset]').addEventListener('click', function () { stage = 0; rows.innerHTML = ''; update(); });
    update();
  })();

  /* ═════ Lab 5 — XOR ═════ */
  (function () {
    var lab = document.getElementById('lab-xor'); if (!lab) return;
    var DX = [[0, 0], [0, 1], [1, 0], [1, 1]], DY = [0, 1, 1, 0];
    var H = 4, lr = 1, seed = 1, net, losses, epoch, player;
    function init() {
      var r = K.rng(seed), i;
      net = { W: [], b: [], V: [], c: 0 };
      for (i = 0; i < H; i++) net.W.push([(r() * 2 - 1) * 1.5, (r() * 2 - 1) * 1.5]);
      for (i = 0; i < H; i++) net.b.push(r() * 2 - 1);
      for (i = 0; i < H; i++) net.V.push((r() * 2 - 1) * 1.5);
      losses = []; epoch = 0; losses.push(lossAll());
    }
    function predict(x) { var z = net.c; for (var j = 0; j < H; j++) z += net.V[j] * Math.tanh(net.W[j][0] * x[0] + net.W[j][1] * x[1] + net.b[j]); return sig(z); }
    function lossAll() { var L = 0; for (var n = 0; n < 4; n++) { var p = predict(DX[n]); L += -(DY[n] * Math.log(p + 1e-12) + (1 - DY[n]) * Math.log(1 - p + 1e-12)); } return L / 4; }
    function step() {
      var gW = net.W.map(function () { return [0, 0]; }), gb = net.b.map(function () { return 0; }), gV = net.V.map(function () { return 0; }), gc = 0;
      for (var n = 0; n < 4; n++) {
        var h = net.W.map(function (w, j) { return Math.tanh(w[0] * DX[n][0] + w[1] * DX[n][1] + net.b[j]); });
        var z = h.reduce(function (s, v, j) { return s + v * net.V[j]; }, net.c), p = sig(z), d = p - DY[n];
        gc += d;
        for (var j = 0; j < H; j++) { gV[j] += d * h[j]; var dh = d * net.V[j] * (1 - h[j] * h[j]); gb[j] += dh; gW[j][0] += dh * DX[n][0]; gW[j][1] += dh * DX[n][1]; }
      }
      for (j = 0; j < H; j++) { net.V[j] -= lr * gV[j] / 4; net.b[j] -= lr * gb[j] / 4; net.W[j][0] -= lr * gW[j][0] / 4; net.W[j][1] -= lr * gW[j][1] / 4; }
      net.c -= lr * gc / 4; epoch++; losses.push(lossAll());
    }
    function show() {
      out(lab, 'k', epoch); var L = losses[losses.length - 1], e = out(lab, 'L', L.toFixed(3)); e.className = L < 0.1 ? 'good' : ''; out(lab, 'seed', seed);
      mapC.redraw(); lossC.redraw();
    }
    function reset() { player && player.stop(); init(); show(); note(lab, 'The four dots are XOR\'s examples: teal = 1, orange = 0. Background colour is what the network currently predicts.'); }
    var mapC = K.canvas($(lab, '[data-c="map"]'), function (ctx, w, h) {
      var c = K.col(), n = 36, sz = Math.min(w, h) - 30, ox = (w - sz) / 2, oy = (h - sz) / 2, cell = sz / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var x = -0.25 + (i + 0.5) / n * 1.5, y = 1.25 - (j + 0.5) / n * 1.5, p = predict([x, y]);
        ctx.fillStyle = p > 0.5 ? K.rgba(c.accent2, (p - 0.5) * 1.1) : K.rgba(c.hl, (0.5 - p) * 1.1);
        ctx.fillRect(ox + i * cell, oy + j * cell, cell + 0.5, cell + 0.5);
      }
      DX.forEach(function (x, k) { var px = ox + (x[0] + 0.25) / 1.5 * sz, py = oy + (1.25 - x[1]) / 1.5 * sz; K.dot(ctx, px, py, 10, DY[k] ? c.accent2 : c.hl, c.text); K.text(ctx, '(' + x[0] + ',' + x[1] + ')', px, py + (x[1] ? -16 : 24), c.text, '600 11px JetBrains Mono, monospace', 'center'); });
    });
    var lossC = K.canvas($(lab, '[data-c="loss"]'), function (ctx, w, h) {
      var c = K.col(), maxK = Math.max(100, losses.length - 1);
      var F = K.frame(ctx, w, h, [0, maxK], [-3, 0], { pl: 36, xticks: [], yticks: [-3, -2, -1, 0], yfmt: function (t) { return t === 0 ? '1' : '1e' + t; }, xlabel: 'epoch ' + maxK, ylabel: 'loss (log)' });
      ctx.setLineDash([5, 4]); ctx.strokeStyle = c.good; ctx.beginPath(); ctx.moveTo(F.pl, F.Y(-1)); ctx.lineTo(w - F.pr, F.Y(-1)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath();
      losses.forEach(function (L, k) { var y = F.Y(Math.max(-3, Math.min(0, Math.log10(L)))); k ? ctx.lineTo(F.X(k), y) : ctx.moveTo(F.X(k), y); }); ctx.stroke();
    });
    player = K.player($(lab, '[data-act="train"]'), 30, function () {
      for (var i = 0; i < 15; i++) step();
      show();
      var L = losses[losses.length - 1];
      if (L < 0.1) { K.done('bp-x-solve'); note(lab, '<b>Learned XOR in ' + epoch + ' epochs.</b> The hidden neurons carved the plane so the two teal corners sit on one side and the orange ones on the other.', 'good'); return false; }
      if (epoch >= 3000) {
        if (H === 2 && L > 0.3) { K.done('bp-x-stuck'); note(lab, '<b>Stuck at loss ' + L.toFixed(3) + '.</b> Three examples are right, one is wrong, and every small change makes things worse — a local minimum. Try another random start, or use 4 neurons.', 'bad'); }
        else note(lab, 'Stopped after 3000 epochs at loss ' + L.toFixed(3) + '. Try a larger learning rate or a new random start.', 'warn');
        return false;
      }
    });
    K.on(lab, 'train', function () { player.toggle(function () { if (losses[losses.length - 1] < 0.1 || epoch >= 3000) init(); }); });
    K.on(lab, 'seed', function () { seed++; reset(); });
    K.seg(lab, 'hidden', function (v) { H = +v; seed = 1; reset(); });
    K.slider(lab, 'lr', function (v) { lr = v; out(lab, 'lrv', v.toFixed(1)); });
    $(lab, '[data-reset]').addEventListener('click', function () { seed = 1; reset(); });
    reset();
  })();

  /* ═════ Lab 6 — vanishing gradients ═════ */
  (function () {
    var lab = document.getElementById('lab-vanish'); if (!lab) return;
    var depth = 6, act = 'sig', s, deepSeen = false;
    // Fixed pre-activations per layer (standard normal draws) so the chart is stable
    var r = K.rng(9), Z = []; for (var i = 0; i < 20; i++) { var u = Math.max(1e-9, r()), v = r(); Z.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); }
    function grads() {
      var g = [], acc = 1;
      for (var l = depth; l >= 1; l--) { g[l - 1] = acc; var z = Z[l - 1], d = act === 'sig' ? sig(z) * (1 - sig(z)) : 1; acc *= d; }
      return g;
    }
    function update() {
      var g = grads(), g1 = g[0];
      out(lab, 'dv', depth); var e = out(lab, 'g1', g1 < 1e-3 ? g1.toExponential(1) : g1.toFixed(3)); e.className = g1 < 1e-6 ? 'bad' : act === 'relu' ? 'good' : '';
      if (act === 'sig' && g1 < 1e-6) { K.done('bp-v-deep'); deepSeen = true; }
      if (act === 'relu' && (deepSeen || depth >= 10)) K.done('bp-v-relu');
      note(lab, act === 'sig' ? (g1 < 1e-6 ? '<b>Vanished.</b> Layer 1 receives ' + g1.toExponential(1) + ' of the output\'s gradient — its weights essentially never change.' : 'Each sigmoid layer multiplies the gradient by σ′(z) ≤ 0.25. Add more layers.') : '<b>ReLU:</b> slope 1 on active units, so layer 1 gets the full gradient at any depth.', act === 'sig' ? (g1 < 1e-6 ? 'bad' : '') : 'good');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), g = grads();
      var F = K.frame(ctx, w, h, [0.5, depth + 0.5], [-12, 0], { pl: 44, xticks: [], yticks: [-12, -9, -6, -3, 0], yfmt: function (t) { return t === 0 ? '1' : '1e' + t; }, ylabel: 'gradient size (log)' });
      var bw = Math.max(4, (w - F.pl - F.pr) / depth * 0.6);
      g.forEach(function (v, i) {
        var lv = Math.max(-12, Math.log10(v)), x = F.X(i + 1);
        ctx.fillStyle = v < 1e-6 ? c.bad : v < 1e-2 ? c.warn : c.accent2;
        ctx.fillRect(x - bw / 2, F.Y(lv), bw, F.Y(-12) - F.Y(lv));
        if (depth <= 12 || i % 2 === 0) K.text(ctx, 'L' + (i + 1), x, h - 8, c.muted, null, 'center');
      });
      K.text(ctx, 'output side →', w - F.pr, F.pt + 12, c.muted, null, 'right');
    });
    K.slider(lab, 'depth', function (v) { depth = v; update(); });
    K.seg(lab, 'act', function (v) { act = v; update(); });
    update();
  })();
})();
