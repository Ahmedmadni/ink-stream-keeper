import DOMPurify from "dompurify";

/** Display/export only; never use this to rewrite stored note HTML. No scripts,
 * CSS resource URLs, frames or remote images inside an unlocked vault reader. */
export function safePageHtml(html: string, remoteImages = false): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "mark",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "label", "input", "blockquote",
      "pre", "code", "hr", "a", "sub", "sup", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "img"],
    ALLOWED_ATTR: ["style", "class", "dir", "href", "src", "alt", "width", "height", "colspan", "rowspan", "colwidth", "start", "type", "checked", "data-type", "data-checked"],
  });
  // A detached div still initiates <img> loads in its owner document. Template
  // content is inert: strip resource URLs before anything can join the live DOM.
  const template = document.createElement("template"); template.innerHTML = clean;
  const root = template.content;
  const styleProperties = new Set(["color", "background-color", "text-align", "font-weight", "font-style",
    "text-decoration", "font-size", "vertical-align", "width", "height"]);
  for (const node of root.querySelectorAll<HTMLElement>("[style]")) {
    for (const property of Array.from(node.style)) {
      const value = node.style.getPropertyValue(property);
      if (!styleProperties.has(property) || /url\s*\(|var\s*\(|expression/i.test(value)) node.style.removeProperty(property);
    }
  }
  for (const image of root.querySelectorAll("img")) {
    const src = image.getAttribute("src") || "";
    const inlineRaster = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(src);
    let external = false;
    try { external = /^(https?:|blob:)$/.test(new URL(src, location.href).protocol); } catch { /* invalid */ }
    if (!inlineRaster && !(remoteImages && external)) {
      const placeholder = document.createElement("p");
      placeholder.textContent = "[صورة مرتبطة غير مضمنة في النسخة المشفرة]";
      image.replaceWith(placeholder);
    } else { image.removeAttribute("srcset"); image.setAttribute("loading", "eager"); }
  }
  for (const input of root.querySelectorAll("input")) {
    if (input.type !== "checkbox") input.remove();
    else input.disabled = true;
  }
  return template.innerHTML;
}
