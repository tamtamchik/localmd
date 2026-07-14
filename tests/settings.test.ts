import { describe, expect, test } from "bun:test";
import {
  formatAuthorLabel,
  formatRelativeTime,
  getSaveStatusLabel,
  mapScrollPosition,
  resolveTheme,
} from "../src/public/settings.js";

describe("resolveTheme", () => {
  test("uses an explicit browser choice before the configured theme", () => {
    expect(resolveTheme("dark", "light", true)).toBe("light");
  });

  test("resolves the system theme from the browser preference", () => {
    expect(resolveTheme("system", null, true)).toBe("dark");
    expect(resolveTheme("system", null, false)).toBe("light");
  });

  test("uses an explicit configured theme", () => {
    expect(resolveTheme("dark", null, false)).toBe("dark");
  });
});

test("formats the complete relative time for the time element", () => {
  const now = new Date("2026-07-14T12:00:00Z").getTime();

  expect(formatRelativeTime("2026-07-12T12:00:00Z", now)).toBe("2 days ago");
});

test("maps scroll progress between editor and preview", () => {
  expect(mapScrollPosition(400, 1000, 200, 1800, 200)).toBe(800);
  expect(mapScrollPosition(900, 1000, 200, 1800, 200)).toBe(1600);
});

test("returns the start when the source cannot scroll", () => {
  expect(mapScrollPosition(0, 200, 200, 1800, 200)).toBe(0);
});

test("formats accessible author labels", () => {
  expect(formatAuthorLabel("Ada Lovelace", 1)).toBe("Ada Lovelace · 1 line");
  expect(formatAuthorLabel("Grace Hopper", 12)).toBe("Grace Hopper · 12 lines");
});

test("returns accessible save status text", () => {
  expect(getSaveStatusLabel("saved")).toBe("Saved");
  expect(getSaveStatusLabel("unsaved")).toBe("Unsaved changes");
  expect(getSaveStatusLabel("saving")).toBe("Saving…");
  expect(getSaveStatusLabel("error")).toBe("Save failed");
});
