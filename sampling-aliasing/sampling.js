/* Sampling & Aliasing lesson — interactive labs. Uses window.Kit (lesson/labkit.js). */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, out = K.out, note = K.note, TAU = Math.PI * 2;

  function hz(v) { return (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v.toFixed(1)) + ' Hz'; }
  // Signed alias: the frequency in (−fs/2, fs/2] with identical samples
  function aliasSigned(f, fs) { return f - fs * Math.round(f / fs); }
  function alias(f, fs) { return Math.abs(aliasSigned(f, fs)); }
  function curve(ctx, F, fn, t0, t1, color, width, dash) {
    var n = Math.max(200, Math.round((F.X(t1) - F.X(t0)) * 1.5));
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.setLineDash(dash || []); ctx.beginPath();
    for (var i = 0; i <= n; i++) { var t = t0 + (t1 - t0) * i / n, x = F.X(t), y = F.Y(fn(t)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function stems(ctx, F, fs, fn, color) {
    for (var n = 0; n / fs <= 1 + 1e-9; n++) {
      var t = n / fs, v = fn(t), x = F.X(t);
      ctx.strokeStyle = K.rgba(color, 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, F.Y(0)); ctx.lineTo(x, F.Y(v)); ctx.stroke();
      K.dot(ctx, x, F.Y(v), 4.5, color);
    }
  }
  function waveFrame(ctx, w, h, opt) {
    opt = opt || {};
    return K.frame(ctx, w, h, [0, 1], [-1.35, 1.35], { xticks: [0, 0.25, 0.5, 0.75, 1], yticks: [-1, 0, 1], xfmt: function (t) { return t + ' s'; }, pb: opt.pb, pt: opt.pt, pl: 34, pr: 14 });
  }
  function legend(ctx, items, x, y) {
    var c = K.col();
    items.forEach(function (it) {
      ctx.strokeStyle = it[1]; ctx.lineWidth = 2.5; ctx.setLineDash(it[2] ? [6, 4] : []); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 18, y - 4); ctx.stroke(); ctx.setLineDash([]);
      K.text(ctx, it[0], x + 24, y, c.text2, '600 11px Inter, sans-serif'); x += 34 + ctx.measureText(it[0]).width;
    });
  }

  /* ═════ Lab 0 — snapshots ═════ */
  (function () {
    var lab = document.getElementById('lab-snap'); if (!lab) return;
    var fs = 8, show = true, s, f = 2, x = function (t) { return Math.sin(TAU * f * t); };
    function update() {
      out(lab, 'fsv', fs + ' Hz'); out(lab, 'per', +(fs / f).toFixed(1)); out(lab, 'n', Math.floor(fs) + 1);
      if (fs <= 3) { K.done('sa-s-few'); note(lab, '<b>' + (fs / f).toFixed(1) + ' samples per cycle.</b> From these dots alone you couldn\'t guess the wave — or you\'d guess the wrong one.', 'bad'); }
      else if (fs >= 20) { K.done('sa-s-many'); note(lab, '<b>' + fs / f + ' samples per cycle.</b> The dots trace the wave clearly — but that\'s ' + fs + ' numbers every second. Can we get away with fewer?', 'good'); }
      else note(lab, (fs / f).toFixed(1) + ' samples per cycle. The dots are all the computer keeps' + (show ? '. Hide the true wave and ask: could you redraw it from the dots alone?' : ' — does this still look like a 2 Hz wave?'));
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), F = waveFrame(ctx, w, h, { pt: 30 });
      if (show) curve(ctx, F, x, 0, 1, K.rgba(c.accent, 0.8), 2.5);
      var pts = []; for (var n = 0; n / fs <= 1 + 1e-9; n++) pts.push(n / fs);
      ctx.strokeStyle = K.rgba(c.hl, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath();
      pts.forEach(function (t, i) { if (i) ctx.lineTo(F.X(t), F.Y(x(t))); else ctx.moveTo(F.X(t), F.Y(x(t))); }); ctx.stroke(); ctx.setLineDash([]);
      stems(ctx, F, fs, x, c.hl);
      legend(ctx, (show ? [['true wave', c.accent]] : []).concat([['samples', c.hl], ['connect-the-dots', K.rgba(c.hl, 0.6), true]]), F.pl + 4, 18);
    });
    K.slider(lab, 'fs', function (v) { fs = v; update(); });
    $(lab, '[data-in="wave"]').addEventListener('change', function (e) { show = e.target.checked; if (!show) K.done('sa-s-hide'); update(); });
  })();

  /* ═════ Lab 1 — aliasing ═════ */
  (function () {
    var lab = document.getElementById('lab-alias'); if (!lab) return;
    var f = 3, fs = 20, PH = 0.5, s;
    function update() {
      var fa = aliasSigned(f, fs), app = Math.abs(fa), nyq = fs / 2;
      out(lab, 'fv', hz(f)); out(lab, 'fsv', fs + ' Hz'); out(lab, 'nyq', hz(nyq)); out(lab, 'app', hz(app));
      if (f > nyq + 1e-9) K.done('sa-a-alias');
      if (f === 17 && Math.abs(app - 3) < 1e-9) K.done('sa-a-seventeen');
      if (app < 1e-9) K.done('sa-a-dc');
      if (f === 9 && fs === 19) K.done('sa-a-safe');
      var per = (fs / f).toFixed(1);
      if (app < 1e-9) note(lab, '<b>Frozen.</b> f<sub>s</sub> is an exact multiple of f, so every snapshot catches the wave at the same point of its cycle. A ' + hz(f) + ' wave looks like a constant — like a strobe light freezing a fan.', 'bad');
      else if (Math.abs(f - nyq) < 1e-9) note(lab, '<b>Exactly at the limit</b> (2 samples per cycle). The samples just alternate up and down, and their height depends on luck — the wave\'s true size is lost. You need <em>more</em> than 2 per cycle.', 'warn');
      else if (f > nyq) note(lab, '<b>Aliased!</b> ' + hz(f) + ' is above the ' + hz(nyq) + ' limit (only ' + per + ' samples per cycle). The samples fit a <b>' + hz(app) + '</b> wave (dashed) perfectly, and the computer has no way to know it was fooled.', 'bad');
      else note(lab, '<b>Safe:</b> ' + hz(f) + ' is below the ' + hz(nyq) + ' limit (' + per + ' samples per cycle). The samples describe only the true wave.' + (f === 9 && fs === 19 ? ' And 19 Hz is the smallest whole rate that works: 18 would sit exactly on the limit.' : ''), 'good');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), F = waveFrame(ctx, w, h, { pt: 30 }), fa = aliasSigned(f, fs), aliased = Math.abs(fa - f) > 1e-9;
      var x = function (t) { return Math.sin(TAU * f * t + PH); };
      curve(ctx, F, x, 0, 1, K.rgba(c.accent, aliased ? 0.45 : 0.85), aliased ? 1.5 : 2.5);
      if (aliased) curve(ctx, F, function (t) { return Math.sin(TAU * fa * t + PH); }, 0, 1, c.accent2, 2.5, [7, 5]);
      stems(ctx, F, fs, x, c.warn);
      legend(ctx, [['true ' + hz(f), c.accent], ['samples', c.warn]].concat(aliased ? [['alias ' + hz(Math.abs(fa)), c.accent2, true]] : []), F.pl + 4, 18);
    });
    K.slider(lab, 'f', function (v) { f = v; update(); });
    K.slider(lab, 'fs', function (v) { fs = v; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { K.setSlider(lab, 'f', 3); K.setSlider(lab, 'fs', 20); });
  })();

  /* ═════ Lab 2 — wagon wheel ═════ */
  (function () {
    var lab = document.getElementById('lab-wheel'); if (!lab) return;
    var r = 1, fps = 24, s, illusion = false, visible = false;
    function perFrame() { return r / fps * 360; }
    function seen() { var a = perFrame() % 360; if (a > 180) a -= 360; return a; }
    function deg(v) { return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1)) + '°'; }
    function update(fromFps) {
      var p = perFrame(), a = seen(), turns = Math.floor(p / 360 + 1e-9);
      out(lab, 'sv', (r % 1 ? r.toFixed(1) : r) + ' rev/s');
      out(lab, 'real', turns ? turns + ' turn' + (turns > 1 ? 's' : '') + ' + ' + deg(p - turns * 360) : deg(p));
      out(lab, 'seen', (a > 0.05 ? '+' : '') + deg(a));
      var wrong = r > 0 && Math.abs(a - p) > 0.01;
      if (r > 0 && a < -0.01) K.done('sa-w-back');
      if (r > 0 && Math.abs(a) < 0.01) K.done('sa-w-freeze');
      if (fromFps && illusion && !wrong) K.done('sa-w-fps');
      illusion = wrong;
      if (r === 0) note(lab, 'The wheel is still. Speed it up.');
      else if (Math.abs(a) < 0.01) note(lab, '<b>Frozen!</b> The wheel turns exactly ' + (p / 360) + ' full turn' + (p > 360 ? 's' : '') + ' between frames, so every frame looks identical.', 'bad');
      else if (a < 0) note(lab, '<b>Backwards!</b> Each frame the wheel turns ' + deg(p) + ' forwards — which looks exactly like ' + deg(-a) + ' <em>backwards</em>. The camera shows the shortest explanation.', 'bad');
      else if (wrong) note(lab, 'The wheel really turns ' + deg(p) + ' per frame but appears to creep forward ' + deg(a) + '. Aliased, just not reversed.', 'warn');
      else note(lab, 'Under half a turn per frame (' + deg(p) + '): the camera shows the true motion. The limit is 180° per frame — that\'s the Nyquist limit for rotation, ' + (fps / 2) + ' rev/s here.', 'good');
    }
    function drawWheel(ctx, cx, cy, R, ang, blur) {
      var c = K.col();
      ctx.strokeStyle = K.rgba(c.text2, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      for (var i = 0; i < 24; i++) { var t = i / 24 * TAU; ctx.strokeStyle = K.rgba(c.text2, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * R * 0.9, cy + Math.sin(t) * R * 0.9); ctx.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R); ctx.stroke(); }
      if (blur) { ctx.fillStyle = K.rgba(c.hl, 0.18); ctx.beginPath(); ctx.arc(cx, cy, R * 0.92, 0, TAU); ctx.fill(); }
      else {
        var a = ang * Math.PI / 180 - Math.PI / 2;
        ctx.strokeStyle = c.hl; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88); ctx.stroke(); ctx.lineCap = 'butt';
        K.dot(ctx, cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88, 6, c.hl);
      }
      K.dot(ctx, cx, cy, 5, c.text2);
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), now = performance.now() / 1000, R = Math.min(w / 4 - 24, h / 2 - 50), y = h / 2 + 12;
      var fast = r > 3;
      drawWheel(ctx, w / 4, y, R, (now * r * 360) % 360, fast);
      var frame = Math.floor(now * fps), camAng = ((frame * r / fps) % 1) * 360;
      drawWheel(ctx, 3 * w / 4, y, R, camAng, false);
      K.text(ctx, 'Your eye', w / 4, 24, c.text, '700 13px Inter, sans-serif', 'center');
      K.text(ctx, fast ? r + ' rev/s — just a blur' : 'real motion', w / 4, 42, c.muted, '600 11px Inter, sans-serif', 'center');
      K.text(ctx, 'The camera (' + fps + ' fps)', 3 * w / 4, 24, c.text, '700 13px Inter, sans-serif', 'center');
      K.text(ctx, 'frame ' + (frame % 1000), 3 * w / 4, 42, c.muted, '600 11px JetBrains Mono, monospace', 'center');
    });
    function loop() { if (visible) s.redraw(); requestAnimationFrame(loop); }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(lab);
    requestAnimationFrame(loop);
    K.slider(lab, 'speed', function (v) { r = v; update(false); });
    K.seg(lab, 'fps', function (v) { fps = +v; update(true); });
  })();

  /* ═════ Lab 3 — folding diagram ═════ */
  (function () {
    var lab = document.getElementById('lab-fold'); if (!lab) return;
    var FS = 10, f = 3, found = {}, s, F;
    function update() {
      var app = alias(f, FS);
      out(lab, 'fv', hz(f)); out(lab, 'app', hz(app));
      if (Math.abs(app - 2) < 1e-9) found[f] = 1;
      var keys = Object.keys(found).map(Number).sort(function (a, b) { return a - b; });
      out(lab, 'found', keys.length ? keys.join(', ') + ' Hz' : 'none');
      if (keys.length >= 3) K.done('sa-f-three');
      if (f > 5 && f < 10) K.done('sa-f-mirror');
      var k = Math.round(f / FS);
      if (f <= 5) note(lab, hz(f) + ' is below the 5 Hz limit, so it appears as itself.', 'good');
      else note(lab, hz(f) + ' → |' + f + ' − ' + k + '×10| = <b>' + hz(app) + '</b>. ' + (f < 10 ? 'In the first fold the strip is mirrored: f → 10 − f.' : 'Each 10 Hz, the pattern repeats.') + (keys.length >= 3 ? ' You found ' + keys.join(', ') + ' Hz — all identical once sampled.' : ''), 'warn');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col();
      F = K.frame(ctx, w, h, [0, 30], [0, 6.2], { xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 1, 2, 3, 4, 5], xfmt: function (t) { return t + ''; }, xlabel: 'true frequency (Hz)', ylabel: 'appears as (Hz)', pl: 34, pt: 16 });
      for (var p = 0; p < 6; p++) { ctx.fillStyle = K.rgba(p % 2 ? c.warn : c.accent2, p ? 0.06 : 0.12); ctx.fillRect(F.X(p * 5), F.Y(5), F.X(5) - F.X(0), F.Y(0) - F.Y(5)); }
      K.text(ctx, 'safe', F.X(2.5), F.Y(5) - 6, c.good, '700 11px Inter, sans-serif', 'center');
      for (p = 1; p < 6; p++) K.text(ctx, p % 2 ? 'mirrored' : 'repeat', F.X(p * 5 + 2.5), F.Y(5) - 6, c.muted, '600 10px Inter, sans-serif', 'center');
      curve(ctx, F, function (t) { return alias(t, FS); }, 0, 30, c.accent, 2.5);
      Object.keys(found).forEach(function (k) { K.dot(ctx, F.X(+k), F.Y(2), 5, c.good); });
      var app = alias(f, FS);
      ctx.strokeStyle = K.rgba(c.hl, 0.7); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath();
      ctx.moveTo(F.X(f), F.Y(0)); ctx.lineTo(F.X(f), F.Y(app)); ctx.lineTo(F.X(0), F.Y(app)); ctx.stroke(); ctx.setLineDash([]);
      K.dot(ctx, F.X(f), F.Y(app), 7, c.hl, c.surface);
      K.dot(ctx, F.X(f), F.Y(0), 6, c.hl);
    });
    K.drag(s, $(lab, 'canvas'), function (p) { if (!F) return; var v = Math.round(F.X.inv(p.x) * 2) / 2; K.setSlider(lab, 'f', Math.max(0, Math.min(30, v))); });
    K.slider(lab, 'f', function (v) { f = v; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { found = {}; K.setSlider(lab, 'f', 3); });
  })();

  /* ═════ Lab 4 — reconstruction ═════ */
  (function () {
    var lab = document.getElementById('lab-recon'); if (!lab) return;
    var F0 = 3, PH = 0.5, fs = 8, m = 'lin', pulses = false, s;
    var x = function (t) { return Math.sin(TAU * F0 * t + PH); };
    function sinc(u) { return Math.abs(u) < 1e-9 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u); }
    function rec(t) {
      if (m === 'hold') return x(Math.floor(t * fs + 1e-9) / fs);
      if (m === 'lin') { var n = Math.floor(t * fs), a = t * fs - n; return x(n / fs) * (1 - a) + x((n + 1) / fs) * a; }
      var sum = 0; for (var k = Math.floor(-3 * fs); k <= Math.ceil(4 * fs); k++) sum += x(k / fs) * sinc(fs * t - k); return sum;
    }
    function err() { var e = 0, c = 0; for (var t = 0; t <= 1; t += 0.004) { e += Math.pow(rec(t) - x(t), 2); c++; } return Math.sqrt(e / c); }
    function update() {
      var E = err();
      out(lab, 'fsv', fs + ' Hz'); out(lab, 'per', +(fs / F0).toFixed(1)); out(lab, 'err', E.toFixed(3));
      if (m === 'hold') K.done('sa-r-hold');
      if (m === 'lin' && E < 0.06) K.done('sa-r-lin');
      if (m === 'sinc' && E < 0.02 && fs <= 8) K.done('sa-r-sinc');
      if (m === 'sinc' && fs <= 6) K.done('sa-r-fail');
      if (fs <= 6) note(lab, '<b>At or below the Nyquist rate</b> (f<sub>s</sub> ≤ 2 × 3 Hz). ' + (m === 'sinc' ? 'Even the perfect method rebuilds the wrong wave: ' + (fs === 6 ? 'at exactly 2 samples per cycle the size and timing are lost.' : 'it faithfully draws the ' + hz(alias(F0, fs)) + ' alias, because that\'s what the samples describe.') : 'No method can recover the 3 Hz wave from these samples.'), 'bad');
      else if (m === 'sinc') note(lab, E < 0.02 ? '<b>Essentially perfect</b> — with only ' + (fs / F0).toFixed(1) + ' samples per cycle. The sampling theorem in action.' : 'Sinc reconstruction: each sample contributes one pulse.', 'good');
      else if (m === 'lin') note(lab, E < 0.06 ? 'Straight lines finally got close — but it took ' + (fs / F0).toFixed(1) + ' samples per cycle. Sinc does it with 2.3.' : 'Straight lines cut the corners off every peak. More samples help, slowly.', E < 0.06 ? 'good' : '');
      else note(lab, 'The staircase holds each sample until the next one — simple hardware, but it lags behind the wave and needs smoothing afterwards.');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), F = waveFrame(ctx, w, h, { pt: 30 });
      curve(ctx, F, x, 0, 1, K.rgba(c.accent, 0.5), 2, [6, 4]);
      if (m === 'sinc' && pulses) {
        for (var k = 0; k / fs <= 1 + 1e-9; k++) (function (k) { curve(ctx, F, function (t) { return x(k / fs) * sinc(fs * t - k); }, 0, 1, K.rgba(c.text2, 0.3), 1); })(k);
      }
      if (m === 'hold') {
        ctx.strokeStyle = c.accent2; ctx.lineWidth = 2.5; ctx.beginPath();
        for (var n = 0; n / fs <= 1; n++) { var y = F.Y(x(n / fs)), x0 = F.X(n / fs), x1 = F.X(Math.min(1, (n + 1) / fs)); if (n) ctx.lineTo(x0, y); else ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
      } else curve(ctx, F, rec, 0, 1, c.accent2, 2.5);
      stems(ctx, F, fs, x, c.warn);
      legend(ctx, [['true 3 Hz', K.rgba(c.accent, 0.7), true], ['rebuilt', c.accent2], ['samples', c.warn]], F.pl + 4, 18);
    });
    K.seg(lab, 'm', function (v) { m = v; update(); });
    K.slider(lab, 'fs', function (v) { fs = v; update(); });
    $(lab, '[data-in="pulses"]').addEventListener('change', function (e) { pulses = e.target.checked; if (pulses && m !== 'sinc') { $(lab, '[data-v="sinc"]').click(); } else update(); });
  })();

  /* ═════ Lab 5 — anti-aliasing filter ═════ */
  (function () {
    var lab = document.getElementById('lab-filter'); if (!lab) return;
    var fs = 12, lp = false, s, COMP = [[2, 1, 0], [9, 0.6, 1]];
    function passes(cmp) { return !lp || cmp[0] < fs / 2; }
    function update() {
      var hum = COMP[1], humOk = passes(hum), app = alias(9, fs);
      out(lab, 'fsv', fs + ' Hz'); out(lab, 'nyq', hz(fs / 2)); out(lab, 'hum', humOk ? hz(app) : 'removed');
      if (!lp && fs === 12) K.done('sa-l-see');
      if (!lp && Math.abs(app - 2) < 1e-9) K.done('sa-l-trap');
      if (lp && fs < 18) K.done('sa-l-on');
      if (!lp && fs > 18) K.done('sa-l-fast');
      if (!humOk) note(lab, '<b>Clean.</b> The filter removed the 9 Hz hum before sampling, so only the 2 Hz signal reaches the samples.', 'good');
      else if (fs > 18) note(lab, 'f<sub>s</sub> = ' + fs + ' Hz puts the limit at ' + hz(fs / 2) + ', above the hum. It stays at its true 9 Hz, well away from the signal, and a digital filter can remove it later.', 'good');
      else if (Math.abs(app - 2) < 1e-9) note(lab, '<b>Worst case:</b> the hum aliased to exactly 2 Hz and merged with your signal. The rebuilt wave (solid) no longer matches the real signal (dashed), and no processing can separate them now.', 'bad');
      else note(lab, 'The 9 Hz hum is above the ' + hz(fs / 2) + ' limit, so it aliases to <b>' + hz(app) + '</b> and lands inside your data as a fake component.', 'bad');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), top = Math.round(h * 0.56);
      var input = function (t) { return COMP.reduce(function (a, q) { return a + (passes(q) ? q[1] * Math.sin(TAU * q[0] * t + q[2]) : 0); }, 0); };
      var seen = function (t) { return COMP.reduce(function (a, q) { return a + (passes(q) ? q[1] * Math.sin(TAU * aliasSigned(q[0], fs) * t + q[2]) : 0); }, 0); };
      var F = K.frame(ctx, w, h, [0, 1], [-1.9, 1.9], { xticks: [], yticks: [0], pt: 26, pb: h - top + 22, pl: 34, pr: 14 });
      curve(ctx, F, input, 0, 1, K.rgba(c.text2, 0.35), 1.5);
      curve(ctx, F, function (t) { return Math.sin(TAU * 2 * t); }, 0, 1, K.rgba(c.accent, 0.8), 2, [6, 4]);
      curve(ctx, F, seen, 0, 1, c.accent2, 2.5);
      stems(ctx, F, fs, input, c.warn);
      legend(ctx, [['sensor', K.rgba(c.text2, 0.6)], ['wanted 2 Hz', c.accent, true], ['rebuilt from samples', c.accent2]], F.pl + 4, 16);
      // spectrum
      var G = K.frame(ctx, w, h, [0, 20], [0, 1.25], { xticks: [0, 2, 5, 9, 10, 15, 20], yticks: [], xfmt: function (t) { return t + ''; }, xlabel: 'frequency (Hz)', pt: top + 20, pb: 24, pl: 34, pr: 14 });
      var nyq = fs / 2;
      if (nyq < 20) { ctx.fillStyle = K.rgba(c.bad, 0.08); ctx.fillRect(G.X(nyq), G.Y(1.25), G.X(20) - G.X(nyq), G.Y(0) - G.Y(1.25)); K.text(ctx, 'above fₛ/2: folds back', G.X(Math.min(20, nyq + (20 - nyq) / 2)), G.Y(1.1), c.bad, '600 10px Inter, sans-serif', 'center'); }
      ctx.strokeStyle = c.bad; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(G.X(Math.min(nyq, 20)), G.Y(0)); ctx.lineTo(G.X(Math.min(nyq, 20)), G.Y(1.25)); ctx.stroke();
      var bw = Math.max(6, (G.X(1) - G.X(0)) * 0.5);
      COMP.forEach(function (q) {
        ctx.strokeStyle = K.rgba(c.text2, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.strokeRect(G.X(q[0]) - bw / 2, G.Y(q[1]), bw, G.Y(0) - G.Y(q[1])); ctx.setLineDash([]);
        if (!passes(q)) return;
        var a = alias(q[0], fs), ax = G.X(a);
        ctx.fillStyle = q[0] === 9 ? c.warn : c.accent; ctx.fillRect(ax - bw / 2, G.Y(q[1]), bw, G.Y(0) - G.Y(q[1]));
        if (Math.abs(a - q[0]) > 1e-9) K.arrow(ctx, G.X(q[0]), G.Y(q[1]) - 8, ax + (a < q[0] ? bw : -bw), G.Y(q[1]) - 8, c.warn, 1.5);
      });
      K.text(ctx, 'dashed: real input · filled: what the samples contain', G.pl + 4, top + 12, c.muted, '600 10px Inter, sans-serif');
    });
    K.slider(lab, 'fs', function (v) { fs = v; update(); });
    $(lab, '[data-in="lp"]').addEventListener('change', function (e) { lp = e.target.checked; update(); });
    $(lab, '[data-reset]').addEventListener('click', function () { var cb = $(lab, '[data-in="lp"]'); cb.checked = false; lp = false; K.setSlider(lab, 'fs', 12); });
  })();
})();
