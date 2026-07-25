/* ============================================================
   Gradient Descent by Hand — core logic
   All computations run live in the browser; no dependencies.
   ============================================================ */

// --- MathJax helpers ---
let _mjQueue = [];
let _mjReady = false;

function renderMath(container, latex, display) {
  if (display === undefined) display = true;
  var wrapped = display ? ('\\[' + latex + '\\]') : ('\\(' + latex + '\\)');
  if (_mjReady && window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetClear([container]);
    container.innerHTML = wrapped;
    MathJax.typesetPromise([container]).catch(console.error);
  } else {
    container.innerHTML = wrapped;
    _mjQueue.push(container);
  }
}

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

// --- Loss function ---
// L(theta1, theta2) = 0.5 * theta1^2 + 2 * theta2^2
// gradient: (theta1, 4*theta2)
// minimum at (0, 0), L=0
function loss(t1, t2) { return 0.5 * t1 * t1 + 2 * t2 * t2; }
function grad(t1, t2) { return [t1, 4 * t2]; }

// --- Coordinate transforms ---
// Parameter range: [-4, 4] for both theta1 and theta2
const RANGE = 4;
function paramToCanvas(t1, t2, size) {
  return [(t1 + RANGE) / (2 * RANGE) * size, (RANGE - t2) / (2 * RANGE) * size];
}
function canvasToParam(px, py, size) {
  return [px / size * 2 * RANGE - RANGE, RANGE - py / size * 2 * RANGE];
}

