/* ============================================================
   Convex Optimization — core logic
   All computations run live in the browser.
   ============================================================ */

// --- MathJax helpers (same pattern as other pages) ---
var _mjQueue = [];
var _mjReady = false;

function typeset(el) {
  if (_mjReady) {
    MathJax.typesetClear([el]);
    MathJax.typesetPromise([el]).catch(console.error);
  } else {
    _mjQueue.push(el);
  }
}

function _flushMjQueue() {
  _mjReady = true;
  if (_mjQueue.length) {
    MathJax.typesetPromise(_mjQueue).catch(console.error);
    _mjQueue = [];
  }
}

window.addEventListener('load', function() {
  if (window.MathJax && MathJax.startup) {
    MathJax.startup.promise.then(_flushMjQueue);
  } else {
    setTimeout(_flushMjQueue, 1500);
  }
});

// --- Functions ---
var fnKind = 'convex';
function f(x) { return fnKind === 'convex' ? x * x : x * x * x * x - x * x; }
function fLabel() { return fnKind === 'convex' ? 'x²' : 'x⁴ − x²'; }

// --- Coordinate system for 1D function plots ---
// x range: [-2.5, 2.5], y range: [-0.3, 4.5]
var X_MIN = -2.5, X_MAX = 2.5, Y_MIN = -0.3, Y_MAX = 4.5;

function xToPx(x, w) { return (x - X_MIN) / (X_MAX - X_MIN) * w; }
function yToPx(y, h) { return h - (y - Y_MIN) / (Y_MAX - Y_MIN) * h; }
function pxToX(px, w) { return px / w * (X_MAX - X_MIN) + X_MIN; }

// --- Draw axes ---
function drawAxes(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  // x-axis
  var y0 = yToPx(0, h);
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
  // y-axis
  var x0 = xToPx(0, w);
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, h); ctx.stroke();
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (var gx = -2; gx <= 2; gx++) {
    if (gx === 0) continue;
    var px = xToPx(gx, w);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  for (var gy = 1; gy <= 4; gy++) {
    var py = yToPx(gy, h);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

// --- Draw function curve ---
function drawFunction(ctx, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  var first = true;
  for (var x = X_MIN; x <= X_MAX; x += 0.02) {
    var px = xToPx(x, w);
    var py = yToPx(f(x), h);
    if (first) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Label
  ctx.fillStyle = color;
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText('f(x) = ' + fLabel(), 12, 22);
}

// --- Step navigation ---
var currentStep = 0;
var TOTAL_STEPS = 6;

function showStep(n) {
  document.querySelectorAll('.step-panel').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.step-btn').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('step-' + n).classList.add('active');
  document.querySelector('.step-btn[data-step="' + n + '"]').classList.add('active');
  document.getElementById('step-indicator').textContent = 'Step ' + (n + 1) + ' / ' + TOTAL_STEPS;
  document.getElementById('btn-prev').disabled = (n === 0);
  document.getElementById('btn-next').disabled = (n === TOTAL_STEPS - 1);
  currentStep = n;
  renderStep(n);
}

document.querySelectorAll('.step-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { showStep(parseInt(btn.dataset.step)); });
});
document.getElementById('btn-prev').addEventListener('click', function() { if (currentStep > 0) showStep(currentStep - 1); });
document.getElementById('btn-next').addEventListener('click', function() { if (currentStep < TOTAL_STEPS - 1) showStep(currentStep + 1); });

function renderStep(n) {
  if (n === 0) renderConvex();
  else if (n === 1) renderChord();
  else if (n === 2) renderSet();
  else if (n === 3) renderMinimum();
  else if (n === 4) renderCondition();
}

// --- Step 0: Convexity ---
function renderConvex() {
  var canvas = document.getElementById('convex-canvas');
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawAxes(ctx, canvas.width, canvas.height);
  drawFunction(ctx, canvas.width, canvas.height, '#906bff');
  // Draw a sample chord
  var x1 = -1.5, x2 = 1.5;
  var y1 = f(x1), y2 = f(x2);
  ctx.strokeStyle = '#ffdd72';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(xToPx(x1, canvas.width), yToPx(y1, canvas.height));
  ctx.lineTo(xToPx(x2, canvas.width), yToPx(y2, canvas.height));
  ctx.stroke();
  ctx.setLineDash([]);
  // Points
  [[x1, y1, '#72f4c7'], [x2, y2, '#72f4c7']].forEach(function(p) {
    ctx.fillStyle = p[2];
    ctx.beginPath();
    ctx.arc(xToPx(p[0], canvas.width), yToPx(p[1], canvas.height), 6, 0, Math.PI * 2);
    ctx.fill();
  });
  // Status
  var status = document.getElementById('convex-status');
  if (fnKind === 'convex') {
    status.textContent = 'This function IS convex ✓ — the chord (dashed) stays above the curve';
    status.style.color = 'var(--positive)';
  } else {
    status.textContent = 'This function is NOT convex ✗ — the chord dips below the curve in the middle';
    status.style.color = 'var(--negative)';
  }
}

document.querySelectorAll('.fn-tab[data-fn]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    fnKind = btn.dataset.fn;
    document.querySelectorAll('.fn-tab[data-fn]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderConvex();
  });
});

