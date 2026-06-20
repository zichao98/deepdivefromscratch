/* ============================================================
   CNN by Hand -- core logic
   All matrix ops run live in the browser; no dependencies.
   ============================================================ */

// --- MathJax helpers (must be at top -- used by render functions below) --------
let _mjQueue = [];
let _mjReady = false;

// Render a LaTeX string into container using the official MathJax 3 pattern:
// typesetClear -> set innerHTML with delimiters -> typesetPromise.
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

// Typeset static LaTeX already present as text inside el.
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

// --- State -------------------------------------------------------------------
const ROWS = 5, COLS = 5;
const K = 3; // kernel size

let inputMatrix = [
  [0,1,1,1,0],
  [1,0,0,0,1],
  [1,0,1,0,1],
  [1,0,0,0,1],
  [0,1,1,1,0],
];

let kernel = [
  [ 1,  0, -1],
  [ 2,  0, -2],
  [ 1,  0, -1],
];

let featureMap = [];
let reluMap    = [];
let poolMap    = [];
let flatVec    = [];
let fcWeights  = [];
let fcBias     = [];
let logits     = [];
let softmaxOut = [];

const CLASS_LABELS = ['Class A', 'Class B', 'Class C'];

let currentStep = 0;
const TOTAL_STEPS = 6;

// --- Utility -----------------------------------------------------------------
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmt(v) { return Number.isInteger(v) ? String(v) : v.toFixed(3); }
function round2(v) { return Math.round(v * 100) / 100; }

// --- Matrix ops --------------------------------------------------------------
function convolve(X, K) {
  const rOut = X.length - K.length + 1;
  const cOut = X[0].length - K[0].length + 1;
  const Z = [];
  for (let i = 0; i < rOut; i++) {
    Z.push([]);
    for (let j = 0; j < cOut; j++) {
      let sum = 0;
      for (let m = 0; m < K.length; m++)
        for (let n = 0; n < K[0].length; n++)
          sum += X[i+m][j+n] * K[m][n];
      Z[i].push(round2(sum));
    }
  }
  return Z;
}

function relu(Z) {
  return Z.map(function(row) { return row.map(function(v) { return Math.max(0, v); }); });
}

function maxPool(A, kSize, stride) {
  if (kSize === undefined) kSize = 2;
  if (stride === undefined) stride = 1;
  const rOut = Math.floor((A.length    - kSize) / stride) + 1;
  const cOut = Math.floor((A[0].length - kSize) / stride) + 1;
  const P = [];
  for (let i = 0; i < rOut; i++) {
    P.push([]);
    for (let j = 0; j < cOut; j++) {
      let mx = -Infinity;
      for (let m = 0; m < kSize; m++)
        for (let n = 0; n < kSize; n++)
          mx = Math.max(mx, A[i*stride+m][j*stride+n]);
      P[i].push(round2(mx));
    }
  }
  return P;
}

function flatten(P) {
  return P.reduce(function(acc, row) { return acc.concat(row); }, []);
}

function matVecMul(W, v, b) {
  return W.map(function(row, i) {
    return round2(row.reduce(function(s, w, j) { return s + w * v[j]; }, 0) + b[i]);
  });
}

function softmax(z) {
  const max = Math.max.apply(null, z);
  const exps = z.map(function(v) { return Math.exp(v - max); });
  const sum = exps.reduce(function(a, b) { return a + b; }, 0);
  return exps.map(function(e) { return round2(e / sum); });
}

function initWeights(nOut, nIn) {
  return Array.from({length: nOut}, function() {
    return Array.from({length: nIn}, function() { return round2((Math.random() - 0.5) * 1.2); });
  });
}

// --- Recompute pipeline ------------------------------------------------------
function recompute() {
  featureMap = convolve(inputMatrix, kernel);
  reluMap    = relu(featureMap);
  poolMap    = maxPool(reluMap, 2, 1);
  flatVec    = flatten(poolMap);
  if (fcWeights.length === 0 || fcWeights[0].length !== flatVec.length) {
    fcWeights = initWeights(3, flatVec.length);
    fcBias    = [0.1, -0.1, 0.05];
  }
  logits     = matVecMul(fcWeights, flatVec, fcBias);
  softmaxOut = softmax(logits);
}

