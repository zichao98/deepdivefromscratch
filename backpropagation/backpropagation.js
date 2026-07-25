/* ============================================================
   Backpropagation by Hand — core logic
   A 2-3-1 neural network with sigmoid + cross-entropy.
   All computations run live in the browser.
   ============================================================ */

// --- MathJax helpers ---
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

// --- Math helpers ---
function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
function sigmoidDerivFromA(a) { return a * (1 - a); }

// --- Network state ---
// Architecture: 2 inputs, 3 hidden, 1 output
// Weights: W1[3][2] (hidden), W2[3] (output)
// Biases: b1[3] (hidden), b2 (output)
var net;

function initNetwork() {
  net = {
    W1: [[0.15, 0.20], [0.25, 0.30], [0.10, -0.15]],
    b1: [0.35, 0.35, 0.10],
    W2: [0.40, 0.45, 0.50],
    b2: 0.60,
    x: [0.5, 0.3],
    y: 1.0,
    lr: 0.5,
    // Forward pass results
    z1: [0, 0, 0],
    a1: [0, 0, 0],
    z2: 0,
    yhat: 0,
    loss: 0,
    // Backward pass results
    deltaOut: 0,
    delta1: [0, 0, 0],
    dW1: [[0,0],[0,0],[0,0]],
    db1: [0, 0, 0],
    dW2: [0, 0, 0],
    db2: 0,
    trainStep: 0
  };
  forwardPass();
}

function forwardPass() {
  // Hidden layer
  for (var j = 0; j < 3; j++) {
    net.z1[j] = net.W1[j][0] * net.x[0] + net.W1[j][1] * net.x[1] + net.b1[j];
    net.a1[j] = sigmoid(net.z1[j]);
  }
  // Output layer
  net.z2 = 0;
  for (var j = 0; j < 3; j++) net.z2 += net.W2[j] * net.a1[j];
  net.z2 += net.b2;
  net.yhat = sigmoid(net.z2);
  // Loss (binary cross-entropy)
  var eps = 1e-12;
  var yh = Math.max(Math.min(net.yhat, 1 - eps), eps);
  net.loss = -(net.y * Math.log(yh) + (1 - net.y) * Math.log(1 - yh));
}

function backwardPass() {
  // Output delta (sigmoid + cross-entropy simplification)
  net.deltaOut = net.yhat - net.y;
  // Hidden deltas
  for (var j = 0; j < 3; j++) {
    net.delta1[j] = net.W2[j] * net.deltaOut * sigmoidDerivFromA(net.a1[j]);
  }
  // Gradients
  for (var j = 0; j < 3; j++) {
    net.dW2[j] = net.deltaOut * net.a1[j];
    net.db2 = net.deltaOut; // (derivative of z w.r.t. b is 1)
    for (var i = 0; i < 2; i++) {
      net.dW1[j][i] = net.delta1[j] * net.x[i];
    }
    net.db1[j] = net.delta1[j];
  }
}

function updateWeights() {
  backwardPass();
  for (var j = 0; j < 3; j++) {
    for (var i = 0; i < 2; i++) net.W1[j][i] -= net.lr * net.dW1[j][i];
    net.b1[j] -= net.lr * net.db1[j];
    net.W2[j] -= net.lr * net.dW2[j];
  }
  net.b2 -= net.lr * net.db2;
  net.trainStep++;
  forwardPass();
}

// --- SVG network drawing ---
// Layout: 4 columns (input, hidden, output, labels)
var LAYER_X = [100, 280, 460];
var NEURON_Y = {
  input: [130, 270],
  hidden: [80, 200, 320],
  output: [200]
};
var NEURON_R = 22;

