/**
 * Mock API layer.
 *
 * Wraps the in-memory marketplace data with promise-based functions and a
 * small artificial latency so the UI can exercise real loading/error states.
 * No network requests are made.
 */

import { BATCHES } from './market.js';
import { getProjectById } from '../constants/projects.js';
import { delay } from '../utils/delay.js';
import { roundTo } from '../utils/format.js';

const LATENCY_MS = 350;

// Clone so callers cannot mutate the source data by reference.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withProject(batch) {
  return { ...batch, project: getProjectById(batch.projectId) };
}

/**
 * Fetch all marketplace batches with their project metadata.
 * @returns {Promise<Array>}
 */
export async function fetchBatches() {
  await delay(LATENCY_MS);
  return clone(BATCHES).map(withProject);
}

/**
 * Fetch a single batch by id.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function fetchBatch(id) {
  await delay(LATENCY_MS);
  const batch = BATCHES.find((b) => b.id === id);
  if (!batch) {
    throw new Error(`Batch "${id}" was not found.`);
  }
  return withProject(clone(batch));
}

/**
 * Simulate a buy transaction. Returns a mock transaction receipt.
 *
 * The `slippageTolerance` parameter (in percent, e.g. 1 = 1 %) guards against
 * the fill price moving between the moment the user set their tolerance and
 * the moment the transaction settles. The `referencePrice` is the price per
 * tonne the user saw when they placed the order; if the current listed price
 * has risen beyond `referencePrice * (1 + slippageTolerance / 100)` the
 * transaction is rejected.
 *
 * In this mock the price never moves, so `referencePrice` defaults to the
 * current listed price and the guard always passes in the happy path. The
 * rejection path is exercised by the test suite by passing a lower
 * referencePrice than the current listing.
 *
 * @param {{
 *   batchId: string,
 *   quantity: number,
 *   buyer: string,
 *   slippageTolerance?: number,
 *   referencePrice?: number
 * }} params
 * @returns {Promise<Object>}
 */
export async function submitBuy({
  batchId,
  quantity,
  buyer,
  slippageTolerance = 1,
  referencePrice,
}) {
  await delay(LATENCY_MS);
  const batch = BATCHES.find((b) => b.id === batchId);
  if (!batch) {
    throw new Error('Batch not found.');
  }
  if (quantity > batch.availableTonnes) {
    throw new Error('Not enough credits available in this batch.');
  }

  // Enforce slippage tolerance: reject if the current fill price has moved
  // beyond the user's limit relative to the price they saw when ordering.
  // roundTo eliminates IEEE-754 drift in the multiplication, e.g.
  // 185 * 1.005 = 185.92499999999998 without rounding.
  const baseline = referencePrice != null ? referencePrice : batch.pricePerTonne;
  const maxAcceptablePrice = roundTo(baseline * (1 + slippageTolerance / 100));
  if (batch.pricePerTonne > maxAcceptablePrice) {
    throw new Error(
      `Transaction rejected: price of ${batch.pricePerTonne} USDC/tonne exceeds your slippage limit of ${maxAcceptablePrice.toFixed(4)} USDC/tonne.`
    );
  }

  batch.availableTonnes -= quantity;
  return {
    txHash: `mocktx_${Math.random().toString(16).slice(2, 12)}`,
    batchId,
    quantity,
    buyer,
    total: roundTo(quantity * batch.pricePerTonne),
    slippageTolerance,
    timestamp: new Date().toISOString(),
  };
}
