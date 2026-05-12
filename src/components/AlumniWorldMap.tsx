'use client';

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import AlumniMapSVG from './AlumniMapSVG';
import {
  ALUMNI_REGIONS,
  DEFAULT_ALUMNI_REGION_ID,
  type AlumniRegion,
  type AlumniRegionId,
} from '@/data/alumni';

function isSelectKey(event: KeyboardEvent<SVGElement>) {
  return event.key === 'Enter' || event.key === ' ';
}

export default function AlumniWorldMap() {
  const [selectedId, setSelectedId] = useState<AlumniRegionId>(DEFAULT_ALUMNI_REGION_ID);
  const [hoveredId, setHoveredId] = useState<AlumniRegionId | null>(null);

  const selectedRegion = useMemo(
    () => ALUMNI_REGIONS.find((region) => region.id === selectedId) ?? ALUMNI_REGIONS[0],
    [selectedId],
  );

  const activeRegionId = hoveredId ?? selectedId;

  const totalContacts = ALUMNI_REGIONS.reduce((sum, region) => sum + region.contacts.length, 0);
  const areaRegions = ALUMNI_REGIONS.filter((region) => region.shapePath);
  const pinRegions = ALUMNI_REGIONS.filter((region) => region.pin);

  const selectRegion = (regionId: AlumniRegionId) => {
    setSelectedId(regionId);
  };

  const handleKeyboardSelect = (event: KeyboardEvent<SVGElement>, regionId: AlumniRegionId) => {
    if (!isSelectKey(event)) return;
    event.preventDefault();
    selectRegion(regionId);
  };

  const handleHover = (regionId: AlumniRegionId | null) => {
    setHoveredId(regionId);
  };

  return (
    <section className="glass-card full-width alumni-map-panel" aria-labelledby="alumni-map-title">
      <div className="alumni-map-header">
        <div>
          <div className="alumni-map-kicker">AI Club Network</div>
          <h3 id="alumni-map-title">校友世界地图</h3>
          <p>把常见留学区域里的学长学姐联系入口收拢到 Home，后续可逐步接入真实登记数据。</p>
        </div>
        <div className="alumni-map-total" aria-label={`当前已登记 ${totalContacts} 位联系人`}>
          <strong>{totalContacts}</strong>
          <span>已登记联系人</span>
        </div>
      </div>

      <div className="alumni-map-layout">
        <div className="alumni-map-main">
          <div 
            className={`alumni-map-stage active-region-${selectedId} ${hoveredId ? `hovered-region-${hoveredId}` : ''}`}
            onClick={(e) => {
              const target = e.target as SVGElement;
              const region = target.getAttribute('data-region') as AlumniRegionId | null;
              if (region) {
                selectRegion(region);
              }
            }}
            onMouseMove={(e) => {
              const target = e.target as SVGElement;
              const region = target.getAttribute('data-region') as AlumniRegionId | null;
              if (region !== hoveredId) {
                setHoveredId(region);
              }
            }}
            onMouseLeave={() => setHoveredId(null)}
          >
            <AlumniMapSVG className="alumni-map-base alumni-map-inline" />
            <svg
              className="alumni-map-overlay"
              viewBox="0 0 2000 857"
              role="img"
              aria-label="AI Club 校友留学区域地图"
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                <filter id="alumni-region-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#6c5ce7" floodOpacity="0.25" />
                </filter>
                <filter id="alumni-pin-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ffffff" floodOpacity="0.85" />
                  <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#6c5ce7" floodOpacity="0.28" />
                </filter>
              </defs>

              {areaRegions.map((region) => {
                const isActive = region.id === activeRegionId;

                return (
                  <g key={region.id} className="alumni-map-region-group">
                    <path
                      d={region.shapePath}
                      className={`alumni-map-region-surface${isActive ? ' is-active' : ''}`}
                      data-region={region.id}
                      onClick={() => selectRegion(region.id)}
                    />
                  </g>
                );
              })}

              {pinRegions.map((region) => (
                <AlumniMapPin
                  key={region.id}
                  region={region}
                  isSelected={region.id === selectedId}
                  onSelect={selectRegion}
                  onKeyboardSelect={handleKeyboardSelect}
                  onHover={handleHover}
                />
              ))}
            </svg>
          </div>

          <div className="alumni-region-strip" aria-label="校友区域列表">
            {ALUMNI_REGIONS.map((region) => (
              <button
                key={region.id}
                type="button"
                className={`alumni-region-chip${region.id === selectedId ? ' is-selected' : ''}${region.id === hoveredId ? ' is-hovered' : ''}`}
                style={{ '--alumni-region-color': region.color } as CSSProperties}
                onClick={() => selectRegion(region.id)}
                onMouseEnter={() => setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-pressed={region.id === selectedId}
              >
                <span>{region.label}</span>
                <small>{region.contacts.length ? `${region.contacts.length} 位` : '收集中'}</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="alumni-map-detail" aria-live="polite">
          <div className="alumni-detail-heading">
            <span
              className="alumni-detail-dot"
              style={{ background: selectedRegion.color }}
              aria-hidden="true"
            />
            <div>
              <h4>{selectedRegion.label}</h4>
              <p>{selectedRegion.summary}</p>
            </div>
          </div>

          <p className="alumni-detail-description">{selectedRegion.description}</p>

          <div className="alumni-contact-head">
            <span>联系人</span>
            <strong>{selectedRegion.contacts.length}</strong>
          </div>

          {selectedRegion.contacts.length > 0 ? (
            <div className="alumni-contact-list">
              {selectedRegion.contacts.map((contact) => (
                <article key={`${contact.name}-${contact.email ?? contact.wechat ?? contact.location}`} className="alumni-contact-item">
                  <div>
                    <h5>{contact.name}</h5>
                    <p>{contact.location}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>学校</dt>
                      <dd>{contact.school}</dd>
                    </div>
                    <div>
                      <dt>专业/方向</dt>
                      <dd>{contact.program}</dd>
                    </div>
                    <div>
                      <dt>届别</dt>
                      <dd>{contact.year}</dd>
                    </div>
                    <div>
                      <dt>简介</dt>
                      <dd>{contact.note}</dd>
                    </div>
                    {contact.wechat ? (
                      <div>
                        <dt>微信</dt>
                        <dd>{contact.wechat}</dd>
                      </div>
                    ) : null}
                    {contact.email ? (
                      <div>
                        <dt>邮箱</dt>
                        <dd>{contact.email}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="alumni-empty-state">
              <strong>联系人收集中</strong>
              <p>该区域还没有公开登记的学长学姐联系方式。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

type AlumniMapPinProps = {
  region: AlumniRegion;
  isSelected: boolean;
  onSelect: (regionId: AlumniRegionId) => void;
  onKeyboardSelect: (event: KeyboardEvent<SVGElement>, regionId: AlumniRegionId) => void;
  onHover: (regionId: AlumniRegionId | null) => void;
};

function AlumniMapPin({ region, isSelected, onSelect, onKeyboardSelect, onHover }: AlumniMapPinProps) {
  if (!region.pin) return null;

  const { pin } = region;

  return (
    <g
      className={`alumni-map-pin${isSelected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${region.label}校友区域`}
      onClick={() => onSelect(region.id)}
      onKeyDown={(event) => onKeyboardSelect(event, region.id)}
    >
      <path
        className="alumni-map-pin-line"
        d={`M${pin.x} ${pin.y} C${pin.x + 28} ${pin.y - 8}, ${pin.labelX - 42} ${pin.labelY}, ${pin.labelX - 8} ${pin.labelY}`}
      />
      <g
        className="alumni-map-pin-label-group"
        onMouseEnter={() => onHover(region.id)}
        onMouseLeave={() => onHover(null)}
        data-region={region.id}
        style={{ cursor: 'pointer' }}
      >
        <rect
          className="alumni-map-pin-label"
          x={pin.labelX - 74}
          y={pin.labelY - 24}
          width="88"
          height="36"
          rx="18"
          fill={isSelected ? region.activeFill : 'rgba(255,255,255,0.82)'}
          stroke={region.color}
        />
        <text className="alumni-map-pin-text" x={pin.labelX - 30} y={pin.labelY - 1}>
          {region.shortLabel}
        </text>
      </g>
      <circle className="alumni-map-pin-halo" cx={pin.x} cy={pin.y} r="20" fill={region.fill} />
      <circle className="alumni-map-pin-core" cx={pin.x} cy={pin.y} r="8" fill={region.color} />
    </g>
  );
}
