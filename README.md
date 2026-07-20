# CarbonMint

A demo frontend for **CarbonMint**, a tokenized carbon-credit marketplace built
on the Stellar network and Soroban smart contracts. Verified emission-reduction
projects mint carbon credits as `CARBON` tokens; users buy them, hold them in a
wallet, and **retire** (burn) them to receive a permanent offset certificate.

> This is a UI demo. It runs entirely on **mock data** with a **mock wallet** —
> there are no network calls and no real blockchain interaction.

## Features

- Landing page explaining the tokenized carbon-credit lifecycle (mint → buy → retire).
- Marketplace with grid and list views of available credit batches, showing a
  live "last updated" timestamp for the listed data.
- Batch detail page with a validated buy flow, live cost calculation, and a
  configurable **slippage tolerance** setting.
- My Credits page showing holdings with a retire flow.
- Retirements page listing issued offset certificates.
- Mock Stellar wallet connect/disconnect.

## Tech stack

- React 18 + Vite
- React Router
- Plain CSS (no UI framework)
- Mock Stellar/Soroban services

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

## Scripts

- `npm run dev` — start the Vite dev server with hot reloading.
- `npm run build` — produce an optimized production build in `dist/`.
- `npm run preview` — serve the production build locally to sanity-check it.
- `npm test` — run the unit test suite with the Node.js built-in test runner.

## CI

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and
pull request. It installs dependencies, builds the project, and runs the full
test suite. Any failure will block the workflow.

## How it works

1. **Mint** — verified projects mint credit batches as `CARBON` tokens. In this
   demo, batches are static mock data in `src/services/market.js`.
2. **Buy** — users connect a (mock) wallet and purchase tonnes from a batch.
   Holdings are tracked in `AppContext`.
3. **Retire** — users burn credits they hold; the app issues a retirement
   certificate as proof of offset.

## Slippage tolerance

When buying credits the user can configure a **slippage tolerance** — the
maximum price increase they are willing to accept between placing an order and
it settling on-chain. This mirrors the slippage protection found in DEX/AMM
interfaces.

### How it works

The tolerance is expressed as a percentage (e.g. **1 %**). Before submitting a
transaction `submitBuy` computes:

```
maxAcceptablePrice = referencePrice × (1 + slippageTolerance / 100)
```

If the current listed price is higher than `maxAcceptablePrice` the transaction
is rejected with an error message that names both the fill price and the limit.
In this mock the price is static, so the happy-path guard always passes; the
rejection path is demonstrated by the test suite.

### UI controls (BuyForm)

| Control | Description |
|---|---|
| **Preset buttons** (0.5 %, 1 %, 2 %) | Quick-select common tolerance values. The active preset is highlighted and has `aria-pressed="true"`. |
| **Custom input** | Free-form numeric field for values between 0.1 % and 50 %. Accepts one decimal place. |
| **Max cost line** | Displays `quantity × pricePerTonne × (1 + tolerance / 100)` so the user knows their worst-case spend. |
| **High-slippage warning** | A yellow advisory message appears when tolerance exceeds 5 %. |

The default tolerance is **1 %**.

### Validation (`validateSlippageTolerance`)

Located in `src/utils/validate.js`. Returns `{ valid, error }`.

| Condition | Error message |
|---|---|
| Empty / null / undefined | "Enter a slippage tolerance." |
| Non-numeric string | "Slippage tolerance must be a number." |
| Below 0.1 % | "Slippage tolerance must be at least 0.1%." |
| Above 50 % | "Slippage tolerance cannot exceed 50%." |

### Accessibility

The slippage fieldset follows the same patterns as the rest of the form:

- Preset buttons expose `aria-pressed` state.
- The custom input has an explicit `aria-label` ("Custom slippage tolerance").
- Validation errors and the high-slippage warning use `role="alert"` /
  `aria-live="polite"` so screen readers announce them without interrupting.

## Precision guardrails

JavaScript's IEEE-754 double-precision arithmetic introduces two classes of
silent error that matter in financial UIs:

1. **Floating-point drift** — multiplying a price by a slippage factor produces
   a value like `185.92499999999998` instead of `185.925`. Displayed or compared
   as-is, this can confuse users and mis-fire slippage guards.
2. **Unsafe integer coercion** — integers beyond `Number.MAX_SAFE_INTEGER`
   (2⁵³ − 1) cannot be represented exactly. A user typing `9007199254740993`
   into the quantity field silently becomes `9007199254740992`, making
   downstream arithmetic wrong without any error being raised.

### How it works

**`roundTo(value, decimals = 10)` — `src/utils/format.js`**

Uses the multiply-round-divide technique to eliminate binary drift from
multiplication chains before the result is displayed or compared:

```js
roundTo(185 * 1.005)       // 185.925  (raw: 185.92499999999998)
roundTo(100 * 9.75 * 1.005) // 979.875  (raw: 979.8749999999999)
```

Applied in:
- `BuyForm` — `total` and `maxTotal` display values.
- `submitBuy` — receipt `total` and `maxAcceptablePrice` before the slippage
  guard comparison.

**`MAX_SAFE_QUANTITY = 1 000 000` — `src/utils/validate.js`**

