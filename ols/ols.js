/**
 * Ordinary Least Squares (OLS) Interactive Deep Dive
 * Vanilla Javascript implementing OLS from scratch.
 * - Dynamic SVG scatter plot (add, drag, delete points)
 * - Step-by-step math solver (analytical tabular formulation)
 * - 2D Loss surface canvas + Gradient descent animation
 * - Design matrices visualization
 * - Normal equation matrix arithmetic
 * - Diagnostic plots & statistical evaluations (R^2, Residual plots)
 */

(function () {
  // ─── STATE MANAGEMENT ───
  let points = [
    { x: 2.0, y: 3.0, id: 1 },
    { x: 4.0, y: 5.0, id: 2 },
    { x: 5.0, y: 4.0, id: 3 },
    { x: 7.0, y: 8.0, id: 4 },
    { x: 8.0, y: 7.0, id: 5 }
  ];
  let pointIdCounter = 6;

  // Manual Candidate Line state
  let candidate = { m: 0.8, c: 1.5 };

  // Optimal analytical OLS parameters
  let optimal = { beta1: 0, beta0: 0, ssr: 0 };

  // Navigation state
  let activeStep = 0;
  const TOTAL_STEPS = 6;

  // Gradient Descent state
  let gd = {
    running: false,
    interval: null,
    beta0: 0, // Intercept
    beta1: 0, // Slope
    path: []   // array of {beta0, beta1}
  };

  // SVG Coordinates translation helpers
  const svgWidth = 500;
  const svgHeight = 400;
  const padding = { top: 30, right: 30, bottom: 40, left: 40 };

  // ─── INIT & DOM REFERENCES ───
  document.addEventListener('DOMContentLoaded', () => {
    initPipeline();
    setupPlaygroundSVG();
    setupSliders();
    setupControls();
    setupGDControls();
    
    // Initial math calculations and renders
    recalculateOLS();
    syncUI();
  });

  // ─── PIPELINE NAVIGATION ───
  function initPipeline() {
    const stepBtns = document.querySelectorAll('.step-btn');
    stepBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => goToStep(idx));
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
      if (activeStep > 0) goToStep(activeStep - 1);
    });
    document.getElementById('btn-next').addEventListener('click', () => {
      if (activeStep < TOTAL_STEPS - 1) goToStep(activeStep + 1);
    });
  }

  function goToStep(stepIdx) {
    if (stepIdx < 0 || stepIdx >= TOTAL_STEPS) return;
    
    // Stop gradient descent if running when leaving the step
    if (activeStep === 2 && stepIdx !== 2) {
      stopGradientDescent();
    }

    activeStep = stepIdx;

    // Update active tab buttons
    document.querySelectorAll('.step-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === stepIdx);
    });

    // Show active panel
    document.querySelectorAll('.step-panel').forEach((panel, idx) => {
      panel.classList.toggle('active', idx === stepIdx);
    });

    // Update navigation controls
    document.getElementById('btn-prev').disabled = (stepIdx === 0);
    document.getElementById('btn-next').disabled = (stepIdx === TOTAL_STEPS - 1);
    document.getElementById('step-indicator').textContent = `Step ${stepIdx + 1} / ${TOTAL_STEPS}`;

    // Perform step-specific triggers
    triggerStepRender(stepIdx);
  }

  function triggerStepRender(stepIdx) {
    if (stepIdx === 2) {
      // Step 3: Draw Loss Surface
      drawLossSurface();
    } else if (stepIdx === 5) {
      // Step 6: Diagnostics
      renderDiagnostics();
    }
    
    // Trigger LaTeX typesetting for MathJax on step transitions to prevent layout bugs
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }

  // ─── SLIDERS & USER INTERACTION ───
  function setupSliders() {
    const slopeSlider = document.getElementById('slope-slider');
    const interceptSlider = document.getElementById('intercept-slider');

    slopeSlider.addEventListener('input', (e) => {
      candidate.m = parseFloat(e.target.value);
      document.getElementById('slope-val').textContent = candidate.m.toFixed(2);
      onCandidateLineChanged();
    });

    interceptSlider.addEventListener('input', (e) => {
      candidate.c = parseFloat(e.target.value);
      document.getElementById('intercept-val').textContent = candidate.c.toFixed(2);
      onCandidateLineChanged();
    });
  }

  function setupControls() {
    document.getElementById('btn-reset-points').addEventListener('click', () => {
      points = [
        { x: 2.0, y: 3.0, id: 1 },
        { x: 4.0, y: 5.0, id: 2 },
        { x: 5.0, y: 4.0, id: 3 },
        { x: 7.0, y: 8.0, id: 4 },
        { x: 8.0, y: 7.0, id: 5 }
      ];
      pointIdCounter = 6;
      recalculateOLS();
    });

    document.getElementById('btn-clear-points').addEventListener('click', () => {
      points = [];
      recalculateOLS();
    });

    document.getElementById('btn-preset-linear').addEventListener('click', () => {
      points = [
        { x: 1.0, y: 2.0, id: 1 },
        { x: 3.0, y: 4.0, id: 2 },
        { x: 5.0, y: 6.0, id: 3 },
        { x: 7.0, y: 8.0, id: 4 },
        { x: 9.0, y: 10.0, id: 5 }
      ];
      pointIdCounter = 6;
      recalculateOLS();
    });

    document.getElementById('btn-preset-outlier').addEventListener('click', () => {
      points = [
        { x: 2.0, y: 3.0, id: 1 },
        { x: 4.0, y: 5.0, id: 2 },
        { x: 5.0, y: 4.0, id: 3 },
        { x: 7.0, y: 8.0, id: 4 },
        { x: 8.0, y: 1.0, id: 5 } // Classic outlier
      ];
      pointIdCounter = 6;
      recalculateOLS();
    });
  }

  function setupGDControls() {
    document.getElementById('btn-run-gd').addEventListener('click', startGradientDescent);
    document.getElementById('btn-stop-gd').addEventListener('click', stopGradientDescent);
    document.getElementById('btn-reset-gd').addEventListener('click', () => {
      gd.path = [];
      gd.beta0 = candidate.c;
      gd.beta1 = candidate.m;
      drawLossSurface();
    });

    // Click on loss canvas to move candidate point
    const lossCanvas = document.getElementById('loss-canvas');
    lossCanvas.addEventListener('mousedown', (e) => {
      const rect = lossCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Translate canvas px to intercepts/slopes
      // Canvas Intercept: horizontal, min=-3, max=13
      // Canvas Slope: vertical, min=-3, max=3 (flipped because y goes down)
      const c = -3.0 + (clickX / rect.width) * 16.0;
      const m = 3.0 - (clickY / rect.height) * 6.0;

      // Update candidate & sliders
      candidate.c = Math.max(-3, Math.min(13, c));
      candidate.m = Math.max(-3, Math.min(3, m));

      document.getElementById('slope-slider').value = candidate.m;
      document.getElementById('slope-val').textContent = candidate.m.toFixed(2);
      document.getElementById('intercept-slider').value = candidate.c;
      document.getElementById('intercept-val').textContent = candidate.c.toFixed(2);

      gd.beta0 = candidate.c;
      gd.beta1 = candidate.m;
      gd.path = [];

      onCandidateLineChanged();
      if (activeStep === 2) drawLossSurface();
    });
  }

  // ─── COORDINATE TRANSLATION HELPERS ───
  function mathToScreen(x, y) {
    const screenX = padding.left + (x / 10) * (svgWidth - padding.left - padding.right);
    const screenY = svgHeight - padding.bottom - (y / 10) * (svgHeight - padding.top - padding.bottom);
    return { x: screenX, y: screenY };
  }

  function screenToMath(screenX, screenY) {
    let x = ((screenX - padding.left) / (svgWidth - padding.left - padding.right)) * 10;
    let y = ((svgHeight - padding.bottom - screenY) / (svgHeight - padding.top - padding.bottom)) * 10;
    // Clamp to boundaries
    x = Math.max(0, Math.min(10, x));
    y = Math.max(0, Math.min(10, y));
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  }

  // ─── PLAYGROUND SVG SETUP & DRAG-AND-DROP ───
  let dragPointId = null;

  function setupPlaygroundSVG() {
    const svg = document.getElementById('playground-svg');
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    
    // Background click sensor
    bgRect.setAttribute('width', svgWidth);
    bgRect.setAttribute('height', svgHeight);
    bgRect.setAttribute('fill', 'transparent');
    bgRect.addEventListener('mousedown', (e) => {
      if (e.target === bgRect) {
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const mathPt = screenToMath(px, py);
        
        // Add point
        points.push({ x: mathPt.x, y: mathPt.y, id: pointIdCounter++ });
        recalculateOLS();
      }
    });
    svg.insertBefore(bgRect, svg.firstChild);

    // Mouse Move & Up listeners on document to handle robust dragging
    document.addEventListener('mousemove', (e) => {
      if (dragPointId !== null) {
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const mathPt = screenToMath(px, py);

        // Update point coords
        const pt = points.find(p => p.id === dragPointId);
        if (pt) {
          pt.x = mathPt.x;
          pt.y = mathPt.y;
          recalculateOLS();
        }
      }
    });

    document.addEventListener('mouseup', () => {
      dragPointId = null;
    });

    // Render Grid lines once
    const gridGroup = document.getElementById('grid-group');
    gridGroup.innerHTML = '';

    // Draw grid lines
    for (let i = 0; i <= 10; i++) {
      const vertical = mathToScreen(i, 0);
      const verticalTop = mathToScreen(i, 10);
      const horizontal = mathToScreen(0, i);
      const horizontalRight = mathToScreen(10, i);

      // X grid
      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', vertical.x);
      vLine.setAttribute('y1', vertical.y);
      vLine.setAttribute('x2', verticalTop.x);
      vLine.setAttribute('y2', verticalTop.y);
      vLine.setAttribute('class', i === 0 ? 'axis-line' : 'grid-line');
      gridGroup.appendChild(vLine);

      // Y grid
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', horizontal.x);
      hLine.setAttribute('y1', horizontal.y);
      hLine.setAttribute('x2', horizontalRight.x);
      hLine.setAttribute('y2', horizontalRight.y);
      hLine.setAttribute('class', i === 0 ? 'axis-line' : 'grid-line');
      gridGroup.appendChild(hLine);

      // X axis labels
      if (i > 0 && i < 10) {
        const xText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xText.setAttribute('x', vertical.x);
        xText.setAttribute('y', vertical.y + 18);
        xText.setAttribute('class', 'axis-label');
        xText.setAttribute('text-anchor', 'middle');
        xText.textContent = i;
        gridGroup.appendChild(xText);
      }

      // Y axis labels
      if (i > 0 && i < 10) {
        const yText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yText.setAttribute('x', horizontal.x - 10);
        yText.setAttribute('y', horizontal.y + 4);
        yText.setAttribute('class', 'axis-label');
        yText.setAttribute('text-anchor', 'end');
        yText.textContent = i;
        gridGroup.appendChild(yText);
      }
    }
  }

  // ─── MATHEMATICAL ENGINE ───
  function recalculateOLS() {
    const n = points.length;

    if (n < 2) {
      optimal.beta1 = 0;
      optimal.beta0 = 0;
      optimal.ssr = 0;
    } else {
      let sumX = 0, sumY = 0;
      points.forEach(p => { sumX += p.x; sumY += p.y; });
      const meanX = sumX / n;
      const meanY = sumY / n;

      let num = 0; // Covariance numerator
      let den = 0; // Variance denominator (for x)
      points.forEach(p => {
        num += (p.x - meanX) * (p.y - meanY);
        den += Math.pow(p.x - meanX, 2);
      });

      if (den === 0) {
        optimal.beta1 = 0;
      } else {
        optimal.beta1 = num / den;
      }
      optimal.beta0 = meanY - optimal.beta1 * meanX;

      // Compute optimal SSR
      let ssr = 0;
      points.forEach(p => {
        const pred = optimal.beta1 * p.x + optimal.beta0;
        ssr += Math.pow(p.y - pred, 2);
      });
      optimal.ssr = ssr;
    }

    // Sync other components and variables
    onCandidateLineChanged();
    syncUI();
  }

  function onCandidateLineChanged() {
    let candidateSsr = 0;
    points.forEach(p => {
      const pred = candidate.m * p.x + candidate.c;
      candidateSsr += Math.pow(p.y - pred, 2);
    });

    // Update playground live loss comparison
    document.getElementById('candidate-ssr-val').textContent = candidateSsr.toFixed(2);
    document.getElementById('optimal-ssr-val').textContent = optimal.ssr.toFixed(2);

    const maxSsrVal = Math.max(candidateSsr, optimal.ssr, 10.0);
    const candWidth = (candidateSsr / maxSsrVal) * 100;
    const optWidth = (optimal.ssr / maxSsrVal) * 100;

    document.getElementById('candidate-ssr-bar').style.width = `${candWidth}%`;
    document.getElementById('optimal-ssr-bar').style.width = `${optWidth}%`;

    // Redraw lines on step 1
    renderPlaygroundLines();
  }

  // ─── RENDERING & UI SYNC ───
  function syncUI() {
    renderPlaygroundPoints();
    renderPlaygroundLines();

    // Trigger step updates depending on what's shown
    renderTabTabularSolver();
    renderTabMatrixForm();
    renderTabNormalEquation();
    
    if (activeStep === 2) drawLossSurface();
    if (activeStep === 5) renderDiagnostics();
  }

  function renderPlaygroundPoints() {
    const pointsGroup = document.getElementById('points-group');
    pointsGroup.innerHTML = '';

    points.forEach(p => {
      const pos = mathToScreen(p.x, p.y);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', '7');
      circle.setAttribute('class', 'data-point');
      circle.setAttribute('data-id', p.id);

      // Event: Drag point
      circle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        dragPointId = p.id;
      });

      // Event: Double click to delete
      circle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        points = points.filter(pt => pt.id !== p.id);
        recalculateOLS();
      });

      // Hover sync with step 2 (Table) & step 4 (Matrix)
      circle.addEventListener('mouseenter', () => {
        highlightPointRow(p.id, true);
      });
      circle.addEventListener('mouseleave', () => {
        highlightPointRow(p.id, false);
      });

      pointsGroup.appendChild(circle);
    });
  }

  function highlightPointRow(ptId, highlight) {
    // Highlight in Tabular solver (Step 2)
    const tableRow = document.getElementById(`row-${ptId}`);
    if (tableRow) tableRow.classList.toggle('row-highlighted', highlight);

    // Highlight in Matrix notation (Step 4)
    const matYRow = document.getElementById(`mat-y-row-${ptId}`);
    const matXRow = document.getElementById(`mat-x-row-${ptId}`);
    const matERow = document.getElementById(`mat-e-row-${ptId}`);
    if (matYRow) matYRow.classList.toggle('highlighted-row', highlight);
    if (matXRow) matXRow.classList.toggle('highlighted-row', highlight);
    if (matERow) matERow.classList.toggle('highlighted-row', highlight);

    // Highlight in SVG Point
    const ptCircle = document.querySelector(`circle[data-id="${ptId}"]`);
    if (ptCircle) ptCircle.classList.toggle('highlighted-pt', highlight);
  }

  function renderPlaygroundLines() {
    // 1. Draw optimal line
    const optLine = document.getElementById('optimal-line');
    if (points.length < 2) {
      optLine.setAttribute('x1', 0); optLine.setAttribute('y1', 0);
      optLine.setAttribute('x2', 0); optLine.setAttribute('y2', 0);
    } else {
      const p1 = mathToScreen(0, optimal.beta0);
      const p2 = mathToScreen(10, optimal.beta1 * 10 + optimal.beta0);
      optLine.setAttribute('x1', p1.x); optLine.setAttribute('y1', p1.y);
      optLine.setAttribute('x2', p2.x); optLine.setAttribute('y2', p2.y);
    }

    // 2. Draw candidate line
    const candLine = document.getElementById('candidate-line');
    const cp1 = mathToScreen(0, candidate.c);
    const cp2 = mathToScreen(10, candidate.m * 10 + candidate.c);
    candLine.setAttribute('x1', cp1.x); candLine.setAttribute('y1', cp1.y);
    candLine.setAttribute('x2', cp2.x); candLine.setAttribute('y2', cp2.y);

    // 3. Draw residual connectors
    const residualGroup = document.getElementById('residual-group');
    residualGroup.innerHTML = '';

    points.forEach(p => {
      const ptPos = mathToScreen(p.x, p.y);
      
      // Candidate residual line (vertical line to candidate regression line)
      const candYVal = candidate.m * p.x + candidate.c;
      const candLineYPos = mathToScreen(p.x, candYVal);

      const rCand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      rCand.setAttribute('x1', ptPos.x);
      rCand.setAttribute('y1', ptPos.y);
      rCand.setAttribute('x2', candLineYPos.x);
      rCand.setAttribute('y2', candLineYPos.y);
      rCand.setAttribute('class', 'residual-line candidate');
      residualGroup.appendChild(rCand);

      // Optimal residual line
      if (points.length >= 2) {
        const optYVal = optimal.beta1 * p.x + optimal.beta0;
        const optLineYPos = mathToScreen(p.x, optYVal);

        const rOpt = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rOpt.setAttribute('x1', ptPos.x);
        rOpt.setAttribute('y1', ptPos.y);
        rOpt.setAttribute('x2', optLineYPos.x);
        rOpt.setAttribute('y2', optLineYPos.y);
        rOpt.setAttribute('class', 'residual-line optimal');
        residualGroup.appendChild(rOpt);
      }
    });
  }

  // ─── STEP 2: TABULAR SOLVER RENDERING ───
  function renderTabTabularSolver() {
    const tableBody = document.querySelector('#covariance-table tbody');
    const tableFoot = document.querySelector('#covariance-table tfoot');
    tableBody.innerHTML = '';
    tableFoot.innerHTML = '';

    const n = points.length;
    if (n === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted)">No data points. Add some in Step 1!</td></tr>';
      return;
    }

    let sumX = 0, sumY = 0;
    points.forEach(p => { sumX += p.x; sumY += p.y; });
    const meanX = sumX / n;
    const meanY = sumY / n;

    let sumCov = 0;
    let sumVarX = 0;

    points.forEach((p, idx) => {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      const prod = dx * dy;
      const dx2 = dx * dx;

      sumCov += prod;
      sumVarX += dx2;

      const row = document.createElement('tr');
      row.id = `row-${p.id}`;
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${p.x.toFixed(2)}</td>
        <td>${p.y.toFixed(2)}</td>
        <td>${dx.toFixed(2)}</td>
        <td>${dy.toFixed(2)}</td>
        <td>${prod.toFixed(2)}</td>
        <td>${dx2.toFixed(2)}</td>
      `;

      row.addEventListener('mouseenter', () => highlightPointRow(p.id, true));
      row.addEventListener('mouseleave', () => highlightPointRow(p.id, false));

      tableBody.appendChild(row);
    });

    // Populate tfoot
    const footRow = document.createElement('tr');
    footRow.innerHTML = `
      <td>Sum (\(\sum\))</td>
      <td>${sumX.toFixed(2)}</td>
      <td>${sumY.toFixed(2)}</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>${sumCov.toFixed(2)}</td>
      <td>${sumVarX.toFixed(2)}</td>
    `;
    tableFoot.appendChild(footRow);

    // Render Averages below table
    const meanRow = document.createElement('tr');
    meanRow.style.background = 'transparent';
    meanRow.innerHTML = `
      <td>Averages</td>
      <td>\(\bar{x} = \) ${meanX.toFixed(2)}</td>
      <td>\(\bar{y} = \) ${meanY.toFixed(2)}</td>
      <td colspan="4" style="border:none"></td>
    `;
    tableFoot.appendChild(meanRow);

    // Update Direct Formulas Substitutions
    const b1_sub = document.getElementById('beta1-calc-sub');
    const b0_sub = document.getElementById('beta0-calc-sub');

    if (n < 2) {
      b1_sub.innerHTML = `Need at least 2 points to calculate regression.`;
      b0_sub.innerHTML = ``;
    } else {
      b1_sub.innerHTML = `Substitute values: \\[ \\beta_1 = \\frac{${sumCov.toFixed(2)}}{${sumVarX.toFixed(2)}} = \\mathbf{${optimal.beta1.toFixed(4)}} \\]`;
      b0_sub.innerHTML = `Substitute values: \\[ \\beta_0 = ${meanY.toFixed(2)} - (${optimal.beta1.toFixed(3)} \\cdot ${meanX.toFixed(2)}) = \\mathbf{${optimal.beta0.toFixed(4)}} \\]`;
    }
  }

  // ─── STEP 3: LOSS SURFACE & GRADIENT DESCENT ───
  function drawLossSurface() {
    const canvas = document.getElementById('loss-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Define Grid limits for drawing the canvas pixels
    // Intercept (beta0) on horizontal axis: from -3.0 to 13.0
    // Slope (beta1) on vertical axis: from -3.0 to 3.0
    const b0Min = -3.0, b0Max = 13.0;
    const b1Min = -3.0, b1Max = 3.0;

    const n = points.length;

    // Generate heatmap pixels
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Fast OLS helper
    if (n >= 1) {
      for (let py = 0; py < height; py++) {
        // Invert Y axis
        const beta1 = b1Max - (py / height) * (b1Max - b1Min);

        for (let px = 0; px < width; px++) {
          const beta0 = b0Min + (px / width) * (b0Max - b0Min);

          // Calculate SSR at (beta0, beta1)
          let loss = 0;
          for (let i = 0; i < n; i++) {
            const pred = beta1 * points[i].x + beta0;
            loss += Math.pow(points[i].y - pred, 2);
          }

          // Map loss to color scale (blue=low, magenta/red=high)
          // We apply a logarithmic or cubic power scale to make contours sharper near the minimum
          const normLoss = Math.min(1.0, Math.pow(loss / (n * 35), 0.5)); // Normalized loss

          const r = Math.floor(normLoss * 240);
          const g = Math.floor(Math.max(0, 30 - normLoss * 30));
          const b = Math.floor((1.0 - normLoss) * 180 + normLoss * 50);

          const idx = (py * width + px) * 4;
          data[idx] = r;      // R
          data[idx + 1] = g;  // G
          data[idx + 2] = b;  // B
          data[idx + 3] = 255;// Alpha
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Background gradient if no points
      ctx.fillStyle = '#161b22';
      ctx.fillRect(0, 0, width, height);
    }

    // Helper: translate mathematical values to canvas coordinates
    function getCanvasCoords(b0, b1) {
      const cx = ((b0 - b0Min) / (b0Max - b0Min)) * width;
      const cy = ((b1Max - b1) / (b1Max - b1Min)) * height;
      return { x: cx, y: cy };
    }

    // Draw contour lines if possible to represent gradient levels
    // (Instead of drawing expensive dynamic vector contours, we can draw a couple circles centered at optimal OLS minimum)
    if (n >= 2) {
      const minCoords = getCanvasCoords(optimal.beta0, optimal.beta1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let r = 20; r <= 150; r += 20) {
        ctx.beginPath();
        // Since parameters might scale unevenly, simple circles are fine for geometric representation
        ctx.arc(minCoords.x, minCoords.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshair at target (Optimal analytical OLS minimum)
      ctx.strokeStyle = '#2dd4bf'; // accent2
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Horizontal crosshair
      ctx.moveTo(minCoords.x - 12, minCoords.y);
      ctx.lineTo(minCoords.x + 12, minCoords.y);
      // Vertical crosshair
      ctx.moveTo(minCoords.x, minCoords.y - 12);
      ctx.lineTo(minCoords.x, minCoords.y + 12);
      ctx.stroke();

      // Outer circle for optimal target
      ctx.beginPath();
      ctx.arc(minCoords.x, minCoords.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#2dd4bf';
      ctx.fill();
    }

    // Draw manual candidate parameter point (Green dot)
    const candCoords = getCanvasCoords(candidate.c, candidate.m);
    ctx.fillStyle = '#7c83ff'; // var(--accent)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(candCoords.x, candCoords.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw Gradient Descent Path
    if (gd.path.length > 0) {
      ctx.strokeStyle = '#fbbf24'; // var(--highlight) (orange path)
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const start = getCanvasCoords(gd.path[0].beta0, gd.path[0].beta1);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < gd.path.length; i++) {
        const pt = getCanvasCoords(gd.path[i].beta0, gd.path[i].beta1);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Current running point of GD path if running
      const curPt = gd.path[gd.path.length - 1];
      const curCoords = getCanvasCoords(curPt.beta0, curPt.beta1);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(curCoords.x, curCoords.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function startGradientDescent() {
    if (gd.running || points.length < 2) return;

    gd.running = true;
    document.getElementById('btn-run-gd').disabled = true;
    document.getElementById('btn-stop-gd').disabled = false;

    // Initialize gradient descent position to the current manual candidate line parameters
    if (gd.path.length === 0) {
      gd.beta0 = candidate.c;
      gd.beta1 = candidate.m;
      gd.path.push({ beta0: gd.beta0, beta1: gd.beta1 });
    }

    // Gradient descent hyper-parameter
    // Since input coordinates are around [0, 10], learning rate needs to be carefully chosen
    const alpha = 0.015; 
    const n = points.length;

    gd.interval = setInterval(() => {
      // Compute partial derivatives
      // Loss L = sum (y_i - (beta1 * x_i + beta0))^2
      // dL/d_beta0 = -2/n * sum (y_i - (beta1 * x_i + beta0))
      // dL/d_beta1 = -2/n * sum (y_i - (beta1 * x_i + beta0)) * x_i
      let gradBeta0 = 0;
      let gradBeta1 = 0;

      for (let i = 0; i < n; i++) {
        const p = points[i];
        const error = p.y - (gd.beta1 * p.x + gd.beta0);
        gradBeta0 += -error;
        gradBeta1 += -error * p.x;
      }

      gradBeta0 = (2 / n) * gradBeta0;
      gradBeta1 = (2 / n) * gradBeta1;

      // Update parameters
      gd.beta0 = gd.beta0 - alpha * gradBeta0;
      gd.beta1 = gd.beta1 - alpha * gradBeta1;

      gd.path.push({ beta0: gd.beta0, beta1: gd.beta1 });

      // Live update of candidate line visually
      candidate.c = gd.beta0;
      candidate.m = gd.beta1;
      
      // Update inputs (without calling full render loops to keep performance clean)
      document.getElementById('slope-slider').value = candidate.m;
      document.getElementById('slope-val').textContent = candidate.m.toFixed(2);
      document.getElementById('intercept-slider').value = candidate.c;
      document.getElementById('intercept-val').textContent = candidate.c.toFixed(2);

      onCandidateLineChanged();
      drawLossSurface();

      // Convergence criteria: stop if gradient is extremely tiny, or limit reached
      const gradMagnitude = Math.sqrt(gradBeta0 * gradBeta0 + gradBeta1 * gradBeta1);
      if (gradMagnitude < 0.001 || gd.path.length > 500) {
        stopGradientDescent();
      }
    }, 50); // animate every 50ms
  }

  function stopGradientDescent() {
    gd.running = false;
    clearInterval(gd.interval);
    document.getElementById('btn-run-gd').disabled = false;
    document.getElementById('btn-stop-gd').disabled = true;
  }

  // ─── STEP 4: MATRIX FORM RENDERING ───
  function renderTabMatrixForm() {
    const matrixY = document.getElementById('matrix-y');
    const matrixX = document.getElementById('matrix-x');
    const matrixBeta = document.getElementById('matrix-beta');
    const matrixE = document.getElementById('matrix-e');

    if (!matrixY) return;

    const n = points.length;
    if (n === 0) {
      matrixY.innerHTML = 'Empty';
      matrixX.innerHTML = 'Empty';
      matrixBeta.innerHTML = 'Empty';
      matrixE.innerHTML = 'Empty';
      return;
    }

    // 1. Vector y
    let htmlY = '';
    points.forEach(p => {
      htmlY += `<div class="matrix-row" id="mat-y-row-${p.id}"><div class="matrix-cell">${p.y.toFixed(1)}</div></div>`;
    });
    matrixY.innerHTML = htmlY;

    // 2. Design Matrix X
    let htmlX = '';
    points.forEach(p => {
      htmlX += `<div class="matrix-row" id="mat-x-row-${p.id}">
        <div class="matrix-cell">1.0</div>
        <div class="matrix-cell">${p.x.toFixed(1)}</div>
      </div>`;
    });
    matrixX.innerHTML = htmlX;

    // 3. Coefficients Vector Beta
    matrixBeta.innerHTML = `
      <div class="matrix-row">
        <div class="matrix-cell" title="Intercept (beta_0)">\\(\\beta_0 = \\) ${optimal.beta0.toFixed(2)}</div>
      </div>
      <div class="matrix-row">
        <div class="matrix-cell" title="Slope (beta_1)">\\(\\beta_1 = \\) ${optimal.beta1.toFixed(2)}</div>
      </div>
    `;

    // 4. Residual Vector Epsilon
    let htmlE = '';
    points.forEach(p => {
      const pred = optimal.beta1 * p.x + optimal.beta0;
      const res = p.y - pred;
      htmlE += `<div class="matrix-row" id="mat-e-row-${p.id}"><div class="matrix-cell">${res.toFixed(2)}</div></div>`;
    });
    matrixE.innerHTML = htmlE;

    // Attach mouse listeners to matrix rows for visual sync
    points.forEach(p => {
      const ptId = p.id;
      const matYRow = document.getElementById(`mat-y-row-${ptId}`);
      const matXRow = document.getElementById(`mat-x-row-${ptId}`);
      const matERow = document.getElementById(`mat-e-row-${ptId}`);

      const triggerHighlight = (highlight) => {
        highlightPointRow(ptId, highlight);
      };

      [matYRow, matXRow, matERow].forEach(el => {
        if (el) {
          el.addEventListener('mouseenter', () => triggerHighlight(true));
          el.addEventListener('mouseleave', () => triggerHighlight(false));
        }
      });
    });
  }

  // ─── STEP 5: NORMAL EQUATION MATRIX ARITHMETIC ───
  function renderTabNormalEquation() {
    const n = points.length;
    
    const matXTX = document.getElementById('matrix-xtx');
    const matXTXInv = document.getElementById('matrix-xtx-inv');
    const matXTy = document.getElementById('matrix-xty');
    const matBetaSolved = document.getElementById('matrix-beta-solved');

    if (!matXTX) return;

    if (n < 2) {
      matXTX.innerHTML = 'Matrix undefined';
      matXTXInv.innerHTML = 'Matrix undefined';
      matXTy.innerHTML = 'Matrix undefined';
      matBetaSolved.innerHTML = 'Matrix undefined';
      return;
    }

    // 1. Calculate X^T X
    // X^T X = [[n, sum(x)], [sum(x), sum(x^2)]]
    let sumX = 0;
    let sumX2 = 0;
    let sumY = 0;
    let sumXY = 0;

    points.forEach(p => {
      sumX += p.x;
      sumX2 += p.x * p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
    });

    const xtx_00 = n;
    const xtx_01 = sumX;
    const xtx_10 = sumX;
    const xtx_11 = sumX2;

    matXTX.innerHTML = `
      <div class="matrix-row">
        <div class="matrix-cell">${xtx_00.toFixed(1)}</div>
        <div class="matrix-cell">${xtx_01.toFixed(1)}</div>
      </div>
      <div class="matrix-row">
        <div class="matrix-cell">${xtx_10.toFixed(1)}</div>
        <div class="matrix-cell">${xtx_11.toFixed(1)}</div>
      </div>
    `;

    // 2. Invert X^T X
    // Det = ad - bc
    const det = xtx_00 * xtx_11 - xtx_01 * xtx_10;
    document.getElementById('determinant-val').textContent = det.toFixed(2);

    if (det === 0) {
      matXTXInv.innerHTML = 'Singular matrix (No inverse!)';
    } else {
      const inv_00 = xtx_11 / det;
      const inv_01 = -xtx_01 / det;
      const inv_10 = -xtx_10 / det;
      const inv_11 = xtx_00 / det;

      matXTXInv.innerHTML = `
        <div class="matrix-row">
          <div class="matrix-cell">${inv_00.toFixed(4)}</div>
          <div class="matrix-cell">${inv_01.toFixed(4)}</div>
        </div>
        <div class="matrix-row">
          <div class="matrix-cell">${inv_10.toFixed(4)}</div>
          <div class="matrix-cell">${inv_11.toFixed(4)}</div>
        </div>
      `;

      // 3. X^T y = [[sum(y)], [sum(xy)]]
      const xty_0 = sumY;
      const xty_1 = sumXY;

      matXTy.innerHTML = `
        <div class="matrix-row">
          <div class="matrix-cell">${xty_0.toFixed(1)}</div>
        </div>
        <div class="matrix-row">
          <div class="matrix-cell">${xty_1.toFixed(1)}</div>
        </div>
      `;

      // 4. Beta solved: (X^T X)^-1 * (X^T y)
      const b0 = inv_00 * xty_0 + inv_01 * xty_1;
      const b1 = inv_10 * xty_0 + inv_11 * xty_1;

      matBetaSolved.innerHTML = `
        <div class="matrix-row">
          <div class="matrix-cell" title="Beta_0 solved">${b0.toFixed(4)}</div>
        </div>
        <div class="matrix-row">
          <div class="matrix-cell" title="Beta_1 solved">${b1.toFixed(4)}</div>
        </div>
      `;

      // Show values validation check
      document.getElementById('matrix-beta0-val').textContent = b0.toFixed(4);
      document.getElementById('matrix-beta1-val').textContent = b1.toFixed(4);
    }
  }

  // ─── STEP 6: DIAGNOSTICS RENDERING ───
  function renderDiagnostics() {
    const n = points.length;
    
    // Select SVG elements
    const resSvg = document.getElementById('diag-residual-svg');
    const histSvg = document.getElementById('diag-hist-svg');

    if (!resSvg || !histSvg) return;

    if (n < 2) {
      // Undefined state warning inside SVGs
      resSvg.innerHTML = `<text x="170" y="130" text-anchor="middle" fill="var(--text-muted)">Need 2+ points</text>`;
      histSvg.innerHTML = `<text x="170" y="130" text-anchor="middle" fill="var(--text-muted)">Need 2+ points</text>`;
      return;
    }

    // Prepare Diagnostic data
    const fittedVals = [];
    const residuals = [];
    let ssRes = 0;
    let ssTot = 0;

    let sumY = 0;
    points.forEach(p => sumY += p.y);
    const meanY = sumY / n;

    points.forEach(p => {
      const fitted = optimal.beta1 * p.x + optimal.beta0;
      const residual = p.y - fitted;
      fittedVals.push(fitted);
      residuals.push(residual);

      ssRes += Math.pow(residual, 2);
      ssTot += Math.pow(p.y - meanY, 2);
    });

    const r2 = ssTot === 0 ? 1.0 : (1.0 - (ssRes / ssTot));
    const pVal = 1; // 1 predictor
    const adjR2 = 1.0 - (1.0 - r2) * ((n - 1) / (n - pVal - 1));

    // Update stats explanations in step sidebar
    const stepSidebar = document.querySelector('.diagnostics-explanation');
    if (stepSidebar) {
      stepSidebar.querySelector('.metric-block:nth-of-type(1) .formula-box').innerHTML = `
        \\[ R^2 = 1 - \\frac{${ssRes.toFixed(2)}}{${ssTot.toFixed(2)}} = \\mathbf{${r2.toFixed(4)}} \\]
      `;
      stepSidebar.querySelector('.metric-block:nth-of-type(2) .formula-box').innerHTML = `
        \\[ R^2_{\\text{adj}} = 1 - (1 - ${r2.toFixed(3)}) \\frac{${n}-1}{${n}-1-1} = \\mathbf{${n <= 2 ? 'N/A' : adjR2.toFixed(4)}} \\]
      `;
    }

    // ─── PLOT 1: RESIDUALS VS FITTED ───
    const resGrid = document.getElementById('diag-res-grid');
    const resPointsGroup = document.getElementById('diag-res-points');
    const resZeroLine = document.getElementById('diag-res-zero');

    resGrid.innerHTML = '';
    resPointsGroup.innerHTML = '';

    // Dimensions
    const w = 340, h = 260;
    const resPad = { top: 20, right: 20, bottom: 30, left: 35 };

    // Axis limit: Fitted goes [0, 10], Residuals goes [-5, 5]
    function fitToScreen(fitVal, residual) {
      const sx = resPad.left + (fitVal / 10) * (w - resPad.left - resPad.right);
      const sy = h / 2.0 - (residual / 5.0) * ((h - resPad.top - resPad.bottom) / 2.0); // center is residual = 0
      return { x: sx, y: sy };
    }

    // Draw Axes & Grid background
    // Draw horizontal dashed lines
    for (let rVal = -4; rVal <= 4; rVal += 2) {
      const start = fitToScreen(0, rVal);
      const end = fitToScreen(10, rVal);

      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', start.x);
      gridLine.setAttribute('y1', start.y);
      gridLine.setAttribute('x2', end.x);
      gridLine.setAttribute('y2', end.y);
      gridLine.setAttribute('class', rVal === 0 ? 'axis-line' : 'grid-line');
      resGrid.appendChild(gridLine);

      // Y axis labels for residuals
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', start.x - 8);
      text.setAttribute('y', start.y + 4);
      text.setAttribute('class', 'axis-label');
      text.setAttribute('text-anchor', 'end');
      text.textContent = (rVal > 0 ? '+' : '') + rVal;
      resGrid.appendChild(text);
    }

    // Draw vertical lines for fitted values [0, 10]
    for (let fVal = 0; fVal <= 10; fVal += 2) {
      const bottom = fitToScreen(fVal, -5);
      const top = fitToScreen(fVal, 5);

      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', bottom.x);
      gridLine.setAttribute('y1', bottom.y);
      gridLine.setAttribute('x2', top.x);
      gridLine.setAttribute('y2', top.y);
      gridLine.setAttribute('class', fVal === 0 ? 'axis-line' : 'grid-line');
      resGrid.appendChild(gridLine);

      // X labels (Fitted value)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', bottom.x);
      text.setAttribute('y', h - 10);
      text.setAttribute('class', 'axis-label');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = fVal;
      resGrid.appendChild(text);
    }

    // Residual Zero baseline
    const zeroStart = fitToScreen(0, 0);
    const zeroEnd = fitToScreen(10, 0);
    resZeroLine.setAttribute('x1', zeroStart.x);
    resZeroLine.setAttribute('y1', zeroStart.y);
    resZeroLine.setAttribute('x2', zeroEnd.x);
    resZeroLine.setAttribute('y2', zeroEnd.y);

    // Plot residual points
    points.forEach((p, i) => {
      const fVal = fittedVals[i];
      const rVal = residuals[i];
      const scr = fitToScreen(fVal, rVal);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', scr.x);
      circle.setAttribute('cy', scr.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('class', 'diag-point');

      // Sync hover with other steps
      circle.addEventListener('mouseenter', () => highlightPointRow(p.id, true));
      circle.addEventListener('mouseleave', () => highlightPointRow(p.id, false));

      resPointsGroup.appendChild(circle);
    });

    // ─── PLOT 2: RESIDUAL HISTOGRAM ───
    const histGrid = document.getElementById('diag-hist-grid');
    const histBarsGroup = document.getElementById('diag-hist-bars');

    histGrid.innerHTML = '';
    histBarsGroup.innerHTML = '';

    // Bin residuals. Let's make 5 standard bins centered at 0:
    // Bin 1: [-inf, -1.8)
    // Bin 2: [-1.8, -0.6)
    // Bin 3: [-0.6, 0.6]
    // Bin 4: (0.6, 1.8]
    // Bin 5: (1.8, inf]
    const bins = [0, 0, 0, 0, 0];
    const binLabels = ["<-1.8", "-1.2", "0.0", "1.2", ">1.8"];

    residuals.forEach(res => {
      if (res < -1.8) bins[0]++;
      else if (res < -0.6) bins[1]++;
      else if (res <= 0.6) bins[2]++;
      else if (res <= 1.8) bins[3]++;
      else bins[4]++;
    });

    const maxBinCount = Math.max(...bins, 1);
    
    // Draw histogram vertical grid
    const histPad = { top: 20, right: 20, bottom: 30, left: 30 };
    function histScreen(binIdx, count) {
      const colWidth = (w - histPad.left - histPad.right) / 5;
      const sx = histPad.left + binIdx * colWidth + colWidth / 2;
      const sy = h - histPad.bottom - (count / maxBinCount) * (h - histPad.top - histPad.bottom);
      return { x: sx, y: sy, w: colWidth };
    }

    // Draw horizontal grid lines for histogram counts
    for (let c = 0; c <= maxBinCount; c++) {
      if (maxBinCount > 5 && c % 2 !== 0) continue; // skip gridlines if too dense

      const py = h - histPad.bottom - (c / maxBinCount) * (h - histPad.top - histPad.bottom);

      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', histPad.left);
      gridLine.setAttribute('y1', py);
      gridLine.setAttribute('x2', w - histPad.right);
      gridLine.setAttribute('y2', py);
      gridLine.setAttribute('class', c === 0 ? 'axis-line' : 'grid-line');
      histGrid.appendChild(gridLine);

      // Y count label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', histPad.left - 8);
      text.setAttribute('y', py + 4);
      text.setAttribute('class', 'axis-label');
      text.setAttribute('text-anchor', 'end');
      text.textContent = c;
      histGrid.appendChild(text);
    }

    // Draw bars and X labels
    const barWidth = (w - histPad.left - histPad.right) / 5 - 4; // gap between bars

    bins.forEach((count, idx) => {
      const coords = histScreen(idx, count);
      const bx = coords.x - barWidth / 2;
      const by = coords.y;
      const bHeight = h - histPad.bottom - by;

      // Draw bar rect
      if (count > 0) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', bx);
        rect.setAttribute('y', by);
        rect.setAttribute('width', barWidth);
        rect.setAttribute('height', bHeight);
        rect.setAttribute('class', 'hist-bar');
        histBarsGroup.appendChild(rect);
      }

      // Draw X bin label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', coords.x);
      label.setAttribute('y', h - 10);
      label.setAttribute('class', 'axis-label');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = binLabels[idx];
      histGrid.appendChild(label);
    });
  }

})();
