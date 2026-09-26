/* Containers & Kubernetes lesson — a container engine, a cluster simulator and seven labs. Uses window.Kit. */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, $$ = K.$$, note = K.note, out = K.out, esc = K.esc;
  var TICK = 700;

  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function table(rows) { var w = rows[0].map(function (_, i) { return Math.max.apply(null, rows.map(function (r) { return String(r[i]).length; })) + 3; }); return rows.map(function (r) { return r.map(function (c, i) { return i === r.length - 1 ? c : pad(c, w[i]); }).join(''); }); }
  function visible(el, fn) { var v = false; new IntersectionObserver(function (es) { v = es[0].isIntersecting; if (v && fn) fn(); }).observe(el); return function () { return v; }; }

  /* ═════ Cluster simulator ═════ */
  function Cluster(seed, nodes) {
    this.rand = K.rng(seed || 3); this.t = 0; this.pods = []; this.deps = {};
    this.nodes = []; for (var i = 1; i <= (nodes || 3); i++) this.nodes.push({ name: 'node-' + i, up: true });
  }
  var C = Cluster.prototype;
  C.suffix = function () { var a = 'bcdfghjklmnpqrstvwxz2456789', s = ''; for (var i = 0; i < 5; i++) s += a[Math.floor(this.rand() * a.length)]; return s; };
  C.kind = function (img) { if (/^myapp:(1\.0|2\.0|v1|v2|latest)$/.test(img)) return 'ok'; if (/^myapp:(v3|bug)$/.test(img)) return 'crash'; return 'pull'; };
  C.alive = function (dep) { return this.pods.filter(function (p) { return (!dep || p.dep === dep) && p.phase !== 'Terminating' && p.phase !== 'Unknown'; }); };
  C.running = function (dep) { return this.pods.filter(function (p) { return (!dep || p.dep === dep) && p.phase === 'Running'; }); };
  C.place = function () {
    var self = this, up = this.nodes.filter(function (n) { return n.up; }); if (!up.length) return null;
    up.sort(function (a, b) { return self.alive().filter(function (p) { return p.node === a.name; }).length - self.alive().filter(function (p) { return p.node === b.name; }).length; });
    return up[0].name;
  };
  C.create = function (d, ready) {
    var p = { name: d.name + '-' + this.suffix(), dep: d.name, labels: { app: d.app || d.name }, image: d.image, node: null, phase: 'Pending', born: this.t, step: this.t, restarts: 0, ip: '10.244.' + Math.floor(this.rand() * 3 + 1) + '.' + Math.floor(this.rand() * 240 + 10) };
    if (ready) { p.node = this.place(); p.phase = 'Running'; p.born = -40; }
    this.pods.push(p); return p;
  };
  C.addDep = function (name, replicas, image, app, ready) {
    var d = this.deps[name] = { name: name, replicas: replicas, image: image, prev: null, app: app || name, born: this.t };
    if (ready) for (var i = 0; i < replicas; i++) this.create(d, true);
    return d;
  };
  C.setImage = function (name, img) { var d = this.deps[name]; if (!d || d.image === img) return false; d.prev = d.image; d.image = img; return true; };
  C.undo = function (name) { var d = this.deps[name]; if (!d || !d.prev) return false; var t = d.image; d.image = d.prev; d.prev = t; return true; };
  C.kill = function (p) { if (p && p.phase !== 'Terminating') { p.phase = 'Terminating'; p.step = this.t; return true; } return false; };
  C.find = function (name) { return this.pods.filter(function (p) { return p.name === name && p.phase !== 'Terminating'; })[0]; };
  C.tick = function () {
    var self = this, t = ++this.t;
    this.pods = this.pods.filter(function (p) { return !((p.phase === 'Terminating' && t - p.step >= 2) || (p.phase === 'Unknown' && t - p.step >= 2) || (!self.deps[p.dep] && p.phase === 'Terminating')); });
    this.pods.forEach(function (p) {
      var node = self.nodes.filter(function (n) { return n.name === p.node; })[0];
      if (node && !node.up && p.phase !== 'Terminating' && p.phase !== 'Unknown') { p.phase = 'Unknown'; p.step = t; return; }
      if (t - p.step < 1) return;
      var k = self.kind(p.image);
      switch (p.phase) {
        case 'Pending': p.node = self.place(); if (p.node) { p.phase = 'ContainerCreating'; p.step = t; } break;
        case 'ContainerCreating': if (t - p.step >= 2) { p.phase = k === 'ok' ? 'Running' : k === 'crash' ? 'CrashLoopBackOff' : 'ErrImagePull'; p.step = t; if (k === 'crash') p.restarts++; } break;
        case 'ErrImagePull': if (t - p.step >= 2) { p.phase = 'ImagePullBackOff'; p.step = t; } break;
        case 'CrashLoopBackOff': if (t - p.step >= 3) { p.restarts++; p.step = t; } break;
      }
    });
    Object.keys(this.deps).forEach(function (n) {
      var d = self.deps[n], alive = self.alive(n), old = alive.filter(function (p) { return p.image !== d.image; }), neu = alive.filter(function (p) { return p.image === d.image; });
      if (old.length) {
        var readyNew = neu.filter(function (p) { return p.phase === 'Running'; }).length;
        if (readyNew + old.length > d.replicas) { var bad = old.filter(function (p) { return p.phase !== 'Running'; }); self.kill(bad[0] || old[0]); }
        else if (alive.length < d.replicas + 1) self.create(d);
      } else {
        for (var i = alive.length; i < d.replicas; i++) self.create(d);
        if (alive.length > d.replicas) {
          var order = alive.slice().sort(function (a, b) { return (a.phase === 'Running') - (b.phase === 'Running') || b.born - a.born; });
          order.slice(0, alive.length - d.replicas).forEach(function (p) { self.kill(p); });
        }
      }
    });
  };
  C.removeDep = function (name) { var self = this; delete this.deps[name]; this.pods.forEach(function (p) { if (p.dep === name) self.kill(p); }); };

  var PH = { Running: 'good', Pending: 'warn', ContainerCreating: 'warn', CrashLoopBackOff: 'bad', ErrImagePull: 'bad', ImagePullBackOff: 'bad', Terminating: 'muted', Unknown: 'muted' };
  // Draw nodes and pods into a box; returns pod hit boxes.
  function drawCluster(ctx, x0, y0, w, h, cl) {
    var c = K.col(), gap = 10, n = cl.nodes.length, nw = (w - gap * (n - 1)) / n, hits = [];
    cl.nodes.forEach(function (node, i) {
      var x = x0 + i * (nw + gap);
      K.roundRect(ctx, x, y0, nw, h, 12); ctx.fillStyle = node.up ? K.rgba(c.text, 0.03) : K.rgba(c.bad, 0.08); ctx.fill();
      ctx.strokeStyle = node.up ? c.border : c.bad; ctx.lineWidth = 1; ctx.setLineDash(node.up ? [] : [5, 4]); ctx.stroke(); ctx.setLineDash([]);
      K.text(ctx, node.name, x + 10, y0 + 18, c.text, '700 11px JetBrains Mono, monospace');
      K.text(ctx, node.up ? 'Ready' : 'NotReady', x + nw - 10, y0 + 18, node.up ? c.good : c.bad, '700 10px JetBrains Mono, monospace', 'right');
      var pods = cl.pods.filter(function (p) { return p.node === node.name; }), cols = nw > 210 ? 2 : 1, pw = (nw - 16 - (cols - 1) * 6) / cols, phh = 34;
      pods.forEach(function (p, k) {
        var px = x + 8 + (k % cols) * (pw + 6), py = y0 + 28 + Math.floor(k / cols) * (phh + 6);
        if (py + phh > y0 + h - 4) return;
        var col = c[PH[p.phase]] || c.muted, faded = p.phase === 'Terminating' || p.phase === 'Unknown';
        K.roundRect(ctx, px, py, pw, phh, 8); ctx.fillStyle = K.rgba(col, faded ? 0.06 : 0.16); ctx.fill();
        ctx.strokeStyle = K.rgba(col, faded ? 0.4 : 0.9); ctx.lineWidth = 1.3; ctx.setLineDash(p.phase === 'Running' || faded ? [] : [4, 3]); ctx.stroke(); ctx.setLineDash([]);
        var tag = p.image.split(':')[1] || 'latest';
        ctx.globalAlpha = faded ? 0.45 : 1;
        K.text(ctx, p.name, px + 7, py + 14, c.text, '700 10px JetBrains Mono, monospace');
        K.text(ctx, p.phase === 'ContainerCreating' ? 'Creating' : p.phase, px + 7, py + 27, col, '600 9.5px JetBrains Mono, monospace');
        K.text(ctx, tag, px + pw - 6, py + 27, c.muted, '600 9.5px JetBrains Mono, monospace', 'right');
        ctx.globalAlpha = 1;
        hits.push({ x: px, y: py, w: pw, h: phh, pod: p });
      });
      if (!node.up) K.text(ctx, '💥 crashed', x + nw / 2, y0 + h - 12, c.bad, '700 11px Inter, sans-serif', 'center');
    });
    // unscheduled
    var pend = cl.pods.filter(function (p) { return !p.node; });
    if (pend.length) K.text(ctx, pend.length + ' Pod' + (pend.length > 1 ? 's' : '') + ' Pending (waiting for a node)', x0, y0 + h + 14, c.warn, '600 10.5px Inter, sans-serif');
    return hits;
  }
  function hitPod(hits, p) { for (var i = 0; i < hits.length; i++) { var b = hits[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b.pod; } return null; }

  /* ═════ Lab 0 — VM vs containers ═════ */
  (function () {
    var lab = document.getElementById('lab-vm'); if (!lab) return;
    var n = 2, s, RAM = 16;
    function need() { return { vm: 1 + n * 2.5, ct: 1 + n * 0.5 }; }
    function update() {
      var q = need(); out(lab, 'nv', n); out(lab, 'vm', q.vm + ' GB'); out(lab, 'ct', q.ct + ' GB');
      if (q.vm > RAM) K.done('k-v-full');
      if (n === 10) K.done('k-v-max');
      if (q.vm > RAM) note(lab, '<b>The VMs don\'t fit:</b> each one carries its own 2 GB operating system, so ' + n + ' apps need ' + q.vm + ' GB. The containers share one kernel and need only ' + q.ct + ' GB' + (n === 10 ? ', leaving ' + (RAM - q.ct) + ' GB free.' : '.'), 'bad');
      else note(lab, 'Each VM carries a full guest OS (grey); containers share the host\'s. Add more apps.');
      s && s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), q = need(), top = 40, bot = h - 34, scale = (bot - top) / 20, bw = Math.min(150, w / 2 - 70);
      [['Virtual machines', 'vm'], ['Containers', 'ct']].forEach(function (panel, pi) {
        var x = w * (pi ? 0.72 : 0.28) - bw / 2, y = bot, rows = [['Host OS', 1, c.text2]];
        for (var i = 0; i < n; i++) { if (panel[1] === 'vm') rows.push(['Guest OS', 2, c.muted]); rows.push(['App ' + (i + 1), 0.5, pi ? c.accent2 : c.accent]); }
        K.text(ctx, panel[0], x + bw / 2, 22, c.text, '700 13px Inter, sans-serif', 'center');
        ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, bot - RAM * scale, bw + 8, RAM * scale);
        K.text(ctx, '16 GB', x - 10, bot - RAM * scale + 4, c.muted, '600 10px JetBrains Mono, monospace', 'right');
        rows.forEach(function (r) {
          var hh = r[1] * scale, over = y - hh < bot - RAM * scale - 0.5;
          ctx.fillStyle = over ? K.rgba(c.bad, 0.55) : K.rgba(r[2], 0.35); ctx.fillRect(x, y - hh + 1, bw, hh - 2);
          if (hh >= 13) K.text(ctx, r[0], x + bw / 2, y - hh / 2 + 4, c.text, '600 10px Inter, sans-serif', 'center');
          y -= hh;
        });
        var used = q[panel[1]];
        K.text(ctx, used + ' GB used' + (used > RAM ? ' — doesn\'t fit!' : ''), x + bw / 2, h - 12, used > RAM ? c.bad : c.text2, '700 11px Inter, sans-serif', 'center');
      });
    });
    K.slider(lab, 'n', function (v) { n = v; update(); });
  })();

  /* ═════ Lab 1 — layers & cache ═════ */
  (function () {
    var lab = document.getElementById('lab-build'); if (!lab) return;
    var order, cache, ver, changed, builds, busy;
    var STEPS = {
      good: [['FROM node:20-alpine', 8, 'base'], ['WORKDIR /app', 0.1], ['COPY package*.json ./', 0.2, 'pkg'], ['RUN npm install', 38], ['COPY . .', 0.3, 'all'], ['CMD ["node", "server.js"]', 0]],
      bad: [['FROM node:20-alpine', 8, 'base'], ['WORKDIR /app', 0.1], ['COPY . .', 0.3, 'all'], ['RUN npm install', 38], ['CMD ["node", "server.js"]', 0]]
    };
    function reset() { order = 'good'; cache = {}; ver = { src: 1, pkg: 1 }; changed = { src: false, pkg: false }; builds = 0; busy = false; $$(lab, '[data-in="order"] button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === 'good'); }); render(); $(lab, '[data-out="log"]').textContent = ''; out(lab, 'time', '—'); out(lab, 'cached', '—'); note(lab, 'Press <b>docker build</b> for the first build.'); }
    function render() { $(lab, '[data-out="file"]').innerHTML = STEPS[order].map(function (s) { return '<span class="ctx">' + esc(s[0]) + '</span>'; }).join(''); }
    function sigs() { var sig = '', r = []; STEPS[order].forEach(function (s) { sig += '|' + s[0] + (s[2] === 'pkg' ? ':' + ver.pkg : s[2] === 'all' ? ':' + ver.pkg + '.' + ver.src : ''); r.push(sig); }); return r; }
    K.seg(lab, 'order', function (v) { order = v; render(); note(lab, v === 'bad' ? 'Now the code is copied <b>before</b> <code>npm install</code>. Build, then edit server.js and rebuild.' : 'Libraries list first, code last.'); });
    K.on(lab, 'src', function () { ver.src++; changed.src = true; note(lab, 'You edited <code>server.js</code>, your code. Rebuild and watch which layers are reused.'); });
    K.on(lab, 'pkg', function () { ver.pkg++; changed.pkg = true; note(lab, 'You added a library to <code>package.json</code>. That legitimately requires a fresh <code>npm install</code>.'); });
    K.on(lab, 'build', function () {
      if (busy) return note(lab, 'Still building… wait for it to finish.', 'warn'); busy = true;
      var S = STEPS[order], sg = sigs(), logEl = $(lab, '[data-out="log"]'), total = 0, hits = 0, npmCached = null, i = 0;
      logEl.innerHTML = '';
      (function next() {
        if (i >= S.length) {
          busy = false; builds++;
          out(lab, 'time', total.toFixed(1) + ' s'); out(lab, 'cached', hits + ' / ' + S.length);
          logEl.insertAdjacentHTML('beforeend', '<span class="add">Successfully built myapp in ' + total.toFixed(1) + ' s</span>');
          K.done('k-b-build');
          if (builds > 1 && changed.src && !changed.pkg && order === 'good' && npmCached) { K.done('k-b-cache'); note(lab, '<b>' + total.toFixed(1) + ' s!</b> Only the layers after your code changed were rebuilt. <code>npm install</code> came from cache, because package.json didn\'t change.', 'good'); }
          else if (builds > 1 && changed.src && !changed.pkg && order === 'bad' && !npmCached) { K.done('k-b-bad'); note(lab, '<b>' + total.toFixed(1) + ' s.</b> Changing one line of code invalidated <code>COPY . .</code>, and everything after it, including the slow <code>npm install</code>. Every code edit now costs 40 s.', 'bad'); }
          else if (builds === 1) note(lab, 'First build: nothing cached yet, so every layer ran (<code>npm install</code> took 38 s). Now edit server.js and rebuild.');
          else if (hits === S.length) note(lab, 'Nothing changed, so every layer came from cache.', 'good');
          else note(lab, 'Rebuilt from the first changed layer onwards.');
          changed = { src: false, pkg: false };
          return;
        }
        var s = S[i], hit = !!cache[sg[i]];
        if (!hit && s[2] === 'base' && builds) hit = true;
        cache[sg[i]] = 1;
        if (s[0] === 'RUN npm install') npmCached = hit;
        if (hit) hits++; else total += s[1];
        logEl.insertAdjacentHTML('beforeend', '<span class="' + (hit ? 'ctx' : 'del') + '">[' + (i + 1) + '/' + S.length + '] ' + esc(s[0]) + (hit ? '   CACHED' : '   ' + s[1].toFixed(1) + 's') + '</span>');
        i++; setTimeout(next, K.reduce ? 0 : hit ? 90 : Math.min(700, 120 + s[1] * 15));
      })();
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 2 — docker / podman terminal ═════ */
  (function () {
    var lab = document.getElementById('lab-docker'); if (!lab) return;
    var st, t, g, rng = K.rng(17);
    function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(rng() * 16)]; return s; }
    function reset() { st = { images: {}, cs: [], engine: 'docker', built: false, reqs: 0, refused: false, ok: false, ran: false }; t.clear(); t.print('Practice terminal: this is a simulation, so nothing runs on your computer.', 'c-dim'); t.print('A Dockerfile and server.js are in this folder. Type help for commands.', 'c-dim'); g && g.redraw(); after({}); }
    function byName(n) { return st.cs.filter(function (c) { return c.name === n || c.id.indexOf(n) === 0; })[0]; }
    function exec(cmd, ev) {
      var a = cmd.trim().split(/\s+/), p = function (s, c) { t.print(s, c); };
      if (a[0] === 'help') return ['Commands: docker|podman build -t NAME . · images · run [-d] [-p HOST:CONTAINER] [--name N] IMAGE', '          ps [-a] · logs N · stop N · start N · rm [-f] N · curl localhost:PORT · clear'].forEach(function (s) { p(s, 'c-dim'); });
      if (a[0] === 'curl') {
        var m = (a[1] || '').match(/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1):(\d+)/); if (!m) return p('curl: try  curl localhost:8080', 'c-err');
        var port = +m[1], c = st.cs.filter(function (x) { return x.up && x.host === port; })[0];
        if (!c) { ev.refused = port; return p('curl: (7) Failed to connect to localhost port ' + port + ': Connection refused', 'c-err'); }
        c.reqs++; ev.ok = true; return p('Hello from myapp! 👋  (served by container ' + c.id.slice(0, 12) + ')', 'c-ok');
      }
      if (a[0] !== 'docker' && a[0] !== 'podman') return p('bash: ' + a[0] + ': command not found (type help)', 'c-err');
      st.engine = a[0]; var E = a[0], sub = a[1];
      switch (sub) {
        case 'build': {
          var ti = a.indexOf('-t'), name = ti > 0 ? a[ti + 1] : null;
          if (a[a.length - 1] !== '.') return p('ERROR: "' + E + ' build" requires exactly 1 argument: the folder, usually .', 'c-err');
          var again = st.built;
          ['FROM node:20-alpine', 'WORKDIR /app', 'COPY package*.json ./', 'RUN npm install', 'COPY . .', 'CMD ["node", "server.js"]'].forEach(function (s, i) { p('STEP ' + (i + 1) + '/6: ' + s + (again ? '  (cached)' : ''), again ? 'c-dim' : ''); });
          var repo = name ? name.split(':')[0] : '<none>', tag = name && name.indexOf(':') > 0 ? name.split(':')[1] : 'latest';
          st.images[repo + ':' + tag] = { id: hex(12), repo: repo, tag: tag }; st.built = true; ev.build = true;
          return p('Successfully built and tagged ' + (name ? repo + ':' + tag : 'an unnamed image (use -t to name it)'), 'c-ok');
        }
        case 'images': return table([['REPOSITORY', 'TAG', 'IMAGE ID', 'SIZE']].concat(Object.keys(st.images).map(function (k) { var im = st.images[k]; return [im.repo, im.tag, im.id, '182MB']; })).concat([['node', '20-alpine', 'b1c2d3e4f5a6', '135MB']])).forEach(function (l, i) { p(l, i ? '' : 'c-dim'); });
        case 'run': {
          var o = { d: false, host: null, cport: null, name: null, img: null };
          for (var i = 2; i < a.length; i++) {
            if (a[i] === '-d' || a[i] === '--detach') o.d = true;
            else if (a[i] === '-p' || a[i] === '--publish') { var pm = (a[++i] || '').split(':'); o.host = +pm[0]; o.cport = +pm[1]; }
            else if (a[i] === '--name') o.name = a[++i];
            else if (a[i] === '--rm' || a[i] === '-it' || a[i] === '-i' || a[i] === '-t') continue;
            else if (!o.img) o.img = a[i];
          }
          if (!o.img) return p('"' + E + ' run" requires at least 1 argument: the image', 'c-err');
          var key = o.img.indexOf(':') > 0 ? o.img : o.img + ':latest';
          if (!st.images[key]) return [["Unable to find image '" + key + "' locally", ''], [E + ': Error response from daemon: pull access denied for ' + o.img.split(':')[0] + ', repository does not exist', 'c-err'], ['(Build it first: ' + E + ' build -t ' + o.img.split(':')[0] + ' .)', 'c-dim']].forEach(function (l) { p(l[0], l[1]); });
          if (o.name && byName(o.name)) return p(E + ': Error response from daemon: Conflict. The container name "/' + o.name + '" is already in use. Remove it first (' + E + ' rm -f ' + o.name + ').', 'c-err');
          if (o.host && st.cs.some(function (c) { return c.up && c.host === o.host; })) return p(E + ': Error response from daemon: Bind for 0.0.0.0:' + o.host + ' failed: port is already allocated', 'c-err');
          if (o.host && o.cport !== 3000) p('(Note: the app listens on port 3000 inside the container, so ' + o.host + ':' + o.cport + ' won\'t reach it.)', 'c-warn');
          var ADJ = ['eager', 'brave', 'calm', 'jolly', 'quirky'], NOUN = ['turing', 'hopper', 'lovelace', 'knuth', 'curie'];
          var c2 = { id: hex(64), name: o.name || ADJ[Math.floor(rng() * 5)] + '_' + NOUN[Math.floor(rng() * 5)], img: key, host: o.host && o.cport === 3000 ? o.host : null, pub: o.host ? o.host + ':' + o.cport : '', up: true, reqs: 0 };
          st.cs.push(c2); ev.run = c2; st.ran = true;
          if (!o.d) { p('Server listening on port 3000'); p('(Sandbox: kept it running in the background. Real ' + E + ' would take over this terminal; that\'s what -d avoids.)', 'c-dim'); }
          else p(c2.id);
          return;
        }
        case 'ps': {
          var all = a.indexOf('-a') > 0, rows = st.cs.filter(function (c) { return all || c.up; });
          return table([['CONTAINER ID', 'IMAGE', 'STATUS', 'PORTS', 'NAMES']].concat(rows.map(function (c) { return [c.id.slice(0, 12), c.img, c.up ? 'Up' : 'Exited (0)', c.up && c.pub ? '0.0.0.0:' + c.pub.replace(':', '->') + '/tcp' : '', c.name]; }))).forEach(function (l, i) { p(l, i ? '' : 'c-dim'); });
        }
        case 'logs': { var c3 = byName(a[2]); if (!c3) return p('Error: No such container: ' + a[2], 'c-err'); p('Server listening on port 3000'); for (var r = 0; r < c3.reqs; r++) p('GET / 200 3ms', 'c-dim'); return; }
        case 'stop': case 'start': { var c4 = byName(a[2]); if (!c4) return p('Error response from daemon: No such container: ' + a[2], 'c-err'); if (sub === 'start' && c4.host && st.cs.some(function (x) { return x !== c4 && x.up && x.host === c4.host; })) return p('Error: port already allocated', 'c-err'); c4.up = sub === 'start'; ev[sub] = true; return p(a[2]); }
        case 'rm': {
          var f = a[2] === '-f', nm = f ? a[3] : a[2], c5 = byName(nm); if (!c5) return p('Error response from daemon: No such container: ' + nm, 'c-err');
          if (c5.up && !f) return p('Error response from daemon: cannot remove running container ' + nm + '. Stop it first, or force-remove with rm -f', 'c-err');
          st.cs.splice(st.cs.indexOf(c5), 1); ev.rm = true; return p(nm);
        }
        default: return p(E + ": '" + (sub || '') + "' is not a " + E + ' command. See help.', 'c-err');
      }
    }
    function after(ev) {
      var up = st.cs.filter(function (c) { return c.up; });
      if (st.built) K.done('k-d-build');
      if (up.some(function (c) { return c.host; })) K.done('k-d-run');
      if (ev.refused === 3000 || (ev.refused && st.ran)) { K.done('k-d-refused'); st.refused = true; }
      if (ev.ok) { K.done('k-d-curl'); st.ok = true; }
      if (st.ran && !st.cs.length) K.done('k-d-clean');
      if (ev.refused) note(lab, 'Refused: nothing on your laptop listens on port ' + ev.refused + '. The app\'s port 3000 is inside the container, reachable only through the published port' + (up.some(function (c) { return c.host; }) ? ' (' + up.filter(function (c) { return c.host; })[0].host + ').' : '. Publish one with -p.'), 'warn');
      else if (ev.ok) note(lab, '<b>It works!</b> Your request went laptop:8080 → container:3000. The same image would behave identically on any server.', 'good');
      else if (ev.rm && !st.cs.length) note(lab, 'All cleaned up: no containers left (<code>ps -a</code>). The image is still there for next time: <code>' + st.engine + ' images</code>.', 'good');
      else if (ev.run) note(lab, 'Container started from the image. <code>' + st.engine + ' ps</code> lists it. Now try reaching it with curl.', 'good');
      else if (ev.build) note(lab, 'Image built. Start a container from it: <code>' + st.engine + ' run -d -p 8080:3000 --name web myapp</code>.', 'good');
      else if (ev.stop) note(lab, 'Stopped, but still there (<code>ps -a</code>). Remove it with <code>rm</code>.');
    }
    t = K.term($(lab, '[data-term]'), { scope: lab, prompt: '~/myapp $', handler: function (cmd) { var ev = {}; exec(cmd, ev); g.redraw(); after(ev); } });
    g = K.canvas($(lab, '.graph canvas'), function (ctx, w, h) {
      var c = K.col(), x = 14, y = 36, W = w - 28, H = h - 52;
      K.text(ctx, 'YOUR LAPTOP', x, 22, c.muted, '700 10px JetBrains Mono, monospace');
      K.roundRect(ctx, x, y, W, H, 14); ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.stroke();
      var ex = x + 64, ey = y + 16, EW = W - 80, EH = H - 54;
      K.roundRect(ctx, ex, ey, EW, EH, 12); ctx.fillStyle = K.rgba(c.accent, 0.06); ctx.fill(); ctx.strokeStyle = K.rgba(c.accent, 0.4); ctx.stroke();
      K.text(ctx, st.engine === 'podman' ? 'Podman (no daemon)' : 'Docker engine', ex + 10, ey + 16, c.accent, '700 10.5px Inter, sans-serif');
      var cs = st.cs.slice(-4), bh = Math.min(46, (EH - 30) / Math.max(1, cs.length) - 8);
      if (!cs.length) K.text(ctx, 'no containers', ex + EW / 2, ey + EH / 2 + 4, c.muted, '600 11px Inter, sans-serif', 'center');
      cs.forEach(function (ct, i) {
        var bx = ex + 12, by = ey + 26 + i * (bh + 8), bw = EW - 24, col = ct.up ? c.good : c.muted;
        K.roundRect(ctx, bx, by, bw, bh, 9); ctx.fillStyle = K.rgba(col, 0.14); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
        K.text(ctx, '📦 ' + ct.name, bx + 8, by + 16, c.text, '700 11px JetBrains Mono, monospace');
        K.text(ctx, (ct.up ? 'running' : 'exited') + ' · app on :3000', bx + 8, by + Math.min(bh - 8, 32), col, '600 10px JetBrains Mono, monospace');
        if (ct.host && ct.up) {
          var py = by + bh / 2;
          K.roundRect(ctx, x - 2, py - 10, 52, 20, 6); ctx.fillStyle = c.accent2; ctx.fill();
          K.text(ctx, ':' + ct.host, x + 24, py + 4, '#fff', '700 10.5px JetBrains Mono, monospace', 'center');
          K.arrow(ctx, x + 52, py, bx - 2, py, c.accent2, 2);
        }
      });
      var ims = Object.keys(st.images);
      K.text(ctx, 'images: ' + (ims.length ? ims.join(', ') : 'none yet'), x + 12, y + H - 12, c.text2, '600 10.5px JetBrains Mono, monospace');
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 3 — reconciliation ═════ */
  (function () {
    var lab = document.getElementById('lab-reconcile'); if (!lab) return;
    var cl, s, hits = [], killed = false, isVis = visible(lab);
    function reset() { cl = new Cluster(5); cl.addDep('web', 3, 'myapp:1.0', 'web', true); killed = false; K.setSlider(lab, 'r', 3); $(lab, '[data-act="node"]').textContent = '💥 Crash node-2'; update(); }
    function update() {
      var d = cl.deps.web, run = cl.running('web').length, down = cl.nodes.some(function (n) { return !n.up; });
      out(lab, 'want', d.replicas); var hb = out(lab, 'have', run); hb.className = run === d.replicas ? 'good' : 'bad';
      var onDown = cl.alive('web').some(function (p) { return !cl.nodes.filter(function (n) { return n.name === p.node; })[0].up; });
      if (d.replicas === 6 && run === 6) K.done('k-r-scale');
      if (killed && run === d.replicas) { K.done('k-r-kill'); }
      if (down && run === d.replicas && !onDown && d.replicas > 0) K.done('k-r-node');
      if (run !== d.replicas || cl.pods.some(function (p) { return p.phase !== 'Running'; })) note(lab, '<b>Reconciling…</b> desired ' + d.replicas + ', running ' + run + '. ' + (down ? 'node-2 is down; its Pods are lost and being replaced on healthy nodes.' : run < d.replicas ? 'The controller creates Pods; the scheduler picks the least-busy node.' : 'Extra Pods are being terminated.'), 'warn');
      else note(lab, '<b>Desired = actual.</b> The controller keeps checking. Change the desired count or break something.' + (killed ? ' The Pod you deleted was replaced, with a new name.' : ''), 'good');
      if (isVis()) s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), d = cl.deps.web;
      K.roundRect(ctx, 12, 40, w - 24, 34, 10); ctx.fillStyle = K.rgba(c.accent, 0.1); ctx.fill();
      K.text(ctx, 'Control plane', 24, 61, c.accent, '700 11px Inter, sans-serif');
      K.text(ctx, 'Deployment web: want ' + d.replicas + ' · have ' + cl.running('web').length, w - 24, 61, c.text, '700 11px JetBrains Mono, monospace', 'right');
      hits = drawCluster(ctx, 12, 86, w - 24, h - 108, cl);
    });
    $(lab, 'canvas').addEventListener('pointerdown', function (e) { var p = hitPod(hits, s.point(e)); if (p && cl.kill(p)) { killed = true; update(); } });
    K.slider(lab, 'r', function (v) { out(lab, 'rv', v); if (cl) { cl.deps.web.replicas = v; update(); } });
    K.on(lab, 'node', function () { var n = cl.nodes[1]; n.up = !n.up; this.textContent = n.up ? '💥 Crash node-2' : '🔧 Restore node-2'; update(); });
    $(lab, '[data-reset]').addEventListener('click', reset);
    setInterval(function () { cl.tick(); update(); }, TICK);
    reset();
  })();

  /* ═════ Lab 4 — kubectl ═════ */
  (function () {
    var lab = document.getElementById('lab-kubectl'); if (!lab) return;
    var YAML = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: myapp:1.0\n          ports:\n            - containerPort: 3000\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 3000\n';
    var cl, svc, pf, t, g, ta = $(lab, '[data-in="yaml"]'), isVis = visible(lab), sawPull = false;
    function reset() { cl = new Cluster(7); svc = null; pf = false; sawPull = false; ta.value = YAML; t.clear(); t.print('Practice cluster with 3 nodes (simulated). Type help for commands.', 'c-dim'); g && g.redraw(); note(lab, 'A 3-node cluster is ready. Look around with <code>kubectl get nodes</code>, then deploy with <code>kubectl apply -f app.yaml</code>.'); }
    function age(p) { return Math.max(1, Math.round((cl.t - p.born) * TICK / 1000)) + 's'; }
    function parse() {
      return ta.value.split(/^---\s*$/m).map(function (doc) {
        var kind = (doc.match(/^kind:\s*(\S+)/m) || [])[1], name = (doc.match(/metadata:\s*\n\s+name:\s*(\S+)/) || [])[1];
        return { kind: kind, name: name, replicas: +((doc.match(/replicas:\s*(\d+)/) || [])[1] || 1), image: (doc.match(/image:\s*(\S+)/) || [])[1], app: (doc.match(/app:\s*(\S+)/) || [])[1] };
      }).filter(function (d) { return d.kind || d.name; });
    }
    function exec(cmd, ev) {
      var a = cmd.trim().split(/\s+/), p = function (s, c) { t.print(s, c); }, T = function (rows) { table(rows).forEach(function (l, i) { p(l, i ? '' : 'c-dim'); }); };
      if (a[0] === 'help') return ['kubectl get nodes|pods|deployments|svc|all · apply -f app.yaml · scale deployment web --replicas=N', 'kubectl delete pod NAME · describe pod NAME · logs NAME · set image deployment/web web=IMAGE', 'kubectl rollout status|undo deployment/web · port-forward svc/web 8080:80 · curl localhost:8080 · clear'].forEach(function (s) { p(s, 'c-dim'); });
      if (a[0] === 'curl') {
        if (!pf) return p('curl: (7) Failed to connect to localhost port 8080: Connection refused  (run kubectl port-forward first)', 'c-err');
        var eps = cl.running().filter(function (x) { return x.labels.app === svc.app; }); if (!eps.length) return p('curl: (52) Empty reply from server (the Service has no ready endpoints)', 'c-err');
        var e = eps[Math.floor(Math.random() * eps.length)]; return p('Hello from ' + e.name + ' (' + e.image + ')', 'c-ok');
      }
      if (a[0] === 'kind' || a[0] === 'minikube') return p('(This sandbox\'s cluster is already running. Chapter 7 shows how to create one for real.)', 'c-dim');
      if (a[0] !== 'kubectl' && a[0] !== 'k') return p('bash: ' + a[0] + ': command not found (type help)', 'c-err');
      var v = a[1], r = (a[2] || '').toLowerCase();
      ev.verb = v; ev.res = r;
      switch (v) {
        case 'get': {
          var wide = a.indexOf('wide') > 0;
          if (/^nodes?$|^no$/.test(r)) return T([['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION']].concat(cl.nodes.map(function (n, i) { return [n.name, n.up ? 'Ready' : 'NotReady', i ? '<none>' : 'control-plane', '12d', 'v1.31.0']; })));
          var showPods = /^(pods?|po|all)$/.test(r), showDep = /^(deployments?|deploy|all)$/.test(r), showSvc = /^(svc|services?|all)$/.test(r);
          if (!showPods && !showDep && !showSvc) return p('error: the server doesn\'t have a resource type "' + (a[2] || '') + '"', 'c-err');
          if (showPods) { var ps = cl.pods; if (!ps.length && r !== 'all') p('No resources found in default namespace.'); else if (ps.length) T([['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'].concat(wide ? ['IP', 'NODE'] : [])].concat(ps.map(function (x) { return [x.name, x.phase === 'Running' ? '1/1' : '0/1', x.phase, x.restarts, age(x)].concat(wide ? [x.ip, x.node || '<none>'] : []); }))); }
          if (showDep) { var ds = Object.keys(cl.deps); if (!ds.length && r !== 'all') p('No resources found in default namespace.'); else if (ds.length) { if (r === 'all') p(''); T([['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE']].concat(ds.map(function (n) { var d = cl.deps[n], rn = cl.running(n).length; return [n, rn + '/' + d.replicas, cl.alive(n).filter(function (x) { return x.image === d.image; }).length, rn, Math.round((cl.t - d.born) * TICK / 1000) + 's']; }))); } }
          if (showSvc) { if (r === 'all') p(''); T([['NAME', 'TYPE', 'CLUSTER-IP', 'PORT(S)']].concat([['kubernetes', 'ClusterIP', '10.96.0.1', '443/TCP']]).concat(svc ? [[svc.name, 'ClusterIP', '10.96.41.7', '80/TCP']] : [])); }
          return;
        }
        case 'apply': {
          if (a[2] !== '-f' || !a[3]) return p('error: must specify one of -f and -k', 'c-err');
          if (a[3] !== 'app.yaml') return p('error: the path "' + a[3] + '" does not exist', 'c-err');
          var docs = parse(); if (!docs.length) return p('error: no objects passed to apply', 'c-err');
          docs.forEach(function (d) {
            if (!d.kind) return p('error: error validating "app.yaml": kind not set', 'c-err');
            if (!d.name) return p('error: error validating "app.yaml": metadata.name is required', 'c-err');
            if (d.kind === 'Deployment') {
              if (!d.image) return p('error: error validating "app.yaml": containers[0].image is required', 'c-err');
              var rep = Math.min(12, d.replicas), cur = cl.deps[d.name];
              if (!cur) { cl.addDep(d.name, rep, d.image, d.app || d.name); ev.applied = true; return p('deployment.apps/' + d.name + ' created', 'c-ok'); }
              var ch = cur.replicas !== rep || cur.image !== d.image; cur.replicas = rep; cl.setImage(d.name, d.image); ev.applied = true;
              return p('deployment.apps/' + d.name + (ch ? ' configured' : ' unchanged'), ch ? 'c-ok' : '');
            }
            if (d.kind === 'Service') { var nw = !svc; svc = { name: d.name, app: d.app || d.name }; return p('service/' + d.name + (nw ? ' created' : ' unchanged'), nw ? 'c-ok' : ''); }
            p('error: resource mapping not found for kind "' + d.kind + '"', 'c-err');
          });
          return;
        }
        case 'scale': {
          var tgt = (a[2] || '').replace(/^(deployment|deploy)\//, ''), ri = cmd.match(/--replicas[= ](\d+)/);
          if (/^(deployment|deploy)$/.test(a[2])) tgt = a[3];
          if (!ri) return p('error: required flag(s) "replicas" not set', 'c-err');
          if (!cl.deps[tgt]) return p('Error from server (NotFound): deployments.apps "' + tgt + '" not found', 'c-err');
          cl.deps[tgt].replicas = Math.min(12, +ri[1]); return p('deployment.apps/' + tgt + ' scaled', 'c-ok');
        }
        case 'delete': {
          if (a[2] === '-f') { Object.keys(cl.deps).forEach(function (n) { cl.removeDep(n); p('deployment.apps "' + n + '" deleted'); }); if (svc) { p('service "' + svc.name + '" deleted'); svc = null; pf = false; } return; }
          if (/^(pods?|po)$/.test(r)) { a.slice(3).forEach(function (nm) { var x = cl.find(nm); if (x) { cl.kill(x); ev.deleted = true; p('pod "' + nm + '" deleted'); } else p('Error from server (NotFound): pods "' + nm + '" not found', 'c-err'); }); if (!a[3]) p('error: resource(s) were provided, but no name was specified', 'c-err'); return; }
          if (/^(deployments?|deploy)$/.test(r)) { if (!cl.deps[a[3]]) return p('Error from server (NotFound): deployments.apps "' + a[3] + '" not found', 'c-err'); cl.removeDep(a[3]); return p('deployment.apps "' + a[3] + '" deleted'); }
          return p('error: the server doesn\'t have a resource type "' + (a[2] || '') + '"', 'c-err');
        }
        case 'describe': case 'logs': {
          var nm2 = v === 'logs' ? a[2] : a[3]; if (v === 'describe' && !/^(pods?|po)$/.test(r)) return p('(This sandbox can describe pods: kubectl describe pod NAME)', 'c-dim');
          var x2 = cl.find(nm2 || ''); if (!x2) return p('Error from server (NotFound): pods "' + (nm2 || '') + '" not found' + (nm2 ? '' : '. Copy a name from kubectl get pods'), 'c-err');
          var k = cl.kind(x2.image); ev.inspect = x2;
          if (v === 'logs') {
            if (x2.phase === 'Running') return ['Server listening on port 3000', 'GET /health 200'].forEach(function (s) { p(s); });
            if (k === 'crash') return ['Server starting…', 'Error: Cannot find module \'./config\'', '    at server.js:3:15'].forEach(function (s, i) { p(s, i ? 'c-err' : ''); });
            return p('Error from server (BadRequest): container "web" in pod "' + x2.name + '" is waiting to start: trying and failing to pull image', 'c-err');
          }
          [['Name:', x2.name], ['Node:', x2.node || '<none>'], ['Labels:', 'app=' + x2.labels.app], ['Status:', x2.phase], ['IP:', x2.ip], ['Image:', x2.image], ['Restarts:', x2.restarts]].forEach(function (l) { p(pad(l[0], 11) + l[1]); });
          p('Events:', 'c-dim'); p('  Normal   Scheduled  Successfully assigned default/' + x2.name + ' to ' + (x2.node || '?'));
          if (k === 'pull' && x2.phase !== 'Pending' && x2.phase !== 'ContainerCreating') { p('  Normal   Pulling    Pulling image "' + x2.image + '"'); p('  Warning  Failed     Failed to pull image "' + x2.image + '": not found', 'c-err'); p('  Normal   BackOff    Back-off pulling image "' + x2.image + '"', 'c-warn'); }
          else if (k === 'crash' && x2.phase === 'CrashLoopBackOff') { p('  Normal   Started    Started container web'); p('  Warning  BackOff    Back-off restarting failed container', 'c-err'); }
          else if (x2.phase === 'Running') { p('  Normal   Pulled     Container image "' + x2.image + '" already present'); p('  Normal   Started    Started container web', 'c-ok'); }
          return;
        }
        case 'set': {
          var m = cmd.match(/set image (?:deployment|deploy)\/(\S+)\s+\S+=(\S+)/); if (!m) return p('usage: kubectl set image deployment/web web=IMAGE', 'c-err');
          if (!cl.deps[m[1]]) return p('Error from server (NotFound): deployments.apps "' + m[1] + '" not found', 'c-err');
          cl.setImage(m[1], m[2]); return p('deployment.apps/' + m[1] + ' image updated', 'c-ok');
        }
        case 'rollout': {
          var dn = (a[3] || '').replace(/^(deployment|deploy)\//, ''), d2 = cl.deps[dn];
          if (!d2) return p('Error from server (NotFound): deployments.apps "' + dn + '" not found', 'c-err');
          if (a[2] === 'undo') return cl.undo(dn) ? p('deployment.apps/' + dn + ' rolled back', 'c-ok') : p('error: no rollout history found for deployment "' + dn + '"', 'c-err');
          var upd = cl.alive(dn).filter(function (x) { return x.image === d2.image && x.phase === 'Running'; }).length;
          return upd >= d2.replicas && cl.alive(dn).length === d2.replicas ? p('deployment "' + dn + '" successfully rolled out', 'c-ok') : p('Waiting for deployment "' + dn + '" rollout to finish: ' + upd + ' of ' + d2.replicas + ' updated replicas are available…', 'c-warn');
        }
        case 'port-forward': {
          if (!svc || !/svc\/|service\//.test(a[2] || '')) return p('Error from server (NotFound): services "' + (a[2] || '').replace(/^(svc|service)\//, '') + '" not found', 'c-err');
          pf = true; return ['Forwarding from 127.0.0.1:8080 -> 3000', '(Sandbox: runs in the background. Now try curl localhost:8080)'].forEach(function (s, i) { p(s, i ? 'c-dim' : 'c-ok'); });
        }
        case 'version': return p('Client Version: v1.31.0\nServer Version: v1.31.0');
        case 'cluster-info': return p('Kubernetes control plane is running at https://127.0.0.1:6443', 'c-ok');
        default: return p('error: unknown command "' + (v || '') + '" for "kubectl"', 'c-err');
      }
    }
    function after(ev) {
      var d = cl.deps.web, run = cl.running('web').length, pullBad = cl.pods.some(function (x) { return /ImagePull|ErrImage/.test(x.phase); });
      if (ev.verb === 'get' && /^no/.test(ev.res || '')) K.done('k-k-nodes');
      if (d) K.done('k-k-apply');
      if (ev.verb === 'get' && /^(pods?|po|all)$/.test(ev.res) && cl.running().length) K.done('k-k-pods');
      if (d && d.replicas >= 5 && run >= 5) K.done('k-k-scale');
      if (pullBad && ((ev.verb === 'get' && /^(pods?|po|all)$/.test(ev.res)) || ev.inspect)) { K.done('k-k-typo'); sawPull = true; }
      if (!ev.verb) return;
      if (ev.applied && d && cl.kind(d.image) === 'pull') note(lab, 'Applied with image <code>' + esc(d.image) + '</code>. Watch the new Pods with <code>kubectl get pods</code>. Notice that the old Pods keep running while the new ones fail. That\'s the rolling update protecting you.', 'warn');
      else if (ev.applied) note(lab, 'Desired state sent to the API server. Pods go Pending → ContainerCreating → Running. Check with <code>kubectl get pods</code>.', 'good');
      else if (sawPull && pullBad) note(lab, '<b>ImagePullBackOff:</b> the node can\'t download that image. Run <code>kubectl describe pod &lt;name&gt;</code> to read the events. Fix the image name and apply again.', 'bad');
      else if (ev.deleted) note(lab, 'Pod deleted, and the Deployment immediately creates a replacement. Run <code>kubectl get pods</code> again.', 'good');
    }
    function chips() { var first = cl.alive()[0]; $$(lab, '.chip').forEach(function (b) { var base = b.textContent.replace(/ …$/, ''); if (/…$/.test(b.textContent)) b.dataset.cmd = base + ' ' + (first ? first.name : ''); }); }
    t = K.term($(lab, '[data-term]'), { scope: lab, prompt: '$', handler: function (cmd) { var ev = {}; exec(cmd, ev); g.redraw(); after(ev); chips(); } });
    g = K.canvas($(lab, '.graph canvas'), function (ctx, w, h) {
      var c = K.col(), d = cl.deps.web;
      K.text(ctx, 'CLUSTER (live)', 14, 22, c.muted, '700 10px JetBrains Mono, monospace');
      if (d) K.text(ctx, 'web: want ' + d.replicas + ' · ready ' + cl.running('web').length + (svc ? ' · svc ✓' : ''), w - 14, 22, c.text2, '700 10px JetBrains Mono, monospace', 'right');
      drawCluster(ctx, 12, 34, w - 24, h - 58, cl);
    });
    setInterval(function () { cl.tick(); if (isVis()) g.redraw(); after({}); if (cl.t % 3 === 0) chips(); }, TICK);
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 5 — Services ═════ */
  (function () {
    var lab = document.getElementById('lab-service'); if (!lab) return;
    var cl, s, hits = [], sel = 'web', packets = [], rr = 0, ok = 0, fail = 0, killed = false, raf = null, isVis = visible(lab);
    function reset() { cl = new Cluster(13); cl.addDep('web', 3, 'myapp:1.0', 'web', true); cl.addDep('db', 1, 'myapp:1.0', 'db', true); packets = []; ok = fail = 0; killed = false; rr = 0; $$(lab, '[data-in="sel"] button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === 'web'); }); sel = 'web'; update(); note(lab, 'The Service <code>web</code> has a fixed address. Send some requests and watch where they go.'); }
    function eps() { return cl.running().filter(function (p) { return p.labels.app === sel; }); }
    function update() { out(lab, 'ep', eps().length); out(lab, 'okf', ok + ' / ' + fail); if (isVis() && !raf) s.redraw(); }
    function send() {
      var e = eps(), pk = { t0: performance.now(), pod: null };
      if (!e.length) { pk.fail = true; fail++; if (sel === 'wbe') K.done('k-s-typo'); note(lab, '<b>Request failed: no endpoints.</b> No Pod has the label <code>app: ' + sel + '</code>, so the Service has nowhere to send traffic, even though the web Pods are perfectly healthy.', 'bad'); }
      else {
        pk.pod = e[rr++ % e.length]; ok++;
        if (sel === 'web' && ok >= 5) K.done('k-s-send');
        if (sel === 'web' && killed) { K.done('k-s-kill'); note(lab, '<b>No failed requests.</b> The deleted Pod dropped out of the endpoint list at once, and the others kept serving while its replacement started (new name, new IP).', 'good'); }
        else if (sel === 'db') note(lab, 'Now the Service sends web traffic to the <b>database</b> Pod. The selector decides everything, so a wrong label means the wrong target.', 'warn');
        else note(lab, 'Request → Service → <b>' + pk.pod.name + '</b> (' + pk.pod.ip + '). Requests rotate across all ' + e.length + ' matching Pods.', 'good');
      }
      packets.push(pk); update(); anim();
    }
    function anim() { if (raf) return; raf = requestAnimationFrame(function loop() { s.redraw(); packets = packets.filter(function (p) { return performance.now() - p.t0 < 1100; }); if (packets.length) raf = requestAnimationFrame(loop); else { raf = null; s.redraw(); } }); }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), narrow = w < 560, cx = 34, sx = narrow ? 150 : 120, cy = narrow ? 70 : h / 2, left = narrow ? 12 : 190, ctop = narrow ? 118 : 40;
      K.text(ctx, '💻', cx, cy + 8, c.text, '24px sans-serif', 'center'); K.text(ctx, 'client', cx, cy + 30, c.muted, '600 10px Inter, sans-serif', 'center');
      K.roundRect(ctx, sx - 42, cy - 34, 84, 68, 12); ctx.fillStyle = K.rgba(c.accent, 0.15); ctx.fill(); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5; ctx.stroke();
      K.text(ctx, 'Service', sx, cy - 14, c.accent, '700 11px Inter, sans-serif', 'center'); K.text(ctx, 'web', sx, cy + 2, c.text, '700 12px JetBrains Mono, monospace', 'center');
      K.text(ctx, '10.96.41.7', sx, cy + 16, c.muted, '600 9.5px JetBrains Mono, monospace', 'center'); K.text(ctx, 'app: ' + sel, sx, cy + 28, sel === 'web' ? c.good : c.bad, '700 9.5px JetBrains Mono, monospace', 'center');
      hits = drawCluster(ctx, left, ctop, w - left - 12, h - ctop - 20, cl);
      hits.forEach(function (b) { if (b.pod.phase === 'Running' && b.pod.labels.app === sel) { ctx.strokeStyle = K.rgba(c.accent, 0.25); ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(sx + 42, cy); ctx.lineTo(b.x, b.y + b.h / 2); ctx.stroke(); ctx.setLineDash([]); } });
      var now = performance.now();
      packets.forEach(function (pk) {
        var u = Math.min(1, (now - pk.t0) / 900), x, y;
        if (u < 0.4 || pk.fail) { var v = Math.min(1, u / 0.4); x = cx + 16 + (sx - 42 - cx - 16) * v; y = cy; if (pk.fail && u > 0.4) { K.text(ctx, '✕', sx - 50, cy - 40, c.bad, '700 18px sans-serif', 'center'); return; } }
        else { var b = hits.filter(function (q) { return q.pod === pk.pod; })[0], tx = b ? b.x : w - 20, ty = b ? b.y + b.h / 2 : cy, v2 = (u - 0.4) / 0.6; x = sx + 42 + (tx - sx - 42) * v2; y = cy + (ty - cy) * v2; }
        K.dot(ctx, x, y, 5, pk.fail ? c.bad : c.hl);
      });
    });
    $(lab, 'canvas').addEventListener('pointerdown', function (e) { var p = hitPod(hits, s.point(e)); if (p && cl.kill(p)) { if (p.labels.app === 'web') killed = true; note(lab, 'Deleted <code>' + p.name + '</code>. Keep sending requests.'); update(); } });
    K.seg(lab, 'sel', function (v) { sel = v; rr = 0; update(); });
    K.on(lab, 'send', send);
    K.on(lab, 'burst', function () { for (var i = 0; i < 6; i++) setTimeout(send, i * 180); });
    $(lab, '[data-reset]').addEventListener('click', reset);
    setInterval(function () { cl.tick(); update(); }, TICK);
    reset();
  })();

  /* ═════ Lab 6 — rolling updates ═════ */
  (function () {
    var lab = document.getElementById('lab-rollout'); if (!lab) return;
    var cl, s, hist, low, target, sawBad, isVis = visible(lab);
    function reset() { cl = new Cluster(21); cl.addDep('web', 4, 'myapp:v1', 'web', true); hist = []; low = null; target = null; sawBad = false; out(lab, 'low', '—'); update(); note(lab, '4 Pods run <b>v1</b>. Deploy v2 and watch the graph of serving Pods underneath.'); }
    function serving() { return cl.running('web').length; }
    function update() {
      var d = cl.deps.web, alive = cl.alive('web'), sv = serving(), rolling = alive.some(function (p) { return p.image !== d.image; }) || alive.some(function (p) { return p.phase !== 'Running'; });
      out(lab, 'avail', sv);
      if (target && rolling) { low = low == null ? sv : Math.min(low, sv); out(lab, 'low', low); }
      var crash = alive.some(function (p) { return p.phase === 'CrashLoopBackOff'; });
      if (crash) { sawBad = true; K.done('k-u-bad'); note(lab, '<b>v3 is crashing</b> (CrashLoopBackOff), so it never becomes ready and the rollout <em>stalls</em>. The old Pods keep serving: ' + sv + ' still up. Users see no outage. Now roll back.', 'bad'); }
      else if (target === 'v2' && !rolling && d.image === 'myapp:v2') { if (low != null && low >= 4) K.done('k-u-v2'); note(lab, '<b>Rolled out v2</b> with serving Pods never below ' + (low == null ? 4 : low) + '. Zero downtime.', 'good'); target = 'done'; }
      else if (target === 'undo' && !rolling) { if (sawBad) K.done('k-u-undo'); note(lab, '<b>Rolled back</b> to ' + d.image.split(':')[1] + '. The broken Pods are gone.', 'good'); target = 'done'; }
      else if (target && target !== 'done' && rolling) note(lab, 'Rolling… one new Pod starts; only when it\'s <b>Running</b> does an old one terminate.', 'warn');
      if (isVis()) s.redraw();
    }
    s = K.canvas($(lab, 'canvas'), function (ctx, w, h) {
      var c = K.col(), gh = 70, d = cl.deps.web;
      K.text(ctx, 'Deployment web → ' + d.image + '   (replicas 4, max surge 1)', 14, 20, c.text2, '700 11px JetBrains Mono, monospace');
      drawCluster(ctx, 12, 30, w - 24, h - gh - 46, cl);
      var y0 = h - 12, y1 = h - gh, X = function (i) { return 40 + (w - 54) * i / 59; }, Y = function (v) { return y0 - (y0 - y1) * v / 5; };
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; [0, 4].forEach(function (v) { ctx.beginPath(); ctx.moveTo(40, Y(v)); ctx.lineTo(w - 14, Y(v)); ctx.stroke(); K.text(ctx, v, 32, Y(v) + 4, c.muted, '600 10px JetBrains Mono, monospace', 'right'); });
      K.text(ctx, 'serving Pods over time', 44, y1 - 4, c.muted, '600 10px Inter, sans-serif');
      ctx.strokeStyle = c.accent2; ctx.lineWidth = 2; ctx.beginPath(); hist.forEach(function (v, i) { if (i) ctx.lineTo(X(i), Y(v)); else ctx.moveTo(X(i), Y(v)); }); ctx.stroke();
    });
    K.on(lab, 'v2', function () { if (cl.setImage('web', 'myapp:v2')) { target = 'v2'; low = null; note(lab, 'Rolling out v2…', 'warn'); } });
    K.on(lab, 'v3', function () { if (cl.setImage('web', 'myapp:v3')) { target = 'v3'; low = null; note(lab, 'Rolling out v3…', 'warn'); } });
    K.on(lab, 'undo', function () { if (cl.undo('web')) { target = 'undo'; note(lab, '<code>kubectl rollout undo</code>: going back to ' + cl.deps.web.image.split(':')[1] + '…', 'warn'); } else note(lab, 'Nothing to undo yet: there\'s no previous version.'); });
    $(lab, '[data-reset]').addEventListener('click', reset);
    setInterval(function () { cl.tick(); hist.push(serving()); if (hist.length > 60) hist.shift(); update(); }, TICK);
    reset();
  })();

  /* ─── Copy buttons ─── */
  $$(document, '[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.closest('.code').querySelector('pre').innerText;
      var ok = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () {}); else ok();
    });
  });
})();
