import { useEffect, useRef } from 'react';
import { geoCircle, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import landTopo from 'world-atlas/land-110m.json';
import type { Ovation } from '../../data/types';
import type { Place } from '../../state/store';
import { DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG } from '../../model/constants';
import { subsolarPoint } from '../../model/sun-position';

const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
const land = feature(topo, topo.objects.land);

interface Props {
  ovation: Ovation | null;
  place: Place | null;
  viewLat: number | null;
  label: string;
  theme: string;
}

/**
 * Polar orthographic map: OVATION probability cells, coastlines, the night
 * side, the observer, and the forecast view line. Canvas, redrawn only when an
 * input changes.
 */
export function AuroraMap({ ovation, place, viewLat, label, theme }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const host = box.current;
    if (!cv || !host) return;

    const draw = () => {
      const size = Math.min(host.clientWidth, 420);
      if (size <= 0) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = size * dpr;
      cv.height = size * dpr;
      cv.style.width = `${size}px`;
      cv.style.height = `${size}px`;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cs = getComputedStyle(document.documentElement);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      const south = (place?.lat ?? 50) < 0;
      const lon0 = place?.lon ?? 20;
      const proj = geoOrthographic()
        .rotate([-lon0, south ? 90 : -90, 0])
        .clipAngle(68)
        .translate([size / 2, size / 2])
        .scale(size / 2 / Math.sin((68 * Math.PI) / 180));
      const path = geoPath(proj, ctx);

      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = v('--sunken');
      ctx.fill();

      ctx.beginPath();
      path(land);
      ctx.fillStyle = v('--surface-2');
      ctx.fill();

      // Night side: everything more than 90° from the subsolar point.
      const [sLat, sLon] = subsolarPoint(Date.now());
      ctx.beginPath();
      path(geoCircle().center([sLon + 180, -sLat]).radius(90)());
      ctx.fillStyle = theme === 'paper' ? 'rgba(28,25,21,0.10)' : 'rgba(0,0,0,0.35)';
      ctx.fill();

      // Aurora probability.
      if (ovation) {
        const green = v('--lv0');
        const cell = (proj.scale() * Math.PI) / 180;
        for (let lonI = 0; lonI < 360; lonI++) {
          for (let latI = 0; latI <= 180; latI++) {
            const p = ovation.values[lonI * 181 + latI];
            if (p < 4) continue;
            const lat = latI - 90;
            if (south ? lat > -40 : lat < 40) continue;
            const xy = proj([lonI, lat]);
            if (!xy) continue;
            ctx.globalAlpha = Math.min(0.9, 0.15 + p / 60);
            ctx.fillStyle = green;
            const w = Math.max(1.5, cell * Math.cos((lat * Math.PI) / 180) * 1.3);
            ctx.fillRect(xy[0] - w / 2, xy[1] - cell * 0.65, w, cell * 1.3);
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      path(geoGraticule10());
      ctx.strokeStyle = v('--grid-c');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      path(land);
      ctx.strokeStyle = v('--text-3');
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Forecast view line around the geomagnetic pole.
      if (viewLat != null) {
        const pole: [number, number] = south ? [DIPOLE_POLE_LON_DEG + 180, -DIPOLE_POLE_LAT_DEG] : [DIPOLE_POLE_LON_DEG, DIPOLE_POLE_LAT_DEG];
        ctx.beginPath();
        path(geoCircle().center(pole).radius(90 - viewLat)());
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = v('--model');
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.strokeStyle = v('--rule-strong');
      ctx.lineWidth = 1;
      ctx.stroke();

      if (place) {
        const xy = proj([place.lon, place.lat]);
        if (xy) {
          ctx.strokeStyle = v('--sun');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
          ctx.moveTo(xy[0] - 10, xy[1]);
          ctx.lineTo(xy[0] - 6, xy[1]);
          ctx.moveTo(xy[0] + 6, xy[1]);
          ctx.lineTo(xy[0] + 10, xy[1]);
          ctx.moveTo(xy[0], xy[1] - 10);
          ctx.lineTo(xy[0], xy[1] - 6);
          ctx.moveTo(xy[0], xy[1] + 6);
          ctx.lineTo(xy[0], xy[1] + 10);
          ctx.stroke();
        }
      }
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(host);
    return () => ro.disconnect();
  }, [ovation, place, viewLat, theme]);

  return (
    <div ref={box} className="aurora__map">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
