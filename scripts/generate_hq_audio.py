#!/usr/bin/env python3
import os, re, json, hashlib, time, html, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"daily180.js"
OUT=ROOT/"hq_audio"
MAP=ROOT/"hq-audio-map.js"

KEY=os.environ.get("AZURE_SPEECH_KEY","").strip()
REGION=os.environ.get("AZURE_SPEECH_REGION","").strip()
VOICE=os.environ.get("VOICE","en-US-AvaMultilingualNeural").strip()
SCOPE=os.environ.get("SCOPE","day1").strip()

if not KEY or not REGION:
    raise SystemExit("Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION")

def norm(s):
    s=s.lower().replace("’","'")
    s=re.sub(r'[“”"!?.,;:()\[\]{}]','',s)
    return re.sub(r'\s+',' ',s).strip()

raw=DATA.read_text(encoding="utf-8")
m=re.search(r'window\.APP_DAILY180=(\[.*?\]);\nwindow\.APP_DK_LIBRARY=',raw,re.S)
m2=re.search(r'window\.APP_DK_LIBRARY=(\[.*\]);?\s*$',raw,re.S)
daily=json.loads(m.group(1)); dk=json.loads(m2.group(1))

sentences=[]
if SCOPE=="day1":
    sentences=[p[0] for p in daily[0]["phrases"]]
elif SCOPE=="all":
    for d in daily:
        sentences.extend(p[0] for p in d["phrases"])
    for s in dk:
        sentences.extend(p[0] for p in s["phrases"])
else:
    raise SystemExit("SCOPE must be day1 or all")

unique={}
for s in sentences:
    unique.setdefault(norm(s),s)

OUT.mkdir(exist_ok=True)

def fname(k):
    return hashlib.sha1(k.encode("utf-8")).hexdigest()[:20]+".mp3"

def ssml(text):
    safe=html.escape(text,quote=False)
    return (
      "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
      f"<voice name='{VOICE}'><prosody rate='0%'>{safe}</prosody></voice></speak>"
    ).encode("utf-8")

def synth(item):
    k,text=item
    fn=fname(k); path=OUT/fn
    if path.exists() and path.stat().st_size>1500:
        return k,fn,"cached"

    endpoint=f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    last=None
    for attempt in range(5):
        try:
            req=urllib.request.Request(endpoint,data=ssml(text),method="POST")
            req.add_header("Ocp-Apim-Subscription-Key",KEY)
            req.add_header("Content-Type","application/ssml+xml")
            req.add_header("X-Microsoft-OutputFormat","audio-48khz-192kbitrate-mono-mp3")
            req.add_header("User-Agent","mom-english-180-static-hq")
            with urllib.request.urlopen(req,timeout=45) as r:
                audio=r.read()
            if len(audio)<1500:
                raise RuntimeError("audio too small")
            path.write_bytes(audio)
            return k,fn,"generated"
        except Exception as e:
            last=e
            time.sleep(1.5*(attempt+1))
    raise RuntimeError(f"{text}: {last}")

items=list(unique.items())
print(f"scope={SCOPE}, voice={VOICE}, unique={len(items)}")

results={}; failures=[]
with ThreadPoolExecutor(max_workers=3) as ex:
    jobs={ex.submit(synth,it):it for it in items}
    for i,fut in enumerate(as_completed(jobs),1):
        it=jobs[fut]
        try:
            k,fn,status=fut.result()
            results[k]={"file":"hq_audio/"+fn,"voice":VOICE,"format":"48kHz/192kbps MP3"}
            print(f"[{i}/{len(items)}] {status}: {it[1]}")
        except Exception as e:
            failures.append(str(e))
            print("FAILED:",e)

existing={}
if MAP.exists():
    old=MAP.read_text(encoding="utf-8")
    mm=re.search(r'window\.APP_HQ_AUDIO_MAP=(\{.*\});?\s*$',old,re.S)
    if mm:
        try: existing=json.loads(mm.group(1))
        except Exception: pass

existing.update(results)
MAP.write_text(
    "window.APP_HQ_AUDIO_MAP="+json.dumps(existing,ensure_ascii=False,separators=(",",":"))+";\n",
    encoding="utf-8"
)

if failures:
    (ROOT/"hq_audio_failures.txt").write_text("\n".join(failures),encoding="utf-8")
    raise SystemExit(f"{len(failures)} synthesis failures")

print("Done:",len(results),"MP3 files")
