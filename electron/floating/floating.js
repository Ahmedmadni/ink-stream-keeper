const bridge = window.memoFlowFloating;
const title = document.getElementById("title");
const content = document.getElementById("content");
const pin = document.getElementById("pin");
function failed() {
  document.getElementById("error").hidden = false;
}
function show(note) {
  document.title = note.title + " — MemoFlow";
  title.textContent = note.title;
  content.textContent = note.text;
  document.body.classList.toggle("dark", note.dark);
  pin.setAttribute("aria-pressed", String(note.pinned));
  document.getElementById("state").textContent = note.pinned ? "مثبتة فوق النوافذ" : "بطاقة عائمة";
  const date = new Date(note.updatedAt);
  document.getElementById("updated").textContent = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ar", { calendar: "gregory", day: "numeric", month: "short" }).format(
        date,
      );
}
bridge.onData(show);
bridge.read().then(show).catch(failed);
pin.addEventListener("click", () => bridge.pin().then(show).catch(failed));
document.getElementById("close").addEventListener("click", () => bridge.close().catch(failed));
document
  .getElementById("return")
  .addEventListener("click", () => bridge.returnToApp().catch(failed));
