// ------------ CONFIG ------------
const EXEC_URL = "https://script.google.com/macros/s/AKfycbxWDSzNIWghMFoYUAfV6fMe0br-CeKdnK5g3MEIn4_7NHZ5mwiuuEtx8e623YdcPVqo4A/exec"; // <-- put your /exec URL
// --------------------------------

// Simple JSONP loader with timeout and cleanup
function jsonp(url, cbName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout: " + url));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      window[cbName] = undefined;
      try { delete window[cbName]; } catch(e) {}
      const s = document.getElementById(cbName);
      if (s) s.remove();
    }

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    const s = document.createElement("script");
    s.id = cbName;
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + encodeURIComponent(cbName);
    s.onerror = () => {
      cleanup();
      reject(new Error("JSONP network error: " + url));
    };
    document.body.appendChild(s);
  });
}

const cb = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

async function loadUnits() {
  try {
    document.getElementById('message').textContent = "Loading units…";
    const url = EXEC_URL + "?action=units";
    const res = await jsonp(url, cb("u"));
    const sel = document.getElementById('unitSelect');
    sel.innerHTML = "";
    (res && res.units ? res.units : ["All Units"]).forEach(u => {
      const o = document.createElement("option");
      o.value = u; o.textContent = u;
      sel.appendChild(o);
    });
    sel.onchange = () => loadChapters(sel.value);
    await loadChapters(sel.value);
    document.getElementById('message').textContent = "";
  } catch (err) {
    console.error(err);
    document.getElementById('message').textContent = "Error loading units: " + err.message;
  }
}

async function loadChapters(unit) {
  try {
    document.getElementById('message').textContent = "Loading chapters…";
    const url = EXEC_URL + "?action=chapters&unit=" + encodeURIComponent(unit || "");
    const res = await jsonp(url, cb("c"));
    const sel = document.getElementById('chapterSelect');
    sel.innerHTML = "";
    (res && res.chapters ? res.chapters : ["All Chapters"]).forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    sel.onchange = () => loadQuestions(unit, sel.value);
    await loadQuestions(unit, sel.value);
    document.getElementById('message').textContent = "";
  } catch (err) {
    console.error(err);
    document.getElementById('message').textContent = "Error loading chapters: " + err.message;
  }
}

async function loadQuestions(unit, chapter) {
  try {
    const box = document.getElementById('questionList');
    box.innerHTML = "Loading…";
    const url = EXEC_URL + "?action=questions&unit=" + encodeURIComponent(unit || "")
                         + "&chapter=" + encodeURIComponent(chapter || "All Chapters");
    const res = await jsonp(url, cb("q"));
    box.innerHTML = "";
    if (!res || !res.questions || !res.questions.length) {
      box.innerHTML = "<div class='muted'>No questions found.</div>";
      return;
    }
    res.questions.forEach(q => {
      const d = document.createElement("div");
      d.className = "qitem";
      d.textContent = q.question;
      d.onclick = () => {
        document.getElementById('resultArea').style.display = 'block';
        document.getElementById('confidence').textContent = "Answer to: " + q.question;
        document.getElementById('answerText').textContent = q.answer || "(No answer)";
      };
      box.appendChild(d);
    });
  } catch (err) {
    console.error(err);
    document.getElementById('questionList').innerHTML = "<span class='muted'>Error: " + err.message + "</span>";
  }
}

async function ask() {
  try {
    const unit = document.getElementById('unitSelect').value || "All Units";
    const chapter = document.getElementById('chapterSelect').value || "All Chapters";
    const q = document.getElementById('studentQuestion').value.trim();

    document.getElementById('message').textContent = "Searching…";
    document.getElementById('resultArea').style.display = 'none';

    const url = EXEC_URL
      + "?action=ask&unit=" + encodeURIComponent(unit)
      + "&chapter=" + encodeURIComponent(chapter)
      + "&question=" + encodeURIComponent(q)
      + "&minScore=35";

    const res = await jsonp(url, cb("a"));
    document.getElementById('message').textContent = "";
    document.getElementById('resultArea').style.display = 'block';

    if (!res || res.error) {
      document.getElementById('confidence').textContent = "Error";
      document.getElementById('answerText').textContent = res ? res.error : "No response.";
      return;
    }
    if (!res.matched_question) {
      document.getElementById('confidence').textContent = "No close match (score " + (res.score || 0) + "%)";
      document.getElementById('answerText').textContent = "Try rephrasing your question.";
      return;
    }
    document.getElementById('confidence').textContent =
      "Confidence: " + res.score + "% (matched: " + res.matched_question + ")";
    document.getElementById('answerText').textContent = res.answer || "(No answer)";
  } catch (err) {
    console.error(err);
    document.getElementById('message').textContent = "Error: " + err.message;
  }
}

document.getElementById('askBtn').addEventListener('click', ask);
loadUnits();
