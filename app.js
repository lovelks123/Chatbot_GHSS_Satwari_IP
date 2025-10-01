// Put your web app EXEC URL here:
const EXEC_URL = "https://script.google.com/macros/s/AKfycbxWDSzNIWghMFoYUAfV6fMe0br-CeKdnK5g3MEIn4_7NHZ5mwiuuEtx8e623YdcPVqo4A/exec";

// === Bridge caller ===
function bridgeCall(paramsObj, timeoutMs=20000){
  return new Promise((resolve,reject)=>{
    const url = new URL(EXEC_URL);
    url.searchParams.set("page","bridge");
    Object.entries(paramsObj||{}).forEach(([k,v])=>url.searchParams.set(k,v));
    const ifr=document.createElement("iframe"); ifr.style.display="none"; ifr.src=url.toString(); document.body.appendChild(ifr);

    const timer=setTimeout(()=>{cleanup(); reject(new Error("Bridge timeout"));},timeoutMs);
    function onMsg(ev){
      console.log("[parent] msg from",ev.origin,ev.data);
      if(!ev.data||ev.data.source!=="gas-bridge") return;
      if(ev.data.payload.type==="ready"){ console.log("bridge ready"); return; }
      clearTimeout(timer); cleanup();
      const payload=ev.data.payload;
      if(payload.ok===false) reject(new Error(payload.error||"Bridge error"));
      else resolve(payload.data);
    }
    function cleanup(){window.removeEventListener("message",onMsg);try{ifr.remove();}catch(e){}}
    window.addEventListener("message",onMsg);
  });
}

// === UI functions ===
async function loadUnits(){
  document.getElementById('message').textContent="Loading units...";
  const res=await bridgeCall({action:"units"}).catch(e=>{document.getElementById('message').textContent=e;return null;});
  const sel=document.getElementById('unitSelect'); sel.innerHTML="";
  (res&&res.units?res.units:["All Units"]).forEach(u=>{const o=document.createElement("option");o.value=u;o.textContent=u;sel.appendChild(o);});
  sel.onchange=()=>loadChapters(sel.value); loadChapters(sel.value);
}
async function loadChapters(unit){
  const res=await bridgeCall({action:"chapters",unit}).catch(()=>null);
  const sel=document.getElementById('chapterSelect'); sel.innerHTML="";
  (res&&res.chapters?res.chapters:["All Chapters"]).forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;sel.appendChild(o);});
  sel.onchange=()=>loadQuestions(unit,sel.value); loadQuestions(unit,sel.value);
}
async function loadQuestions(unit,chapter){
  const box=document.getElementById('questionList'); box.innerHTML="Loading...";
  const res=await bridgeCall({action:"questions",unit,chapter}).catch(()=>null); box.innerHTML="";
  if(!res||!res.questions||!res.questions.length){ box.innerHTML="<div class='muted'>No questions.</div>"; return; }
  res.questions.forEach(q=>{const d=document.createElement("div"); d.className="qitem"; d.textContent=q.question; d.onclick=()=>{document.getElementById("resultArea").style.display="block"; document.getElementById("confidence").textContent="Answer to: "+q.question; document.getElementById("answerText").textContent=q.answer;}; box.appendChild(d);});
}
async function ask(){
  const unit=document.getElementById('unitSelect').value||"All Units";
  const chapter=document.getElementById('chapterSelect').value||"All Chapters";
  const q=document.getElementById('studentQuestion').value.trim();
  document.getElementById('message').textContent="Searching...";
  const res=await bridgeCall({action:"ask",unit,chapter,question:q}).catch(e=>{document.getElementById('message').textContent=e;return null;});
  document.getElementById('message').textContent="";
  if(!res) return;
  document.getElementById('resultArea').style.display="block";
  if(!res.matched_question){ document.getElementById('confidence').textContent="No match"; document.getElementById('answerText').textContent="Try again."; return; }
  document.getElementById('confidence').textContent="Confidence: "+res.score+"% (matched: "+res.matched_question+")";
  document.getElementById('answerText').textContent=res.answer;
}
document.getElementById('askBtn').addEventListener('click',ask);

// init
loadUnits();