function drawNetwork(svgId, showValues, showGradients, highlightLayer) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';

  // Draw weights (lines)
  // Input -> Hidden
  for (var j = 0; j < 3; j++) {
    for (var i = 0; i < 2; i++) {
      var w = net.W1[j][i];
      var cls = 'weight-line ' + (w > 0 ? 'positive' : 'negative');
      if (highlightLayer === 'hidden') cls += ' highlighted';
      var line = createSVG('line', {
        x1: LAYER_X[0], y1: NEURON_Y.input[i],
        x2: LAYER_X[1], y2: NEURON_Y.hidden[j],
        class: cls, 'stroke-opacity': Math.min(Math.abs(w) / 0.6, 1)
      });
      svg.appendChild(line);
      // Weight label
      var mx = (LAYER_X[0] + LAYER_X[1]) / 2;
      var my = (NEURON_Y.input[i] + NEURON_Y.hidden[j]) / 2;
      var label = createSVG('text', { x: mx, y: my - 4, class: 'weight-label' });
      label.textContent = 'w' + (j+1) + (i+1) + '=' + w.toFixed(2);
      svg.appendChild(label);
    }
  }
  // Hidden -> Output
  for (var j = 0; j < 3; j++) {
    var w = net.W2[j];
    var cls = 'weight-line ' + (w > 0 ? 'positive' : 'negative');
    if (highlightLayer === 'output') cls += ' highlighted';
    var line = createSVG('line', {
      x1: LAYER_X[1], y1: NEURON_Y.hidden[j],
      x2: LAYER_X[2], y2: NEURON_Y.output[0],
      class: cls, 'stroke-opacity': Math.min(Math.abs(w) / 0.6, 1)
    });
    svg.appendChild(line);
    var mx = (LAYER_X[1] + LAYER_X[2]) / 2;
    var my = (NEURON_Y.hidden[j] + NEURON_Y.output[0]) / 2;
    var label = createSVG('text', { x: mx, y: my - 4, class: 'weight-label' });
    label.textContent = 'w' + (j+1) + '=' + w.toFixed(2);
    svg.appendChild(label);
  }

  // Draw neurons
  // Input layer
  for (var i = 0; i < 2; i++) {
    drawNeuron(svg, LAYER_X[0], NEURON_Y.input[i], 'x' + (i+1), showValues ? net.x[i].toFixed(3) : '', 'input');
  }
  // Hidden layer
  for (var j = 0; j < 3; j++) {
    var val = showValues ? net.a1[j].toFixed(3) : '';
    drawNeuron(svg, LAYER_X[1], NEURON_Y.hidden[j], 'h' + (j+1), val, 'hidden', showGradients ? net.delta1[j] : null);
  }
  // Output layer
  drawNeuron(svg, LAYER_X[2], NEURON_Y.output[0], 'ŷ', showValues ? net.yhat.toFixed(3) : '', 'output', showGradients ? net.deltaOut : null);

  // Layer labels
  var labels = [
    { x: LAYER_X[0], y: 370, text: 'Input' },
    { x: LAYER_X[1], y: 370, text: 'Hidden (σ)' },
    { x: LAYER_X[2], y: 370, text: 'Output (σ)' }
  ];
  labels.forEach(function(l) {
    var t = createSVG('text', { x: l.x, y: l.y, class: 'neuron-label', 'text-anchor': 'middle' });
    t.textContent = l.text;
    svg.appendChild(t);
  });
}

function drawNeuron(svg, cx, cy, label, value, layer, gradient) {
  var circle = createSVG('circle', { cx: cx, cy: cy, r: NEURON_R, class: 'neuron-circle' });
  if (value !== '') circle.setAttribute('class', 'neuron-circle active');
  svg.appendChild(circle);
  var lt = createSVG('text', { x: cx, y: cy - 2, class: 'neuron-label' });
  lt.textContent = label;
  svg.appendChild(lt);
  if (value) {
    var vt = createSVG('text', { x: cx, y: cy + 11, class: 'neuron-value' });
    vt.textContent = value;
    svg.appendChild(vt);
  }
  if (gradient !== null && gradient !== undefined) {
    var gt = createSVG('text', { x: cx, y: cy + NEURON_R + 14, class: 'neuron-value', fill: '#fbbf24' });
    gt.textContent = 'δ=' + gradient.toFixed(4);
    svg.appendChild(gt);
  }
}

function createSVG(tag, attrs) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
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
  if (n === 0) { drawNetwork('network-svg', false, false); }
  else if (n === 1) { renderForward(); }
  else if (n === 2) { renderLoss(); }
  else if (n === 3) { renderOutputGrad(); }
  else if (n === 4) { renderBackward(); }
  else if (n === 5) { renderUpdate(); }
}

// --- Step 0: Network ---
function renderNetwork() {
  drawNetwork('network-svg', false, false);
}

// Sliders
function bindSlider(id, valId, prop, fmt) {
  var el = document.getElementById(id);
  el.addEventListener('input', function() {
    var v = parseFloat(this.value);
    document.getElementById(valId).textContent = fmt ? fmt(v) : v.toFixed(2);
    if (prop) net[prop] = v;
    forwardPass();
    renderStep(currentStep);
  });
}

