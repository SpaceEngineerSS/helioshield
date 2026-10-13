import { useFormat, useT } from '../../i18n';
import type { Snapshot } from '../../state/derive';
import { EARTH_R, EARTH_X, L1_X, RE, SUN_R, SUN_X, auToX, cmeDirection } from './layout';

/**
 * Flat side view of the same layout as the 3D scene. Used when WebGL is not
 * available or the 3D view is switched off. Costs nothing to keep on screen.
 */
export function SceneSchematic({ snapshot }: { snapshot: Snapshot }) {
  const t = useT();
  const fmt = useFormat();
  // Scene x runs about −8.5 … 10; map to a 760 × 300 viewBox.
  const sx = (x: number) => 30 + ((x + 8.5) / 18.5) * 700;
  const k = 700 / 18.5;
  const cy = 150;
  const mp = snapshot.magnetopause ?? { r0: 10, alpha: 0.58 };

  const shue: string[] = [];
  for (let i = -36; i <= 36; i++) {
    const th = (i / 36) * Math.PI * 0.72;
    const r = mp.r0 * Math.pow(2 / (1 + Math.cos(th)), mp.alpha) * RE;
    shue.push(`${i === -36 ? 'M' : 'L'}${(sx(EARTH_X) - r * Math.cos(th) * k).toFixed(1)},${(cy - r * Math.sin(th) * k).toFixed(1)}`);
  }

  const bz = snapshot.bz;
  const arrowLen = bz == null ? 0 : (0.35 + Math.min(1.6, Math.abs(bz) / 12)) * k;

  return (
    <svg className="scene__svg" viewBox="0 0 760 300" role="img" aria-label={t.scene.title}>
      <line x1={sx(SUN_X + SUN_R)} y1={cy} x2={sx(EARTH_X + 3.5)} y2={cy} stroke="var(--rule-strong)" />
      {Array.from({ length: 10 }, (_, i) => {
        const x = sx(auToX((i + 1) / 10));
        const h = (i + 1) % 5 === 0 ? 8 : 4;
        return <line key={i} x1={x} x2={x} y1={cy - h} y2={cy + h} stroke="var(--rule-strong)" />;
      })}

      {snapshot.cmesInFlight.map(({ track, au }) => {
        const r = Math.max(0, auToX(au) - SUN_X) * k;
        const [dx, , dz] = cmeDirection(track.lat, track.lon);
        const axis = Math.atan2(-dz, dx);
        const half = (Math.min(80, track.halfAngle ?? 45) * Math.PI) / 180;
        const a0 = axis - half;
        const a1 = axis + half;
        const p = (a: number) => `${sx(SUN_X) + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
        return (
          <path
            key={track.id}
            d={`M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}`}
            fill="none"
            stroke="var(--model)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        );
      })}

      <circle cx={sx(SUN_X)} cy={cy} r={SUN_R * k} fill="var(--sun-disc)" />
      <text x={sx(SUN_X)} y={cy + SUN_R * k + 18} textAnchor="middle" className="scene__svgtext">
        {t.scene.sun}
      </text>

      <rect x={sx(L1_X) - 4} y={cy - 4} width="8" height="8" transform={`rotate(45 ${sx(L1_X)} ${cy})`} fill="none" stroke="var(--text)" />
      <text x={sx(L1_X)} y={cy + 24} textAnchor="middle" className="scene__svgtext">
        {t.scene.l1}
      </text>
      {bz != null && (
        <line
          x1={sx(L1_X)}
          y1={cy}
          x2={sx(L1_X)}
          y2={cy - Math.sign(bz || 1) * arrowLen}
          stroke={bz < 0 ? 'var(--south)' : 'var(--north)'}
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
      )}

      <path d={shue.join(' ')} fill="none" stroke="var(--text-3)" strokeDasharray="2 3" />
      <circle cx={sx(EARTH_X)} cy={cy} r={EARTH_R * k} fill="var(--text)" />
      <text x={sx(EARTH_X)} y={cy + EARTH_R * k + 18} textAnchor="middle" className="scene__svgtext">
        {t.scene.earth}
      </text>
      <text x={sx(EARTH_X) - mp.r0 * RE * k} y={cy - mp.r0 * RE * k * 0.75} textAnchor="middle" className="scene__svgtext scene__svgtext--dim">
        {fmt.num(mp.r0, 1)} Rₑ
      </text>

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>
    </svg>
  );
}
