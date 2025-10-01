// ============ CONFIG ============
const EXEC_URL = "https://script.google.com/macros/s/AKfycbzLDWdCWIz27UvyVz9XhaBTBW5vby5q3ai3hkY4qMTf_sN0hfrgmJja7T0-PjpUDLZ6nw/exec"; // <- your Apps Script /exec
// ================================

// Call Apps Script via a hidden iframe bridge (no JSONP, no CORS)
function bridgeCall(paramsObj, timeoutMs = 15000){
  return new Promise((resolve, reject)=>{
    const id = "b_" + Math.random().toString(36).slice(2);
    const url = new URL(EXEC_URL);
    url.searchParams.set("page", "bridge");
    Object.keys(paramsObj||{}).forEach(k => url.searchParams.set(k, paramsObj[k]));

    const ifr = document.createElement('iframe');
    ifr.style.display = "none";
    ifr.src = url.toString();
    document.body.appendChild(ifr);

    const timer = setTimeout(()=>{
      cleanup();
      reject(new Error("Bridge timeout"));
    }, timeoutMs);

    function onMsg(ev){
      // Accept messages only from Apps Script origins
      const okOrigin = ev.origin.includes("script.google.com") || ev.origin.includes("googleusercontent.com");
      if (!okOrigin) return;
      const data = ev.data || {};
      if (data && data.source === "gas-bridge") {
        clearTimeout(timer);
        cleanup();
        resolve(data.payload);
      }
    }

    function cleanup(){
      window.removeEventListener("message", onMsg);
      setTimeout(()=> ifr.remove(), 0);
    }

    window.addEventListener("message", onMsg);
  });
}

function showError(msg){
  console.error(msg);
  document.getElementById('message').innerHTML = '<span class="error">❌ '+msg+'</span>';
}

// UI loaders using the bridge
async function loadUnits(){
  try{
    const res = await bridgeCall({ action: "units" });
    const sel = document.getElementById('unitSelect');
    sel.innerHTML="";
    const units = (res && res.data) || ["All Units"];
    units.forEach(u => {
      const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o);
    });
    sel.onchange = ()=> loadChapters(sel.value);
    loadChapters(sel.value);
  }catch(err){ showError(err.message); }
}

async function loadChapters(unit){
  try{
    const res = await bridgeCall({ action:"chapters", unit: unit||"" });
    const sel = document.getElementById('chapterSelect');
    sel.innerHTML="";
    const chapters = (res && res.data && res.data.chapters) || ["All Chapters"];
    chapters.forEach(c => {
      const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o);
    });
    sel.onchange = ()=> loadQuestions(unit, sel.value);
    loadQuestions(unit, sel.value);
  }catch(err){ showError(err.message); }
}

async function loadQuestions(unit, chapter){
  try{
    document.getElementById('questionList').innerHTML="Loading...";
    const res = await bridgeCall({ action:"questions", unit: unit||"", chapter: chapter||"All Chapters" });
    const box = document.getElementById('questionList'); box.innerHTML="";
    const qs = (res && res.data && res.data.questions) || [];
    if (!qs.length){
      box.innerHTML="<div class='muted'>No questions found.</div>";
      return;
    }
    qs.forEach(q=>{
      const d=document.createElement('div'); d.className='qitem'; d.textContent=q.question;
      d.onclick=()=>{
        document.getElementById('resultArea').style.display='block';
        document.getElementById('confidence').textContent="Answer to: "+q.question;
        document.getElementById('answerText').textContent=q.answer||"(No answer)";
      };
      box.appendChild(d);
    });
    document.getElementById('message').textContent="";
  }catch(err){ showError(err.message); }
}

async function ask(){
  try{
    const unit = document.getElementById('unitSelect').value||"All Units";
    const chapter = document.getElementById('chapterSelect').value||"All Chapters";
    const q = document.getElementById('studentQuestion').value.trim();
    document.getElementById('message').textContent="Searching...";
    document.getElementById('resultArea').style.display='none';

    const res = await bridgeCall({ action:"ask", unit, chapter, question:q, minScore: "40" });
    document.getElementById('message').textContent="";
    document.getElementById('resultArea').style.display='block';
    if (!res || !res.data || !res.data.matched_question){
      const score = res && res.data ? (res.data.score||0) : 0;
      document.getElementById('confidence').textContent="No close match (score "+score+"%)";
      document.getElementById('answerText').textContent="No close match found. Try rephrasing.";
      return;
    }
    document.getElementById('confidence').textContent="Confidence: "+res.data.score+"% (matched: "+res.data.matched_question+")";
    document.getElementById('answerText').textContent=res.data.answer||"(No answer)";
  }catch(err){ showError(err.message); }
}

document.getElementById('askBtn').addEventListener('click', ask);
loadUnits();

