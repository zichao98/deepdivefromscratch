/* ============================================================
   Deep Dive From Scratch — homepage motion and search.
   ============================================================ */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ─── Hero: drifting neural network that leans toward the pointer ─── */
  var canvas = document.querySelector('.hero-canvas');
  if (canvas && !reduce) {
    var ctx = canvas.getContext('2d');
    var hero = canvas.parentElement;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var nodes = [], W = 0, H = 0, mouse = { x: -9999, y: -9999 }, c1 = '124,131,255', c2 = '45,212,191', running = true;
    function readColors() {
      var css = getComputedStyle(document.documentElement);
      c1 = css.getPropertyValue('--net-node').trim() || c1;
      c2 = css.getPropertyValue('--net-node-2').trim() || c2;
    }
    function resize() {
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      var target = Math.round(Math.min(90, W * H / 14000));
      while (nodes.length < target) nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 1.8, t: Math.random() < .3 });
      nodes.length = target;
    }
    function frame() {
      if (!running) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var link = Math.min(150, W / 7);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var dx = mouse.x - n.x, dy = mouse.y - n.y, d2 = dx * dx + dy * dy;
        if (d2 < 40000) { n.vx += dx * 0.00002; n.vy += dy * 0.00002; }
        n.vx *= 0.995; n.vy *= 0.995;
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        for (var j = i + 1; j < nodes.length; j++) {
          var m = nodes[j], ex = n.x - m.x, ey = n.y - m.y, e = Math.sqrt(ex * ex + ey * ey);
          if (e < link) {
            ctx.strokeStyle = 'rgba(' + (n.t || m.t ? c2 : c1) + ',' + (0.22 * (1 - e / link)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
          }
        }
        var near = d2 < 22000;
        ctx.fillStyle = 'rgba(' + (n.t ? c2 : c1) + ',' + (near ? .95 : .55) + ')';
        ctx.beginPath(); ctx.arc(n.x, n.y, near ? n.r + 1.2 : n.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    readColors(); resize(); requestAnimationFrame(frame);
    addEventListener('resize', resize);
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
    // Pause while the hero is off screen
    new IntersectionObserver(function (es) { var vis = es[0].isIntersecting; if (vis && !running) { running = true; requestAnimationFrame(frame); } else if (!vis) running = false; }).observe(hero);
    new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ─── Typewriter of topics ─── */
  var word = document.querySelector('.typer .word');
  if (word) {
    var words = JSON.parse(word.dataset.words), wi = 0;
    if (reduce) word.textContent = words[0];
    else (function type() {
      var w = words[wi % words.length], i = 0;
      (function add() {
        word.textContent = w.slice(0, ++i);
        if (i < w.length) setTimeout(add, 55 + Math.random() * 50);
        else setTimeout(function del() {
          word.textContent = word.textContent.slice(0, -1);
          if (word.textContent) setTimeout(del, 28); else { wi++; setTimeout(type, 250); }
        }, 1600);
      })();
    })();
  }

  /* ─── Count-up stats ─── */
  document.querySelectorAll('[data-count]').forEach(function (el, k) {
    var n = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = n + suffix; return; }
    setTimeout(function () {
      var t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 1100);
        el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, 700 + k * 120);
  });

  /* ─── Reveal cards and steps on scroll ─── */
  var cards = [].slice.call(document.querySelectorAll('.posts-x .post-card'));
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      if (el.classList.contains('steps')) el.classList.add('in');
      else setTimeout(function () { el.classList.remove('reveal'); }, reduce ? 0 : (cards.indexOf(el) % 3) * 90);
      io.unobserve(el);
    });
  }, { threshold: .12 });
  cards.forEach(function (c) { io.observe(c); });
  var steps = document.querySelector('.steps');
  if (steps) io.observe(steps);

  /* ─── Card spotlight + tilt ─── */
  cards.forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
      if (fine && !reduce) {
        card.classList.add('tilting');
        card.style.setProperty('--ry', ((x / r.width) - .5) * 5 + 'deg');
        card.style.setProperty('--rx', (.5 - (y / r.height)) * 5 + 'deg');
      }
    });
    card.addEventListener('pointerleave', function () {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ─── Topic filter with a FLIP shuffle ─── */
  var chips = document.querySelector('.chips');
  if (chips) chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var cat = chip.dataset.cat;
    chips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === chip); });
    var first = new Map(cards.map(function (c) { return [c, c.getBoundingClientRect()]; }));
    cards.forEach(function (c) {
      c.classList.remove('reveal');
      c.classList.toggle('hide', cat !== 'all' && c.dataset.cat !== cat);
      // The featured card only spans two columns in the full list
      c.classList.toggle('featured', cat === 'all' && c.dataset.featured === '1');
    });
    if (reduce) return;
    cards.forEach(function (c) {
      if (c.classList.contains('hide')) return;
      var f = first.get(c), l = c.getBoundingClientRect();
      if (!f.width) c.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,.9,.25,1.15)' });
      else if (f.left !== l.left || f.top !== l.top) c.animate([{ translate: (f.left - l.left) + 'px ' + (f.top - l.top) + 'px' }, { translate: '0 0' }], { duration: 550, easing: 'cubic-bezier(.32,.72,0,1)' });
    });
  });
  cards.forEach(function (c) { if (c.classList.contains('featured')) c.dataset.featured = '1'; });

  /* ─── Search ─── */
  var input = document.getElementById('search-input');
  var box = document.getElementById('search-results');
  if (input && box && window.Fuse && window.DDFS_POSTS) {
    var fuse = new Fuse(window.DDFS_POSTS, { keys: ['title', 'tags'], threshold: 0.35, minMatchCharLength: 2 });
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    input.addEventListener('input', function () {
      var q = input.value.trim();
      var results = q.length < 2 ? [] : fuse.search(q);
      if (!results.length) { box.style.display = 'none'; return; }
      box.innerHTML = results.map(function (r) {
        return '<a class="search-item" href="' + esc(r.item.url) + '">' + esc(r.item.title) + '<span>' + esc(r.item.date) + '</span></a>';
      }).join('');
      box.style.display = 'block';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var first = box.querySelector('a'); if (first) location.href = first.href; }
      if (e.key === 'Escape') { input.value = ''; box.style.display = 'none'; input.blur(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search-wrap')) box.style.display = 'none'; });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }
})();