bindSlider('in-x1', 'in-x1-val', null, function(v) { net.x[0] = v; return v.toFixed(2); });
bindSlider('in-x2', 'in-x2-val', null, function(v) { net.x[1] = v; return v.toFixed(2); });
bindSlider('in-target', 'in-target-val', null, function(v) { net.y = v; return v.toFixed(2); });
bindSlider('in-lr', 'in-lr-val', null, function(v) { net.lr = v; return v.toFixed(2); });

document.getElementById('btn-net-random').addEventListener('click', function() {
  for (var j = 0; j < 3; j++) {
    net.W1[j][0] = (Math.random() * 2 - 1) * 0.5;
    net.W1[j][1] = (Math.random() * 2 - 1) * 0.5;
    net.b1[j] = (Math.random() * 2 - 1) * 0.3;
    net.W2[j] = (Math.random() * 2 - 1) * 0.5;
  }
  net.b2 = (Math.random() * 2 - 1) * 0.3;
  net.trainStep = 0;
  forwardPass();
  renderStep(currentStep);
});

document.getElementById('btn-net-reset').addEventListener('click', function() {
  initNetwork();
  renderStep(currentStep);
});

// --- Step 1: Forward Pass ---
function renderForward() {
  drawNetwork('forward-svg', true, false);
  var tbody = document.querySelector('#forward-table tbody');
  var rows = '';
  for (var j = 0; j < 3; j++) {
    rows += '<tr class="highlight-row"><td>Hidden h' + (j+1) + '</td>' +
      '<td>(' + net.x[0].toFixed(2) + ', ' + net.x[1].toFixed(2) + ')</td>' +
      '<td>(' + net.W1[j][0].toFixed(2) + ', ' + net.W1[j][1].toFixed(2) + ')</td>' +
      '<td>' + net.b1[j].toFixed(2) + '</td>' +
      '<td>' + net.z1[j].toFixed(4) + '</td>' +
      '<td>' + net.a1[j].toFixed(4) + '</td></tr>';
  }
  rows += '<tr><td>Output ŷ</td>' +
    '<td>(' + net.a1[0].toFixed(3) + ', ' + net.a1[1].toFixed(3) + ', ' + net.a1[2].toFixed(3) + ')</td>' +
    '<td>(' + net.W2[0].toFixed(2) + ', ' + net.W2[1].toFixed(2) + ', ' + net.W2[2].toFixed(2) + ')</td>' +
    '<td>' + net.b2.toFixed(2) + '</td>' +
    '<td>' + net.z2.toFixed(4) + '</td>' +
    '<td>' + net.yhat.toFixed(4) + '</td></tr>';
  tbody.innerHTML = rows;
}