// --- Grid rendering ----------------------------------------------------------
function renderGrid(containerId, matrix, opts) {
  opts = opts || {};
  const el = document.getElementById(containerId);
  if (!el) return;
  const clickable  = opts.clickable  || false;
  const small      = opts.small      || false;
  const colorMode  = opts.colorMode  || 'binary';
  const onCellClick = opts.onCellClick;
  const onCellHover = opts.onCellHover;

  el.style.gridTemplateColumns = 'repeat(' + matrix[0].length + ', 1fr)';
  if (small) el.classList.add('small');
  el.innerHTML = '';

  matrix.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (clickable) cell.classList.add('clickable');
      if (colorMode === 'binary') {
        cell.classList.add(val ? 'val-1' : 'val-0');
      } else if (colorMode === 'signed') {
        cell.classList.add(val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      } else {
        cell.classList.add('val-0');
      }
      cell.textContent = fmt(val);
      if (clickable && onCellClick) cell.addEventListener('click', function() { onCellClick(i, j, cell); });
      if (onCellHover) cell.addEventListener('mouseenter', function() { onCellHover(i, j); });
      el.appendChild(cell);
    });
  });
}

function renderVector(containerId, vec, opts) {
  opts = opts || {};
  const el = document.getElementById(containerId);
  if (!el) return;
  const small     = opts.small     || false;
  const colorMode = opts.colorMode || 'signed';
  if (small) el.classList.add('small');
  el.innerHTML = '';
  vec.forEach(function(v, i) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (colorMode === 'binary') cell.classList.add(v ? 'val-1' : 'val-0');
    else cell.classList.add(v > 0 ? 'val-pos' : v < 0 ? 'val-neg' : 'val-0');
    cell.textContent = fmt(v);
    el.appendChild(cell);
  });
}

function renderNumberMatrix(containerId, matrix, opts) {
  opts = opts || {};
  const el = document.getElementById(containerId);
  if (!el) return;
  const colorMode = opts.colorMode || 'signed';
  const small     = opts.small     || false;
  el.style.gridTemplateColumns = 'repeat(' + matrix[0].length + ', 1fr)';
  if (small) el.classList.add('small');
  el.innerHTML = '';
  matrix.forEach(function(row) {
    row.forEach(function(val) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (colorMode === 'binary') cell.classList.add(val ? 'val-1' : 'val-0');
      else cell.classList.add(val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      cell.textContent = fmt(val);
      el.appendChild(cell);
    });
  });
}

// --- Step 0: Input -----------------------------------------------------------
function renderStep0() {
  renderGrid('input-grid', inputMatrix, {
    clickable: true,
    colorMode: 'binary',
    onCellClick: function(i, j) {
      inputMatrix[i][j] = inputMatrix[i][j] ? 0 : 1;
      recompute();
      renderStep0();
    },
  });
  renderNumberMatrix('input-matrix-display', inputMatrix, { colorMode: 'binary' });
}

document.getElementById('btn-clear').addEventListener('click', function() {
  inputMatrix = Array.from({length: ROWS}, function() { return Array(COLS).fill(0); });
  recompute(); renderStep0();
});
document.getElementById('btn-random').addEventListener('click', function() {
  inputMatrix = Array.from({length: ROWS}, function() {
    return Array.from({length: COLS}, function() { return Math.random() > 0.5 ? 1 : 0; });
  });
  recompute(); renderStep0();
});
document.getElementById('btn-preset-edge').addEventListener('click', function() {
  inputMatrix = [
    [1,1,1,1,1],
    [0,0,0,0,0],
    [1,1,1,1,1],
    [0,0,0,0,0],
    [1,1,1,1,1],
  ];
  recompute(); renderStep0();
});
document.getElementById('btn-preset-cross').addEventListener('click', function() {
  inputMatrix = [
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ];
  recompute(); renderStep0();
});

