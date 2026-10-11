// "Et si tu avais mis chaque pièce ?" (SPEC §8.4): real balance solid then dashed,
// ghost line dotted, today marker, gap bracket, direct labels, crosshair and tooltip.
import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays, daysBetween } from '../../engine/dates';
import { useI18n } from '../../i18n';
import { monthTicks, niceTicks } from './chartScale';
import type { KidModel } from './model';

const H = 250;
const M = { left: 42, right: 92, top: 22, bottom: 28 };
const MAX_POINTS = 400;
const LABEL_GAP = 30;

export function GhostChart({ model, showGap }: { model: KidModel; showGap: boolean }) {
  const { t, f } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 8));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { start, today, end, mine, ghost } = model.chart;
  const day = model.allowance ? f.weekdayName(model.allowance.weekday) : '';
  const aria = t.kid.chartAria(day, f.dateLong(model.target.date));

  if (width <= M.left + M.right) return <div class="chart" ref={box} />;

  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  let maxV = 0;
  for (let i = 0; i <= end; i++) maxV = Math.max(maxV, mine[i]!, ghost[i]!);
  const ticks = niceTicks(maxV * 1.05);
  const top = ticks.at(-1)!;
  const X = (i: number) => M.left + (end ? (i / end) * iw : 0);
  const Y = (v: number) => M.top + ih - (v / top) * ih;
  const path = (arr: Float64Array, a: number, b: number) => {
    const k = Math.max(1, Math.floor((b - a) / MAX_POINTS));
    let d = '';
    for (let i = a; i <= b; i += k) d += `${d ? 'L' : 'M'}${X(i).toFixed(1)},${Y(arr[i]!).toFixed(1)}`;
    return `${d}L${X(b).toFixed(1)},${Y(arr[b]!).toFixed(1)}`;
  };

  const xt = X(today);
  const ya = Y(mine[today]!);
  const yg = Y(ghost[today]!);
  const eA = Y(mine[end]!);
  const eG = Y(ghost[end]!);
  let lA = eA;
  let lG = eG;
  if (Math.abs(lA - lG) < LABEL_GAP) {
    const mid = (lA + lG) / 2;
    [lG, lA] = eG <= eA ? [mid - LABEL_GAP / 2, mid + LABEL_GAP / 2] : [mid + LABEL_GAP / 2, mid - LABEL_GAP / 2];
  }
  const xe = X(end) + 8;

  const pick = (e: PointerEvent) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
    const rc = svg.getBoundingClientRect();
    const px = ((e.clientX - rc.left) * width) / rc.width;
    setHover(Math.max(0, Math.min(end, Math.round(((px - M.left) / iw) * end))));
  };

  const tipW = tip.current?.offsetWidth ?? 160;
  const tipLeft = hover === null ? 0 : Math.max(4, Math.min(X(hover) + 4 - tipW / 2, width + 8 - tipW - 4));

  return (
    <div class="chart" ref={box}>
      <div class={`tip${hover === null ? '' : ' on'}`} ref={tip} style={{ left: `${tipLeft}px` }} aria-hidden="true">
        {hover !== null && (
          <>
            {f.dateShort(addDays(start, hover))}
            {hover > today && t.kid.tipFuture}
            <br />
            <b>{f.money(mine[hover]!)}</b> {t.kid.tipMine}
            <br />
            <b>{f.money(ghost[hover]!)}</b> {t.kid.tipGhost}
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${H}`} height={H} role="img" aria-label={aria}>
        {ticks.map((v) => (
          <g key={v}>
            <line class="grid" x1={M.left} x2={M.left + iw} y1={Y(v)} y2={Y(v)} />
            <text class="axis" x={M.left - 6} y={Y(v) + 4} text-anchor="end">
              {f.moneyWhole(v)}
            </text>
          </g>
        ))}
        {monthTicks(start, addDays(start, end)).map((d) => (
          <text key={d} class="axis" x={X(daysBetween(start, d))} y={H - 8} text-anchor="middle">
            {f.monthShort(d)}
          </text>
        ))}
        <line class="today-line" x1={xt} x2={xt} y1={M.top - 6} y2={M.top + ih} />
        <text class="today-label" x={xt} y={M.top - 10} text-anchor="middle">
          {t.kid.chartToday}
        </text>
        <path class="line-ghost" d={path(ghost, 0, end)} />
        <path class="line-mine" d={path(mine, 0, today)} />
        <path class="line-mine-future" d={path(mine, today, end)} />
        {showGap && ya - yg > 10 && (
          <>
            <line class="gap-bracket" x1={xt - 6} x2={xt - 6} y1={yg + 3} y2={ya - 3} />
            <text class="gap-label" x={xt - 8} y={yg - 10} text-anchor="end">
              +{f.moneyWhole(ghost[today]! - mine[today]!)}
            </text>
          </>
        )}
        <circle class="dot-ghost" cx={X(end)} cy={eG} r={4} />
        <circle class="dot-mine" cx={X(end)} cy={eA} r={4} />
        <text class="end-label" x={xe} y={lG}>
          <tspan class="end-value" x={xe}>{f.moneyWhole(ghost[end]!)}</tspan>
          <tspan x={xe} dy={13}>{t.kid.chartEndGhost}</tspan>
        </text>
        <text class="end-label" x={xe} y={lA}>
          <tspan class="end-value" x={xe}>{f.moneyWhole(mine[end]!)}</tspan>
          <tspan x={xe} dy={13}>{t.kid.chartEndMine(model.target.age)}</tspan>
        </text>
        {hover !== null && (
          <g>
            <line class="hover-line" x1={X(hover)} x2={X(hover)} y1={M.top} y2={M.top + ih} />
            <circle class="dot-ghost" cx={X(hover)} cy={Y(ghost[hover]!)} r={5} />
            <circle class="dot-mine" cx={X(hover)} cy={Y(mine[hover]!)} r={5} />
          </g>
        )}
        <rect
          class="hit"
          x={M.left}
          y={0}
          width={iw}
          height={H}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
    </div>
  );
}
