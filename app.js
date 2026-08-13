(function(){
"use strict";

var COURSE = window.APP_COURSE || [];
var SAMPLES = window.APP_SAMPLES || {};
var KEY = "momEnglish180_standalone_v4";
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
  return {startDate:iso(),dailyTarget:8,days:{},selectedDay:null,exams:[]};
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
function courseItem(n){ return COURSE[Math.max(0,Math.min(COURSE.length-1,n-1))] || {day:n,en:"",zh:"",source:"",stage:"",goal:""}; }
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
  if(name==="library") renderLibrary();
  if(name==="vocab") renderVocab();
  if(name==="stats") renderStats();
  if(name==="calendar") renderCalendar();
  if(name==="exam") renderExamHistory();
  window.scrollTo(0,0);
}

function speak(text){
  if(!("speechSynthesis" in window)){showToast("当前浏览器不支持系统朗读。");return;}
  window.speechSynthesis.cancel();
  var u=new SpeechSynthesisUtterance(text);
  u.lang="en-US"; u.rate=parseFloat($("speechRate").value||"1");
  var voices=window.speechSynthesis.getVoices();
  var v=voices.find(function(x){return x.lang==="en-US";}) || voices.find(function(x){return String(x.lang||"").indexOf("en")===0;});
  if(v)u.voice=v;
  window.speechSynthesis.speak(u);
}
window.speakPhrase=speak;

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
  var n=activeDay(), c=courseItem(n), d=dayData(n), target=state.dailyTarget||8;
  var mastered=d.sentences.filter(function(s){return !!s.read;}).length;
  $("dayPill").textContent="Day "+n+" / 180";
  $("stageBadge").textContent=c.stage;
  $("sourceBadge").textContent=c.source==="DK"?"DK · 独立生活":"家庭亲子英文";
  $("topicZh").textContent=c.zh;
  $("topicEn").textContent=c.en;
  $("topicGoal").textContent=c.goal;
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
  $("loadSampleBtn").classList.toggle("hidden",!SAMPLES[c.en]);
  renderSentenceList();
  renderDictation();
}

function renderSentenceList(){
  var d=dayData(), box=$("sentenceList");
  if(!d.sentences.length){box.innerHTML='<div class="hint">今日还没有句子。点“批量录入”最方便。</div>';return;}
  box.innerHTML=d.sentences.map(function(s,i){
    return '<div class="sentence">'+
      '<div class="row space"><div style="flex:1"><div class="en">'+esc(s.en)+'</div><div class="zh">'+esc(s.zh||"")+'</div></div><span class="badge">'+(s.best||0)+'%</span></div>'+
      '<div class="row">'+
      '<button class="btn sm js-play" data-i="'+i+'">🔊 标准音</button>'+
      '<button class="btn sm js-record" data-i="'+i+'">● 录音</button>'+
      '<label class="check"><input type="checkbox" class="js-master" data-i="'+i+'" '+(s.read?"checked":"")+'>不看文字能熟练说</label>'+
      '<button class="btn sm danger js-delete" data-i="'+i+'">删除</button>'+
      '</div></div>';
  }).join("");
  qsa(".js-play").forEach(function(b){b.addEventListener("click",function(){var s=dayData().sentences[+b.dataset.i];if(s)speak(s.en);});});
  qsa(".js-record").forEach(function(b){b.addEventListener("click",function(){recordSentence(+b.dataset.i,b);});});
  qsa(".js-master").forEach(function(ch){ch.addEventListener("change",function(){
    var n=activeDay(),d=dayData(n),i=+ch.dataset.i;if(d.sentences[i])d.sentences[i].read=ch.checked;d.started=true;setDayData(n,d);renderAll();
  });});
  qsa(".js-delete").forEach(function(b){b.addEventListener("click",function(){
    if(!confirm("删除这句话？"))return;
    var n=activeDay(),d=dayData(n);d.sentences.splice(+b.dataset.i,1);setDayData(n,d);renderAll();
  });});
}

function makeSentence(en,zh){return {en:en,zh:zh||"",read:false,best:0,wrong:0,stage:0,next:null,lastTest:null};}

