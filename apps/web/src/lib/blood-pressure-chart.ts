/**
 * Pure layout math for the systolic/diastolic trend chart on `/account` —
 * split out of the chart component so the coordinate math is testable
 * without a DOM. One shared y-axis in mmHg (both series are the same unit,
 * so this is not the dual-axis chart the dataviz skill warns against) and
 * one shared x-axis built from the union of both series' dates, since a
 * systolic/diastolic pair usually shares an `effectiveAt` but a correction
 * to only one side of a pair must not desync the two scales.
 * `BloodPressureTrendChart.tsx` owns rendering, hover, legend and locale-
 * aware date labels.
 */

export interface AnalytePointLike {
  value: number;
  effectiveAt: string;
}

export interface ChartMarker {
  x: number;
  y: number;
  value: number;
  effectiveAt: string;
}

export interface ChartSeriesLayout {
  /** `null` for a single point — one dot has no line to draw. */
  pathD: string | null;
  markers: readonly ChartMarker[];
}

export interface ChartTick {
  /** Pixel position along the relevant axis. */
  at: number;
  value: number;
}

export interface BloodPressureChartLayout {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  systolic: ChartSeriesLayout | null;
  diastolic: ChartSeriesLayout | null;
  /** Clean round mmHg values, low to high, each with its pixel y. */
  yTicks: readonly ChartTick[];
  /** One per distinct timestamp across both series, each with its pixel x. */
  xTicks: readonly ChartTick[];
}

const WIDTH = 600;
const HEIGHT = 220;
const PLOT = { left: 40, right: 12, top: 12, bottom: 28 };

/** Rounds a domain outward to a clean 10 mmHg step so ticks read as 60/70/80, never 63/74. */
function roundedDomain(min: number, max: number): { min: number; max: number } {
  const lo = Math.floor((min - 4) / 10) * 10;
  const hi = Math.ceil((max + 4) / 10) * 10;
  return lo === hi ? { min: lo - 10, max: hi + 10 } : { min: lo, max: hi };
}

function yFor(domain: { min: number; max: number }, value: number): number {
  const t = (value - domain.min) / (domain.max - domain.min);
  return HEIGHT - PLOT.bottom - t * (HEIGHT - PLOT.bottom - PLOT.top);
}

function xFor(start: number, span: number, timestamp: number): number {
  const t = (timestamp - start) / span;
  return PLOT.left + t * (WIDTH - PLOT.right - PLOT.left);
}

function buildSeries(
  points: readonly AnalytePointLike[],
  domain: { min: number; max: number },
  start: number,
  span: number,
): ChartSeriesLayout | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
  const markers = sorted.map((point) => ({
    x: xFor(start, span, Date.parse(point.effectiveAt)),
    y: yFor(domain, point.value),
    value: point.value,
    effectiveAt: point.effectiveAt,
  }));
  const pathD = markers.length < 2 ? null : `M ${markers.map((m) => `${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(' L ')}`;

  return { pathD, markers };
}

export function buildBloodPressureChartLayout(
  systolic: readonly AnalytePointLike[],
  diastolic: readonly AnalytePointLike[],
): BloodPressureChartLayout | null {
  const all = [...systolic, ...diastolic];
  if (all.length === 0) return null;

  const domain = roundedDomain(Math.min(...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)));
  const step = (domain.max - domain.min) / 4;
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round(domain.min + step * i);
    return { value, at: yFor(domain, value) };
  });

  const timestamps = [...new Set(all.map((p) => Date.parse(p.effectiveAt)))].sort((a, b) => a - b);
  const start = timestamps[0]!;
  const span = (timestamps[timestamps.length - 1] ?? start) - start || 1;
  const xTicks = timestamps.map((timestamp) => ({ value: timestamp, at: xFor(start, span, timestamp) }));

  return {
    width: WIDTH,
    height: HEIGHT,
    plot: PLOT,
    systolic: buildSeries(systolic, domain, start, span),
    diastolic: buildSeries(diastolic, domain, start, span),
    yTicks,
    xTicks,
  };
}
