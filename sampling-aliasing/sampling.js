(function () {
  'use strict';

  var signalCanvas = document.getElementById('signal-canvas');
  var spectrumCanvas = document.getElementById('spectrum-canvas');
  var toneSlider = document.getElementById('tone-slider');
  var rateSlider = document.getElementById('rate-slider');
  var filterToggle = document.getElementById('filter-toggle');
  var state = { tone: 7, rate: 12, filtered: false };
  var animationFrame;

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || getComputedStyle(document.body).getPropertyValue(name).trim(); }
  function setupCanvas(canvas, height) {
    var width = Math.max(280, canvas.clientWidth);
    var ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = height + 'px';
    var context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context: context, width: width, height: height };
  }
  function line(context, x1, y1, x2, y2, color, width, dash) {
    context.beginPath(); context.setLineDash(dash || []); context.moveTo(x1, y1); context.lineTo(x2, y2); context.strokeStyle = color; context.lineWidth = width; context.stroke(); context.setLineDash([]);
  }
  function effectiveTone() { return state.filtered ? Math.min(state.tone, state.rate * .44) : state.tone; }
  function aliasFrequency() {
    var tone = effectiveTone();
    var wrapped = Math.abs(tone - Math.round(tone / state.rate) * state.rate);
    return Math.min(wrapped, state.rate - wrapped);
  }
  function drawSignal() {
    var plot = setupCanvas(signalCanvas, signalCanvas.clientWidth < 500 ? 310 : 390);
    var ctx = plot.context, w = plot.width, h = plot.height;
    var colors = { bg: css('--hero-bg'), grid: css('--line'), text: css('--ink-faint'), raw: css('--violet'), sample: css('--coral'), rebuilt: css('--mint'), yellow: css('--yellow') };
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, w, h);
    var pad = { left: 45, right: 18, top: 43, bottom: 31 }, pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom, mid = pad.top + ph / 2;
    for (var i = 0; i <= 8; i += 1) { var gx = pad.left + pw * i / 8; line(ctx, gx, pad.top, gx, h - pad.bottom, colors.grid, 1); }
    for (var j = 0; j <= 4; j += 1) { var gy = pad.top + ph * j / 4; line(ctx, pad.left, gy, w - pad.right, gy, colors.grid, 1); }
    line(ctx, pad.left, mid, w - pad.right, mid, colors.text, 1);
    ctx.font = '10px DM Sans, sans-serif'; ctx.fillStyle = colors.text; ctx.fillText('1.0', 16, pad.top + 4); ctx.fillText('0', 28, mid + 3); ctx.fillText('−1.0', 11, h - pad.bottom + 3);
    var rawTone = state.tone, visibleTone = effectiveTone(), apparent = aliasFrequency();
    function plotWave(frequency, color, dashed, opacity) {
      ctx.beginPath(); ctx.setLineDash(dashed ? [6, 5] : []); ctx.globalAlpha = opacity || 1;
      for (var x = 0; x <= pw; x += 1) { var t = x / pw; var y = mid - Math.sin(Math.PI * 2 * frequency * t) * ph * .36; if (x === 0) ctx.moveTo(pad.left + x, y); else ctx.lineTo(pad.left + x, y); }
      ctx.strokeStyle = color; ctx.lineWidth = dashed ? 1.7 : 2.2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    plotWave(rawTone, colors.raw, false, state.filtered ? .24 : .95);
    if (state.filtered) plotWave(visibleTone, colors.raw, true, .9);
    if (apparent > .03) plotWave(apparent, colors.rebuilt, true, .9);
    var samples = Math.floor(state.rate);
    for (var n = 0; n <= samples; n += 1) {
      var tSample = n / samples, value = Math.sin(Math.PI * 2 * visibleTone * tSample), sx = pad.left + pw * tSample, sy = mid - value * ph * .36;
      line(ctx, sx, sy, sx, mid, colors.sample, 1, [2, 3]);
      ctx.beginPath(); ctx.arc(sx, sy, 4.7, 0, Math.PI * 2); ctx.fillStyle = colors.sample; ctx.fill(); ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.font = '10px Space Grotesk, sans-serif'; ctx.fillStyle = state.filtered ? colors.rebuilt : colors.yellow; ctx.fillText(state.filtered ? 'filtered input' : 'original input', pad.left + 8, pad.top + 17);
    ctx.fillStyle = colors.rebuilt; ctx.fillText('reconstruction: ' + apparent.toFixed(1) + ' Hz', w - 155, pad.top + 17);
  }
  function drawSpectrum() {
    var plot = setupCanvas(spectrumCanvas, 145), ctx = plot.context, w = plot.width, h = plot.height;
    var colors = { bg: css('--hero-bg'), grid: css('--line'), text: css('--ink-faint'), raw: css('--violet'), sample: css('--coral'), rebuilt: css('--mint'), yellow: css('--yellow') };
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, w, h);
    var pad = { left: 42, right: 18, top: 35, bottom: 27 }, pw = w - pad.left - pad.right, base = h - pad.bottom, maxFrequency = 32;
    for (var f = 0; f <= maxFrequency; f += 4) { var x = pad.left + pw * f / maxFrequency; line(ctx, x, pad.top, x, base, colors.grid, 1); ctx.font = '9px DM Sans, sans-serif'; ctx.fillStyle = colors.text; ctx.fillText(f, x - 5, h - 9); }
    line(ctx, pad.left, base, w - pad.right, base, colors.text, 1);
    var nyquistX = pad.left + pw * (state.rate / 2) / maxFrequency;
    line(ctx, nyquistX, pad.top, nyquistX, base, colors.yellow, 1, [4, 4]);
    ctx.fillStyle = colors.yellow; ctx.font = '10px Space Grotesk, sans-serif'; ctx.fillText('Nyquist', Math.min(nyquistX + 5, w - 56), pad.top + 12);
    function bar(freq, color, height, label) { if (freq < 0 || freq > maxFrequency) return; var x = pad.left + pw * freq / maxFrequency; line(ctx, x, base, x, base - height, color, 3); ctx.fillStyle = color; ctx.font = '9px DM Sans, sans-serif'; ctx.fillText(label, Math.min(x + 5, w - 70), base - height + 3); }
    var tone = effectiveTone(), alias = aliasFrequency(); bar(tone, colors.raw, 45, tone.toFixed(1) + ' Hz'); if (alias > .03 && alias < tone - .1) bar(alias, colors.rebuilt, 31, 'alias ' + alias.toFixed(1)); bar(state.rate - tone, colors.sample, 18, 'fold');
  }
  function update() {
    state.tone = parseFloat(toneSlider.value); state.rate = parseFloat(rateSlider.value); state.filtered = filterToggle.checked;
    var nyquist = state.rate / 2, alias = aliasFrequency(), safe = effectiveTone() <= nyquist + .0001;
    document.getElementById('tone-value').textContent = state.tone.toFixed(1); document.getElementById('tone-readout').textContent = state.tone.toFixed(1) + ' Hz';
    document.getElementById('rate-value').textContent = state.rate.toFixed(0); document.getElementById('rate-readout').textContent = state.rate.toFixed(0) + ' Hz'; document.getElementById('nyquist-value').textContent = nyquist.toFixed(1) + ' Hz'; document.getElementById('alias-value').textContent = alias.toFixed(1) + ' Hz';
    var status = document.getElementById('status-box'); status.classList.toggle('safe', safe); document.getElementById('status-title').textContent = safe ? (state.filtered ? 'Filtered and safe' : 'No aliasing') : 'Aliasing detected'; document.getElementById('status-copy').textContent = safe ? 'Every important frequency is inside the sampler\'s safe zone.' : 'The signal is above the Nyquist limit. It will fold into a lower frequency.';
    document.getElementById('lab-explanation').textContent = state.filtered ? 'The anti-alias filter has softened the input before sampling. The orange dots now describe a safe, band-limited signal.' : safe ? 'The orange dots are dense enough to preserve the original shape. Reconstruction can recover the signal without a frequency fold.' : 'The orange dots are the only facts the digital system receives. The turquoise curve is one possible reconstruction — an alias.';
    drawSignal(); drawSpectrum();
  }
  function animate() { drawSignal(); animationFrame = window.requestAnimationFrame(animate); }
  [toneSlider, rateSlider, filterToggle].forEach(function (control) { control.addEventListener('input', update); control.addEventListener('change', update); });
  document.getElementById('reset-lab').addEventListener('click', function () { toneSlider.value = 7; rateSlider.value = 12; filterToggle.checked = false; update(); });
  document.querySelectorAll('.quiz-option').forEach(function (button) { button.addEventListener('click', function () { var correct = button.dataset.answer === 'no'; document.querySelectorAll('.quiz-option').forEach(function (other) { other.classList.remove('correct', 'wrong'); }); button.classList.add(correct ? 'correct' : 'wrong'); var result = document.getElementById('quiz-result'); result.textContent = correct ? 'Correct — 24 / 2 = 12 Hz, and 9 Hz stays inside the safe zone.' : 'Not quite. The Nyquist limit is 12 Hz, so a 9 Hz signal is safe.'; }); });
  window.addEventListener('resize', update);
  update();
  animate();
})();
