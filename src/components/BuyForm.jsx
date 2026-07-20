import { useMemo, useState } from 'react';
import Button from './Button.jsx';
import LiveRegion from './LiveRegion.jsx';
import { formatCurrency, formatTonnes, roundTo } from '../utils/format.js';
import { validateBuyQuantity, validateSlippageTolerance } from '../utils/validate.js';
import { useWallet } from '../hooks/useWallet.js';
import './BuyForm.css';

/** Preset slippage tolerance options shown as quick-select buttons (%). */
const SLIPPAGE_PRESETS = [0.5, 1, 2];

/** Default tolerance applied on first render. */
const DEFAULT_SLIPPAGE = 1;

/**
 * Purchase form for a batch. Validates the requested quantity against the
 * available supply and shows a live total cost. Includes a slippage tolerance
 * setting that caps the maximum acceptable fill price.
 *
 * @param {object}   props
 * @param {object}   props.batch
 * @param {(quantity: number, slippageTolerance: number) => Promise<void>} props.onBuy
 * @param {boolean}  props.submitting
 */
export default function BuyForm({ batch, onBuy, submitting }) {
  const { isConnected, connect } = useWallet();
  const [quantity, setQuantity] = useState('');
  const [touched, setTouched] = useState(false);

  // Slippage tolerance state: track the raw string input and whether a custom
  // value is being entered (vs a preset).
  const [slippage, setSlippage] = useState(String(DEFAULT_SLIPPAGE));
  const [slippageTouched, setSlippageTouched] = useState(false);

  const soldOut = batch.availableTonnes <= 0;

  const validation = useMemo(
    () => validateBuyQuantity(quantity, batch.availableTonnes),
    [quantity, batch.availableTonnes]
  );

  const slippageValidation = useMemo(
    () => validateSlippageTolerance(slippage),
    [slippage]
  );

  const total = useMemo(() => {
    const q = Number(quantity);
    if (Number.isNaN(q) || q <= 0) return 0;
    return roundTo(q * batch.pricePerTonne);
  }, [quantity, batch.pricePerTonne]);

  /** Maximum acceptable total cost given the slippage tolerance. */
  const maxTotal = useMemo(() => {
    const q = Number(quantity);
    const s = Number(slippage);
    if (Number.isNaN(q) || q <= 0 || Number.isNaN(s) || s <= 0) return null;
    return roundTo(q * batch.pricePerTonne * (1 + s / 100));
  }, [quantity, slippage, batch.pricePerTonne]);

  /** True when slippage > 5 % — show a gentle warning. */
  const highSlippage = Number(slippage) > 5;

  function handleSlippagePreset(preset) {
    setSlippage(String(preset));
    setSlippageTouched(true);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    setSlippageTouched(true);
    if (!validation.valid || !slippageValidation.valid) return;
    onBuy(Number(quantity), Number(slippage));
  }

  if (soldOut) {
    return (
      <div className="buy-form">
        <h2 className="buy-form-title">Buy credits</h2>
        <p className="buy-form-soldout">
          This batch is fully sold. Browse the marketplace for other available
          credits.
        </p>
      </div>
    );
  }

  return (
    <form className="buy-form" onSubmit={handleSubmit}>
      <h2 className="buy-form-title">Buy credits</h2>

      {/* ── Quantity ── */}
      <label className="buy-form-field">
        <span>Quantity (tonnes)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={quantity}
          placeholder="0"
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </label>

      {touched && !validation.valid && (
        <p className="buy-form-error" role="alert" aria-live="polite" aria-atomic="true">
          {validation.error}
        </p>
      )}

      {/* ── Slippage tolerance ── */}
      <fieldset className="buy-form-slippage">
        <legend className="buy-form-slippage-legend">
          Slippage tolerance
          <span
            className="buy-form-slippage-hint"
            title="The maximum price increase you will accept. If the fill price exceeds this threshold the transaction will be rejected."
          >
            {' '}ⓘ
          </span>
        </legend>

        <div className="buy-form-slippage-presets" role="group" aria-label="Preset slippage tolerances">
          {SLIPPAGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`buy-form-slippage-preset${Number(slippage) === preset ? ' buy-form-slippage-preset--active' : ''}`}
              onClick={() => handleSlippagePreset(preset)}
              aria-pressed={Number(slippage) === preset}
            >
              {preset}%
            </button>
          ))}
        </div>

        <label className="buy-form-field buy-form-slippage-custom">
          <span className="sr-only">Custom slippage tolerance (%)</span>
          <div className="buy-form-slippage-input-wrap">
            <input
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={slippage}
              aria-label="Custom slippage tolerance"
              onChange={(e) => {
                setSlippage(e.target.value);
                setSlippageTouched(true);
              }}
              onBlur={() => setSlippageTouched(true)}
            />
            <span className="buy-form-slippage-unit" aria-hidden="true">%</span>
          </div>
        </label>

        {slippageTouched && !slippageValidation.valid && (
          <p className="buy-form-error" role="alert" aria-live="polite" aria-atomic="true">
            {slippageValidation.error}
          </p>
        )}

        {highSlippage && slippageValidation.valid && (
          <p className="buy-form-slippage-warning" role="alert" aria-live="polite" aria-atomic="true">
            ⚠ High slippage — your order may fill at a significantly higher price.
          </p>
        )}
      </fieldset>

      {/* Screen-reader announcement for submit state */}
      <LiveRegion message={submitting ? 'Processing your purchase…' : ''} />

      {/* ── Summary ── */}
      <div className="buy-form-summary">
        <span>Total</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      {maxTotal !== null && slippageValidation.valid && (
        <p className="buy-form-max-cost">
          Max cost with slippage: <strong>{formatCurrency(maxTotal)}</strong>
        </p>
      )}

      <p className="buy-form-available">
        {formatTonnes(batch.availableTonnes)} available at{' '}
        {formatCurrency(batch.pricePerTonne)} / tonne
      </p>

      {isConnected ? (
        <Button
          type="submit"
          disabled={
            submitting ||
            (touched && !validation.valid) ||
            (slippageTouched && !slippageValidation.valid)
          }
        >
          {submitting ? 'Processing...' : 'Buy now'}
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={connect}>
          Connect wallet to buy
        </Button>
      )}
    </form>
  );
}
