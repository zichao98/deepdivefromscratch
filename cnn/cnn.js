/* CNN lesson — interactive labs. Uses window.Kit (lesson/labkit.js). */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, out = K.out, note = K.note;

  function zeros(n, m) { var a = []; for (var i = 0; i < n; i++) { a.push([]); for (var j = 0; j < (m || n); j++) a[i].push(0); } return a; }
  function conv(I, Kr) {
    var n = I.length, k = Kr.length, o = zeros(n - k + 1);
    for (var i = 0; i <= n - k; i++) for (var j = 0; j <= n - k; j++) { var s = 0; for (var a = 0; a < k; a++) for (var b = 0; b < k; b++) s += I[i + a][j + b] * Kr[a][b]; o[i][j] = s; }
    return o;
  }
  function maxAbs(M) { var m = 1e-9; M.forEach(function (r) { r.forEach(function (v) { m = Math.max(m, Math.abs(v)); }); }); return m; }
  function num(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1); }
  // Draw a matrix as cells. mode: 'img' (0..1 grayscale), 'div' (diverging), 'pos' (0..max), 'w' (kernel weights)
  function cells(ctx, x0, y0, cs, M, mode, opts) {
    opts = opts || {}; var c = K.col(), mx = opts.max || maxAbs(M);
    for (var i = 0; i < M.length; i++) for (var j = 0; j < M[i].length; j++) {
      var v = M[i][j], x = x0 + j * cs, y = y0 + i * cs, fill;
      if (opts.pad && (i < opts.pad || j < opts.pad || i >= M.length - opts.pad || j >= M.length - opts.pad)) fill = K.rgba(c.muted, 0.12);
      else if (mode === 'img') fill = v ? c.text : c.surface2;
      else if (mode === 'pos') fill = K.rgba(c.accent2, 0.08 + 0.85 * Math.max(0, v) / mx);
      else fill = v >= 0 ? K.rgba(c.accent2, 0.06 + 0.8 * v / mx) : K.rgba(c.bad, 0.06 + 0.8 * -v / mx);
      ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      if (opts.nums && cs >= 16) K.text(ctx, num(v), x + cs / 2, y + cs / 2 + 4, mode === 'img' && v ? c.surface : c.text, '600 ' + Math.min(12, cs * 0.42) + 'px JetBrains Mono, monospace', 'center');
    }
    if (opts.label) K.text(ctx, opts.label, x0, y0 - 8, c.text2, '600 11px Inter, sans-serif');
  }
  function outline(ctx, x, y, w, h, color, lw) { ctx.strokeStyle = color; ctx.lineWidth = lw || 2.5; ctx.strokeRect(x, y, w, h); }
  function hit(p, x0, y0, cs, n, m) { var j = Math.floor((p.x - x0) / cs), i = Math.floor((p.y - y0) / cs); return i >= 0 && j >= 0 && i < n && j < (m || n) ? [i, j] : null; }
  function paintable(el, api, getGrid, onChange) {
    var val = 1;
    K.drag(api, el, function (p, start) {
      var g = getGrid(); var h = hit(p, g.x0, g.y0, g.cs, g.n); if (!h) return;
      if (start) val = g.M[h[0]][h[1]] ? 0 : 1;
      if (g.M[h[0]][h[1]] !== val) { g.M[h[0]][h[1]] = val; onChange(); }
    });
  }

  /* ═════ Lab 0 — pixels ═════ */
  (function () {
    var lab = document.getElementById('lab-pixels'); if (!lab) return;
    var M = zeros(10), nums = false, s, geo;
    function count() { return M.reduce(function (a, r) { return a + r.reduce(function (x, y) { return x + y; }, 0); }, 0); }
    function update() { var n = count(); out(lab, 'n', n); if (n >= 8) K.done('cnn-px-draw'); s && s.redraw(); }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), cs = Math.floor(Math.min((w - 60) / 20, (h - 50) / 10)), x0 = (w - cs * 20 - 30) / 2, y0 = (h - cs * 10) / 2 + 8;
      geo = { x0: x0, y0: y0, cs: cs, n: 10, M: M };
      cells(ctx, x0, y0, cs, M, 'img', { label: 'What you see' });
      if (nums) cells(ctx, x0 + cs * 10 + 30, y0, cs, M, 'img', { nums: true, label: 'What the computer sees' });
      else { ctx.fillStyle = c.surface2; ctx.fillRect(x0 + cs * 10 + 30, y0, cs * 10, cs * 10); K.text(ctx, 'numbers hidden', x0 + cs * 15 + 30, y0 + cs * 5, c.muted, '600 12px Inter, sans-serif', 'center'); }
    });
    paintable($(lab, 'canvas'), s, function () { return geo; }, update);
    $(lab, '[data-in="nums"]').addEventListener('change', function (e) { nums = e.target.checked; if (nums) K.done('cnn-px-nums'); s.redraw(); });
    $(lab, '[data-reset]').addEventListener('click', function () { M.forEach(function (r) { r.fill(0); }); update(); });
    update();
  })();

  /* ─── Shared images and kernels ─── */
  function makeImg(kind) {
    var I = zeros(8);
    for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) {
      if (kind === 'box' && i >= 2 && i <= 5 && j >= 2 && j <= 5) I[i][j] = 1;
      if (kind === 't' && ((i === 1 && j >= 1 && j <= 6) || (j >= 3 && j <= 4 && i >= 1 && i <= 6))) I[i][j] = 1;
      if (kind === 'diag' && (i === j || i === j + 1)) I[i][j] = 1;
    }
    return I;
  }
  var KERNELS = {
    vedge: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
    hedge: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
    blur: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
    sharp: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
  };
  function copy(M) { return M.map(function (r) { return r.slice(); }); }

  /* ═════ Lab 1 — convolution ═════ */
  (function () {
    var lab = document.getElementById('lab-conv'); if (!lab) return;
    var kname = 'vedge', iname = 'box', I = makeImg('box'), Kr = copy(KERNELS.vedge), pos = -1, player, s, geo;
    function explain() {
      if (pos < 0) return note(lab, 'Press "Next position" to compute the first output value.');
      var i = Math.floor(pos / 6), j = pos % 6, terms = [], sum = 0;
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) { var x = I[i + a][j + b], wv = Kr[a][b]; sum += x * wv; if (x && wv) terms.push(num(x) + '×' + num(wv)); }
      var txt = 'Position (' + i + ', ' + j + '): ' + (terms.length ? terms.join(' + ') : 'every product is 0') + ' = <b>' + num(sum) + '</b>' + (terms.length < 9 ? ' <span style="color:var(--text-muted)">(zero products omitted)</span>' : '');
      if (pos === 35) {
        K.done('cnn-c-full');
        if (JSON.stringify(Kr) === JSON.stringify(KERNELS.vedge) && JSON.stringify(I) === JSON.stringify(makeImg('box'))) { K.done('cnn-c-edge'); txt = '<b>Only the box\'s vertical edges light up:</b> the left edge (dark→bright) gives +3 (teal), the right edge (bright→dark) gives −3 (red), and flat areas give 0. Top and bottom edges are invisible to this kernel.'; }
        else txt = '<b>Done:</b> every position computed with the same 9 weights. ' + txt;
      }
      note(lab, txt, pos === 35 ? 'good' : '');
    }
    function update() { explain(); s && s.redraw(); }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), narrow = w < 560, cs, x0, y0, kx, ky, ox, oy;
      if (narrow) {
        cs = Math.floor(Math.min((w - 58) / 14, (h - 104) / 11)); x0 = (w - cs * 14 - 30) / 2; y0 = 74;
        ox = x0 + cs * 8 + 30; oy = y0 + cs; kx = ox + cs * 1.5; ky = y0 + cs * 8 + 20;
      } else {
        cs = Math.floor(Math.min((w - 80) / 17, (h - 50) / 8)); x0 = (w - cs * 17 - 60) / 2; y0 = (h - cs * 8) / 2 + 10;
        kx = x0 + cs * 8 + 30; ky = y0 + cs * 2.5; ox = kx + cs * 3 + 30; oy = y0 + cs;
      }
      geo = { ix: x0, iy: y0, kx: kx, ky: ky, cs: cs };
      var Z = conv(I, Kr), mx = maxAbs(Z), shown = Z.map(function (r, i) { return r.map(function (v, j) { return i * 6 + j <= pos ? v : 0; }); });
      cells(ctx, x0, y0, cs, I, 'img', { nums: true, label: 'Input X' });
      cells(ctx, kx, ky, cs, Kr, 'div', { nums: true, label: 'Kernel K' });
      cells(ctx, ox, oy, cs, shown, 'div', { nums: true, max: mx, label: 'Feature map Z' });
      for (var q = pos + 1; q < 36; q++) { ctx.fillStyle = c.surface; ctx.fillRect(ox + (q % 6) * cs + 1, oy + Math.floor(q / 6) * cs + 1, cs - 2, cs - 2); }
      if (pos >= 0) { var i = Math.floor(pos / 6), j = pos % 6; outline(ctx, x0 + j * cs, y0 + i * cs, cs * 3, cs * 3, c.hl, 3); outline(ctx, ox + j * cs, oy + i * cs, cs, cs, c.hl, 3); }
      if (!narrow) { K.text(ctx, '⊛', x0 + cs * 8 + 15, y0 + cs * 4 + 6, c.muted, '18px sans-serif', 'center'); K.text(ctx, '=', kx + cs * 3 + 15, y0 + cs * 4 + 6, c.muted, '18px sans-serif', 'center'); }
      else K.text(ctx, '→', x0 + cs * 8 + 15, y0 + cs * 4 + 6, c.muted, '18px sans-serif', 'center');
    });
    $(lab, 'canvas').addEventListener('pointerdown', function (e) {
      var p = s.point(e), g = geo, hI = hit(p, g.ix, g.iy, g.cs, 8), hK = hit(p, g.kx, g.ky, g.cs, 3);
      if (hI) { I[hI[0]][hI[1]] = I[hI[0]][hI[1]] ? 0 : 1; update(); }
      else if (hK) {
        var cyc = [-1, 0, 1, 2], v = Kr[hK[0]][hK[1]], idx = cyc.indexOf(Math.round(v));
        Kr[hK[0]][hK[1]] = cyc[(idx + 1) % cyc.length]; K.done('cnn-c-edit'); pos = 35; update();
        note(lab, 'You changed a kernel weight to <b>' + Kr[hK[0]][hK[1]] + '</b>. The whole map was recomputed with the new weights — the same weights at every position.', 'good');
      }
    });
    player = K.player($(lab, '[data-act="play"]'), 110, function () { if (pos >= 35) return false; pos++; K.done('cnn-c-step'); update(); if (pos >= 35) return false; });
    K.on(lab, 'step', function () { player.stop(); if (pos >= 35) pos = -1; pos++; K.done('cnn-c-step'); update(); });
    K.on(lab, 'play', function () { player.toggle(function () { if (pos >= 35) pos = -1; }); });
    K.seg(lab, 'kernel', function (v) { kname = v; Kr = copy(KERNELS[v]); pos = -1; player.stop(); update(); });
    K.seg(lab, 'img', function (v) { iname = v; I = makeImg(v); pos = -1; player.stop(); update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { I = makeImg(iname); Kr = copy(KERNELS[kname]); pos = -1; player.stop(); update(); });
    update();
  })();

  /* ═════ Lab 2 — ReLU ═════ */
  (function () {
    var lab = document.getElementById('lab-relu'); if (!lab) return;
    var Z = conv(makeImg('box'), KERNELS.vedge), relu = false, s;
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var cs = Math.floor(Math.min((w - 60) / 12, (h - 40) / 6)), x0 = (w - cs * 12 - 40) / 2, y0 = (h - cs * 6) / 2 + 8, R = Z.map(function (r) { return r.map(function (v) { return Math.max(0, v); }); });
      cells(ctx, x0, y0, cs, Z, 'div', { nums: true, label: 'Feature map Z' });
      cells(ctx, x0 + cs * 6 + 40, y0, cs, relu ? R : Z.map(function (r) { return r.map(function () { return 0; }); }), 'div', { nums: relu, max: 3, label: relu ? 'ReLU(Z) = max(0, Z)' : 'ReLU(Z) — switch it on' });
      K.text(ctx, '→', x0 + cs * 6 + 20, y0 + cs * 3 + 6, K.col().muted, '18px sans-serif', 'center');
    });
    $(lab, '[data-in="relu"]').addEventListener('change', function (e) {
      relu = e.target.checked; s.redraw();
      if (relu) { K.done('cnn-r-apply'); note(lab, 'The right edge\'s −3 values became <b>0</b>. ReLU kept only positive evidence: "a dark-to-bright edge is here". (A second kernel with flipped weights would catch the other direction.)', 'good'); }
      else note(lab, 'This is the vertical-edge feature map of the box. Red cells are negative.');
    });
  })();

  /* ═════ Lab 3 — pooling ═════ */
  (function () {
    var lab = document.getElementById('lab-pool'); if (!lab) return;
    var M = [[1, 0, 3, 1, 0, 2], [4, 2, 0, 1, 1, 0], [0, 1, 6, 2, 0, 1], [1, 0, 2, 5, 3, 0], [2, 1, 0, 0, 1, 4], [0, 3, 1, 2, 0, 1]];
    var type = 'max', sel = [0, 0], s, geo;
    function pool() { var o = zeros(3); for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) { var w = [M[2 * i][2 * j], M[2 * i][2 * j + 1], M[2 * i + 1][2 * j], M[2 * i + 1][2 * j + 1]]; o[i][j] = type === 'max' ? Math.max.apply(null, w) : (w[0] + w[1] + w[2] + w[3]) / 4; } return o; }
    function explain() {
      var i = sel[0], j = sel[1], w = [M[2 * i][2 * j], M[2 * i][2 * j + 1], M[2 * i + 1][2 * j], M[2 * i + 1][2 * j + 1]];
      note(lab, (type === 'max' ? 'max(' : 'average(') + w.join(', ') + ') = <b>' + num(pool()[i][j]) + '</b>. ' + (type === 'max' ? 'Only the strongest signal survives.' : 'Average pooling blurs strong responses with weak neighbours — edges get fainter.'));
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), cs = Math.floor(Math.min((w - 80) / 9, (h - 40) / 6)), x0 = (w - cs * 9 - 50) / 2, y0 = (h - cs * 6) / 2 + 8, ox = x0 + cs * 6 + 50, oy = y0 + cs * 1.5;
      geo = { x0: x0, y0: y0, cs: cs };
      cells(ctx, x0, y0, cs, M, 'pos', { nums: true, max: 6, label: 'Feature map (6 × 6)' });
      cells(ctx, ox, oy, cs, pool(), 'pos', { nums: true, max: 6, label: (type === 'max' ? 'Max' : 'Average') + ' pooled (3 × 3)' });
      ctx.strokeStyle = K.rgba(c.text, 0.5); ctx.lineWidth = 1;
      for (var k = 0; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x0 + k * 2 * cs, y0); ctx.lineTo(x0 + k * 2 * cs, y0 + 6 * cs); ctx.moveTo(x0, y0 + k * 2 * cs); ctx.lineTo(x0 + 6 * cs, y0 + k * 2 * cs); ctx.stroke(); }
      outline(ctx, x0 + sel[1] * 2 * cs, y0 + sel[0] * 2 * cs, cs * 2, cs * 2, c.hl, 3); outline(ctx, ox + sel[1] * cs, oy + sel[0] * cs, cs, cs, c.hl, 3);
      K.text(ctx, '→', x0 + cs * 6 + 25, y0 + cs * 3 + 6, c.muted, '18px sans-serif', 'center');
    });
    $(lab, 'canvas').addEventListener('pointerdown', function (e) { var hh = hit(s.point(e), geo.x0, geo.y0, geo.cs * 2, 3); if (hh) { sel = hh; K.done('cnn-p-click'); explain(); s.redraw(); } });
    K.seg(lab, 'type', function (v) { type = v; if (v === 'avg') K.done('cnn-p-avg'); explain(); s.redraw(); });
  })();

  /* ═════ Lab 4 — output size ═════ */
  (function () {
    var lab = document.getElementById('lab-size'); if (!lab) return;
    var v = { n: 7, k: 3, p: 0, s: 1 }, sc;
    function calc() { var span = v.n + 2 * v.p - v.k; return { span: span, out: span < 0 ? 0 : Math.floor(span / v.s) + 1, even: span >= 0 && span % v.s === 0 }; }
    function update() {
      ['n', 'k', 'p', 's'].forEach(function (k) { out(lab, k + 'v', v[k]); });
      var r = calc();
      if (r.span < 0) note(lab, 'The kernel is bigger than the padded input — no valid positions.', 'bad');
      else {
        var txt = '(' + v.n + ' + 2·' + v.p + ' − ' + v.k + ') ÷ ' + v.s + ' + 1 = <b>' + (r.even ? '' : '⌊') + (r.span / v.s).toFixed(r.even ? 0 : 2) + (r.even ? '' : '⌋') + ' + 1 = ' + r.out + '</b> → output ' + r.out + ' × ' + r.out + '.';
        if (!r.even) { K.done('cnn-s-bad'); txt += ' <b>Doesn\'t fit evenly</b>: the last ' + (r.span % v.s) + ' row(s) are never covered by the kernel (shown striped).'; }
        if (v.k === 3 && v.s === 1 && r.out === v.n) { K.done('cnn-s-same'); txt += ' <b>Same size as the input</b> — padding (K − 1) / 2 = 1 does it.'; }
        note(lab, txt, !r.even ? 'warn' : r.out === v.n ? 'good' : '');
      }
      sc && sc.redraw();
    }
    sc = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), r = calc(), N = v.n + 2 * v.p, cs = Math.floor(Math.min((w - 70) / (N + Math.max(r.out, 1)), (h - 50) / N)), x0 = 20, y0 = (h - cs * N) / 2 + 10;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        var pad = i < v.p || j < v.p || i >= N - v.p || j >= N - v.p;
        var covered = r.span >= 0 && i <= Math.floor(r.span / v.s) * v.s + v.k - 1 && j <= Math.floor(r.span / v.s) * v.s + v.k - 1;
        ctx.fillStyle = pad ? K.rgba(c.muted, 0.15) : K.rgba(c.accent, 0.22); ctx.fillRect(x0 + j * cs + 1, y0 + i * cs + 1, cs - 2, cs - 2);
        if (!covered) { ctx.strokeStyle = K.rgba(c.bad, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + j * cs + 2, y0 + i * cs + cs - 2); ctx.lineTo(x0 + j * cs + cs - 2, y0 + i * cs + 2); ctx.stroke(); }
      }
      if (r.span >= 0) { outline(ctx, x0, y0, cs * v.k, cs * v.k, c.hl, 3); if (r.out > 1) outline(ctx, x0 + v.s * cs, y0, cs * v.k, cs * v.k, K.rgba(c.hl, 0.5), 2); }
      K.text(ctx, 'input ' + v.n + '×' + v.n + (v.p ? ' + padding' : ''), x0, y0 - 8, c.text2, '600 11px Inter, sans-serif');
      var ox = x0 + N * cs + 40, oy = y0 + (N - r.out) * cs / 2;
      for (i = 0; i < r.out; i++) for (j = 0; j < r.out; j++) { ctx.fillStyle = K.rgba(c.accent2, 0.5); ctx.fillRect(ox + j * cs + 1, oy + i * cs + 1, cs - 2, cs - 2); }
      K.text(ctx, 'output ' + r.out + '×' + r.out, ox, oy - 8, c.text2, '600 11px Inter, sans-serif');
    });
    ['n', 'k', 'p', 's'].forEach(function (k) { K.slider(lab, k, function (val) { v[k] = val; update(); }); });
    update();
  })();

  /* ═════ Lab 5 — the tiny CNN ═════ */
  (function () {
    var lab = document.getElementById('lab-classify'); if (!lab) return;
    var VK = [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]], HK = [[-1, -1, -1], [2, 2, 2], [-1, -1, -1]];
    var CLASSES = ['vertical |', 'horizontal —', 'plus +'];
    var I = zeros(10), s, geo;
    function run() {
      var mapV = conv(I, VK).map(function (r) { return r.map(function (v) { return Math.max(0, v); }); });
      var mapH = conv(I, HK).map(function (r) { return r.map(function (v) { return Math.max(0, v); }); });
      var mV = Math.max.apply(null, [].concat.apply([], mapV)), mH = Math.max.apply(null, [].concat.apply([], mapH));
      var scores = [mV - mH, mH - mV, 0.5 * (mV + mH) - 1];
      var e = scores.map(function (v) { return Math.exp(v * 0.8); }), z = e.reduce(function (a, b) { return a + b; });
      return { mapV: mapV, mapH: mapH, mV: mV, mH: mH, scores: scores, probs: e.map(function (v) { return v / z; }) };
    }
    function painted() { return I.reduce(function (a, r) { return a + r.reduce(function (x, y) { return x + y; }, 0); }, 0); }
    function update() {
      var r = run(), best = r.probs.indexOf(Math.max.apply(null, r.probs)), n = painted();
      if (n >= 3 && r.probs[best] >= 0.7) {
        K.done(['cnn-h-v', 'cnn-h-h', 'cnn-h-p'][best]);
        note(lab, 'Max responses: vertical detector <b>' + r.mV + '</b>, horizontal detector <b>' + r.mH + '</b> → the dense layer scores them → <b>' + Math.round(r.probs[best] * 100) + '% ' + CLASSES[best] + '</b>.', 'good');
      } else if (n >= 4) {
        K.done('cnn-h-d');
        note(lab, 'Max responses: vertical <b>' + r.mV + '</b>, horizontal <b>' + r.mH + '</b>. Neither kernel matches this shape well, so the CNN is unsure (' + Math.round(r.probs[best] * 100) + '% at best). It only knows two patterns — a trained CNN would have learned many more.', 'warn');
      } else note(lab, 'Draw a vertical line, a horizontal line, or a plus sign.');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), r = run(), narrow = w < 560;
      var cs = narrow ? Math.floor(Math.min((w * 0.52) / 10, (h - 110) / 10)) : Math.floor(Math.min((w - 40) / 26, (h - 50) / 10));
      var x0 = 14, y0 = narrow ? 56 : (h - cs * 10) / 2 + 8;
      geo = { x0: x0, y0: y0, cs: cs, n: 10, M: I };
      cells(ctx, x0, y0, cs, I, 'img', { label: 'Input 10 × 10' });
      var ms = narrow ? Math.floor((cs * 10 - 50) / 16) : Math.floor(cs * 0.55), mx = x0 + cs * 10 + (narrow ? 18 : 26);
      var hy = y0 + ms * 8 + (narrow ? 50 : 26);
      cells(ctx, mx, y0, ms, r.mapV, 'pos', { max: 6, label: narrow ? 'Vertical' : 'Vertical detector' });
      cells(ctx, mx, hy, ms, r.mapH, 'pos', { max: 6, label: narrow ? 'Horizontal' : 'Horizontal detector' });
      var mf = '700 12px JetBrains Mono, monospace';
      if (narrow) { K.text(ctx, 'max = ' + r.mV, mx, y0 + ms * 8 + 16, c.text, mf); K.text(ctx, 'max = ' + r.mH, mx, hy + ms * 8 + 16, c.text, mf); }
      else { K.text(ctx, 'max = ' + r.mV, mx + ms * 8 + 8, y0 + ms * 4, c.text, mf); K.text(ctx, 'max = ' + r.mH, mx + ms * 8 + 8, hy + ms * 4, c.text, mf); }
      if (narrow) {
        var by = h - 44, gw = (w - 28 - 20) / 3;
        r.probs.forEach(function (p, k) {
          var bx = 14 + k * (gw + 10);
          K.text(ctx, CLASSES[k].split(' ')[1] + ' ' + Math.round(p * 100) + '%', bx, by, c.text, '700 12px JetBrains Mono, monospace');
          ctx.fillStyle = c.surface2; ctx.fillRect(bx, by + 8, gw, 14);
          ctx.fillStyle = p >= 0.7 ? c.good : c.accent; ctx.fillRect(bx, by + 8, gw * p, 14);
        });
        return;
      }
      var bx = mx + ms * 8 + 90, bw = w - bx - 14;
      K.text(ctx, 'softmax probabilities', bx, y0 - 8, c.text2, '600 11px Inter, sans-serif');
      r.probs.forEach(function (p, k) {
        var by = y0 + 10 + k * (cs * 3);
        K.text(ctx, CLASSES[k], bx, by, c.text2, '600 12px Inter, sans-serif');
        ctx.fillStyle = c.surface2; ctx.fillRect(bx, by + 8, bw, 14);
        ctx.fillStyle = p >= 0.7 ? c.good : c.accent; ctx.fillRect(bx, by + 8, bw * p, 14);
        K.text(ctx, Math.round(p * 100) + '%', bx + bw, by, c.text, '700 12px JetBrains Mono, monospace', 'right');
      });
    });
    paintable($(lab, 'canvas'), s, function () { return geo; }, update);
    function example(kind) {
      I.forEach(function (row) { row.fill(0); });
      for (var i = 1; i < 9; i++) {
        if (kind === 'v' || kind === 'p') I[i][5] = 1;
        if (kind === 'h' || kind === 'p') I[4][i] = 1;
        if (kind === 'd') I[i][i] = 1;
      }
      update();
    }
    ['v', 'h', 'p', 'd'].forEach(function (k) { K.on(lab, k, function () { example(k); }); });
    $(lab, '[data-reset]').addEventListener('click', function () { I.forEach(function (row) { row.fill(0); }); update(); });
    update();
  })();
})();