// --- Step 1: Convolution -----------------------------------------------------
function renderStep1() {
  renderGrid('conv-input-grid', inputMatrix, { colorMode: 'binary', small: true });

  const kEl = document.getElementById('kernel-grid');
  kEl.style.gridTemplateColumns = 'repeat(' + kernel[0].length + ', 1fr)';
  kEl.innerHTML = '';
  kernel.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      cell.className = 'cell clickable editable-k';
      cell.classList.add(val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      cell.textContent = fmt(val);
      cell.title = 'Click to cycle value';
      cell.addEventListener('click', function() {
        const cycle = [-2, -1, 0, 1, 2];
        const idx = cycle.indexOf(kernel[i][j]);
        kernel[i][j] = cycle[(idx + 1) % cycle.length];
        recompute();
        renderStep1();
      });
      kEl.appendChild(cell);
    });
  });

  const outEl = document.getElementById('conv-output-grid');
  outEl.style.gridTemplateColumns = 'repeat(' + featureMap[0].length + ', 1fr)';
  outEl.innerHTML = '';
  featureMap.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      cell.className = 'cell clickable';
      cell.classList.add(val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      cell.textContent = fmt(val);
      cell.addEventListener('click',      function() { showConvDetail(i, j); });
      cell.addEventListener('mouseenter', function() { showConvDetail(i, j); });
      outEl.appendChild(cell);
    });
  });
}

function showConvDetail(oi, oj) {
  document.getElementById('conv-detail').classList.remove('hidden');
  document.getElementById('conv-pos').textContent = '(' + oi + ', ' + oj + ')';

  const terms = [];
  let sum = 0;
  kernel.forEach(function(krow, m) {
    krow.forEach(function(kval, n) {
      const xval = inputMatrix[oi+m][oj+n];
      const prod = round2(xval * kval);
      sum = round2(sum + prod);
      // Double backslash needed in JS strings for LaTeX commands
      terms.push('X_{' + (oi+m) + ',' + (oj+n) + '} \\cdot K_{' + m + ',' + n + '}\\;(' + xval + '\\cdot' + kval + '=' + prod + ')');
    });
  });

  const latex = '\\begin{aligned} Z_{' + oi + ',' + oj + '} &= ' + terms.join(' \\\\ &\\quad + ') + ' \\\\ &= \\boldsymbol{' + round2(sum) + '} \\end{aligned}';
  renderMath(document.getElementById('conv-detail-content'), latex, true);
}

document.getElementById('btn-kernel-edge-h').addEventListener('click', function() {
  kernel = [[-1,-1,-1],[0,0,0],[1,1,1]]; recompute(); renderStep1();
});
document.getElementById('btn-kernel-edge-v').addEventListener('click', function() {
  kernel = [[-1,0,1],[-2,0,2],[-1,0,1]]; recompute(); renderStep1();
});
document.getElementById('btn-kernel-sharpen').addEventListener('click', function() {
  kernel = [[0,-1,0],[-1,5,-1],[0,-1,0]]; recompute(); renderStep1();
});
document.getElementById('btn-kernel-blur').addEventListener('click', function() {
  kernel = [[1,1,1],[1,1,1],[1,1,1]]; recompute(); renderStep1();
});

// --- Step 2: ReLU ------------------------------------------------------------
function renderStep2() {
  const rIn = document.getElementById('relu-input-grid');
  rIn.style.gridTemplateColumns = 'repeat(' + featureMap[0].length + ', 1fr)';
  rIn.innerHTML = '';
  featureMap.forEach(function(row) {
    row.forEach(function(val) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + (val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      cell.textContent = fmt(val);
      rIn.appendChild(cell);
    });
  });

  const rOut = document.getElementById('relu-output-grid');
  rOut.style.gridTemplateColumns = 'repeat(' + reluMap[0].length + ', 1fr)';
  rOut.innerHTML = '';
  featureMap.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      const was_negative = val < 0;
      cell.className = 'cell ' + (was_negative ? 'relu-killed' : 'relu-pass');
      cell.textContent = fmt(reluMap[i][j]);
      cell.title = was_negative
        ? fmt(val) + ' -> 0 (zeroed by ReLU)'
        : fmt(val) + ' -> ' + fmt(val) + ' (passed through)';
      rOut.appendChild(cell);
    });
  });

  renderNumberMatrix('relu-z-matrix', featureMap, { colorMode: 'signed', small: true });
  renderNumberMatrix('relu-a-matrix', reluMap,    { colorMode: 'signed', small: true });
}

