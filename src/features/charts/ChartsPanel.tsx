import { useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import { useStore } from '../../state/store';
import { useDataset, type Dataset } from '../../state/derive';
import { useFormat, useT, type Format } from '../../i18n';
import type { Dict } from '../../i18n/en';
import { useMedia } from '../../ui/hooks';
import { Panel } from '../../ui/Panel';
import { UChart } from './UChart';
import { readChartColors, withAlpha, type ChartColors } from './theme';
import { Timeline } from '../timeline/Timeline';
import { extent } from '../../model/series';
import './charts.css';

type Num = number | null;

interface ChartDef {
  key: string;
  title: string;
  unit: string;
  height: number;
  data: uPlot.AlignedData;
  options: Omit<uPlot.Options, 'width' | 'height'>;
  summary: string;
}

/** Live charts reach ~90 minutes past the newest sample so the model's lead time is visible. */
const LIVE_LEAD = 90 * 60_000;

// ─── Plugins ─────────────────────────────────────────────────────────────────

/** Cursor line, "now" boundary, and event markers, drawn on the canvas. */
function overlayPlugin(c: ChartColors, getD: () => Dataset, labels: boolean, t: Dict): uPlot.Plugin {
  return {
    hooks: {
      draw: (u) => {
        const ctx = u.ctx;
        const { top, height, left, width } = u.bbox;
        const d = getD();
        const x = (v: number) => Math.round(u.valToPos(v, 'x', true)) + 0.5;
        const px = devicePixelRatio || 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();

        // Future: right of the newest live sample.
        if (d.kind === 'live') {
          const nx = x(d.range[1]);
          ctx.fillStyle = withAlpha(c.text, 0.035);
          ctx.fillRect(nx, top, left + width - nx, height);
          ctx.strokeStyle = c.ruleStrong;
          ctx.lineWidth = px;
          ctx.beginPath();
          ctx.moveTo(nx, top);
          ctx.lineTo(nx, top + height);
          ctx.stroke();
        }

        // Model arrival time for each Earth-bound CME, as a short dashed line from the top.
        for (const cme of d.cmes) {
          if (!cme.dbm) continue;
          const ax = x(cme.dbm.arrival);
          if (ax < left || ax > left + width) continue;
          ctx.strokeStyle = withAlpha(c.model, 0.8);
          ctx.lineWidth = px;
          ctx.setLineDash([3 * px, 3 * px]);
          ctx.beginPath();
          ctx.moveTo(ax, top);
          ctx.lineTo(ax, top + height);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Flares M1 and above as ticks along the top edge.
        for (const f of d.flares) {
          if (f.flux < 1e-5) continue;
          const fx = x(f.peak);
          ctx.fillStyle = f.flux >= 1e-4 ? c.lv[4] : c.sun;
          ctx.fillRect(fx - px, top, 2 * px, 6 * px);
        }

        // Replay landmarks.
        ctx.font = `${10 * px}px ${c.font}`;
        let lastLabelX = -Infinity;
        let row = 0;
        for (const m of d.marks) {
          const mx = x(m.t);
          ctx.strokeStyle = c.text3;
          ctx.setLineDash([2 * px, 4 * px]);
          ctx.beginPath();
          ctx.moveTo(mx, top);
          ctx.lineTo(mx, top + height);
          ctx.stroke();
          ctx.setLineDash([]);
          if (labels) {
            const text = t.replay.marks[m.key as keyof Dict['replay']['marks']] ?? m.key;
            // Step labels down when they would collide with the previous one.
            row = mx - lastLabelX < 110 * px ? (row + 1) % 3 : 0;
            lastLabelX = mx;
            ctx.fillStyle = c.text2;
            ctx.fillText(text, mx + 4 * px, top + (12 + row * 12) * px);
          }
        }

        // Playback cursor.
        const cur = useStore.getState().cursor;
        if (cur != null) {
          const cx = x(cur);
          ctx.strokeStyle = c.sun;
          ctx.lineWidth = 1.5 * px;
          ctx.beginPath();
          ctx.moveTo(cx, top);
          ctx.lineTo(cx, top + height);
          ctx.stroke();
        }
        ctx.restore();
      },
    },
  };
}

/** Horizontal reference lines (zero, thresholds) with optional labels at the right. */
function refLines(lines: { y: number; color: string; label?: string; dash?: boolean }[], c: ChartColors): uPlot.Plugin {
  return {
    hooks: {
      drawAxes: (u) => {
        const ctx = u.ctx;
        const { left, width, top, height } = u.bbox;
        const px = devicePixelRatio || 1;
        ctx.save();
        ctx.font = `${10 * px}px ${c.font}`;
        for (const l of lines) {
          const y = Math.round(u.valToPos(l.y, 'y', true)) + 0.5;
          if (y < top || y > top + height) continue;
          ctx.strokeStyle = l.color;
          ctx.lineWidth = px;
          ctx.setLineDash(l.dash ? [4 * px, 4 * px] : []);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + width, y);
          ctx.stroke();
          if (l.label) {
            ctx.fillStyle = l.color;
            ctx.textAlign = 'right';
            ctx.fillText(l.label, left + width - 4 * px, y - 3 * px);
          }
        }
        ctx.restore();
      },
    },
  };
}

/** Click or drag on a chart to move the cursor there. */
function seekPlugin(getD: () => Dataset): uPlot.Plugin {
  return {
    hooks: {
      ready: (u) => {
        let down = false;
        const seek = (e: PointerEvent) => {
          const d = getD();
          const v = u.posToVal(e.offsetX, 'x');
          const { setCursor, setPlaying } = useStore.getState();
          setPlaying(false);
          const clamped = Math.min(d.range[1], Math.max(d.range[0], v));
          setCursor(d.kind === 'live' && clamped >= d.range[1] - 60_000 ? null : clamped);
        };
        u.over.addEventListener('pointerdown', (e) => {
          down = true;
          u.over.setPointerCapture(e.pointerId);
          seek(e);
        });
        u.over.addEventListener('pointermove', (e) => down && seek(e));
        u.over.addEventListener('pointerup', () => (down = false));
        u.over.addEventListener('pointercancel', () => (down = false));
      },
    },
  };
}

/** Stroke/fill that switches colour at y = 0 (southward vs northward Bz). */
function splitAtZero(u: uPlot, above: string, below: string): CanvasGradient | string {
  const y0 = u.valToPos(0, 'y', true);
  const { top, height } = u.bbox;
  if (!Number.isFinite(y0)) return above;
  const g = u.ctx.createLinearGradient(0, top, 0, top + height);
  const s = Math.min(1, Math.max(0, (y0 - top) / height));
  g.addColorStop(0, above);
  g.addColorStop(s, above);
  g.addColorStop(s, below);
  g.addColorStop(1, below);
  return g;
}

// ─── Chart definitions ───────────────────────────────────────────────────────

function axisX(c: ChartColors, fmt: Format, bottom: boolean): uPlot.Axis {
  return {
    stroke: c.text3,
    font: `11px ${c.font}`,
    grid: { stroke: c.grid, width: 1 },
    ticks: { stroke: c.rule, width: 1, size: bottom ? 4 : 0 },
    size: bottom ? 28 : 6,
    values: bottom
      ? (_u, splits) =>
          splits.map((v) => {
            const dt = new Date(v);
            return dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 ? fmt.date(v) : fmt.time(v);
          })
      : (_u, splits) => splits.map(() => ''),
  };
}

function axisY(c: ChartColors, values?: uPlot.Axis['values']): uPlot.Axis {
  return {
    stroke: c.text3,
    font: `11px ${c.font}`,
    grid: { stroke: c.grid, width: 1 },
    ticks: { show: false },
    size: 54,
    gap: 6,
    values,
  };
}

function baseOptions(
  c: ChartColors,
  fmt: Format,
  getRange: () => [number, number],
  bottom: boolean,
  plugins: uPlot.Plugin[],
): Omit<uPlot.Options, 'width' | 'height' | 'series'> {
  return {
    ms: 1,
    pxAlign: 0,
    cursor: {
      sync: { key: 'hs' },
      drag: { x: false, y: false },
      points: { size: 5, width: 1, stroke: c.text, fill: c.text },
      y: false,
    },
    select: { show: false, left: 0, top: 0, width: 0, height: 0 },
    legend: { show: true, live: true },
    scales: { x: { time: true, range: () => getRange() } },
    axes: [axisX(c, fmt, bottom), axisY(c)],
    plugins,
  };
}

function summarize(t: Dict, fmt: Format, name: string, vals: Num[], digits: number, unit: string): string {
  const e = extent(vals);
  let last: Num = null;
  for (let i = vals.length - 1; i >= 0 && last == null; i--) last = vals[i];
  if (!e || last == null) return `${name}: ${t.readouts.noData}`;
  const f = (v: number) => `${fmt.num(v, digits)} ${unit}`;
  return t.charts.summary(name, f(e[0]), f(e[1]), f(last));
}

function buildCharts(d: Dataset, c: ChartColors, fmt: Format, t: Dict, getD: () => Dataset, getRange: () => [number, number], mobile: boolean): ChartDef[] {
  const h = (n: number) => (mobile ? Math.round(n * 0.78) : n);
  const sw = d.sw;
  const swT = sw?.t ?? [];
  const lastKey = d.kind === 'live' ? 'xray' : 'symh';
  const isBottom = (k: string) => k === lastKey;
  const plugins = (k: string, extra: uPlot.Plugin[] = []) => [
    overlayPlugin(c, getD, k === 'speed', t),
    seekPlugin(getD),
    ...extra,
  ];
  const valueFmt = (digits: number) => (_u: uPlot, v: number | null) => (v == null ? '—' : fmt.num(v, digits));
  const line = (label: string, stroke: string, digits: number, width = 1.25): uPlot.Series => ({
    label,
    stroke,
    width,
    spanGaps: false,
    points: { show: false },
    value: valueFmt(digits),
  });

  const charts: ChartDef[] = [];

  charts.push({
    key: 'speed',
    title: t.charts.speed,
    unit: 'km/s',
    height: h(130),
    data: [swT, sw?.speed ?? []] as uPlot.AlignedData,
    options: {
      ...baseOptions(c, fmt, getRange, isBottom('speed'), plugins('speed')),
      series: [{}, line(t.charts.speed, c.text, 0)],
    },
    summary: summarize(t, fmt, t.charts.speed, sw?.speed ?? [], 0, 'km/s'),
  });

  charts.push({
    key: 'density',
    title: t.charts.density,
    unit: 'p/cm³',
    height: h(100),
    data: [swT, sw?.density ?? []] as uPlot.AlignedData,
    options: {
      ...baseOptions(c, fmt, getRange, isBottom('density'), plugins('density')),
      series: [{}, line(t.charts.density, c.text2, 1)],
    },
    summary: summarize(t, fmt, t.charts.density, sw?.density ?? [], 1, 'p/cm³'),
  });

  charts.push({
    key: 'field',
    title: t.charts.field,
    unit: 'nT',
    height: h(130),
    data: [swT, sw?.bt ?? [], sw?.bz ?? []] as uPlot.AlignedData,
    options: {
      ...baseOptions(c, fmt, getRange, isBottom('field'), plugins('field', [refLines([{ y: 0, color: c.ruleStrong }], c)])),
      series: [
        {},
        line(t.charts.bt, c.text3, 1, 1),
        {
          ...line(t.charts.bz, c.text, 1, 1.25),
          stroke: (u) => splitAtZero(u, c.north, c.south),
          fill: (u) => splitAtZero(u, withAlpha(c.north, 0.1), withAlpha(c.south, 0.22)),
          fillTo: 0,
        },
      ],
    },
    summary: summarize(t, fmt, t.charts.bz, sw?.bz ?? [], 1, 'nT'),
  });

  // Kp: official bars by kind, plus our model as a line.
  const kp = d.kp;
  const obs: Num[] = [];
  const est: Num[] = [];
  const pred: Num[] = [];
  kp?.kind.forEach((k, i) => {
    obs.push(k === 'observed' ? kp.kp[i] : null);
    est.push(k === 'estimated' ? kp.kp[i] : null);
    pred.push(k === 'predicted' ? kp.kp[i] : null);
  });
  const kpTable: uPlot.AlignedData = [kp?.t ?? [], obs, est, pred];
  const modelTable: uPlot.AlignedData = [d.modelKp.t, d.modelKp.kp];
  const kpData = uPlot.join([kpTable, modelTable]);
  const bars = uPlot.paths.bars!({ size: [0.92, Infinity], align: 1 });
  const barSeries = (label: string, fill: string, stroke: string): uPlot.Series => ({
    label,
    fill,
    stroke,
    width: 1,
    paths: bars,
    points: { show: false },
    value: valueFmt(2),
  });
  charts.push({
    key: 'kp',
    title: t.charts.kp,
    unit: '',
    height: h(130),
    data: kpData,
    options: {
      ...baseOptions(
        c,
        fmt,
        getRange,
        isBottom('kp'),
        plugins('kp', [
          refLines(
            [5, 6, 7, 8, 9].map((y, i) => ({
              y: y - 0.34,
              color: withAlpha(c.lv[i + 1], 0.55),
              label: i % 2 === 0 ? `G${i + 1}` : undefined,
              dash: true,
            })),
            c,
          ),
        ]),
      ),
      scales: { x: { time: true, range: () => getRange() }, y: { range: [0, 9] } },
      series: [
        {},
        barSeries(t.charts.observed, withAlpha(c.text2, 0.55), c.text2),
        barSeries(t.charts.estimated, withAlpha(c.sun, 0.35), c.sun),
        barSeries(t.charts.predicted, 'transparent', c.text3),
        { ...line(t.charts.model, c.model, 2, 1.5), spanGaps: true },
      ],
    },
    summary: summarize(t, fmt, t.charts.kp, kp?.kp ?? [], 1, ''),
  });

  if (d.kind === 'live') {
    const x = d.xray;
    const classes: [number, string][] = [
      [1e-8, 'A'],
      [1e-7, 'B'],
      [1e-6, 'C'],
      [1e-5, 'M'],
      [1e-4, 'X'],
    ];
    charts.push({
      key: 'xray',
      title: t.charts.xray,
      unit: 'W/m²',
      height: h(120),
      data: [x?.t ?? [], x?.flux ?? []] as uPlot.AlignedData,
      options: {
        ...baseOptions(c, fmt, getRange, true, plugins('xray', [refLines(classes.map(([y, l]) => ({ y, color: c.rule, label: l })), c)])),
        scales: { x: { time: true, range: () => getRange() }, y: { distr: 3, range: [1e-9, 1e-3] } },
        axes: [axisX(c, fmt, true), axisY(c, (_u, splits) => splits.map((v) => (v ? v.toExponential(0) : '')))],
        series: [{}, { ...line(t.charts.xray, c.sun, 1), value: (_u, v) => (v == null ? '—' : v.toExponential(2)) }],
      },
      summary: summarize(t, fmt, t.charts.xray, x?.flux ?? [], 8, 'W/m²'),
    });
  } else {
    const s = d.symh;
    charts.push({
      key: 'symh',
      title: t.charts.symh,
      unit: 'nT',
      height: h(130),
      data: [s?.t ?? [], s?.v ?? []] as uPlot.AlignedData,
      options: {
        ...baseOptions(
          c,
          fmt,
          getRange,
          true,
          plugins('symh', [
            refLines(
              [
                { y: 0, color: c.ruleStrong },
                { y: -100, color: withAlpha(c.lv[3], 0.6), label: '−100', dash: true },
                { y: -250, color: withAlpha(c.lv[5], 0.6), label: '−250', dash: true },
              ],
              c,
            ),
          ]),
        ),
        series: [{}, { ...line(t.charts.symh, c.text, 0), fill: withAlpha(c.lv[4], 0.12), fillTo: 0 }],
      },
      summary: summarize(t, fmt, t.charts.symh, s?.v ?? [], 0, 'nT'),
    });
  }

  return charts;
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function ChartsPanel() {
  const t = useT();
  const fmt = useFormat();
  const d = useDataset();
  const theme = useStore((s) => s.theme);
  const mobile = useMedia('(max-width: 760px)');

  const dRef = useRef(d);
  dRef.current = d;
  const plots = useRef(new Map<string, uPlot>());

  // Options are rebuilt only for theme, language, layout, or live↔replay changes;
  // new data flows in through setData and the refs below.
  const charts = useMemo(() => {
    const colors = readChartColors();
    const getD = () => dRef.current;
    const getRange = (): [number, number] => {
      const cur = dRef.current;
      return [cur.range[0], cur.range[1] + (cur.kind === 'live' ? LIVE_LEAD : 0)];
    };
    return buildCharts(dRef.current, colors, fmt, t, getD, getRange, mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, fmt, t, mobile, d.kind, d.sw, d.kp, d.modelKp, d.xray, d.symh]);

  // Stable option objects per chart identity so UChart only recreates when needed.
  const optionKey = `${theme}|${fmt.lang}|${mobile}|${d.kind}`;
  const optionsByKey = useMemo(() => {
    const m = new Map<string, ChartDef['options']>();
    charts.forEach((c) => m.set(c.key, c.options));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey]);

  // Redraw cursor overlays when the cursor moves, at most once per frame.
  useEffect(() => {
    let raf = 0;
    let prev = useStore.getState().cursor;
    const unsub = useStore.subscribe((s) => {
      if (s.cursor === prev) return;
      prev = s.cursor;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => plots.current.forEach((u) => u.redraw(false)));
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <Panel
      index="03"
      title={t.charts.title}
      meta={d.kind === 'live' ? `${fmt.dateTime(d.range[0])} – ${fmt.time(d.range[1])} UTC` : `${fmt.fullDate(d.range[0])} – ${fmt.fullDate(d.range[1])}`}
      order={2}
    >
      <div className="charts">
        {charts.map((c) => (
          <figure key={`${c.key}|${optionKey}`} className="chart">
            <figcaption className="chart__head">
              <span className="label">{c.title}</span>
              {c.unit && <span className="chart__unit num">{c.unit}</span>}
            </figcaption>
            <UChart
              options={optionsByKey.get(c.key) ?? c.options}
              data={c.data}
              height={c.height}
              label={c.summary}
              onReady={(u) => (u ? plots.current.set(c.key, u) : plots.current.delete(c.key))}
            />
          </figure>
        ))}
      </div>
      {d.kind === 'live' && <p className="charts__lead note">{t.charts.lead}</p>}
      <Timeline />
    </Panel>
  );
}
