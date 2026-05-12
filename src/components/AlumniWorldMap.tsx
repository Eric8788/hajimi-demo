'use client';

import { useMemo, useState, useEffect, type CSSProperties, type KeyboardEvent } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Annotation,
  ZoomableGroup
} from 'react-simple-maps';
import {
  ALUMNI_REGIONS,
  DEFAULT_ALUMNI_REGION_ID,
  type AlumniRegion,
  type AlumniRegionId,
  type AlumniContact,
} from '@/data/alumni';

// TopoJSON URL for the world map
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function AlumniWorldMap() {
  const [selectedId, setSelectedId] = useState<AlumniRegionId>(DEFAULT_ALUMNI_REGION_ID);
  const [hoveredId, setHoveredId] = useState<AlumniRegionId | null>(null);
  const [selectedAlumniId, setSelectedAlumniId] = useState<string | null>(null);
  
  // State for map zoom and center
  const [mapPosition, setMapPosition] = useState({
    coordinates: [-10, 20] as [number, number],
    zoom: 1.2
  });

  const selectedRegion = useMemo(
    () => ALUMNI_REGIONS.find((region) => region.id === selectedId) ?? ALUMNI_REGIONS[0],
    [selectedId],
  );

  const totalContacts = ALUMNI_REGIONS.reduce((sum, region) => sum + region.contacts.length, 0);

  // Stats for the selected region
  const selectedStats = useMemo(() => {
    const schools = new Set(selectedRegion.contacts.map((c) => c.university));
    const cities = new Set(selectedRegion.contacts.map((c) => c.city));
    return {
      schoolCount: schools.size,
      locationCount: cities.size,
      locationList: Array.from(cities).join(', '),
    };
  }, [selectedRegion]);

  // Update map position when selection changes
  useEffect(() => {
    if (selectedId) {
      setMapPosition({
        coordinates: selectedRegion.center,
        zoom: selectedRegion.zoom
      });
    }
  }, [selectedId, selectedRegion]);

  const selectRegion = (regionId: AlumniRegionId) => {
    setSelectedId(regionId);
    setSelectedAlumniId(null);
  };

  const handleMoveEnd = (position: { coordinates: [number, number], zoom: number }) => {
    setMapPosition(position);
  };

  // Helper to find region by ISO code
  const getRegionByIso = (iso: string): AlumniRegion | undefined => {
    return ALUMNI_REGIONS.find(r => r.countryCodes.includes(iso));
  };

  const selectedAlumni = selectedRegion.contacts.find((c) => c.alumniId === selectedAlumniId);

  return (
    <section className="glass-card full-width alumni-map-panel" aria-labelledby="alumni-map-title">
      <div className="alumni-map-header">
        <div>
          <div className="alumni-map-kicker">AI Club Network</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 id="alumni-map-title" style={{ margin: 0 }}>校友世界地图</h3>
            <span className="alumni-total-pill">
              共 {totalContacts} 位学长学姐
            </span>
          </div>
        </div>
        
        {/* Reset Zoom Button */}
        <button 
          className="alumni-map-reset-btn"
          onClick={() => setMapPosition({ coordinates: [-10, 20], zoom: 1.2 })}
        >
          重置视角
        </button>
      </div>

      <div className="alumni-map-layout">
        <div className="alumni-map-main">
          <div className="alumni-map-stage">
            <ComposableMap
              projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
              width={800}
              height={450}
              style={{ width: "100%", height: "auto" }}
            >
              <ZoomableGroup
                zoom={mapPosition.zoom}
                center={mapPosition.coordinates}
                onMoveEnd={handleMoveEnd}
                maxZoom={20}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const region = getRegionByIso(geo.properties.iso_a2 || geo.id);
                      const isSelected = region?.id === selectedId;
                      const isHovered = region?.id === hoveredId;
                      const hasContacts = (region?.contacts.length ?? 0) > 0;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() => region && setHoveredId(region.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => region && selectRegion(region.id)}
                          style={{
                            default: {
                              fill: region ? (isSelected ? region.activeFill : (hasContacts ? region.fill : "#EAEAEC")) : "#F5F5F7",
                              stroke: region ? (isSelected ? region.color : (hasContacts ? region.color : "#D6D6DA")) : "#D6D6DA",
                              strokeWidth: isSelected ? 1 : 0.5,
                              outline: "none",
                              transition: "all 250ms",
                              cursor: region ? "pointer" : "default"
                            },
                            hover: {
                              fill: region ? region.activeFill : "#F5F5F7",
                              stroke: region ? region.color : "#D6D6DA",
                              strokeWidth: 1,
                              outline: "none",
                              cursor: region ? "pointer" : "default"
                            },
                            pressed: {
                              fill: region ? region.activeFill : "#F5F5F7",
                              stroke: region ? region.color : "#D6D6DA",
                              strokeWidth: 1,
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>

                {/* Region Labels (only show when zoomed out or based on importance) */}
                {ALUMNI_REGIONS.filter(r => r.contacts.length > 0).map(region => (
                  <Marker key={`label-${region.id}`} coordinates={region.center}>
                    <text
                      textAnchor="middle"
                      y={-15}
                      style={{
                        fontFamily: "inherit",
                        fontSize: "12px",
                        fontWeight: "bold",
                        fill: region.color,
                        pointerEvents: "none",
                        paintOrder: "stroke",
                        stroke: "#fff",
                        strokeWidth: 3,
                        opacity: mapPosition.zoom > 3 ? 0 : 1
                      }}
                    >
                      {region.label}
                    </text>
                  </Marker>
                ))}

                {/* School Markers (only show when zoomed in) */}
                {selectedRegion.contacts.map((contact) => (
                  <Marker 
                    key={contact.alumniId} 
                    coordinates={[contact.lng, contact.lat]}
                    onClick={() => setSelectedAlumniId(contact.alumniId)}
                  >
                    <g
                      style={{
                        cursor: "pointer",
                        opacity: mapPosition.zoom > 2 ? 1 : 0,
                        transition: "opacity 300ms"
                      }}
                    >
                      <circle r={5 / (mapPosition.zoom * 0.5)} fill={selectedRegion.color} stroke="#fff" strokeWidth={1 / mapPosition.zoom} />
                      <circle r={10 / (mapPosition.zoom * 0.5)} fill={selectedRegion.color} opacity={0.3} />
                    </g>
                    {mapPosition.zoom > 5 && (
                      <text
                        textAnchor="middle"
                        y={-10 / (mapPosition.zoom * 0.5)}
                        style={{
                          fontSize: `${10 / (mapPosition.zoom * 0.3)}px`,
                          fill: "#333",
                          fontWeight: "bold",
                          paintOrder: "stroke",
                          stroke: "#fff",
                          strokeWidth: 2,
                          pointerEvents: "none"
                        }}
                      >
                        {contact.universityAbbr}
                      </text>
                    )}
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
            
            {/* Zoom Controls Overlay */}
            <div className="alumni-map-zoom-controls">
              <button onClick={() => setMapPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }))}>+</button>
              <button onClick={() => setMapPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }))}>−</button>
            </div>
          </div>

          <div className="alumni-region-strip">
            {ALUMNI_REGIONS.filter((r) => r.contacts.length > 0).map((region) => (
              <button
                key={region.id}
                type="button"
                className={`alumni-region-chip${region.id === selectedId ? ' is-selected' : ''}`}
                style={{ '--alumni-region-color': region.color } as CSSProperties}
                onClick={() => selectRegion(region.id)}
              >
                <span>{region.label}</span>
                <small>{region.contacts.length} 位</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="alumni-map-detail">
          {selectedAlumni ? (
            <div className="alumni-profile-view">
              <button
                className="alumni-back-btn"
                onClick={() => setSelectedAlumniId(null)}
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
            <div className="alumni-list-view">
              <div className="alumni-detail-heading">
                <span
                  className="alumni-detail-dot"
                  style={{ background: selectedRegion.color }}
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
                  <span>学长学姐在这里 ({selectedRegion.contacts.length})</span>
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

