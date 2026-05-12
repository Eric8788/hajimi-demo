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
  const [alumniIndex, setAlumniIndex] = useState(0);

  const selectedRegion = useMemo(
    () => ALUMNI_REGIONS.find((region) => region.id === selectedId) ?? ALUMNI_REGIONS[0],
    [selectedId],
  );

  const activeRegionId = hoveredId ?? selectedId;

  const totalContacts = ALUMNI_REGIONS.reduce((sum, region) => sum + region.contacts.length, 0);
  
  // Reset index when region changes
  useMemo(() => {
    setAlumniIndex(0);
  }, [selectedId]);

  // Calculate unique schools and locations for the selected region
  const selectedStats = useMemo(() => {
    const schools = new Set(selectedRegion.contacts.map(c => c.school));
    const locations = new Set(selectedRegion.contacts.map(c => c.location));
    return {
      schoolCount: schools.size,
      locationCount: locations.size,
      locationList: Array.from(locations).join(', ')
    };
  }, [selectedRegion]);

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

  const handlePrevAlumni = () => {
    setAlumniIndex((prev) => (prev > 0 ? prev - 1 : selectedRegion.contacts.length - 1));
  };

  const handleNextAlumni = () => {
    setAlumniIndex((prev) => (prev < selectedRegion.contacts.length - 1 ? prev + 1 : 0));
  };

  return (
    <section className="glass-card full-width alumni-map-panel" aria-labelledby="alumni-map-title">
      <div className="alumni-map-header">
        <div>
          <div className="alumni-map-kicker">AI Club Network</div>
          <h3 id="alumni-map-title">校友世界地图</h3>
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

          <div className="alumni-detail-stats">
            <div className="alumni-stat-item">
              <label>涵盖学校</label>
              <strong>{selectedStats.schoolCount}</strong>
            </div>
            <div className="alumni-stat-item">
              <label>分布位置</label>
              <strong title={selectedStats.locationList}>{selectedStats.locationCount}</strong>
            </div>
          </div>

          <div className="alumni-contact-section">
            <div className="alumni-contact-head">
              <span>联系人</span>
              <div className="alumni-carousel-nav">
                <strong>{selectedRegion.contacts.length > 0 ? alumniIndex + 1 : 0}</strong>
                <span className="nav-divider">/</span>
                <span>{selectedRegion.contacts.length}</span>
                {selectedRegion.contacts.length > 1 && (
                  <div className="nav-buttons">
                    <button onClick={handlePrevAlumni} aria-label="上一个校友">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button onClick={handleNextAlumni} aria-label="下一个校友">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedRegion.contacts.length > 0 ? (
              <div className="alumni-carousel-container">
                {selectedRegion.contacts.map((contact, index) => (
                  <article 
                    key={`${contact.name}-${index}`} 
                    className={`alumni-contact-card ${index === alumniIndex ? 'is-active' : 'is-hidden'}`}
                  >
                    <div className="alumni-card-header">
                      <div className="alumni-avatar-placeholder">
                        <span className="school-logo-text">{contact.school.charAt(0)}</span>
                      </div>
                      <div className="alumni-basic-info">
                        <h5>{contact.name}</h5>
                        <p className="alumni-location-tag">{contact.location}</p>
                      </div>
                    </div>
                    
                    <div className="alumni-card-body">
                      <dl className="alumni-info-grid">
                        <div className="info-cell">
                          <dt>学校</dt>
                          <dd>{contact.school}</dd>
                        </div>
                        <div className="info-cell">
                          <dt>专业/方向</dt>
                          <dd>{contact.program}</dd>
                        </div>
                        <div className="info-cell">
                          <dt>届别</dt>
                          <dd>{contact.year}</dd>
                        </div>
                        <div className="info-cell full-width">
                          <dt>简介</dt>
                          <dd>{contact.note}</dd>
                        </div>
                        {contact.wechat && (
                          <div className="info-cell">
                            <dt>微信</dt>
                            <dd>{contact.wechat}</dd>
                          </div>
                        )}
                        {contact.email && (
                          <div className="info-cell">
                            <dt>邮箱</dt>
                            <dd>{contact.email}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="alumni-empty-state">
                <p>该区域校友信息正在收集中...</p>
              </div>
            )}
          </div>
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
