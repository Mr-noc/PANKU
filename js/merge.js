/* 盘库 APP — 交接文件导出 / 多台手机结果合并 */
(function () {
  const A = window.A;
  const S = A.state;
  const $ = A.$;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }
  function stamp() {
    const d = new Date();
    return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  function safe(s) { return String(s || '盘点').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 30); }

  /* ---------- 导出交接文件 ---------- */
  A.exportHandover = async function () {
    const sess = S.session;
    if (!sess || !sess.items.length) { A.toast('清单是空的，先导入表格', 'bad'); return; }
    let device = S.settings.deviceName || '';
    if (!device) {
      const name = await A.askText({ title: '你的名字', label: '店员名（合并时用来区分）', value: '', placeholder: '例如：张三' });
      if (name === null) return;
      device = (name || '').trim() || '未命名';
      S.settings.deviceName = device;
      A.saveSettings();
    }
    const payload = {
      app: 'panku-handover',
      version: 1,
      store: sess.name || '',
      device: device,
      exportedAt: Date.now(),
      session: sess.name || '',
      items: sess.items.map(function (it) {
        return {
          barcodes: it.barcodes || [],
          code: it.code || '',
          name: it.name || '',
          spec: it.spec || '',
          count: it.count == null ? null : Number(it.count),
        };
      }),
    };
    const name = '盘库交接_' + safe(sess.name) + '_' + safe(device) + '_' + stamp() + '.json';
    download(new Blob([JSON.stringify(payload)], { type: 'application/json' }), name);
    A.toast('已导出交接文件：' + name, 'ok');
  };

  /* ---------- 合并 ---------- */
  function keysOf(it) {
    const ks = [];
    (it.barcodes || []).forEach(function (b) {
      const c = A.normCode(b);
      if (c) ks.push('b:' + c);
    });
    if (it.code) ks.push('c:' + A.normCode(it.code).toUpperCase());
    if (it.name) ks.push('n:' + it.name + '|' + (it.spec || ''));
    return ks;
  }

  A.mergeHandover = function (files) {
    const base = S.session;
    if (!base) return null;
    const merged = JSON.parse(JSON.stringify(base));
    merged.id = A.uid('s');
    merged.name = (base.name || '盘点') + ' · 合并';
    merged.createdAt = Date.now();
    merged.updatedAt = Date.now();
    merged.mergeSources = [];
    merged.items.forEach(function (it) {
      it.mergeConflict = null;
      it.count = null;
      it.countedAt = null;
    });

    const idx = new Map();
    merged.items.forEach(function (it) {
      keysOf(it).forEach(function (k) { if (!idx.has(k)) idx.set(k, it); });
    });

    const buckets = new Map(); // item.id -> [{device,count}]
    const addValue = function (it, device, count) {
      if (count == null || !isFinite(count)) return;
      if (!buckets.has(it.id)) buckets.set(it.id, []);
      buckets.get(it.id).push({ device: device, count: Number(count) });
    };

    // 本机
    const cloneById = new Map(merged.items.map((x) => [x.id, x]));
    base.items.forEach(function (it) {
      if (it.count != null) addValue(cloneById.get(it.id) || it, '本机', it.count);
    });

    // 其他人的交接文件
    files.forEach(function (f) {
      const dev = f.device || '未命名';
      (f.items || []).forEach(function (fi) {
        if (fi.count == null) return;
        let target = null;
        for (const k of keysOf(fi)) {
          if (idx.has(k)) { target = idx.get(k); break; }
        }
        if (!target) {
          target = {
            id: A.uid('it'), store: base.store || '', name: fi.name || '未命名商品',
            spec: fi.spec || '', unit: '', code: fi.code || '',
            barcodes: (fi.barcodes || []).map(A.normCode).filter(Boolean),
            altCodes: [], loc: '', book: null, count: null, note: '', photo: null,
            manual: false, isNew: true, mergeConflict: null,
          };
          merged.items.push(target);
          keysOf(target).forEach(function (k) { if (!idx.has(k)) idx.set(k, target); });
        }
        addValue(target, dev, fi.count);
      });
      merged.mergeSources.push({ device: dev, at: f.exportedAt || 0 });
    });

    let conflicts = 0;
    merged.items.forEach(function (it) {
      const vals = buckets.get(it.id);
      if (!vals || !vals.length) return;
      const uniq = Array.from(new Set(vals.map((v) => v.count)));
      if (uniq.length === 1) {
        it.count = uniq[0];
        it.countedAt = Date.now();
        it.mergeConflict = null;
      } else {
        it.count = null;
        it.mergeConflict = vals;
        conflicts++;
      }
    });
    merged.mergeStats = { files: files.length, conflicts: conflicts, items: merged.items.length };
    return merged;
  };

  /* ---------- 选文件并合并 ---------- */
  A.openMerge = function () {
    const sess = S.session;
    if (!sess || !sess.items.length) { A.toast('先在「导入」里打开东平店的清单，再合并', 'bad'); return; }
    const picked = [];
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="note" style="margin-bottom:12px">让每个店员扫码后点「导出交接文件」，把 JSON 发给你；这里可以一次选多个。</div>' +
      '<button class="btn primary block" id="mPick">选择交接文件（可多选）</button>' +
      '<input type="file" id="mFiles" accept=".json,application/json" multiple hidden>' +
      '<div id="mList" style="margin-top:14px"></div>' +
      '<div class="note" style="margin-top:14px">合并规则：同一个商品，多人盘的数量<b>一致</b>就直接采纳；<b>不一致</b>就标成「待核对」，由你人工确认。</div>' +
      '<button class="btn primary block lg" id="mGo" disabled style="margin-top:12px">开始合并</button>';
    const page = A.page({ title: '合并多台手机的结果', body: body });
    const listEl = body.querySelector('#mList');
    const go = body.querySelector('#mGo');
    const input = body.querySelector('#mFiles');

    const render = function () {
      if (!picked.length) { listEl.innerHTML = '<div class="hint">还没有选择文件</div>'; go.disabled = true; return; }
      listEl.innerHTML = '<div class="rows">' + picked.map(function (f, i) {
        const counted = (f.items || []).filter((x) => x.count != null).length;
        return '<div class="row"><div class="grow"><div class="nm">' + A.esc(f.device || '未命名') + ' · ' + A.esc(f.store || '') + '</div>' +
          '<div class="meta">' + new Date(f.exportedAt || Date.now()).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) +
          ' · 已盘 ' + counted + ' 个</div></div>' +
          '<button class="icon-btn" data-rm="' + i + '">×</button></div>';
      }).join('') + '</div>';
      A.$$('[data-rm]', listEl).forEach(function (b) {
        b.onclick = function () { picked.splice(Number(b.getAttribute('data-rm')), 1); render(); };
      });
      go.disabled = false;
    };

    body.querySelector('#mPick').onclick = function () { input.click(); };
    input.onchange = async function () {
      const fs = Array.from(input.files || []);
      for (const f of fs) {
        try {
          const text = await f.text();
          const d = JSON.parse(text);
          if (!d || d.app !== 'panku-handover' || !Array.isArray(d.items)) {
            A.toast(f.name + ' 不是盘库交接文件', 'bad');
            continue;
          }
          picked.push(d);
        } catch (e) { A.toast(f.name + ' 读取失败', 'bad'); }
      }
      input.value = '';
      render();
    };

    go.onclick = function () {
      if (!picked.length) return;
      const merged = A.mergeHandover(picked);
      if (!merged) return;
      A.openSession(merged);
      A.flush();
      A.closePage();
      A.render();
      const c = (merged.mergeStats || {}).conflicts || 0;
      A.toast('合并完成：' + picked.length + ' 台设备的记录' + (c ? '，' + c + ' 个商品需要核对' : '，数量全部一致'), c ? 'bad' : 'ok');
      if (c) setTimeout(function () { A.openConflicts(); }, 600);
    };
    render();
  };

  /* ---------- 待核对 ---------- */
  A.openConflicts = function () {
    const items = S.session.items.filter((it) => it.mergeConflict);
    if (!items.length) { A.toast('没有待核对的商品了', 'ok'); return; }
    const body = items.map(function (it) {
      const vals = it.mergeConflict;
      const uniq = Array.from(new Set(vals.map((v) => v.count)));
      return '<div class="card" style="margin-bottom:8px">' +
        '<div style="font-size:14px;font-weight:700">' + A.esc(it.name || '未命名') + '</div>' +
        '<div class="hint" style="margin-top:2px">' + A.esc((it.barcodes || [])[0] || it.code || '') + '</div>' +
        '<div class="hint" style="margin-top:4px">' + vals.map((v) => A.esc(v.device) + '：' + A.fmt(v.count)).join('　') + '</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
        uniq.map((v) => '<button class="btn sm" data-cf="' + it.id + '" data-v="' + v + '">采纳 ' + A.fmt(v) + '</button>').join('') +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<input class="inp" id="cf-' + it.id + '" type="number" inputmode="decimal" placeholder="手动输入正确数量" style="flex:1">' +
        '<button class="btn sm primary" data-cfset="' + it.id + '">确定</button>' +
        '</div></div>';
    }).join('');
    const page = A.page({ title: '待核对（' + items.length + '）', body: body });

    const resolve = function (id, value) {
      const it = A.findItem(id);
      if (!it) return;
      it.count = Number(value);
      it.countedAt = Date.now();
      it.mergeConflict = null;
      A.touch('count');
      if (A.updateChrome) A.updateChrome();
      const left = S.session.items.filter((x) => x.mergeConflict).length;
      if (left) A.openConflicts();
      else { A.closePage(); A.toast('全部核对完成', 'ok'); A.renderTab(); }
    };

    A.$$('[data-cf]', page.body).forEach(function (b) {
      b.onclick = function () { resolve(b.getAttribute('data-cf'), b.getAttribute('data-v')); };
    });
    A.$$('[data-cfset]', page.body).forEach(function (b) {
      b.onclick = function () {
        const id = b.getAttribute('data-cfset');
        const inp = document.getElementById('cf-' + id);
        const v = A.num(inp && inp.value);
        if (v == null) { A.toast('请输入一个数字', 'bad'); return; }
        resolve(id, v);
      };
    });
  };
})();