// --- Step 1: Chord Test ---
function renderChord() {
  var canvas = document.getElementById('chord-canvas');
  var ctx = canvas.getContext('2d');
  var a = parseFloat(document.getElementById('chord-a').value);
  var b = parseFloat(document.getElementById('chord-b').value);
  var lam = parseFloat(document.getElementById('chord-l').value);
  var w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, w, h);
  drawAxes(ctx, w, h);
  drawFunction(ctx, w, h, '#906bff');

  var fa = f(a), fb = f(b);
  var xm = lam * a + (1 - lam) * b;
  var fm = f(xm);
  var chordVal = lam * fa + (1 - lam) * fb;
  var isConvex = fnKind === 'convex';
  var passes = fm <= chordVal + 1e-7;

  // Draw chord
  ctx.strokeStyle = '#ffdd72';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(xToPx(a, w), yToPx(fa, h));
  ctx.lineTo(xToPx(b, w), yToPx(fb, h));
  ctx.stroke();

  // Draw mixture point on function
  ctx.fillStyle = '#ff7188';
  ctx.beginPath();
  ctx.arc(xToPx(xm, w), yToPx(fm, h), 7, 0, Math.PI * 2);
  ctx.fill();

  // Draw chord value point
  ctx.fillStyle = '#ffdd72';
  ctx.beginPath();
  ctx.arc(xToPx(xm, w), yToPx(chordVal, h), 7, 0, Math.PI * 2);
  ctx.fill();

  // Draw endpoints
  [[a, fa, '#72f4c7'], [b, fb, '#72f4c7']].forEach(function(p) {
    ctx.fillStyle = p[2];
    ctx.beginPath();
    ctx.arc(xToPx(p[0], w), yToPx(p[1], h), 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('x₁', xToPx(a, w) - 8, yToPx(fa, h) - 12);
  ctx.fillText('x₂', xToPx(b, w) - 8, yToPx(fb, h) - 12);
  ctx.fillText('f(xλ)', xToPx(xm, w) + 8, yToPx(fm, h) - 8);
  ctx.fillText('chord', xToPx(xm, w) + 8, yToPx(chordVal, h) + 14);

  // Readout
  var readout = document.getElementById('chord-readout');
  readout.innerHTML =
    'xλ = ' + xm.toFixed(3) + '<br>' +
    'f(xλ) = ' + fm.toFixed(3) + '<br>' +
    'chord value = ' + chordVal.toFixed(3) + '<br>' +
    (passes
      ? '<span class="pass">f(xλ) ≤ chord → Chord test PASSES ✓</span>'
      : '<span class="fail">f(xλ) > chord → Chord test FAILS ✗</span>');
}

['chord-a', 'chord-b', 'chord-l'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = parseFloat(this.value).toFixed(2).replace('-', '−');
    renderChord();
  });
});

