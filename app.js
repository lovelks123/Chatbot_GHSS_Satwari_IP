// ========= CONFIG =========
const EXEC_URL = "https://script.google.com/macros/s/AKfycbzLDWdCWIz27UvyVz9XhaBTBW5vby5q3ai3hkY4qMTf_sN0hfrgmJja7T0-PjpUDLZ6nw/exec"; // your /exec
const BRIDGE_TIMEOUT_MS = 30000;
// ==========================

function bridgeCall(paramsObj, timeoutMs = BRIDGE_TIMEOUT_MS){
  return new Promise((resolve, reject)=>{
    const url = new URL(EXEC_URL);
    url.searchParams.set("page", "bridge");
    Object.entries(paramsObj || {}).forEach(([k,v]) => url.searchParams.set(k, v));

    const ifr = document.createElement('iframe');
    ifr.style.display = "none";
    ifr.src = url.toString();
    document.body.appendChild(ifr);

    let gotReady = false;

    const timer = setTimeout(()=>{
      cleanup();
      reject(new Error("Bridge timeout"));
    }, timeoutMs);

    function onMsg(ev){
      const o = ev.origin || "";
      // Accept messages only from Apps Script origins
      if (!o.includes("script.google.com") && !o.includes("googleusercontent.com")) return;

      const data = ev.data || {};
      if (!data || data.source !== "gas-bridge") return;

      if (data.payload && data.payload.type === "ready"){
        gotReady = true;
        console.log("[bridge] ready");
        return; // wait for the "result" message next
      }

      clearTimeout(timer);
      cleanup();

      const payload = data.payload || {};
      if (payload.ok === false) {
        console.error("[bridge] error:", payload.error);
        reject(new Error(String(payload.error || "Bridge error")));
      } else {
        resolve(payload);
      }
    }

    function cleanup(){
      window.removeEventListener("message", onMsg);
      try { ifr.remove(); } catch(e){}
    }

    window.addEventListener("message", onMsg);
  });
}

function showError(msg){
  console.error(msg);
  document.getElementById('message').innerHTML = '<span style="color:#b00020;font-weight:600">❌ '+msg+'</span>';
}

// ===== UI loaders =====
async function loadUnits(){
  try{
    const res = await bridgeCall({ action: "units" });
    const list = res && res.data ? res.data : ["All Units"];
    const sel = document.getElementById('unitSelect');
    sel.innerHTML = "";
    list.forEach(u => {
      const o = document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o);
    });
    sel.onchange = ()=> loadChapters(sel.value);
    loadChapters(sel.value);
  }catch(err){ showError(err.message); }
}

async function loadChapters(unit){
  try{
    const res = await bridgeCall({ action:"chapters", unit: unit||"" });
    const list = (res && res.data && res.data.chapters) ? res.data.chapters : ["All Chapters"];
    const sel = document.getElementById('chapterSelect');
    sel.innerHTML = "";
    list.forEach(c => {
      const o = document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o);
    });
    sel.onchange = ()=> loadQuestions(unit, sel.value);
    loadQuestions(unit, sel.value);
  }catch(err){ showError(err.message); }
}

async function loadQuestions(unit, chapter){
  try{
    document.getElementById('questionList').textContent = "Loading...";
    const res = await bridgeCall({ action:"questions", unit: unit||"", chapter: chapter||"All Chapters" });
    const qs = (res && res.data && res.data.questions) ? res.data.questions : [];
    const box = document.getElementById('questionList'); box.innerHTML = "";
    if (!qs.length) {
      box.innerHTML = "<div class='muted'>No questions found.</div>";
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
    document.getElementById('message').textContent = "";
  }catch(err){ showError(err.message); }
}

async function ask(){
  try{
    const unit = document.getElementById('unitSelect').value || "All Units";
    const chapter = document.getElementById('chapterSelect').value || "All Chapters";
    const q = document.getElementById('studentQuestion').value.trim();
    document.getElementById('message').textContent = "Searching...";
    document.getElementById('resultArea').style.display = 'none';
    const res = await bridgeCall({ action:"ask", unit, chapter, question:q, minScore:"40" });
    document.getElementById('message').textContent = "";
    document.getElementById('resultArea').style.display = 'block';

    const data = res && res.data;
    if (!data || !data.matched_question) {
      const score = data ? (data.score||0) : 0;
      document.getElementById('confidence').textContent = "No close match (score "+score+"%)";
      document.getElementById('answerText').textContent = "No close match found. Try rephrasing.";
      return;
    }
    document.getElementById('confidence').textContent = "Confidence: "+data.score+"% (matched: "+data.matched_question+")";
    document.getElementById('answerText').textContent = data.answer || "(No answer)";
  }catch(err){ showError(err.message); }
}

document.getElementById('askBtn').addEventListener('click', ask);
loadUnits();

