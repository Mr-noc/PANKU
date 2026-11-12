/* 盘库 APP — 核心：状态、存储、工具、商品操作 */
(function () {
  const A = (window.A = window.A || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  A.$ = $;
  A.$$ = $$;
  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  A.uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  A.clone = (o) => JSON.parse(JSON.stringify(o));
  A.debounce = function (fn, ms) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  };

  /* ---------------- 图标 ---------------- */
  const ICONS = {
    camera: '<path d="M4 7.5h2.4l1.2-2h8.8l1.2 2H20a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z"/><circle cx="12" cy="13" r="3.4"/>',
    tag: '<path d="M12.6 3.3H20a.7.7 0 0 1 .7.7v7.4a1 1 0 0 1-.3.7l-8 8a1 1 0 0 1-1.4 0l-6.8-6.8a1 1 0 0 1 0-1.4l8-8a1 1 0 0 1 .4-.2Z"/><circle cx="16.6" cy="7.4" r="1.4"/>',
    list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.3" cy="6.5" r="1.2"/><circle cx="4.3" cy="12" r="1.2"/><circle cx="4.3" cy="17.5" r="1.2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    download: '<path d="M12 3v12M7.5 11l4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',
    upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 19.5h16"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4.2 4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    photo: '<path d="M4 6.5h16v11H4z"/><circle cx="9" cy="11" r="1.6"/><path d="m5 17 5-5 3.5 3.5L17 12l3 5"/>',
    print: '<path d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
    torch: '<path d="M9 3h6l-1 6h3l-7 12 1.5-8H8L9 3Z"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    warn: '<path d="M12 4 2.8 20h18.4L12 4Z"/><path d="M12 10v4.5M12 17.4h.01"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M3.5 12h17"/>',
    box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    hand: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v5.5a4 4 0 0 1-4 4h-1.6a4 4 0 0 1-3-1.4L5 15.5a1.7 1.7 0 0 1 2.6-2.1L9 15"/>',
  };
  A.icon = function (n, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
  };

  /* ---------------- 本地存储 ---------------- */
  const DB = (function () {
    let p = null;
    function open() {
      if (p) return p;
      p = new Promise((res, rej) => {
        if (!('indexedDB' in window)) return rej(new Error('no indexedDB'));
        const r = indexedDB.open('panku-db', 1);
        r.onupgradeneeded = function () {
          const db = r.result;
          if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('db blocked'));
      });
      return p;
    }
    function run(store, mode, fn) {
      return open().then(function (db) {
        return new Promise((res, rej) => {
          let tx;
          try { tx = db.transaction(store, mode); } catch (e) { return rej(e); }
          let out;
          const req = fn(tx.objectStore(store));
          if (req) req.onsuccess = () => (out = req.result);
          tx.oncomplete = () => res(out);
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error);
        });
      });
    }
    return {
      all: () => run('sessions', 'readonly', (s) => s.getAll()),
      put: (v) => run('sessions', 'readwrite', (s) => s.put(v)),
      del: (id) => run('sessions', 'readwrite', (s) => s.delete(id)),
      getMeta: (k) => run('meta', 'readonly', (s) => s.get(k)),
      setMeta: (k, v) => run('meta', 'readwrite', (s) => s.put({ k: k, v: v })),
    };
  })();

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  A.LS = LS;

  /* ---------------- 全局状态 ---------------- */
  const S = (A.state = {
    session: null,
    sessions: [],
    tab: 'scan',
    filter: 'all',
    q: '',
    q2: '',
    settings: Object.assign({ sound: true, vibrate: true, dedupe: true, wake: true }, LS.get('panku.settings', {})),
    idx: { bc: new Map(), cd: new Map() },
    undo: [],
    lastScan: null,
    busy: false,
  });
  A.settings = S.settings;

  A.saveSettings = function () {
    LS.set('panku.settings', S.settings);
  };

  /* ---------------- 数据工具 ---------------- */
  A.num = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).replace(/[,，\s]/g, '').replace(/[^\d.\-]/g, '');
    if (!s || s === '-' || s === '.') return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  A.fmt = function (n) {
    if (n == null || n === '') return '—';
    const x = Number(n);
    if (!isFinite(x)) return '—';
    return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(+(+x).toFixed(3));
  };

  A.normCode = function (v) {
    if (v == null) return '';
    let s = String(v).trim();
    s = s.replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    s = s.replace(/[\s\u3000]/g, '');
    if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) {
      const n = Number(s);
      if (isFinite(n)) s = n.toFixed(0);
    }
    return s;
  };

  /* 从单元格里拆出多个条码：支持 "6901234567890, 6901234567891" */
  A.extractCodes = function (v) {
    const out = [];
    if (v == null) return out;
    let s = A.normCode(v);
    if (!s) return out;
    s = s.replace(/^(69码|条码|条形码|条型码)[:：]?/i, '');
    const parts = s.split(/[,，;；、\/|]+/).map((x) => x.trim()).filter(Boolean);
    parts.forEach(function (p) {
      p = p.replace(/^[（(]/, '').replace(/[)）]$/, '');
      if (/^\d{6,14}$/.test(p)) { out.push(p); return; }
      const m = p.match(/\d{8,14}/);
      if (m) { out.push(m[0]); return; }
      const q = p.match(/[A-Za-z0-9][A-Za-z0-9\-_]{2,}/);
      if (q) out.push(q[0].toUpperCase());
    });
    return Array.from(new Set(out)).filter((c) => c.length >= 4);
  };

  A.eanValid = function (code) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length !== 13 && c.length !== 8) return null;
    const d = c.split('').map(Number);
    const check = d.pop();
    let sum = 0;
    const rev = d.reverse();
    rev.forEach((n, i) => (sum += n * (i % 2 === 0 ? 3 : 1)));
    return (10 - (sum % 10)) % 10 === check;
  };

  A.is69 = (code) => /^69\d{11}$/.test(String(code || ''));

  /* ---------------- 会话 ---------------- */
  A.newSession = function (name) {
    return {
      id: A.uid('s'),
      name: name || '未命名盘点',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: '',
      items: [],
      unknown: [],
      notes: '',
    };
  };

  A.openSession = function (sess) {
    S.session = sess;
    S.tab = 'scan';
    S.filter = 'all';
    S.q = '';
    S.q2 = '';
    S.undo = [];
    S.lastScan = null;
    if (!sess.unknown) sess.unknown = [];
    // 兼容 1.4 导入的旧数据：整份都没有条码、但编码是纯数字时，自动补成 69 码
    if (!sess.barcodeFixed) {
      const anyBc = sess.items.some((it) => (it.barcodes || []).length);
      if (!anyBc) {
        sess.items.forEach(function (it) {
          if (it.code && /^\d+$/.test(it.code)) it.barcodes = [it.code];
        });
      }
      sess.barcodeFixed = true;
    }
    sess.items.forEach((it) => {
      if (!it.barcodes) it.barcodes = [];
      if (!it.altCodes) it.altCodes = [];
      if (it.count === undefined) it.count = null;
      if (it.book === undefined) it.book = null;
    });
    A.rebuild();
    A.flush();
  };

  A.loadAll = async function () {
    let list = [];
    try {
      list = (await DB.all()) || [];
    } catch (e) {
      console.warn('IndexedDB 不可用', e);
      list = LS.get('panku.sessions', []);
    }
    A.state.sessions = list.map((s) => ({
      id: s.id, name: s.name, updatedAt: s.updatedAt,
      n: (s.items || []).length,
      counted: (s.items || []).filter((i) => i.count != null).length,
    })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    let activeId = null;
    try { activeId = (await DB.getMeta('active'))?.v; } catch (e) {}
    if (!activeId) activeId = LS.get('panku.active', null);
    const pool = list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const target = pool.find((s) => s.id === activeId) || pool[0];
    if (target) A.openSession(target);
    return !!target;
  };

  let saveTimer = null;
  A.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(A.flush, 320);
  };
  A.flush = async function () {
    clearTimeout(saveTimer);
    const sess = S.session;
    if (!sess) return;
    sess.updatedAt = Date.now();
    const meta = {
      id: sess.id, name: sess.name, updatedAt: sess.updatedAt,
      n: sess.items.length, counted: sess.items.filter((i) => i.count != null).length,
    };
    const i = S.sessions.findIndex((x) => x.id === sess.id);
    if (i >= 0) S.sessions[i] = meta; else S.sessions.push(meta);
    try {
      await DB.put(sess);
      await DB.setMeta('active', sess.id);
    } catch (e) {
      console.warn('保存失败，改用 localStorage', e);
      try {
        const arr = LS.get('panku.sessions', []);
        const k = arr.findIndex((x) => x.id === sess.id);
        if (k >= 0) arr[k] = sess; else arr.push(sess);
        LS.set('panku.sessions', arr);
        LS.set('panku.active', sess.id);
      } catch (_) {}
    }
  };

  A.deleteSession = async function (id) {
    try { await DB.del(id); } catch (e) {}
    S.sessions = S.sessions.filter((s) => s.id !== id);
    if (S.session && S.session.id === id) S.session = null;
  };

  /* ---------------- 索引 ---------------- */
  A.rebuild = function () {
    const bc = new Map(), cd = new Map();
    const sess = S.session;
    if (sess) {
      sess.items.forEach((it) => {
        if (it.code) cd.set(A.normCode(it.code).toUpperCase(), it);
        (it.altCodes || []).forEach(function (c) {
          const k = A.normCode(c).toUpperCase();
          if (k && !cd.has(k)) cd.set(k, it);
        });
        (it.barcodes || []).forEach(function (b) {
          const c = A.normCode(b);
          if (!c) return;
          if (!bc.has(c)) bc.set(c, it);
          if (/^\d+$/.test(c) && c !== c.replace(/^0+/, '')) {
            const z = c.replace(/^0+/, '');
            if (!bc.has(z)) bc.set(z, it);
          }
        });
      });
    }
    S.idx = { bc: bc, cd: cd };
  };

  A.findByCode = function (raw) {
    const c = A.normCode(raw);
    if (!c) return null;
    const idx = S.idx;
    let it = idx.bc.get(c) || idx.cd.get(c.toUpperCase());
    if (it) return it;
    if (/^\d+$/.test(c)) {
      const nz = c.replace(/^0+/, '');
      it = idx.bc.get(nz) || idx.cd.get(nz);
      if (it) return it;
      if (c.length === 12) {
        it = idx.bc.get('0' + c);
        if (it) return it;
      }
      if (c.length === 13 && c[0] === '0') {
        it = idx.bc.get(c.slice(1));
        if (it) return it;
      }
      if (c.length < 12) {
        it = idx.bc.get(c.padStart(13, '0'));
        if (it) return it;
      }
    }
    return null;
  };

  /* ---------------- 商品操作 ---------------- */
  A.counted = (it) => it.count != null;
  A.isDiff = function (it) {
    if (it.count == null) return false;
    if (it.book == null) return true;
    return Math.abs(Number(it.count) - Number(it.book)) > 1e-9;
  };
  A.needManual = (it) => (it.barcodes || []).length === 0 || !!it.manual;

  A.touch = function (kind) {
    A.rebuild();
    A.save();
    if (typeof A.onData === 'function') A.onData(kind || 'count');
  };

  A.setCount = function (item, n, opts) {
    if (!item) return;
    opts = opts || {};
    const prev = item.count;
    let v = n == null ? null : Number(n);
    if (v != null && (!isFinite(v) || v < 0)) v = Math.max(0, isFinite(v) ? v : 0);
    if (prev === v) return;
    item.count = v;
    item.countedAt = v == null ? null : Date.now();
    if (opts.undo !== false) {
      S.undo.push({ itemId: item.id, prev: prev, at: Date.now() });
      if (S.undo.length > 40) S.undo.shift();
    }
    A.touch('count');
    return v;
  };

  A.bump = function (item, delta) {
    if (!item) return;
    const base = item.count == null ? 0 : Number(item.count);
    return A.setCount(item, Math.round((base + delta) * 1000) / 1000);
  };

  A.undoLast = function () {
    const u = S.undo.pop();
    if (!u) { A.toast('没有可撤销的操作', 'bad'); return; }
    const it = S.session && S.session.items.find((x) => x.id === u.itemId);
    if (!it) return;
    it.count = u.prev;
    it.countedAt = u.prev == null ? null : Date.now();
    A.touch('count');
    A.toast('已撤销：' + (u.prev == null ? '恢复为未盘' : '数量改回 ' + A.fmt(u.prev)), 'ok');
  };

  A.addItem = function (data) {
    const it = Object.assign({
      id: A.uid('it'), name: '', spec: '', unit: '', code: '', barcodes: [],
      loc: '', book: null, count: null, note: '', photo: null, manual: false, isNew: false,
    }, data || {});
    it.barcodes = (it.barcodes || []).map(A.normCode).filter(Boolean);
    S.session.items.push(it);
    A.touch('items');
    return it;
  };

  A.removeItem = function (id) {
    const sess = S.session;
    sess.items = sess.items.filter((x) => x.id !== id);
    A.touch('items');
  };

  A.findItem = (id) => S.session && S.session.items.find((x) => x.id === id);

  A.stats = function () {
    const sess = S.session;
    const st = { total: 0, counted: 0, diff: 0, up: 0, down: 0, newItem: 0, book: 0, real: 0, noCode: 0, unknown: 0, scanned: 0 };
    if (!sess) return st;
    st.unknown = sess.unknown.length;
    sess.items.forEach(function (it) {
      st.total++;
      if (A.needManual(it)) st.noCode++;
      if (it.count != null) {
        st.counted++;
        st.real += Number(it.count) || 0;
      }
      if (it.book != null) st.book += Number(it.book) || 0;
      if (it.count != null) {
        if (it.book == null) { st.diff++; st.newItem++; }
        else if (Math.abs(it.count - it.book) > 1e-9) {
          st.diff++;
          if (it.count > it.book) st.up++; else st.down++;
        }
      }
    });
    return st;
  };

  A.searchItems = function (q, limit) {
    const sess = S.session;
    if (!sess) return [];
    const key = String(q || '').trim().toLowerCase();
    if (!key) return sess.items.slice(0, limit || 30);
    const out = [];
    for (const it of sess.items) {
      const hay = [it.name, it.spec, it.code, it.loc, (it.barcodes || []).join(' '), (it.altCodes || []).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(key) >= 0) out.push(it);
      else if (key.length >= 2) {
        // 多关键字：空格分词，全部命中才算
        const parts = key.split(/\s+/).filter(Boolean);
        if (parts.length > 1 && parts.every((p) => hay.indexOf(p) >= 0)) out.push(it);
      }
      if (limit && out.length >= limit) break;
    }
    return out;
  };

  A.progressText = function () {
    const st = A.stats();
    return '已盘 ' + st.counted + '/' + st.total + (st.diff ? ' · 差异 ' + st.diff : '');
  };

  /* ---------------- 反馈 ---------------- */
  A.toast = function (msg, type, action) {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<span>' + A.esc(msg) + '</span>';
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = function () { el.remove(); action.fn && action.fn(); };
      el.appendChild(b);
    }
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 260);
    }, action ? 4200 : 2400);
  };

  let actx = null;
  A.initAudio = function () {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
  };
  function tone(freq, dur, when, vol) {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t0 = actx.currentTime + (when || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  A.beep = function (kind) {
    if (!S.settings.sound || !actx) return;
    try {
      if (kind === 'bad') { tone(220, 0.16, 0, 0.12); tone(165, 0.22, 0.14, 0.12); }
      else if (kind === 'ok') { tone(880, 0.07, 0, 0.12); tone(1320, 0.09, 0.06, 0.1); }
    } catch (e) {}
  };
  A.vibrate = function (p) {
    if (!S.settings.vibrate) return;
    try { navigator.vibrate && navigator.vibrate(p); } catch (e) {}
  };
  A.feedback = function (kind) {
    A.beep(kind);
    A.vibrate(kind === 'bad' ? [40, 60, 40] : 28);
  };

  /* ---------------- 弹层 ---------------- */
  let sheetEl = null, sheetBg = null, sheetOnClose = null;
  A.closeSheet = function () {
    if (!sheetEl) return;
    if (A.scanPause) A.scanPause(false);
    const cb = sheetOnClose;
    sheetOnClose = null;
    if (cb) setTimeout(cb, 60);
    const s = sheetEl, b = sheetBg;
    sheetEl = null; sheetBg = null;
    s.classList.remove('on');
    b.classList.remove('on');
    setTimeout(() => { s.remove(); b.remove(); }, 280);
  };
  A.sheet = function (opts) {
    A.closeSheet();
    if (A.scanPause) A.scanPause(true);
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.onclick = () => A.closeSheet();
    const panel = document.createElement('div');
    panel.className = 'sheet';
    const head = document.createElement('div');
    head.className = 'sheet-h';
    head.innerHTML = '<div class="t">' + A.esc(opts.title || '') + '</div>';
    if (opts.sub) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:11.5px;color:var(--tx3);max-width:50%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      sub.textContent = opts.sub;
      head.appendChild(sub);
    }
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.innerHTML = A.icon('close');
    closeBtn.onclick = () => A.closeSheet();
    head.appendChild(closeBtn);
    const body = document.createElement('div');
    body.className = 'sheet-b';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    panel.appendChild(head);
    panel.appendChild(body);
    if (opts.foot) {
      const foot = document.createElement('div');
      foot.className = 'sheet-f';
      if (typeof opts.foot === 'string') foot.innerHTML = opts.foot;
      else if (Array.isArray(opts.foot)) {
        opts.foot.forEach(function (b) {
          const btn = document.createElement('button');
          btn.className = 'btn ' + (b.cls || '');
          btn.textContent = b.label;
          btn.onclick = function () { b.onClick && b.onClick(A.closeSheet); };
          foot.appendChild(btn);
        });
      } else foot.appendChild(opts.foot);
      panel.appendChild(foot);
    }
    $('#sheetRoot').append(bg, panel);
    requestAnimationFrame(() => { bg.classList.add('on'); panel.classList.add('on'); });
    sheetEl = panel; sheetBg = bg;
    sheetOnClose = opts.onClose || null;
    if (opts.onMount) opts.onMount(body, panel);
    return { el: panel, body: body, close: A.closeSheet };
  };

  A.confirm = function (opts) {
    return new Promise(function (resolve) {
      let done = false;
      const finish = (v) => { if (done) return; done = true; A.closeSheet(); resolve(v); };
      A.sheet({
        title: opts.title || '确认',
        body: '<div style="font-size:14px;line-height:1.75;color:var(--tx2);white-space:pre-wrap">' + A.esc(opts.text || '') + '</div>',
        foot: [
          { label: opts.cancelText || '取消', onClick: () => finish(false) },
          { label: opts.okText || '确定', cls: opts.danger ? 'danger' : 'primary', onClick: () => finish(true) },
        ],
      });
    });
  };

  /* 全屏页 */
  A.page = function (opts) {
    if (A.scanPause) A.scanPause(true);
    const root = $('#pageRoot');
    root.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'page';
    p.innerHTML =
      '<div class="page-h">' +
      '<button class="icon-btn" data-act="page-close">' + A.icon('back') + '</button>' +
      '<div class="t">' + A.esc(opts.title || '') + '</div>' +
      (opts.headRight || '') +
      '</div><div class="page-b"></div>';
    root.appendChild(p);
    const body = p.querySelector('.page-b');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    p.querySelector('[data-act="page-close"]').onclick = () => A.closePage();
    if (opts.onMount) opts.onMount(body, p);
    return { el: p, body: body };
  };
  A.closePage = function () {
    if (A.scanPause) A.scanPause(false);
    const root = $('#pageRoot');
    if (root) root.innerHTML = '';
  };

  /* 强制更新：清掉 Service Worker 和缓存再刷新 */
  A.hardReload = async function () {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {}
    location.reload();
  };

  /* 图片压缩 */
  A.shrinkImage = function (file, maxW) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          const scale = Math.min(1, (maxW || 640) / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const data = c.toDataURL('image/jpeg', 0.72);
          URL.revokeObjectURL(url);
          resolve(data);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  };
})();