// --- Step 3: Max Pooling -----------------------------------------------------
function renderStep3() {
  const pIn = document.getElementById('pool-input-grid');
  pIn.style.gridTemplateColumns = 'repeat(' + reluMap[0].length + ', 1fr)';
  pIn.innerHTML = '';
  reluMap.forEach(function(row) {
    row.forEach(function(val) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + (val > 0 ? 'val-pos' : 'val-0');
      cell.textContent = fmt(val);
      pIn.appendChild(cell);
    });
  });

  const pOut = document.getElementById('pool-output-grid');
  pOut.style.gridTemplateColumns = 'repeat(' + poolMap[0].length + ', 1fr)';
  pOut.innerHTML = '';
  poolMap.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      cell.className = 'cell pool-max clickable';
      cell.textContent = fmt(val);
      cell.addEventListener('mouseenter', function() { showPoolDetail(i, j); });
      pOut.appendChild(cell);
    });
  });
}

function showPoolDetail(oi, oj) {
  const stride = 1, kSize = 2;
  document.getElementById('pool-detail').classList.remove('hidden');
  document.getElementById('pool-pos').textContent = '(' + oi + ', ' + oj + ')';

  const vals = [];
  for (let m = 0; m < kSize; m++)
    for (let n = 0; n < kSize; n++)
      vals.push({ r: oi*stride+m, c: oj*stride+n, v: reluMap[oi*stride+m][oj*stride+n] });

  const maxV = Math.max.apply(null, vals.map(function(x) { return x.v; }));
  const comparisons = vals.map(function(x) {
    return 'A_{' + x.r + ',' + x.c + '}=' + fmt(x.v) + (x.v === maxV ? '\\;(\\leftarrow\\text{max})' : '');
  }).join(',\\quad ');
  const latex = '\\text{compare:}\\; ' + comparisons + ' \\;\\Rightarrow\\; P_{' + oi + ',' + oj + '} = \\boldsymbol{' + fmt(maxV) + '}';
  renderMath(document.getElementById('pool-detail-content'), latex, true);
}

// --- Step 4: Flatten ---------------------------------------------------------
function renderStep4() {
  const fIn = document.getElementById('flatten-input-grid');
  fIn.style.gridTemplateColumns = 'repeat(' + poolMap[0].length + ', 1fr)';
  fIn.innerHTML = '';
  poolMap.forEach(function(row, i) {
    row.forEach(function(val, j) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + (val > 0 ? 'val-pos' : 'val-0');
      cell.textContent = fmt(val);
      const idx = i * poolMap[0].length + j;
      cell.title = '-> v[' + idx + ']';
      fIn.appendChild(cell);
    });
  });

  const fVec = document.getElementById('flatten-vector');
  fVec.innerHTML = '';
  flatVec.forEach(function(val, idx) {
    const cell = document.createElement('div');
    cell.className = 'cell ' + (val > 0 ? 'val-pos' : 'val-0');
    cell.style.cssText = 'width:120px;height:32px;font-size:0.78rem;';
    cell.textContent = 'v[' + idx + '] = ' + fmt(val);
    fVec.appendChild(cell);
  });
}

