import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ALUMNI_REGIONS } from '@/data/alumni';

const MAP_VIEW_BOX = {
  x: -2.5,
  y: 104.5,
  width: 965,
  height: 503,
};

function toPercentX(x: number) {
  return `${((x - MAP_VIEW_BOX.x) / MAP_VIEW_BOX.width) * 100}%`;
}

function toPercentY(y: number) {
  return `${((y - MAP_VIEW_BOX.y) / MAP_VIEW_BOX.height) * 100}%`;
}

export default function DashboardAlumniPreview() {
  const regions = ALUMNI_REGIONS.filter((region) => region.contacts.length > 0);
  const contacts = regions.flatMap((region) => region.contacts);
  const schoolCount = new Set(contacts.map((contact) => contact.university)).size;
  const cityCount = new Set(contacts.map((contact) => `${contact.country}-${contact.city}`)).size;
  const topRegions = [...regions].sort((a, b) => b.contacts.length - a.contacts.length);

  return (
    <section className="glass-card full-width dashboard-alumni-preview">
      <div className="dashboard-alumni-copy">
        <div className="dashboard-widget-kicker">Alumni Network</div>
        <h3>学长学姐在哪里</h3>
        <p>先看全球分布概览，进入地图页后可以按国家、城市和学校查看校友卡片与联系方式提示。</p>

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

      <Link href="/alumni-map" className="dashboard-alumni-map" aria-label="打开校友地图">
        <div className="dashboard-mini-map-shape is-americas" />
        <div className="dashboard-mini-map-shape is-europe" />
        <div className="dashboard-mini-map-shape is-asia" />
        <div className="dashboard-mini-map-shape is-australia" />

        {topRegions.map((region) => {
          const anchor = region.pin ?? region.labelPoint ?? region.contacts[0]?.mapPoint;
          if (!anchor) return null;

          return (
            <span
              key={region.id}
              className="dashboard-alumni-map-pin"
              style={{
                '--region-color': region.color,
                left: toPercentX(anchor.x),
                top: toPercentY(anchor.y),
              } as CSSProperties}
            >
              <strong>{region.contacts.length}</strong>
              <em>{region.label}</em>
            </span>
          );
        })}
      </Link>
    </section>
  );
}
