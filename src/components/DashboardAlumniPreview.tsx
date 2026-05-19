import Link from 'next/link';
import type { CSSProperties } from 'react';
import AlumniMapSVG from './AlumniMapSVG';
import { ALUMNI_REGIONS } from '@/data/alumni';

const MAP_VIEW_BOX = '-2.5 104.5 965 503';
const PIN_WIDTH = 86;
const PIN_HEIGHT = 34;

export default function DashboardAlumniPreview() {
  const regions = ALUMNI_REGIONS.filter((region) => region.contacts.length > 0);
  const contacts = regions.flatMap((region) => region.contacts);
  const schoolCount = new Set(contacts.map((contact) => contact.university)).size;
  const cityCount = new Set(contacts.map((contact) => `${contact.country}-${contact.city}`)).size;
  const topRegions = [...regions].sort((a, b) => b.contacts.length - a.contacts.length);

  const previewRegions = topRegions
    .map((region) => ({
      region,
      anchor: region.pin ?? region.labelPoint ?? region.contacts[0]?.mapPoint ?? null,
    }))
    .filter((entry) => entry.anchor);

  return (
    <section className="glass-card full-width dashboard-alumni-preview">
      <Link href="/alumni-map" className="dashboard-alumni-map" aria-label="打开校友地图">
        <AlumniMapSVG className="dashboard-alumni-map-svg" aria-hidden="true" focusable="false" />

        <div className="dashboard-alumni-map-glow" aria-hidden="true" />
        <svg className="dashboard-alumni-map-overlay" viewBox={MAP_VIEW_BOX} aria-hidden="true" focusable="false">
          {previewRegions.map(({ region, anchor }) => (
            <foreignObject
              key={region.id}
              x={anchor.x - PIN_WIDTH / 2}
              y={anchor.y - PIN_HEIGHT / 2}
              width={PIN_WIDTH}
              height={PIN_HEIGHT}
            >
              <div
                className="dashboard-alumni-map-pin"
                style={{ '--region-color': region.color } as CSSProperties}
              >
                <strong>{region.contacts.length}</strong>
                <em>{region.label}</em>
              </div>
            </foreignObject>
          ))}
        </svg>
      </Link>

      <div className="dashboard-alumni-copy">
        <div className="dashboard-widget-kicker">Alumni Network</div>
        <h3>学长学姐在哪里</h3>

        <div className="dashboard-alumni-stats" aria-label="校友地图概览">
          <span><strong>{contacts.length}</strong> 位校友</span>
          <span><strong>{schoolCount}</strong> 所学校</span>
          <span><strong>{cityCount}</strong> 个城市</span>
        </div>

        <div className="dashboard-alumni-region-list" aria-label="校友国家分布">
          {topRegions.map((region) => (
            <span key={region.id} style={{ '--region-color': region.color } as CSSProperties}>
              <i aria-hidden="true" />
              {region.label}
              <strong>{region.contacts.length}</strong>
            </span>
          ))}
        </div>

        <Link href="/alumni-map" className="dashboard-alumni-link">
          查看完整地图 →
        </Link>
      </div>
    </section>
  );
}