// --- Step 2: Loss ---
function renderLoss() {
  drawNetwork('loss-svg', true, false);
  // Draw loss visualization on the SVG
  var svg = document.getElementById('loss-svg');
  svg.innerHTML = '';
  // Show prediction vs target
  var bg = createSVG('rect', { x: 0, y: 0, width: 500, height: 300, fill: '#07111f', rx: 10 });
  svg.appendChild(bg);
  // Bars
  var barW = 80, gap = 60, startX = 80;
  // Target bar
  var tH = net.y * 200;
  svg.appendChild(createSVG('rect', { x: startX, y: 250 - tH, width: barW, height: tH, fill: '#2dd4bf', rx: 4 }));
  var tLabel = createSVG('text', { x: startX + barW/2, y: 270, fill: '#2dd4bf', 'font-size': 13, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono' });
  tLabel.textContent = 'Target y = ' + net.y.toFixed(2);
  svg.appendChild(tLabel);
  // Prediction bar
  var pH = net.yhat * 200;
  svg.appendChild(createSVG('rect', { x: startX + barW + gap, y: 250 - pH, width: barW, height: pH, fill: '#7c83ff', rx: 4 }));
  var pLabel = createSVG('text', { x: startX + barW + gap + barW/2, y: 270, fill: '#7c83ff', 'font-size': 13, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono' });
  pLabel.textContent = 'Prediction ŷ = ' + net.yhat.toFixed(4);
  svg.appendChild(pLabel);
  // Loss display
  var lossText = createSVG('text', { x: 250, y: 50, fill: '#fbbf24', 'font-size': 18, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono', 'font-weight': 'bold' });
  lossText.textContent = 'Loss L = ' + net.loss.toFixed(6);
  svg.appendChild(lossText);
  // Formula
  var formulaText = createSVG('text', { x: 250, y: 90, fill: '#b1bac4', 'font-size': 12, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono' });
  formulaText.textContent = 'L = -[y·log(ŷ) + (1-y)·log(1-ŷ)]';
  svg.appendChild(formulaText);

  document.getElementById('loss-display').textContent = 'L = ' + net.loss.toFixed(6) + '  |  ŷ = ' + net.yhat.toFixed(4) + '  |  y = ' + net.y.toFixed(2);
}

// --- Step 3: Output Gradient ---
function renderOutputGrad() {
  drawNetwork('output-grad-svg', true, false, 'output');
  document.getElementById('delta-out-display').textContent = 'δ_out = ŷ - y = ' + net.yhat.toFixed(4) + ' - ' + net.y.toFixed(2) + ' = ' + (net.yhat - net.y).toFixed(4);
}

// --- Step 4: Backward Pass ---
function renderBackward() {
  backwardPass();
  drawNetwork('backward-svg', true, true, 'hidden');
  var display = document.getElementById('backward-display');
  var html = '';
  html += '<span class="grad-name">Output error signal:</span><br>';
  html += 'δ_out = ŷ - y = ' + net.yhat.toFixed(4) + ' - ' + net.y.toFixed(2) + ' = <span class="grad-val">' + net.deltaOut.toFixed(4) + '</span><br><br>';
  html += '<span class="grad-name">Hidden layer deltas (chain rule):</span><br>';
  for (var j = 0; j < 3; j++) {
    var da = net.W2[j] * net.deltaOut;
    var sd = sigmoidDerivFromA(net.a1[j]);
    html += 'δ_' + (j+1) + ' = (w' + (j+1) + '·δ_out) · σ\'(z' + (j+1) + ') = (' + net.W2[j].toFixed(2) + '×' + net.deltaOut.toFixed(4) + ') × ' + net.a1[j].toFixed(4) + '×(1-' + net.a1[j].toFixed(4) + ') = <span class="grad-val">' + net.delta1[j].toFixed(6) + '</span><br>';
  }
  html += '<br><span class="grad-name">Weight gradients:</span><br>';
  html += '<span class="chain">Output layer:</span><br>';
  for (var j = 0; j < 3; j++) {
    html += '∂L/∂w' + (j+1) + ' = δ_out × a' + (j+1) + ' = ' + net.deltaOut.toFixed(4) + ' × ' + net.a1[j].toFixed(4) + ' = <span class="grad-val">' + net.dW2[j].toFixed(6) + '</span><br>';
  }
  html += '<span class="chain">Hidden layer:</span><br>';
  for (var j = 0; j < 3; j++) {
    for (var i = 0; i < 2; i++) {
      html += '∂L/∂w' + (j+1) + (i+1) + ' = δ' + (j+1) + ' × x' + (i+1) + ' = ' + net.delta1[j].toFixed(6) + ' × ' + net.x[i].toFixed(2) + ' = <span class="grad-val">' + net.dW1[j][i].toFixed(6) + '</span><br>';
    }
  }
  display.innerHTML = html;
}

// --- Step 5: Weight Update ---
function renderUpdate() {
  backwardPass();
  drawNetwork('update-svg', true, false);
  var tbody = document.querySelector('#gradient-table tbody');
  var rows = '';
  for (var j = 0; j < 3; j++) {
    for (var i = 0; i < 2; i++) {
      var oldW = net.W1[j][i];
      var newW = oldW - net.lr * net.dW1[j][i];
      rows += '<tr><td>w' + (j+1) + (i+1) + '</td><td>' + oldW.toFixed(4) + '</td><td>' + net.dW1[j][i].toFixed(6) + '</td><td>' + newW.toFixed(4) + '</td></tr>';
    }
  }
  for (var j = 0; j < 3; j++) {
    var oldW = net.W2[j];
    var newW = oldW - net.lr * net.dW2[j];
    rows += '<tr class="highlight-row"><td>w' + (j+1) + ' (out)</td><td>' + oldW.toFixed(4) + '</td><td>' + net.dW2[j].toFixed(6) + '</td><td>' + newW.toFixed(4) + '</td></tr>';
  }
  tbody.innerHTML = rows;
  document.getElementById('update-status').textContent = 'Step ' + net.trainStep + ' | L = ' + net.loss.toFixed(6) + ' | ŷ = ' + net.yhat.toFixed(4);
}

document.getElementById('btn-update').addEventListener('click', function() {
  updateWeights();
  renderUpdate();
});
document.getElementById('btn-update-10').addEventListener('click', function() {
  for (var i = 0; i < 10; i++) updateWeights();
  renderUpdate();
});
document.getElementById('btn-update-reset').addEventListener('click', function() {
  initNetwork();
  renderUpdate();
});

// --- Init ---
initNetwork();
renderNetwork();
