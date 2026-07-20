/**
 * Validation helpers for purchase and retirement flows.
 */

/**
 * Maximum quantity (in whole tonnes) accepted by the buy and retire flows.
 *
 * JavaScript integers beyond Number.MAX_SAFE_INTEGER (2^53 - 1) cannot be
 * represented exactly, so arithmetic on them silently produces wrong results.
 * We cap well below that limit: 1 000 000 tonnes is far larger than any
 * single carbon-credit batch in the real world and keeps all downstream
 * multiplication results within the safe integer range even at the highest
 * price in the mock catalogue (~185 USDC/tonne).
 */
export const MAX_SAFE_QUANTITY = 1_000_000;

/**
 * Validate a buy request against an available listing.
 * @param {number} quantity - tonnes the user wants to buy
 * @param {number} available - tonnes available in the batch
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateBuyQuantity(quantity, available) {
  const q = Number(quantity);
  if (!quantity && quantity !== 0) {
    return { valid: false, error: 'Enter a quantity.' };
  }
  if (Number.isNaN(q)) {
    return { valid: false, error: 'Quantity must be a number.' };
  }
  if (q <= 0) {
    return { valid: false, error: 'Quantity must be greater than zero.' };
  }
  if (!Number.isInteger(q)) {
    return { valid: false, error: 'Quantity must be a whole number of tonnes.' };
  }
  if (!Number.isSafeInteger(q) || q > MAX_SAFE_QUANTITY) {
    return {
      valid: false,
      error: `Quantity cannot exceed ${MAX_SAFE_QUANTITY.toLocaleString('en-US')} tonnes.`,
    };
  }
  if (q > available) {
    return { valid: false, error: `Only ${available} tonnes available.` };
  }
  return { valid: true, error: null };
}

/**
 * Validate a retirement request against the user's holding.
 * @param {number} quantity - tonnes to retire
 * @param {number} owned - tonnes the user currently holds
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateRetireQuantity(quantity, owned) {
  const q = Number(quantity);
  if (!quantity && quantity !== 0) {
    return { valid: false, error: 'Enter an amount to retire.' };
  }
  if (Number.isNaN(q)) {
    return { valid: false, error: 'Amount must be a number.' };
  }
  if (q <= 0) {
    return { valid: false, error: 'Amount must be greater than zero.' };
  }
  if (!Number.isInteger(q)) {
    return { valid: false, error: 'Amount must be a whole number of tonnes.' };
  }
  if (!Number.isSafeInteger(q) || q > MAX_SAFE_QUANTITY) {
    return {
      valid: false,
      error: `Amount cannot exceed ${MAX_SAFE_QUANTITY.toLocaleString('en-US')} tonnes.`,
    };
  }
  if (q > owned) {
    return { valid: false, error: `You only hold ${owned} tonnes.` };
  }
  return { valid: true, error: null };
}

/**
 * Validate a slippage tolerance percentage value.
 *
 * Acceptable range: 0.1 % – 50 %. Values outside this range are either
 * meaninglessly tight (below 0.1 %) or dangerously loose (above 50 %).
 *
 * @param {number|string} value - the tolerance as a percentage, e.g. 1 means 1 %
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateSlippageTolerance(value) {
  const v = Number(value);
  if (value === '' || value === null || value === undefined) {
    return { valid: false, error: 'Enter a slippage tolerance.' };
  }
  if (Number.isNaN(v)) {
    return { valid: false, error: 'Slippage tolerance must be a number.' };
  }
  if (v < 0.1) {
    return {
      valid: false,
      error: 'Slippage tolerance must be at least 0.1%.',
    };
  }
  if (v > 50) {
    return {
      valid: false,
      error: 'Slippage tolerance cannot exceed 50%.',
    };
  }
  return { valid: true, error: null };
}

/**
 * Check whether a string looks like a Stellar public key. A real public key is
 * a 56-character base32 string beginning with `G`; this performs a shape check
 * suitable for client-side validation only.
 * @param {string} address
 * @returns {boolean}
 */
export function isStellarAddress(address) {
  if (typeof address !== 'string') return false;
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}
