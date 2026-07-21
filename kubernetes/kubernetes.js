/* ============================================================
   Kubernetes & Containers Deep Dive — interactive logic
   Vanilla JS; no external dependencies.
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   Utilities
   ───────────────────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = old; }, 1200);
    }
  } catch (e) {
    if (btn) btn.textContent = 'Copy failed';
  }
}

/* ─────────────────────────────────────────────────────────────
   Terminal simulator
   ───────────────────────────────────────────────────────────── */
function Terminal(widgetId, steps) {
  const widget = $('#' + widgetId);
  if (!widget) return;
  const screen = widget.querySelector('.terminal-screen');
  const prevBtn = widget.querySelector('[id$="-prev"]');
  const nextBtn = widget.querySelector('[id$="-next"]');
  const copyBtn = widget.querySelector('[id$="-copy"]');
  const resetBtn = widget.querySelector('[id$="-reset"]');

  let index = 0;
  let runtime = 'docker';
  let cluster = 'kind';

  function commandText(step) {
    return step.command[runtime] || step.command;
  }

  function render() {
    screen.innerHTML = '';
    const step = steps[index];
    const cmd = commandText(step);
    addLine(cmd, 'command');
    if (step.output) addLine(step.output, step.outputClass || 'output');
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === steps.length - 1;
  }

  function addLine(text, cls) {
    const div = document.createElement('div');
    div.className = 'term-line ' + (cls || '');
    if (cls === 'command') {
      div.innerHTML = '<span class="prompt">$</span> ' + escapeHtml(text);
    } else {
      div.textContent = text;
    }
    screen.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
  }

  function typeCommand(text) {
    screen.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'term-line command';
    line.innerHTML = '<span class="prompt">$</span> ';
    screen.appendChild(line);
    const span = document.createElement('span');
    line.appendChild(span);

    let i = 0;
    function next() {
      if (i < text.length) {
        span.textContent += text[i];
        i++;
        screen.scrollTop = screen.scrollHeight;
        setTimeout(next, 18);
      } else if (steps[index].output) {
        setTimeout(function() {
          addLine(steps[index].output, steps[index].outputClass || 'output');
        }, 180);
      }
    }
    next();
  }

  function goNext() {
    if (index < steps.length - 1) {
      index++;
      typeCommand(commandText(steps[index]));
    }
  }

  function goPrev() {
    if (index > 0) {
      index--;
      render();
    }
  }

  function reset() {
    index = 0;
    render();
  }

  if (nextBtn) nextBtn.addEventListener('click', goNext);
  if (prevBtn) prevBtn.addEventListener('click', goPrev);
  if (resetBtn) resetBtn.addEventListener('click', reset);
  if (copyBtn) copyBtn.addEventListener('click', function() {
    copyToClipboard(commandText(steps[index]), copyBtn);
  });

  return {
    setRuntime: function(r) { runtime = r; render(); },
    setCluster: function(c) { cluster = c; render(); },
    getRuntime: function() { return runtime; },
    getCluster: function() { return cluster; },
    render: render,
    steps: steps
  };
}

/* Build & run steps */
const buildRunSteps = [
  {
    command: {
      docker: 'docker build -t my-app:v1 .',
      podman: 'podman build -t my-app:v1 .'
    },
    output: 'Successfully built image my-app:v1',
    outputClass: 'success'
  },
  {
    command: {
      docker: 'docker images | grep my-app',
      podman: 'podman images | grep my-app'
    },
    output: 'my-app   v1   4a2b8c9d1e3f   12 seconds ago   142MB',
    outputClass: 'output'
  },
  {
    command: {
      docker: 'docker run -d -p 3000:3000 --name my-app my-app:v1',
      podman: 'podman run -d -p 3000:3000 --name my-app my-app:v1'
    },
    output: '3f8a9c2e1d4b2c6a7e5f8d9c0a1b2c3d',
    outputClass: 'success'
  },
  {
    command: {
      docker: 'docker ps',
      podman: 'podman ps'
    },
    output: 'CONTAINER ID   IMAGE        STATUS          PORTS\n3f8a9c2e1d4b   my-app:v1    Up 6 seconds    0.0.0.0:3000->3000',
    outputClass: 'output'
  },
  {
    command: {
      docker: 'docker stop my-app',
      podman: 'podman stop my-app'
    },
    output: 'my-app',
    outputClass: 'output'
  }
];

