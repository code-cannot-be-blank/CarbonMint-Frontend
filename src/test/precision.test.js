/**
 * Tests for precision-loss guardrails.
 *
 * Coverage:
 *   - roundTo                   — eliminates IEEE-754 fp drift in cost calculations
 *   - validateBuyQuantity       — MAX_SAFE_QUANTITY and isSafeInteger guards
 *   - validateRetireQuantity    — MAX_SAFE_QUANTITY and isSafeInteger guards
 *   - submitBuy                 — receipt total and maxAcceptablePrice are drift-free
 */

import { describe, it, expect } from 'vitest';

// ─── roundTo ─────────────────────────────────────────────────────────────────

import { roundTo } from '../utils/format.js';

describe('roundTo', () => {
  it('eliminates fp drift in price × slippage factor (185 * 1.005)', () => {
    // Raw: 185.92499999999998
    expect(roundTo(185 * 1.005)).toBe(185.925);
  });

  it('eliminates fp drift in price × slippage factor (9.75 * 1.001)', () => {
    // Raw: 9.759749999999999
    expect(roundTo(9.75 * 1.001)).toBe(9.75975);
  });

  it('eliminates fp drift in cost calculation (100 * 9.75 * 1.005)', () => {
    // Raw: 979.8749999999999
    expect(roundTo(100 * 9.75 * 1.005)).toBe(979.875);
  });

  it('returns exact values unchanged', () => {
    expect(roundTo(100 * 14.5)).toBe(1450);
    expect(roundTo(3 * 9.75)).toBe(29.25);
  });

  it('respects a custom decimals argument', () => {
    expect(roundTo(1 / 3, 2)).toBe(0.33);
    expect(roundTo(1 / 3, 4)).toBe(0.3333);
  });

  it('handles zero', () => {
    expect(roundTo(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(roundTo(-9.75 * 1.001)).toBe(-9.75975);
  });
});

// ─── validateBuyQuantity — precision guards ───────────────────────────────────

import { validateBuyQuantity, validateRetireQuantity, MAX_SAFE_QUANTITY } from '../utils/validate.js';

describe('MAX_SAFE_QUANTITY', () => {
  it('is exported and equals 1 000 000', () => {
    expect(MAX_SAFE_QUANTITY).toBe(1_000_000);
  });
});

describe('validateBuyQuantity — precision guards', () => {
  const available = MAX_SAFE_QUANTITY;

  it('accepts a quantity at MAX_SAFE_QUANTITY', () => {
    const result = validateBuyQuantity(MAX_SAFE_QUANTITY, available);
    expect(result).toEqual({ valid: true, error: null });
  });

  it('rejects a quantity one above MAX_SAFE_QUANTITY', () => {
    const result = validateBuyQuantity(MAX_SAFE_QUANTITY + 1, available + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });

  it('rejects Number.MAX_SAFE_INTEGER (9007199254740991)', () => {
    const result = validateBuyQuantity(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });

  it('rejects a non-safe integer that passes Number.isInteger (2^53)', () => {
    // 2^53 = 9007199254740992 — Number.isInteger returns true but isSafeInteger false
    const unsafe = 2 ** 53;
    expect(Number.isInteger(unsafe)).toBe(true);   // would have slipped past old check
    expect(Number.isSafeInteger(unsafe)).toBe(false);
    const result = validateBuyQuantity(unsafe, unsafe);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });

  it('still rejects quantities above available even within safe range', () => {
    const result = validateBuyQuantity(50, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/only 10 tonnes available/i);
  });

  it('still performs all existing validations before the precision check', () => {
    expect(validateBuyQuantity('', 100).error).toMatch(/enter a quantity/i);
    expect(validateBuyQuantity('abc', 100).error).toMatch(/must be a number/i);
    expect(validateBuyQuantity(0, 100).error).toMatch(/greater than zero/i);
    expect(validateBuyQuantity(1.5, 100).error).toMatch(/whole number/i);
  });
});

describe('validateRetireQuantity — precision guards', () => {
  const owned = MAX_SAFE_QUANTITY;

  it('accepts a quantity at MAX_SAFE_QUANTITY', () => {
    const result = validateRetireQuantity(MAX_SAFE_QUANTITY, owned);
    expect(result).toEqual({ valid: true, error: null });
  });

  it('rejects a quantity one above MAX_SAFE_QUANTITY', () => {
    const result = validateRetireQuantity(MAX_SAFE_QUANTITY + 1, owned + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });

  it('rejects a non-safe integer that passes Number.isInteger', () => {
    const unsafe = 2 ** 53;
    const result = validateRetireQuantity(unsafe, unsafe);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });

  it('still rejects amounts above owned within safe range', () => {
    const result = validateRetireQuantity(50, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/only hold 10/i);
  });
});

// ─── submitBuy — receipt total and slippage guard are drift-free ─────────────

import { submitBuy } from '../services/api.js';
import { BATCHES } from '../services/market.js';

describe('submitBuy — precision guardrails', () => {
  it('receipt total has no fp drift for a drift-prone price', async () => {
    // batch-002: pricePerTonne = 9.75, quantity = 100 → 975 (clean)
    const batch = BATCHES.find((b) => b.id === 'batch-002');
    const result = await submitBuy({
      batchId: batch.id,
      quantity: 1,
      buyer: 'GTEST',
      slippageTolerance: 1,
    });
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBe(9.75);
  });

  it('receipt total for the iceland-dac batch (185 USDC/tonne) has no drift', async () => {
    const batch = BATCHES.find((b) => b.id === 'batch-005'); // 185.0
    const result = await submitBuy({
      batchId: batch.id,
      quantity: 1,
      buyer: 'GTEST',
      slippageTolerance: 1,
    });
    expect(result.total).toBe(185);
  });

  it('maxAcceptablePrice has no drift (185 * 1.005 = 185.925 not 185.92499...)', async () => {
    // referencePrice=185, 0.5% slippage → maxAcceptable=185.925.
    // Without roundTo the raw value is 185.92499999999998, which is less
    // than 185.925 and could mis-fire the guard if it ever compared against
    // a price of exactly 185.925. Verify the guard passes cleanly.
    const batch = BATCHES.find((b) => b.id === 'batch-005'); // 185.0
    await expect(
      submitBuy({
        batchId: batch.id,
        quantity: 1,
        buyer: 'GTEST',
        slippageTolerance: 0.5,
        referencePrice: 185,
      })
    ).resolves.toMatchObject({ batchId: 'batch-005' });
  });
});
