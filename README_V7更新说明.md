# 妈妈英语·180天 V7｜华为兼容朗读版

## 已定位V6失败原因
V6离线朗读使用一个4.51MB MP3音频精灵，再由 HTMLAudioElement 通过 currentTime 精确跳转。
在部分Android/Huawei浏览器中，这会同时受到：
- 音频 Range/seek 实现；
- Service Worker 返回缓存响应；
- 异步媒体播放授权；
的影响。

在线朗读依赖第三方发音地址；系统朗读则依赖浏览器 SpeechSynthesis，因此也可能同时失败。

## V7核心修改
- 默认课程句不再使用 HTMLAudioElement seek。
- 整个内置音频一次性 fetch + decodeAudioData 成 Web Audio AudioBuffer。
- 每个句子直接从 AudioBuffer 播放指定片段。
- Service Worker 明确不拦截 speech_us.mp3。
- 新增“朗读自检”：
  - 课程音频文件
  - Web Audio
  - 系统TTS
  - 音频上下文
- 新增“测试一句：Open your eyes.”
- 自检失败会显示具体错误信息。

## 更新GitHub
继续使用 mom-english-180 仓库。
把以下文件上传并覆盖：
- index.html
- app.js
- content.js
- audio-map.js
- speech_us.mp3
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png

Commit 后打开：
https://chunxiawang989-beep.github.io/mom-english-180/?v=7

看到“独立APP V7 · 华为兼容朗读”即成功。

## 第一次测试
1. 打开页面后等“朗读自检”中的“课程音频文件”显示“已就绪”。
2. 点“测试一句：Open your eyes.”
3. 如果听到声音，默认课程朗读已修复。
4. 如果失败，页面会直接显示错误原因，把那一行截图发给我即可。