/* Local cluster steps */
const kindSteps = [
  { command: 'kind create cluster --name demo', output: 'Creating cluster "demo" ... ✓', outputClass: 'success' },
  { command: 'kubectl cluster-info --context kind-demo', output: 'Kubernetes control plane is running at https://127.0.0.1:12345', outputClass: 'output' },
  { command: 'kubectl get nodes', output: 'NAME                 STATUS   ROLES           AGE   VERSION\ndemo-control-plane   Ready    control-plane   1m   v1.30.0', outputClass: 'output' },
  { command: 'kubectl get ns', output: 'NAME              STATUS\ndefault           Active\nkube-system       Active', outputClass: 'output' }
];
const minikubeSteps = [
  { command: 'minikube start --driver=docker', output: 'Done! kubectl is now configured to use "minikube"', outputClass: 'success' },
  { command: 'kubectl cluster-info', output: 'Kubernetes control plane is running at https://192.168.49.2:8443', outputClass: 'output' },
  { command: 'kubectl get nodes', output: 'NAME       STATUS   ROLES           AGE   VERSION\nminikube   Ready    control-plane   1m   v1.30.0', outputClass: 'output' },
  { command: 'kubectl get ns', output: 'NAME              STATUS\ndefault           Active\nkube-system       Active', outputClass: 'output' }
];

/* End-to-end deploy steps */
const deploySteps = [
  { command: 'docker build -t my-app:v1 .', output: 'Successfully built my-app:v1', outputClass: 'success' },
  { command: 'kind load docker-image my-app:v1 --name demo', output: 'Image loaded successfully', outputClass: 'success' },
  { command: 'kubectl apply -f app.yaml', output: 'deployment.apps/my-app created\nservice/my-app-service created', outputClass: 'success' },
  { command: 'kubectl get pods', output: 'NAME                     READY   STATUS    RESTARTS   AGE\nmy-app-5f4d9c7b8-x2z4a   1/1     Running   0          12s', outputClass: 'output' },
  { command: 'kubectl get svc my-app-service', output: 'NAME             TYPE       CLUSTER-IP     PORT(S)\nmy-app-service   NodePort   10.96.123.45   3000:30080/TCP', outputClass: 'output' },
  { command: 'kubectl port-forward svc/my-app-service 8080:3000', output: 'Forwarding from 127.0.0.1:8080 -> 3000', outputClass: 'success' }
];

/* Cleanup steps */
const cleanupSteps = [
  { command: 'kubectl delete -f app.yaml', output: 'deployment.apps "my-app" deleted\nservice "my-app-service" deleted', outputClass: 'output' },
  { command: 'kind delete cluster --name demo', output: 'Deleting cluster "demo" ... ✓', outputClass: 'success' },
  { command: 'docker rmi my-app:v1', output: 'Untagged: my-app:v1', outputClass: 'output' }
];

/* ─────────────────────────────────────────────────────────────
   Initialize terminals
   ───────────────────────────────────────────────────────────── */
const buildRunTerm = Terminal('build-run-terminal', buildRunSteps);
const clusterTerm = Terminal('cluster-terminal', kindSteps);
const deployTerm = Terminal('deploy-terminal', deploySteps);
const cleanupTerm = Terminal('cleanup-terminal', cleanupSteps);

/* Cluster tab switching */
$$('#local-cluster .term-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    $$('#local-cluster .term-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    const cluster = tab.dataset.cluster;
    clusterTerm.setCluster(cluster);
    clusterTerm.steps = cluster === 'kind' ? kindSteps : minikubeSteps;
    clusterTerm.render();
  });
});

/* Build/run runtime tab switching */
$$('#build-run .term-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    $$('#build-run .term-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    buildRunTerm.setRuntime(tab.dataset.runtime);
  });
});

/* ─────────────────────────────────────────────────────────────
   Diagram hover interactions
   ───────────────────────────────────────────────────────────── */
function setupDiagram(wrapperId, captionId) {
  const wrapper = $('#' + wrapperId);
  if (!wrapper) return;
  const caption = $('#' + captionId);
  const groups = wrapper.querySelectorAll('.diagram-group');
  groups.forEach(function(g) {
    g.addEventListener('mouseenter', function() {
      if (caption && g.dataset.info) caption.textContent = g.dataset.info;
    });
    g.addEventListener('mouseleave', function() {
      if (caption) caption.textContent = 'Hover a box to see what each layer does.';
    });
  });
}
setupDiagram('vm-vs-container', 'vm-caption');
setupDiagram('k8s-arch', 'k8s-caption');

/* ─────────────────────────────────────────────────────────────
   Flowchart
   ───────────────────────────────────────────────────────────── */
