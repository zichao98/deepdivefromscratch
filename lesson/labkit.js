/* ============================================================
   Deep Dive From Scratch — lab toolkit shared by every lesson.
   Load after lesson/lesson.js. Exposes window.Kit.
   ============================================================ */
(function () {
  'use strict';
  var L = window.Lesson;

  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return [].slice.call(root.querySelectorAll(sel)); }
  // Write a value into [data-out="name"] inside a lab; returns the element.
  function out(lab, name, v) { var el = $(lab, '[data-out="' + name + '"]'); if (el) el.textContent = v; return el; }
  // Replace the lab's explanatory note. cls: '', 'good', 'bad', 'warn'.
  function note(lab, html, cls) { var el = $(lab, '[data-out="note"]'); if (!el) return; el.innerHTML = html; el.className = 'lab-note' + (cls ? ' ' + cls : ''); }
  function fmt(n, d) {
    if (d == null) d = 3;
    if (!isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : '—';
    if (Math.abs(n) >= 1e5) return n.toExponential(2);
    if (Math.abs(n) < 5e-4 && n !== 0 && d > 2) return n.toExponential(1);
    return n.toFixed(d).replace(/^-(0\.0*)$/, '$1');
  }
  function col() {
    var v = L.cssVar;
    return { accent: v('--accent'), accent2: v('--accent2'), hl: v('--highlight'), text: v('--text'), text2: v('--text-secondary'), muted: v('--text-muted'),
             border: v('--border'), grid: v('--border-light'), good: v('--good'), bad: v('--bad'), warn: v('--warn'), bg: v('--lab-bg'), surface: v('--surface'), surface2: v('--surface2') };
  }
  function rgba(color, a) {
    var h = color.trim();
    if (h[0] !== '#') return h;
    h = h.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
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
  function text(ctx, s, x, y, color, font, align) {
    ctx.fillStyle = color; ctx.font = font || '11px JetBrains Mono, monospace'; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // Pointer dragging on a canvas created with Lesson.canvas. onPoint(p, isStart, isEnd)
  function drag(api, el, onPoint) {
    var down = false;
    el.addEventListener('pointerdown', function (e) { down = true; el.setPointerCapture(e.pointerId); onPoint(api.point(e), true, false); });
    el.addEventListener('pointermove', function (e) { if (down) onPoint(api.point(e), false, false); });
    el.addEventListener('pointerup', function (e) { if (down) onPoint(api.point(e), false, true); down = false; });
    el.addEventListener('pointercancel', function () { down = false; });
  }
  // Bind a range input [data-in="name"]; calls fn(value) now and on every change.
  function slider(lab, name, fn) { var s = $(lab, '[data-in="' + name + '"]'); s.addEventListener('input', function () { fn(+s.value); }); fn(+s.value); return s; }
  function setSlider(lab, name, v) { var s = $(lab, '[data-in="' + name + '"]'); s.value = v; s.dispatchEvent(new Event('input')); }
  // Segmented control [data-in="name"] with <button data-v="…">.
  function seg(lab, name, fn) {
    var el = $(lab, '[data-in="' + name + '"]');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$(el, 'button').forEach(function (x) { x.classList.toggle('on', x === b); });
      fn(b.dataset.v);
    });
    var on = $(el, 'button.on') || $(el, 'button'); return on ? on.dataset.v : null;
  }
  function on(lab, act, fn) { var b = $(lab, '[data-act="' + act + '"]'); if (b) b.addEventListener('click', fn); return b; }
  // Play/pause loop bound to a button. tick() returns false to stop.
  function player(btn, ms, tick, onStop) {
    var id = null, label = btn ? btn.innerHTML : '';
    var api = {
      get on() { return id !== null; },
      start: function () {
        if (id !== null) return;
        if (btn) btn.innerHTML = '❚❚ Pause';
        id = setInterval(function () { if (tick() === false) api.stop(); }, L.reduce ? 0 : ms);
      },
      stop: function () { if (id === null) return; clearInterval(id); id = null; if (btn) btn.innerHTML = label; if (onStop) onStop(); },
      toggle: function (before) { if (id !== null) api.stop(); else { if (before) before(); api.start(); } }
    };
    return api;
  }
  // Linear map helpers for plots: scale(d0, d1, r0, r1)
  function scale(d0, d1, r0, r1) { var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; f.inv = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); }; return f; }
  // Plot frame with padding and grid: returns {X, Y, pl, pr, pt, pb}
  function frame(ctx, w, h, xd, yd, opt) {
    opt = opt || {}; var c = col();
    var pl = opt.pl != null ? opt.pl : 38, pr = opt.pr != null ? opt.pr : 12, pt = opt.pt != null ? opt.pt : 12, pb = opt.pb != null ? opt.pb : 26;
    var X = scale(xd[0], xd[1], pl, w - pr), Y = scale(yd[0], yd[1], h - pb, pt);
    if (opt.grid !== false) {
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      (opt.xticks || []).forEach(function (t) { var px = X(t); ctx.beginPath(); ctx.moveTo(px, pt); ctx.lineTo(px, h - pb); ctx.stroke(); text(ctx, opt.xfmt ? opt.xfmt(t) : t, px, h - 8, c.muted, null, 'center'); });
      (opt.yticks || []).forEach(function (t) { var py = Y(t); ctx.beginPath(); ctx.moveTo(pl, py); ctx.lineTo(w - pr, py); ctx.stroke(); text(ctx, opt.yfmt ? opt.yfmt(t) : t, pl - 6, py + 4, c.muted, null, 'right'); });
      if (opt.xlabel) text(ctx, opt.xlabel, w - pr, h - pb - 6, c.muted, null, 'right');
      if (opt.ylabel) text(ctx, opt.ylabel, pl + 4, pt + 10, c.muted);
    }
    return { X: X, Y: Y, pl: pl, pr: pr, pt: pt, pb: pb };
  }
  function range(a, b, s) { var r = []; for (var v = a; v <= b + 1e-9; v += s) r.push(+v.toFixed(10)); return r; }
  // Deterministic pseudo-random numbers for reproducible datasets
  function rng(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function typeset(el) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(function () {}); }

  // Fake terminal inside `el`. handler(cmd, api) prints output via api.print(text, cls). Chips [data-cmd] inside `scope` fill the input.
  function term(el, opt) {
    opt = opt || {};
    el.classList.add('term');
    el.innerHTML = '<div class="term-out" aria-live="polite"></div><form class="term-line"><span class="p"></span><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Terminal command"></form>';
    var outEl = $(el, '.term-out'), form = $(el, 'form'), input = $(el, 'input'), pr = $(el, '.p'), hist = [], hi = 0;
    var api = {
      print: function (s, cls) { var d = document.createElement('div'); if (cls) d.className = cls; d.textContent = s; outEl.appendChild(d); outEl.scrollTop = outEl.scrollHeight; },
      html: function (h) { var d = document.createElement('div'); d.innerHTML = h; outEl.appendChild(d); outEl.scrollTop = outEl.scrollHeight; },
      clear: function () { outEl.innerHTML = ''; },
      prompt: function (p) { pr.textContent = p; },
      run: function (cmd) {
        api.html('<span class="p">' + esc(pr.textContent) + '</span> ' + esc(cmd));
        cmd = cmd.trim(); if (!cmd) return;
        hist.push(cmd); hi = hist.length;
        if (cmd === 'clear') { api.clear(); return; }
        opt.handler(cmd, api);
      },
      fill: function (cmd) { input.value = cmd; input.focus({ preventScroll: true }); input.setSelectionRange(cmd.length, cmd.length); },
      input: input
    };
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; api.run(v); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hi > 0) { hi--; input.value = hist[hi]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
    });
    if (opt.scope) opt.scope.addEventListener('click', function (e) { var c = e.target.closest('[data-cmd]'); if (c) api.fill(c.dataset.cmd); });
    api.prompt(opt.prompt || '$');
    return api;
  }

  window.Kit = { $: $, $$: $$, out: out, note: note, fmt: fmt, col: col, rgba: rgba, arrow: arrow, dot: dot, text: text, roundRect: roundRect,
    drag: drag, slider: slider, setSlider: setSlider, seg: seg, on: on, player: player, scale: scale, frame: frame, range: range, rng: rng, esc: esc, typeset: typeset, term: term,
    done: L.done, canvas: L.canvas, reduce: L.reduce };
})();
