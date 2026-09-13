import { expect, test } from "bun:test";

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

import { renderMarkdown } from "../src/public/markdown.js";

test("sanitizes unsafe preview HTML without removing Markdown formatting", () => {
  const { window } = new JSDOM("");
  const sanitizer = createDOMPurify(window);
  const html = renderMarkdown(
    [
      "# Safe",
      '<img src="x" onerror="alert(1)">',
      "<script>alert(1)</script>",
      "[unsafe](javascript:alert(1))",
      "```js",
      "const safe = true;",
      "```",
    ].join("\n\n"),
    sanitizer,
  );

  expect(html).toContain('<h1 id="safe">Safe</h1>');
  expect(html).toContain('<code class="language-js">');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("javascript:");
});

test("adds stable anchors for formatted, repeated, and Unicode headings", () => {
  const { window } = new JSDOM("");
  const html = renderMarkdown(
    "## Open *questions*\n\n## Open questions\n\n## Open questions-1\n\n## Вопросы & ответы",
    createDOMPurify(window),
  );
  const document = new JSDOM(html).window.document;
  expect([...document.querySelectorAll("h2")].map((heading) => heading.id)).toEqual([
    "open-questions",
    "open-questions-1",
    "open-questions-1-1",
    "вопросы--ответы",
  ]);
  expect(renderMarkdown("## Open questions", createDOMPurify(window))).toContain(
    'id="open-questions"',
  );
});