const flowDetails = {
  dockerfile: 'A <strong>Dockerfile</strong> is a recipe: it lists a base image, installs dependencies, copies code, exposes ports, and sets the startup command.',
  image: 'An <strong>image</strong> is a read-only stack of layers created by building the Dockerfile. It is portable and can be shared via a registry.',
  container: 'A <strong>container</strong> is a running instance of an image with its own filesystem, processes, and network namespace.',
  pod: 'A <strong>Pod</strong> is the smallest Kubernetes object. It wraps one or more containers that share storage and networking.',
  deployment: 'A <strong>Deployment</strong> manages a desired number of identical Pods, replacing failed ones and enabling rolling updates.',
  service: 'A <strong>Service</strong> provides stable networking and load balances traffic across the Pods in a Deployment.'
};

const flowDetail = $('#flow-detail');
$$('.flow-node').forEach(function(node) {
  node.addEventListener('click', function() {
    $$('.flow-node').forEach(function(n) { n.classList.remove('active'); });
    node.classList.add('active');
    const key = node.dataset.step;
    if (flowDetail && flowDetails[key]) {
      flowDetail.innerHTML = flowDetails[key];
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   YAML Builder
   ───────────────────────────────────────────────────────────── */
const ybImage = $('#yb-image');
const ybReplicas = $('#yb-replicas');
const ybPort = $('#yb-port');
const ybType = $('#yb-type');
const ybOutput = $('#yb-output');
const ybCopy = $('#yb-copy');

function generateYaml() {
  const image = (ybImage && ybImage.value.trim()) || 'my-app:v1';
  const replicas = (ybReplicas && parseInt(ybReplicas.value, 10)) || 1;
  const port = (ybPort && parseInt(ybPort.value, 10)) || 3000;
  const svcType = (ybType && ybType.value) || 'ClusterIP';
  const svcPort = svcType === 'NodePort' ? 30080 : port;

  const yaml =
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: ${image}
          ports:
            - containerPort: ${port}
---
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  type: ${svcType}
  selector:
    app: my-app
  ports:
    - port: ${port}
      targetPort: ${port}${svcType === 'NodePort' ? '\n      nodePort: ' + svcPort : ''}`;

  if (ybOutput) ybOutput.textContent = yaml;
  return yaml;
}

if (ybImage) ybImage.addEventListener('input', generateYaml);
if (ybReplicas) ybReplicas.addEventListener('input', generateYaml);
if (ybPort) ybPort.addEventListener('input', generateYaml);
if (ybType) ybType.addEventListener('change', generateYaml);
if (ybCopy) ybCopy.addEventListener('click', function() { copyToClipboard(generateYaml(), ybCopy); });
generateYaml();

/* ─────────────────────────────────────────────────────────────
   Quiz / Checkpoints
   ───────────────────────────────────────────────────────────── */
$$('.quiz-opt').forEach(function(btn) {
  btn.addEventListener('click', function() {
    const q = btn.dataset.q;
    const isCorrect = btn.dataset.correct === 'true';
    const all = $$('.quiz-opt[data-q="' + q + '"]');
    all.forEach(function(b) {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
    });
    const res = $('#quiz-result-' + q);
    if (res) {
      res.textContent = isCorrect
        ? 'Correct!'
        : 'Not quite — the correct answer is highlighted.';
      res.style.color = isCorrect ? 'var(--positive)' : 'var(--negative)';
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   Progress tracker & pipeline active state
   ───────────────────────────────────────────────────────────── */
const sections = $$('.content-section');
const pipelineBtns = $$('.pipeline .step-btn');
const progressTracker = $('#progress-tracker');

if (progressTracker) {
  sections.forEach(function(_, i) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' + (i === 0 ? ' active' : '');
    progressTracker.appendChild(dot);
  });
}

function onScroll() {
  const scrollY = window.scrollY + 160;
  let active = 0;
  sections.forEach(function(sec, i) {
    if (scrollY >= sec.offsetTop) active = i;
  });

  pipelineBtns.forEach(function(btn, i) {
    btn.classList.toggle('active', i === active);
  });

  const dots = $$('.progress-dot');
  dots.forEach(function(dot, i) {
    dot.classList.toggle('active', i === active);
    dot.classList.toggle('seen', i <= active);
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ─────────────────────────────────────────────────────────────
   Init terminals on load
   ───────────────────────────────────────────────────────────── */
if (buildRunTerm) buildRunTerm.render();
if (clusterTerm) clusterTerm.render();
if (deployTerm) deployTerm.render();
if (cleanupTerm) cleanupTerm.render();