// --- Step 5: FC Layer --------------------------------------------------------
function renderStep5() {
  const wEl = document.getElementById('fc-weight-grid');
  wEl.style.gridTemplateColumns = 'repeat(' + fcWeights[0].length + ', 1fr)';
  wEl.innerHTML = '';
  fcWeights.forEach(function(row) {
    row.forEach(function(val) {
      const cell = document.createElement('div');
      cell.className = 'cell fc-cell ' + (val > 0 ? 'val-pos' : val < 0 ? 'val-neg' : 'val-0');
      cell.textContent = fmt(val);
      wEl.appendChild(cell);
    });
  });

  renderVector('fc-vector-display', flatVec, { small: true, colorMode: 'signed' });
  renderVector('fc-bias-display',   fcBias,  { small: true, colorMode: 'signed' });
  renderVector('fc-logits-display', logits,  { small: true, colorMode: 'signed' });

  const barsEl = document.getElementById('softmax-bars');
  barsEl.innerHTML = '';
  softmaxOut.forEach(function(p, i) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML =
      '<span class="bar-label">' + CLASS_LABELS[i] + '</span>' +
      '<div class="bar-track">' +
        '<div class="bar-fill" style="width:' + (p*100).toFixed(1) + '%">' +
          (p > 0.12 ? (p*100).toFixed(1) + '%' : '') +
        '</div>' +
      '</div>' +
      '<span class="bar-pct">' + (p*100).toFixed(1) + '%</span>';
    barsEl.appendChild(row);
  });

  // FC detail: render each neuron's dot product as LaTeX inline
  const fcEl = document.getElementById('fc-detail-content');
  fcEl.innerHTML = '';
  fcWeights.forEach(function(row, k) {
    const termParts = row.map(function(w, j) {
      return fmt(w) + ' \\cdot ' + fmt(flatVec[j]);
    });
    const latex = '\\textbf{' + CLASS_LABELS[k] + '}:\\; z_' + k + ' = ' +
      termParts.join(' + ') + ' + ' + fmt(fcBias[k]) +
      ' = \\boldsymbol{' + fmt(logits[k]) + '}' +
      ' \\;\\rightarrow\\; \\hat{y}_' + k + ' = \\boldsymbol{' + (softmaxOut[k]*100).toFixed(1) + '\\%}';

    const div = document.createElement('div');
    div.className = 'fc-row-detail';
    fcEl.appendChild(div);
    renderMath(div, latex, false);
  });
}

// --- Step navigation ---------------------------------------------------------
const panels   = document.querySelectorAll('.step-panel');
const stepBtns = document.querySelectorAll('.step-btn');

function goToStep(s) {
  currentStep = clamp(s, 0, TOTAL_STEPS - 1);

  panels.forEach(function(p, i)   { p.classList.toggle('active', i === currentStep); });
  stepBtns.forEach(function(b, i) { b.classList.toggle('active', i === currentStep); });

  document.getElementById('btn-prev').disabled = currentStep === 0;
  document.getElementById('btn-next').disabled = currentStep === TOTAL_STEPS - 1;
  document.getElementById('step-indicator').textContent = 'Step ' + (currentStep + 1) + ' / ' + TOTAL_STEPS;

  const renders = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];
  renders[currentStep]();
  typeset(panels[currentStep]);
}

document.getElementById('btn-prev').addEventListener('click', function() { goToStep(currentStep - 1); });
document.getElementById('btn-next').addEventListener('click', function() { goToStep(currentStep + 1); });
stepBtns.forEach(function(btn, i) { btn.addEventListener('click', function() { goToStep(i); }); });

// --- Boot --------------------------------------------------------------------
recompute();

// The MathJax script is loaded async, so MathJax.typesetPromise may not exist
// yet when this file runs. Poll until it is available, then mark ready and
// render. This guarantees renderMath() uses the real typeset path, not the
// raw-text fallback.
function _whenMathJaxReady(cb) {
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(cb).catch(cb);
    return;
  }
  if (window.MathJax && MathJax.typesetPromise) {
    cb();
    return;
  }
  // Not loaded yet — poll.
  let tries = 0;
  const timer = setInterval(function() {
    tries++;
    if (window.MathJax && MathJax.typesetPromise) {
      clearInterval(timer);
      cb();
    } else if (tries > 200) { // ~10s timeout
      clearInterval(timer);
      cb(); // give up waiting, render anyway
    }
  }, 50);
}

_whenMathJaxReady(function() {
  _flushMjQueue();
  goToStep(0);
});

// Render step 0 immediately too (grids), so UI isn't blank while MathJax loads.
// _mjReady is still false here, so math goes to the queue and is flushed above.
goToStep(0);
