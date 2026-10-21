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
  const checklist = document.getElementById("checklist");
  checklist.replaceChildren();
  checklist.hidden = note.kind !== "task" || !note.items.length;
  if (note.kind === "task") {
    for (const item of note.items) {
      const row = document.createElement("li");
      row.className = item.done ? "done" : "";
      const mark = document.createElement("span");
      mark.textContent = item.done ? "☑" : "☐";
      mark.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = item.title;
      row.append(mark, text);
      checklist.append(row);
    }
  }
  const progress = document.getElementById("progress");
  progress.hidden = note.kind !== "task";
  progress.textContent =
    note.kind === "task"
      ? note.items.length
        ? `${note.items.filter((item) => item.done).length} من ${note.items.length} بنود مكتملة`
        : note.done
          ? "مهمة مكتملة"
          : "مهمة غير مكتملة"
      : "";
  const returnLabel =
    note.kind === "task" ? "إعادة المهمة إلى التطبيق" : "إعادة المذكرة إلى التطبيق";
  document.getElementById("return").setAttribute("aria-label", returnLabel);
  document.getElementById("return").title = returnLabel;
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
