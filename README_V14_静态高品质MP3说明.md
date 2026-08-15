# V14 静态高品质MP3版

这次不再从程序上“改善声音”。
最终播放的就是GitHub仓库里的真实MP3文件。

## 音频规格
- 神经语音：Microsoft Azure Speech
- 默认：en-US-AvaMultilingualNeural
- 输出：audio-48khz-192kbitrate-mono-mp3
- 即原生48 kHz / 192 kbps MP3

## 为什么先生成Day 1
先只生成Day 1的18句，实际试听。
确认声音满意，再生成全部180天+DK。
避免音色没确认就批量生成全部文件。

## GitHub Secret
仓库：
Settings → Secrets and variables → Actions → New repository secret

创建：
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION

Key不能发到聊天，也不能写入公开代码。

## 生成Day 1
Actions → 生成高品质MP3 → Run workflow
scope = day1
voice = en-US-AvaMultilingualNeural

任务完成后，仓库会真实新增：
hq_audio/*.mp3
hq-audio-map.js

这时直接点仓库里的MP3文件，听到的就应该与APP播放完全一致。

## 满意后生成全部
再次运行workflow：
scope = all

当前课程+DK共有约1469条唯一英文表达。
重复句不会重复生成文件。

## APP
生成完成后：
https://chunxiawang989-beep.github.io/mom-english-180/?v=14

APP只播放静态MP3，不再使用eSpeak、系统TTS或在线临时朗读。
