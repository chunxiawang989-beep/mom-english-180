(function(){
"use strict";

var COURSE = window.APP_COURSE || [];
var SAMPLES = window.APP_SAMPLES || {};
var KEY = "momEnglish180_standalone_v4";
var BASE = window.APP_BASE_PHRASES || {};
var GENERIC = window.APP_GENERIC_PHRASES || {};
var HQ_AUDIO_MAP = window.APP_HQ_AUDIO_MAP || {};
var DAILY180 = window.APP_DAILY180 || [];
var DK_LIBRARY = window.APP_DK_LIBRARY || [];
var OLD_KEYS = ["momEnglish180_standalone_v3","momEnglish180_v1"];

function $(id){ return document.getElementById(id); }
function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function iso(d){
  d=d||new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function esc(s){
  return String(s||"").replace(/[&<>"']/g,function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}
function normalize(s){
  return String(s||"").toLowerCase().replace(/[’']/g,"'").replace(/[“”"!?.,;:()[\]{}]/g,"").replace(/\s+/g," ").trim();
}
function tokens(s){
  var m=String(s||"").toLowerCase().replace(/’/g,"'").match(/[a-z]+(?:'[a-z]+)?/g);
  return m||[];
}
function similarity(a,b){
  var A=normalize(a).split(" ").filter(Boolean), B=normalize(b).split(" ").filter(Boolean);
  if(normalize(a)===normalize(b)) return 100;
  var same=0, used={};
  A.forEach(function(w){
    for(var i=0;i<B.length;i++){
      if(!used[i] && B[i]===w){ used[i]=true; same++; break; }
    }
  });
  return Math.round(100*(2*same)/Math.max(1,A.length+B.length));
}
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

function defaultState(){
  return {startDate:iso(),dailyTarget:18,days:{},selectedDay:null,exams:[]};
}
function loadState(){
  var raw=localStorage.getItem(KEY);
  if(raw){ try{return Object.assign(defaultState(),JSON.parse(raw));}catch(e){} }
  for(var i=0;i<OLD_KEYS.length;i++){
    raw=localStorage.getItem(OLD_KEYS[i]);
    if(raw){
      try{
        var migrated=Object.assign(defaultState(),JSON.parse(raw));
        localStorage.setItem(KEY,JSON.stringify(migrated));
        return migrated;
      }catch(e2){}
    }
  }
  return defaultState();
}
var state=loadState();
if(!Array.isArray(state.exams)) state.exams=[];

function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
function dayKey(n){return "d"+n;}
function currentCalendarDay(){
  var a=new Date(state.startDate+"T00:00:00"), b=new Date(iso()+"T00:00:00");
  return Math.max(1,Math.min(180,Math.floor((b-a)/86400000)+1));
}
function activeDay(){ return state.selectedDay || currentCalendarDay(); }
function courseItem(n){ var d=DAILY180[Math.max(0,Math.min(DAILY180.length-1,n-1))]; return d||{day:n,topicEn:"",topicZh:"",categoryZh:"",categoryEn:"",phrases:[]}; }
function dayData(n){
  n=n||activeDay();
  var d=state.days[dayKey(n)];
  if(!d) d={sentences:[],bookPage:"",started:false};
  if(!Array.isArray(d.sentences)) d.sentences=[];
  return d;
}
function setDayData(n,d){ state.days[dayKey(n)]=d; save(); }
function dateForDay(n){
  var d=new Date(state.startDate+"T00:00:00"); d.setDate(d.getDate()+n-1);
  return d.toLocaleDateString("zh-CN",{month:"numeric",day:"numeric",weekday:"short"});
}
function allSentences(){
  var arr=[];
  Object.keys(state.days).forEach(function(k){
    var n=parseInt(k.slice(1),10), d=state.days[k];
    (d.sentences||[]).forEach(function(s,i){
      arr.push(Object.assign({},s,{day:n,index:i}));
    });
  });
  return arr;
}
function statBox(value,label){ return '<div class="stat"><b>'+value+'</b><span>'+label+'</span></div>'; }

window.showToast=function(msg){
  var t=$("toast"); if(!t)return;
  t.textContent=msg; t.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(function(){t.classList.add("hidden");},2200);
};

function switchView(name){
  qsa('section[id^="view-"]').forEach(function(s){s.classList.add("hidden");});
  var v=$("view-"+name); if(v)v.classList.remove("hidden");
  qsa(".tab").forEach(function(t){t.classList.toggle("active",t.getAttribute("data-view")===name);});
  if(name==="review") renderReview();
  if(name==="library"){ renderLibrary(); renderPatternMap(); }
  if(name==="vocab") renderVocab();
  if(name==="stats") renderStats();
  if(name==="calendar") renderCalendar();
  if(name==="exam") renderExamHistory();
  if(name==="dk") renderDK();
  window.scrollTo(0,0);
}



function audioKey(text){ return normalize(text); }
var hqCurrentAudio=null;

function getRate(){
  var el=$("speechRate");
  return el ? parseFloat(el.value||"1") : 1;
}
function getEngine(){ return "hq"; }

function setStatus(id,text,good){
  var el=$(id); if(!el)return;
  el.textContent=text;
  el.style.color=good===true?"#16845b":good===false?"#b42318":"#667085";
}
function diagnostic(msg){
  var el=$("audioDiagnosticText");
  if(el)el.textContent=msg;
}

function playStaticHQ(text){
  var map=(typeof HQ_AUDIO_MAP!=="undefined" && HQ_AUDIO_MAP)
    ? HQ_AUDIO_MAP : (window.APP_HQ_AUDIO_MAP||{});
  var item=map[audioKey(text)];
  if(!item || !item.file){
    return Promise.reject(new Error("hq-mp3-missing"));
  }
  return new Promise(function(resolve,reject){
    try{
      if(hqCurrentAudio){
        try{hqCurrentAudio.pause();}catch(e){}
        hqCurrentAudio=null;
      }
      var a=new Audio("./"+item.file+"?v=14");
      hqCurrentAudio=a;
      a.preload="auto";
      a.playbackRate=getRate();
      a.onended=function(){hqCurrentAudio=null;resolve();};
      a.onerror=function(){hqCurrentAudio=null;reject(new Error("hq-mp3-load-failed"));};
      var p=a.play();
      if(p&&p.catch)p.catch(reject);
    }catch(e){reject(e);}
  });
}

function speakAsync(text){
  return playStaticHQ(text).catch(function(err){
    if(err && err.message==="hq-mp3-missing"){
      diagnostic("这句话的高品质MP3尚未生成。请先运行GitHub Actions中的“生成高品质MP3”。");
      showToast("这句话还没有高品质MP3。");
    }else{
      diagnostic("高品质MP3文件加载失败。请检查 hq_audio 文件夹。");
      showToast("高品质MP3加载失败。");
    }
    throw err;
  });
}

function initAudioDiagnostics(){
  var map=(typeof HQ_AUDIO_MAP!=="undefined" && HQ_AUDIO_MAP)
    ? HQ_AUDIO_MAP : (window.APP_HQ_AUDIO_MAP||{});
  var count=Object.keys(map).length;
  setStatus("audioMapStatus",count?(count+"句"):"未生成",!!count);
  setStatus("webAudioStatus","无需",true);
  setStatus("ttsStatus","无需",true);
  setStatus("audioContextStatus","无需",true);

  var first=(DAILY180[0]&&DAILY180[0].phrases&&DAILY180[0].phrases[0])
    ? DAILY180[0].phrases[0][0] : "";
  var item=first?map[audioKey(first)]:null;
  if(!item){
    setStatus("audioFileStatus","未生成",false);
    diagnostic("V14代码已就绪。下一步先生成Day 1的真实高品质MP3进行试听。");
    return;
  }
  fetch("./"+item.file+"?v=14",{method:"HEAD",cache:"no-store"})
    .then(function(resp){
      if(!resp.ok)throw new Error("http-"+resp.status);
      setStatus("audioFileStatus","已就绪",true);
      diagnostic("高品质静态MP3已就绪。APP只播放文件，不进行任何现场TTS合成。");
    })
    .catch(function(){
      setStatus("audioFileStatus","文件缺失",false);
      diagnostic("映射表存在，但实际MP3文件没有找到。请检查 hq_audio 文件夹。");
    });
}

function speak(text){ return speakAsync(text); }
window.speakPhrase=speak;

function initAudioDiagnostics(){
  var map=(typeof AUDIO_MAP!=="undefined" && AUDIO_MAP) ? AUDIO_MAP : (window.APP_AUDIO_MAP||{});
  var mapCount=Object.keys(map).length;
  var testText=(DAILY180[0]&&DAILY180[0].phrases&&DAILY180[0].phrases[0])?DAILY180[0].phrases[0][0]:"Good morning, sleepyhead.";
  var testKey=audioKey(testText);
  var mapOK=mapCount>0 && !!map[testKey];
  setStatus("audioMapStatus",mapOK?(mapCount+"句"):"缺失",mapOK);
  if(!mapOK){
    diagnostic("音频映射表未正确加载。请确认 audio-map.js 已上传并刷新页面。");
  }
  var supportsTTS=("speechSynthesis" in window)&&!!window.SpeechSynthesisUtterance;
  setStatus("ttsStatus",supportsTTS?"可用":"不支持",supportsTTS);
  var ctx=getAudioContext();
  if(ctx){
    setStatus("webAudioStatus","可用",true);
    setStatus("audioContextStatus",ctx.state||"已创建",ctx.state==="running");
    loadCourseAudio(false).catch(function(){});
  }else{
    setStatus("webAudioStatus","不支持",false);
    setStatus("audioContextStatus","不可用",false);
    diagnostic("当前浏览器连 Web Audio API 都不支持。请把这个页面截图给我。");
  }
}


var recorder=null, chunks=[];
function recordSentence(index,button){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){
    showToast("当前浏览器不支持网页录音，可使用系统录音机辅助。");return;
  }
  if(recorder && recorder.state==="recording"){
    recorder.stop(); return;
  }
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    chunks=[];
    recorder=new MediaRecorder(stream);
    recorder.ondataavailable=function(e){ if(e.data && e.data.size)chunks.push(e.data); };
    recorder.onstop=function(){
      var blob=new Blob(chunks,{type:"audio/webm"}), url=URL.createObjectURL(blob);
      stream.getTracks().forEach(function(t){t.stop();});
      var audio=new Audio(url); audio.play();
      button.textContent="● 重录";
      setTimeout(function(){URL.revokeObjectURL(url);},60000);
    };
    recorder.start(); button.textContent="■ 停止并回听";
  }).catch(function(){showToast("麦克风权限未开启。");});
}

function renderToday(){
  var n=activeDay(), c=courseItem(n), d=ensureDayDefaults(n), target=state.dailyTarget||18;
  var mastered=d.sentences.filter(function(s){return !!s.read;}).length;
  $("dayPill").textContent="Day "+n+" / 180";
  $("stageBadge").textContent=c.categoryZh;
  $("sourceBadge").textContent=c.categoryEn||"180天口语";
  $("topicZh").textContent=c.topicZh;
  $("topicEn").textContent=c.topicEn;
  $("topicGoal").textContent="同一主题集中学习18句：场景口语 + 多样父母表达 + 孩子可说";
  $("topicReference").textContent=c.reference||"";
  renderPatternSummary(c);
  $("dayDate").textContent=dateForDay(n);
  $("dayProgressText").textContent=mastered+"/"+target+" 句熟练朗读";
  $("dayProgressBar").style.width=Math.min(100,mastered/target*100)+"%";
  var uniqueToday=new Set();
  d.sentences.forEach(function(s){tokens(s.en).forEach(function(w){uniqueToday.add(w);});});
  $("todayStats").innerHTML=
    statBox(d.sentences.length,"今日句子")+
    statBox(mastered,"熟练朗读")+
    statBox(uniqueToday.size,"今日去重词")+
    statBox(d.sentences.filter(function(s){return (s.best||0)>=100;}).length,"默写全对");
  renderSentenceList();
  renderDictation();
}

function renderPatternSummary(c){
  var box=$("patternSummary");if(!box)return;
  var ps=(c&&c.patterns)||[];
  box.innerHTML=ps.length?ps.map(function(p){
    return '<div style="padding:9px 0;border-bottom:1px solid #eef0f3">'+
      '<div class="row space"><b>'+esc(p.formula)+'</b><span class="badge">'+esc(p.tag||p.meaning)+'</span></div>'+
      '<div class="small" style="margin-top:4px">'+esc(p.example)+'</div>'+
      '<div class="tiny muted">'+esc(p.meaning)+'</div></div>';
  }).join(""):'<div class="hint">今天暂无句型总结。</div>';
}

function renderSentenceList(){
  var d=dayData(), box=$("sentenceList");
  if(!d.sentences.length){box.innerHTML='<div class="hint">今日还没有句子。点“批量录入”最方便。</div>';return;}
  box.innerHTML=d.sentences.map(function(s,i){
    return '<div class="sentence">'+
      '<div class="row space"><div style="flex:1"><div class="en">'+esc(s.en)+'</div><div class="zh">'+esc(s.zh||"")+'</div><div class="tiny muted">'+(s.tag?("【"+esc(s.tag)+"】 "+esc(s.pattern||"")):"")+'</div></div><span class="badge">'+(s.best||0)+'%</span></div>'+
      '<div class="row">'+
      '<button class="btn sm js-play" data-i="'+i+'">🔊 标准音</button>'+
      '<button class="btn sm js-record" data-i="'+i+'">● 录音</button>'+
      '<button class="btn sm js-edit" data-i="'+i+'">编辑</button>'+
      '<label class="check"><input type="checkbox" class="js-master" data-i="'+i+'" '+(s.read?"checked":"")+'>不看文字能熟练说</label>'+
      '<button class="btn sm danger js-delete" data-i="'+i+'">删除</button>'+
      '</div></div>';
  }).join("");
  qsa(".js-play").forEach(function(b){b.addEventListener("click",function(){var s=dayData().sentences[+b.dataset.i];if(s)speak(s.en);});});
  qsa(".js-record").forEach(function(b){b.addEventListener("click",function(){recordSentence(+b.dataset.i,b);});});
  qsa(".js-edit").forEach(function(b){b.addEventListener("click",function(){
    var n=activeDay(),d=dayData(n),i=+b.dataset.i,s=d.sentences[i];if(!s)return;
    var en=prompt("修改英文句子：",s.en);if(en===null)return;en=en.trim();if(!en){showToast("英文句子不能为空。");return;}
    var zh=prompt("修改中文提示：",s.zh||"");if(zh===null)zh=s.zh||"";
    s.en=en;s.zh=zh.trim();s.preset=false;s.read=false;s.best=0;s.stage=0;s.next=null;d.started=true;setDayData(n,d);renderAll();showToast("句子已修改。");
  });});
  qsa(".js-master").forEach(function(ch){ch.addEventListener("change",function(){
    var n=activeDay(),d=dayData(n),i=+ch.dataset.i;if(d.sentences[i])d.sentences[i].read=ch.checked;d.started=true;setDayData(n,d);renderAll();
  });});
  qsa(".js-delete").forEach(function(b){b.addEventListener("click",function(){
    if(!confirm("删除这句话？"))return;
    var n=activeDay(),d=dayData(n);d.sentences.splice(+b.dataset.i,1);setDayData(n,d);renderAll();
  });});
}

function makeSentence(en,zh,tag,pattern){return {en:en,zh:zh||"",tag:tag||"",pattern:pattern||"",read:false,best:0,wrong:0,stage:0,next:null,lastTest:null};}

function defaultSentencesForDay(n){
  var c=courseItem(n);
  return (c.phrases||[]).slice(0,18).map(function(x){
    var s=makeSentence(x[0],x[1],x[2],x[3]);s.preset=true;return s;
  });
}
function ensureDayDefaults(n){
  var d=dayData(n);
  if(!d.seeded && d.sentences.length===0){d.sentences=defaultSentencesForDay(n);d.seeded=true;d.started=false;state.days[dayKey(n)]=d;save();}
  return d;
}
function restoreDayDefaults(){
  var n=activeDay(),d=dayData(n);
  if(d.sentences.length && !confirm("恢复默认18句会替换今天现有的句子。确定继续吗？"))return;
  d.sentences=defaultSentencesForDay(n);d.seeded=true;d.started=false;setDayData(n,d);renderAll();showToast("已恢复今日默认18句。");
}

function migrateCurriculumV10(){
  if(state.curriculumVersion===10)return;
  Object.keys(state.days||{}).forEach(function(k){
    var n=parseInt(k.slice(1),10);if(!n||n<1||n>180)return;
    var d=state.days[k]||{sentences:[]};
    var custom=(d.sentences||[]).filter(function(s){return !s.preset;});
    d.sentences=defaultSentencesForDay(n).concat(custom).slice(0,20);
    d.seeded=true;
    state.days[k]=d;
  });
  state.curriculumVersion=10;
  save();
}


var dictPos=0,dictOrder=[];
function renderDictation(){
  ensureDayDefaults(activeDay());
  var ss=dayData().sentences, empty=!ss.length;
  $("dictEmpty").classList.toggle("hidden",!empty);
  $("dictPanel").classList.toggle("hidden",empty);
  if(empty)return;
  if(dictOrder.length!==ss.length){dictOrder=ss.map(function(_,i){return i;});dictOrder.sort(function(){return Math.random()-.5;});dictPos=0;}
  dictPos=Math.min(dictPos,ss.length-1);
  showDictItem();
}
function showDictItem(){
  var ss=dayData().sentences;if(!ss.length)return;
  var idx=dictOrder[dictPos]===undefined?dictPos:dictOrder[dictPos], s=ss[idx];
  $("dictCounter").textContent=(dictPos+1)+" / "+ss.length;
  $("dictPrompt").textContent=s.zh||"听标准音后默写";
  $("dictInput").value=""; $("dictResult").innerHTML="";
}
function scheduleReview(s,correct){
  var dt=new Date();
  if(correct){
    s.stage=Math.min(3,(s.stage||0)+1);
    var gaps=[1,3,7,14], gap=gaps[Math.min(s.stage,gaps.length-1)];
    dt.setDate(dt.getDate()+gap);
  }else{
    s.wrong=(s.wrong||0)+1;s.stage=0;dt.setDate(dt.getDate()+1);
  }
  s.next=iso(dt);s.lastTest=iso();
}
function checkDictation(){
  var n=activeDay(),d=dayData(n),idx=dictOrder[dictPos]===undefined?dictPos:dictOrder[dictPos],s=d.sentences[idx];
  if(!s)return;
  var ans=$("dictInput").value.trim();if(!ans){showToast("请先完成默写。");return;}
  var ok=normalize(ans)===normalize(s.en),score=ok?100:similarity(ans,s.en);
  s.best=Math.max(s.best||0,score);scheduleReview(s,ok);d.started=true;setDayData(n,d);
  $("dictResult").innerHTML=ok?'<div class="result ok">✓ 完全正确</div>':'<div class="result bad">匹配约 '+score+'%<br>正确句子：<b>'+esc(s.en)+'</b></div>';
  renderStats();
}

function renderReview(){
  var due=allSentences().filter(function(s){return s.next && s.next<=iso();}).sort(function(a,b){return String(a.next).localeCompare(String(b.next));});
  var box=$("reviewList");
  if(!due.length){box.innerHTML='<div class="hint">目前没有到期复习句。</div>';return;}
  box.innerHTML=due.map(function(s){
    return '<div class="sentence"><div class="en">'+esc(s.en)+'</div><div class="zh">'+esc(s.zh||"")+'</div><div class="row space"><span class="small muted">Day '+s.day+' · 错 '+(s.wrong||0)+' 次</span><button class="btn sm js-go-review" data-day="'+s.day+'">去复习</button></div></div>';
  }).join("");
  qsa(".js-go-review").forEach(function(b){b.addEventListener("click",function(){goDay(+b.dataset.day);});});
}

function vocabMap(){
  var map={};
  allSentences().forEach(function(s){
    var unique={};
    tokens(s.en).forEach(function(w){
      if(!map[w])map[w]={word:w,freq:0,sents:0,first:s.day,master:0};
      map[w].freq++; map[w].first=Math.min(map[w].first,s.day); unique[w]=1;
    });
    Object.keys(unique).forEach(function(w){
      map[w].sents++;
      if(s.read && (s.best||0)>=100)map[w].master++;
    });
  });
  return map;
}
function renderVocab(){
  var map=vocabMap(), arr=Object.values(map), q=$("vocabSearch").value.toLowerCase().trim(), sort=$("vocabSort").value;
  if(q)arr=arr.filter(function(x){return x.word.indexOf(q)>=0;});
  if(sort==="alpha")arr.sort(function(a,b){return a.word.localeCompare(b.word);});
  else if(sort==="first")arr.sort(function(a,b){return a.first-b.first;});
  else arr.sort(function(a,b){return b.freq-a.freq || a.word.localeCompare(b.word);});
  var total=Object.values(map).reduce(function(n,x){return n+x.freq;},0);
  var fully=Object.values(map).filter(function(x){return x.sents && x.master===x.sents;}).length;
  $("vocabStats").innerHTML=statBox(Object.keys(map).length,"去重词形")+statBox(total,"累计词次")+statBox(fully,"完全掌握词")+statBox(allSentences().length,"来源句子");
  $("vocabList").innerHTML=arr.length?arr.map(function(x){
    return '<div class="word-row"><div><b>'+esc(x.word)+'</b><div class="tiny muted">首次 Day '+x.first+'</div></div><span>'+x.freq+'次</span><span>'+(x.sents&&x.master===x.sents?"已掌握":"学习中")+'</span></div>';
  }).join(""):'<div class="hint">录入英文句子后自动生成。</div>';
}

function isMastered(s){return !!s.read && (s.best||0)>=100;}
function isCore(s){return isMastered(s) && (s.stage||0)>=2;}
function renderLibrary(){
  var all=allSentences(),mastered=all.filter(isMastered),core=all.filter(isCore),filter=$("libraryFilter").value,q=$("librarySearch").value.toLowerCase().trim();
  var arr=filter==="all"?all:(filter==="core"?core:mastered);
  if(q)arr=arr.filter(function(s){return String(s.en||"").toLowerCase().indexOf(q)>=0||String(s.zh||"").toLowerCase().indexOf(q)>=0;});
  arr.sort(function(a,b){return a.day-b.day||a.index-b.index;});
  $("libraryStats").innerHTML=statBox(all.length,"全部句子")+statBox(mastered.length,"已掌握")+statBox(core.length,"核心句型")+statBox(core.reduce(function(n,s){return n+tokens(s.en).length;},0),"核心词次");
  $("libraryList").innerHTML=arr.length?arr.map(function(s){
    return '<div class="master-row '+(isCore(s)?"core":"")+'"><div class="row space"><div style="flex:1"><div class="en">'+esc(s.en)+'</div><div class="zh">'+esc(s.zh||"")+'</div></div><span class="badge">'+(isCore(s)?"核心":(isMastered(s)?"已掌握":"学习中"))+'</span></div><div class="tiny muted">Day '+s.day+' · 默写最高 '+(s.best||0)+'% · 错 '+(s.wrong||0)+' 次</div></div>';
  }).join(""):'<div class="hint">当前筛选下还没有句子。</div>';
}

var examSession=null;
function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function modeName(m){return m==="daily"?"每日测":m==="weekly"?"周测":"月测";}
function examPool(mode){
  var n=activeDay(),start=mode==="daily"?n:(mode==="weekly"?Math.max(1,n-6):Math.max(1,n-29));
  var p=allSentences().filter(function(s){return s.day>=start&&s.day<=n&&s.en;});
  p=shuffle(p); if(mode==="weekly")p=p.slice(0,20);if(mode==="monthly")p=p.slice(0,20);return p;
}
function startExam(mode){
  var pool=examPool(mode);if(!pool.length){showToast("这个范围内还没有可考试的句子。");return;}
  examSession={mode:mode,items:pool,pos:0,results:[],submitted:false};
  $("examRunPanel").classList.remove("hidden");$("examSummary").classList.add("hidden");
  $("examModeLabel").textContent=modeName(mode);showExamItem();
}
function showExamItem(){
  var x=examSession.items[examSession.pos];
  $("examCounter").textContent=(examSession.pos+1)+" / "+examSession.items.length;
  $("examPrompt").textContent=x.zh||("Day "+x.day+"：先口述，再默写");
  $("examOralCheck").checked=false;$("examInput").value="";$("examFeedback").innerHTML="";$("examNextBtn").classList.add("hidden");examSession.submitted=false;
}
function updateOriginalSentence(item,ok,score){
  var d=dayData(item.day),s=d.sentences[item.index];if(!s)return;
  s.best=Math.max(s.best||0,score);scheduleReview(s,ok);d.started=true;state.days[dayKey(item.day)]=d;
}
function submitExam(){
  if(!examSession||examSession.submitted)return;
  if(!$("examOralCheck").checked){showToast("请先完成不看英文的口述。");return;}
  var ans=$("examInput").value.trim();if(!ans){showToast("请完成默写。");return;}
  var x=examSession.items[examSession.pos],ok=normalize(ans)===normalize(x.en),score=ok?100:similarity(ans,x.en);
  examSession.results.push({exact:ok,score:score});updateOriginalSentence(x,ok,score);save();examSession.submitted=true;
  $("examFeedback").innerHTML=ok?'<div class="result ok">✓ 口述完成，默写完全正确</div>':'<div class="result bad">匹配约 '+score+'%<br>正确句子：<b>'+esc(x.en)+'</b></div>';
  $("examNextBtn").classList.remove("hidden");$("examNextBtn").textContent=examSession.pos===examSession.items.length-1?"完成考试":"下一题";
}
function nextExam(){
  if(!examSession||!examSession.submitted)return;
  if(examSession.pos>=examSession.items.length-1){finishExam();return;}
  examSession.pos++;showExamItem();
}
function finishExam(){
  var total=examSession.items.length,exact=examSession.results.filter(function(r){return r.exact;}).length,score=Math.round(exact/total*100),pass=score>=90;
  state.exams.push({date:iso(),timestamp:Date.now(),mode:examSession.mode,total:total,exact:exact,score:score,pass:pass,day:activeDay()});save();
  $("examRunPanel").classList.add("hidden");$("examSummary").classList.remove("hidden");
  $("examSummary").innerHTML='<div style="text-align:center"><div class="small muted">'+modeName(examSession.mode)+'完成</div><div style="font-size:42px;font-weight:900;color:'+(pass?"#16845b":"#b42318")+'">'+score+'%</div><h3>'+(pass?"通过":"继续复习")+'</h3><p>默写全对 '+exact+'/'+total+'</p></div>';
  examSession=null;renderExamHistory();renderAll();
}
function renderExamHistory(){
  var hist=state.exams.slice().reverse().slice(0,15);
  $("examHistory").innerHTML=hist.length?hist.map(function(e){
    return '<div class="history-row"><b>'+esc(e.date.slice(5))+'</b><span>'+modeName(e.mode)+' · '+e.exact+'/'+e.total+'句</span><b style="color:'+(e.pass?"#16845b":"#b42318")+'">'+e.score+'%</b></div>';
  }).join(""):'<div class="hint">完成考试后成绩会保存在这里。</div>';
}


function addPhraseToToday(en,zh){
  var n=activeDay(),d=ensureDayDefaults(n);
  if(d.sentences.length>=20){showToast("今天已经有20句，请先删除一句再添加。");return;}
  if(d.sentences.some(function(s){return normalize(s.en)===normalize(en);})){showToast("今天已经有这句话。");return;}
  d.sentences.push(makeSentence(en,zh));d.started=true;setDayData(n,d);renderAll();showToast("已加入今天。");
}
function renderDK(){
  var q=($("dkSearch").value||"").toLowerCase().trim(),cat=$("dkCategory").value;
  var arr=DK_LIBRARY.filter(function(s){
    if(cat&&s.category!==cat)return false;
    if(!q)return true;
    return (s.topicEn+" "+s.topicZh+" "+s.phrases.map(function(p){return p.join(" ");}).join(" ")).toLowerCase().indexOf(q)>=0;
  });
  $("dkCount").textContent=arr.length+" 个场景";
  $("dkList").innerHTML=arr.map(function(s,si){
    return '<details class="sentence"><summary style="cursor:pointer;font-weight:800">'+esc(s.topicZh)+' · '+esc(s.topicEn)+(s.officialExample?' <span class="badge">DK公开示例</span>':'')+'</summary>'+
      '<div style="margin-top:10px">'+s.phrases.map(function(p,pi){return '<div style="padding:8px 0;border-bottom:1px solid #eef0f3"><div class="en">'+esc(p[0])+'</div><div class="zh">'+esc(p[1])+'</div><div class="tiny muted">'+(p[2]?("【"+esc(p[2])+"】 "+esc(p[3]||"")):"")+'</div><div class="row"><button class="btn sm js-dk-play" data-s="'+si+'" data-p="'+pi+'">🔊</button><button class="btn sm js-dk-add" data-s="'+si+'" data-p="'+pi+'">+ 加入今天</button></div></div>';}).join("")+'</div></details>';
  }).join("");
  qsa(".js-dk-play").forEach(function(b){b.addEventListener("click",function(){var s=arr[+b.dataset.s],p=s.phrases[+b.dataset.p];speak(p[0]);});});
  qsa(".js-dk-add").forEach(function(b){b.addEventListener("click",function(){var s=arr[+b.dataset.s],p=s.phrases[+b.dataset.p];addPhraseToToday(p[0],p[1]);});});
}
function initDKFilter(){
  var cats=Array.from(new Set(DK_LIBRARY.map(function(s){return s.category;})));
  $("dkCategory").innerHTML='<option value="">全部分类</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join("");
}

function buildPatternMap(){
  var map={};
  DAILY180.forEach(function(d){
    (d.patterns||[]).forEach(function(p){
      var key=p.formula+"|"+p.meaning;
      if(!map[key])map[key]={formula:p.formula,meaning:p.meaning,tag:p.tag||"",categories:{},examples:[]};
      map[key].categories[d.categoryZh]=true;
      if(map[key].examples.length<4 && !map[key].examples.some(function(x){return x.text===p.example;})){
        map[key].examples.push({day:d.day,topic:d.topicZh,text:p.example});
      }
    });
  });
  return Object.values(map).sort(function(a,b){
    return Object.keys(b.categories).length-Object.keys(a.categories).length || a.formula.localeCompare(b.formula);
  });
}
function initPatternMapFilter(){
  var el=$("patternMapCategory");if(!el)return;
  var cats=Array.from(new Set(DAILY180.map(function(d){return d.categoryZh;})));
  el.innerHTML='<option value="">全部主题类别</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join("");
}
function renderPatternMap(){
  var list=$("patternMapList");if(!list)return;
  var q=($("patternMapSearch").value||"").toLowerCase().trim(),cat=$("patternMapCategory").value;
  var arr=buildPatternMap().filter(function(p){
    if(cat&&!p.categories[cat])return false;
    if(!q)return true;
    return (p.formula+" "+p.meaning+" "+p.tag+" "+p.examples.map(function(x){return x.text+" "+x.topic;}).join(" ")).toLowerCase().indexOf(q)>=0;
  });
  $("patternMapCount").textContent=arr.length+" 个结构";
  list.innerHTML=arr.slice(0,120).map(function(p){
    return '<details class="sentence"><summary style="cursor:pointer"><b>'+esc(p.formula)+'</b> <span class="badge">'+esc(p.tag||p.meaning)+'</span></summary>'+
      '<div class="small muted" style="margin:7px 0">'+esc(p.meaning)+' · '+esc(Object.keys(p.categories).join(" / "))+'</div>'+
      p.examples.map(function(x){return '<div style="padding:6px 0;border-top:1px solid #eef0f3"><span class="tiny muted">Day '+x.day+' · '+esc(x.topic)+'</span><div>'+esc(x.text)+'</div></div>';}).join("")+
      '</details>';
  }).join("")||'<div class="hint">没有匹配的句型。</div>';
}

function renderStats(){
  var a=allSentences(),started=Object.values(state.days).filter(function(d){return d.started;}).length,mastered=a.filter(isMastered).length,core=a.filter(isCore).length,passed=state.exams.filter(function(e){return e.pass;}).length;
  $("allStats").innerHTML=
    statBox(started,"学习天数")+statBox(a.length,"累计句子")+statBox(a.filter(function(s){return s.read;}).length,"熟练朗读")+statBox(mastered,"已掌握")+
    statBox(core,"核心句型")+statBox(Object.keys(vocabMap()).length,"去重词形")+statBox(state.exams.length,"考试次数")+statBox(passed,"考试通过");
  var pct=Math.min(100,started/180*100);$("courseProgressBar").style.width=pct+"%";$("courseProgressText").textContent="已启动 "+started+"/180 天 · 完成计划 "+pct.toFixed(1)+"%";
}

function renderCalendar(){
  var today=currentCalendarDay(),html="",lastCat="";
  DAILY180.forEach(function(c){
    if(c.categoryZh!==lastCat){
      html+='<div style="margin:16px 0 6px;font-weight:850;color:#344054">'+esc(c.categoryZh)+' <span class="tiny muted">'+esc(c.categoryEn)+'</span></div>';
      lastCat=c.categoryZh;
    }
    var d=state.days[dayKey(c.day)],done=d&&d.sentences&&d.sentences.length>=16&&d.sentences.filter(function(s){return s.read;}).length>=16;
    html+='<div class="cal-row '+(c.day===today?"today ":"")+(done?"done":"")+'" data-day="'+c.day+'"><div class="daynum">'+c.day+'</div><div><b>'+esc(c.topicZh)+'</b><div class="tiny muted">'+esc(c.topicEn)+' · 默认18句</div></div><span class="badge">'+(done?"完成":esc(c.categoryZh))+'</span></div>';
  });
  $("calendarList").innerHTML=html;
  qsa(".cal-row").forEach(function(r){r.addEventListener("click",function(){goDay(+r.dataset.day);});});
}
function goDay(n){state.selectedDay=n;save();switchView("today");renderAll();}

function download(content,name,type){
  var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function exportVocab(){
  var arr=Object.values(vocabMap()).sort(function(a,b){return a.word.localeCompare(b.word);});
  var csv="\ufeffword,frequency,sentence_count,first_day,status\n"+arr.map(function(x){return [x.word,x.freq,x.sents,x.first,(x.sents&&x.master===x.sents?"mastered":"learning")].join(",");}).join("\n");
  download(csv,"我的英语单词库.csv","text/csv;charset=utf-8");
}
function exportLibrary(){
  var arr=allSentences().filter(isMastered).sort(function(a,b){return a.day-b.day;});
  var csv="\ufeffday,status,english,chinese,best_score,wrong_count\n"+arr.map(function(s){
    function q(x){return '"'+String(x||"").replace(/"/g,'""')+'"';}
    return [s.day,isCore(s)?"core":"mastered",q(s.en),q(s.zh),s.best||0,s.wrong||0].join(",");
  }).join("\n");
  download(csv,"已掌握核心句型库.csv","text/csv;charset=utf-8");
}

function renderSettings(){
  $("startDateInput").value=state.startDate;
  $("dailyTargetInput").value=state.dailyTarget;
}

function renderAll(){
  renderToday();renderReview();renderLibrary();renderVocab();renderStats();renderCalendar();renderExamHistory();renderSettings();
}

function bind(){
  qsa(".tab").forEach(function(t){t.addEventListener("click",function(){switchView(t.dataset.view);});});
  $("calendarBtn").addEventListener("click",function(){switchView("calendar");});
  $("settingsBtn").addEventListener("click",function(){switchView("settings");});
  $("backTodayBtn").addEventListener("click",function(){state.selectedDay=null;save();switchView("today");renderAll();});

  $("restoreDefaultBtn").addEventListener("click",restoreDayDefaults);
  $("bulkToggleBtn").addEventListener("click",function(){$("bulkPanel").classList.toggle("hidden");});
  $("saveBulkBtn").addEventListener("click",function(){
    var lines=$("bulkInput").value.split(/\n+/).map(function(x){return x.trim();}).filter(Boolean);
    if(!lines.length){showToast("请先粘贴句子。");return;}
    var n=activeDay(),d=dayData(n),items=lines.slice(0,20).map(function(line){
      var p=line.split(/\s*[|｜]\s*/);return makeSentence((p[0]||"").trim(),p.slice(1).join(" | ").trim());
    }).filter(function(s){return s.en;});
    d.sentences=(d.sentences||[]).concat(items).slice(0,20);d.seeded=true;d.bookPage=$("bookPageInput").value.trim();d.started=true;setDayData(n,d);
    $("bulkInput").value="";$("bulkPanel").classList.add("hidden");renderAll();showToast("今日句子已保存。");
  });
  $("addSentenceBtn").addEventListener("click",function(){
    var en=prompt("请输入英文句子");if(!en)return;var zh=prompt("中文提示（可留空）")||"";
    var n=activeDay(),d=dayData(n);if(d.sentences.length>=20){showToast("每天最多20句。");return;}
    d.sentences.push(makeSentence(en.trim(),zh.trim()));d.seeded=true;d.started=true;setDayData(n,d);renderAll();
  });
  $("playAllBtn").addEventListener("click",function(){
    var ss=dayData().sentences;
    if(!ss.length){showToast("请先录入今日句子。");return;}
    var i=0;
    function next(){
      if(i>=ss.length)return;
      speakAsync(ss[i++].en).then(function(){setTimeout(next,260);});
    }
    next();
  });

  $("dictListenBtn").addEventListener("click",function(){var ss=dayData().sentences,idx=dictOrder[dictPos]===undefined?dictPos:dictOrder[dictPos];if(ss[idx])speak(ss[idx].en);});
  $("dictRevealBtn").addEventListener("click",function(){
    var ss=dayData().sentences,idx=dictOrder[dictPos]===undefined?dictPos:dictOrder[dictPos];if(ss[idx])$("dictResult").innerHTML='<div class="result">'+esc(ss[idx].en)+'</div>';
  });
  $("dictCheckBtn").addEventListener("click",checkDictation);
  $("dictNextBtn").addEventListener("click",function(){if(!dayData().sentences.length)return;dictPos=(dictPos+1)%dayData().sentences.length;showDictItem();});

  qsa("[data-exam]").forEach(function(b){b.addEventListener("click",function(){startExam(b.dataset.exam);});});
  $("examSubmitBtn").addEventListener("click",submitExam);$("examNextBtn").addEventListener("click",nextExam);

  $("vocabSearch").addEventListener("input",renderVocab);$("vocabSort").addEventListener("change",renderVocab);$("exportVocabBtn").addEventListener("click",exportVocab);
  $("patternMapSearch").addEventListener("input",renderPatternMap);$("patternMapCategory").addEventListener("change",renderPatternMap);
  $("dkSearch").addEventListener("input",renderDK);$("dkCategory").addEventListener("change",renderDK);
  $("librarySearch").addEventListener("input",renderLibrary);$("libraryFilter").addEventListener("change",renderLibrary);$("exportLibraryBtn").addEventListener("click",exportLibrary);

  $("startDateInput").addEventListener("change",function(){state.startDate=this.value||iso();state.selectedDay=null;save();renderAll();});
  $("dailyTargetInput").addEventListener("change",function(){state.dailyTarget=Math.max(16,Math.min(20,parseInt(this.value,10)||18));save();renderAll();});
  $("exportBackupBtn").addEventListener("click",function(){download(JSON.stringify(state,null,2),"妈妈英语180天_备份.json","application/json");});
  $("importBackupInput").addEventListener("change",function(){
    var f=this.files&&this.files[0];if(!f)return;var reader=new FileReader();
    reader.onload=function(){try{state=Object.assign(defaultState(),JSON.parse(reader.result));if(!Array.isArray(state.exams))state.exams=[];save();renderAll();showToast("备份已恢复。");}catch(e){alert("备份文件无法读取。");}};
    reader.readAsText(f);
  });
  $("resetBtn").addEventListener("click",function(){if(confirm("确定清空全部英语学习记录？")){localStorage.removeItem(KEY);state=defaultState();save();renderAll();}});

  $("audioRetryBtn").addEventListener("click",function(){
    initAudioDiagnostics();
  });
  $("audioTestBtn").addEventListener("click",function(){
    var t=(DAILY180[0]&&DAILY180[0].phrases&&DAILY180[0].phrases[0])?DAILY180[0].phrases[0][0]:"Open your eyes.";
    speakAsync(t).then(function(){
      diagnostic("测试成功：刚才播放的是GitHub仓库中的真实高品质MP3文件。");
    }).catch(function(err){
      diagnostic("测试失败："+(err&&err.message?err.message:"未知错误"));
    });
  });
  $("installBtn2").addEventListener("click",function(){window.installEnglishApp();});
  $("closeInstallModalBtn").addEventListener("click",function(){$("installModal").classList.add("hidden");});
  $("copyUrlBtn").addEventListener("click",function(){
    var url=location.href.split("#")[0];
    if(navigator.clipboard && navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){showToast("网址已复制。");});}
    else{prompt("复制这个网址：",url);}
  });
  $("openChromeBtn").addEventListener("click",function(){
    var path=location.host+location.pathname;
    location.href="intent://"+path+"#Intent;scheme=https;package=com.android.chrome;end";
  });
}

document.addEventListener("DOMContentLoaded",function(){
  try{
    bind();initDKFilter();initPatternMapFilter();migrateCurriculumV10();initAudioDiagnostics();renderAll();switchView("today");
    var status=$("installStatus");
    if(status && !window.__englishPwaPrompt && !(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)){
      status.textContent="页面功能已就绪；点“安装到手机桌面”检查安装能力。";
    }
  }catch(err){
    console.error(err);
    alert("APP启动异常："+err.message+"。请把这条提示截图发给我。");
  }
});

})();