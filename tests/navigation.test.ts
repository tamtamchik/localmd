import { expect, test } from "bun:test";

import { JSDOM } from "jsdom";

import { defaultConfig } from "../src/config";

test.each([
  { cursor: { line: 1, ch: 3 }, restored: { line: 1, ch: 3 } },
  { cursor: { line: 100, ch: 100 }, restored: { line: 1, ch: 11 } },
])("restores saved positions and editor settings ($cursor)", async ({ cursor, restored }) => {
  const build = await Bun.build({
    entrypoints: ["src/public/app.js"],
    target: "browser",
    format: "iife",
  });
  expect(build.success).toBe(true);
  const script = await build.outputs.find((output) => output.path.endsWith(".js"))!.text();
  const dom = new JSDOM(await Bun.file("src/public/index.html").text(), {
    url: "http://127.0.0.1:3000/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { console: browserConsole, DOMRect } = window;
  const errors: unknown[] = [];
  const saved: string[] = [];
  browserConsole.error = (...messages: unknown[]) => errors.push(...messages);
  Object.assign(window, {
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      addListener() {},
      removeListener() {},
    }),
    CSS: { escape: (value: string) => value },
    alert: (message: unknown) => errors.push(message),
    fetch: async (url: string, options?: RequestInit) => {
      if (url === "/api/config") {
        return Response.json({
          ...defaultConfig,
          ui: { ...defaultConfig.ui, theme: "dark" },
          editor: {
            ...defaultConfig.editor,
            lineNumbers: false,
            lineWrapping: false,
            autosaveDelayMs: 10,
          },
        });
      }
      if (url === "/api/files") {
        return Response.json([{ path: "saved.md", name: "saved.md", isDirectory: false }]);
      }
      if (options?.method === "PUT") {
        saved.push(JSON.parse(options.body as string).content);
        return Response.json({ success: true });
      }
      return Response.json({ content: "# Saved\nSecond line", history: null });
    },
  });
  window.localStorage.setItem(
    "localmd-session",
    JSON.stringify({ file: "saved.md", cursor, scroll: 0 }),
  );
  window.Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  async function waitFor(check: () => boolean) {
    for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(10);
    expect(errors).toEqual([]);
    expect(check()).toBe(true);
  }
  try {
    window.eval(script);
    await waitFor(() => window.document.querySelector("#preview h1")?.textContent === "Saved");
    expect(window.document.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(window.document.querySelector(".cm-lineNumbers")).toBeNull();
    expect(window.document.querySelector(".cm-lineWrapping")).toBeNull();
    expect(window.document.documentElement.getAttribute("data-theme")).toBe("dark");
    window.dispatchEvent(new window.Event("pagehide"));
    expect(JSON.parse(window.localStorage.getItem("localmd-session")!).cursor).toEqual(restored);

    window.document.querySelector(".cm-content .cm-line")!.textContent = "# Autosaved";
    await waitFor(() => saved.length === 1);
    expect(saved).toEqual(["# Autosaved\nSecond line"]);
    await waitFor(() => window.document.querySelector("#preview h1")?.textContent === "Autosaved");

    window.document.querySelectorAll(".cm-content .cm-line")[1]!.textContent =
      "[link](https://example.com)";
    await waitFor(() => window.document.querySelector("#preview a") !== null);
    const url = [...window.document.querySelectorAll(".cm-content span")].find(
      (span) => span.textContent === "https://example.com",
    )!;
    expect(window.getComputedStyle(url).color).toBe("rgb(125, 135, 153)");
  } finally {
    window.close();
  }
});

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
  const saved: { path: string; content: string }[] = [];
  const scrolled: string[] = [];
  const errors: unknown[] = [];
  const { console: browserConsole } = window;
  browserConsole.error = (...messages: unknown[]) => errors.push(...messages);
  let holdRequests = false;
  const pending = new Map<string, (response: Response) => void>();
  Object.assign(window, {
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      addListener() {},
      removeListener() {},
    }),
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&") },
    alert: (message: unknown) => errors.push(message),
    fetch: async (url: string, options?: RequestInit) => {
      if (url === "/api/config") return Response.json(defaultConfig);
      if (url === "/api/files") return Response.json([]);
      const path = new URL(url, window.location.href).searchParams.get("path")!;
      if (options?.method === "PUT") {
        saved.push({ path, content: JSON.parse(options.body as string).content });
        return Response.json({ success: true });
      }
      opened.push(path);
      const response = Response.json({
        path,
        content:
          "# Title\n\n[Next](next.md#details)\n\n[Here](#open-questions)\n\n[Absolute](http://127.0.0.1:3000/other%20file.md#details)\n\n## Open questions\n\n## Details\n\n[Later](/later.md#details)",
        history: null,
      });
      if (holdRequests) {
        return new Promise<Response>((resolve) => pending.set(path, resolve));
      }
      return response;
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
    expect(errors).toEqual([]);
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
    await waitFor(() => scrolled.length === 2);
    expect(window.history.length).toBe(initialHistoryLength + 1);
    expect(opened[1]).toBe("product/adr/common/next.md");
    expect(window.location.pathname).toBe("/product/adr/common/next.md");
    expect(window.location.hash).toBe("#details");

    window.document.querySelector<HTMLAnchorElement>('#preview a[href="#open-questions"]')!.click();
    await waitFor(() => scrolled.length === 3);
    expect(opened.length).toBe(3);
    expect(window.location.hash).toBe("#open-questions");

    window.history.back();
    await waitFor(() => scrolled.length === 4);
    expect(window.location.hash).toBe("#details");
    window.history.back();
    await waitFor(() => opened.length === 4 && scrolled.length === 5);
    expect(opened[3]).toBe(opened[0]);
    expect(window.location.hash).toBe("#open-questions");
    window.document.querySelector<HTMLAnchorElement>('#preview a[href^="http:"]')!.click();
    await waitFor(() => opened.length === 5 && scrolled.length === 6);
    expect(opened[4]).toBe("other file.md");
    expect(window.location.pathname).toBe("/other%20file.md");
    expect(window.location.hash).toBe("#details");
    holdRequests = true;
    const historyBeforeRace = window.history.length;
    window.document.querySelector<HTMLAnchorElement>('#preview a[href="next.md#details"]')!.click();
    window.document
      .querySelector<HTMLAnchorElement>('#preview a[href="/later.md#details"]')!
      .click();
    await waitFor(() => pending.has("next.md") && pending.has("later.md"));
    pending.get("later.md")!(Response.json({ content: "## Latest", history: null }));
    await waitFor(() => window.document.getElementById("current-file")!.textContent === "later.md");
    pending.get("next.md")!(Response.json({ content: "## Stale", history: null }));
    await Bun.sleep(20);
    expect(window.document.getElementById("current-file")!.textContent).toBe("later.md");
    expect(window.document.querySelector("#preview h2")?.textContent).toBe("Latest");
    expect(window.location.pathname).toBe("/later.md");
    expect(window.history.length).toBe(historyBeforeRace + 1);
    expect(JSON.parse(window.localStorage.getItem("localmd-session")!).file).toBe("later.md");

    window.history.pushState(null, "", "/slow.md");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await waitFor(() => pending.has("slow.md"));
    window.history.back();
    await waitFor(() => window.location.pathname === "/later.md");
    pending.get("slow.md")!(Response.json({ error: "File not found" }));
    await Bun.sleep(20);
    expect(window.document.getElementById("current-file")!.textContent).toBe("later.md");
    expect(window.document.querySelector("#preview h2")?.textContent).toBe("Latest");
    expect(JSON.parse(window.localStorage.getItem("localmd-session")!).file).toBe("later.md");
    expect(errors).toEqual([]);

    expect(window.document.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(window.document.querySelector(".cm-lineNumbers")).not.toBeNull();
    expect(window.document.querySelector(".cm-lineWrapping")).not.toBeNull();
    const lightEditorClasses = window.document.querySelector(".cm-editor")!.className;
    window.document.getElementById("theme-toggle")!.click();
    expect(window.document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.document.querySelector(".cm-editor")!.className).not.toBe(lightEditorClasses);
    window.document.getElementById("theme-toggle")!.click();
    expect(window.document.querySelector(".cm-editor")!.className).toBe(lightEditorClasses);

    const line = window.document.querySelector(".cm-content .cm-line")!;
    line.textContent = "## Edited";
    await waitFor(() => window.document.querySelector("#preview h2")?.textContent === "Edited");
    expect(window.document.getElementById("save-status")!.getAttribute("data-save-state")).toBe(
      "unsaved",
    );
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
    );
    await waitFor(
      () =>
        window.document.getElementById("save-status")!.getAttribute("data-save-state") === "saved",
    );
    expect(saved).toEqual([{ path: "later.md", content: "## Edited" }]);
    window.dispatchEvent(new window.Event("pagehide"));
    const session = JSON.parse(window.localStorage.getItem("localmd-session")!);
    expect(session.cursor.line).toBe(0);
    expect(session.cursor.ch).toBeGreaterThanOrEqual(0);
    expect(typeof session.scroll).toBe("number");
  } finally {
    window.close();
  }
});
