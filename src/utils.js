// Shared, side-effect-free helpers used across the app.
// Kept in one place so formatting/number/date logic is consistent everywhere.

/**
 * Natural, number-aware comparison for size/spec names.
 * Names that start with a number sort before purely textual names, and
 * numeric chunks are compared by value (so "8mm" comes before "10mm").
 */
export function asrNaturalSizeCompare(a, b) {
  const get = (item) => String(item?.name ?? item ?? "").trim().toLowerCase();
  const ax = get(a);
  const bx = get(b);

  const aStartsNumber = /^\s*\d/.test(ax);
  const bStartsNumber = /^\s*\d/.test(bx);
  if (aStartsNumber && !bStartsNumber) return -1;
  if (!aStartsNumber && bStartsNumber) return 1;

  const nums = (value) => (value.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const an = nums(ax);
  const bn = nums(bx);
  const max = Math.max(an.length, bn.length);

  for (let i = 0; i < max; i += 1) {
    if (an[i] == null && bn[i] != null) return -1;
    if (an[i] != null && bn[i] == null) return 1;
    if (an[i] !== bn[i]) return an[i] - bn[i];
  }

  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: "base" });
}

/** Return a copy of `list` sorted with {@link asrNaturalSizeCompare}. */
export function asrSortSizes(list) {
  return [...(list || [])].sort(asrNaturalSizeCompare);
}

/** Coerce any value to a number, defaulting to 0. */
export const num = (v) => Number(v || 0);

/** Round to the nearest ₹0.05. */
export const round05 = (v) => Math.round(num(v) * 20) / 20;

/** Format a value as Indian-rupee currency (rounded to ₹0.05). */
export const inr = (v) =>
  `₹${round05(v).toLocaleString("en-IN", {
    minimumFractionDigits: round05(v) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

/** Today's date as DD.MM.YYYY. */
export const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}.${d.getFullYear()}`;
};

/** Human-friendly "time ago" label for a timestamp. */
export function ago(v) {
  if (!v) return "not updated";
  const ms = Date.now() - new Date(v).getTime();
  if (ms < 6e4) return "just now";
  const m = Math.floor(ms / 6e4);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}
