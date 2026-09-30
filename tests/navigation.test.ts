import { expect, test } from "bun:test";

import { JSDOM } from "jsdom";

import { defaultConfig } from "../src/config";

test("opens deep links before the saved session and follows Markdown links and history", async () => {
  const build = await Bun.build({
    entrypoints: ["src/public/app.js"],
    target: "browser",
    format: "iife",
  });
  expect(build.success).toBe(true);
  const script = await build.outputs.find((output) => output.path.endsWith(".js"))!.text();
  const html = await Bun.file("src/public/index.html").text();
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:3000/product/adr/common/001-stablecoin-archetype.md#open-questions",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const opened: string[] = [];
  const scrolled: string[] = [];
  const errors: unknown[] = [];
  Object.assign(window, {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&") },
    alert: (message: unknown) => errors.push(message),
    fetch: async (url: string) => {
      if (url === "/api/config") return Response.json(defaultConfig);
      if (url === "/api/files") return Response.json([]);
      const path = new URL(url, window.location.href).searchParams.get("path")!;
      opened.push(path);
      return Response.json({
        path,
        content:
          "# Title\n\n[Next](next.md#details)\n\n[Here](#open-questions)\n\n[Absolute](http://127.0.0.1:3000/other%20file.md#details)\n\n## Open questions\n\n## Details",
        history: null,
      });
    },
  });
  window.localStorage.setItem("localmd-session", JSON.stringify({ file: "saved.md" }));
  const { DOMRect } = window;
  window.Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  window.HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  async function waitFor(check: () => boolean) {
    for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(10);
    expect(check()).toBe(true);
  }
  try {
    window.eval(script);
    await waitFor(() => scrolled.includes("open-questions"));
    expect(opened).toEqual(["product/adr/common/001-stablecoin-archetype.md"]);
    expect(window.document.getElementById("current-file")!.textContent).toBe(opened[0]);

    const initialHistoryLength = window.history.length;
    const nextLink = window.document.querySelector<HTMLAnchorElement>(
      '#preview a[href="next.md#details"]',
    )!;
    nextLink.click();
    nextLink.click();
    await waitFor(() => scrolled.length === 3);
    expect(window.history.length).toBe(initialHistoryLength + 1);
    expect(opened[1]).toBe("product/adr/common/next.md");
    expect(window.location.pathname).toBe("/product/adr/common/next.md");
    expect(window.location.hash).toBe("#details");

    window.document.querySelector<HTMLAnchorElement>('#preview a[href="#open-questions"]')!.click();
    await waitFor(() => scrolled.length === 4);
    expect(opened.length).toBe(3);
    expect(window.location.hash).toBe("#open-questions");

    window.history.back();
    await waitFor(() => scrolled.length === 5);
    expect(window.location.hash).toBe("#details");
    window.history.back();
    await waitFor(() => opened.length === 4 && scrolled.length === 6);
    expect(opened[3]).toBe(opened[0]);
    expect(window.location.hash).toBe("#open-questions");
    window.document.querySelector<HTMLAnchorElement>('#preview a[href^="http:"]')!.click();
    await waitFor(() => opened.length === 5 && scrolled.length === 7);
    expect(opened[4]).toBe("other file.md");
    expect(window.location.pathname).toBe("/other%20file.md");
    expect(window.location.hash).toBe("#details");
    expect(errors).toEqual([]);
  } finally {
    window.close();
  }
});
