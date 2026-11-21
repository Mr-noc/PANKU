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
    let deviceId = A.LS.get('panku.deviceId', '');
    if (!deviceId) {
      deviceId = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      A.LS.set('panku.deviceId', deviceId);
    }
    const seq = (A.LS.get('panku.handoverSeq', 0) || 0) + 1;
    A.LS.set('panku.handoverSeq', seq);
    const payload = {
      app: 'panku-handover',
      v: 2,
      store: sess.name || '',
      device: device,
      deviceId: deviceId,
      sessionId: sess.id,
      seq: seq,
      exportedAt: Date.now(),
      zoneMap: sess.zoneMap || {},
      zoneDone: sess.zoneDone || {},
      items: sess.items.map(function (it) {
        return {
          barcodes: it.barcodes || [],
          code: it.code || '',
          name: it.name || '',
          spec: it.spec || '',
          unit: it.unit || '',
          loc: it.loc || '',
          book: it.book == null ? null : Number(it.book),
          count: it.count == null ? null : Number(it.count),
          unzoned: it.unzoned == null ? null : Number(it.unzoned),
          zones: it.zones || {},
          zonesDone: it.zonesDone || {},
        };
      }),
    };
    const name = '盘库交接_' + safe(sess.name) + '_' + safe(device) + '_' + stamp() + '.json';
    A.deliverFile(new Blob([JSON.stringify(payload)], { type: 'application/json' }), name, 'json');
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
    merged.name = A.cleanName(base.name) + ' · 合并';
    merged.createdAt = Date.now();
    merged.updatedAt = Date.now();
    merged.mergeSources = [];
    merged.items.forEach(function (it) {
      it.mergeConflict = null;
      it.mergeReasons = [];
      it.count = null;
      it.unzoned = null;
      it.zones = {};
      it.countedAt = null;
    });

    // 1) 设备级去重：同一设备同一盘点重复导出，只留 seq 最大的一份
    const seen = new Map();
    (files || []).forEach(function (f) {
      if (!f || !Array.isArray(f.items)) return;
      const key = (f.deviceId || f.device || 'dev') + '|' + (f.sessionId || f.exportedAt || '0');
      const prev = seen.get(key);
      if (!prev || (f.seq || 0) >= (prev.seq || 0)) seen.set(key, f);
    });
    const list = Array.from(seen.values());
    merged.zoneMap = Object.assign({}, base.zoneMap || {});
    list.forEach(function (f) { merged.zoneMap = Object.assign(merged.zoneMap, f.zoneMap || {}); });

    const idx = new Map();
    merged.items.forEach(function (it) {
      keysOf(it).forEach(function (k) { if (!idx.has(k)) idx.set(k, it); });
    });

    const buckets = new Map();
    function hasZones(z) { return !!(z && Object.keys(z).length); }
    function addValue(it, device, rec) {
      if (rec.count == null && !hasZones(rec.zones)) return;
      if (!buckets.has(it.id)) buckets.set(it.id, []);
      buckets.get(it.id).push({
        device: device,
        count: rec.count == null ? null : Number(rec.count),
        zones: rec.zones || {},
        unzoned: rec.unzoned == null ? null : Number(rec.unzoned),
      });
    }
    function match(fi) {
      for (const k of keysOf(fi)) {
        if (k.indexOf('n:') === 0) {
          const t = idx.get(k);
          if (t && !(t.barcodes || []).length && !t.code && !(fi.barcodes || []).length && !fi.code) return t;
          continue;
        }
        if (idx.has(k)) return idx.get(k);
      }
      return null;
    }

    // 本机作为一台设备
    const cloneById = new Map(merged.items.map((x) => [x.id, x]));
    base.items.forEach(function (it) {
      if (it.count == null && !hasZones(it.zones)) return;
      addValue(cloneById.get(it.id) || it, '本机', { count: it.count, zones: it.zones, unzoned: it.unzoned });
    });

    // 其他人的交接文件
    list.forEach(function (f) {
      const dev = f.device || '未命名';
      (f.items || []).forEach(function (fi) {
        if (fi.count == null && !hasZones(fi.zones)) return;
        let target = match(fi);
        if (!target) {
          target = {
            id: A.uid('it'), store: base.store || '', name: fi.name || '未命名商品',
            spec: fi.spec || '', unit: fi.unit || '', code: fi.code || '',
            barcodes: (fi.barcodes || []).map(A.normCode).filter(Boolean),
            altCodes: [], loc: fi.loc || '', book: fi.book == null ? null : fi.book,
            count: null, zones: {}, zonesDone: {}, unzoned: null,
            note: '', photo: null, manual: false, isNew: true,
            mergeConflict: null, mergeReasons: [],
          };
          merged.items.push(target);
          keysOf(target).forEach(function (k) { if (!idx.has(k)) idx.set(k, target); });
        }
        addValue(target, dev, { count: fi.count, zones: fi.zones, unzoned: fi.unzoned });
      });
      merged.mergeSources.push({ device: dev, at: f.exportedAt || 0, seq: f.seq || 0 });
    });

    // 2) 逐商品聚合
    let conflicts = 0;
    const zoneCov = {};
    merged.items.forEach(function (it) {
      const srcs = buckets.get(it.id);
      if (!srcs || !srcs.length) return;
      const zoned = srcs.filter(function (s) { return hasZones(s.zones); });
      const plain = srcs.filter(function (s) { return !hasZones(s.zones); });

      if (!zoned.length) {
        // 全未分区：沿用老逻辑（同值采纳，异值待核）
        const vals = srcs.map(function (s) { return s.count; });
        const uniq = Array.from(new Set(vals));
        if (uniq.length === 1) {
          it.count = uniq[0];
          it.unzoned = uniq[0];
          it.countedAt = Date.now();
        } else {
          it.count = null;
          it.mergeConflict = srcs.map(function (s) { return { device: s.device, count: s.count }; });
          conflicts++;
        }
        return;
      }

      // 跨区相加；同区多设备取最大值并标待核
      const byZone = {};
      zoned.forEach(function (s) {
        Object.keys(s.zones).forEach(function (z) {
          const v = Number(s.zones[z]) || 0;
          (byZone[z] = byZone[z] || []).push({ device: s.device, count: v });
          if (!zoneCov[z]) zoneCov[z] = { devices: new Set(), items: new Set() };
          zoneCov[z].devices.add(s.device);
          if (v !== 0) zoneCov[z].items.add(it.id);
        });
      });
      let total = 0;
      const adopted = {};
      const cf = [];
      Object.keys(byZone).forEach(function (z) {
        const vals = byZone[z];
        const uniq = Array.from(new Set(vals.map(function (v) { return v.count; })));
        const v = uniq.length === 1 ? uniq[0] : Math.max.apply(null, uniq);
        adopted[z] = v;
        total += v;
        if (uniq.length > 1) cf.push({ zone: z, sources: vals, adopted: v });
      });
      it.zones = adopted;
      it.count = Math.round(total * 1000) / 1000;
      it.countedAt = Date.now();

      if (cf.length) {
        it.mergeConflict = [];
        cf.forEach(function (c) {
          c.sources.forEach(function (s) { it.mergeConflict.push({ device: s.device, count: s.count, zone: c.zone }); });
        });
        conflicts++;
      }
      if (plain.length) {
        it.mergeConflict = it.mergeConflict || [];
        plain.forEach(function (s) { it.mergeConflict.push({ device: s.device, count: s.count, zone: '', note: '未分区' }); });
        it.mergeReasons = (it.mergeReasons || []).concat('mixed');
        conflicts++;
      }
    });

    merged.mergeStats = {
      files: list.length,
      conflicts: conflicts,
      items: merged.items.length,
      zones: Object.keys(zoneCov).length,
    };
    merged.mergeZoneCov = Object.keys(zoneCov).map(function (z) {
      return { zone: z, label: merged.zoneMap[z] || z, devices: Array.from(zoneCov[z].devices), items: zoneCov[z].items.size };
    });
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
      '<div class="note" style="margin-top:14px">合并规则：同一商品<b>不同区域</b>的数量相加；<b>同一区域</b>多人盘的数量取最大值并标「待核对」；没扫区域码的按老规则（同值采纳 / 异值冲突）。</div>' +
      '<button class="btn primary block lg" id="mGo" disabled style="margin-top:12px">开始合并</button>';
    const page = A.page({ title: '合并多台手机的结果', body: body });
    const listEl = body.querySelector('#mList');
    const go = body.querySelector('#mGo');
    const input = body.querySelector('#mFiles');

    const render = function () {
      if (!picked.length) { listEl.innerHTML = '<div class="hint">还没有选择文件</div>'; go.disabled = true; return; }
      listEl.innerHTML = '<div class="rows">' + picked.map(function (f, i) {
        const counted = (f.items || []).filter((x) => x.count != null).length;
        const zn = Object.keys(f.zoneMap || {}).length;
        return '<div class="row"><div class="grow"><div class="nm">' + A.esc(f.device || '未命名') + ' · ' + A.esc(f.store || '') + '</div>' +
          '<div class="meta">' + new Date(f.exportedAt || Date.now()).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) +
          ' · 已盘 ' + counted + ' 个' + (zn ? ' · ' + zn + ' 个区' : ' · 未分区') + '</div></div>' +
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
      const ms = merged.mergeStats || {};
      const c = ms.conflicts || 0;
      A.toast('合并完成：' + (ms.files || picked.length) + ' 台设备、' + (ms.zones || 0) + ' 个区' + (c ? '，' + c + ' 个商品待核对' : '，没有冲突'), c ? 'bad' : 'ok');
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
      const detail = vals.map(function (v) {
        const zn = v.zone ? ((S.session.zoneMap && S.session.zoneMap[v.zone]) || v.zone) : (v.note || '未分区');
        return A.esc(zn) + ' · ' + A.esc(v.device) + '：' + A.fmt(v.count);
      }).join('　');
      return '<div class="card" style="margin-bottom:8px">' +
        '<div style="font-size:14px;font-weight:700">' + A.esc(it.name || '未命名') + '</div>' +
        '<div class="hint" style="margin-top:2px">' + A.esc((it.barcodes || [])[0] || it.code || '') + (it.mergeReasons && it.mergeReasons.indexOf('mixed') >= 0 ? ' · 有未分区数据' : '') + '</div>' +
        '<div class="hint" style="margin-top:4px">' + detail + '</div>' +
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
      it.zones = {};
      it.unzoned = Number(value);
      it.count = Number(value);
      it.countedAt = Date.now();
      it.mergeConflict = null;
      it.mergeReasons = [];
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
