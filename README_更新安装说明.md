# 妈妈英语·180天 V4 修复安装版

## 本版修复
1. 所有按钮改为 `getElementById/addEventListener` 显式绑定，不再依赖浏览器自动把HTML元素ID变成JavaScript全局变量。
2. 首页新增“安装到手机桌面”按钮。
3. 安装层与学习业务层分开，即使业务逻辑异常，Service Worker与安装检测仍可独立运行。
4. Service Worker改为网络优先导航，并只清理英语APP自己的缓存。
5. 数据自动尝试从旧键 `momEnglish180_standalone_v3` / `momEnglish180_v1` 迁移到V4。
6. 保留：180天主题、5–10句录入、朗读、录音、默写、每日测/周测/月测、复习、句型库、单词统计、备份导入导出。

## 更新现有GitHub仓库 mom-english-180
不要新建仓库。把以下6个文件上传到现有仓库根目录并覆盖同名文件：
- index.html
- app.js
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png

然后 Commit changes。

## 手机
打开：
https://chunxiawang989-beep.github.io/mom-english-180/

页面顶部会看到“安装到手机桌面”。
- 浏览器支持 `beforeinstallprompt`：点击后直接弹系统安装框。
- 浏览器未开放该能力：会弹出说明，并提供“用 Chrome 打开”和“复制网址”。

注意：网页受浏览器安全机制限制，无法在浏览器完全不支持PWA安装时强制创建系统桌面图标。
