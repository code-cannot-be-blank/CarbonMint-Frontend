/**
 * Formatting helpers for currency, tonnage, dates and addresses.
 */

/**
 * Round a floating-point number to `decimals` significant decimal places,
 * eliminating IEEE-754 binary drift that accumulates in multiplication chains
 * such as `quantity * pricePerTonne * (1 + slippage / 100)`.
 *
 * Uses the "multiply-round-divide" technique which is accurate for the
 * decimal magnitudes found in this application (quantities up to ~10 M,
 * prices up to ~1 000 USDC/tonne).
 *
 * @param {number} value
 * @param {number} [decimals=10]
 * @returns {number}
 *
 * @example
 * roundTo(185 * 1.005)     // 185.925  (without: 185.92499999999998)
 * roundTo(9.75 * 1.001)    // 9.75975  (without: 9.759749999999999)
 */
export function roundTo(value, decimals = 10) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

/**
 * Format a number as USDC currency.
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

/**
 * Format a tonnage value with the tCO2e unit.
 * @param {number} value
 * @returns {string}
 */
export function formatTonnes(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US')} tCO2e`;
}

/**
 * Truncate a Stellar public key for compact display.
 * @param {string} address
 * @returns {string}
 */
export function shortenAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Compute remaining supply as a clamped 0-100 percentage.
 * @param {number} available
 * @param {number} total
 * @returns {number}
 */
export function availabilityPercent(available, total) {
  if (!total || total <= 0) return 0;
  const pct = (Number(available) / Number(total)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Format a 0-100 number as a rounded percentage string.
 * @param {number} value
 * @returns {string}
 */
export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${Math.round(n)}%`;
}

/**
 * Format a large tonnage compactly, e.g. 12500 -> "12.5K tCO2e".
 * @param {number} value
 * @returns {string}
 */
export function formatTonnesCompact(value) {
  const n = Number(value) || 0;
  const compact = n.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return `${compact} tCO2e`;
}

/**
 * Format a unit price as a per-tonne currency string.
 * @param {number} value - price per tonne in USDC
 * @returns {string}
 */
export function formatPricePerTonne(value) {
  return `${formatCurrency(value)} / tCO2e`;
}

/**
 * Format an ISO date string as a human-readable date.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get the start of the ISO week (Monday) for a given date (UTC).
 * @param {string|Date} value - ISO string or Date
 * @returns {Date}
 */
export function getWeekStart(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Return a human-readable month+year label for an ISO date, e.g. "July 2026".
 * @param {string} iso
 * @returns {string}
 */
export function getMonthLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).formatToParts(d);
  const month = parts.find((p) => p.type === 'month').value;
  const year = parts.find((p) => p.type === 'year').value;
  return `${month} ${year}`;
}

/**
 * Return a week label for an ISO date, e.g. "Week of Jul 14".
 * @param {string} iso
 * @returns {string}
 */
export function getWeekLabel(iso) {
  if (!iso) return '';
  const weekStart = getWeekStart(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(weekStart);
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `Week of ${month} ${day}`;
}

/**
 * Format a timestamp as a relative "time ago" string in the viewer's local
 * timezone, e.g. "just now", "5 minutes ago", "3 hours ago". Falls back to
 * a full local date/time once it's more than a day old.
 * @param {string|number|Date} value - ISO string, epoch ms, or Date
 * @param {Date} [now] - reference time, defaults to the current time
 * @returns {string}
 */
export function formatRelativeTime(value, now = new Date()) {
  if (!value) return '';
  const then = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return then.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
