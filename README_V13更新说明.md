# 妈妈英语·180天 V13｜神经美音MP3版

## 核心变化
彻底停止把eSpeak机械音当作标准音。

默认使用：
- Microsoft Azure Speech
- en-US-JennyNeural
- 48 kHz
- 192 kbps mono MP3

第一次播放某句话时：
1. Azure生成高品质神经语音MP3
2. APP把MP3缓存在手机IndexedDB
3. 以后直接播放本地缓存，不重复生成

自己新增的句子也同样适用。

## 安全
Azure Speech Key：
- 只保存在当前浏览器 localStorage
- 不会写入GitHub代码
- 不要把Key发到ChatGPT聊天
- 不要把Key提交到GitHub仓库

## 首次设置
在APP：
设置 → 高品质神经美音设置

填写：
- Azure Speech Key
- Region，例如 eastus
- Voice建议：en-US-JennyNeural

保存后点：
“测试 Jenny：Open your eyes.”

## 更新GitHub
本版只需覆盖：
- index.html
- app.js
- sw.js

不需要重新上传旧audio文件夹。

网址：
https://chunxiawang989-beep.github.io/mom-english-180/?v=13
