'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buildAnalyteTrend } from '@swasthya/health-records';
import type { HealthObservation } from '@swasthya/shared-types';

import { buildBloodPressureChartLayout, pairBloodPressureReadings } from '@/lib/blood-pressure-chart';

const SYSTOLIC_CODE = '8480-6';
const DIASTOLIC_CODE = '8462-4';

// Validated against `references/palette.md`'s six checks (dataviz skill) for
// this app's own light-mode surface: indigo-400 + marigold-600 pass the
// lightness band, CVD separation and normal-vision floor as a categorical
// pair — the darker indigo-600/800 brand tokens are too dark for a thin
// 2px line's own lightness band, and marigold-500 is the CTA accent, not a
// data color, so both step to a lighter/darker sibling instead.
const SYSTOLIC_COLOR = '#6b5fd0';
const DIASTOLIC_COLOR = '#c97a12';

/**
 * `buildAnalyteTrend` (`@swasthya/health-records`) already filters to
 * `selectTrusted` — CONFIRMED and CORRECTED only — so a DRAFT reading a
 * person hasn't reviewed yet never appears here, satisfying "only CONFIRMED
 * points render" by construction rather than a second filter in this file.
 *
 * Renders nothing (a plain empty-state message) until there is at least one
 * confirmed reading — this is a small embedded chart on `/account`, not a
 * dashboard, so it skips the full interaction spec (crosshair, filters) in
 * favour of a `<title>` hover/focus tooltip per marker for the visual chart,
 * plus a real, visible history list below it (`pairBloodPressureReadings`)
 * rather than a sr-only table: a `<title>` tooltip is undiscoverable on a
 * touch device, so a sighted phone visitor previously had no way to read an
 * exact past value as text. The visible list satisfies the dataviz skill's
 * "a table view always exists alongside the visual chart" requirement more
 * usefully than a hidden one would, and doubles as the chart's accessible
 * equivalent for screen-reader users too.
 */
export function BloodPressureTrendChart({ observations }: { observations: readonly HealthObservation[] }) {
  const t = useTranslations('account.bloodPressure.chart');
  const locale = useLocale() as 'ne' | 'en';

  const systolicTrend = buildAnalyteTrend(observations, SYSTOLIC_CODE);
  const diastolicTrend = buildAnalyteTrend(observations, DIASTOLIC_CODE);
  const layout = buildBloodPressureChartLayout(systolicTrend?.points ?? [], diastolicTrend?.points ?? []);

  if (!layout) {
    return <p className="text-sm text-ink-soft">{t('empty')}</p>;
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ne' ? 'ne-NP' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  const readings = pairBloodPressureReadings(systolicTrend?.points ?? [], diastolicTrend?.points ?? []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SYSTOLIC_COLOR }} />
          {t('legend.systolic')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DIASTOLIC_COLOR }} />
          {t('legend.diastolic')}
        </span>
        <span>{t('unit')}</span>
      </div>

      {/* Decorative relative to the visible history list below, which carries the same data as real text. */}
      <svg aria-hidden className="h-auto w-full" viewBox={`0 0 ${layout.width} ${layout.height}`}>
        {layout.yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              className="stroke-line"
              strokeWidth={1}
              x1={layout.plot.left}
              x2={layout.width - layout.plot.right}
              y1={tick.at}
              y2={tick.at}
            />
            <text className="fill-ink-soft text-[10px]" textAnchor="end" x={layout.plot.left - 6} y={tick.at + 3}>
              {tick.value}
            </text>
          </g>
        ))}

        {layout.xTicks.map((tick) => (
          <text
            className="fill-ink-soft text-[10px]"
            key={tick.value}
            textAnchor="middle"
            x={tick.at}
            y={layout.height - 8}
          >
            {dateFormatter.format(new Date(tick.value))}
          </text>
        ))}

        {layout.systolic?.pathD ? (
          <path d={layout.systolic.pathD} fill="none" stroke={SYSTOLIC_COLOR} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        ) : null}
        {layout.diastolic?.pathD ? (
          <path d={layout.diastolic.pathD} fill="none" stroke={DIASTOLIC_COLOR} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        ) : null}

        {layout.systolic?.markers.map((marker) => (
          <circle cx={marker.x} cy={marker.y} fill={SYSTOLIC_COLOR} key={`sys-${marker.effectiveAt}`} r={4} stroke="var(--color-paper)" strokeWidth={2}>
            <title>{`${t('legend.systolic')}: ${marker.value} ${t('unitShort')} — ${dateFormatter.format(new Date(marker.effectiveAt))}`}</title>
          </circle>
        ))}
        {layout.diastolic?.markers.map((marker) => (
          <circle cx={marker.x} cy={marker.y} fill={DIASTOLIC_COLOR} key={`dia-${marker.effectiveAt}`} r={4} stroke="var(--color-paper)" strokeWidth={2}>
            <title>{`${t('legend.diastolic')}: ${marker.value} ${t('unitShort')} — ${dateFormatter.format(new Date(marker.effectiveAt))}`}</title>
          </circle>
        ))}
      </svg>

      {/*
        Real, visible history — not sr-only — newest first, so a phone
        visitor can read an exact past value without hovering a marker.
        Doubles as the chart's accessible text equivalent.
      */}
      <div>
        <h3 className="text-sm font-semibold text-ink">{t('history.heading')}</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-1 pr-3 font-medium" scope="col">{t('history.date')}</th>
              <th className="py-1 pr-3 font-medium" scope="col">{t('history.systolic')}</th>
              <th className="py-1 font-medium" scope="col">{t('history.diastolic')}</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((row) => (
              <tr className="border-t border-line" key={row.effectiveAt}>
                <td className="py-1.5 pr-3 text-ink">{dateFormatter.format(new Date(row.effectiveAt))}</td>
                <td className="py-1.5 pr-3 text-ink">
                  {row.systolic !== null ? `${row.systolic} ${t('unitShort')}` : t('history.notRecorded')}
                </td>
                <td className="py-1.5 text-ink">
                  {row.diastolic !== null ? `${row.diastolic} ${t('unitShort')}` : t('history.notRecorded')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
