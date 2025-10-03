/* ====== CONFIG ====== */
// Put your latest Apps Script *exec* URL here:
const API_ROOT = "https://script.google.com/macros/s/AKfycbxFrm6khxM_lvQBj5kQAFAQB0NG5p3cbiwKhBIWkhNZInIoLJQLVkxi46D8JR7-9kuATQ/exec"; // <-- replace

/* ====== Minimal JSONP helper (Edge/Chrome/Firefox friendly) ====== */
function jsonp(url, cbName){
  return new Promise((resolve, reject) => {
    const id = cbName + "_" + Math.random().toString(36).slice(2,9);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout: " + url));
    }, 15000);

    window[id] = (data) => {
      clearTimeout(timeout);
      cleanup();
      resolve(data);
    };

    function cleanup(){
      try { delete window[id]; } catch(_) {}
      const s = document.getElementById(id);
      if (s) s.remove();
    }

    const s = document.createElement("script");
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + encodeURIComponent(id);
    s.id = id;
    s.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("JSONP network error: " + url));
    };
    document.body.appendChild(s);
  });
}

/* ====== UI refs ====== */
const unitSel    = document.getElementById("unitSelect");
const chapterSel = document.getElementById("chapterSelect");
const listBox    = document.getElementById("questionList");
const askBtn     = document.getElementById("askBtn");
const askInput   = document.getElementById("studentQuestion");
const resultArea = document.getElementById("resultArea");
const confEl     = document.getElementById("confidence");
const ansEl      = document.getElementById("answerText");
const msgEl      = document.getElementById("message");

/* ====== Helpers ====== */
function setMessage(txt, isError=false){
  msgEl.textContent = txt || "";
  msgEl.style.color = isError ? "#b00020" : "inherit";
}
function enable(el, on){
  el.disabled = !on;
  el.classList.toggle("disabled", !on);
}
function clearSelect(sel, placeholder){
  sel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = ""; opt.disabled = true; opt.selected = true; opt.textContent = placeholder;
  sel.appendChild(opt);
}

/* ====== Load Units (first step) ====== */
async function loadUnits(){
  try{
    setMessage("Loading units…");
    clearSelect(unitSel, "— Choose a unit —");
    clearSelect(chapterSel, "— Choose a unit first —");
    enable(chapterSel, false);
    enable(askBtn, false);
    listBox.innerHTML = `<div class="hint">Pick a unit and chapter to see questions.</div>`;
    resultArea.classList.add("hidden");

    const res = await jsonp(`${API_ROOT}?action=units`, "u");
    if (!res || !res.units || !res.units.length){
      setMessage("No units found.", true);
      return;
    }
    // populate units (no “All Units”)
    res.units.forEach(u => {
      const o = document.createElement("option");
      o.value = u; o.textContent = u;
      unitSel.appendChild(o);
    });
    setMessage("");
  }catch(err){
    setMessage(err.message, true);
  }
}

/* ====== After Unit → load Chapters ====== */
async function loadChapters(unit){
  try{
    setMessage("Loading chapters…");
    clearSelect(chapterSel, "— Choose a chapter —");
    enable(chapterSel, true);
    enable(askBtn, false);
    listBox.innerHTML = `<div class="hint">Pick a chapter to see questions.</div>`;
    resultArea.classList.add("hidden");

    const res = await jsonp(`${API_ROOT}?action=chapters&unit=${encodeURIComponent(unit)}`, "c");
    if (!res || !res.chapters || !res.chapters.length){
      setMessage("No chapters for this unit.", true);
      return;
    }
    res.chapters.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      chapterSel.appendChild(o);
    });
    setMessage("");
  }catch(err){
    setMessage(err.message, true);
  }
}

/* ====== After Chapter → load Questions ====== */
async function loadQuestions(unit, chapter){
  try{
    setMessage("Loading questions…");
    listBox.innerHTML = "Loading…";
    resultArea.classList.add("hidden");
    enable(askBtn, true);

    const res = await jsonp(
      `${API_ROOT}?action=questions&unit=${encodeURIComponent(unit)}&chapter=${encodeURIComponent(chapter)}`,
      "q"
    );
    listBox.innerHTML = "";
    if(!res || !res.questions || !res.questions.length){
      listBox.innerHTML = `<div class="hint">No questions in this chapter yet.</div>`;
      enable(askBtn, false);
      setMessage("");
      return;
    }
    res.questions.forEach(item => {
      const d = document.createElement("div");
      d.className = "qitem";
      d.textContent = item.question;
      d.onclick = () => {
        resultArea.classList.remove("hidden");
        confEl.textContent = "Answer to: " + item.question;
        ansEl.textContent = item.answer || "(No answer)";
      };
      listBox.appendChild(d);
    });
    setMessage("");
  }catch(err){
    setMessage(err.message, true);
  }
}

/* ====== Ask within selected Unit + Chapter ====== */
async function ask(){
  const unit = unitSel.value;
  const chapter = chapterSel.value;
  const q = (askInput.value || "").trim();

  if (!unit){ setMessage("Please choose a unit first.", true); return; }
  if (!chapter){ setMessage("Please choose a chapter.", true); return; }
  if (!q){ setMessage("Type your question, or tap a question above.", true); return; }

  try{
    setMessage("Searching…");
    resultArea.classList.add("hidden");

    const url = `${API_ROOT}?action=ask` +
      `&unit=${encodeURIComponent(unit)}` +
      `&chapter=${encodeURIComponent(chapter)}` +
      `&question=${encodeURIComponent(q)}` +
      `&minScore=40`;
    const res = await jsonp(url, "a");
    setMessage("");

    resultArea.classList.remove("hidden");
    if (!res || res.error){
      confEl.textContent = "Error";
      ansEl.textContent = (res && res.error) ? res.error : "Unknown error";
      return;
    }
    if (!res.matched_question){
      confEl.textContent = `No close match (score ${res.score || 0}%)`;
      ansEl.textContent = "Try rephrasing or pick from the list.";
      return;
    }
    confEl.textContent = `Confidence: ${res.score}% (matched: ${res.matched_question})`;
    ansEl.textContent = res.answer || "(No answer)";
  }catch(err){
    setMessage(err.message, true);
  }
}

/* ====== Wire up events ====== */
unitSel.addEventListener("change", e => {
  const unit = e.target.value;
  if (!unit) return;
  loadChapters(unit);
});
chapterSel.addEventListener("change", e => {
  const unit = unitSel.value;
  const chapter = e.target.value;
  if (!unit || !chapter) return;
  loadQuestions(unit, chapter);
});
askBtn.addEventListener("click", ask);

/* ====== Boot ====== */
(function init(){
  console.log("[init] JSONP frontend (Edge-tuned)");
  console.log("[init] student UI (unit→chapter→questions)");
  loadUnits();
})();

