/* 盘库 APP — 导出 Excel / CSV、打印内部码标签 */
(function () {
  const A = window.A;
  const S = A.state;

  function anchorDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 5000);
  }

  A.deliverFile = function (blob, name, kind) {
    let file = null;
    try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e) {}
    const size = blob.size >= 1048576 ? (blob.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(blob.size / 1024)) + ' KB';
    let canShare = false;
    try { canShare = !!(file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) {}
    const body =
      '<div class="card" style="margin-bottom:12px">' +
      '<div style="font-size:12px;color:var(--tx3)">文件名</div>' +
      '<div style="font-size:14px;font-weight:700;word-break:break-all;margin:2px 0 8px">' + A.esc(name) + '</div>' +
      '<div style="font-size:12px;color:var(--tx3)">大小</div><div style="font-size:13px;margin-bottom:8px">' + size + '</div>' +
      '<div style="font-size:12px;color:var(--tx3)">保存位置</div>' +
      '<div style="font-size:13px">手机「下载 / Download」目录<br><span style="color:var(--tx3);font-size:11.5px">浏览器默认下载位置，用文件管理器按文件名搜最快</span></div>' +
      '</div>' +
      (canShare ? '<button class="btn primary block lg" id="dlShare">分享 / 保存到手机</button>' : '') +
      '<button class="btn block' + (canShare ? '' : ' primary lg') + '" id="dlAgain" style="margin-top:8px">直接下载</button>' +
      '<div class="hint" style="margin-top:10px">找不到文件？点「' + (canShare ? '分享 / 保存到手机' : '直接下载') + '」。在微信里打开的话，建议先点右上角「在浏览器打开」再导出。</div>';

    A.sheet({ title: '导出完成', body: body, onMount: function (b) {
      const dl = b.querySelector('#dlAgain');
      if (dl) dl.onclick = function () {
        anchorDownload(blob, name);
        A.toast('已下载：' + name, 'ok');
      };
      const sh = b.querySelector('#dlShare');
      if (sh) sh.onclick = async function () {
        try {
          await navigator.share({ files: [file], title: name });
          A.toast('已发送', 'ok');
        } catch (e) {
          if (e && e.name !== 'AbortError') A.toast('分享失败：' + (e.message || e), 'bad');
        }
      };
    } });
    if (kind === 'xlsx') anchorDownload(blob, name); // 同时先自动下一次
  };

  function safeName(s) {
    return String(s || '盘点').replace(/[\\/:*?"<>|\n\r\t]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 40) || '盘点';
  }
  function stamp() {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  function statusOf(it) {
    if (it.count == null) return '未盘';
    if (it.book == null) return '新品';
    const d = Number(it.count) - Number(it.book);
    if (Math.abs(d) < 1e-9) return '相符';
    return d > 0 ? '盘盈' : '盘亏';
  }

  function detailRows() {
    const hasStore = S.session.items.some((it) => it.store);
    const rows = [['序号', '门店', '商品名称', '规格', '单位', '内部编码', '69码/条码', '69码状态', '货位', '账面数量', '实盘数量', '差异', '状态', '备注']];
    S.session.items.forEach(function (it, i) {
      const diff = it.count == null ? '' : (it.book == null ? Number(it.count) : Number(it.count) - Number(it.book));
      rows.push([
        i + 1,
        it.store || '',
        it.name || '',
        it.spec || '',
        it.unit || '',
        it.code || '',
        (it.barcodes || []).join(' / '),
        (it.barcodes || []).length ? '有' : '无',
        it.loc || '',
        it.book == null ? '' : Number(it.book),
        it.count == null ? '' : Number(it.count),
        diff,
        statusOf(it),
        it.note || '',
      ]);
    });
    return rows;
  }

  function diffRows() {
    const rows = [['商品名称', '规格', '货位', '账面数量', '实盘数量', '差异', '状态']];
    S.session.items.filter(A.isDiff).forEach(function (it) {
      const d = it.book == null ? Number(it.count) : Number(it.count) - Number(it.book);
      rows.push([it.name || '', it.spec || '', it.loc || '', it.book == null ? '' : Number(it.book), Number(it.count), d, statusOf(it)]);
    });
    return rows;
  }

  function unknownRows() {
    const rows = [['清单外条码', '扫到时间', '处理建议']];
    S.session.unknown.forEach(function (u) {
      rows.push([u.code, new Date(u.at).toLocaleString('zh-CN'), '未关联，可关联到已有商品或新建']);
    });
    return rows;
  }

  function summaryRows() {
    const st = A.stats();
    return [
      ['盘点名称', S.session.name],
      ['清单文件', S.session.source || '—'],
      ['导出时间', new Date().toLocaleString('zh-CN')],
      ['总品项', st.total],
      ['已盘品项', st.counted],
      ['未盘品项', st.total - st.counted],
      ['差异品项', st.diff],
      ['盘盈品项', st.up],
      ['盘亏品项', st.down],
      ['新品（无账面）', st.newItem],
      ['账面合计', st.book],
      ['实盘合计', st.real],
      ['无码商品', st.noCode],
      ['清单外条码', st.unknown],
    ];
  }

  A.exportXLSX = function () {
    if (!S.session || !S.session.items.length) { A.toast('清单是空的，先导入表格', 'bad'); return; }
    try {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(detailRows());
      ws1['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 7 }, { wch: 13 }, { wch: 22 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 20 }];
      ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, ws1, '盘点明细');

      const ws2 = XLSX.utils.aoa_to_sheet(diffRows());
      ws2['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws2, '差异');

      const ws3 = XLSX.utils.aoa_to_sheet(unknownRows());
      ws3['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, ws3, '清单外条码');

      const ws4 = XLSX.utils.aoa_to_sheet(summaryRows());
      ws4['!cols'] = [{ wch: 16 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws4, '汇总');

      const name = '盘点_' + safeName(S.session.name) + '_' + stamp() + '.xlsx';
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      A.deliverFile(blob, name, 'xlsx');
    } catch (e) {
      console.error(e);
      A.toast('导出失败：' + e.message, 'bad');
    }
  };

  /* ---------- 微信 → 其他浏览器：剪贴板中转 ---------- */
  A.buildTransferText = function () {
    const sess = S.session;
    if (!sess) return '';
    const payload = {
      app: 'panku-transfer', version: 1,
      store: sess.name || '', savedAt: Date.now(),
      items: sess.items.map(function (it) {
        return {
          n: it.name || '', s: it.spec || '', u: it.unit || '',
          c: it.code || '', b: it.barcodes || [], a: it.altCodes || [],
          l: it.loc || '', k: it.book == null ? null : it.book,
          q: it.count == null ? null : it.count, t: it.store || '',
        };
      }),
    };
    return JSON.stringify(payload);
  };

  A.copyTransfer = async function () {
    const text = A.buildTransferText();
    if (!text) { A.toast('没有可复制的盘点', 'bad'); return; }
    const size = (text.length / 1024).toFixed(0);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        A.toast('已复制整份盘点（' + size + 'KB）。切到 Chrome 打开同一个 App，点「从剪贴板接收」', 'ok');
        return;
      }
    } catch (e) {}
    A.sheet({
      title: '复制盘点数据',
      body: '<div class="hint" style="margin-bottom:8px">长按全选 → 复制，然后切到 Chrome 粘贴接收。</div>' +
        '<textarea id="trArea" readonly style="width:100%;height:46vh;background:#0e1520;color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:10px;font-size:11px">' + A.esc(text) + '</textarea>',
      onMount: function (b) {
        const a = b.querySelector('#trArea');
        setTimeout(function () { a.focus(); a.select(); }, 200);
        a.onclick = function () { a.select(); };
      },
    });
  };

  A.importTransferText = function (text) {
    let d = null;
    try { d = JSON.parse(String(text || '').trim()); } catch (e) {
      A.toast('内容不是有效的盘点数据', 'bad');
      return false;
    }
    if (!d || d.app !== 'panku-transfer' || !Array.isArray(d.items)) {
      A.toast('内容不是盘库的交接数据', 'bad');
      return false;
    }
    const sess = A.newSession((d.store || '盘点') + ' · 转入');
    sess.source = '剪贴板转入';
    sess.items = d.items.map(function (x) {
      return {
        id: A.uid('it'), name: x.n || '未命名商品', spec: x.s || '', unit: x.u || '',
        code: x.c || '', barcodes: (x.b || []).map(A.normCode).filter(Boolean),
        altCodes: x.a || [], loc: x.l || '', book: x.k == null ? null : x.k,
        count: x.q == null ? null : x.q, note: '', photo: null,
        manual: false, isNew: false, store: x.t || '',
      };
    });
    A.openSession(sess);
    A.flush();
    A.closeSheet();
    A.render();
    A.toast('已接收 ' + sess.items.length + ' 个商品，可以在 Chrome 里导出了', 'ok');
    return true;
  };

  A.receiveTransfer = async function () {
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText();
    } catch (e) {}
    if (text && text.indexOf('panku-transfer') >= 0) {
      A.importTransferText(text);
      return;
    }
    A.sheet({
      title: '从剪贴板接收盘点',
      body: '<div class="hint" style="margin-bottom:8px">先复制微信浏览器里的盘点数据，然后长按下面的框粘贴，再点「导入」。</div>' +
        '<textarea id="rcvArea" placeholder="在这里长按粘贴" style="width:100%;height:40vh;background:#0e1520;color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:10px;font-size:11px"></textarea>' +
        '<button class="btn primary block" id="rcvGo" style="margin-top:10px">导入</button>',
      onMount: function (b) {
        const a = b.querySelector('#rcvArea');
        const go = b.querySelector('#rcvGo');
        go.onclick = function () { A.importTransferText(a.value); };
        setTimeout(function () { a.focus(); }, 250);
      },
    });
  };

  function cell(v) {
    return String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ').trim();
  }

  A.resultText = function (onlyDiff) {
    if (!S.session) return '';
    const rows = [['门店', '商品名称', '编码', '货位', '账面', '实盘', '差异', '状态']];
    S.session.items.forEach(function (it) {
      if (onlyDiff && !A.isDiff(it)) return;
      const diff = it.count == null ? '' : (it.book == null ? Number(it.count) : Number(it.count) - Number(it.book));
      rows.push([it.store || '', it.name || '', (it.barcodes || [])[0] || it.code || '', it.loc || '',
        it.book == null ? '' : it.book, it.count == null ? '' : it.count, diff, statusOf(it)]);
    });
    return rows.map(function (r) { return r.map(cell).join('\t'); }).join('\n');
  };

  A.copyResult = async function (onlyDiff) {
    const text = A.resultText(onlyDiff);
    if (!text) { A.toast('没有可复制的内容', 'bad'); return; }
    const tip = onlyDiff ? '差异商品' : '全部结果';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        A.toast('已复制' + tip + '（' + (text.length / 1024).toFixed(0) + 'KB），去微信粘贴即可', 'ok');
        return;
      }
    } catch (e) {}
    A.sheet({
      title: '复制' + tip,
      body: '<div class="hint" style="margin-bottom:8px">长按下面的文字 → 全选 → 复制，然后粘贴到微信。</div>' +
        '<textarea id="copyArea" readonly style="width:100%;height:46vh;background:#0e1520;color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:10px;font-size:12px;font-family:ui-monospace,monospace">' + A.esc(text) + '</textarea>',
      onMount: function (b) {
        const a = b.querySelector('#copyArea');
        setTimeout(function () { a.focus(); a.select(); }, 200);
        a.onclick = function () { a.select(); };
      },
    });
  };

  A.exportCSV = function () {
    if (!S.session || !S.session.items.length) { A.toast('清单是空的，先导入表格', 'bad'); return; }
    try {
      const rows = detailRows();
      const csv = rows.map(function (r) {
        return r.map(function (v) {
          const s = v == null ? '' : String(v);
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      }).join('\r\n');
      const name = '盘点_' + safeName(S.session.name) + '_' + stamp() + '.csv';
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      A.deliverFile(blob, name, 'csv');
    } catch (e) {
      A.toast('导出失败：' + e.message, 'bad');
    }
  };

  /* ---------------- 内部码标签打印 ---------------- */
  A.printLabels = function (items) {
    const sess = S.session;
    if (!sess) return;
    let list = items;
    if (!list) list = sess.items.filter(A.needManual);
    if (!list.length) {
      A.toast('没有需要打印标签的商品（无码页为空）', 'bad');
      return;
    }
    if (list.length > 120) {
      A.toast('标签太多（' + list.length + ' 张），先只打印前 120 张', 'bad');
      list = list.slice(0, 120);
    }
    let assigned = 0;
    list.forEach(function (it) {
      if (!it.code) {
        it.code = A.genInternalCode();
        assigned++;
      }
    });
    if (assigned) { A.rebuild(); A.save(); }

    const area = document.getElementById('printArea');
    area.innerHTML = '<div class="label-grid">' + list.map(function (it) {
      const ascii = /^[\x20-\x7E]+$/.test(it.code || '');
      return '<div class="label">' +
        '<div class="l-nm">' + A.esc(it.name || '未命名') + '</div>' +
        '<div class="l-meta">' + (function(){ const m = [it.spec, it.loc ? '位 ' + it.loc : ''].filter(Boolean).join(' · '); return m ? A.esc(m) : '&nbsp;'; })() + '</div>' +
        (ascii ? '<svg class="bc" data-code="' + A.esc(it.code) + '"></svg>' : '') +
        '<div class="l-code">' + A.esc(it.code || '') + '</div>' +
        '</div>';
    }).join('') + '</div>';

    const svgs = area.querySelectorAll('svg[data-code]');
    svgs.forEach(function (svg) {
      try {
        JsBarcode(svg, svg.getAttribute('data-code'), {
          format: 'CODE128', width: 1.45, height: 34, displayValue: false, margin: 0, background: '#ffffff', lineColor: '#000000',
        });
      } catch (e) {
        console.warn('barcode', e);
      }
    });

    A.toast('已生成 ' + list.length + ' 张标签，在打印预览里选「打印」或「另存为 PDF」', 'ok');
    setTimeout(function () { window.print(); }, 450);
  };

  window.addEventListener('afterprint', function () {
    const area = document.getElementById('printArea');
    if (area) area.innerHTML = '';
    if (S.tab === 'list' || S.tab === 'nocode') A.renderTab();
  });
})();
