/* Git & GitHub lesson — a tiny in-browser Git, a terminal and a live commit graph. Uses window.Kit. */
(function () {
  'use strict';
  var K = window.Kit, $ = K.$, $$ = K.$$, note = K.note, out = K.out, esc = K.esc;

  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function keys() { var s = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) s[k] = 1; return Object.keys(s).sort(); }

  // Line diff (LCS). Returns [[type, line]] with type ' ', '+', '-'.
  function diffLines(a, b) {
    a = a.split('\n'); b = b.split('\n');
    if (a[a.length - 1] === '') a.pop(); if (b[b.length - 1] === '') b.pop();
    var n = a.length, m = b.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L.push([]); for (j = 0; j <= m; j++) L[i].push(0); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var r = []; i = 0; j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { r.push([' ', a[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) r.push(['-', a[i++]]); else r.push(['+', b[j++]]); }
    while (i < n) r.push(['-', a[i++]]); while (j < m) r.push(['+', b[j++]]);
    return r;
  }
  function diffHtml(d) { return d.map(function (x) { return '<span class="' + (x[0] === '+' ? 'add' : x[0] === '-' ? 'del' : 'ctx') + '">' + x[0] + ' ' + esc(x[1]) + '</span>'; }).join(''); }

  /* ═════ A tiny Git ═════ */
  var EDITS = {
    'index.html': ['<p>Welcome to my site!</p>', '<a href="/about">About me</a>', '<img src="me.jpg" alt="Me">', '<footer>© 2026</footer>', '<p>New blog post coming soon</p>'],
    'style.css': ['body { background: #111; color: #eee; }', 'h1 { font-size: 3rem; }', 'a { color: hotpink; }', 'footer { opacity: .6; }'],
    'app.js': ['console.log("hello");', 'const year = 2026;', 'document.title = "My site";', 'alert("Welcome!");'],
    'README.md': ['Built with love.', 'Run it with any web server.', 'Licence: MIT']
  };
  function Repo(seed) {
    this.rand = K.rng(seed || 11); this.inited = false; this.work = {}; this.index = {}; this.commits = {}; this.seq = 0;
    this.branches = {}; this.head = 'main'; this.remote = null; this.remoteRefs = {}; this.tracking = {}; this.upstream = {};
    this.lanes = { main: 0 }; this.editN = {};
  }
  var R = Repo.prototype;
  R.newId = function () { var s = ''; for (var i = 0; i < 7; i++) s += '0123456789abcdef'[Math.floor(this.rand() * 16)]; return this.commits[s] ? this.newId() : s; };
  R.tip = function (b) { return this.branches[b || this.head] || null; };
  R.tree = function (id) { return id ? this.commits[id].tree : {}; };
  R.lane = function (b) { if (!(b in this.lanes)) this.lanes[b] = Object.keys(this.lanes).length; return this.lanes[b]; };
  R.mk = function (msg, parents, tree, branch) { var id = this.newId(); this.commits[id] = { id: id, msg: msg, parents: parents, tree: copy(tree), seq: this.seq++, lane: this.lane(branch) }; return id; };
  R.count = function () { return Object.keys(this.commits).length; };
  R.anc = function (id) { var s = {}, st = id ? [id] : []; while (st.length) { var x = st.pop(); if (s[x]) continue; s[x] = 1; st.push.apply(st, this.commits[x].parents); } return s; };
  R.isAnc = function (a, b) { return !a || !!this.anc(b)[a]; };
  R.edit = function (f) {
    var list = EDITS[f] || ['line'], n = this.editN[f] = (this.editN[f] || 0) + 1, line = list[(n - 1) % list.length] + (n > list.length ? ' ' + n : '');
    var existed = f in this.work; this.work[f] = (this.work[f] || '') + line + '\n'; return existed;
  };
  R.status = function () {
    var H = this.tree(this.tip()), I = this.index, W = this.work, st = { staged: [], unstaged: [], untracked: [] };
    keys(H, I).forEach(function (f) { if (!(f in H)) st.staged.push(['new file', f]); else if (!(f in I)) st.staged.push(['deleted', f]); else if (H[f] !== I[f]) st.staged.push(['modified', f]); });
    Object.keys(I).sort().forEach(function (f) { if (!(f in W)) st.unstaged.push(['deleted', f]); else if (W[f] !== I[f]) st.unstaged.push(['modified', f]); });
    Object.keys(W).sort().forEach(function (f) { if (!(f in I)) st.untracked.push(f); });
    st.dirty = st.staged.length + st.unstaged.length > 0;
    return st;
  };
  R.ahead = function () { var b = this.head, t = this.tracking[b]; if (!this.upstream[b] || !t) return null; var mine = this.anc(this.tip()), theirs = this.anc(t); return Object.keys(mine).filter(function (k) { return !theirs[k]; }).length; };
  R.statusLines = function () {
    var s = this.status(), L = [['On branch ' + this.head]];
    var ah = this.ahead();
    if (ah === 0) L.push(["Your branch is up to date with 'origin/" + this.head + "'."]);
    else if (ah) L.push(["Your branch is ahead of 'origin/" + this.head + "' by " + ah + ' commit' + (ah > 1 ? 's' : '') + '.', 'c-warn'], ['  (use "git push" to publish your local commits)', 'c-dim']);
    if (!this.tip()) L.push(['', ''], ['No commits yet']);
    if (s.staged.length) { L.push([''], ['Changes to be committed:'], ['  (use "git restore --staged <file>..." to unstage)', 'c-dim']); s.staged.forEach(function (x) { L.push(['        ' + (x[0] + ':').padEnd(12) + x[1], 'c-ok']); }); }
    if (s.unstaged.length) { L.push([''], ['Changes not staged for commit:'], ['  (use "git add <file>..." to update what will be committed)', 'c-dim']); s.unstaged.forEach(function (x) { L.push(['        ' + (x[0] + ':').padEnd(12) + x[1], 'c-err']); }); }
    if (s.untracked.length) { L.push([''], ['Untracked files:'], ['  (use "git add <file>..." to include in what will be committed)', 'c-dim']); s.untracked.forEach(function (f) { L.push(['        ' + f, 'c-err']); }); }
    if (!s.staged.length) {
      L.push(['']);
      if (s.unstaged.length) L.push(['no changes added to commit (use "git add" and/or "git commit -a")']);
      else if (s.untracked.length) L.push(['nothing added to commit but untracked files present (use "git add" to track)']);
      else L.push(['nothing to commit, working tree clean', 'c-ok']);
    }
    return L;
  };
  R.add = function (p) {
    var self = this;
    if (p === '.' || p === '-A' || p === '--all') {
      keys(this.work, this.index).forEach(function (f) { if (f in self.work) self.index[f] = self.work[f]; else delete self.index[f]; });
      return null;
    }
    if (p in this.work) { this.index[p] = this.work[p]; return null; }
    if (p in this.index) { delete this.index[p]; return null; }
    return "fatal: pathspec '" + p + "' did not match any files";
  };
  R.unstage = function (f) { var H = this.tree(this.tip()); if (f in H) this.index[f] = H[f]; else delete this.index[f]; };
  R.commit = function (msg) {
    var s = this.status(); if (!s.staged.length) return null;
    var p = this.tip(), id = this.mk(msg, p ? [p] : [], this.index, this.head);
    this.branches[this.head] = id; return { id: id, root: !p, n: s.staged.length, files: s.staged.map(function (x) { return x[1]; }) };
  };
  // Move HEAD's files to another tree, keeping local changes that don't collide.
  R.moveTo = function (id) {
    var H = this.tree(this.tip()), T = this.tree(id), W = this.work, I = this.index, bad = [];
    keys(H, T, W, I).forEach(function (f) { var local = W[f] !== H[f] || I[f] !== H[f]; if (local && T[f] !== H[f]) bad.push(f); });
    if (bad.length) return bad;
    keys(H, T).forEach(function (f) {
      if (W[f] !== H[f] || I[f] !== H[f]) return;
      if (f in T) { W[f] = T[f]; I[f] = T[f]; } else { delete W[f]; delete I[f]; }
    });
    return null;
  };
  R.base = function (a, b) { var A = this.anc(a), self = this; var cand = Object.keys(this.anc(b)).filter(function (k) { return A[k]; }); cand.sort(function (x, y) { return self.commits[y].seq - self.commits[x].seq; }); return cand[0] || null; };
  R.mergeId = function (id, msg) {
    var a = this.tip();
    if (this.isAnc(id, a)) return { type: 'uptodate' };
    if (this.status().dirty) return { type: 'dirty' };
    if (this.isAnc(a, id)) { this.moveTo(id); this.branches[this.head] = id; return { type: 'ff', from: a, to: id }; }
    var base = this.tree(this.base(a, id)), O = this.tree(a), T = this.tree(id), M = {}, conflicts = [];
    keys(base, O, T).forEach(function (f) {
      var o = O[f], t = T[f], b = base[f], v;
      if (o === t) v = o; else if (b === o) v = t; else if (b === t) v = o; else { conflicts.push(f); return; }
      if (v !== undefined) M[f] = v;
    });
    if (conflicts.length) return { type: 'conflict', files: conflicts };
    var self = this;
    keys(O, M).forEach(function (f) { if (f in M) { self.work[f] = M[f]; self.index[f] = M[f]; } else { delete self.work[f]; delete self.index[f]; } });
    var mid = this.mk(msg, [a, id], M, this.head); this.branches[this.head] = mid;
    return { type: 'merge', id: mid };
  };
  R.teammate = function () {
    var base = this.remoteRefs.main, tree = copy(this.tree(base)), first = !('README.md' in tree);
    tree['README.md'] = (tree['README.md'] || '# My site\n') + (first ? 'Contact: team@example.com\n' : 'Updated by the team\n');
    var id = this.mk(first ? 'Add README with contact info' : 'Update README', [base], tree, 'teammate');
    this.remoteRefs.main = id; this.teamIds = (this.teamIds || []).concat(id); return id;
  };
  R.seedSite = function () {
    this.inited = true;
    this.work['index.html'] = '<h1>My site</h1>\n'; this.add('index.html'); this.commit('Add homepage');
    this.work['style.css'] = 'body { font-family: sans-serif; }\n'; this.add('style.css'); this.commit('Add styles');
    return this;
  };

  /* ─── Command interpreter ─── */
  function argv(cmd) { var r = [], m, re = /"([^"]*)"|'([^']*)'|(\S+)/g; while ((m = re.exec(cmd))) r.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]); return r; }
  var HELP = [
    'Shell:  ls · cat <file> · edit <file> · echo "text" > <file> · clear',
    'Git:    git init · git status · git add <file|.> · git commit -m "msg"',
    '        git log [--oneline] · git diff · git branch [name] · git switch [-c] <branch>',
    '        git merge <branch> · git remote add origin <url> · git push [-u origin main] · git pull',
    'Tip: ↑/↓ recall earlier commands.'
  ];
  function exec(repo, cmd, t, ev) {
    var a = argv(cmd), p = function (s, c) { t.print(s, c); }, P = function (lines) { lines.forEach(function (l) { p(l[0], l[1]); }); };
    var c0 = a[0];
    if (c0 === 'help') return P(HELP.map(function (s) { return [s, 'c-dim']; }));
    if (c0 === 'ls') { var fs = Object.keys(repo.work).sort(); return p(fs.length ? fs.join('   ') : '(empty folder)', 'c-hi'); }
    if (c0 === 'cat') { if (!a[1]) return p('usage: cat <file>', 'c-err'); if (!(a[1] in repo.work)) return p('cat: ' + a[1] + ': No such file or directory', 'c-err'); return p(repo.work[a[1]].replace(/\n$/, '')); }
    if (c0 === 'edit' || c0 === 'touch') {
      if (!a[1]) return p('usage: ' + c0 + ' <file>', 'c-err');
      if (c0 === 'touch') { if (!(a[1] in repo.work)) repo.work[a[1]] = ''; return; }
      var existed = repo.edit(a[1]); ev.edit = a[1];
      return p('(' + (existed ? 'edited ' : 'created ') + a[1] + ': added a line; try cat ' + a[1] + ')', 'c-dim');
    }
    if (c0 === 'echo') {
      var m = cmd.match(/^echo\s+("([^"]*)"|'([^']*)'|(\S+))\s*(>>?)\s*(\S+)\s*$/);
      if (!m) return p(a.slice(1).join(' '));
      var txt = (m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) + '\n';
      repo.work[m[6]] = (m[5] === '>>' ? (repo.work[m[6]] || '') : '') + txt; ev.edit = m[6]; return;
    }
    if (c0 !== 'git') return p('bash: ' + c0 + ': command not found (type help)', 'c-err');
    var sub = a[1];
    if (!sub || sub === 'help' || sub === '--help') return P(HELP.map(function (s) { return [s, 'c-dim']; }));
    if (sub === 'init') { var re = repo.inited; repo.inited = true; ev.init = true; return p((re ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in /home/you/site/.git/', 'c-ok'); }
    if (!repo.inited) return p('fatal: not a git repository (or any of the parent directories): .git', 'c-err');
    ev.git = sub;
    switch (sub) {
      case 'status': return P(repo.statusLines());
      case 'add':
        if (!a[2]) return P([['Nothing specified, nothing added.'], ["hint: Maybe you wanted to say 'git add .'?", 'c-dim']]);
        for (var i = 2; i < a.length; i++) { var err = repo.add(a[i]); if (err) return p(err, 'c-err'); }
        return;
      case 'commit': {
        var mi = a.indexOf('-m'), msg = mi > 0 ? a[mi + 1] : null, all = a.indexOf('-a') > 0 || a.indexOf('-am') > 0;
        if (a.indexOf('-am') > 0) msg = a[a.indexOf('-am') + 1];
        if (!msg) return P([['This sandbox needs a message on the command line:', 'c-err'], ['    git commit -m "Describe the change"', 'c-hi']]);
        if (all) Object.keys(repo.index).forEach(function (f) { if (f in repo.work) repo.index[f] = repo.work[f]; else delete repo.index[f]; });
        var r = repo.commit(msg);
        if (!r) { var L = repo.statusLines(); return P(L); }
        ev.commit = r;
        return P([['[' + repo.head + (r.root ? ' (root-commit) ' : ' ') + r.id + '] ' + msg, 'c-ok'], [' ' + r.n + ' file' + (r.n > 1 ? 's' : '') + ' changed: ' + r.files.join(', '), 'c-dim']]);
      }
      case 'log': {
        if (!repo.tip()) return p("fatal: your current branch '" + repo.head + "' does not have any commits yet", 'c-err');
        var one = a.indexOf('--oneline') > 0, anc = repo.anc(repo.tip()), ids = Object.keys(anc).sort(function (x, y) { return repo.commits[y].seq - repo.commits[x].seq; });
        ev.log = true;
        ids.forEach(function (id) {
          var dec = decorations(repo, id), c = repo.commits[id];
          var d = dec.length ? ' <span class="c-hi">(' + dec.map(esc).join(', ') + ')</span>' : '';
          if (one) t.html('<span class="c-warn">' + id + '</span>' + d + ' ' + esc(c.msg));
          else { t.html('<span class="c-warn">commit ' + id + '</span>' + d); p('Author: You <you@example.com>', 'c-dim'); p('    ' + c.msg); p(''); }
        });
        return;
      }
      case 'diff': {
        var st = repo.status(); if (!st.unstaged.length) return p('(no unstaged changes)', 'c-dim');
        st.unstaged.forEach(function (x) { var f = x[1]; t.html('<span class="c-hi">diff --git a/' + esc(f) + ' b/' + esc(f) + '</span>'); diffLines(repo.index[f] || '', repo.work[f] || '').forEach(function (d) { if (d[0] !== ' ') p(d[0] + d[1], d[0] === '+' ? 'c-ok' : 'c-err'); }); });
        return;
      }
      case 'branch': {
        if (!a[2]) { Object.keys(repo.branches).sort().forEach(function (b) { p((b === repo.head ? '* ' : '  ') + b, b === repo.head ? 'c-ok' : ''); }); if (!repo.tip()) p('(no branches until the first commit)', 'c-dim'); return; }
        if (a[2] === '-d' || a[2] === '-D') { var b = a[3]; if (!repo.branches[b]) return p("error: branch '" + b + "' not found", 'c-err'); if (b === repo.head) return p("error: cannot delete the branch you are on", 'c-err'); delete repo.branches[b]; return p('Deleted branch ' + b + '.'); }
        if (!repo.tip()) return p("fatal: not a valid object name: '" + repo.head + "' (make a commit first)", 'c-err');
        if (repo.branches[a[2]]) return p("fatal: a branch named '" + a[2] + "' already exists", 'c-err');
        repo.branches[a[2]] = repo.tip(); ev.branch = a[2]; return;
      }
      case 'switch': case 'checkout': {
        var create = a[2] === '-c' || a[2] === '-b', name = create ? a[3] : a[2];
        if (!name) return p('usage: git ' + sub + ' [' + (sub === 'switch' ? '-c' : '-b') + '] <branch>', 'c-err');
        if (create) {
          if (!repo.tip()) return p("fatal: you need at least one commit before creating a branch", 'c-err');
          if (repo.branches[name]) return p("fatal: a branch named '" + name + "' already exists", 'c-err');
          repo.branches[name] = repo.tip(); repo.head = name; ev.switched = name; return p("Switched to a new branch '" + name + "'", 'c-ok');
        }
        if (!repo.branches[name]) return p('fatal: invalid reference: ' + name, 'c-err');
        if (name === repo.head) return p("Already on '" + name + "'");
        var bad = repo.moveTo(repo.branches[name]);
        if (bad) return P([['error: Your local changes to the following files would be overwritten by checkout:', 'c-err']].concat(bad.map(function (f) { return ['        ' + f, 'c-err']; })).concat([['Please commit your changes before you switch branches.'], ['Aborting']]));
        repo.head = name; ev.switched = name; return p("Switched to branch '" + name + "'", 'c-ok');
      }
      case 'merge': {
        var nm = a[2], target = repo.branches[nm] || (nm && nm.indexOf('origin/') === 0 ? repo.tracking[nm.slice(7)] : null);
        if (!nm || !target) return p('merge: ' + (nm || '') + ' - not something we can merge', 'c-err');
        return report(repo.mergeId(target, "Merge branch '" + nm + "'"), p, P, ev);
      }
      case 'remote': {
        if (a[2] === 'add') {
          if (!a[3] || !a[4]) return p('usage: git remote add <name> <url>', 'c-err');
          if (repo.remote) return p('error: remote ' + a[3] + ' already exists.', 'c-err');
          repo.remote = { name: a[3], url: a[4] }; ev.remote = true; return;
        }
        if (repo.remote) return p(a[2] === '-v' ? repo.remote.name + '\t' + repo.remote.url + ' (fetch)\n' + repo.remote.name + '\t' + repo.remote.url + ' (push)' : repo.remote.name);
        return;
      }
      case 'push': {
        if (!repo.remote) return P([['fatal: No configured push destination.', 'c-err'], ['Add one with:  git remote add origin <url>', 'c-dim']]);
        var rest = a.slice(2).filter(function (x) { return x[0] !== '-'; }), setU = a.indexOf('-u') > 0 || a.indexOf('--set-upstream') > 0, br = rest[1];
        if (rest[0] && rest[0] !== repo.remote.name) return p("fatal: '" + rest[0] + "' does not appear to be a git repository", 'c-err');
        if (!br) { if (repo.upstream[repo.head]) br = repo.head; else return P([['fatal: The current branch ' + repo.head + ' has no upstream branch.', 'c-err'], ['To push the current branch and set the remote as upstream, use'], [''], ['    git push -u origin ' + repo.head, 'c-hi']]); }
        var local = repo.branches[br]; if (!local) return p('error: src refspec ' + br + ' does not match any', 'c-err');
        var rt = repo.remoteRefs[br], url = repo.remote.url;
        if (rt === local) return p('Everything up-to-date');
        if (rt && !repo.isAnc(rt, local)) {
          ev.reject = true; repo.rejected = true;
          return P([['To ' + url], [' ! [rejected]        ' + br + ' -> ' + br + ' (fetch first)', 'c-err'], ["error: failed to push some refs to '" + url + "'", 'c-err'], ['hint: Updates were rejected because the remote contains work that you do not', 'c-warn'], ['hint: have locally. Integrate the remote changes (e.g. \'git pull\')', 'c-warn'], ['hint: before pushing again.', 'c-warn']]);
        }
        repo.remoteRefs[br] = local; repo.tracking[br] = local; ev.push = br;
        var L2 = [['To ' + url], [rt ? '   ' + rt + '..' + local + '  ' + br + ' -> ' + br : ' * [new branch]      ' + br + ' -> ' + br, 'c-ok']];
        if (setU) { repo.upstream[br] = true; L2.push(["branch '" + br + "' set up to track 'origin/" + br + "'.", 'c-dim']); }
        return P(L2);
      }
      case 'fetch': case 'pull': {
        if (!repo.remote) return p("fatal: 'origin' does not appear to be a git repository", 'c-err');
        var b2 = a[3] || repo.head;
        if (!a[2] && !repo.upstream[repo.head]) return P([['There is no tracking information for the current branch.', 'c-err'], ['Push with -u first, or name it:  git pull origin ' + repo.head, 'c-dim']]);
        var before = repo.tracking[b2], now = repo.remoteRefs[b2];
        if (!now) return p("fatal: couldn't find remote ref " + b2, 'c-err');
        repo.tracking[b2] = now;
        if (before !== now) P([['From ' + repo.remote.url], ['   ' + (before || '0000000') + '..' + now + '  ' + b2 + ' -> origin/' + b2, 'c-hi']]);
        if (sub === 'fetch') return;
        ev.pull = true;
        return report(repo.mergeId(now, "Merge branch '" + b2 + "' of " + repo.remote.url), p, P, ev);
      }
      case 'clone': return p('(This sandbox already starts inside a project folder, so there\'s nothing to clone.)', 'c-dim');
      default: return p("git: '" + sub + "' is not a git command. See 'git help'.", 'c-err');
    }
  }
  function report(r, p, P, ev) {
    ev.merge = r.type;
    if (r.type === 'uptodate') return p('Already up to date.');
    if (r.type === 'dirty') return P([['error: Your local changes would be overwritten by merge.', 'c-err'], ['Please commit your changes before you merge.'], ['Aborting']]);
    if (r.type === 'ff') return P([['Updating ' + r.from + '..' + r.to], ['Fast-forward', 'c-ok']]);
    if (r.type === 'merge') return p("Merge made by the 'ort' strategy.", 'c-ok');
    return P(r.files.map(function (f) { return ['CONFLICT (content): Merge conflict in ' + f, 'c-err']; }).concat([['(Sandbox: merge aborted. Chapter 5 shows how to resolve a conflict.)', 'c-dim']]));
  }
  function decorations(repo, id) {
    var d = [];
    Object.keys(repo.branches).sort(function (x, y) { return x === repo.head ? -1 : y === repo.head ? 1 : x < y ? -1 : 1; }).forEach(function (b) { if (repo.branches[b] === id) d.push(b === repo.head ? 'HEAD -> ' + b : b); });
    Object.keys(repo.tracking).forEach(function (b) { if (repo.tracking[b] === id) d.push('origin/' + b); });
    return d;
  }

  /* ─── Commit graph ─── */
  function drawGraph(ctx, w, h, repo) {
    var c = K.col(), LC = [c.accent, c.accent2, c.warn, c.good, c.hl];
    K.text(ctx, 'COMMIT GRAPH', 14, 22, c.muted, '700 10px JetBrains Mono, monospace');
    if (!repo.inited) return K.text(ctx, 'Not a Git repository yet — run git init', w / 2, h / 2, c.muted, '600 13px Inter, sans-serif', 'center');
    var tips = Object.keys(repo.branches).map(function (b) { return repo.branches[b]; }).concat(Object.keys(repo.tracking).map(function (b) { return repo.tracking[b]; }));
    var vis = {}; tips.forEach(function (t) { var s = repo.anc(t); for (var k in s) vis[k] = 1; });
    var arr = Object.keys(vis).map(function (k) { return repo.commits[k]; }).sort(function (x, y) { return x.seq - y.seq; });
    if (!arr.length) return K.text(ctx, 'No commits yet — git add, then git commit', w / 2, h / 2, c.muted, '600 13px Inter, sans-serif', 'center');
    arr = arr.slice(-10);
    var lanes = []; arr.forEach(function (cm) { if (lanes.indexOf(cm.lane) < 0) lanes.push(cm.lane); }); lanes.sort();
    var top = 96, rowH = Math.min(58, (h - top - 70) / Math.max(1, lanes.length - 1 || 1)), pl = 34, pr = 46;
    var dx = arr.length > 1 ? Math.min(66, (w - pl - pr) / (arr.length - 1)) : 0, pos = {};
    arr.forEach(function (cm, i) { pos[cm.id] = { x: pl + i * dx, y: top + lanes.indexOf(cm.lane) * rowH, c: LC[cm.lane % LC.length] }; });
    arr.forEach(function (cm) {
      var q = pos[cm.id];
      cm.parents.forEach(function (pid) {
        var pp = pos[pid];
        ctx.strokeStyle = K.rgba(q.c, 0.7); ctx.lineWidth = 2.5; ctx.beginPath();
        if (!pp) { ctx.moveTo(q.x - 22, q.y); ctx.lineTo(q.x, q.y); ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); return; }
        ctx.moveTo(pp.x, pp.y);
        if (pp.y === q.y) ctx.lineTo(q.x, q.y); else ctx.bezierCurveTo(pp.x + dx * 0.6, pp.y, q.x - dx * 0.6, q.y, q.x, q.y);
        ctx.stroke();
      });
    });
    var labels = {};
    Object.keys(repo.branches).forEach(function (b) { (labels[repo.branches[b]] = labels[repo.branches[b]] || []).push({ t: b === repo.head ? 'HEAD → ' + b : b, head: b === repo.head }); });
    Object.keys(repo.tracking).forEach(function (b) { (labels[repo.tracking[b]] = labels[repo.tracking[b]] || []).push({ t: 'origin/' + b, remote: true }); });
    arr.forEach(function (cm) {
      var q = pos[cm.id];
      K.dot(ctx, q.x, q.y, cm.parents.length > 1 ? 8 : 7, q.c, cm.parents.length > 1 ? c.surface : null);
      if (dx >= 44 || arr.length === 1) K.text(ctx, cm.id.slice(0, 4), q.x, q.y + 22, c.muted, '600 10px JetBrains Mono, monospace', 'center');
      (labels[cm.id] || []).forEach(function (L, k) {
        ctx.font = '700 10.5px JetBrains Mono, monospace';
        var tw = ctx.measureText(L.t).width + 14, x = Math.max(4, Math.min(w - tw - 4, q.x - tw / 2)), below = lanes.indexOf(cm.lane) > 0, y = below ? q.y + 42 + k * 22 : q.y - 30 - k * 22;
        K.roundRect(ctx, x, y - 9, tw, 18, 9);
        ctx.fillStyle = L.head ? c.accent : L.remote ? K.rgba(c.accent2, 0.18) : c.surface2; ctx.fill();
        ctx.strokeStyle = L.remote ? c.accent2 : L.head ? c.accent : c.border; ctx.lineWidth = 1; ctx.stroke();
        K.text(ctx, L.t, x + tw / 2, y + 4, L.head ? '#fff' : L.remote ? c.accent2 : c.text, '700 10.5px JetBrains Mono, monospace', 'center');
      });
    });
    var last = arr[arr.length - 1];
    K.text(ctx, 'latest: "' + (last.msg.length > 34 ? last.msg.slice(0, 33) + '…' : last.msg) + '"', 14, h - 12, c.text2, '600 11px Inter, sans-serif');
  }

  /* ─── Terminal lab factory ─── */
  function termLab(id, setup, hooks) {
    var lab = document.getElementById(id); if (!lab) return;
    var repo, g, t;
    function prompt() { t.prompt('~/site' + (repo.inited ? ' (' + repo.head + ')' : '') + ' $'); }
    function start() {
      repo = setup(); t.clear();
      t.print('Practice terminal: nothing here touches your real computer.', 'c-dim');
      t.print('Type help to see what works. Click a chip below to paste a command.', 'c-dim');
      prompt(); g && g.redraw(); hooks.after(repo, {}, '', lab);
    }
    t = K.term($(lab, '[data-term]'), { scope: lab, handler: function (cmd, api) { var ev = {}; exec(repo, cmd, api, ev); prompt(); g.redraw(); hooks.after(repo, ev, cmd, lab); } });
    g = K.canvas($(lab, '.graph canvas'), function (ctx, w, h) { drawGraph(ctx, w, h, repo); });
    var rb = $(lab, '[data-reset]'); if (rb) rb.addEventListener('click', start);
    if (hooks.init) hooks.init(lab, function () { return repo; }, function () { g.redraw(); }, t);
    start();
  }

  /* ═════ Lab 2 — first repo ═════ */
  termLab('lab-first', function () { var r = new Repo(3); r.work['index.html'] = '<h1>My site</h1>\n'; r.work['style.css'] = 'body { font-family: sans-serif; }\n'; return r; }, {
    after: function (repo, ev, cmd, lab) {
      var st = repo.status(), n = repo.count();
      if (repo.inited) K.done('gh-f-init');
      if (repo.inited && ev.git === 'status') K.done('gh-f-status');
      if (n >= 1) K.done('gh-f-commit');
      if (n >= 2 && ev.log) K.done('gh-f-log');
      if (!repo.inited) note(lab, 'Start with <code>git init</code> to turn this folder into a repository. (<code>ls</code> shows the files.)');
      else if (!n && !st.staged.length) note(lab, ev.git === 'status' ? 'Git sees two <b>untracked</b> files: it isn\'t tracking them yet. Stage them with <code>git add .</code>' : 'Repository created (a hidden <code>.git</code> folder). Now ask Git what it sees: <code>git status</code>.');
      else if (!n) note(lab, 'Files staged. Now seal the box: <code>git commit -m "Add homepage"</code>.', 'good');
      else if (n === 1 && !ev.commit && !ev.edit && !st.dirty) note(lab, 'Your first commit! Now <code>edit index.html</code>, then add and commit again.', 'good');
      else if (n === 1 && ev.commit) note(lab, 'Your first commit! Now <code>edit index.html</code>, then add and commit again.', 'good');
      else if (n === 1 && st.dirty) note(lab, 'Modified. Run <code>git status</code> to see it, then <code>git add .</code> and <code>git commit -m "…"</code>.');
      else if (n >= 2 && !ev.log) note(lab, 'Two commits in the graph. View the history with <code>git log --oneline</code>.', 'good');
      else if (ev.log) note(lab, 'Newest first. Each line is a commit ID and its message; <code>HEAD -&gt; main</code> marks where you are.', 'good');
    }
  });

  /* ═════ Lab 3 — branches ═════ */
  termLab('lab-branch', function () { return new Repo(5).seedSite(); }, {
    after: function (repo, ev, cmd, lab) {
      var main = repo.branches.main, feats = Object.keys(repo.branches).filter(function (b) { return b !== 'main'; });
      var ahead = feats.filter(function (b) { return !repo.isAnc(repo.branches[b], main); });
      var merged = feats.filter(function (b) { return repo.commits[repo.branches[b]].lane !== 0 && repo.isAnc(repo.branches[b], main); });
      if (repo.head !== 'main') K.done('gh-b-create');
      if (ev.commit && repo.head !== 'main') { K.done('gh-b-commit'); repo.featCommit = true; }
      if (repo.head === 'main' && ahead.length && (ev.switched || /^cat\b/.test(cmd))) K.done('gh-b-back');
      if (merged.length) K.done('gh-b-merge');
      if (ev.merge === 'ff') note(lab, '<b>Fast-forward:</b> main had no new commits, so Git just slid the <code>main</code> label up to your branch. Your feature is now on main.', 'good');
      else if (ev.merge === 'merge') note(lab, '<b>Merge commit</b> (the ringed dot): both branches had new work, so Git joined them with a commit that has two parents.', 'good');
      else if (ev.merge === 'conflict') note(lab, 'Both branches changed the same lines. That\'s a conflict; Chapter 5 teaches you how to resolve it. Reset to try again.', 'warn');
      else if (repo.head === 'main' && ahead.length) note(lab, 'Back on main, and your branch\'s change is gone from the files! It\'s safe on <code>' + ahead[0] + '</code>. Bring it in with <code>git merge ' + ahead[0] + '</code>.', 'warn');
      else if (repo.head !== 'main' && repo.commits[repo.tip()].lane !== 0) note(lab, 'Your commit lives only on <code>' + repo.head + '</code>; <code>main</code> didn\'t move. Now <code>git switch main</code>.', 'good');
      else if (repo.head !== 'main') note(lab, 'You\'re on <code>' + repo.head + '</code> (see HEAD in the graph). It points at the same commit as main for now. Edit, add and commit.');
      else if (merged.length) note(lab, 'Merged: the <code>' + merged[0] + '</code> work is now part of <code>main</code>. Run <code>git log --oneline</code> to see the combined history.', 'good');
      else note(lab, 'This repo already has two commits on <code>main</code>. Create a branch for a new feature: <code>git switch -c dark-mode</code>.');
    }
  });

  /* ═════ Lab 4 — remote ═════ */
  termLab('lab-remote', function () { return new Repo(9).seedSite(); }, {
    init: function (lab, getRepo, redraw, t) {
      K.on(lab, 'team', function () {
        var repo = getRepo(); if (!repo.remoteRefs.main) return;
        var id = repo.teammate(); redraw();
        t.print('👩‍💻 Your teammate pushed commit ' + id + ' to GitHub. (Your computer doesn\'t know yet.)', 'c-warn');
        note(lab, 'A teammate pushed to GitHub. Your graph doesn\'t show it: your computer hasn\'t talked to GitHub since. Now make your own commit and <code>git push</code>.', 'warn');
      });
    },
    after: function (repo, ev, cmd, lab) {
      $(lab, '[data-act="team"]').disabled = !repo.remoteRefs.main;
      if (repo.remote) K.done('gh-r-add');
      if (repo.remoteRefs.main) K.done('gh-r-push');
      if (repo.rejected) K.done('gh-r-reject');
      var synced = repo.rejected && repo.teamIds && repo.remoteRefs.main === repo.branches.main && repo.isAnc(repo.teamIds[repo.teamIds.length - 1], repo.branches.main);
      if (synced) K.done('gh-r-sync');
      if (synced && ev.push) note(lab, '<b>Synced!</b> Your commit and your teammate\'s are both on GitHub, joined by the merge commit from <code>git pull</code>.', 'good');
      else if (ev.reject) note(lab, '<b>Rejected</b>, and that\'s Git protecting your teammate\'s work. Run <code>git pull</code> to bring it in, then push again.', 'bad');
      else if (ev.pull && ev.merge === 'merge') note(lab, 'Pulled: Git fetched your teammate\'s commit and merged it with yours (ringed dot). Now <code>git push</code>.', 'good');
      else if (ev.pull) note(lab, 'Pulled. Now you have everything GitHub has.', 'good');
      else if (ev.push) note(lab, 'Pushed! GitHub now has your commits; <code>origin/main</code> marks what GitHub has. Next, click <b>A teammate pushes a commit</b>.', 'good');
      else if (repo.remote && !repo.remoteRefs.main) note(lab, 'Remote added. Now upload: <code>git push -u origin main</code>. (<code>-u</code> remembers the pairing, so later you can just type <code>git push</code>.)');
      else if (!repo.remote) note(lab, 'Connect this repo to GitHub with <code>git remote add origin &lt;url&gt;</code>, then push.');
    }
  });

  /* ═════ Lab 0 — time machine ═════ */
  (function () {
    var lab = document.getElementById('lab-time'); if (!lab) return;
    var START = 'Pancakes\n- 1 cup flour\n- 1 egg\n- 1 cup milk\n', snaps, sel, doc = $(lab, '[data-in="doc"]'), msg = $(lab, '[data-in="msg"]');
    function render() {
      $(lab, '[data-out="snaps"]').innerHTML = snaps.length ? snaps.map(function (s, i) { return '<button class="snap' + (sel === i ? ' on' : '') + '" data-i="' + i + '">#' + (i + 1) + ' ' + esc(s.msg) + '</button>'; }).join('') : '<span style="color:var(--text-muted);font-size:.8rem">No snapshots yet.</span>';
      $(lab, '[data-act="restore"]').disabled = sel == null;
      if (sel == null) { $(lab, '[data-out="diff"]').textContent = 'Pick a snapshot to see what changed since then.'; return; }
      var d = diffLines(snaps[sel].text, doc.value);
      $(lab, '[data-out="diff"]').innerHTML = d.some(function (x) { return x[0] !== ' '; }) ? diffHtml(d) : '<span class="ctx">(identical to the current text)</span>';
    }
    function reset() { doc.value = START; snaps = []; sel = null; msg.value = ''; render(); note(lab, 'Edit the recipe, then save a snapshot. Repeat a few times.'); }
    K.on(lab, 'save', function () {
      var last = snaps[snaps.length - 1];
      if (last && last.text === doc.value) return note(lab, 'Nothing changed since snapshot #' + snaps.length + '. Edit the text first.', 'warn');
      snaps.push({ text: doc.value, msg: msg.value.trim() || 'Snapshot ' + (snaps.length + 1) }); msg.value = '';
      if (snaps.length >= 3) K.done('gh-t-save');
      note(lab, 'Saved snapshot #' + snaps.length + '.' + (snaps.length >= 3 ? ' Now click an older one to compare.' : ' Change something and save again.'), 'good'); render();
    });
    $(lab, '[data-out="snaps"]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return; sel = +b.dataset.i; render();
      if (snaps[sel].text !== doc.value) { K.done('gh-t-diff'); note(lab, 'The diff shows how to get from snapshot #' + (sel + 1) + ' to today\'s text: <b style="color:var(--good)">green</b> lines were added since, <b style="color:var(--bad)">red</b> ones removed. Git shows changes exactly like this.'); }
    });
    K.on(lab, 'restore', function () {
      if (sel == null) return; doc.value = snaps[sel].text; K.done('gh-t-restore');
      note(lab, 'Restored snapshot #' + (sel + 1) + '. All ' + snaps.length + ' snapshots are still there, so you can jump forward again any time.', 'good'); render();
    });
    doc.addEventListener('input', render);
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 1 — three areas ═════ */
  (function () {
    var lab = document.getElementById('lab-areas'); if (!lab) return;
    var repo, userCommits;
    function reset() {
      repo = new Repo(21); repo.inited = true; userCommits = 0;
      repo.work = { 'index.html': '<h1>My site</h1>\n', 'style.css': 'body { font-family: sans-serif; }\n', 'app.js': '// scripts\n' };
      repo.add('.'); repo.commit('Initial commit');
      render(); note(lab, 'Click <b>Edit</b> on a file to change it. Then <b>Stage</b> it and commit.');
    }
    function render() {
      var H = repo.tree(repo.tip());
      $(lab, '[data-out="work"]').innerHTML = Object.keys(repo.work).sort().map(function (f) {
        var mod = repo.work[f] !== repo.index[f];
        return '<div class="fcard"><span class="name">' + f + '</span>' + (mod ? '<span class="tag m">modified</span><button data-stage="' + f + '">Stage →</button>' : '') + '<button data-edit="' + f + '">Edit</button></div>';
      }).join('');
      var staged = keys(H, repo.index).filter(function (f) { return repo.index[f] !== H[f]; });
      $(lab, '[data-out="stage"]').innerHTML = staged.length ? staged.map(function (f) { return '<div class="fcard"><span class="name">' + f + '</span><span class="tag s">staged</span><button data-unstage="' + f + '">←</button></div>'; }).join('') : '<small style="color:var(--text-muted)">Empty. Nothing will go in the next commit.</small>';
      var ids = Object.keys(repo.commits).sort(function (a, b) { return repo.commits[b].seq - repo.commits[a].seq; });
      $(lab, '[data-out="repo"]').innerHTML = ids.map(function (id) {
        var cm = repo.commits[id], P = cm.parents[0] ? repo.tree(cm.parents[0]) : {}, ch = keys(P, cm.tree).filter(function (f) { return P[f] !== cm.tree[f]; });
        return '<div class="ccard"><b>' + id.slice(0, 7) + '</b>' + esc(cm.msg) + '<small>' + ch.join(', ') + '</small></div>';
      }).join('');
      $(lab, '[data-out="status"]').textContent = '$ git status\n' + repo.statusLines().map(function (l) { return l[0]; }).join('\n');
    }
    $(lab, '.areas').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) { repo.edit(b.dataset.edit); note(lab, '<code>' + b.dataset.edit + '</code> changed. It\'s <b>modified</b> in your working folder, but Git won\'t include it until you stage it.'); }
      if (b.dataset.stage) { repo.add(b.dataset.stage); K.done('gh-a-stage'); note(lab, '<code>git add ' + b.dataset.stage + '</code>: this version is now in the box for the next commit.', 'good'); }
      if (b.dataset.unstage) { repo.unstage(b.dataset.unstage); note(lab, '<code>git restore --staged ' + b.dataset.unstage + '</code>: taken out of the box. Your edit is still in the working folder.'); }
      render();
    });
    K.on(lab, 'commit', function () {
      var st = repo.status(), m = $(lab, '[data-in="msg"]');
      if (!st.staged.length) { note(lab, '<b>Nothing staged</b>, so there\'s nothing to commit. Edits only go in a commit after you stage them.', 'bad'); return; }
      var leftover = st.unstaged.length > 0, r = repo.commit(m.value.trim() || 'Update ' + st.staged.map(function (x) { return x[1]; }).join(', '));
      m.value = ''; userCommits++; K.done('gh-a-commit');
      if (leftover) { K.done('gh-a-split'); note(lab, 'Committed <b>only</b> ' + r.files.join(', ') + '. The other modified file is still waiting in your working folder. That\'s how you keep commits focused.', 'good'); }
      else note(lab, 'Committed ' + r.files.join(', ') + ' as <b>' + r.id + '</b>.', 'good');
      if (userCommits >= 2 && !repo.status().dirty) { K.done('gh-a-clean'); note(lab, '<b>Working tree clean</b>: everything you changed is safely committed.', 'good'); }
      render();
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 5 — merge conflict ═════ */
  (function () {
    var lab = document.getElementById('lab-conflict'); if (!lab) return;
    var MINE = '  <h1>Welcome to my site</h1>', THEIRS = '  <h1>Hello from the team</h1>';
    function file(mid) { return '<header>\n' + mid + '\n</header>\n<p>Thanks for visiting!</p>\n'; }
    var CONFLICT = file('<<<<<<< HEAD\n' + MINE + '\n=======\n' + THEIRS + '\n>>>>>>> origin/main');
    var PRESETS = [file(MINE), file(THEIRS), file(MINE + '\n' + THEIRS)], ta = $(lab, '[data-in="file"]'), done = false;
    function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
    function reset() { ta.value = CONFLICT; done = false; note(lab, 'You changed the headline to "Welcome to my site"; a teammate changed it to "Hello from the team". Decide what the file should say.'); }
    K.on(lab, 'mine', function () { ta.value = PRESETS[0]; note(lab, 'Kept your version and removed the markers. Now commit.'); });
    K.on(lab, 'theirs', function () { ta.value = PRESETS[1]; note(lab, 'Kept their version and removed the markers. Now commit.'); });
    K.on(lab, 'both', function () { ta.value = PRESETS[2]; note(lab, 'Kept both lines. Two headlines is probably not what you want on a real page, but Git doesn\'t judge. Commit, or edit further.'); });
    K.on(lab, 'commit', function () {
      var v = ta.value;
      if (/^(<{7}|={7}|>{7})/m.test(v)) { K.done('gh-c-oops'); return note(lab, '<b>Markers still in the file!</b> Real Git would let you commit this, and your website would literally show <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code>. Remove every marker line first.', 'bad'); }
      if (!/<h1>/.test(v)) return note(lab, 'The headline is gone entirely. Is that what you meant? Keep at least one <code>&lt;h1&gt;</code>.', 'warn');
      K.done('gh-c-resolve'); done = true;
      var hand = PRESETS.every(function (p) { return norm(p) !== norm(v); });
      if (hand) K.done('gh-c-hand');
      note(lab, '<b>Conflict resolved</b> and committed: <code>git add index.html</code> + <code>git commit</code>. ' + (hand ? 'And you wrote your own resolution, which is exactly what real conflicts often need.' : 'Try again with a hand-written headline that combines both ideas.'), 'good');
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 6 — pull request workflow ═════ */
  (function () {
    var lab = document.getElementById('lab-pr'); if (!lab) return;
    var STEPS = { fork: 'Fork the repository on GitHub', clone: 'Clone your fork to your computer', branch: 'Create a branch for your fix', commit: 'Edit the file and commit', push: 'Push the branch to your fork', pr: 'Open a pull request', merge: 'The maintainer reviews and merges' };
    var ORDER = ['fork', 'clone', 'branch', 'commit', 'push', 'pr', 'merge'], SHUF = ['pr', 'clone', 'merge', 'fork', 'commit', 'push', 'branch'];
    var WHY = { clone: 'Clone what? You can\'t push to the original, so you first need your <em>own</em> copy on GitHub.', branch: 'You need the code on your computer before you can branch.', commit: 'Make a branch first, so your fix is isolated from main.', push: 'There\'s nothing new to push yet.', pr: 'A pull request proposes commits you\'ve pushed. You haven\'t pushed any yet.', merge: 'Only the maintainer can merge, and only once there\'s a pull request to review.', fork: 'You already have a fork.' };
    var pos;
    function reset() {
      pos = 0;
      $(lab, '[data-out="pool"]').innerHTML = SHUF.map(function (k) { return '<button data-k="' + k + '">' + STEPS[k] + '</button>'; }).join('');
      $(lab, '[data-out="built"]').innerHTML = ''; $(lab, '[data-out="review"]').innerHTML = '';
      note(lab, 'You want to fix a typo in an open-source project you don\'t own. What do you do first?');
    }
    $(lab, '[data-out="pool"]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b || b.classList.contains('used')) return;
      var k = b.dataset.k;
      if (k !== ORDER[pos]) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return note(lab, '<b>Not yet.</b> ' + WHY[k], 'bad'); }
      b.classList.add('used'); pos++;
      $(lab, '[data-out="built"]').insertAdjacentHTML('beforeend', '<li><b>' + pos + '</b>' + STEPS[k] + '</li>');
      if (pos < ORDER.length) return note(lab, 'Right. What comes next?', 'good');
      K.done('gh-p-order');
      note(lab, '<b>That\'s the whole open-source workflow.</b> Now the maintainer has a comment…', 'good');
      $(lab, '[data-out="review"]').innerHTML = '<div class="lab-note">💬 <b>Maintainer:</b> “Thanks! Could you also fix “recieve” on line 3 before I merge?”</div><div class="order" style="margin-top:.5rem"><button data-r="new">Close this PR and open a new one</button><button data-r="same">Commit the fix on the same branch and push</button><button data-r="main">Push the fix straight to their main branch</button></div>';
    });
    $(lab, '[data-out="review"]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return; var r = b.dataset.r;
      if (r === 'same') { K.done('gh-p-fix'); return note(lab, '<b>Exactly.</b> A pull request tracks its branch, so new commits pushed to it appear in the PR automatically, discussion intact.', 'good'); }
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      note(lab, r === 'new' ? 'That works, but it throws away the review discussion. A PR follows its branch, so just push to it.' : 'You don\'t have permission to push to their repository. That\'s why you forked.', 'bad');
    });
    $(lab, '[data-reset]').addEventListener('click', reset);
    reset();
  })();

  /* ═════ Lab 7 — .gitignore ═════ */
  (function () {
    var lab = document.getElementById('lab-ignore'); if (!lab) return;
    var FILES = [['index.html'], ['app.js'], ['README.md'], ['.gitignore'], ['.env', 'API keys and passwords'], ['config/secrets.json', 'database password'], ['node_modules/react/index.js'], ['node_modules/express/index.js'], ['dist/bundle.js'], ['debug.log'], ['logs/server.log']];
    var KEEP = ['index.html', 'app.js', 'README.md'], ta = $(lab, '[data-in="rules"]');
    function rx(glob) { return new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*') + '$'); }
    function match(pat, path) {
      var dirOnly = /\/$/.test(pat); pat = pat.replace(/\/$/, '');
      var anchored = pat.indexOf('/') >= 0; pat = pat.replace(/^\//, '');
      var re = rx(pat), segs = path.split('/'), n = dirOnly ? segs.length - 1 : segs.length;
      for (var i = 0; i < n; i++) { if (anchored ? re.test(segs.slice(0, i + 1).join('/')) : re.test(segs[i])) return true; }
      return false;
    }
    function rules() { return ta.value.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; }); }
    function ignored(path, rs) { var ig = false; rs.forEach(function (r) { if (r[0] === '!') { if (match(r.slice(1), path)) ig = false; } else if (match(r, path)) ig = true; }); return ig; }
    function update() {
      var rs = rules(), nt = 0, ns = 0, lost = [];
      $(lab, '[data-out="files"]').innerHTML = FILES.map(function (f) {
        var ig = ignored(f[0], rs); if (!ig) { nt++; if (f[1]) ns++; } else if (KEEP.indexOf(f[0]) >= 0) lost.push(f[0]);
        return '<div class="' + (ig ? 'ign' : f[1] ? 'risk' : '') + '"><span class="ic">' + (ig ? '⊘' : f[1] ? '⚠️' : '✓') + '</span><span>' + f[0] + '</span>' + (f[1] && !ig ? '<small style="margin-left:auto;color:var(--bad)">' + f[1] + '</small>' : '') + '</div>';
      }).join('');
      out(lab, 'nt', nt); var nsb = out(lab, 'ns', ns); nsb.className = ns ? 'bad' : 'good';
      var one = function (paths) { return rs.some(function (r) { return r[0] !== '!' && paths.every(function (p) { return match(r, p); }); }); };
      if (ignored('.env', rs)) K.done('gh-i-env');
      if (one(['node_modules/react/index.js', 'node_modules/express/index.js'])) K.done('gh-i-nm');
      if (rs.some(function (r) { return r.indexOf('*') >= 0 && match(r, 'debug.log') && match(r, 'logs/server.log'); })) K.done('gh-i-log');
      if (!ns && !lost.length) K.done('gh-i-safe');
      if (lost.length) note(lab, '<b>Too broad:</b> ' + lost.join(', ') + ' is ignored too, so your actual code wouldn\'t be saved!', 'bad');
      else if (ns) note(lab, '<b>' + ns + ' secret file' + (ns > 1 ? 's' : '') + '</b> would be uploaded to GitHub. Add patterns for them, one per line.', 'bad');
      else if (nt > 5) note(lab, 'Secrets are safe. Now tidy up the rest: dependencies (<code>node_modules/</code>), build output (<code>dist/</code>) and logs don\'t belong in Git either.', 'warn');
      else note(lab, '<b>Clean repository:</b> only real source files get committed, no secrets, no clutter.', 'good');
    }
    ta.addEventListener('input', update);
    $(lab, '[data-reset]').addEventListener('click', function () { ta.value = '# Files Git should never track\n'; update(); });
    ta.value = '# Files Git should never track\n'; update();
  })();

  /* ─── Copy buttons on code blocks ─── */
  $$(document, '[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.closest('.code').querySelector('pre').innerText;
      var ok = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () {}); else ok();
    });
  });
})();