Both `validateBuyQuantity` and `validateRetireQuantity` now reject any quantity
that fails `Number.isSafeInteger(q)` or exceeds `MAX_SAFE_QUANTITY`. This is
stricter than `Number.isInteger`, which returns `true` for `2^53` even though
that value cannot be represented exactly.

```js
// Old check (insufficient)
Number.isInteger(2 ** 53)    // true  ← silent precision loss allowed through

// New check
Number.isSafeInteger(2 ** 53) // false ← correctly rejected
```

The `1 000 000` cap is well above any real-world carbon-credit batch size and
keeps all downstream multiplication results within the safe integer range even
at the highest price in the catalogue.

### Where precision loss is guarded

| Location | Threat | Mitigation |
|---|---|---|
| `BuyForm` — `total` display | fp drift in `q * price` | `roundTo` |
| `BuyForm` — `maxTotal` display | fp drift in `q * price * (1 + s/100)` | `roundTo` |
| `submitBuy` — receipt `total` | fp drift in `q * price` | `roundTo` |
| `submitBuy` — slippage guard | fp drift in `baseline * (1 + s/100)` | `roundTo` |
| `validateBuyQuantity` | unsafe integer quantity input | `Number.isSafeInteger` + `MAX_SAFE_QUANTITY` |
| `validateRetireQuantity` | unsafe integer quantity input | `Number.isSafeInteger` + `MAX_SAFE_QUANTITY` |

### Testing

Precision-loss tests live in `src/test/precision.test.js` and cover:

- `roundTo` — drift elimination for known bad values, custom decimal places,
  edge cases (zero, negative).
- `validateBuyQuantity` / `validateRetireQuantity` — boundary at
  `MAX_SAFE_QUANTITY`, rejection of `Number.MAX_SAFE_INTEGER` and `2^53`,
  unchanged behaviour for all other validation rules.
- `submitBuy` — receipt total is exact, `maxAcceptablePrice` is drift-free, and
  the slippage guard does not spuriously reject a valid order.

## Project structure

```
src/
  components/   reusable UI (Navbar, BatchCard, BuyForm, RetireModal, ...)
  pages/        routed views (Home, Marketplace, BatchDetail, MyCredits, ...)
  services/     mock wallet, marketplace, api and retirement logic
  context/      AppContext global state provider
  hooks/        useWallet, useMarket, useHoldings, useDebounce, useDocumentTitle
  utils/        format and validate helpers
  constants/    project catalog and runtime config
```

## Accessibility

CarbonMint follows WCAG 2.1 SC 4.1.3 (Status Messages) to ensure screen readers
receive timely announcements for every asynchronous UI update.

### LiveRegion component

`src/components/LiveRegion.jsx` is a visually-hidden `role="status"` element that
accepts a `message` prop and an optional `politeness` prop (`"polite"` or
`"assertive"`). It is always present in the DOM so assistive technologies
register it before any message is injected, preventing missed announcements.

```jsx
// Non-critical feedback — announces after the current speech finishes
<LiveRegion message="Purchase complete. You bought 10 tCO2e for 150.00 USDC." />

// Urgent errors — interrupts immediately
<LiveRegion politeness="assertive" message={error} />
```

### Announcement map

| Location | Event | Politeness |
|---|---|---|
| `BuyForm` | Form submitting ("Processing your purchase…") | polite |
| `BuyForm` | Validation error (empty / out-of-range quantity) | polite (`role=alert`) |
| `RetireModal` | Form submitting ("Processing your retirement…") | polite |
| `RetireModal` | Validation error | polite (`role=alert`) |
| `BatchDetail` | Purchase receipt ("Purchase complete. You bought…") | polite |
| `BatchDetail` | Buy error after batch is loaded | assertive |
| `MyCredits` | Retirement success ("Retirement complete. X tCO2e retired…") | polite |
| `MyCredits` | Retirement error | assertive |
| `WalletButton` | Wallet connecting ("Connecting wallet…") | polite |
| `WalletButton` | Wallet connected ("Wallet connected: \<address\>") | polite |
| `CopyButton` | Clipboard copy ("Copied \<label\>") | polite |
| `Alert` | `danger` / `warning` variants | assertive (`role=alert`) |
| `Alert` | `info` / `success` variants | polite (`role=status`) |
| `ErrorMessage` | Any rendered error | assertive (`role=alert`) |
| `Loader` | Spinner visible | polite (`role=status`) |
| `SkeletonGrid` | Batch list loading | polite (`role=status aria-busy`) |

### Design decisions

- **Never use `aria-live="assertive"` for routine updates.** It is reserved for
  errors and urgent states that require the user's immediate attention. All
  success messages and progress indicators use `"polite"`.
- **`aria-atomic="true"`** is set on every live region so screen readers
  announce the complete updated string rather than just the changed fragment.
- **Always-present regions** (`LiveRegion`) prevent assistive technologies from
  missing the first announcement (some AT ignore content injected into newly
  created live regions).
- **`aria-relevant="additions text"`** on `LiveRegion` ensures both new content
  and text mutations are announced.

### Testing

Component-level accessibility tests live in `src/test/aria-live.test.jsx` and
run with [Vitest](https://vitest.dev/) + [@testing-library/react](https://testing-library.com/).

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` to override defaults. All values are optional —
the demo runs without any configuration.

## Disclaimer

This project is for demonstration only. No real tokens, payments, or carbon
credits are involved.
