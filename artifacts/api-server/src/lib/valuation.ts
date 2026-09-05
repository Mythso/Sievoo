/**
 * Server-side re-implementation of the bear/base/bull DCF scenario math
 * from artifacts/sievoo/src/pages/Calculator.tsx, so the watchlist job
 * can compute valuations without a browser. Keep this in sync if the
 * calculator's formula ever changes.
 */

export interface DcfInputs {
  rf: number;
  beta: number;
  rm: number;
  e: number; // market cap (equity value used for WACC weighting)
  d: number; // total debt
  rd: number; // cost of debt, %
  tc: number; // tax rate, %
  baseRev: number;
  revGrowth: number; // %
  fcfMargin: number; // %
  cushion: number; // %
  projectionYears: number;
  g: number; // terminal growth, %
  cash: number;
  debtTotal: number;
  shares: number;
  currentPrice: number;
}

export interface DcfResult {
  wacc: number;
  bear: number;
  base: number;
  bull: number;
  marginOfSafety: number;
}

export function calculateDcf(inputs: DcfInputs): DcfResult {
  const re = inputs.rf + inputs.beta * (inputs.rm - inputs.rf);
  const totalCap = inputs.e + inputs.d;
  const wacc =
    totalCap > 0
      ? (inputs.e / totalCap) * re + (inputs.d / totalCap) * inputs.rd * (1 - inputs.tc / 100)
      : re;

  function scenario(gRate: number, marginPct: number, w: number): number {
    let rev = inputs.baseRev;
    const revMult = 1 + gRate / 100;
    let sumPV = 0;
    let fcfFinal = 0;
    const years = Math.max(1, Math.round(inputs.projectionYears));

    for (let i = 1; i <= years; i++) {
      rev *= revMult;
      const fcf = rev * (marginPct / 100);
      const pv = fcf / Math.pow(1 + w / 100, i);
      sumPV += pv;
      fcfFinal = fcf;
    }

    const termG = inputs.g / 100;
    const denom = w / 100 - termG;
    const tv = denom > 0 ? (fcfFinal * (1 + termG)) / denom : 0;
    const pvTv = tv / Math.pow(1 + w / 100, years);
    const ev = sumPV + pvTv;
    const eq = ev + inputs.cash - inputs.debtTotal;

    return inputs.shares > 0 ? eq / inputs.shares : 0;
  }

  const c = inputs.cushion / 100;
  const g = inputs.revGrowth;
  const m = inputs.fcfMargin;

  const bear = scenario(g * (1 - c - 0.15), m * 0.9, wacc + 1);
  const base = scenario(g * (1 - c), m, wacc);
  const bull = scenario(g * (1 - c + 0.15), m * 1.1, wacc - 0.5);

  const marginOfSafety =
    inputs.currentPrice > 0 ? ((base - inputs.currentPrice) / inputs.currentPrice) * 100 : 0;

  return { wacc, bear, base, bull, marginOfSafety };
}

/**
 * Server-side re-implementation of the Graham Number math from
 * artifacts/sievoo/src/pages/GrahamCalculator.tsx, so the watchlist job's
 * "AutoValue" pass can compute it without a browser - the same way
 * calculateDcf above powers "AutoDCF". Keep this in sync if the Graham
 * calculator's formula ever changes.
 *
 * Graham Number = sqrt(22.5 x EPS x Book Value per Share)
 * Returns nulls (rather than NaN/0) when eps or book value aren't
 * positive, since the formula is undefined/meaningless in that case -
 * common for unprofitable or asset-light companies.
 */
export interface GrahamInputs {
  eps: number; // trailing twelve-month EPS
  bookValuePerShare: number;
  currentPrice: number;
}

export interface GrahamResult {
  grahamNumber: number | null;
  marginOfSafety: number | null; // (grahamNumber - price) / grahamNumber * 100
}

export function calculateGraham(inputs: GrahamInputs): GrahamResult {
  if (!(inputs.eps > 0) || !(inputs.bookValuePerShare > 0)) {
    return { grahamNumber: null, marginOfSafety: null };
  }

  const grahamNumber = Math.sqrt(22.5 * inputs.eps * inputs.bookValuePerShare);
  const marginOfSafety =
    inputs.currentPrice > 0 ? ((grahamNumber - inputs.currentPrice) / grahamNumber) * 100 : null;

  return { grahamNumber, marginOfSafety };
}
