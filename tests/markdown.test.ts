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

  expect(html).toContain("<h1>Safe</h1>");
  expect(html).toContain('<code class="language-js">');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("javascript:");
});
