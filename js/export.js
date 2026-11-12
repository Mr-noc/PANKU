/* 盘库 APP — 导出 Excel / CSV、打印内部码标签 */
(function () {
  const A = window.A;
  const S = A.state;

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
      XLSX.writeFile(wb, name, { compression: true });
      A.toast('已导出 ' + name, 'ok');
    } catch (e) {
      console.error(e);
      A.toast('导出失败：' + e.message, 'bad');
    }
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
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '盘点_' + safeName(S.session.name) + '_' + stamp() + '.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
      A.toast('已导出 CSV', 'ok');
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