var dictPos=0,dictOrder=[];
function renderDictation(){
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
  p=shuffle(p); if(mode==="weekly")p=p.slice(0,10);if(mode==="monthly")p=p.slice(0,20);return p;
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

function renderStats(){
  var a=allSentences(),started=Object.values(state.days).filter(function(d){return d.started;}).length,mastered=a.filter(isMastered).length,core=a.filter(isCore).length,passed=state.exams.filter(function(e){return e.pass;}).length;
  $("allStats").innerHTML=
    statBox(started,"学习天数")+statBox(a.length,"累计句子")+statBox(a.filter(function(s){return s.read;}).length,"熟练朗读")+statBox(mastered,"已掌握")+
    statBox(core,"核心句型")+statBox(Object.keys(vocabMap()).length,"去重词形")+statBox(state.exams.length,"考试次数")+statBox(passed,"考试通过");
  var pct=Math.min(100,started/180*100);$("courseProgressBar").style.width=pct+"%";$("courseProgressText").textContent="已启动 "+started+"/180 天 · 完成计划 "+pct.toFixed(1)+"%";
}

function renderCalendar(){
  var today=currentCalendarDay();
  $("calendarList").innerHTML=COURSE.map(function(c){
    var d=state.days[dayKey(c.day)],done=d&&d.sentences&&d.sentences.length>=5&&d.sentences.filter(function(s){return s.read;}).length>=5;
    return '<div class="cal-row '+(c.day===today?"today ":"")+(done?"done":"")+'" data-day="'+c.day+'"><div class="daynum">'+c.day+'</div><div><b>'+esc(c.zh)+'</b><div class="tiny muted">'+esc(c.en)+' · '+esc(c.stage)+'</div></div><span class="badge">'+(done?"完成":esc(c.source))+'</span></div>';
  }).join("");
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

  $("bulkToggleBtn").addEventListener("click",function(){$("bulkPanel").classList.toggle("hidden");});
  $("saveBulkBtn").addEventListener("click",function(){
    var lines=$("bulkInput").value.split(/\n+/).map(function(x){return x.trim();}).filter(Boolean);
    if(!lines.length){showToast("请先粘贴句子。");return;}
    var n=activeDay(),d=dayData(n),items=lines.slice(0,10).map(function(line){
      var p=line.split(/\s*[|｜]\s*/);return makeSentence((p[0]||"").trim(),p.slice(1).join(" | ").trim());
    }).filter(function(s){return s.en;});
    d.sentences=(d.sentences||[]).concat(items).slice(0,10);d.bookPage=$("bookPageInput").value.trim();d.started=true;setDayData(n,d);
    $("bulkInput").value="";$("bulkPanel").classList.add("hidden");renderAll();showToast("今日句子已保存。");
  });
  $("addSentenceBtn").addEventListener("click",function(){
    var en=prompt("请输入英文句子");if(!en)return;var zh=prompt("中文提示（可留空）")||"";
    var n=activeDay(),d=dayData(n);if(d.sentences.length>=10){showToast("每天最多10句。");return;}
    d.sentences.push(makeSentence(en.trim(),zh.trim()));d.started=true;setDayData(n,d);renderAll();
  });
  $("loadSampleBtn").addEventListener("click",function(){
    var arr=SAMPLES[courseItem(activeDay()).en];if(!arr){showToast("这个主题暂无内置示例，请从教材录入。");return;}
    var n=activeDay(),d=dayData(n);d.sentences=(d.sentences||[]).concat(arr.map(function(x){return makeSentence(x[0],x[1]);})).slice(0,10);d.started=true;setDayData(n,d);renderAll();
  });
  $("playAllBtn").addEventListener("click",function(){
    var ss=dayData().sentences;if(!ss.length){showToast("请先录入今日句子。");return;}
    var i=0;
    function next(){
      if(i>=ss.length)return;
      if(!("speechSynthesis" in window)){showToast("当前浏览器不支持系统朗读。");return;}
      var u=new SpeechSynthesisUtterance(ss[i++].en);u.lang="en-US";u.rate=parseFloat($("speechRate").value||"1");u.onend=function(){setTimeout(next,260);};u.onerror=next;window.speechSynthesis.speak(u);
    }
    window.speechSynthesis.cancel();next();
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
  $("librarySearch").addEventListener("input",renderLibrary);$("libraryFilter").addEventListener("change",renderLibrary);$("exportLibraryBtn").addEventListener("click",exportLibrary);

  $("startDateInput").addEventListener("change",function(){state.startDate=this.value||iso();state.selectedDay=null;save();renderAll();});
  $("dailyTargetInput").addEventListener("change",function(){state.dailyTarget=Math.max(5,Math.min(10,parseInt(this.value,10)||8));save();renderAll();});
  $("exportBackupBtn").addEventListener("click",function(){download(JSON.stringify(state,null,2),"妈妈英语180天_备份.json","application/json");});
  $("importBackupInput").addEventListener("change",function(){
    var f=this.files&&this.files[0];if(!f)return;var reader=new FileReader();
    reader.onload=function(){try{state=Object.assign(defaultState(),JSON.parse(reader.result));if(!Array.isArray(state.exams))state.exams=[];save();renderAll();showToast("备份已恢复。");}catch(e){alert("备份文件无法读取。");}};
    reader.readAsText(f);
  });
  $("resetBtn").addEventListener("click",function(){if(confirm("确定清空全部英语学习记录？")){localStorage.removeItem(KEY);state=defaultState();save();renderAll();}});

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
    bind();renderAll();switchView("today");
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