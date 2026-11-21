# 盘库 · 扫码盘点

纯前端静态应用（无后端）。扫码、导入 Excel、盘点、差异核对、多人结果合并、导出 Excel。
线上地址：https://mr-noc.github.io/PANKU/

## 本地运行（电脑）

```bash
python3 server.py 8765
# 浏览器打开 http://127.0.0.1:8765/
```

> 摄像头扫码要求 HTTPS 或 localhost；http://127.0.0.1 满足条件。
> 电脑没有摄像头也能用：USB 扫码枪（键盘模式）直接扫，App 支持键盘输入条码。

## 部署

仓库 `main` 分支根目录就是站点，推送到 GitHub 后 Pages 自动构建，约 1 分钟生效。
构建相关文件：`index.html`、`app.css`、`js/`、`lib/`、`icons/`、`manifest.webmanifest`、`sw.js`、`.nojekyll`。

## 目录

- `index.html` 入口
- `app.css` 样式
- `js/core.js` 状态、IndexedDB、工具
- `js/import.js` 表格导入（门店、销售仓过滤、短码判定）
- `js/scan.js` 相机扫码、拍照识别、防连扫
- `js/views.js` 界面与页面
- `js/export.js` 导出 Excel/CSV、打印标签、剪贴板中转
- `js/merge.js` 交接文件、多人结果合并、冲突核对
- `js/main.js` 启动与全局事件
- `lib/` 离线依赖：xlsx、zxing、jsbarcode
- `sw.js` 离线缓存
- `server.py` 本地静态服务器

## 数据说明

- 数据存在**当前浏览器**的 IndexedDB 里，按「浏览器 + 域名」隔离；换浏览器、换设备看不到之前的数据。
- 换浏览器：用「复制整份盘点（换浏览器用）」→ 另一个浏览器「从剪贴板接收」。
- 多人盘点：各手机「导出交接文件（.json）」，在电脑上先导入清单，再「合并多台手机的结果」。
- 升级版本后如果界面没变，设置里点「修复加载 / 强制更新」。
