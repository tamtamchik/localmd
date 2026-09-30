import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderMarkdown(content, sanitizer = DOMPurify) {
  const document = sanitizer.sanitize(marked.parse(content), { RETURN_DOM: true });
  const ids = new Set(
    Array.from(
      document.querySelectorAll("[id]:not(h1, h2, h3, h4, h5, h6)"),
      (element) => element.id,
    ),
  );
  for (const heading of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const slug =
      heading.textContent
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
        .replace(/\s/g, "-") || "heading";
    let id = slug;
    let suffix = 0;
    while (ids.has(id)) id = `${slug}-${++suffix}`;
    ids.add(id);
    heading.id = id;
  }
  return document.innerHTML;
}
