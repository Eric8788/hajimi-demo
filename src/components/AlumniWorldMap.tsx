'use client';

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import AlumniMapSVG from './AlumniMapSVG';
import {
  ALUMNI_REGIONS,
  DEFAULT_ALUMNI_REGION_ID,
  type AlumniRegion,
  type AlumniRegionId,
  type AlumniContact,
} from '@/data/alumni';

function isSelectKey(event: KeyboardEvent<SVGElement | HTMLElement>) {
  return event.key === 'Enter' || event.key === ' ';
}

export default function AlumniWorldMap() {
  const [selectedId, setSelectedId] = useState<AlumniRegionId>(DEFAULT_ALUMNI_REGION_ID);
  const [hoveredId, setHoveredId] = useState<AlumniRegionId | null>(null);
  const [selectedAlumniId, setSelectedAlumniId] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => ALUMNI_REGIONS.find((region) => region.id === selectedId) ?? ALUMNI_REGIONS[0],
    [selectedId],
  );

  const activeRegionId = hoveredId ?? selectedId;

  const totalContacts = ALUMNI_REGIONS.reduce((sum, region) => sum + region.contacts.length, 0);

  // Reset selected alumni when region changes
  useMemo(() => {
    setSelectedAlumniId(null);
  }, [selectedId]);

  // Calculate unique schools and locations for the selected region
  const selectedStats = useMemo(() => {
    const schools = new Set(selectedRegion.contacts.map((c) => c.university));
    const cities = new Set(selectedRegion.contacts.map((c) => c.city));
    return {
      schoolCount: schools.size,
      locationCount: cities.size,
      locationList: Array.from(cities).join(', '),
    };
  }, [selectedRegion]);

  const areaRegions = ALUMNI_REGIONS.filter((region) => region.shapePath);
  const pinRegions = ALUMNI_REGIONS.filter((region) => region.pin);

  const selectRegion = (regionId: AlumniRegionId) => {
    setSelectedId(regionId);
    setSelectedAlumniId(null);
  };

  const handleKeyboardSelect = (event: KeyboardEvent<SVGElement>, regionId: AlumniRegionId) => {
    if (!isSelectKey(event)) return;
    event.preventDefault();
    selectRegion(regionId);
  };

  const handleHover = (regionId: AlumniRegionId | null) => {
    setHoveredId(regionId);
  };

  const selectedAlumni = selectedRegion.contacts.find((c) => c.alumniId === selectedAlumniId);

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

              {/* Render Map Badges for regions with contacts */}
              {ALUMNI_REGIONS.map((region) => {
                if (region.contacts.length === 0 && region.id !== 'united-states') return null; // Only show populated or default
                return (
                  <RegionBadge
                    key={`badge-${region.id}`}
                    region={region}
                    isSelected={region.id === selectedId}
                    isHovered={region.id === hoveredId}
                    onSelect={() => selectRegion(region.id)}
                    onHover={() => handleHover(region.id)}
                  />
                );
              })}
            </svg>
          </div>

          <div className="alumni-region-strip" aria-label="校友区域列表">
            {ALUMNI_REGIONS.map((region) => (
              <button
                key={region.id}
                type="button"
                className={`alumni-region-chip${region.id === selectedId ? ' is-selected' : ''}${
                  region.id === hoveredId ? ' is-hovered' : ''
                }`}
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
          {selectedAlumni ? (
            /* =========================================
               DETAIL VIEW: Individual Alumni Profile
               ========================================= */
            <div className="alumni-profile-view">
              <button
                className="alumni-back-btn"
                onClick={() => setSelectedAlumniId(null)}
                aria-label="返回列表"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                返回区域列表
              </button>

              <div className="alumni-profile-header">
                <div className="alumni-profile-avatar" style={{ '--accent': selectedRegion.color } as CSSProperties}>
                  {selectedAlumni.name.charAt(0)}
                </div>
                <div className="alumni-profile-title">
                  <h2>{selectedAlumni.name}</h2>
                  <span className="alumni-grad-year">{selectedAlumni.graduationYear} 届</span>
                </div>
              </div>

              <div className="alumni-profile-content">
                <div className="alumni-info-group">
                  <dt>录取院校</dt>
                  <dd>
                    <strong>{selectedAlumni.university}</strong>
                    <span className="info-subtext">({selectedAlumni.universityAbbr})</span>
                  </dd>
                </div>
                <div className="alumni-info-group">
                  <dt>专业</dt>
                  <dd>{selectedAlumni.major}</dd>
                </div>
                <div className="alumni-info-group">
                  <dt>位置与校区</dt>
                  <dd>
                    {selectedAlumni.city}, {selectedAlumni.state ? `${selectedAlumni.state}, ` : ''}{selectedAlumni.country}
                    <br />
                    <span className="info-subtext">{selectedAlumni.campus}</span>
                  </dd>
                </div>
                {selectedAlumni.rankType && selectedAlumni.rankValue && (
                  <div className="alumni-info-group">
                    <dt>院校排名</dt>
                    <dd className="alumni-rank-badge">
                      <span className="rank-type">{selectedAlumni.rankType}</span>
                      <span className="rank-value">Top {selectedAlumni.rankValue}</span>
                    </dd>
                  </div>
                )}
                
                <div className="alumni-contact-callout">
                  <p>如需获取更多联系方式，请咨询社团指导老师。</p>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================
               LIST VIEW: Region Overview & Compact List
               ========================================= */
            <div className="alumni-list-view">
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
                  <label>分布城市</label>
                  <strong title={selectedStats.locationList}>{selectedStats.locationCount}</strong>
                </div>
              </div>

              <div className="alumni-contact-section">
                <div className="alumni-contact-head">
                  <span>校友列表 ({selectedRegion.contacts.length})</span>
                </div>

                {selectedRegion.contacts.length > 0 ? (
                  <ul className="alumni-compact-list">
                    {selectedRegion.contacts.map((contact) => (
                      <li key={contact.alumniId}>
                        <button
                          className="alumni-compact-card"
                          onClick={() => setSelectedAlumniId(contact.alumniId)}
                          style={{ '--accent': selectedRegion.color } as CSSProperties}
                        >
                          <div className="alumni-compact-avatar">
                            {contact.name.charAt(0)}
                          </div>
                          <div className="alumni-compact-info">
                            <h5>{contact.name}</h5>
                            <span className="alumni-compact-school">{contact.universityAbbr} · {contact.major}</span>
                          </div>
                          <svg className="alumni-compact-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="alumni-empty-state">
                    <p>该区域校友信息正在收集中...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// Component: Region Badge
// Displays Name and Count directly on the SVG map
// -------------------------------------------------------------
type RegionBadgeProps = {
  region: AlumniRegion;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
};

function RegionBadge({ region, isSelected, isHovered, onSelect, onHover }: RegionBadgeProps) {
  // Use labelPoint if available, otherwise use pin position with a slight offset
  const pt = region.labelPoint || (region.pin ? { x: region.pin.x, y: region.pin.y - 20 } : null);
  if (!pt) return null;

  // Don't render badge if it's a pin region, because pins already have their own label
  // Wait, the requirement said "上面不同板块显示名字/人数". Let's show badges for ALL, 
  // but maybe hide the old pin labels if they overlap. For now, we render the badge.
  // Let's position it slightly differently for pin regions to avoid overlap.
  const badgeY = region.pin ? pt.y - 30 : pt.y;
  
  // Calculate text dimensions roughly
  const textCount = `${region.contacts.length} 人`;
  const labelWidth = Math.max(60, region.label.length * 16 + 20);

  return (
    <g
      className={`alumni-map-badge ${isSelected ? 'is-selected' : ''}`}
      transform={`translate(${pt.x}, ${badgeY})`}
      onMouseEnter={onHover}
      onMouseLeave={onHover} // Wait, onLeave should clear hover, but passing onHover here might set it to the region.
      // We will rely on the map's mouse events, but pointer-events: auto on the badge
      data-region={region.id}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <rect
        x={-labelWidth / 2}
        y={-20}
        width={labelWidth}
        height={40}
        rx={8}
        fill={isSelected ? region.color : 'rgba(255,255,255,0.9)'}
        stroke={isSelected ? '#fff' : region.color}
        strokeWidth={2}
        className="alumni-badge-bg"
      />
      <text
        y={-3}
        className="alumni-badge-title"
        fill={isSelected ? '#fff' : '#1f2937'}
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
      >
        {region.label}
      </text>
      <text
        y={12}
        className="alumni-badge-count"
        fill={isSelected ? 'rgba(255,255,255,0.9)' : '#64748b'}
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
      >
        {textCount}
      </text>
    </g>
  );
}

// -------------------------------------------------------------
// Component: Pin
// -------------------------------------------------------------
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
      {/* 
         Removed the old pin label rect/text since we are now using the universal RegionBadge.
         Kept the line pointing from the pin to where the badge would be if needed, but it might be redundant.
         Actually, let's keep the core and halo, and remove the line to keep it clean.
      */}
      <circle className="alumni-map-pin-halo" cx={pin.x} cy={pin.y} r="20" fill={region.fill} />
      <circle className="alumni-map-pin-core" cx={pin.x} cy={pin.y} r="8" fill={region.color} />
    </g>
  );
}

