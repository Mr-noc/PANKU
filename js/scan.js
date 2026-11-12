/* 盘库 APP — 相机扫码 */
(function () {
  const A = window.A;
  const $ = A.$;
  const S = A.state;

  const st = (A.scanState = {
    stream: null, video: null, canvas: null, det: null, reader: null,
    running: false, paused: false, timer: null,
    lastCode: '', lastAt: 0, torchOn: false, track: null,
    wake: null, err: '', cardEl: null, mounted: false,
  });

  A.scanPause = function (v) { st.paused = !!v; };

  function diagText() {
    const perm = st.perm || '未知';
    return '地址 ' + location.origin +
      '\n安全环境 ' + (window.isSecureContext ? '是' : '否') +
      '\n相机接口 ' + (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? '有' : '无') +
      '\n权限 ' + perm +
      '\n错误 ' + (st.lastErr || '无');
  }
  function refreshPerm() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then(function (p) {
          st.perm = p.state;
          const d = $('#camDiag');
          if (d) d.textContent = diagText();
        }).catch(function () {});
      }
    } catch (e) {}
  }
  function setErr(msg, errName) {
    st.err = msg;
    st.lastErr = errName || '';
    const box = $('#camErr');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<div style="font-size:26px">' + A.icon('camera') + '</div>' +
      '<div style="max-width:300px">' + A.esc(msg) + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn sm" id="camRetry">重试</button>' +
      '<button class="btn sm primary" id="camPhoto">拍照识别</button>' +
      '</div>' +
      '<div class="cam-diag" id="camDiag">' + A.esc(diagText()) + '</div>';
    const b = $('#camRetry');
    if (b) b.onclick = function () { st.err = ''; box.hidden = true; start(); };
    const pb = $('#camPhoto');
    if (pb) pb.onclick = function () { A.photoScan(); };
    refreshPerm();
  }
  function clearErr() {
    st.err = '';
    const box = $('#camErr');
    if (box) box.hidden = true;
  }

  /* ---------- 结果卡片 ---------- */
  function diffBadge(it) {
    if (it.count == null) return '<span class="badge gray">未盘</span>';
    if (it.book == null) return '<span class="badge warn">新品</span>';
    const d = Number(it.count) - Number(it.book);
    if (Math.abs(d) < 1e-9) return '<span class="badge ok">相符</span>';
    if (d > 0) return '<span class="badge warn">盘盈 +' + A.fmt(d) + '</span>';
    return '<span class="badge bad">盘亏 ' + A.fmt(d) + '</span>';
  }

  A.scanCardHTML = function () {
    const last = S.lastScan;
    const it = last ? A.findItem(last.itemId) : null;
    if (!it) {
      const stats = A.stats();
      return '<div class="result idle">' +
        '<div class="idle-h">扫码即计数</div>' +
        '<div class="idle-p">' +
        '· 对准 <b>69 码</b>，识别后自动匹配清单并 +1<br>' +
        '· 清单里<b>没有条码</b>的商品，去「无码」页点 +1<br>' +
        '· 扫到清单外的码，可新建商品或关联到已有商品' +
        '</div>' +
        '<div style="display:flex;gap:14px;margin-top:16px;font-size:11.5px;color:var(--tx3)">' +
        '<div><b style="font-size:18px;color:var(--acc);display:block;font-variant-numeric:tabular-nums">' + stats.counted + '</b>已盘</div>' +
        '<div><b style="font-size:18px;color:var(--tx);display:block;font-variant-numeric:tabular-nums">' + stats.total + '</b>总品项</div>' +
        '<div><b style="font-size:18px;color:var(--warn);display:block;font-variant-numeric:tabular-nums">' + stats.diff + '</b>差异</div>' +
        '</div></div>';
    }
    const cnt = it.count == null ? 0 : it.count;
    const meta = [];
    if (it.spec) meta.push(A.esc(it.spec));
    if (it.loc) meta.push('货位 ' + A.esc(it.loc));
    if (it.unit) meta.push(A.esc(it.unit));
    const undo = S.undo.length ? S.undo[S.undo.length - 1] : null;
    return '<div class="result">' +
      '<div class="r-top"><div style="flex:1;min-width:0">' +
      '<div class="r-name">' + A.esc(it.name || '未命名商品') + '</div>' +
      '<div class="r-meta">' + (meta.length ? meta.map((m) => '<span>' + m + '</span>').join('<span>·</span>') : '<span>无规格信息</span>') + '</div>' +
      '</div>' + diffBadge(it) + '</div>' +
      '<div class="r-nums">' +
      '<div class="r-big">' + A.fmt(cnt) + '</div>' +
      '<div class="r-side">实盘数量<br><b>账面 ' + (it.book == null ? '—' : A.fmt(it.book)) + '</b></div>' +
      '<div style="margin-left:auto;text-align:right;font-size:11px;color:var(--tx3);padding-bottom:4px">' +
      (it.barcodes && it.barcodes.length ? '<div style="font-variant-numeric:tabular-nums">' + A.esc(it.barcodes[0]) + '</div>' : '<div class="badge gray">无条码</div>') + '</div>' +
      '</div>' +
      '<div class="r-btns">' +
      '<button class="btn" data-act="scan-minus">−1</button>' +
      '<button class="btn plus" data-act="scan-plus">+1</button>' +
      '<button class="btn" data-act="scan-detail">详情</button>' +
      '</div>' +
      (undo ? '<div class="undo-strip"><span>刚刚操作</span><b>' + A.esc(it.name || '') + '</b><button data-act="undo">撤销</button></div>' : '') +
      '</div>';
  };

  A.updateScanCard = function () {
    const el = $('#scanCard');
    if (!el) return;
    el.innerHTML = A.scanCardHTML();
  };

  /* ---------- 相机 ---------- */
  function showStart(msg, busy) {
    const box = $('#camStart');
    if (!box) return;
    box.hidden = false;
    const btn = $('#camStartBtn');
    if (btn) { btn.disabled = !!busy; btn.textContent = busy ? msg : '点一下开启相机'; }
    const hint = $('#camStartHint');
    if (hint) hint.textContent = busy ? '首次使用需要允许相机权限' : '如果刚才没有弹出权限提示，点这里再试一次';
  }
  function hideStart() {
    const box = $('#camStart');
    if (box) box.hidden = true;
  }
  function setLabel(t) {
    const l = $('#camState');
    if (l) l.textContent = t;
  }
  function onLive() {
    if (st.running) return;
    st.running = true;
    st.pending = false;
    clearTimeout(st.guard);
    clearTimeout(st.wd2);
    st.lastErr = '';
    hideStart();
    clearErr();
    setLabel('连续扫码 · 对准条码');
    setupDetector();
    loop();
    keepAwake();
    watchFrames();
  }
  function watchFrames() {
    clearTimeout(st.frameTimer);
    const t0 = Date.now();
    const tick = function () {
      if (!st.running) return;
      const v = st.video;
      if (v && v.videoWidth > 0) {
        const w = $('#camWarn');
        if (w) w.hidden = true;
        return;
      }
      if (Date.now() - t0 > 3500) {
        const w = $('#camWarn');
        if (w) w.hidden = false;
        setLabel('画面异常');
      }
      st.frameTimer = setTimeout(tick, 1500);
    };
    st.frameTimer = setTimeout(tick, 2500);
  }
  async function start() {
    if (st.running || st.pending) return;
    const video = $('#cam');
    if (!video) return;
    st.video = video;
    clearErr();
    if (!window.isSecureContext) {
      setErr('当前页面不是安全地址，浏览器禁止使用相机。请用 http://127.0.0.1:8765 打开。');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr('这个浏览器不支持网页调用相机，请用 Chrome / Edge 打开，或用下面的「拍照识别」。');
      return;
    }
    A.initAudio();
    st.pending = true;
    setLabel('正在请求相机权限…');
    showStart('正在请求相机权限…', true);
    st.guard = setTimeout(function () {
      if (!st.running && st.pending) {
        st.pending = false;
        setLabel('相机未启动');
        showStart('相机没有响应', false);
      }
    }, 8000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      st.stream = stream;
      st.track = stream.getVideoTracks()[0];
      video.setAttribute('playsinline', '');
      video.muted = true;
      video.srcObject = stream;
      showStart('正在打开画面…', true);
      setLabel('正在打开画面…');
      video.onloadeddata = onLive;
      video.oncanplay = onLive;
      const p = video.play();
      if (p && p.catch) p.catch(function () {});
      setTimeout(function () { if (!st.running && video.videoWidth > 0) onLive(); }, 700);
      st.wd2 = setTimeout(function () {
        if (!st.running) {
          showStart('画面没有出来，点一下再试', false);
          setLabel('画面没有出来');
        }
      }, 9000);
      const caps = st.track.getCapabilities ? st.track.getCapabilities() : {};
      const tb = $('#torchBtn');
      if (tb && caps && caps.torch) tb.hidden = false;
    } catch (e) {
      st.pending = false;
      clearTimeout(st.guard);
      hideStart();
      let msg = '相机启动失败：' + (e.message || e.name);
      if (e.name === 'NotAllowedError') msg = '相机权限被拒绝了。点地址栏左边的设置 → 权限 → 相机 → 允许，然后刷新页面。';
      else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') msg = '没有找到可用的后置摄像头。';
      else if (e.name === 'NotReadableError') msg = '相机被其它应用占用，先关掉其它相机应用再重试。';
      else if (e.name === 'SecurityError') msg = '当前地址不允许使用相机，请用 http://127.0.0.1:8765 打开。';
      setLabel('相机未启动');
      setErr(msg, e.name);
    }
  }

  function stop() {
    st.running = false;
    st.paused = false;
    st.pending = false;
    clearTimeout(st.timer);
    clearTimeout(st.guard);
    clearTimeout(st.wd2);
    clearTimeout(st.frameTimer);
    if (st.stream) {
      st.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
      st.stream = null;
    }
    st.track = null;
    st.det = null;
    if (st.wake) { try { st.wake.release(); } catch (e) {} st.wake = null; }
    const v = $('#cam');
    if (v) v.srcObject = null;
  }

  function setupDetector() {
    st.det = null;
    st.reader = null;
    st.detMiss = 0;
    const wanted = ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'qr_code', 'codabar', 'data_matrix'];
    if ('BarcodeDetector' in window) {
      try {
        const supported = (BarcodeDetector.getSupportedFormats ? BarcodeDetector.getSupportedFormats() : Promise.resolve(wanted));
        Promise.resolve(supported).then(function (fmts) {
          const use = wanted.filter((f) => fmts.indexOf(f) >= 0);
          if (use.length) st.det = new BarcodeDetector({ formats: use });
        }).catch(function () {});
      } catch (e) {}
    }
    if (window.ZXing) {
      try {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.CODABAR,
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, false);
        st.reader = new ZXing.MultiFormatReader();
        st.reader.setHints(hints);
        st.canvas = st.canvas || document.createElement('canvas');
      } catch (e) { console.warn('ZXing init', e); }
    }
  }

  function zxingScan() {
    const v = st.video;
    if (!v || !v.videoWidth || !st.reader) return;
    const maxW = 800;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const c = st.canvas;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    try {
      const lum = new ZXing.RGBLuminanceSource(img.data, w, h);
      const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
      const res = st.reader.decode(bmp);
      if (res && res.getText) onCode(res.getText());
    } catch (e) { /* 没扫到是常态 */ }
  }

  function loop() {
    if (!st.running) return;
    const step = function () {
      if (!st.running) return;
      if (!st.paused && st.video && st.video.readyState >= 2 && st.video.videoWidth) {
        if (st.det) {
          st.det.detect(st.video).then(function (codes) {
            if (codes && codes.length) {
              st.detMiss = 0;
              onCode(codes[0].rawValue);
            } else {
              st.detMiss = (st.detMiss || 0) + 1;
              // 浏览器自带的检测器一直没结果时，回退到 ZXing
              if (st.detMiss > 14) st.det = null;
            }
          }).catch(function () {
            st.detMiss = (st.detMiss || 0) + 1;
            if (st.detMiss > 6) st.det = null;
          });
        } else if (st.reader) {
          zxingScan();
        }
      }
      st.tick = (st.tick || 0) + 1;
      if (!st.paused && st.tick % 5 === 0) grabDecode();
      st.timer = setTimeout(step, st.det ? 140 : 240);
    };
    clearTimeout(st.timer);
    step();
  }

  /* ---------- 识别结果 ---------- */
  function flash() {
    const f = $('#flash');
    if (!f) return;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  function onCode(raw) {
    const code = A.normCode(raw);
    if (!code) return;
    const now = Date.now();
    if (S.settings.dedupe && code === st.lastCode && now - st.lastAt < 2000) {
      st.lastAt = now; // 画面里一直是这个码：不断顺延，移开后才允许再计
      return;
    }
    st.lastCode = code;
    st.lastAt = now;
    const item = A.findByCode(code);
    if (item) {
      A.bump(item, 1);
      S.lastScan = { itemId: item.id, code: code, at: now };
      flash();
      A.feedback('ok');
      A.updateScanCard();
      if (A.updateChrome) A.updateChrome();
    } else {
      A.feedback('bad');
      pauseForDialog();
      openUnknown(code);
    }
  }

  function pauseForDialog() {
    st.paused = true;
  }

  /* 未知码：新建 / 关联 / 忽略 */
  function openUnknown(code) {
    if (!S.session) { A.toast('先导入一张清单', 'bad'); return; }
    const exists = S.session.unknown.some((u) => u.code === code);
    if (!exists) S.session.unknown.push({ code: code, at: Date.now() });
    A.save();
    if (A.updateChrome) A.updateChrome();

    const body = document.createElement('div');
    body.innerHTML =
      '<div class="note warn" style="margin-bottom:12px">条码 <b style="font-variant-numeric:tabular-nums">' + A.esc(code) + '</b> 不在清单里。<br>可能是新品、表格漏登，或者这是箱码/包装码。</div>' +
      '<div class="btn-row" style="margin-bottom:6px">' +
      '<button class="btn primary" data-u="new">' + A.icon('plus') + ' 新建商品并计数</button>' +
      '</div>' +
      '<div class="sec-title" style="margin-top:14px">关联到清单里的商品</div>' +
      '<div class="searchwrap"><input class="search" id="uSearch" placeholder="输入名称 / 编码 / 条码" autocomplete="off"></div>' +
      '<div id="uList"></div>' +
      '<div class="hint" style="margin-top:12px">关联后这个码会记到该商品名下，下次扫它直接累加。适合「一物多码」「箱码/单品码」。</div>';

    const sheet = A.sheet({ title: '清单外条码', body: body });

    const list = body.querySelector('#uList');
    const renderList = function (q) {
      const items = A.searchItems(q, 30);
      if (!items.length) { list.innerHTML = '<div class="hint" style="padding:14px 2px">没有匹配的商品。</div>'; return; }
      list.innerHTML = '<div class="rows">' + items.map(function (it) {
        return '<div class="row" data-link="' + it.id + '"><div class="grow"><div class="nm">' + A.esc(it.name) + '</div>' +
          '<div class="meta">' + (it.barcodes.length ? A.esc(it.barcodes[0]) : '无条码') + (it.spec ? ' · ' + A.esc(it.spec) : '') + '</div></div>' +
          '<div class="badge gray">' + (it.count == null ? '未盘' : '实盘 ' + A.fmt(it.count)) + '</div>' +
          '<span style="color:var(--acc);font-size:12px;font-weight:700">关联</span></div>';
      }).join('') + '</div>';
      A.$$('[data-link]', list).forEach(function (row) {
        row.onclick = function () {
          const it = A.findItem(row.getAttribute('data-link'));
          if (!it) return;
          if (!it.barcodes.includes(code)) it.barcodes.push(code);
          it.manual = false;
          A.bump(it, 1);
          S.lastScan = { itemId: it.id, code: code, at: Date.now() };
          S.session.unknown = S.session.unknown.filter((u) => u.code !== code);
          A.touch('codes');
          A.closeSheet();
          A.updateScanCard();
          if (A.updateChrome) A.updateChrome();
          A.toast('已关联到「' + it.name + '」并 +1', 'ok');
        };
      });
    };
    renderList('');
    const si = body.querySelector('#uSearch');
    si.addEventListener('input', A.debounce(function () { renderList(si.value); }, 120));

    body.querySelector('[data-u="new"]').onclick = function () {
      const it = A.addItem({
        name: '新品 ' + code.slice(-6), barcodes: [code], count: 1,
        book: null, isNew: true, unit: '', loc: '',
      });
      it.count = 1;
      it.countedAt = Date.now();
      S.session.unknown = S.session.unknown.filter((u) => u.code !== code);
      S.lastScan = { itemId: it.id, code: code, at: Date.now() };
      A.touch('items');
      A.closeSheet();
      A.updateScanCard();
      if (A.updateChrome) A.updateChrome();
      A.toast('已新建商品，点「详情」改名归类', 'ok');
      if (A.openItem) setTimeout(() => A.openItem(it.id), 220);
    };
  }

  /* ---------- 手动输入 / 搜索 ---------- */
  A.openManual = function () {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="searchwrap"><input class="search" id="mIn" placeholder="条码 / 内部编码 / 名称" autocomplete="off" inputmode="search"></div>' +
      '<div class="hint" style="margin-bottom:10px">输入完整条码回车直接计数；也可以搜商品名，点「+1」。</div>' +
      '<div id="mList"></div>';
    A.sheet({ title: '手动输入 / 搜索', body: body, onMount: function () {
      const inp = body.querySelector('#mIn');
      const list = body.querySelector('#mList');
      const render = function () {
        const q = inp.value.trim();
        if (/^[0-9A-Za-z\-_]{4,}$/.test(q)) {
          const hit = A.findByCode(q);
          if (hit) {
            list.innerHTML = '<div class="rows"><div class="row"><div class="grow"><div class="nm">' + A.esc(hit.name) + '</div>' +
              '<div class="meta">' + (hit.barcodes[0] ? A.esc(hit.barcodes[0]) : '无条码') + ' · 账面 ' + (hit.book == null ? '—' : A.fmt(hit.book)) + '</div></div>' +
              '<div class="badge acc">已匹配</div></div></div>';
            return;
          }
        }
        const items = A.searchItems(q, 40);
        if (!items.length) { list.innerHTML = '<div class="hint" style="padding:16px 2px">没有匹配的商品。' + (q ? '去「清单」页确认一下名称。' : '输入关键字开始搜索。') + '</div>'; return; }
        list.innerHTML = '<div class="rows">' + items.map(function (it) {
          return '<div class="row" data-mid="' + it.id + '">' +
            '<div class="grow"><div class="nm">' + A.esc(it.name) + '</div><div class="meta">' +
            (it.barcodes.length ? A.esc(it.barcodes[0]) : '无条码') + (it.loc ? ' · ' + A.esc(it.loc) : '') +
            ' · 账面 ' + (it.book == null ? '—' : A.fmt(it.book)) + '</div></div>' +
            '<div class="count-box"><div class="cv">' + (it.count == null ? '—' : A.fmt(it.count)) + '</div><div class="cl">实盘</div></div>' +
            '<button class="icon-btn" data-add="' + it.id + '" style="color:var(--acc);border-color:rgba(45,212,191,.35)">' + A.icon('plus') + '</button>' +
            '</div>';
        }).join('') + '</div>';
        A.$$('[data-add]', list).forEach(function (b) {
          b.onclick = function (ev) {
            ev.stopPropagation();
            const it = A.findItem(b.getAttribute('data-add'));
            A.bump(it, 1);
            S.lastScan = { itemId: it.id, code: '', at: Date.now() };
            A.feedback('ok');
            A.updateScanCard();
            if (A.updateChrome) A.updateChrome();
            render();
            A.toast('「' + it.name + '」+1', 'ok');
          };
        });
        A.$$('[data-mid]', list).forEach(function (row) {
          row.onclick = function () {
            const it = A.findItem(row.getAttribute('data-mid'));
            if (it && A.openItem) A.openItem(it.id);
          };
        });
      };
      inp.addEventListener('input', A.debounce(render, 100));
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        const q = inp.value.trim();
        const hit = A.findByCode(q);
        if (hit) {
          A.bump(hit, 1);
          S.lastScan = { itemId: hit.id, code: q, at: Date.now() };
          A.feedback('ok');
          A.closeSheet();
          A.updateScanCard();
          if (A.updateChrome) A.updateChrome();
          A.toast('「' + hit.name + '」+1', 'ok');
        } else {
          A.toast('清单里没有这个码', 'bad');
        }
      });
      render();
      setTimeout(() => inp.focus(), 260);
    } });
  };

  A.handleScannedCode = onCode;



  A.handleScannedCode = onCode;

  /* ---------- 拍照 / 相册识别（相机接口不可用时的兜底） ---------- */
  function rotateCanvas(src, deg) {
    if (!deg) return src;
    const c = document.createElement('canvas');
    const rad = (deg * Math.PI) / 180;
    const swap = deg % 180 !== 0;
    c.width = swap ? src.height : src.width;
    c.height = swap ? src.width : src.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  function zxingFromCanvas(canvas) {
    if (!window.ZXing) return null;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const lum = new ZXing.RGBLuminanceSource(img.data, canvas.width, canvas.height);
      const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.CODABAR,
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.MultiFormatReader();
      reader.setHints(hints);
      const res = reader.decode(bmp);
      return res && res.getText ? res.getText() : null;
    } catch (e) { return null; }
  }
  async function decodeImageFile(file) {
    const url = URL.createObjectURL(file);
    let img;
    try {
      img = await new Promise(function (res, rej) {
        const i = new Image();
        i.onload = function () { res(i); };
        i.onerror = rej;
        i.src = url;
      });
    } finally {
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    const max = 1400;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const base = document.createElement('canvas');
    base.width = Math.round(img.width * scale);
    base.height = Math.round(img.height * scale);
    base.getContext('2d').drawImage(img, 0, 0, base.width, base.height);

    let code = null;
    if ('BarcodeDetector' in window) {
      try {
        const fmts = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : [];
        const det = new BarcodeDetector(fmts.length ? { formats: fmts } : undefined);
        const r = await det.detect(base);
        if (r && r.length) code = r[0].rawValue;
      } catch (e) {}
    }
    if (!code) {
      [0, 90, 270, 180].some(function (deg) {
        code = zxingFromCanvas(rotateCanvas(base, deg));
        return !!code;
      });
    }
    return code;
  }

  A.photoScan = function () {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = async function () {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      try {
        A.toast('正在识别图片里的条码…');
        const code = await decodeImageFile(f);
        if (code) {
          A.handleScannedCode(code);
          A.feedback('ok');
          A.toast('识别成功：' + code, 'ok');
        } else {
          A.feedback('bad');
          A.toast('图片里没找到条码：让条码占满画面、光线足、对焦清楚再拍', 'bad');
        }
      } catch (e) {
        A.toast('识别失败：' + (e.message || e), 'bad');
      }
    };
    inp.click();
  };

  let grabBusy = false;
  async function grabDecode() {
    if (grabBusy) return;
    const v = st.video;
    if (!v || !v.videoWidth) return;
    grabBusy = true;
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.92); });
      if (blob) {
        const code = await decodeImageFile(blob);
        if (code) { st.hits = (st.hits || 0) + 1; onCode(code); }
      }
    } catch (e) {}
    grabBusy = false;
  }

  A.decodeSelfTest = async function () {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, '6901234567892', {
        format: 'EAN13', width: 4, height: 140, displayValue: false,
        margin: 12, background: '#ffffff', lineColor: '#000000',
      });
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      A.toast('正在自检解码器…');
      const code = await decodeImageFile(blob);
      if (code === '6901234567892') A.toast('自检通过：解码器正常', 'ok');
      else if (code) A.toast('自检异常：读到了 ' + code, 'bad');
      else A.toast('自检失败：解码器读不出示例条码', 'bad');
    } catch (e) {
      A.toast('自检异常：' + (e.message || e), 'bad');
    }
  };

  /* ---------- 挂载 / 卸载 ---------- */
  A.mountScan = function (container) {
    container.innerHTML =
      '<div class="scan">' +
      '<div class="cam" id="camBox">' +
      '<video id="cam" playsinline muted autoplay></video>' +
      '<div class="mask"></div>' +
      '<div class="frame"></div>' +
      '<div class="cam-top"><i class="live"></i><span id="camState">正在启动相机…</span></div>' +
      '<div class="cam-tools"><button class="cam-tool" id="photoBtn">拍照</button><button class="cam-tool" id="torchBtn" hidden>手电</button></div>' +
      '<div class="cam-hint">把条码放进框内 · 支持 69 码 / 二维码 / 内部码</div>' +
      '<div class="flash" id="flash"></div>' +
      '<div class="cam-warn" id="camWarn" hidden>' +
      '<span>画面是黑的？可能被其它应用占用</span>' +
      '<button data-cam="retry">重试</button>' +
      '<button data-cam="photo">拍照</button>' +
      '</div>' +
      '<div class="cam-start" id="camStart" hidden>' +
      '<button class="btn primary" id="camStartBtn">点一下开启相机</button>' +
      '<div class="cam-start-hint" id="camStartHint">首次使用需要允许相机权限</div>' +
      '</div>' +
      '<div class="cam-err" id="camErr" hidden></div>' +
      '</div>' +
      '<div class="result" id="scanCard">' + A.scanCardHTML() + '</div>' +
      '<div class="scan-foot">' +
      '<button class="btn" data-act="manual">' + A.icon('keyboard') + ' 手动输入 / 搜索</button>' +
      '<label class="switch"><input type="checkbox" id="dedupeChk"' + (S.settings.dedupe ? ' checked' : '') + '> 防连扫</label>' +
      '</div>' +
      '</div>';
    const chk = container.querySelector('#dedupeChk');
    chk.onchange = function () { S.settings.dedupe = chk.checked; A.saveSettings(); };
    container.querySelector('#photoBtn').onclick = function () { A.photoScan(); };
    container.querySelector('#camStartBtn').onclick = function () { if (!st.pending) start(); };
    A.$$('[data-cam]', container).forEach(function (b) {
      b.onclick = function () {
        if (b.getAttribute('data-cam') === 'photo') A.photoScan();
        else A.restartScan();
      };
    });
    const torch = container.querySelector('#torchBtn');
    torch.onclick = async function () {
      if (!st.track) return;
      try {
        st.torchOn = !st.torchOn;
        await st.track.applyConstraints({ advanced: [{ torch: st.torchOn }] });
        torch.style.color = st.torchOn ? '#fbbf24' : '';
      } catch (e) { A.toast('这个摄像头不支持手电', 'bad'); }
    };
    st.mounted = true;
    start();
  };

  A.unmountScan = function () {
    st.mounted = false;
    stop();
  };

  A.restartScan = function () {
    stop();
    setTimeout(start, 120);
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (st.stream) { try { st.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} st.stream = null; st.running = false; clearTimeout(st.timer); }
    } else if (!document.hidden && st.mounted && !st.running) {
      start();
    }
  });
})();
