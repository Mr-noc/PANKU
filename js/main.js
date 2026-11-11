/* 盘库 APP — 启动与全局操作 */
(function () {
  const A = window.A;
  const S = A.state;
  const $ = A.$;

  function refreshAfterCount() {
    if (S.tab === 'scan' && A.updateScanCard) A.updateScanCard();
    A.updateChrome();
    if (S.tab !== 'scan' && typeof A.currentRefresh === 'function') A.currentRefresh();
  }

  function lastItem() {
    return S.lastScan ? A.findItem(S.lastScan.itemId) : null;
  }

  document.addEventListener('click', function (e) {
    const lab = e.target.closest('label[for="fileIn"]');
    if (lab && A.resetImportMode) A.resetImportMode();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.getAttribute('data-act');
    switch (act) {
      case 'menu': A.openMenu(); break;
      case 'import': A.openImport(); break;
      case 'export': A.openExport(); break;
      case 'print-labels': A.printLabels(); break;
      case 'manual': A.openManual(); break;
      case 'undo': A.undoLast(); refreshAfterCount(); break;
      case 'scan-plus': {
        const it = lastItem();
        if (it) { A.bump(it, 1); A.feedback('ok'); refreshAfterCount(); }
        break;
      }
      case 'scan-minus': {
        const it = lastItem();
        if (it) { A.bump(it, -1); refreshAfterCount(); }
        break;
      }
      case 'scan-detail': {
        const it = lastItem();
        if (it) A.openItem(it.id);
        break;
      }
    }
  });

  // 首次触摸时解锁音频
  document.addEventListener('pointerdown', function () { A.initAudio && A.initAudio(); }, { passive: true });

  // 蓝牙扫码枪 / 键盘输入：不在输入框时，连续字符 + 回车 = 一个条码
  let kbBuf = '', kbTimer = null;
  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }
  document.addEventListener('keydown', function (e) {
    if (isTyping() || !S.session) return;
    if (e.key === 'Enter') {
      if (kbBuf.length >= 4) {
        e.preventDefault();
        if (A.handleScannedCode) A.handleScannedCode(kbBuf);
        kbBuf = '';
      }
      return;
    }
    if (e.key && e.key.length === 1 && /[0-9A-Za-z\-]/.test(e.key)) {
      kbBuf += e.key;
      clearTimeout(kbTimer);
      kbTimer = setTimeout(function () { kbBuf = ''; }, 700);
    }
  });

  window.addEventListener('pagehide', function () { if (A.flush) A.flush(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && A.flush) A.flush();
  });

  // 离线缓存
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // 启动
  (async function boot() {
    try {
      await A.loadAll();
    } catch (e) {
      console.error('载入失败', e);
    }
    if (A.setupFileInput) A.setupFileInput();
    A.render();
    if (typeof XLSX === 'undefined') {
      A.toast('离线文件不完整：请联网打开一次 App，否则无法导入表格', 'bad');
    }
    if (S.session && !S.session.items.length) {
      A.toast('清单是空的，点右上角导入表格，或直接扫码', null);
    }
  })();
})();
