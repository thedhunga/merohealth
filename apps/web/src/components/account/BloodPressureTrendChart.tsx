'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buildAnalyteTrend } from '@swasthya/health-records';
import type { HealthObservation } from '@swasthya/shared-types';

import { buildBloodPressureChartLayout } from '@/lib/blood-pressure-chart';

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
 * Renders nothing (a plain empty-state message) until there are at least two
 * points to compare — this is a small embedded chart on `/account`, not a
 * dashboard, so it skips the full interaction spec (crosshair, filters) in
 * favour of a `<title>` hover/focus tooltip per marker and a sr-only data
 * table, per the dataviz skill's "final accessibility pass" requirement that
 * a table view always exists alongside the visual chart.
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

  const allRows = [...(systolicTrend?.points ?? []), ...(diastolicTrend?.points ?? [])]
    .map((point, index) => ({ ...point, seriesLabel: index < (systolicTrend?.points.length ?? 0) ? t('legend.systolic') : t('legend.diastolic') }));

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

      {/* Decorative relative to the sr-only table below, which carries the same data as real text. */}
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

      {/* Screen-reader table view of the same data — the dataviz skill's accessibility pass requires one alongside every chart. */}
      <table className="sr-only">
        <caption>{t('tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.series')}</th>
            <th scope="col">{t('table.date')}</th>
            <th scope="col">{t('table.value')}</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => (
            <tr key={`${row.seriesLabel}-${row.effectiveAt}`}>
              <td>{row.seriesLabel}</td>
              <td>{dateFormatter.format(new Date(row.effectiveAt))}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
