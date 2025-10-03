// ------------ CONFIG ------------
const EXEC_URL = "https://script.google.com/macros/s/AKfycbxFrm6khxM_lvQBj5kQAFAQB0NG5p3cbiwKhBIWkhNZInIoLJQLVkxi46D8JR7-9kuATQ/exec";
// --------------------------------

// JSONP loader with extra Edge-friendly tweaks (unchanged)
function jsonp(url, cbName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error("JSONP timeout: " + url));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
      const s = document.getElementById(cbName);
      if (s) s.remove();
    }

    window[cbName] = (data) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(data);
    };

    const s = document.createElement("script");
    s.id = cbName;
    const glue = url.includes("?") ? "&" : "?";
    s.src = url + glue + "callback=" + encodeURIComponent(cbName) + "&_t=" + Date.now();

    // Edge/privacy tweaks
    s.referrerPolicy = "no-referrer";
    s.crossOrigin = "anonymous";
    s.type = "text/javascript";

    s.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("JSONP network error: " + url));
    };

    document.body.appendChild(s);
  });
}
const cb = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

// ---- helpers / DOM refs ----
const unitSel    = document.getElementById('unitSelect');
const chapterSel = document.getElementById('chapterSelect');
const listBox    = document.getElementById('questionList');
const askBtn     = document.getElementById('askBtn');
const askInput   = document.getElementById('studentQuestion');
const resultCard = document.getElementById('resultArea');
const confEl     = document.getElementById('confidence');
const ansEl      = document.getElementById('answerText');
const msgEl      = document.getElementById('message');

function showError(msg){
  console.error(msg);
  msgEl.innerHTML = '<span class="error">❌ '+msg+'</span>';
}
function setMessage(t){ msgEl.textContent = t || ""; }
function clearSelect(sel, placeholder){
  sel.innerHTML = "";
  const o = document.createElement('option');
  o.value = ""; o.disabled = true; o.selected = true; o.textContent = placeholder;
  sel.appendChild(o);
}
function enable(el, on){
  el.disabled = !on;
  el.classList.toggle('disabled', !on);
}

// ---------------- UI flows (dependent) ----------------
async function loadUnits(){
  try{
    setMessage("Loading units…");
    clearSelect(unitSel, "— Choose a unit —");
    clearSelect(chapterSel, "— Choose a unit first —");
    enable(chapterSel, false);
    enable(askBtn, false);
    listBox.innerHTML = "<div class='muted'>Pick a unit and chapter to see questions.</div>";
    resultCard.style.display = 'none';

    const url = EXEC_URL + "?action=units";
    const res = await jsonp(url, cb("u"));
    console.log("[units]", res);

    const units = (res && Array.isArray(res.units)) ? res.units : [];
    if (!units.length){ setMessage("No units found."); return; }

    units.forEach(u => {
      const o = document.createElement('option'); o.value = u; o.textContent = u;
      unitSel.appendChild(o);
    });

    setMessage("");
  } catch (err){ showError(err.message); }
}

async function loadChapters(unit){
  try{
    setMessage("Loading chapters…");
    clearSelect(chapterSel, "— Choose a chapter —");
    enable(chapterSel, true);
    enable(askBtn, false);
    listBox.innerHTML = "<div class='muted'>Pick a chapter to see questions.</div>";
    resultCard.style.display = 'none';

    const url = EXEC_URL + "?action=chapters&unit=" + encodeURIComponent(unit || "");
    const res = await jsonp(url, cb("c"));
    console.log("[chapters]", res);

    const chapters = (res && Array.isArray(res.chapters)) ? res.chapters : [];
    if (!chapters.length){ setMessage("No chapters for this unit."); return; }

    chapters.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      chapterSel.appendChild(o);
    });

    setMessage("");
  } catch (err){ showError(err.message); }
}

async function loadQuestions(unit, chapter){
  try{
    setMessage("Loading questions…");
    listBox.innerHTML = "Loading…";
    resultCard.style.display = 'none';
    enable(askBtn, true);

    const url = EXEC_URL + "?action=questions&unit=" + encodeURIComponent(unit || "")
                         + "&chapter=" + encodeURIComponent(chapter || "");
    const res = await jsonp(url, cb("q"));
    console.log("[questions]", res);

    const box = listBox; box.innerHTML="";
    const qs = (res && Array.isArray(res.questions)) ? res.questions : [];
    if(!qs.length){
      box.innerHTML="<div class='muted'>No questions in this chapter yet.</div>";
      enable(askBtn, false);
      setMessage("");
      return;
    }
    qs.forEach(q=>{
      const d=document.createElement('div'); d.className='qitem'; d.textContent=q.question;
      d.onclick = ()=>{
        resultCard.style.display = 'block';
        confEl.textContent = "Answer to: " + q.question;
        ansEl.textContent = q.answer || "(No answer)";
      };
      box.appendChild(d);
    });
    setMessage("");
  } catch (err){ showError(err.message); }
}

async function ask(){
  try{
    const unit = unitSel.value;
    const chapter = chapterSel.value;
    const q = (askInput.value || "").trim();

    if (!unit){ showError("Please choose a unit first."); return; }
    if (!chapter){ showError("Please choose a chapter."); return; }
    if (!q){ showError("Type your question, or tap one from the list."); return; }

    setMessage("Searching…");
    resultCard.style.display = 'none';

    const url = EXEC_URL
      + "?action=ask&unit=" + encodeURIComponent(unit)
      + "&chapter=" + encodeURIComponent(chapter)
      + "&question=" + encodeURIComponent(q)
      + "&minScore=35";

    const res = await jsonp(url, cb("a"));
    console.log("[ask]", res);

    setMessage("");
    resultCard.style.display = 'block';

    if(!res || res.error){
      confEl.textContent = "Error";
      ansEl.textContent = (res && res.error) ? res.error : "No response.";
      return;
    }
    if(!res.matched_question){
      confEl.textContent = "No close match (score " + (res.score||0) + "%)";
      ansEl.textContent = "Try rephrasing or choose from the list.";
      return;
    }
    confEl.textContent = "Confidence: " + res.score + "% (matched: " + res.matched_question + ")";
    ansEl.textContent = res.answer || "(No answer)";
  } catch (err){
    showError(err.message);
  }
}

// ---- wire events ----
unitSel.addEventListener('change', e => {
  const unit = e.target.value;
  if (!unit) return;
  loadChapters(unit);
});
chapterSel.addEventListener('change', e => {
  const unit = unitSel.value;
  const chapter = e.target.value;
  if (!unit || !chapter) return;
  loadQuestions(unit, chapter);
});
document.getElementById('askBtn').addEventListener('click', ask);

// ---- boot ----
console.log("[init] JSONP frontend (Edge-tuned)");
console.log("[init] student UI (unit→chapter→questions)");
loadUnits();
