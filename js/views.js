/* 盘库 APP — 界面与页面 */
(function () {
  const A = window.A;
  const S = A.state;
  const $ = A.$;
  const $$ = A.$$;

  const TABS = [
    { k: 'scan', label: '扫码', icon: 'camera' },
    { k: 'nocode', label: '无69', icon: 'tag' },
    { k: 'list', label: '清单', icon: 'list' },
    { k: 'stats', label: '统计', icon: 'chart' },
  ];

  /* ---------------- 外壳 ---------------- */
  function shellHTML() {
    return '<header class="hd">' +
      '<button class="hd-btn" data-act="menu" aria-label="菜单">' + A.icon('menu') + '</button>' +
      '<div class="hd-mid"><div class="hd-title" id="hdTitle"></div><div class="hd-sub" id="hdSub"></div></div>' +
      '<label class="hd-btn" for="fileIn" data-import="new" aria-label="导入清单">' + A.icon('upload') + '</label>' +
      '</header>' +
      '<div class="bar"><i id="hdBar"></i></div>' +
      '<main id="view"></main>' +
      '<nav class="nav" id="nav">' + TABS.map(function (t) {
        return '<button data-tab="' + t.k + '">' + A.icon(t.icon) + '<span>' + t.label + '</span>' +
          (t.k === 'nocode' ? '<i class="dotbadge" id="ncBadge" hidden>0</i>' : '') + '</button>';
      }).join('') + '</nav>';
  }

  A.render = function () {
    if (A.unmountScan) A.unmountScan();
    const app = $('#app');
    if (!S.session) {
      app.innerHTML = welcomeHTML();
      bindWelcome();
      return;
    }
    app.innerHTML = shellHTML();
    $$('#nav button').forEach(function (b) {
      b.onclick = function () { A.setTab(b.getAttribute('data-tab')); };
    });
    A.renderTab();
  };

  A.setTab = function (tab) {
    if (!S.session || tab === S.tab) return;
    if (S.tab === 'scan' && A.unmountScan) A.unmountScan();
    S.tab = tab;
    A.renderTab();
  };

  A.renderTab = function () {
    const v = $('#view');
    if (!v) return;
    v.innerHTML = '';
    v.classList.remove('nopad');
    A.currentRefresh = null;
    if (S.tab === 'scan') A.mountScan(v);
    else if (S.tab === 'nocode') viewNoCode(v);
    else if (S.tab === 'list') viewList(v);
    else viewStats(v);
    A.updateChrome();
  };

  A.updateChrome = function () {
    if (!S.session) return;
    const st = A.stats();
    const t = $('#hdTitle'), sub = $('#hdSub'), bar = $('#hdBar');
    if (t) t.textContent = S.session.name || '未命名盘点';
    if (sub) {
      sub.textContent = '已盘 ' + st.counted + '/' + st.total +
        (st.diff ? ' · 差异 ' + st.diff : '') +
        (st.unknown ? ' · 清单外码 ' + st.unknown : '');
    }
    if (bar) bar.style.width = (st.total ? Math.round((st.counted / st.total) * 100) : 0) + '%';
    $$('#nav button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === S.tab);
    });
    const badge = $('#ncBadge');
    if (badge) {
      const n = S.session.items.filter((it) => A.needManual(it) && it.count == null).length;
      badge.hidden = n === 0;
      badge.textContent = n > 99 ? '99+' : String(n);
    }
  };

  A.onData = function () {
    A.updateChrome();
    if (S.tab === 'scan') {
      if (A.updateScanCard) A.updateScanCard();
    } else if (typeof A.currentRefresh === 'function') {
      A.currentRefresh();
    }
  };

  /* ---------------- 欢迎页 ---------------- */
  function welcomeHTML() {
    const hasSessions = S.sessions.length > 0;
    return '<div class="welcome">' +
      '<div class="logo">' + A.icon('scan') + '</div>' +
      '<h1>盘库</h1>' +
      '<p class="lead">导入表格清单 → 扫 <b>69 码</b> 自动累加。<br>没有条码的商品，也能手工盘、拍照认、贴内部码。</p>' +
      '<label class="w-card" for="fileIn" data-import="new"><span class="wc-ico">' + A.icon('upload') + '</span><span><span class="wc-t">导入 Excel / CSV 清单</span><span class="wc-d">自动识别表头，指定名称、69 码、账面数量等列</span></span></label>' +
      '<button class="w-card" data-w="new"><span class="wc-ico">' + A.icon('plus') + '</span><span><span class="wc-t">新建空白盘点</span><span class="wc-d">先扫码收新品，或稍后再导入清单</span></span></button>' +
      (hasSessions ? '<button class="w-card" data-w="open"><span class="wc-ico">' + A.icon('list') + '</span><span><span class="wc-t">打开历史盘点（' + S.sessions.length + '）</span><span class="wc-d">' + A.esc(S.sessions[0].name) + ' · 已盘 ' + S.sessions[0].counted + '/' + S.sessions[0].n + '</span></span></button>' : '') +
      '<div class="foot-note">全部数据保存在这台手机上 · 离线可用<br>支持 .xlsx / .xls / .csv</div>' +
      '<div style="text-align:center;margin-top:10px"><button class="btn sm ghost" id="welFix">打不开 / 导入没反应？点此修复</button></div>' +
      '</div>';
  }

  function bindWelcome() {
    const wf = document.getElementById('welFix');
    if (wf) wf.onclick = function () { A.hardReload(); };
    $$('[data-w]').forEach(function (b) {
      b.onclick = function () {
        const w = b.getAttribute('data-w');
        if (w === 'import') A.openImport();
        else if (w === 'new') {
          const s = A.newSession('盘点 ' + new Date().toLocaleDateString('zh-CN'));
          A.openSession(s);
          A.render();
          A.toast('空白盘点已建好，点右上角导入清单', 'ok');
        } else if (w === 'open') A.openSessions();
      };
    });
  }

  /* ---------------- 扫码页 ---------------- */
  // 由 scan.js 挂载

  /* ---------------- 无69页 ---------------- */
  function viewNoCode(v) {
    v.innerHTML =
      '<div class="searchwrap">' + A.icon('search') +
      '<input class="search" id="ncSearch" placeholder="搜索无69商品（名称 / 货位 / 编码）" value="' + A.esc(S.q2) + '">' +
      (S.q2 ? '<button class="search-clear" id="ncClear">' + A.icon('close') + '</button>' : '') +
      '</div>' +
      '<div class="note" style="margin-bottom:10px">' +
      '<b>没有 69 码怎么盘？</b><br>' +
      '① 在这里点 <b>+</b> 手工计数；② 点商品可<b>拍照</b>，货架上一眼认出；③ 给它们贴<b>内部码</b>标签，之后直接扫码。' +
      '<div style="margin-top:8px"><button class="btn sm" data-act="print-labels">' + A.icon('print') + ' 打印无69标签</button></div>' +
      '</div>' +
      '<div class="chipbar" id="ncChips">' +
      chip('all', '全部') + chip('todo', '未盘') + chip('done', '已盘') +
      '</div>' +
      '<div id="ncList"></div>';
    bindChipbar(v, 'ncChips', { get: () => S.filter, set: (x) => { S.filter = x; } }, renderNoCodeRows);
    const inp = $('#ncSearch', v);
    inp.oninput = A.debounce(function () { S.q2 = inp.value; renderNoCodeRows(); }, 120);
    const clr = $('#ncClear');
    if (clr) clr.onclick = function () { S.q2 = ''; S.filter = 'all'; viewNoCode(v); };
    renderNoCodeRows();
    A.currentRefresh = function () {
      const sc = $('#ncSearch');
      if (sc) { sc.value = S.q2; }
      renderNoCodeRows();
    };

    function renderNoCodeRows() {
      const box = $('#ncList');
      if (!box) return;
      $$('#ncChips .chip').forEach((c) => c.classList.toggle('on', c.getAttribute('data-v') === S.filter));
      let items = S.session.items.filter(A.needManual);
      if (S.filter === 'todo') items = items.filter((it) => it.count == null);
      if (S.filter === 'done') items = items.filter((it) => it.count != null);
      const q = S.q2.trim().toLowerCase();
      if (q) items = items.filter((it) => [it.name, it.loc, it.code, it.spec].join(' ').toLowerCase().indexOf(q) >= 0);
      items.sort(function (a, b) {
        const la = a.loc || '\uffff', lb = b.loc || '\uffff';
        if (la !== lb) return la < lb ? -1 : 1;
        return (a.name || '') < (b.name || '') ? -1 : 1;
      });
      if (!items.length) {
        box.innerHTML = '<div class="empty"><div class="e-ico">✓</div>' +
          (q ? '没有匹配的无69商品' : (S.filter === 'todo' ? '无69商品都盘完了' : '清单里没有无69商品')) +
          '<br><span style="font-size:12px">条码破损、不好扫的商品，可在「清单」里点开详情，勾选「放进无69页」。</span></div>';
        return;
      }
      box.innerHTML = '<div class="rows">' + items.map(function (it) {
        const cnt = it.count == null ? '—' : A.fmt(it.count);
        return '<div class="row" data-row="' + it.id + '">' +
          '<div class="thumb" style="' + (it.photo ? "background-image:url('" + it.photo + "')" : '') + '">' + (it.photo ? '' : '无69') + '</div>' +
          '<div class="grow" data-open="' + it.id + '">' +
          '<div class="nm">' + A.esc(it.name || '未命名') + '</div>' +
          '<div class="meta">' + (it.spec ? A.esc(it.spec) + '<span class="sep">·</span>' : '') +
          (it.loc ? '位 ' + A.esc(it.loc) + '<span class="sep">·</span>' : '') +
          '账面 ' + (it.book == null ? '—' : A.fmt(it.book)) + '</div></div>' +
          '<div class="stepper">' +
          '<button data-dec="' + it.id + '" aria-label="减一">−</button>' +
          '<b class="' + (it.count == null ? 'zero' : '') + '" data-c="' + it.id + '">' + cnt + '</b>' +
          '<button data-inc="' + it.id + '" aria-label="加一">+</button>' +
          '</div></div>';
      }).join('') + '</div>' +
        '<div class="hint" style="padding:10px 4px 0">按货位排序，共 ' + items.length + ' 个无69商品</div>';
      bindRowActions(box);
    }
  }

  /* ---------------- 清单页 ---------------- */
  const FILTERS = [
    { k: 'all', label: '全部' }, { k: 'todo', label: '未盘' }, { k: 'done', label: '已盘' },
    { k: 'diff', label: '有差异' }, { k: 'nocode', label: '无69' },
  ];

  function chip(k, label, n) {
    return '<button class="chip" data-v="' + k + '">' + label + (n != null ? '<span class="n">' + n + '</span>' : '') + '</button>';
  }

  function bindChipbar(root, id, ctx, onChange) {
    const box = $('#' + id, root);
    if (!box) return;
    $$('.chip', box).forEach(function (c) {
      c.onclick = function () { ctx.set(c.getAttribute('data-v')); onChange(); };
    });
  }

  function viewList(v) {
    let limit = 200;
    v.innerHTML =
      '<div class="searchwrap">' + A.icon('search') +
      '<input class="search" id="lSearch" placeholder="搜索名称 / 条码 / 编码 / 货位" value="' + A.esc(S.q) + '">' +
      (S.q ? '<button class="search-clear" id="lClear">' + A.icon('close') + '</button>' : '') +
      '</div>' +
      '<div class="chipbar" id="lChips">' + FILTERS.map((f) => chip(f.k, f.label)).join('') + '</div>' +
      '<div id="lList"></div>';
    bindChipbar(v, 'lChips', { get: () => S.filter, set: (x) => { S.filter = x; } }, renderList);
    const inp = $('#lSearch', v);
    inp.oninput = A.debounce(function () { S.q = inp.value; limit = 200; renderList(); }, 120);
    const clr = $('#lClear');
    if (clr) clr.onclick = function () { S.q = ''; S.filter = 'all'; viewList(v); };
    renderList();
    A.currentRefresh = function () { renderList(); };

    function renderList() {
      const box = $('#lList');
      if (!box) return;
      $$('#lChips .chip').forEach((c) => c.classList.toggle('on', c.getAttribute('data-v') === S.filter));
      let items = S.session.items.slice();
      if (!items.length) {
        box.innerHTML = '<div class="empty"><div class="e-ico">' + A.icon('box') + '</div>清单还是空的<br><button class="btn primary sm" id="lImport" style="margin-top:12px">导入 Excel / CSV</button></div>';
        const b = $('#lImport', box);
        if (b) b.onclick = () => A.openImport();
        return;
      }
      if (S.filter === 'todo') items = items.filter((it) => it.count == null);
      else if (S.filter === 'done') items = items.filter((it) => it.count != null);
      else if (S.filter === 'diff') items = items.filter(A.isDiff);
      else if (S.filter === 'nocode') items = items.filter(A.needManual);
      const q = S.q.trim().toLowerCase();
      if (q) {
        items = items.filter(function (it) {
          return [it.name, it.spec, it.code, it.loc, (it.barcodes || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
        });
      }
      const total = items.length;
      items.sort(function (a, b) {
        if (a.count == null && b.count != null) return -1;
        if (a.count != null && b.count == null) return 1;
        return (a.name || '') < (b.name || '') ? -1 : 1;
      });
      const shown = items.slice(0, limit);
      box.innerHTML = '<div class="rows">' + shown.map(function (it) {
        const cnt = it.count == null ? '—' : A.fmt(it.count);
        const diff = A.isDiff(it);
        return '<div class="row" data-open="' + it.id + '">' +
          '<div class="grow"><div class="nm">' + A.esc(it.name || '未命名') +
          (A.needManual(it) ? '<span class="badge gray">无69</span>' : '') + '</div>' +
          '<div class="meta">' + (it.barcodes && it.barcodes.length ? A.esc(it.barcodes[0]) : '—') +
          (it.spec ? '<span class="sep">·</span>' + A.esc(it.spec) : '') +
          (it.loc ? '<span class="sep">·</span>位 ' + A.esc(it.loc) : '') + '</div></div>' +
          '<div class="count-box"><div class="cv" style="color:' + (it.count == null ? 'var(--tx3)' : 'var(--tx)') + '">' + cnt + '</div>' +
          '<div class="cl">账面 ' + (it.book == null ? '—' : A.fmt(it.book)) + '</div></div>' +
          (it.count == null ? '' : diff ? '<span class="badge ' + (it.count > it.book ? 'warn' : 'bad') + '">' + (it.book == null ? '新品' : (it.count > it.book ? '+' : '') + A.fmt(it.count - it.book)) + '</span>' : '<span class="badge ok">✓</span>') +
          '</div>';
      }).join('') + '</div>' +
        (total > shown.length ? '<button class="btn block" id="lMore" style="margin-top:10px">显示更多（还有 ' + (total - shown.length) + '）</button>' : '') +
        '<div class="hint" style="padding:10px 4px 0">共 ' + total + ' 条' + (S.q ? '（搜索：' + A.esc(S.q) + '）' : '') + '</div>';
      bindOpenRows(box);
      const more = $('#lMore', box);
      if (more) more.onclick = function () { limit += 300; renderList(); };
    }
  }

  /* ---------------- 统计页 ---------------- */
  function viewStats(v) {
    const st = A.stats();
    const pct = st.total ? Math.round((st.counted / st.total) * 100) : 0;
    const diffs = S.session.items.filter(A.isDiff).sort(function (a, b) {
      return Math.abs(b.count - (b.book == null ? 0 : b.book)) - Math.abs(a.count - (a.book == null ? 0 : a.book));
    });
    v.innerHTML =
      '<div class="metrics">' +
      '<div class="metric"><div class="m-lab">已盘 / 总品项</div><div class="m-val acc">' + st.counted + '<span style="font-size:15px;color:var(--tx3);font-weight:600">/' + st.total + '</span></div><div class="m-sub">完成 ' + pct + '%</div></div>' +
      '<div class="metric"><div class="m-lab">差异品项</div><div class="m-val ' + (st.diff ? 'warn' : 'ok') + '">' + st.diff + '</div><div class="m-sub">盘盈 ' + st.up + ' · 盘亏 ' + st.down + (st.newItem ? ' · 新品 ' + st.newItem : '') + '</div></div>' +
      '<div class="metric"><div class="m-lab">实盘合计</div><div class="m-val">' + A.fmt(st.real) + '</div><div class="m-sub">账面合计 ' + A.fmt(st.book) + '</div></div>' +
      '<div class="metric"><div class="m-lab">无69 / 清单外码</div><div class="m-val ' + (st.unknown ? 'bad' : '') + '">' + st.noCode + '<span style="font-size:15px;color:var(--tx3);font-weight:600"> / ' + st.unknown + '</span></div><div class="m-sub">无69商品 · 待处理条码</div></div>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn primary" data-act="export">' + A.icon('download') + ' 导出 Excel</button>' +
      '<button class="btn" data-act="print-labels">' + A.icon('print') + ' 打印无69标签</button>' +
      '</div>' +
      '<div class="sec-title">差异商品（' + diffs.length + '）</div>' +
      (diffs.length ? '<div class="rows">' + diffs.slice(0, 60).map(function (it) {
        const d = (Number(it.count) || 0) - (Number(it.book) || 0);
        return '<div class="row" data-open="' + it.id + '"><div class="grow"><div class="nm">' + A.esc(it.name) + '</div>' +
          '<div class="meta">账面 ' + (it.book == null ? '—' : A.fmt(it.book)) + ' · 实盘 ' + A.fmt(it.count) + '</div></div>' +
          '<span class="badge ' + (it.book == null ? 'warn' : d > 0 ? 'warn' : 'bad') + '">' + (it.book == null ? '新品' : (d > 0 ? '+' : '') + A.fmt(d)) + '</span></div>';
      }).join('') + '</div>' + (diffs.length > 60 ? '<div class="hint" style="padding:6px 4px">只显示前 60 条，完整结果导出 Excel 查看</div>' : '') :
        '<div class="empty" style="padding:24px">暂无差异</div>') +
      '<div class="sec-title">清单外条码（' + st.unknown + '）</div>' +
      (st.unknown ? '<div class="rows">' + S.session.unknown.map(function (u) {
        return '<div class="row"><div class="grow"><div class="nm" style="font-variant-numeric:tabular-nums">' + A.esc(u.code) + '</div>' +
          '<div class="meta">' + new Date(u.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' 扫到，未归属</div></div>' +
          '<button class="btn sm" data-linkcode="' + A.esc(u.code) + '">关联</button>' +
          '<button class="icon-btn" data-delcode="' + A.esc(u.code) + '">' + A.icon('close') + '</button></div>';
      }).join('') + '</div>' : '<div class="empty" style="padding:24px">没有清单外的条码</div>') +
      '<div style="height:8px"></div>';
    bindOpenRows(v);
    $$('[data-linkcode]', v).forEach(function (b) {
      b.onclick = function () { A.resolveUnknown(b.getAttribute('data-linkcode')); };
    });
    $$('[data-delcode]', v).forEach(function (b) {
      b.onclick = function () {
        const code = b.getAttribute('data-delcode');
        S.session.unknown = S.session.unknown.filter((u) => u.code !== code);
        A.save();
        viewStats(v);
        A.updateChrome();
      };
    });
  }

  /* ---------------- 行操作绑定 ---------------- */
  function bindOpenRows(root) {
    $$('[data-open]', root).forEach(function (el) {
      el.onclick = function () { A.openItem(el.getAttribute('data-open')); };
    });
  }

  function bindRowActions(root) {
    if (root.__bound) return;
    root.__bound = true;
    root.addEventListener('click', function (e) {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      const open = e.target.closest('[data-open]');
      if (inc) {
        const it = A.findItem(inc.getAttribute('data-inc'));
        if (it) {
          A.bump(it, 1);
          A.vibrate(12);
          const b = root.querySelector('[data-c="' + it.id + '"]');
          if (b) { b.textContent = A.fmt(it.count); b.classList.remove('zero'); }
          A.updateChrome();
        }
        return;
      }
      if (dec) {
        const it = A.findItem(dec.getAttribute('data-dec'));
        if (it) {
          A.bump(it, -1);
          A.vibrate(12);
          const b = root.querySelector('[data-c="' + it.id + '"]');
          if (b) { b.textContent = it.count == null ? '—' : A.fmt(it.count); if (it.count == null) b.classList.add('zero'); }
          A.updateChrome();
        }
        return;
      }
      if (open) { A.openItem(open.getAttribute('data-open')); }
    });
  }

  /* ---------------- 商品详情 ---------------- */
  A.openItem = function (id) {
    const it = A.findItem(id);
    if (!it) return;
    const body = document.createElement('div');
    const cnt = () => (it.count == null ? '—' : A.fmt(it.count));
    body.innerHTML =
      '<div class="detail-head"><div class="dh-t" id="dTitle">' + A.esc(it.name || '未命名商品') + '</div>' +
      (A.needManual(it) ? '<span class="badge gray">无69</span>' : '<span class="badge acc">有条码</span>') + '</div>' +
      '<div class="it-photo" id="dPhoto" style="' + (it.photo ? "background-image:url('" + it.photo + "')" : '') + '">' +
      (it.photo ? '' : '<span>拍照存档，方便下次认货</span>') +
      '<div class="ph-btns"><button data-ph="take">' + (it.photo ? '重拍' : '拍照') + '</button>' +
      (it.photo ? '<button data-ph="del">删除</button>' : '') + '</div>' +
      '<input type="file" accept="image/*" capture="environment" id="phInput" hidden>' +
      '</div>' +
      '<div class="statline">' +
      '<div class="sl"><div class="k">账面</div><div class="v" id="dBook">' + (it.book == null ? '—' : A.fmt(it.book)) + '</div></div>' +
      '<div class="sl"><div class="k">实盘</div><div class="v" id="dReal" style="color:var(--acc)">' + cnt() + '</div></div>' +
      '<div class="sl"><div class="k">差异</div><div class="v" id="dDiff">—</div></div>' +
      '</div>' +
      '<div class="bigstep"><button data-step="-1">−</button><b id="dCount">' + cnt() + '</b><button data-step="1">+</button></div>' +
      '<div class="fields">' +
      '<div class="field"><label>商品名称</label><input class="inp" data-f="name" value="' + A.esc(it.name) + '"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label>规格</label><input class="inp" data-f="spec" value="' + A.esc(it.spec) + '"></div>' +
      '<div class="field"><label>单位</label><input class="inp" data-f="unit" value="' + A.esc(it.unit) + '"></div>' +
      '</div>' +
      '<div class="grid2">' +
      '<div class="field"><label>货位</label><input class="inp" data-f="loc" value="' + A.esc(it.loc) + '"></div>' +
      '<div class="field"><label>内部编码</label><input class="inp" data-f="code" value="' + A.esc(it.code) + '"></div>' +
      '</div>' +
      '<div class="grid2">' +
      '<div class="field"><label>账面数量</label><input class="inp" type="number" inputmode="decimal" id="dBookIn" value="' + (it.book == null ? '' : it.book) + '"></div>' +
      '<div class="field"><label>实盘数量</label><input class="inp" type="number" inputmode="decimal" id="dCountIn" value="' + (it.count == null ? '' : it.count) + '"></div>' +
      '</div>' +
      '<div class="field"><label>备注</label><input class="inp" data-f="note" value="' + A.esc(it.note) + '" placeholder="例如：破损 2 件 / 待补货"></div>' +
      '</div>' +
      '<div class="sec-title">条码</div>' +
      '<div class="code-chips" id="dCodes"></div>' +
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn sm" id="dAddCode">+ 添加条码</button>' +
      '<button class="btn sm" id="dGenCode">生成内部码</button>' +
      '</div>' +
      '<div id="dAddWrap" class="hidden" style="display:flex;gap:8px;margin-top:8px">' +
      '<input class="inp" id="dCodeIn" placeholder="扫码枪或手动输入条码" inputmode="numeric" style="flex:1">' +
      '<button class="btn sm primary" id="dCodeOk">添加</button>' +
      '</div>' +
      '<label class="switch" style="margin:14px 0 4px;font-size:13px"><input type="checkbox" id="dManual"' + (it.manual ? ' checked' : '') + '> 放进「无69」页（条码破损/不好扫）</label>' +
      '<div class="hint" style="margin-bottom:10px">勾选后，即使有条码也会出现在无69页，方便手工数。</div>' +
      '<div class="btn-row">' +
      '<button class="btn" id="dPrint">' + A.icon('print') + ' 打印标签</button>' +
      '<button class="btn danger" id="dDel">删除</button>' +
      '</div>' +
      '<div style="height:6px"></div>';

    const sh = A.sheet({
      title: '商品详情',
      body: body,
      onClose: function () {
        A.save();
        if (A.updateChrome) A.updateChrome();
        if (S.tab === 'scan' && A.updateScanCard) A.updateScanCard();
        else if (typeof A.currentRefresh === 'function') A.currentRefresh();
      },
    });

    const paint = function () {
      const c = $('#dCount', body), r = $('#dReal', body), d = $('#dDiff', body);
      const b = $('#dBook', body);
      $('#dTitle', body).textContent = it.name || '未命名商品';
      if (c) c.textContent = cnt();
      if (r) r.textContent = cnt();
      if (b) b.textContent = it.book == null ? '—' : A.fmt(it.book);
      const ci = $('#dCountIn', body);
      if (ci && document.activeElement !== ci) ci.value = it.count == null ? '' : it.count;
      if (d) {
        if (it.count == null || it.book == null) { d.textContent = it.count != null && it.book == null ? '新品' : '—'; d.style.color = 'var(--tx3)'; }
        else {
          const x = Number(it.count) - Number(it.book);
          d.textContent = Math.abs(x) < 1e-9 ? '0' : (x > 0 ? '+' : '') + A.fmt(x);
          d.style.color = Math.abs(x) < 1e-9 ? 'var(--ok)' : x > 0 ? 'var(--warn)' : 'var(--bad)';
        }
      }
    };

    const paintCodes = function () {
      const box = $('#dCodes', body);
      if (!it.barcodes.length) {
        box.innerHTML = '<span class="hint">没有条码，只能手工计数或贴内部码。</span>';
        return;
      }
      box.innerHTML = it.barcodes.map(function (b) {
        return '<span class="code-chip">' + A.esc(b) + '<button class="x" data-rm="' + A.esc(b) + '">×</button></span>';
      }).join('');
      if (it.altCodes && it.altCodes.length) {
        box.insertAdjacentHTML('beforeend', '<div class="hint" style="width:100%;margin-top:4px">表格里的内码：' + it.altCodes.map(A.esc).join(' / ') + '（可搜索、可手输，不算 69 码）</div>');
      }
      $$('[data-rm]', box).forEach(function (x) {
        x.onclick = function () {
          const code = x.getAttribute('data-rm');
          it.barcodes = it.barcodes.filter((v) => v !== code);
          A.rebuild();
          A.save();
          paintCodes();
          A.toast('已移除条码 ' + code);
        };
      });
    };

    paint();
    paintCodes();

    function step(d) {
      A.bump(it, d);
      paint();
      A.vibrate(12);
    }
    $$('[data-step]', body).forEach(function (b) {
      b.onclick = function () { step(Number(b.getAttribute('data-step'))); };
    });
    const ci = $('#dCountIn', body);
    ci.onchange = function () {
      const n = A.num(ci.value);
      A.setCount(it, n);
      paint();
    };
    const bi = $('#dBookIn', body);
    bi.onchange = function () {
      it.book = A.num(bi.value);
      A.save();
      paint();
    };
    $$('[data-f]', body).forEach(function (inp) {
      inp.oninput = function () {
        const f = inp.getAttribute('data-f');
        it[f] = inp.value;
        if (f === 'name') $('#dTitle', body).textContent = it.name || '未命名商品';
        if (f === 'code') A.rebuild();
        A.save();
      };
    });
    $('#dManual', body).onchange = function (e) {
      it.manual = e.target.checked;
      A.save();
      A.updateChrome();
    };

    // 拍照
    $('#dPhoto', body).addEventListener('click', function (e) {
      const a = e.target.closest('[data-ph]');
      if (!a) return;
      const ph = $('#phInput', body);
      if (a.getAttribute('data-ph') === 'take') { if (ph) ph.click(); return; }
      it.photo = null;
      A.save();
      $('#dPhoto', body).style.backgroundImage = '';
      $('#dPhoto', body).innerHTML = '<span>拍照存档，方便下次认货</span><div class="ph-btns"><button data-ph="take">拍照</button></div><input type="file" accept="image/*" capture="environment" id="phInput" hidden>';
      bindPhoto();
    });
    function bindPhoto() {
      const input = $('#phInput', body);
      input.onchange = async function () {
        const f = input.files && input.files[0];
        if (!f) return;
        try {
          A.toast('正在处理照片…');
          const data = await A.shrinkImage(f, 720);
          it.photo = data;
          A.save();
          const box = $('#dPhoto', body);
          box.style.backgroundImage = "url('" + data + "')";
          box.innerHTML = '<div class="ph-btns"><button data-ph="take">重拍</button><button data-ph="del">删除</button></div><input type="file" accept="image/*" capture="environment" id="phInput" hidden>';
          bindPhoto();
          A.toast('照片已保存', 'ok');
        } catch (e) { A.toast('照片处理失败', 'bad'); }
      };
    }
    bindPhoto();

    $('#dAddCode', body).onclick = function () {
      const w = $('#dAddWrap', body);
      w.classList.toggle('hidden');
      w.style.display = w.classList.contains('hidden') ? 'none' : 'flex';
      if (!w.classList.contains('hidden')) $('#dCodeIn', body).focus();
    };
    $('#dCodeOk', body).onclick = function () {
      const inp = $('#dCodeIn', body);
      const codes = A.extractCodes(inp.value);
      if (!codes.length) { A.toast('没识别到有效条码', 'bad'); return; }
      let added = 0;
      codes.forEach(function (c) {
        if (!it.barcodes.includes(c)) { it.barcodes.push(c); added++; }
      });
      inp.value = '';
      A.rebuild();
      A.save();
      paintCodes();
      A.toast(added ? '已添加 ' + added + ' 个条码' : '这些条码已经有了', added ? 'ok' : 'bad');
    };
    $('#dGenCode', body).onclick = function () {
      const code = A.genInternalCode();
      it.code = code;
      A.rebuild();
      A.save();
      const inp = $('[data-f="code"]', body);
      if (inp) inp.value = code;
      A.toast('内部码：' + code + '，可打印标签贴到商品上', 'ok');
    };
    $('#dPrint', body).onclick = function () {
      A.printLabels([it]);
    };
    $('#dDel', body).onclick = async function () {
      const ok = await A.confirm({ title: '删除商品', text: '删除「' + (it.name || '未命名') + '」？已扫的数量也会一起删掉。', okText: '删除', danger: true });
      if (!ok) return;
      A.removeItem(it.id);
      A.closeSheet();
      A.toast('已删除', 'ok');
    };
  };

  A.genInternalCode = function () {
    const sess = S.session;
    let max = 0;
    (sess ? sess.items : []).forEach(function (it) {
      const m = /^NB(\d+)$/i.exec(it.code || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    let n = max + 1;
    let code = 'NB' + String(n).padStart(5, '0');
    while (sess && sess.items.some((it) => (it.code || '').toUpperCase() === code)) {
      n++; code = 'NB' + String(n).padStart(5, '0');
    }
    return code;
  };

  /* ---------------- 扫到清单外条码：选择已有商品 ---------------- */
  A.resolveUnknown = function (code) {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="note warn" style="margin-bottom:12px">把 <b>' + A.esc(code) + '</b> 关联到哪个商品？关联后会记入该商品的条码，以后扫它直接累加。</div>' +
      '<div class="searchwrap"><input class="search" id="rSearch" placeholder="搜索商品名称 / 编码" autocomplete="off"></div>' +
      '<div id="rList"></div>';
    A.sheet({ title: '关联条码', body: body, onMount: function () {
      const list = body.querySelector('#rList');
      const inp = body.querySelector('#rSearch');
      const render = function () {
        const items = A.searchItems(inp.value, 40);
        if (!items.length) { list.innerHTML = '<div class="hint" style="padding:12px 2px">没有匹配的商品</div>'; return; }
        list.innerHTML = '<div class="rows">' + items.map(function (it) {
          return '<div class="row" data-pick="' + it.id + '"><div class="grow"><div class="nm">' + A.esc(it.name) + '</div>' +
            '<div class="meta">' + (it.barcodes[0] ? A.esc(it.barcodes[0]) : '无条码') + (it.spec ? ' · ' + A.esc(it.spec) : '') + '</div></div>' +
            '<span style="color:var(--acc);font-size:12px;font-weight:700">选择</span></div>';
        }).join('') + '</div>';
        A.$$('[data-pick]', list).forEach(function (row) {
          row.onclick = function () {
            const it = A.findItem(row.getAttribute('data-pick'));
            if (!it) return;
            if (!it.barcodes.includes(code)) it.barcodes.push(code);
            S.session.unknown = S.session.unknown.filter((u) => u.code !== code);
            A.touch('codes');
            A.closeSheet();
            A.toast('已关联到「' + it.name + '」', 'ok');
            if (S.tab === 'stats') A.renderTab();
          };
        });
      };
      inp.addEventListener('input', A.debounce(render, 120));
      render();
    } });
  };

  /* ---------------- 菜单 / 设置 / 帮助 ---------------- */
  A.openMenu = function () {
    const st = A.stats();
    const row = function (act, icon, title, sub) {
      return '<div class="row" data-m="' + act + '"><span style="color:var(--tx2);width:20px;display:grid;place-items:center">' + A.icon(icon) + '</span>' +
        '<div class="grow"><div class="nm">' + title + '</div>' + (sub ? '<div class="meta">' + sub + '</div>' : '') + '</div>' +
        '<span style="color:var(--tx3)">›</span></div>';
    };
    const body =
      '<div class="card" style="margin-bottom:12px"><div style="font-size:12px;color:var(--tx3)">当前盘点</div>' +
      '<div style="font-size:17px;font-weight:700;margin:2px 0 2px">' + A.esc(S.session.name) + '</div>' +
      '<div style="font-size:12px;color:var(--tx3)">已盘 ' + st.counted + '/' + st.total + ' · 差异 ' + st.diff + ' · 清单外码 ' + st.unknown + '</div></div>' +
      '<div class="rows">' +
      row('tasks', 'list', '盘点任务', '切换 / 新建 / 删除') +
      row('import', 'upload', '导入另一张清单', '追加或新建') +
      row('export', 'download', '导出盘点结果', 'Excel / CSV') +
      row('labels', 'print', '打印无69商品标签', '生成内部码，贴到商品上') +
      row('help', 'warn', '使用说明', '3 分钟上手') +
      row('settings', 'edit', '设置', '声音 / 震动 / 防连扫') +
      row('reset', 'trash', '清空本盘数量', '保留商品清单') +
      '</div>';
    A.sheet({ title: '菜单', body: body, onMount: function (bodyEl) {
      A.$$('[data-m]', bodyEl).forEach(function (el) {
        el.onclick = function () {
          const m = el.getAttribute('data-m');
          A.closeSheet();
          setTimeout(function () {
            if (m === 'tasks') A.openSessions();
            else if (m === 'import') A.openImport();
            else if (m === 'export') A.openExport();
            else if (m === 'labels') A.printLabels(null);
            else if (m === 'help') A.openHelp();
            else if (m === 'settings') A.openSettings();
            else if (m === 'reset') A.resetCounts();
          }, 120);
        };
      });
    } });
  };

  A.openSettings = function () {
    const s = S.settings;
    const body =
      '<div class="rows">' +
      '<div class="row"><div class="grow"><div class="nm">提示音</div><div class="meta">扫到商品时“嘀”一声</div></div><label class="switch"><input type="checkbox" data-s="sound"' + (s.sound ? ' checked' : '') + '></label></div>' +
      '<div class="row"><div class="grow"><div class="nm">震动</div><div class="meta">识别成功/失败时轻震</div></div><label class="switch"><input type="checkbox" data-s="vibrate"' + (s.vibrate ? ' checked' : '') + '></label></div>' +
      '<div class="row"><div class="grow"><div class="nm">防连扫</div><div class="meta">同一个码移开后 2 秒才再计</div></div><label class="switch"><input type="checkbox" data-s="dedupe"' + (s.dedupe ? ' checked' : '') + '></label></div>' +
      '<div class="row"><div class="grow"><div class="nm">保持屏幕常亮</div><div class="meta">扫码时不让屏幕熄灭</div></div><label class="switch"><input type="checkbox" data-s="wake"' + (s.wake ? ' checked' : '') + '></label></div>' +
      '</div>' +
      '<div class="hint" style="margin-top:12px">设置只影响这台手机上的浏览器。</div>' +
      '<div class="hint" style="margin-top:6px;opacity:.7">版本 1.3 · 门店版</div>' +
      '<button class="btn block" id="hardFix" style="margin-top:14px">修复加载 / 强制更新</button>' +
      '<div class="hint" style="margin-top:8px">导入没反应、界面没更新时点它：会清掉旧缓存并重新加载，已盘数据不受影响。</div>';
    A.sheet({ title: '设置', body: body, onMount: function (b) {
      const fix = $('#hardFix', b);
      if (fix) fix.onclick = async function () {
        const ok = await A.confirm({ title: '修复加载', text: '会清除本地缓存并重新加载页面，已导入的清单和数量保留。继续？', okText: '继续' });
        if (ok) A.hardReload();
      };
      A.$$('[data-s]', b).forEach(function (inp) {
        inp.onchange = function () {
          s[inp.getAttribute('data-s')] = inp.checked;
          A.saveSettings();
        };
      });
    } });
  };

  A.openHelp = function () {
    const body =
      '<div class="sec-title" style="margin-top:0">一分钟流程</div>' +
      '<div class="card" style="line-height:1.85;font-size:13.5px;color:var(--tx2)">' +
      '1. 右上角 <b>导入</b> Excel/CSV，选好「商品名称 / 69 码 / 账面数量」等列<br>' +
      '2. 到 <b>扫码</b> 页，对准条码，每次 +1，自动保存<br>' +
      '3. 没有条码的商品去 <b>无69</b> 页点 +1<br>' +
      '4. <b>统计</b> 页看差异，导出 Excel 交差' +
      '</div>' +
      '<div class="sec-title">表格里没有 69 码怎么办？</div>' +
      '<div class="card" style="font-size:13px;line-height:1.8;color:var(--tx2)">' +
      '<b style="color:var(--tx)">方法一：无69页手工计数</b><br>导入时没有条码的商品会自动进「无69」页，按货位排序，点 +1 就行。<br><br>' +
      '<b style="color:var(--tx)">方法二：拍照认货</b><br>点开无69商品 → 拍照。货架上看到实物，对照照片点 +1，不会认错。<br><br>' +
      '<b style="color:var(--tx)">方法三：贴内部码标签（推荐）</b><br>菜单 → 打印无69商品标签。App 会给每个无69商品生成 <b>NB00001</b> 这样的内部码并打印 Code128 条码，贴在商品或货架上，之后用扫码页直接扫。<br><br>' +
      '<b style="color:var(--tx)">方法四：扫到什么算什么</b><br>扫到清单外的码，可「新建商品」或「关联到已有商品」。适合箱码、包装码、临时新品。' +
      '</div>' +
      '<div class="sec-title">小技巧</div>' +
      '<div class="card" style="font-size:13px;line-height:1.8;color:var(--tx2)">' +
      '· 一个商品可以有多个条码：详情页「添加条码」，箱码/单品码都扫得了<br>' +
      '· 条码不清楚：扫码页「手动输入」直接敲数字或搜名称<br>' +
      '· 声音太吵：设置里关掉提示音，只看震动<br>' +
      '· 数据在本机浏览器里，换浏览器不会同步，盘点完记得导出 Excel' +
      '</div>' +
      '<div class="note" style="margin-top:12px">相机需要安全地址：请用 <b>http://127.0.0.1:8765</b> 打开本页，不要用文件直接打开。</div>';
    A.page({ title: '使用说明', body: body });
  };

  A.resetCounts = async function () {
    const ok = await A.confirm({ title: '清空数量', text: '把所有商品的实盘数量清零？商品和条码保留。', okText: '清空', danger: true });
    if (!ok) return;
    S.session.items.forEach(function (it) { it.count = null; it.countedAt = null; });
    S.undo = [];
    A.save();
    A.renderTab();
    A.updateChrome();
    A.toast('已清空实盘数量', 'ok');
  };

  /* ---------------- 盘点任务 ---------------- */
  A.openSessions = function () {
    const rows = S.sessions.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(function (s) {
      const active = S.session && s.id === S.session.id;
      return '<div class="row" data-sess="' + s.id + '"><div class="grow"><div class="nm">' + A.esc(s.name) + (active ? ' <span class="badge acc">当前</span>' : '') + '</div>' +
        '<div class="meta">' + new Date(s.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · 已盘 ' + s.counted + '/' + s.n + '</div></div>' +
        '<button class="icon-btn" data-delsess="' + s.id + '">' + A.icon('trash') + '</button></div>';
    }).join('');
    const body =
      '<button class="btn primary block" id="sNew" style="margin-bottom:12px">' + A.icon('plus') + ' 新建空白盘点</button>' +
      (rows ? '<div class="rows">' + rows + '</div>' : '<div class="empty">还没有盘点任务</div>') +
      '<div class="hint" style="margin-top:12px">删除盘点会连同已扫数量一起删掉，删之前先导出。</div>';
    A.sheet({ title: '盘点任务', body: body, onMount: function (b) {
      $('#sNew', b).onclick = async function () {
        const name = await A.askText({ title: '新盘点名称', value: '盘点 ' + new Date().toLocaleDateString('zh-CN'), placeholder: '例如：10月门店盘点' });
        if (name == null) return;
        const s = A.newSession(name.trim() || '未命名盘点');
        A.openSession(s);
        A.closeSheet();
        A.render();
        A.toast('新盘点已建好，可以导入清单了', 'ok');
      };
      A.$$('[data-sess]', b).forEach(function (row) {
        row.onclick = async function (e) {
          if (e.target.closest('[data-delsess]')) return;
          const id = row.getAttribute('data-sess');
          if (S.session && S.session.id === id) { A.closeSheet(); return; }
          const full = await A.getSession(id);
          if (!full) { A.toast('打不开这个盘点', 'bad'); return; }
          A.openSession(full);
          A.closeSheet();
          A.render();
        };
      });
      A.$$('[data-delsess]', b).forEach(function (btn) {
        btn.onclick = async function (e) {
          e.stopPropagation();
          const id = btn.getAttribute('data-delsess');
          const meta = S.sessions.find((x) => x.id === id);
          const ok = await A.confirm({ title: '删除盘点', text: '删除「' + (meta ? meta.name : '') + '」？此操作不可恢复。', okText: '删除', danger: true });
          if (!ok) return;
          const wasActive = S.session && S.session.id === id;
          await A.deleteSession(id);
          A.closeSheet();
          if (wasActive) {
            S.session = null;
            A.render();
          } else {
            A.openSessions();
          }
        };
      });
    } });
  };

  A.getSession = async function (id) {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('panku-db', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return await new Promise((res, rej) => {
        const tx = db.transaction('sessions', 'readonly');
        const req = tx.objectStore('sessions').get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    } catch (e) {
      const arr = A.LS.get('panku.sessions', []);
      return arr.find((s) => s.id === id) || null;
    }
  };

  A.askText = function (opts) {
    return new Promise(function (resolve) {
      let done = false;
      const finish = function (v) { if (done) return; done = true; A.closeSheet(); resolve(v); };
      const body = '<div class="field"><label>' + A.esc(opts.label || '') + '</label>' +
        '<input class="inp" id="askIn" value="' + A.esc(opts.value || '') + '" placeholder="' + A.esc(opts.placeholder || '') + '"></div>';
      A.sheet({
        title: opts.title || '输入',
        body: body,
        onClose: function () { if (!done) resolve(null); },
        onMount: function (b) {
          const inp = $('#askIn', b);
          setTimeout(function () { inp.focus(); inp.select(); }, 220);
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') finish(inp.value); });
          const foot = document.createElement('div');
          foot.className = 'sheet-f';
          foot.innerHTML = '<button class="btn" id="askCancel">取消</button><button class="btn primary" id="askOk">确定</button>';
          b.parentElement.appendChild(foot);
          $('#askCancel', foot).onclick = function () { finish(null); };
          $('#askOk', foot).onclick = function () { finish(inp.value); };
        },
      });
    });
  };

  /* ---------------- 导出入口 ---------------- */
  A.openExport = function () {
    const st = A.stats();
    const body =
      '<div class="note" style="margin-bottom:12px">导出包含：盘点明细（账面/实盘/差异）、差异表、清单外条码。文件会下载到手机「下载」目录。</div>' +
      '<div class="rows">' +
      '<div class="row" data-x="xlsx"><span style="color:var(--acc);width:20px;display:grid;place-items:center">' + A.icon('download') + '</span><div class="grow"><div class="nm">Excel（.xlsx）</div><div class="meta">3 个工作表，可直接发微信</div></div><span style="color:var(--tx3)">›</span></div>' +
      '<div class="row" data-x="csv"><span style="color:var(--tx2);width:20px;display:grid;place-items:center">' + A.icon('list') + '</span><div class="grow"><div class="nm">CSV（.csv）</div><div class="meta">通用格式，表格软件都能开</div></div><span style="color:var(--tx3)">›</span></div>' +
      '</div>' +
      '<div class="hint" style="margin-top:12px">当前 ' + st.total + ' 个品项，已盘 ' + st.counted + '，差异 ' + st.diff + '。</div>';
    A.sheet({ title: '导出结果', body: body, onMount: function (b) {
      A.$$('[data-x]', b).forEach(function (row) {
        row.onclick = function () {
          const k = row.getAttribute('data-x');
          A.closeSheet();
          setTimeout(function () { k === 'csv' ? A.exportCSV() : A.exportXLSX(); }, 160);
        };
      });
    } });
  };
})();
