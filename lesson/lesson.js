/* ============================================================
   Deep Dive From Scratch — shared lesson framework (see lesson.css)
   Page markup conventions:
     <body class="lesson" data-lesson="slug">
     <nav id="lesson-toc" class="lesson-toc"></nav>          filled in here
     <section class="chapter" id="…" data-title="…">          one per chapter
     <li data-task="id">…</li>                                Lesson.done('id') ticks it
     <div class="quiz" data-quiz="id"> … <button class="quiz-opt" data-correct data-why="…">
     <div class="derive"> <ol><li>…</li></ol> </div>          revealed step by step
     <dfn data-term="key">…</dfn> + <script type="application/json" id="glossary">
   A chapter counts as complete once all of its tasks and quizzes are done
   (chapters with neither complete when read).
   ============================================================ */
(function () {
  var body = document.body;
  var slug = body.dataset.lesson || location.pathname;
  var KEY = 'ddfs-progress:' + slug;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var chapters = [].slice.call(document.querySelectorAll('.chapter'));

  /* ─── Saved progress ─── */
  var state = { tasks: {}, quizzes: {}, read: {} };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) state = Object.assign(state, saved); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  /* ─── Theme-aware colours and canvases ─── */
  var themeListeners = [];
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  new MutationObserver(function () { themeListeners.forEach(function (fn) { fn(); }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Sets up a crisp canvas that redraws on resize and theme change.
  // draw(ctx, width, height) receives CSS-pixel dimensions.
  function canvas(el, draw) {
    var ctx = el.getContext('2d'), w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var api = {
      ctx: ctx, get w() { return w; }, get h() { return h; },
      redraw: function () { if (!w) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); draw(ctx, w, h); },
      // pointer position in CSS pixels relative to the canvas
      point: function (e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    };
    function size() {
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      w = r.width; h = r.height;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      api.redraw();
    }
    // ResizeObserver fires once on observe, after the caller has set up its state
    new ResizeObserver(size).observe(el);
    themeListeners.push(function () { if (w) api.redraw(); });
    return api;
  }

  /* ─── Progress bar ─── */
  var bar = document.createElement('div');
  bar.className = 'lesson-progress';
  bar.innerHTML = '<i></i>';
  body.prepend(bar);
  function onScroll() {
    var main = document.querySelector('.lesson-main');
    if (!main) return;
    var r = main.getBoundingClientRect(), total = r.height - innerHeight * 0.6;
    var p = Math.max(0, Math.min(1, -r.top / (total || 1)));
    bar.firstChild.style.width = (p * 100).toFixed(1) + '%';
  }
  addEventListener('scroll', onScroll, { passive: true });

  /* ─── Table of contents ─── */
  var toc = document.getElementById('lesson-toc');
  var ring = function (cls) {
    return '<svg class="toc-ring ' + (cls || '') + '" viewBox="0 0 44 44"><defs><linearGradient id="toc-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c83ff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs>' +
      '<circle class="bg" cx="22" cy="22" r="18"/><circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle">0%</text></svg>';
  };
  if (toc) {
    toc.innerHTML =
      '<button class="toc-fab" type="button" aria-expanded="false">' + ring() + '<span>Chapters</span></button>' +
      '<div class="toc-panel"><div class="toc-head">' + ring() + '<div><b>Your progress</b><span class="toc-count"></span></div></div>' +
      '<ol class="toc-list">' + chapters.map(function (c, i) {
        var t = c.dataset.title || (c.querySelector('h2') || {}).textContent || ('Chapter ' + (i + 1));
        return '<li><a href="#' + c.id + '" data-ch="' + c.id + '"><span class="dot">' + i + '</span><span>' + t + '</span></a></li>';
      }).join('') + '</ol><button class="toc-reset" type="button">Reset my progress</button></div>';
    var fab = toc.querySelector('.toc-fab');
    fab.addEventListener('click', function () { var o = toc.classList.toggle('open'); fab.setAttribute('aria-expanded', o); });
    toc.addEventListener('click', function (e) { if (e.target.closest('.toc-list a')) toc.classList.remove('open'); });
    toc.querySelector('.toc-reset').addEventListener('click', function () {
      if (!confirm('Reset your progress for this lesson?')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });
  }

  function chapterItems(c) {
    return { tasks: [].slice.call(c.querySelectorAll('[data-task]')), quizzes: [].slice.call(c.querySelectorAll('.quiz[data-quiz]')) };
  }
  function chapterDone(c) {
    var it = chapterItems(c);
    if (!it.tasks.length && !it.quizzes.length) return !!state.read[c.id];
    return it.tasks.every(function (t) { return state.tasks[t.dataset.task]; }) &&
           it.quizzes.every(function (q) { return state.quizzes[q.dataset.quiz]; });
  }
  function refreshProgress() {
    var done = chapters.filter(chapterDone);
    chapters.forEach(function (c) {
      var d = chapterDone(c);
      c.classList.toggle('done', d);
      var a = toc && toc.querySelector('a[data-ch="' + c.id + '"]');
      if (a) a.classList.toggle('done', d);
    });
    var pct = chapters.length ? Math.round(done.length / chapters.length * 100) : 0;
    document.querySelectorAll('.toc-ring').forEach(function (r) {
      r.querySelector('.fg').setAttribute('stroke-dashoffset', (113.1 * (1 - pct / 100)).toFixed(1));
      r.querySelector('text').textContent = pct + '%';
    });
    var cnt = toc && toc.querySelector('.toc-count');
    if (cnt) cnt.textContent = done.length + ' of ' + chapters.length + ' chapters complete';
  }

  // Scroll spy + mark reading-only chapters as read
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      if (toc) toc.querySelectorAll('.toc-list a').forEach(function (a) { a.classList.toggle('active', a.dataset.ch === id); });
      var it = chapterItems(en.target);
      if (!it.tasks.length && !it.quizzes.length && !state.read[id]) { state.read[id] = true; save(); refreshProgress(); }
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  chapters.forEach(function (c) { spy.observe(c); });

  /* ─── Tasks ─── */
  function done(id) {
    var li = document.querySelector('[data-task="' + id + '"]');
    if (state.tasks[id]) return false;
    state.tasks[id] = true; save();
    if (li) { li.classList.add('done', 'pop'); }
    refreshProgress();
    return true;
  }
  document.querySelectorAll('[data-task]').forEach(function (li) { if (state.tasks[li.dataset.task]) li.classList.add('done'); });
  document.querySelectorAll('.tasks').forEach(function (box) {
    var h = box.querySelector('h5');
    if (h && !h.querySelector('.tally')) h.insertAdjacentHTML('beforeend', '<span class="tally"></span>');
  });
  function tally() {
    document.querySelectorAll('.tasks').forEach(function (box) {
      var all = box.querySelectorAll('[data-task]'), n = box.querySelectorAll('[data-task].done').length;
      var t = box.querySelector('.tally'); if (t) t.textContent = n + '/' + all.length;
    });
  }
  new MutationObserver(tally).observe(document.querySelector('.lesson-main') || body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  tally();

  /* ─── Quizzes ─── */
  document.querySelectorAll('.quiz[data-quiz]').forEach(function (q) {
    var id = q.dataset.quiz, why = q.querySelector('.quiz-why');
    var opts = [].slice.call(q.querySelectorAll('.quiz-opt'));
    opts.forEach(function (o, i) { o.insertAdjacentHTML('afterbegin', '<span class="k">' + String.fromCharCode(65 + i) + '</span>'); o.type = 'button'; });
    function showRight(o, animate) {
      opts.forEach(function (x) { x.disabled = true; x.classList.remove('wrong'); });
      o.classList.add('right');
      why.className = 'quiz-why show right';
      why.innerHTML = '<b>Correct.</b> ' + (o.dataset.why || '');
      if (animate && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([why]).catch(function () {});
    }
    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        if (o.hasAttribute('data-correct')) {
          showRight(o, true);
          if (!state.quizzes[id]) { state.quizzes[id] = true; save(); refreshProgress(); }
        } else {
          opts.forEach(function (x) { x.classList.remove('wrong'); });
          void o.offsetWidth; o.classList.add('wrong');
          why.className = 'quiz-why show wrong';
          why.innerHTML = '<b>Not quite.</b> ' + (o.dataset.why || 'Have another look and try again.');
          if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([why]).catch(function () {});
        }
      });
    });
    if (state.quizzes[id]) { var right = q.querySelector('[data-correct]'); if (right) showRight(right, false); }
  });

  /* ─── Step-by-step derivations ─── */
  document.querySelectorAll('.derive').forEach(function (d) {
    var steps = [].slice.call(d.querySelectorAll('ol > li')), shown = 1;
    var count = d.querySelector('.count'), next = d.querySelector('[data-next]'), all = d.querySelector('[data-all]');
    function render(animateFrom) {
      steps.forEach(function (s, i) {
        s.classList.toggle('hidden', i >= shown);
        if (animateFrom != null && i >= animateFrom && i < shown) { s.classList.remove('reveal'); void s.offsetWidth; s.classList.add('reveal'); }
      });
      if (count) count.textContent = 'Step ' + Math.min(shown, steps.length) + ' of ' + steps.length;
      var finished = shown >= steps.length;
      if (next) { next.disabled = finished; next.textContent = finished ? 'All steps shown' : 'Show next step →'; }
      if (all) all.style.display = finished ? 'none' : '';
    }
    if (next) next.addEventListener('click', function () { var from = shown; shown = Math.min(steps.length, shown + 1); render(from); });
    if (all) all.addEventListener('click', function () { var from = shown; shown = steps.length; render(from); });
    render();
  });

  /* ─── Glossary tooltips ─── */
  var glossary = {};
  try { glossary = JSON.parse((document.getElementById('glossary') || {}).textContent || '{}'); } catch (e) {}
  var pop = document.createElement('div');
  pop.className = 'gloss-pop'; pop.setAttribute('role', 'tooltip');
  body.appendChild(pop);
  function showGloss(el) {
    var g = glossary[el.dataset.term]; if (!g) return;
    pop.innerHTML = '<b>' + g[0] + '</b>' + g[1];
    var r = el.getBoundingClientRect();
    pop.style.left = Math.max(12, Math.min(innerWidth - 312, r.left)) + 'px';
    pop.style.top = (r.bottom + 8 + 120 > innerHeight ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + 'px';
    pop.classList.add('show');
  }
  function hideGloss() { pop.classList.remove('show'); }
  document.querySelectorAll('dfn[data-term]').forEach(function (d) {
    d.tabIndex = 0;
    d.addEventListener('mouseenter', function () { showGloss(d); });
    d.addEventListener('focus', function () { showGloss(d); });
    d.addEventListener('mouseleave', hideGloss);
    d.addEventListener('blur', hideGloss);
    d.addEventListener('click', function (e) { e.preventDefault(); pop.classList.contains('show') ? hideGloss() : showGloss(d); });
  });
  addEventListener('scroll', hideGloss, { passive: true });

  /* ─── Reveal chapter content as it scrolls in ─── */
  if (!reduce && 'IntersectionObserver' in window) {
    var rev = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove('pre-reveal'); rev.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.lesson-main .chapter > *').forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre-reveal'); rev.observe(el); }
    });
  }

  refreshProgress();
  onScroll();

  window.Lesson = { done: done, isDone: function (id) { return !!state.tasks[id]; }, canvas: canvas, cssVar: cssVar, onTheme: function (fn) { themeListeners.push(fn); }, reduce: reduce };
})();
