#!/usr/bin/env python3
import asyncio
import hashlib
import json
import os
import random
import re
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "daily180.js"
OUT = ROOT / "hq_audio"
MAP = ROOT / "hq-audio-map.js"

SCOPE = os.environ.get("SCOPE", "day1").strip()
VOICE_REQ = os.environ.get("VOICE", "auto").strip()

PREFERRED = [
    "en-US-AvaNeural",
    "en-US-JennyNeural",
    "en-US-AriaNeural",
]

def norm(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r'[“”"!?.,;:()\[\]{}]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def parse_data():
    raw = DATA.read_text(encoding="utf-8")
    m1 = re.search(r'window\.APP_DAILY180=(\[.*?\]);\nwindow\.APP_DK_LIBRARY=', raw, re.S)
    m2 = re.search(r'window\.APP_DK_LIBRARY=(\[.*\]);?\s*$', raw, re.S)
    if not m1 or not m2:
        raise RuntimeError("Cannot parse daily180.js")
    return json.loads(m1.group(1)), json.loads(m2.group(1))

async def choose_voice():
    voices = await edge_tts.list_voices()
    names = {v["ShortName"] for v in voices}
    if VOICE_REQ != "auto":
        if VOICE_REQ not in names:
            raise RuntimeError(f"Requested voice not available: {VOICE_REQ}")
        return VOICE_REQ
    for v in PREFERRED:
        if v in names:
            return v
    for v in voices:
        if v.get("Locale") == "en-US" and v.get("Gender") == "Female":
            return v["ShortName"]
    raise RuntimeError("No suitable en-US female voice found")

def filename_for(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:20] + ".mp3"

async def synth_one(text: str, voice: str, sem: asyncio.Semaphore):
    k = norm(text)
    fn = filename_for(k)
    path = OUT / fn

    if path.exists() and path.stat().st_size > 1500:
        return k, fn, "cached"

    async with sem:
        last = None
        for attempt in range(5):
            try:
                communicate = edge_tts.Communicate(
                    text=text,
                    voice=voice,
                    rate="+0%",
                    volume="+0%",
                    pitch="+0Hz",
                )
                await communicate.save(str(path))
                if not path.exists() or path.stat().st_size < 1500:
                    raise RuntimeError("Generated MP3 is empty or too small")
                await asyncio.sleep(0.25 + random.random() * 0.25)
                return k, fn, "generated"
            except Exception as e:
                last = e
                try:
                    if path.exists():
                        path.unlink()
                except Exception:
                    pass
                await asyncio.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"{text}: {last}")

async def main():
    daily, dk = parse_data()

    sentences = []
    if SCOPE == "day1":
        sentences = [p[0] for p in daily[0]["phrases"]]
    elif SCOPE == "all":
        for d in daily:
            sentences.extend(p[0] for p in d["phrases"])
        for scene in dk:
            sentences.extend(p[0] for p in scene["phrases"])
    else:
        raise RuntimeError("SCOPE must be day1 or all")

    unique = {}
    for s in sentences:
        unique.setdefault(norm(s), s)

    voice = await choose_voice()
    print(f"scope={SCOPE}, selected_voice={voice}, unique={len(unique)}")

    OUT.mkdir(exist_ok=True)
    sem = asyncio.Semaphore(2 if SCOPE == "day1" else 1)

    tasks = [synth_one(text, voice, sem) for text in unique.values()]
    results = {}
    failures = []

    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        try:
            k, fn, status = await coro
            results[k] = {
                "file": "hq_audio/" + fn,
                "voice": voice,
                "source": "Microsoft Edge online TTS via edge-tts",
                "static": True
            }
            print(f"[{i}/{len(tasks)}] {status}: {fn}")
        except Exception as e:
            failures.append(str(e))
            print("FAILED:", e)

    existing = {}
    if MAP.exists():
        old = MAP.read_text(encoding="utf-8")
        mm = re.search(r'window\.APP_HQ_AUDIO_MAP=(\{.*\});?\s*$', old, re.S)
        if mm:
            try:
                existing = json.loads(mm.group(1))
            except Exception:
                pass

    existing.update(results)
    MAP.write_text(
        "window.APP_HQ_AUDIO_MAP=" +
        json.dumps(existing, ensure_ascii=False, separators=(",", ":")) +
        ";\n",
        encoding="utf-8"
    )

    if failures:
        (ROOT/"hq_audio_failures.txt").write_text(
            "\n".join(failures), encoding="utf-8"
        )
        raise SystemExit(f"{len(failures)} synthesis failures")

    print("Done. Generated/confirmed MP3:", len(results))
    print("Voice:", voice)

if __name__ == "__main__":
    asyncio.run(main())
