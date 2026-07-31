import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderMarkdown(content, sanitizer = DOMPurify) {
  return sanitizer.sanitize(marked.parse(content));
}
