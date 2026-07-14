export function resolveTheme(configuredTheme, savedTheme, prefersDark) {
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  if (configuredTheme === "system") {
    return prefersDark ? "dark" : "light";
  }

  return configuredTheme;
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  const elapsed = new Date(timestamp).getTime() - now;
  const minute = 60 * 1000;

  if (Math.abs(elapsed) < minute) {
    return "just now";
  }

  const units = [
    ["year", 365 * 24 * 60 * minute],
    ["month", 30 * 24 * 60 * minute],
    ["day", 24 * 60 * minute],
    ["hour", 60 * minute],
    ["minute", minute],
  ];

  for (const [unit, duration] of units) {
    if (Math.abs(elapsed) >= duration) {
      const value = Math.round(elapsed / duration);
      return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(value, unit);
    }
  }
}

export function mapScrollPosition(
  scrollTop,
  scrollHeight,
  clientHeight,
  targetScrollHeight,
  targetClientHeight,
) {
  const scrollable = Math.max(scrollHeight - clientHeight, 0);
  if (scrollable === 0) return 0;

  const progress = Math.min(Math.max(scrollTop / scrollable, 0), 1);
  return progress * Math.max(targetScrollHeight - targetClientHeight, 0);
}
