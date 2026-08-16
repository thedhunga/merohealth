import { describe, expect, it } from 'vitest';
import { buildBloodPressureChartLayout } from '@/lib/blood-pressure-chart';

describe('buildBloodPressureChartLayout', () => {
  it('returns null when both series are empty — nothing confirmed yet', () => {
    expect(buildBloodPressureChartLayout([], [])).toBeNull();
  });

  it('places a single point without drawing a line', () => {
    const layout = buildBloodPressureChartLayout([{ value: 132, effectiveAt: '2026-08-01T00:00:00Z' }], []);
    expect(layout).not.toBeNull();
    expect(layout!.systolic!.pathD).toBeNull();
    expect(layout!.systolic!.markers).toHaveLength(1);
    expect(layout!.diastolic).toBeNull();
  });

  it('draws a line across two or more chronological points', () => {
    const layout = buildBloodPressureChartLayout(
      [
        { value: 140, effectiveAt: '2026-08-01T00:00:00Z' },
        { value: 120, effectiveAt: '2026-08-10T00:00:00Z' },
      ],
      [],
    );
    expect(layout!.systolic!.pathD).toMatch(/^M /);
    expect(layout!.systolic!.markers).toHaveLength(2);
  });

  it('sorts out-of-order points chronologically before laying them out', () => {
    const layout = buildBloodPressureChartLayout(
      [
        { value: 120, effectiveAt: '2026-08-10T00:00:00Z' },
        { value: 140, effectiveAt: '2026-08-01T00:00:00Z' },
      ],
      [],
    );
    const [first, second] = layout!.systolic!.markers;
    expect(first!.effectiveAt).toBe('2026-08-01T00:00:00Z');
    expect(second!.effectiveAt).toBe('2026-08-10T00:00:00Z');
    // Earlier point plots further left.
    expect(first!.x).toBeLessThan(second!.x);
  });

  it('keeps a lower mmHg value plotted lower on the chart (higher y, SVG origin top-left)', () => {
    const layout = buildBloodPressureChartLayout(
      [
        { value: 140, effectiveAt: '2026-08-01T00:00:00Z' },
        { value: 100, effectiveAt: '2026-08-10T00:00:00Z' },
      ],
      [],
    );
    const [high, low] = layout!.systolic!.markers;
    expect(low!.y).toBeGreaterThan(high!.y);
  });

  it('shares one y-axis and one x-axis across both series', () => {
    const layout = buildBloodPressureChartLayout(
      [{ value: 132, effectiveAt: '2026-08-01T00:00:00Z' }],
      [{ value: 84, effectiveAt: '2026-08-01T00:00:00Z' }],
    );
    // Same timestamp on both series must land at the same x.
    expect(layout!.systolic!.markers[0]!.x).toBe(layout!.diastolic!.markers[0]!.x);
    expect(layout!.yTicks.length).toBeGreaterThan(1);
  });

  it('produces round, evenly-spaced y-axis ticks', () => {
    const layout = buildBloodPressureChartLayout([{ value: 132, effectiveAt: '2026-08-01T00:00:00Z' }], []);
    const values = layout!.yTicks.map((tick) => tick.value);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]! - values[i - 1]!).toBe(values[1]! - values[0]!);
    }
  });

  it('keeps every coordinate inside the declared plot bounds', () => {
    const layout = buildBloodPressureChartLayout(
      [
        { value: 160, effectiveAt: '2026-07-01T00:00:00Z' },
        { value: 118, effectiveAt: '2026-08-15T00:00:00Z' },
      ],
      [
        { value: 100, effectiveAt: '2026-07-01T00:00:00Z' },
        { value: 78, effectiveAt: '2026-08-15T00:00:00Z' },
      ],
    );
    const markers = [...layout!.systolic!.markers, ...layout!.diastolic!.markers];
    for (const marker of markers) {
      expect(marker.x).toBeGreaterThanOrEqual(layout!.plot.left);
      expect(marker.x).toBeLessThanOrEqual(layout!.width - layout!.plot.right);
      expect(marker.y).toBeGreaterThanOrEqual(layout!.plot.top);
      expect(marker.y).toBeLessThanOrEqual(layout!.height - layout!.plot.bottom);
    }
  });
});