// --- Color for loss value (heatmap) ---
function lossColor(v) {
  // v in [0, 1] — 0 is minimum (dark blue), 1 is high (bright)
  var t = Math.min(v, 1);
  var r = Math.round(7 + t * 80);
  var g = Math.round(17 + t * 30);
  var b = Math.round(31 + t * 100);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// --- Draw loss surface heatmap ---
function drawSurface(ctx, size) {
  var img = ctx.createImageData(size, size);
  var d = img.data;
  for (var py = 0; py < size; py++) {
    for (var px = 0; px < size; px++) {
      var p = canvasToParam(px, py, size);
      var v = Math.min(loss(p[0], p[1]) / 35, 1);
      var i = (py * size + px) * 4;
      d[i] = 7 + v * 80;
      d[i+1] = 17 + v * 30;
      d[i+2] = 31 + v * 100;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Draw contour lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (var level = 1; level <= 8; level++) {
    var r = Math.sqrt(level * 2);
    // Ellipse: theta1^2/(2*level) + theta2^2/(level/2) = 1
    // Actually L = 0.5*t1^2 + 2*t2^2 = level => t1^2/(2*level) + t2^2/(level/2) = 1
    var a = Math.sqrt(2 * level); // semi-axis along theta1
    var b = Math.sqrt(level / 2); // semi-axis along theta2
    ctx.beginPath();
    for (var ang = 0; ang <= 2 * Math.PI + 0.1; ang += 0.05) {
      var t1 = a * Math.cos(ang);
      var t2 = b * Math.sin(ang);
      if (Math.abs(t1) > RANGE || Math.abs(t2) > RANGE) continue;
      var c = paramToCanvas(t1, t2, size);
      if (ang === 0) ctx.moveTo(c[0], c[1]);
      else ctx.lineTo(c[0], c[1]);
    }
    ctx.stroke();
  }

  // Draw minimum marker
  var min = paramToCanvas(0, 0, size);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(min[0], min[1], 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('min (0,0)', min[0] + 8, min[1] - 8);
}

// --- Draw a path ---
function drawPath(ctx, path, color, size) {
  if (path.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (var i = 0; i < path.length; i++) {
    var c = paramToCanvas(path[i][0], path[i][1], size);
    if (i === 0) ctx.moveTo(c[0], c[1]);
    else ctx.lineTo(c[0], c[1]);
  }
  ctx.stroke();
  // Draw dots at each step
  for (var i = 0; i < path.length; i++) {
    var c = paramToCanvas(path[i][0], path[i][1], size);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c[0], c[1], i === path.length - 1 ? 7 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Draw a point ---
function drawPoint(ctx, t1, t2, color, size, label) {
  var c = paramToCanvas(t1, t2, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c[0], c[1], 7, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(label, c[0] + 10, c[1] - 8);
  }
}

// --- Draw an arrow ---
function drawArrow(ctx, from, to, color, size) {
  var c1 = paramToCanvas(from[0], from[1], size);
  var c2 = paramToCanvas(to[0], to[1], size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(c1[0], c1[1]);
  ctx.lineTo(c2[0], c2[1]);
  ctx.stroke();
  // Arrowhead
  var ang = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  ctx.beginPath();
  ctx.moveTo(c2[0], c2[1]);
  ctx.lineTo(c2[0] - 8 * Math.cos(ang - 0.4), c2[1] - 8 * Math.sin(ang - 0.4));
  ctx.lineTo(c2[0] - 8 * Math.cos(ang + 0.4), c2[1] - 8 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

// --- State ---
var startPos = [3.0, -2.5];
var currentStep = 0;
var TOTAL_STEPS = 6;

// Optimizer states
var gdState, momState, adamState;

function initOptState() {
  gdState = { pos: startPos.slice(), path: [startPos.slice()], step: 0 };
  momState = { pos: startPos.slice(), path: [startPos.slice()], step: 0, vel: [0, 0] };
  adamState = { pos: startPos.slice(), path: [startPos.slice()], step: 0, m: [0, 0], v: [0, 0] };
}

initOptState();

// --- Step navigation ---
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

// --- Render functions per step ---
function renderStep(n) {
  if (n === 0) renderSurface();
  else if (n === 1) renderGradient();
  else if (n === 2) renderGD();
  else if (n === 3) renderMomentum();
  else if (n === 4) renderAdam();
  else if (n === 5) renderComparison();
}

// --- Step 0: Loss surface ---
function renderSurface() {
  var canvas = document.getElementById('surface-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  drawPoint(ctx, startPos[0], startPos[1], '#fbbf24', canvas.width, 'start');
}

document.getElementById('btn-reset-start').addEventListener('click', function() {
  startPos = [3.0, -2.5];
  initOptState();
  renderSurface();
});
document.getElementById('btn-random-start').addEventListener('click', function() {
  startPos = [(Math.random() * 6 - 3), (Math.random() * 6 - 3)];
  initOptState();
  renderSurface();
});

document.getElementById('surface-canvas').addEventListener('click', function(e) {
  var rect = this.getBoundingClientRect();
  var px = (e.clientX - rect.left) / rect.width * this.width;
  var py = (e.clientY - rect.top) / rect.height * this.height;
  var p = canvasToParam(px, py, this.width);
  startPos = p;
  initOptState();
  renderSurface();
});

// --- Step 1: Gradient ---
function renderGradient() {
  var canvas = document.getElementById('gradient-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  var g = grad(startPos[0], startPos[1]);
  // Scale gradient for visualization
  var scale = 0.5;
  var gradEnd = [startPos[0] + g[0] * scale, startPos[1] + g[1] * scale];
  var descentEnd = [startPos[0] - g[0] * scale, startPos[1] - g[1] * scale];
  drawArrow(ctx, startPos, gradEnd, '#f87171', canvas.width);
  drawArrow(ctx, startPos, descentEnd, '#2dd4bf', canvas.width);
  drawPoint(ctx, startPos[0], startPos[1], '#fbbf24', canvas.width, 'θ');
  var liveEl = document.getElementById('gradient-live');
  liveEl.textContent = 'At current point: ∇L = (' + g[0].toFixed(3) + ', ' + g[1].toFixed(3) + ')';
}

// --- Step 2: Vanilla GD ---
function gdStep() {
  var lr = parseFloat(document.getElementById('lr-slider').value);
  var g = grad(gdState.pos[0], gdState.pos[1]);
  gdState.pos[0] -= lr * g[0];
  gdState.pos[1] -= lr * g[1];
  gdState.step++;
  gdState.path.push(gdState.pos.slice());
}

function renderGD() {
  var canvas = document.getElementById('gd-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  drawPath(ctx, gdState.path, '#7c83ff', canvas.width);
  drawPoint(ctx, gdState.pos[0], gdState.pos[1], '#fbbf24', canvas.width);
  var l = loss(gdState.pos[0], gdState.pos[1]);
  document.getElementById('gd-live').textContent = 'Step ' + gdState.step + ' | L = ' + l.toFixed(6) + ' | θ = (' + gdState.pos[0].toFixed(3) + ', ' + gdState.pos[1].toFixed(3) + ')';
}

function logStep(logId, step, pos, l, optimizer) {
  var el = document.getElementById(logId);
  var entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = '<span class="log-step">' + optimizer + ' #' + step + '</span> | θ = (' + pos[0].toFixed(3) + ', ' + pos[1].toFixed(3) + ') | <span class="log-loss">L = ' + l.toFixed(6) + '</span>';
  el.insertBefore(entry, el.firstChild);
}

document.getElementById('btn-gd-step').addEventListener('click', function() {
  gdStep();
  renderGD();
  logStep('gd-log', gdState.step, gdState.pos, loss(gdState.pos[0], gdState.pos[1]), 'GD');
});
document.getElementById('btn-gd-run').addEventListener('click', function() {
  for (var i = 0; i < 20; i++) {
    gdStep();
    logStep('gd-log', gdState.step, gdState.pos, loss(gdState.pos[0], gdState.pos[1]), 'GD');
  }
  renderGD();
});
document.getElementById('btn-gd-reset').addEventListener('click', function() {
  gdState = { pos: startPos.slice(), path: [startPos.slice()], step: 0 };
  document.getElementById('gd-log').innerHTML = '';
  renderGD();
});

// --- Step 3: Momentum ---
function momStep() {
  var lr = parseFloat(document.getElementById('lr-mom-slider').value);
  var beta = parseFloat(document.getElementById('beta-slider').value);
  var g = grad(momState.pos[0], momState.pos[1]);
  momState.vel[0] = beta * momState.vel[0] + g[0];
  momState.vel[1] = beta * momState.vel[1] + g[1];
  momState.pos[0] -= lr * momState.vel[0];
  momState.pos[1] -= lr * momState.vel[1];
  momState.step++;
  momState.path.push(momState.pos.slice());
}

function renderMomentum() {
  var canvas = document.getElementById('momentum-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  drawPath(ctx, momState.path, '#2dd4bf', canvas.width);
  drawPoint(ctx, momState.pos[0], momState.pos[1], '#fbbf24', canvas.width);
  var l = loss(momState.pos[0], momState.pos[1]);
  document.getElementById('mom-live').textContent = 'Step ' + momState.step + ' | L = ' + l.toFixed(6) + ' | θ = (' + momState.pos[0].toFixed(3) + ', ' + momState.pos[1].toFixed(3) + ')';
}

document.getElementById('btn-mom-step').addEventListener('click', function() {
  momStep();
  renderMomentum();
  logStep('mom-log', momState.step, momState.pos, loss(momState.pos[0], momState.pos[1]), 'Mom');
});
document.getElementById('btn-mom-run').addEventListener('click', function() {
  for (var i = 0; i < 20; i++) {
    momStep();
    logStep('mom-log', momState.step, momState.pos, loss(momState.pos[0], momState.pos[1]), 'Mom');
  }
  renderMomentum();
});
document.getElementById('btn-mom-reset').addEventListener('click', function() {
  momState = { pos: startPos.slice(), path: [startPos.slice()], step: 0, vel: [0, 0] };
  document.getElementById('mom-log').innerHTML = '';
  renderMomentum();
});

// --- Step 4: Adam ---
var ADAM_B1 = 0.9, ADAM_B2 = 0.999, ADAM_EPS = 1e-8;

function adamStep() {
  var lr = parseFloat(document.getElementById('lr-adam-slider').value);
  var g = grad(adamState.pos[0], adamState.pos[1]);
  var t = adamState.step + 1;
  adamState.m[0] = ADAM_B1 * adamState.m[0] + (1 - ADAM_B1) * g[0];
  adamState.m[1] = ADAM_B1 * adamState.m[1] + (1 - ADAM_B1) * g[1];
  adamState.v[0] = ADAM_B2 * adamState.v[0] + (1 - ADAM_B2) * g[0] * g[0];
  adamState.v[1] = ADAM_B2 * adamState.v[1] + (1 - ADAM_B2) * g[1] * g[1];
  var mHat0 = adamState.m[0] / (1 - Math.pow(ADAM_B1, t));
  var mHat1 = adamState.m[1] / (1 - Math.pow(ADAM_B1, t));
  var vHat0 = adamState.v[0] / (1 - Math.pow(ADAM_B2, t));
  var vHat1 = adamState.v[1] / (1 - Math.pow(ADAM_B2, t));
  adamState.pos[0] -= lr * mHat0 / (Math.sqrt(vHat0) + ADAM_EPS);
  adamState.pos[1] -= lr * mHat1 / (Math.sqrt(vHat1) + ADAM_EPS);
  adamState.step++;
  adamState.path.push(adamState.pos.slice());
}

function renderAdam() {
  var canvas = document.getElementById('adam-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  drawPath(ctx, adamState.path, '#fbbf24', canvas.width);
  drawPoint(ctx, adamState.pos[0], adamState.pos[1], '#fbbf24', canvas.width);
  var l = loss(adamState.pos[0], adamState.pos[1]);
  document.getElementById('adam-live').textContent = 'Step ' + adamState.step + ' | L = ' + l.toFixed(6) + ' | θ = (' + adamState.pos[0].toFixed(3) + ', ' + adamState.pos[1].toFixed(3) + ')';
}

document.getElementById('btn-adam-step').addEventListener('click', function() {
  adamStep();
  renderAdam();
  logStep('adam-log', adamState.step, adamState.pos, loss(adamState.pos[0], adamState.pos[1]), 'Adam');
});
document.getElementById('btn-adam-run').addEventListener('click', function() {
  for (var i = 0; i < 20; i++) {
    adamStep();
    logStep('adam-log', adamState.step, adamState.pos, loss(adamState.pos[0], adamState.pos[1]), 'Adam');
  }
  renderAdam();
});
document.getElementById('btn-adam-reset').addEventListener('click', function() {
  adamState = { pos: startPos.slice(), path: [startPos.slice()], step: 0, m: [0, 0], v: [0, 0] };
  document.getElementById('adam-log').innerHTML = '';
  renderAdam();
});

// --- Step 5: Comparison ---
var cmpGd, cmpMom, cmpAdam;

function initComparison() {
  cmpGd = { pos: startPos.slice(), path: [startPos.slice()], step: 0 };
  cmpMom = { pos: startPos.slice(), path: [startPos.slice()], step: 0, vel: [0, 0] };
  cmpAdam = { pos: startPos.slice(), path: [startPos.slice()], step: 0, m: [0, 0], v: [0, 0] };
}

function renderComparison() {
  var canvas = document.getElementById('compare-canvas');
  var ctx = canvas.getContext('2d');
  drawSurface(ctx, canvas.width);
  drawPath(ctx, cmpGd.path, '#7c83ff', canvas.width);
  drawPath(ctx, cmpMom.path, '#2dd4bf', canvas.width);
  drawPath(ctx, cmpAdam.path, '#fbbf24', canvas.width);
  drawPoint(ctx, cmpGd.pos[0], cmpGd.pos[1], '#7c83ff', canvas.width);
  drawPoint(ctx, cmpMom.pos[0], cmpMom.pos[1], '#2dd4bf', canvas.width);
  drawPoint(ctx, cmpAdam.pos[0], cmpAdam.pos[1], '#fbbf24', canvas.width);
}

document.getElementById('btn-compare-run').addEventListener('click', function() {
  var lr = 0.1, beta = 0.9;
  for (var i = 0; i < 30; i++) {
    // GD
    var gg = grad(cmpGd.pos[0], cmpGd.pos[1]);
    cmpGd.pos[0] -= lr * gg[0]; cmpGd.pos[1] -= lr * gg[1];
    cmpGd.step++; cmpGd.path.push(cmpGd.pos.slice());
    // Momentum
    var gm = grad(cmpMom.pos[0], cmpMom.pos[1]);
    cmpMom.vel[0] = beta * cmpMom.vel[0] + gm[0];
    cmpMom.vel[1] = beta * cmpMom.vel[1] + gm[1];
    cmpMom.pos[0] -= lr * cmpMom.vel[0]; cmpMom.pos[1] -= lr * cmpMom.vel[1];
    cmpMom.step++; cmpMom.path.push(cmpMom.pos.slice());
    // Adam
    var ga = grad(cmpAdam.pos[0], cmpAdam.pos[1]);
    var t = cmpAdam.step + 1;
    cmpAdam.m[0] = ADAM_B1 * cmpAdam.m[0] + (1-ADAM_B1) * ga[0];
    cmpAdam.m[1] = ADAM_B1 * cmpAdam.m[1] + (1-ADAM_B1) * ga[1];
    cmpAdam.v[0] = ADAM_B2 * cmpAdam.v[0] + (1-ADAM_B2) * ga[0]*ga[0];
    cmpAdam.v[1] = ADAM_B2 * cmpAdam.v[1] + (1-ADAM_B2) * ga[1]*ga[1];
    var mh0 = cmpAdam.m[0]/(1-Math.pow(ADAM_B1,t)), mh1 = cmpAdam.m[1]/(1-Math.pow(ADAM_B1,t));
    var vh0 = cmpAdam.v[0]/(1-Math.pow(ADAM_B2,t)), vh1 = cmpAdam.v[1]/(1-Math.pow(ADAM_B2,t));
    cmpAdam.pos[0] -= lr * mh0/(Math.sqrt(vh0)+ADAM_EPS);
    cmpAdam.pos[1] -= lr * mh1/(Math.sqrt(vh1)+ADAM_EPS);
    cmpAdam.step++; cmpAdam.path.push(cmpAdam.pos.slice());
  }
  renderComparison();
  // Update table
  var gdLoss = loss(cmpGd.pos[0], cmpGd.pos[1]);
  var momLoss = loss(cmpMom.pos[0], cmpMom.pos[1]);
  var adamLoss = loss(cmpAdam.pos[0], cmpAdam.pos[1]);
  document.getElementById('cmp-gd-steps').textContent = cmpGd.step;
  document.getElementById('cmp-mom-steps').textContent = cmpMom.step;
  document.getElementById('cmp-adam-steps').textContent = cmpAdam.step;
  document.getElementById('cmp-gd-loss').textContent = gdLoss.toFixed(6);
  document.getElementById('cmp-mom-loss').textContent = momLoss.toFixed(6);
  document.getElementById('cmp-adam-loss').textContent = adamLoss.toFixed(6);
  document.getElementById('cmp-gd-osc').textContent = 'High';
  document.getElementById('cmp-mom-osc').textContent = 'Low';
  document.getElementById('cmp-adam-osc').textContent = 'Minimal';
  // Highlight best
  var best = Math.min(gdLoss, momLoss, adamLoss);
  document.getElementById('cmp-gd-loss').className = (gdLoss === best) ? 'best' : '';
  document.getElementById('cmp-mom-loss').className = (momLoss === best) ? 'best' : '';
  document.getElementById('cmp-adam-loss').className = (adamLoss === best) ? 'best' : '';
});

document.getElementById('btn-compare-reset').addEventListener('click', function() {
  initComparison();
  renderComparison();
  ['cmp-gd-steps','cmp-mom-steps','cmp-adam-steps','cmp-gd-loss','cmp-mom-loss','cmp-adam-loss','cmp-gd-osc','cmp-mom-osc','cmp-adam-osc'].forEach(function(id) {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).className = '';
  });
});

// --- Slider live updates ---
document.getElementById('lr-slider').addEventListener('input', function() {
  document.getElementById('lr-val').textContent = parseFloat(this.value).toFixed(2);
});
document.getElementById('lr-mom-slider').addEventListener('input', function() {
  document.getElementById('lr-mom-val').textContent = parseFloat(this.value).toFixed(2);
});
document.getElementById('beta-slider').addEventListener('input', function() {
  document.getElementById('beta-val').textContent = parseFloat(this.value).toFixed(2);
});
document.getElementById('lr-adam-slider').addEventListener('input', function() {
  document.getElementById('lr-adam-val').textContent = parseFloat(this.value).toFixed(2);
});

// --- Init ---
initComparison();
renderSurface();
