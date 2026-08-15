# V14.1 启动错误修复

## 已定位的V14错误
V14已经切换为“静态高品质MP3”，不再需要 Web Audio / getAudioContext。

但 app.js 中残留了旧版本第二个 `initAudioDiagnostics()`，
它仍然调用：
- getAudioContext()
- loadCourseAudio()

因此手机启动时出现：
`getAudioContext is not defined`

## V14.1修复
- 删除整段旧朗读自检代码
- 保留唯一的V14静态MP3自检
- 确认不再引用 getAudioContext / loadCourseAudio / APP_AUDIO_MAP
- Service Worker缓存版本提升到 v14.1
- index.html强制加载 app.js?v=14.1

## GitHub更新
只需要覆盖3个文件：
- index.html
- app.js
- sw.js

Commit后打开：
https://chunxiawang989-beep.github.io/mom-english-180/?v=14.1

顶部看到：
“独立APP V14.1 · 静态高品质MP3”
即说明新代码已加载。

注意：
修复启动错误 ≠ 已经生成高品质MP3。
如果 hq_audio 里还没有Day 1神经美音MP3，
APP接下来会正常提示“高品质MP3尚未生成”，而不会再报程序异常。
