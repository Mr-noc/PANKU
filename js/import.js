/* 盘库 APP — 表格导入与列映射 */
(function () {
  const A = window.A;
  const $ = A.$;

  const FIELDS = [
    { k: 'name', label: '商品名称', req: true, keys: ['商品名称', '品名', '名称', '商品名', '货品名称', '产品名称', '物料名称', '品项', 'goodsname', 'itemname', 'name', '商品'] },
    { k: 'barcode', label: '条码（69码）', keys: ['69码', '69条码', '69', '条形码', '条码', '国际条码', '商品条码', '扫码', 'ean', 'barcode', 'gtin', 'upc'] },
    { k: 'code', label: '内部编码', keys: ['内部编码', '商品编码', '存货编码', '物料编码', '货号', '编码', '编号', 'sku', 'code'] },
    { k: 'spec', label: '规格', keys: ['规格型号', '规格', '型号', '包装', 'spec'] },
    { k: 'unit', label: '单位', keys: ['计量单位', '单位', 'unit'] },
    { k: 'book', label: '账面数量', keys: ['账面数量', '账面库存', '账面数', '库存数量', '库存数', '结存', '账面', '库存', '应有', '系统数', '数量', 'qty', 'quantity'] },
    { k: 'loc', label: '仓库 / 货位', keys: ['仓库', '货位', '库位', '仓位', '储位', '货架', '位置', '区域', 'location'] },
    { k: 'store', label: '门店', keys: ['门店名称', '所属门店', '门店', '店铺', '分店', '店名', 'store', 'shop'] },
  ];

  const hnorm = (s) => String(s == null ? '' : s).replace(/[\s\u3000\r\n]/g, '').replace(/[（）()【】\[\]:：*]/g, '').toLowerCase();

  function headerScore(cell) {
    const h = hnorm(cell);
    if (!h) return null;
    let best = null;
    FIELDS.forEach(function (f) {
      f.keys.forEach(function (kw) {
        let score = 0;
        if (h === kw) score = 1000 + kw.length;
        else if (h.indexOf(kw) === 0) score = 500 + kw.length;
        else if (h.indexOf(kw) > 0) score = 120 + kw.length;
        if (score && (!best || score > best.score)) best = { field: f.k, score: score };
      });
    });
    return best;
  }

  function detectHeader(rows) {
    let bestRow = -1, bestScore = 0;
    const limit = Math.min(rows.length, 12);
    for (let r = 0; r < limit; r++) {
      let score = 0;
      (rows[r] || []).forEach(function (c) {
        const s = headerScore(c);
        if (s && s.score >= 120) score += s.score;
      });
      if (score > bestScore) { bestScore = score; bestRow = r; }
    }
    return bestScore >= 500 ? bestRow : -1;
  }

  function detectMap(rows, headerRow) {
    const map = {};
    if (headerRow < 0 || !rows[headerRow]) return map;
    const used = {};
    (rows[headerRow] || []).forEach(function (cell, ci) {
      const s = headerScore(cell);
      if (!s || used[s.field]) return;
      used[s.field] = true;
      map[s.field] = ci;
    });
    return map;
  }

  function colName(ci) {
    let s = '', n = ci;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }

  const S = { wb: null, sheet: '', rows: [], headerRow: -1, map: {}, source: '', mode: 'new', fileName: '', page: null, store: '', onlySale: true };

  async function readFile(file) {
    let buf;
    if (file.arrayBuffer) {
      buf = await file.arrayBuffer();
    } else {
      buf = await new Promise(function (res, rej) {
        const fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = rej;
        fr.readAsArrayBuffer(file);
      });
    }
    const lower = (file.name || '').toLowerCase();
    let wb;
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.indexOf('\uFFFD') >= 0) {
        try { text = new TextDecoder('gbk').decode(buf); } catch (e) {}
      }
      wb = XLSX.read(text, { type: 'string', raw: true });
    } else {
      wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, cellNF: false });
    }
    return wb;
  }

  function loadSheet(name) {
    const ws = S.wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
    S.rows = rows;
    S.sheet = name;
    const detected = detectHeader(rows);
    // 默认表头：检测不到时用第 1 行（若首行全空则从下一行）
    S.headerRow = detected >= 0 ? detected : 0;
    S.map = detectMap(rows, detected >= 0 ? detected : 0);
    if (S.map.name == null && rows[S.headerRow]) {
      // 没有识别到名称列：如果表头像表头行，退而求其次找最长文本列
      let best = -1, len = 0;
      const hr = rows[S.headerRow] || [];
      hr.forEach(function (c, i) {
        const t = String(c || '');
        if (t.length > len && !/^\d+$/.test(t)) { len = t.length; best = i; }
      });
      if (best >= 0) S.map.name = best;
    }
  }

  function textCell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    return String(v).trim();
  }

  function buildItems() {
    const rows = S.rows;
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    const map = S.map;
    const out = [];
    const dups = [];
    const seen = new Map();
    for (let r = start; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = map.name != null ? textCell(row[map.name]) : '';
      const barcodeRaw = map.barcode != null ? row[map.barcode] : '';
      const codeRaw = map.code != null ? row[map.code] : '';
      const rawCodes = A.extractCodes(barcodeRaw);
      const codes = rawCodes.filter((c) => /^\d{8,14}$/.test(c));
      let code = A.normCode(codeRaw);
      if (!code) {
        const internal = rawCodes.find((c) => !/^\d{8,14}$/.test(c));
        if (internal) code = internal;
      }
      // 表格里没有单独的 69 码列时，商品编码本身就是 69 码（纯数字才算，S 开头仍是无 69）
      if (!codes.length && code && /^\d{12,14}$/.test(code)) codes.push(code);
      if (!name && !codes.length && !code) continue;
      if (/^(合计|总计|小计|共计|备注|说明)[:：]?$/.test(name)) continue;
      const storeV = map.store != null ? textCell(row[map.store]) : '';
      if (S.store && storeV !== S.store) continue;
      const whV = map.loc != null ? textCell(row[map.loc]) : '';
      if (S.onlySale && map.loc != null && whV.indexOf('销售仓') < 0) continue;
      const it = {
        id: A.uid('it'),
        store: storeV,
        name: name || (codes[0] ? '条码 ' + codes[0] : '未命名商品'),
        spec: map.spec != null ? textCell(row[map.spec]) : '',
        unit: map.unit != null ? textCell(row[map.unit]) : '',
        code: code,
        altCodes: rawCodes.filter((c) => !/^\d{8,14}$/.test(c)),
        barcodes: codes,
        loc: map.loc != null ? textCell(row[map.loc]) : '',
        book: map.book != null ? A.num(row[map.book]) : null,
        count: null,
        note: '',
        photo: null,
        manual: false,
        isNew: false,
      };
      codes.forEach(function (c) {
        if (seen.has(c)) {
          dups.push({ code: c, keep: seen.get(c), drop: it.name });
          it.barcodes = it.barcodes.filter((x) => x !== c);
        } else seen.set(c, it.name);
      });
      out.push(it);
    }
    return { items: out, dups: dups };
  }

  function countPreview() {
    const map = S.map;
    let n = 0, noCode = 0;
    const rows = S.rows;
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    for (let r = start; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = map.name != null ? textCell(row[map.name]) : '';
      const codes = (map.barcode != null ? A.extractCodes(row[map.barcode]) : []).filter((c) => /^\d{8,14}$/.test(c));
      const code = map.code != null ? A.normCode(row[map.code]) : '';
      if (!codes.length && code && /^\d{12,14}$/.test(code)) codes.push(code);
      if (!name && !codes.length && !code) continue;
      if (/^(合计|总计|小计|共计|备注|说明)[:：]?$/.test(name)) continue;
      if (S.store && map.store != null && textCell(row[map.store]) !== S.store) continue;
      if (S.onlySale && map.loc != null && textCell(row[map.loc]).indexOf('销售仓') < 0) continue;
      n++;
      if (!codes.length) noCode++;
    }
    return { n: n, noCode: noCode };
  }

  function hasSaleWarehouse() {
    if (S.map.loc == null) return false;
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    for (let r = start; r < Math.min(S.rows.length, start + 400); r++) {
      const v = textCell((S.rows[r] || [])[S.map.loc]);
      if (v.indexOf('销售仓') >= 0) return true;
    }
    return false;
  }

  function storeValues() {
    if (S.map.store == null) return [];
    const set = new Set();
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    for (let r = start; r < S.rows.length; r++) {
      const v = textCell((S.rows[r] || [])[S.map.store]);
      if (v) set.add(v);
    }
    return Array.from(set);
  }

  function previewHTML() {
    const map = S.map;
    const cols = ['store', 'name', 'barcode', 'code', 'spec', 'book', 'loc'].filter((k) => map[k] != null);
    if (!cols.length) return '<div class="hint">还没有选择任何列，请在上方指定「商品名称」对应哪一列。</div>';
    let html = '<div style="overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:11.5px;white-space:nowrap">';
    html += '<tr>' + cols.map((k) => '<th style="text-align:left;padding:7px 9px;color:var(--tx3);font-weight:600;border-bottom:1px solid var(--line)">' + A.esc((FIELDS.find((f) => f.k === k) || {}).label) + '</th>').join('') + '</tr>';
    let shown = 0;
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    for (let r = start; r < S.rows.length && shown < 6; r++) {
      const row = S.rows[r] || [];
      const name = map.name != null ? textCell(row[map.name]) : '';
      const hasAny = row.some((c) => String(c || '').trim() !== '');
      if (!hasAny) continue;
      if (S.store && map.store != null && textCell(row[map.store]) !== S.store) continue;
      if (/^(合计|总计|小计|共计)[:：]?$/.test(name)) continue;
      html += '<tr>' + cols.map(function (k) {
        let v = row[map[k]];
        if (k === 'barcode') v = A.extractCodes(v).join(' / ');
        else if (k === 'book') v = A.fmt(A.num(v));
        else v = textCell(v);
        return '<td style="padding:6px 9px;border-bottom:1px solid rgba(37,49,64,.5);max-width:150px;overflow:hidden;text-overflow:ellipsis">' + A.esc(v == null ? '' : v) + '</td>';
      }).join('') + '</tr>';
      shown++;
    }
    html += '</table></div>';
    return html;
  }

  function storeBlockHTML() {
    const stores = storeValues();
    if (S.map.store == null || stores.length < 2) return '';
    return '<div class="sec-title">门店</div>' +
      '<div class="field"><label>只盘这个门店（可选）</label>' +
      '<select class="inp" id="wStore">' +
      '<option value="">全部门店（' + stores.length + ' 家）</option>' +
      stores.map((v) => '<option value="' + A.esc(v) + '"' + (S.store === v ? ' selected' : '') + '>' + A.esc(v) + '</option>').join('') +
      '</select></div>' +
      '<div class="hint" style="margin-top:6px">每个店员选自己的门店，导入后只保留本店商品；不选则整张表都导入。</div>';
  }

  function previewSimple() {
    const cols = [];
    if (S.map.store != null) cols.push(['store', '门店']);
    if (S.map.code != null) cols.push(['code', '商品编码']);
    cols.push(['name', '商品名称']);
    if (S.map.book != null) cols.push(['book', '数量']);
    if (S.map.loc != null) cols.push(['loc', '仓库']);
    if (S.map.barcode != null) cols.push(['barcode', '69码']);
    let html = '<div style="overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">';
    html += '<tr>' + cols.map((c) => '<th style="text-align:left;padding:7px 9px;color:var(--tx3);font-weight:600;border-bottom:1px solid var(--line)">' + c[1] + '</th>').join('') + '</tr>';
    let shown = 0;
    const start = S.headerRow < 0 ? 0 : S.headerRow + 1;
    for (let r = start; r < S.rows.length && shown < 6; r++) {
      const row = S.rows[r] || [];
      if (!row.some((c) => String(c || '').trim() !== '')) continue;
      if (S.store && S.map.store != null && textCell(row[S.map.store]) !== S.store) continue;
      html += '<tr>' + cols.map(function (c) {
        let v = row[S.map[c[0]]];
        if (c[0] === 'book') v = A.fmt(A.num(v));
        else if (c[0] === 'barcode') v = A.extractCodes(v).filter((x) => /^\d{8,14}$/.test(x)).join(' / ');
        else v = textCell(v);
        return '<td style="padding:6px 9px;border-bottom:1px solid rgba(37,49,64,.5);max-width:140px;overflow:hidden;text-overflow:ellipsis">' + A.esc(v == null ? '' : v) + '</td>';
      }).join('') + '</tr>';
      shown++;
    }
    return html + '</table></div>';
  }

  function renderWizard() {
    const simple = !S.advanced && S.map.name != null && (S.map.barcode != null || S.map.code != null) && S.map.book != null;
    if (!simple) return renderWizardAdvanced();
    const prev = countPreview();
    const row = function (label, key) {
      const ci = S.map[key];
      const head = ci != null ? textCell((S.rows[S.headerRow] || [])[ci]) : '';
      const sample = ci != null ? textCell(((S.rows[S.headerRow + 1] || [])[ci])) : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(37,49,64,.5)">' +
        '<span style="color:var(--tx3);font-size:12.5px">' + label + '</span>' +
        '<span style="font-size:13px;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        (ci != null ? A.esc(head || sample || ('第 ' + (ci + 1) + ' 列')) : '<i style="color:var(--tx3)">没有这一列，跳过</i>') + '</span></div>';
    };
    const body =
      '<div class="note" style="margin-bottom:12px">已自动识别表格，只读下面这几列，直接导入就行。不对再点最下面「手动调整」。</div>' +
      '<div class="card" style="padding:2px 14px">' +
      row('门店', 'store') + row('商品编码', 'code') + row('商品全称', 'name') +
      row('数量', 'book') + row('仓库', 'loc') +
      (S.map.barcode != null ? row('69 码', 'barcode') : '') +
      '</div>' +
      storeBlockHTML() +
      (hasSaleWarehouse() ? '<label class="switch" style="margin:12px 0 2px;font-size:13px"><input type="checkbox" id="wSale"' + (S.onlySale ? ' checked' : '') + '> 只盘销售仓（跳过洪哥仓 / 在途 / 报废仓）</label>' : '') +
      '<div class="sec-title">预览</div>' +
      '<div id="wPreview">' + previewSimple() + '</div>' +
      '<div class="note" id="wCount" style="margin-top:12px">将导入 <b>' + prev.n + '</b> 个商品，其中 <b>' + prev.noCode + '</b> 个没有 69 码。</div>' +
      '<button class="btn primary block lg" id="wGo" style="margin-top:14px">导入 ' + prev.n + ' 个商品</button>' +
      '<div style="text-align:center;margin-top:10px"><button class="btn sm ghost" id="wAdv">列识别不对？手动调整</button></div>';
    const page = A.page({ title: '导入 · ' + (S.fileName || '').slice(0, 18), body: body });
    S.page = page;
    const root = page.body;
    const refresh = function () {
      const pv = countPreview();
      const pvEl = $('#wPreview', root);
      if (pvEl) pvEl.innerHTML = previewSimple();
      const cEl = $('#wCount', root);
      if (cEl) cEl.innerHTML = '将导入 <b>' + pv.n + '</b> 个商品，其中 <b>' + pv.noCode + '</b> 个没有 69 码。';
      const go = $('#wGo', root);
      if (go) { go.textContent = '导入 ' + pv.n + ' 个商品'; go.disabled = pv.n === 0; }
    };
    const stSel = $('#wStore', root);
    if (stSel) stSel.onchange = function () { S.store = stSel.value; refresh(); };
    const saleChk = $('#wSale', root);
    if (saleChk) saleChk.onchange = function () { S.onlySale = saleChk.checked; refresh(); };
    $('#wGo', root).onclick = doImport;
    $('#wAdv', root).onclick = function () { S.advanced = true; renderWizard(); };
  }

  function renderWizardAdvanced() {
    const prev = countPreview();
    const sheetNames = S.wb.SheetNames;
    const mapControls = FIELDS.map(function (f) {
      let opts = '<option value="">— 不导入 —</option>';
      for (let i = 0; i < 30; i++) {
        const header = S.rows[S.headerRow] ? S.rows[S.headerRow][i] : '';
        const sample = (S.rows[S.headerRow + 1] || [])[i];
        const label = colName(i) + (textCell(header) ? ' · ' + String(header).slice(0, 12) : (textCell(sample) ? ' · ' + String(sample).slice(0, 12) : ''));
        opts += '<option value="' + i + '"' + (S.map[f.k] === i ? ' selected' : '') + '>' + A.esc(label) + '</option>';
      }
      return '<div class="field"><label>' + f.label + (f.req ? ' *' : '') + '</label><select class="inp" data-map="' + f.k + '">' + opts + '</select></div>';
    }).join('');

    let headOpts = '';
    for (let r = 0; r < Math.min(12, S.rows.length); r++) {
      const preview = (S.rows[r] || []).map((c) => textCell(c)).filter(Boolean).slice(0, 4).join(' | ').slice(0, 38);
      headOpts += '<option value="' + r + '"' + (S.headerRow === r ? ' selected' : '') + '>第 ' + (r + 1) + ' 行' + (preview ? '：' + A.esc(preview) : '（空）') + '</option>';
    }
    headOpts += '<option value="-1"' + (S.headerRow < 0 ? ' selected' : '') + '>没有表头，全部当数据</option>';

    const storeBlock = storeBlockHTML();

    const modeBlock = A.state.session ? (
      '<div class="sec-title">导入方式</div>' +
      '<div class="fields">' +
      '<label class="radio-row"><input type="radio" name="wmode" value="new"' + (S.mode === 'new' ? ' checked' : '') + '> 新建一个盘点任务</label>' +
      '<label class="radio-row"><input type="radio" name="wmode" value="merge"' + (S.mode === 'merge' ? ' checked' : '') + '> 追加/更新到当前盘点（保留已扫数量）</label>' +
      '</div>'
    ) : '';

    const body =
      '<div class="note" style="margin-bottom:14px">表格里每个商品一行。没有 69 码的商品也能导入，导入后会自动进入「无码」页手工计数。</div>' +
      '<div class="fields">' +
      (sheetNames.length > 1 ? '<div class="field"><label>工作表</label><select class="inp" id="wSheet">' + sheetNames.map((n) => '<option' + (n === S.sheet ? ' selected' : '') + '>' + A.esc(n) + '</option>').join('') + '</select></div>' : '') +
      '<div class="field"><label>表头所在行</label><select class="inp" id="wHead">' + headOpts + '</select></div>' +
      '<div class="sec-title" style="margin:6px 0 0">列对应关系</div>' +
      '<div class="grid2">' + mapControls + '</div>' +
      '</div>' +
      storeBlock +
      modeBlock +
      '<div class="sec-title">预览（前 6 行）</div>' +
      '<div id="wPreview">' + previewHTML() + '</div>' +
      '<div class="note" style="margin-top:14px" id="wCount">将导入 <b>' + prev.n + '</b> 个商品，其中 <b>' + prev.noCode + '</b> 个没有条码（走无码流程）。</div>' +
      '<button class="btn primary block lg" id="wGo" style="margin-top:14px">导入 ' + prev.n + ' 个商品</button>' +
      '<div style="text-align:center;margin-top:10px"><button class="btn sm ghost" id="wAdvBack">返回简易模式</button></div>' +
      '<div style="height:10px"></div>';

    const page = A.page({ title: '导入清单 · ' + (S.fileName || '').slice(0, 18), body: body });
    S.page = page;
    const root = page.body;

    const refresh = function () {
      const pv = countPreview();
      $('#wPreview').innerHTML = previewHTML();
      $('#wCount').innerHTML = '将导入 <b>' + pv.n + '</b> 个商品，其中 <b>' + pv.noCode + '</b> 个没有条码（走无码流程）。';
      const go = $('#wGo');
      go.textContent = '导入 ' + pv.n + ' 个商品';
      go.disabled = pv.n === 0;
    };

    A.$$('[data-map]', root).forEach(function (sel) {
      sel.onchange = function () {
        const k = sel.getAttribute('data-map');
        if (sel.value === '') delete S.map[k]; else S.map[k] = Number(sel.value);
        refresh();
      };
    });
    const stSel = $('#wStore');
    if (stSel) stSel.onchange = function () { S.store = stSel.value; refresh(); };
    const sh = $('#wSheet');
    if (sh) sh.onchange = function () { loadSheet(sh.value); renderWizard(); };
    const hd = $('#wHead');
    if (hd) hd.onchange = function () {
      const v = Number(hd.value);
      S.headerRow = v;
      if (v >= 0) S.map = detectMap(S.rows, v);
      renderWizard();
    };
    A.$$('input[name=wmode]', root).forEach(function (r) {
      r.onchange = function () { S.mode = r.value; };
    });
    $('#wGo').onclick = doImport;
    const back = $('#wAdvBack', root);
    if (back) back.onclick = function () { S.advanced = false; renderWizard(); };
  }

  async function doImport() {
    const go = $('#wGo');
    if (!go) return;
    go.disabled = true;
    go.textContent = '导入中…';
    try {
      const res = buildItems();
      if (!res.items.length) { A.toast('没有读到商品行，请检查表头和列对应', 'bad'); go.disabled = false; return; }
      let sess;
      let updated = 0, added = 0;
      if (S.mode === 'merge' && A.state.session) {
        sess = A.state.session;
        const nameIdx = new Map(), codeIdx = new Map(), bcIdx = new Map();
        sess.items.forEach(function (it) {
          if (it.code) codeIdx.set(String(it.code).toUpperCase(), it);
          (it.barcodes || []).forEach((b) => bcIdx.set(b, it));
          nameIdx.set((it.name || '') + '|' + (it.spec || ''), it);
        });
        res.items.forEach(function (ni) {
          let hit = null;
          for (const b of ni.barcodes) { if (bcIdx.has(b)) { hit = bcIdx.get(b); break; } }
          if (!hit && ni.code) hit = codeIdx.get(String(ni.code).toUpperCase());
          if (!hit) hit = nameIdx.get((ni.name || '') + '|' + (ni.spec || ''));
          if (hit) {
            hit.name = ni.name || hit.name;
            hit.spec = ni.spec || hit.spec;
            hit.unit = ni.unit || hit.unit;
            hit.loc = ni.loc || hit.loc;
            hit.code = ni.code || hit.code;
            if (ni.book != null) hit.book = ni.book;
            ni.barcodes.forEach(function (b) {
              if (!hit.barcodes.includes(b)) hit.barcodes.push(b);
            });
            updated++;
          } else {
            sess.items.push(ni);
            ni.barcodes.forEach((b) => bcIdx.set(b, ni));
            if (ni.code) codeIdx.set(String(ni.code).toUpperCase(), ni);
            added++;
          }
        });
        sess.updatedAt = Date.now();
      } else {
        sess = A.newSession(S.store || (S.fileName ? S.fileName.replace(/\.(xlsx|xls|csv|txt)$/i, '') : '新盘点'));
        sess.store = S.store || '';
        sess.items = res.items;
        sess.source = S.fileName;
        added = res.items.length;
      }
      sess.source = S.fileName || sess.source;
      A.openSession(sess);
      await A.flush();
      A.closePage();
      A.render();
      const noCode = res.items.filter((i) => !i.barcodes.length).length;
      let msg = S.mode === 'merge' && updated ? '已更新 ' + updated + ' 个，新增 ' + added + ' 个' : '导入 ' + res.items.length + ' 个商品';
      if (noCode) msg += '，' + noCode + ' 个无条码';
      A.toast(msg, 'ok');
      if (res.dups.length) {
        A.toast(res.dups.length + ' 个条码在表格里重复，已留在第一次出现的商品上', 'bad', {
          label: '查看',
          fn: function () {
            A.sheet({
              title: '重复条码',
              body: '<div class="hint" style="margin-bottom:10px">同一格条码出现在多行时，只会保留第一次出现的行，避免扫一次加两次。</div>' +
                res.dups.slice(0, 80).map((d) => '<div class="row" style="padding:8px 0"><div class="grow"><div class="nm" style="font-size:13px">' + A.esc(d.code) + '</div><div class="meta">保留：' + A.esc(d.keep) + ' · 忽略：' + A.esc(d.drop) + '</div></div></div>').join(''),
            });
          },
        });
      }
    } catch (e) {
      console.error(e);
      A.toast('导入失败：' + e.message, 'bad');
      go.disabled = false;
      go.textContent = '重试导入';
    }
  }

  async function handlePickedFile(f) {
    if (!f) return;
    if (typeof XLSX === 'undefined') {
      A.toast('表格组件没加载成功：请联网打开一次这个 App 再试', 'bad');
      return;
    }
    try {
      A.toast('正在读取表格…');
      const wb = await readFile(f);
      if (!wb || !wb.SheetNames || !wb.SheetNames.length) {
        A.toast('这个文件里没有工作表', 'bad');
        return;
      }
      S.wb = wb;
      S.fileName = f.name || '清单';
      S.store = '';
      S.advanced = false;
      loadSheet(wb.SheetNames[0]);
      renderWizard();
    } catch (e) {
      console.error(e);
      A.toast('读不了这个文件：' + (e.message || e) + '（支持 xlsx / xls / csv）', 'bad');
    }
  }

  A.resetImportMode = function () { S.mode = 'new'; S.store = ''; };

  A.setupFileInput = function () {
    const input = $('#fileIn');
    if (!input || input.__bound) return;
    input.__bound = true;
    input.addEventListener('change', async function () {
      const f = input.files && input.files[0];
      if (!f) { A.toast('没有拿到文件，选择器返回为空', 'bad'); return; }
      A.toast('已选择：' + f.name + '（' + Math.max(1, Math.round(f.size / 1024)) + 'KB）');
      await handlePickedFile(f);
      try { input.value = ''; } catch (e) {}
    });
  };

  A.openImport = function (mode) {
    A.resetImportMode();
    S.mode = mode || 'new';
    const input = $('#fileIn');
    try { input.value = ''; } catch (e) {}
    input.click();
  };

  A.importWizard = { reset: function () { S.wb = null; S.rows = []; } };
})();