document.querySelectorAll('.fn-tab[data-fn2]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    fnKind = btn.dataset.fn2;
    document.querySelectorAll('.fn-tab[data-fn2]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderChord();
  });
});

// --- Step 2: Convex Sets ---
var setPoints = [];

function renderSet() {
  var canvas = document.getElementById('set-canvas');
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, w, h);

  if (setPoints.length < 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click to add points', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }

  // Compute convex hull (Graham scan)
  var hull = convexHull(setPoints);

  // Fill hull
  if (hull.length >= 3) {
    ctx.fillStyle = 'rgba(45, 212, 191, 0.15)';
    ctx.beginPath();
    ctx.moveTo(hull[0][0], hull[0][1]);
    for (var i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
    ctx.closePath();
    ctx.fill();
    // Stroke hull
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (hull.length === 2) {
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hull[0][0], hull[0][1]);
    ctx.lineTo(hull[1][0], hull[1][1]);
    ctx.stroke();
  }

  // Draw points
  setPoints.forEach(function(p) {
    ctx.fillStyle = '#7c83ff';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  var sorted = pts.slice().sort(function(a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var cross = function(O, A, B) { return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]); };
  var lower = [];
  for (var i = 0; i < sorted.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], sorted[i]) <= 0) lower.pop();
    lower.push(sorted[i]);
  }
  var upper = [];
  for (var i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], sorted[i]) <= 0) upper.pop();
    upper.push(sorted[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

document.getElementById('set-canvas').addEventListener('click', function(e) {
  var rect = this.getBoundingClientRect();
  var px = (e.clientX - rect.left) / rect.width * this.width;
  var py = (e.clientY - rect.top) / rect.height * this.height;
  setPoints.push([px, py]);
  renderSet();
});
document.getElementById('btn-set-clear').addEventListener('click', function() { setPoints = []; renderSet(); });
document.getElementById('btn-set-preset').addEventListener('click', function() {
  var w = document.getElementById('set-canvas').width;
  var h = document.getElementById('set-canvas').height;
  setPoints = [
    [w*0.3, h*0.3], [w*0.7, h*0.25], [w*0.8, h*0.6], [w*0.55, h*0.8], [w*0.25, h*0.65]
  ];
  renderSet();
});

// --- Step 3: Global Minimum ---
var minMode = 'convex';

function renderMinimum() {
  var canvas = document.getElementById('minimum-canvas');
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, w, h);
  drawAxes(ctx, w, h);

  var fn = minMode === 'convex' ? function(x) { return x * x; } : function(x) { return x*x*x*x - x*x; };
  var color = minMode === 'convex' ? '#2dd4bf' : '#f87171';
  var label = minMode === 'convex' ? 'x² (convex)' : 'x⁴ − x² (non-convex)';

  // Draw function
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  var first = true;
  for (var x = X_MIN; x <= X_MAX; x += 0.02) {
    var px = xToPx(x, w);
    var py = yToPx(fn(x), h);
    if (first) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText('f(x) = ' + label, 12, 22);

  // Mark minima
  if (minMode === 'convex') {
    // Global minimum at x=0
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(xToPx(0, w), yToPx(0, h), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('global min', xToPx(0, w) + 10, yToPx(0, h) - 10);
  } else {
    // Two local minima at x = ±1/√2, one local max at x=0
    var xmin1 = -1/Math.sqrt(2), xmin2 = 1/Math.sqrt(2);
    var ymin = fn(xmin1);
    // Local max at 0
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(xToPx(0, w), yToPx(fn(0), h), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('local max', xToPx(0, w) + 8, yToPx(fn(0), h) - 8);
    // Local minima
    [[xmin1, 'local min'], [xmin2, 'local min']].forEach(function(p) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(xToPx(p[0], w), yToPx(ymin, h), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(p[1], xToPx(p[0], w) + 8, yToPx(ymin, h) - 8);
    });
    // Global minimum indicator
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('both are global minima (symmetric)', xToPx(xmin2, w) + 8, yToPx(ymin, h) + 20);
  }

  var status = document.getElementById('min-status');
  if (minMode === 'convex') {
    status.textContent = 'Convex: one global minimum at x = 0 — no bad local minima';
    status.style.color = 'var(--positive)';
  } else {
    status.textContent = 'Non-convex: two local minima + one local maximum — GD could get trapped';
    status.style.color = 'var(--negative)';
  }
}

document.getElementById('btn-min-convex').addEventListener('click', function() {
  minMode = 'convex';
  this.classList.add('accent-btn');
  document.getElementById('btn-min-nonconvex').classList.remove('accent-btn');
  renderMinimum();
});
document.getElementById('btn-min-nonconvex').addEventListener('click', function() {
  minMode = 'nonconvex';
  this.classList.add('accent-btn');
  document.getElementById('btn-min-convex').classList.remove('accent-btn');
  renderMinimum();
});

// --- Step 4: Condition Number ---
function renderCondition() {
  var canvas = document.getElementById('cond-canvas');
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  var kappa = parseFloat(document.getElementById('cond-slider').value);

  // Loss: 0.5*theta1^2 + kappa/2 * theta2^2
  // Range: [-3, 3] for both
  var R = 3;
  function p2c(t1, t2) { return [(t1+R)/(2*R)*w, (R-t2)/(2*R)*h]; }
  function c2p(px, py) { return [px/w*2*R-R, R-py/h*2*R]; }

  // Draw heatmap
  var img = ctx.createImageData(w, h);
  var d = img.data;
  for (var py = 0; py < h; py++) {
    for (var px = 0; px < w; px++) {
      var p = c2p(px, py);
      var v = Math.min((0.5*p[0]*p[0] + kappa/2*p[1]*p[1]) / (kappa*5), 1);
      var i = (py * w + px) * 4;
      d[i] = 7 + v * 80;
      d[i+1] = 17 + v * 30;
      d[i+2] = 31 + v * 100;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Contour lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (var level = 1; level <= 10; level++) {
    var a = Math.sqrt(2 * level);
    var b = Math.sqrt(2 * level / kappa);
    ctx.beginPath();
    for (var ang = 0; ang <= 2 * Math.PI + 0.1; ang += 0.05) {
      var t1 = a * Math.cos(ang), t2 = b * Math.sin(ang);
      if (Math.abs(t1) > R || Math.abs(t2) > R) continue;
      var c = p2c(t1, t2);
      if (ang === 0) ctx.moveTo(c[0], c[1]);
      else ctx.lineTo(c[0], c[1]);
    }
    ctx.stroke();
  }

  // Minimum
  var min = p2c(0, 0);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(min[0], min[1], 5, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('θ₁', w - 20, h/2 - 8);
  ctx.fillText('θ₂', w/2 + 8, 16);

  // Status
  var status = document.getElementById('cond-status');
  if (kappa <= 1.5) status.textContent = 'κ = ' + kappa.toFixed(1) + ': nearly circular — fast convergence';
  else if (kappa <= 10) status.textContent = 'κ = ' + kappa.toFixed(1) + ': mild oscillation';
  else if (kappa <= 25) status.textContent = 'κ = ' + kappa.toFixed(1) + ': significant oscillation';
  else status.textContent = 'κ = ' + kappa.toFixed(1) + ': severe oscillation — very slow convergence';
}

document.getElementById('cond-slider').addEventListener('input', function() {
  document.getElementById('cond-val').textContent = parseFloat(this.value).toFixed(1);
  renderCondition();
});

// --- Init ---
renderConvex();
