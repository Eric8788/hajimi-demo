'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import AlumniMapSVG from './AlumniMapSVG';
import {
  ALUMNI_REGIONS,
  type AlumniContact,
  type AlumniRegion,
  type AlumniRegionId,
} from '@/data/alumni';

const WORLD_VIEW_BOX = { x: 0, y: 230, width: 905, height: 340 };
const MAP_PAN_BOUNDS = WORLD_VIEW_BOX;
const VIEWBOX_ANIMATION_MS = 460;
// mapPoint values are hand-calibrated in the same SVG coordinate space as the
// base map. Lat/lng stay in the data for geography, but drawing uses mapPoint.
const MIN_ZOOM_VIEW_BOX = { width: 28, height: 18 };
const WORLD_SCHOOL_DOT_VIEWBOX_WIDTH = 620;
const DRAG_CLICK_THRESHOLD = 4;
const WORLD_REGION_IDS: AlumniRegionId[] = [
  'united-states',
  'canada',
  'united-kingdom',
  'europe',
  'hong-kong',
  'australia',
];
const REGION_FOCUS_RULES: Partial<Record<AlumniRegionId, {
  minWidth: number;
  minHeight: number;
  paddingX: number;
  paddingY: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  offsetX?: number;
  offsetY?: number;
}>> = {
  'united-states': { minWidth: 205, minHeight: 112, paddingX: 24, paddingY: 22 },
  canada: {
    minWidth: 210,
    minHeight: 140,
    paddingX: 28,
    paddingY: 22,
    viewBox: { x: 76, y: 210, width: 285, height: 175 },
  },
  'united-kingdom': { minWidth: 94, minHeight: 70, paddingX: 18, paddingY: 18, offsetY: -8 },
  'hong-kong': {
    minWidth: 70,
    minHeight: 36,
    paddingX: 12,
    paddingY: 10,
    viewBox: { x: 762, y: 388, width: 44, height: 28 },
  },
  australia: {
    minWidth: 165,
    minHeight: 125,
    paddingX: 30,
    paddingY: 24,
    viewBox: { x: 748, y: 468, width: 157, height: 132 },
  },
};

type AlumniMapPoint = {
  id: string;
  regionId: AlumniRegionId;
  contact: AlumniContact;
  contacts: AlumniContact[];
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  labelDx: number;
  labelDy: number;
};

type MapViewBox = typeof WORLD_VIEW_BOX;
type MapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
};

function formatViewBox(viewBox: MapViewBox) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function isSameViewBox(a: MapViewBox, b: MapViewBox) {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clampViewBox(viewBox: MapViewBox): MapViewBox {
  const width = Math.min(Math.max(viewBox.width, MIN_ZOOM_VIEW_BOX.width), MAP_PAN_BOUNDS.width);
  const height = Math.min(Math.max(viewBox.height, MIN_ZOOM_VIEW_BOX.height), MAP_PAN_BOUNDS.height);
  const maxX = MAP_PAN_BOUNDS.x + MAP_PAN_BOUNDS.width - width;
  const maxY = MAP_PAN_BOUNDS.y + MAP_PAN_BOUNDS.height - height;

  return {
    x: Math.min(Math.max(viewBox.x, MAP_PAN_BOUNDS.x), maxX),
    y: Math.min(Math.max(viewBox.y, MAP_PAN_BOUNDS.y), maxY),
    width,
    height,
  };
}

function zoomViewBoxAt(
  viewBox: MapViewBox,
  factor: number,
  anchor: { xRatio: number; yRatio: number } = { xRatio: 0.5, yRatio: 0.5 },
): MapViewBox {
  const nextWidth = viewBox.width * factor;
  const nextHeight = viewBox.height * factor;
  const anchorX = viewBox.x + viewBox.width * anchor.xRatio;
  const anchorY = viewBox.y + viewBox.height * anchor.yRatio;

  return clampViewBox({
    x: anchorX - nextWidth * anchor.xRatio,
    y: anchorY - nextHeight * anchor.yRatio,
    width: nextWidth,
    height: nextHeight,
  });
}

function isMapInteractiveTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest('.alumni-city-pin, .alumni-map-zoom-controls, button, a, input'));
}

function buildWorldRegions() {
  const regionsById = new Map(ALUMNI_REGIONS.map((region) => [region.id, region]));

  return WORLD_REGION_IDS
    .map((regionId) => regionsById.get(regionId) ?? null)
    .filter((region): region is AlumniRegion => Boolean(region && region.contacts.length > 0));
}

function getContactMapPoint(contact: AlumniContact) {
  return contact.mapPoint;
}

function getRegionFocusViewBox(region: AlumniRegion): MapViewBox {
  if (region.contacts.length === 0) {
    return region.fallbackViewBox;
  }

  const projectedContacts = region.contacts.map(getContactMapPoint);
  const minX = Math.min(...projectedContacts.map((point) => point.x));
  const maxX = Math.max(...projectedContacts.map((point) => point.x));
  const minY = Math.min(...projectedContacts.map((point) => point.y));
  const maxY = Math.max(...projectedContacts.map((point) => point.y));
  const rule = REGION_FOCUS_RULES[region.id] ?? {
    minWidth: region.fallbackViewBox.width,
    minHeight: region.fallbackViewBox.height,
    paddingX: 24,
    paddingY: 20,
  };

  if (rule.viewBox) {
    return clampViewBox(rule.viewBox);
  }

  const width = Math.max(rule.minWidth, maxX - minX + rule.paddingX * 2);
  const height = Math.max(rule.minHeight, maxY - minY + rule.paddingY * 2);
  const centerX = (minX + maxX) / 2 + (rule.offsetX ?? 0);
  const centerY = (minY + maxY) / 2 + (rule.offsetY ?? 0);

  return clampViewBox({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
}

function getTargetViewBox(region: AlumniRegion | null): MapViewBox {
  return region ? getRegionFocusViewBox(region) : WORLD_VIEW_BOX;
}

function getRegionClusterPoint(region: AlumniRegion) {
  if (region.pin) return { x: region.pin.x, y: region.pin.y };
  if (region.labelPoint) return region.labelPoint;
  if (region.contacts.length === 0) return null;

  const projectedContacts = region.contacts.map(getContactMapPoint);
  const x = projectedContacts.reduce((sum, point) => sum + point.x, 0) / projectedContacts.length;
  const y = projectedContacts.reduce((sum, point) => sum + point.y, 0) / projectedContacts.length;

  return { x, y };
}

function getSchoolPoints(
  contacts: AlumniContact[],
  selectedAlumniId: string | null,
  regionId: AlumniRegionId,
): AlumniMapPoint[] {
  const groups = new Map<string, AlumniContact[]>();

  contacts.forEach((contact) => {
    const key = `${contact.university}-${contact.campus}`;
    groups.set(key, [...(groups.get(key) ?? []), contact]);
  });

  const points = Array.from(groups.entries()).map(([id, group], index) => {
    const anchor = group[0];
    const selectedContact = group.find((contact) => contact.alumniId === selectedAlumniId) ?? anchor;
    const projectedPoint = getContactMapPoint(anchor);

    return {
      id,
      regionId,
      contact: selectedContact,
      contacts: group,
      anchorX: projectedPoint.x,
      anchorY: projectedPoint.y,
      x: projectedPoint.x,
      y: projectedPoint.y,
      labelDx: anchor.mapPoint.labelDx ?? (index % 2 === 0 ? 14 : -46),
      labelDy: anchor.mapPoint.labelDy ?? -14,
    };
  });

  return points;
}

export default function AlumniWorldMap() {
  const worldRegions = useMemo(() => buildWorldRegions(), []);
  const worldRegionById = useMemo(
    () => new Map(worldRegions.map((region) => [region.id, region])),
    [worldRegions],
  );
  const [selectedRegionId, setSelectedRegionId] = useState<AlumniRegionId | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<AlumniRegionId | null>(null);
  const [selectedAlumniId, setSelectedAlumniId] = useState<string | null>(null);
  const [animatedViewBox, setAnimatedViewBox] = useState<MapViewBox>(WORLD_VIEW_BOX);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const animatedViewBoxRef = useRef<MapViewBox>(WORLD_VIEW_BOX);
  const viewBoxAnimationRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef<MapDragState | null>(null);
  const suppressNextClickRef = useRef(false);

  const selectedRegion = useMemo(
    () => worldRegions.find((region) => region.id === selectedRegionId) ?? null,
    [selectedRegionId, worldRegions],
  );

  const selectedAlumni = useMemo(() => {
    if (!selectedRegion) return null;
    return selectedRegion.contacts.find((contact) => contact.alumniId === selectedAlumniId) ?? null;
  }, [selectedAlumniId, selectedRegion]);

  const currentPoints = useMemo(() => {
    if (!selectedRegion) return [];
    return getSchoolPoints(selectedRegion.contacts, selectedAlumniId, selectedRegion.id);
  }, [selectedAlumniId, selectedRegion]);

  const worldSchoolPoints = useMemo(
    () => worldRegions.flatMap((region) => getSchoolPoints(region.contacts, selectedAlumniId, region.id)),
    [selectedAlumniId, worldRegions],
  );

  const selectedPoint = useMemo(() => {
    if (!selectedAlumni) return null;
    return currentPoints.find((point) =>
      point.contacts.some((contact) => contact.alumniId === selectedAlumni.alumniId),
    ) ?? null;
  }, [currentPoints, selectedAlumni]);

  const totalContacts = worldRegions.reduce((sum, region) => sum + region.contacts.length, 0);
  const totalSchools = getUniqueCountFromContacts(
    worldRegions.flatMap((region) => region.contacts),
    'university',
  );
  const totalCities = getUniqueCountFromContacts(
    worldRegions.flatMap((region) => region.contacts),
    'city',
  );
  const isWorldAtHome = !selectedRegion && isSameViewBox(animatedViewBox, WORLD_VIEW_BOX);
  const isWorldExploring = !selectedRegion && !isWorldAtHome;
  const shouldShowWorldSchoolDots = !selectedRegion && animatedViewBox.width <= WORLD_SCHOOL_DOT_VIEWBOX_WIDTH;

  const animateViewBoxTo = useCallback((targetViewBox: MapViewBox) => {
    cancelAnimationFrame(viewBoxAnimationRef.current);

    const from = animatedViewBoxRef.current;
    const to = clampViewBox(targetViewBox);
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / VIEWBOX_ANIMATION_MS);
      const eased = easeInOutCubic(progress);
      const next = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        width: from.width + (to.width - from.width) * eased,
        height: from.height + (to.height - from.height) * eased,
      };

      const normalizedNext = clampViewBox(next);

      setAnimatedViewBox(normalizedNext);
      animatedViewBoxRef.current = normalizedNext;

      if (progress < 1) {
        viewBoxAnimationRef.current = requestAnimationFrame(tick);
      } else {
        animatedViewBoxRef.current = normalizedNext;
      }
    };

    viewBoxAnimationRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animateViewBoxTo(getTargetViewBox(selectedRegion));
  }, [animateViewBoxTo, selectedRegion]);

  useEffect(() => {
    return () => cancelAnimationFrame(viewBoxAnimationRef.current);
  }, []);

  const selectRegion = (region: AlumniRegion) => {
    setSelectedRegionId(region.id);
    setSelectedAlumniId(null);
  };

  const selectWorldSchoolPoint = (point: AlumniMapPoint) => {
    setSelectedRegionId(point.regionId);
    setSelectedAlumniId(point.contact.alumniId);
  };

  const resetWorld = () => {
    if (!selectedRegionId) {
      animateViewBoxTo(WORLD_VIEW_BOX);
    }
    setSelectedRegionId(null);
    setHoveredRegionId(null);
    setSelectedAlumniId(null);
  };

  const findRegionFromTarget = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    const regionId = element?.closest('[data-region]')?.getAttribute('data-region') as AlumniRegionId | null;

    return regionId ? worldRegionById.get(regionId) ?? null : null;
  };

  const zoomIn = () => {
    animateViewBoxTo(zoomViewBoxAt(animatedViewBoxRef.current, 0.82));
  };

  const zoomOut = () => {
    animateViewBoxTo(zoomViewBoxAt(animatedViewBoxRef.current, 1.18));
  };

  const fitSelectedRegion = () => {
    animateViewBoxTo(getTargetViewBox(selectedRegion));
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as Element;
    if (isMapInteractiveTarget(target)) return;

    const clickedRegion = findRegionFromTarget(target);
    if (clickedRegion) {
      selectRegion(clickedRegion);
      return;
    }

    if (!selectedRegion) {
      return;
    }

    resetWorld();
  };

  const handleMapSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    const clickedRegion = findRegionFromTarget(event.target);
    if (!clickedRegion) return;

    event.stopPropagation();
    selectRegion(clickedRegion);
  };

  const handleMapSvgPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const hoveredRegion = findRegionFromTarget(event.target);
    setHoveredRegionId(hoveredRegion?.id ?? null);
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isMapInteractiveTarget(event.target)) return;

    cancelAnimationFrame(viewBoxAnimationRef.current);
    mapDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      moved: false,
    };
    setIsDraggingMap(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleStageTouchMove = (event: globalThis.TouchEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
    };

    stage.addEventListener('touchmove', handleStageTouchMove, { passive: false });
    return () => {
      stage.removeEventListener('touchmove', handleStageTouchMove);
    };
  }, []);

  const handleStagePointerMoveWithinMap = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = mapDragRef.current;
    if (dragState?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();

      const stage = stageRef.current;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const deltaX = event.clientX - dragState.lastClientX;
      const deltaY = event.clientY - dragState.lastClientY;
      const totalDeltaX = event.clientX - dragState.startClientX;
      const totalDeltaY = event.clientY - dragState.startClientY;
      const currentViewBox = animatedViewBoxRef.current;
      const nextViewBox = clampViewBox({
        ...currentViewBox,
        x: currentViewBox.x - (deltaX / rect.width) * currentViewBox.width,
        y: currentViewBox.y - (deltaY / rect.height) * currentViewBox.height,
      });

      dragState.lastClientX = event.clientX;
      dragState.lastClientY = event.clientY;
      dragState.moved =
        dragState.moved ||
        Math.hypot(totalDeltaX, totalDeltaY) > DRAG_CLICK_THRESHOLD;

      setAnimatedViewBox(nextViewBox);
      animatedViewBoxRef.current = nextViewBox;
      setHoveredRegionId(null);
      return;
    }

    if (isMapInteractiveTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();

    const hoveredRegion = findRegionFromTarget(event.target);
    setHoveredRegionId(hoveredRegion?.id ?? null);
  };

  const finishMapDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = mapDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    suppressNextClickRef.current = dragState.moved;
    mapDragRef.current = null;
    setIsDraggingMap(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const regionClass = selectedRegionId ? ` active-region-${selectedRegionId}` : '';
  const hoveredClass = hoveredRegionId ? ` hovered-region-${hoveredRegionId}` : '';
  const availableRegionClass = worldRegions.map((region) => ` has-region-${region.id}`).join('');
  const exploringClass = isWorldExploring ? ' is-map-exploring' : '';
  const worldDotsClass = shouldShowWorldSchoolDots ? ' show-world-school-dots' : '';
  const draggingClass = isDraggingMap ? ' is-dragging-map' : '';

  return (
    <section className="glass-card full-width alumni-map-panel" aria-labelledby="alumni-map-title">
      <div className="alumni-map-header">
        <div>
          <div className="alumni-map-title-row">
            <h3 id="alumni-map-title">学长学姐在哪里</h3>
          </div>
          <p><strong>AI Club Network</strong> · 探索全球校友分布，连接校友资源</p>
        </div>
        <div className="alumni-map-actions">
          <button type="button" className="alumni-map-share-button">
            分享地图
          </button>
          <div className="alumni-map-total" aria-label={`已登记校友 ${totalContacts} 位`}>
            <span className="alumni-map-avatar-stack" aria-hidden="true">
              {worldRegions.flatMap((region) => region.contacts).slice(0, 3).map((contact) => (
                <i key={contact.alumniId}>{getInitial(contact)}</i>
              ))}
            </span>
            <span>已登记校友</span>
            <strong>{totalContacts} 位</strong>
          </div>
        </div>
      </div>

      <div className={`alumni-map-shell${selectedRegion ? ' is-zoomed' : ' is-world'}`}>
        <div className="alumni-map-content-grid">
          <div className="alumni-map-main">
            <div
              ref={stageRef}
              className={`alumni-map-stage${availableRegionClass}${regionClass}${hoveredClass}${exploringClass}${worldDotsClass}${draggingClass}`}
              onClick={handleStageClick}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMoveWithinMap}
              onPointerUp={finishMapDrag}
              onPointerCancel={finishMapDrag}
              onPointerLeave={(event) => {
                finishMapDrag(event);
                setHoveredRegionId(null);
              }}
            >
              <AlumniMapSVG
                className="alumni-map-base alumni-map-inline"
                viewBox={formatViewBox(animatedViewBox)}
                onClick={handleMapSvgClick}
                onPointerMove={handleMapSvgPointerMove}
                onPointerLeave={() => setHoveredRegionId(null)}
              />

              <svg className="alumni-map-overlay" viewBox={formatViewBox(animatedViewBox)} aria-label="校友地图点位">
                {!selectedRegion && (
                  <>
                    <g>
                      {worldRegions.map((region) => (
                        <RegionCluster
                          key={region.id}
                          region={region}
                          isHovered={hoveredRegionId === region.id}
                          onSelect={() => selectRegion(region)}
                          onHover={setHoveredRegionId}
                          viewBoxWidth={animatedViewBox.width}
                        />
                      ))}
                    </g>
                    <g className="alumni-world-school-points" aria-hidden={!shouldShowWorldSchoolDots}>
                      {worldSchoolPoints.map((point) => {
                        const region = worldRegionById.get(point.regionId);
                        if (!region) return null;

                        return (
                          <AlumniPoint
                            key={point.id}
                            point={point}
                            region={region}
                            isSelected={point.contacts.some((contact) => contact.alumniId === selectedAlumniId)}
                            onSelect={() => selectWorldSchoolPoint(point)}
                            viewBoxWidth={animatedViewBox.width}
                            showLabelOnVisible
                          />
                        );
                      })}
                    </g>
                  </>
                )}
                {selectedRegion && (
                  <g>
                    {currentPoints.map((point) => (
                      <AlumniPoint
                        key={point.id}
                        point={point}
                        region={selectedRegion}
                        isSelected={point.contacts.some((contact) => contact.alumniId === selectedAlumniId)}
                        onSelect={() => setSelectedAlumniId(point.contact.alumniId)}
                      />
                    ))}
                  </g>
                )}
              </svg>

              <div className="alumni-map-zoom-controls" aria-label="地图缩放控制">
                <button type="button" className="alumni-map-zoom-button" onClick={zoomIn} aria-label="放大地图">
                  +
                </button>
                <button type="button" className="alumni-map-zoom-button" onClick={zoomOut} aria-label="缩小地图">
                  -
                </button>
                <button type="button" className="alumni-map-zoom-fit" onClick={fitSelectedRegion} disabled={!selectedRegion && isWorldAtHome}>
                  适配
                </button>
              </div>

            </div>

            {!selectedRegion && (
              <div className="alumni-map-stat-strip" aria-label="校友地图统计">
                <MapStat icon="👥" label="全球校友" value={`${totalContacts}`} suffix="人" />
                <MapStat icon="🏙️" label="国家/地区" value={`${worldRegions.length}`} suffix="个" />
                <MapStat icon="🏫" label="学校" value={`${totalSchools}`} suffix="所" />
                <MapStat icon="📍" label="城市" value={`${totalCities}`} suffix="个" />
              </div>
            )}
          </div>

          <AlumniInfoPanel
            worldRegions={worldRegions}
            selectedRegion={selectedRegion}
            selectedAlumni={selectedAlumni}
            relatedContacts={selectedPoint?.contacts ?? []}
            onSelectRegion={selectRegion}
            onHoverRegion={setHoveredRegionId}
            onSelectContact={setSelectedAlumniId}
            onBackToRegion={() => setSelectedAlumniId(null)}
            onBackToWorld={resetWorld}
          />
        </div>
      </div>
    </section>
  );
}

type MapStatProps = {
  icon: string;
  label: string;
  value: string;
  suffix: string;
};

function MapStat({ icon, label, value, suffix }: MapStatProps) {
  return (
    <div className="alumni-map-stat">
      <span aria-hidden="true">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}<em>{suffix}</em></strong>
      </div>
    </div>
  );
}

type RegionClusterProps = {
  region: AlumniRegion;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (regionId: AlumniRegionId | null) => void;
  viewBoxWidth: number;
};

function RegionCluster({ region, isHovered, onSelect, onHover, viewBoxWidth }: RegionClusterProps) {
  const point = getRegionClusterPoint(region);
  if (!point) return null;

  const x = point.x;
  const y = point.y;
  const markerScale = Math.max(0.28, Math.min(1, viewBoxWidth / WORLD_VIEW_BOX.width));
  const ringRadius = 34 * markerScale;
  const coreRadius = 16 * markerScale;
  const countOffsetY = 4 * markerScale;
  const labelOffsetY = 55 * markerScale;
  const countFontSize = 17 * markerScale;
  const labelFontSize = 20 * markerScale;

  return (
    <g
      className={`alumni-region-cluster${isHovered ? ' is-hovered' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${region.label}，${region.contacts.length} 位校友`}
      onClick={onSelect}
      onMouseEnter={() => onHover(region.id)}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <circle className="alumni-region-cluster-ring" cx={x} cy={y} r={ringRadius} fill={region.fill} stroke={region.color} />
      <circle className="alumni-region-cluster-core" cx={x} cy={y} r={coreRadius} fill={region.color} />
      <text
        className="alumni-region-cluster-count"
        x={x}
        y={y + countOffsetY}
        style={{ fontSize: `${countFontSize}px`, strokeWidth: `${1.2 * markerScale}px` }}
      >
        {region.contacts.length}
      </text>
      <text
        className="alumni-region-cluster-label"
        x={x}
        y={y + labelOffsetY}
        style={{ fontSize: `${labelFontSize}px`, strokeWidth: `${5 * markerScale}px` }}
      >
        {region.label}
      </text>
    </g>
  );
}

type AlumniPointProps = {
  point: AlumniMapPoint;
  region: AlumniRegion;
  isSelected: boolean;
  onSelect: () => void;
  viewBoxWidth?: number;
  showLabelOnVisible?: boolean;
};

function AlumniPoint({
  point,
  region,
  isSelected,
  onSelect,
  viewBoxWidth,
  showLabelOnVisible = false,
}: AlumniPointProps) {
  const baseViewBoxWidth = viewBoxWidth ?? getRegionFocusViewBox(region).width;
  const markerScale = Math.max(0.11, Math.min(0.24, baseViewBoxWidth / WORLD_VIEW_BOX.width));
  const labelX = point.x + point.labelDx * markerScale;
  const labelY = point.y + point.labelDy * markerScale;
  const haloRadius = 20 * markerScale;
  const ringRadius = 13 * markerScale;
  const coreRadius = 7.4 * markerScale;
  const logoSize = 18 * markerScale;
  const hitRadius = Math.max(10 * markerScale, coreRadius + 2 * markerScale);
  const labelFontSize = 13 * markerScale;
  const labelStrokeWidth = 3.4 * markerScale;
  const countFontSize = 9 * markerScale;
  const countX = point.x + 9 * markerScale;
  const countY = point.y - 9 * markerScale;
  const countBadgeRadius = 5.6 * markerScale;
  const logoFallbackFontSize = Math.min(5.2, Math.max(3.4, 24 / point.contact.universityAbbr.length)) * markerScale;

  return (
    <g
      className={`alumni-city-pin${isSelected ? ' is-selected' : ''}${showLabelOnVisible ? ' show-label' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${point.contact.name}，${point.contact.university}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }
      }}
    >
      <circle className="alumni-city-pin-hit-area" cx={point.x} cy={point.y} r={hitRadius} fill="transparent" />
      <circle className="alumni-city-pin-halo" cx={point.x} cy={point.y} r={haloRadius} fill="white" />
      <circle className="alumni-city-pin-ring" cx={point.x} cy={point.y} r={ringRadius} fill="white" />
      <circle className="alumni-city-pin-core" cx={point.x} cy={point.y} r={coreRadius} fill="white" />
      <clipPath id={`logo-clip-${point.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}>
        <circle cx={point.x} cy={point.y} r={coreRadius * 0.92} />
      </clipPath>
      <image
        className="alumni-city-pin-logo"
        href={point.contact.logoUrl}
        x={point.x - logoSize / 2}
        y={point.y - logoSize / 2}
        width={logoSize}
        height={logoSize}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#logo-clip-${point.id.replace(/[^a-zA-Z0-9_-]/g, '-')})`}
      />
      <text
        className="alumni-city-pin-logo-fallback"
        x={point.x}
        y={point.y + 1.5 * markerScale}
        style={{ fontSize: `${logoFallbackFontSize}px` }}
      >
        {point.contact.universityAbbr}
      </text>
      {point.contacts.length > 1 && (
        <>
          <circle className="alumni-city-pin-count-badge" cx={countX} cy={countY} r={countBadgeRadius} fill={region.color} />
          <text
            className="alumni-city-pin-count"
            x={countX}
            y={countY + 2.8 * markerScale}
            style={{ fontSize: `${countFontSize}px` }}
          >
            {point.contacts.length}
          </text>
        </>
      )}
      <text
        className="alumni-city-pin-label"
        x={labelX}
        y={labelY}
        style={{ fontSize: `${labelFontSize}px`, strokeWidth: `${labelStrokeWidth}px` }}
      >
        {point.contact.universityAbbr}
      </text>
    </g>
  );
}

type AlumniInfoPanelProps = {
  worldRegions: AlumniRegion[];
  selectedRegion: AlumniRegion | null;
  selectedAlumni: AlumniContact | null;
  relatedContacts: AlumniContact[];
  onSelectRegion: (region: AlumniRegion) => void;
  onHoverRegion: (regionId: AlumniRegionId | null) => void;
  onSelectContact: (alumniId: string) => void;
  onBackToRegion: () => void;
  onBackToWorld: () => void;
};

function AlumniInfoPanel({
  worldRegions,
  selectedRegion,
  selectedAlumni,
  relatedContacts,
  onSelectRegion,
  onHoverRegion,
  onSelectContact,
  onBackToRegion,
  onBackToWorld,
}: AlumniInfoPanelProps) {
  if (!selectedRegion) {
    return (
      <aside className="alumni-info-stack" aria-label="校友地图概览">
        <section className="alumni-info-panel alumni-ranking-panel">
          <div className="alumni-panel-title-row">
            <h4>校友分布排行</h4>
            <span>{worldRegions.length} 个地区</span>
          </div>

          <div className="alumni-country-list">
            {worldRegions
              .slice()
              .sort((a, b) => b.contacts.length - a.contacts.length)
              .map((region, index) => (
                <button
                  key={region.id}
                  type="button"
                  className="alumni-country-row"
                  style={{ '--accent': region.color } as CSSProperties}
                  onClick={() => onSelectRegion(region)}
                  onMouseEnter={() => onHoverRegion(region.id)}
                  onMouseLeave={() => onHoverRegion(null)}
                >
                  <span className="alumni-country-rank">{index + 1}</span>
                  <span className="alumni-country-copy">
                    <strong>{region.label}</strong>
                    <small>{formatRegionMeta(region)}</small>
                  </span>
                  <span className="alumni-country-count" aria-label={`${region.contacts.length}`}>
                    <strong>{region.contacts.length}</strong>
                  </span>
                </button>
              ))}
          </div>
        </section>

        <section className="alumni-info-panel alumni-hot-panel">
          <div className="alumni-panel-title-row">
            <h4>热门城市</h4>
            <span>按人数排序</span>
          </div>
          <div className="alumni-hot-city-grid">
            {getHotCities(worldRegions).map((city) => (
              <button
                key={city.name}
                type="button"
                className="alumni-hot-city"
                style={{ '--accent': city.color } as CSSProperties}
                onClick={() => onSelectRegion(city.region)}
                onMouseEnter={() => onHoverRegion(city.region.id)}
                onMouseLeave={() => onHoverRegion(null)}
              >
                <strong>{city.name}</strong>
                <span>{city.count} 人</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    );
  }

  const regionSchools = getUniqueCount(selectedRegion.contacts, 'university');
  const regionCities = getUniqueCount(selectedRegion.contacts, 'city');

  if (selectedAlumni) {
    return (
      <aside
        className="alumni-info-panel is-detail"
        style={{ '--accent': selectedRegion.color } as CSSProperties}
        aria-label={`${selectedAlumni.name}校友详情`}
      >
        <button type="button" className="alumni-info-back" onClick={onBackToRegion}>
          返回{selectedRegion.label}校友列表
        </button>
        <AlumniDetailCard
          contact={selectedAlumni}
          relatedContacts={relatedContacts}
          onSelectContact={onSelectContact}
        />
      </aside>
    );
  }

  return (
    <aside
      className="alumni-info-panel"
      style={{ '--accent': selectedRegion.color } as CSSProperties}
      aria-label={`${selectedRegion.label}校友信息`}
    >
      <div className="alumni-info-region-top">
        <PanelHeader
          eyebrow={selectedRegion.groupLabel}
          title={`${selectedRegion.label}校友`}
          description={selectedRegion.summary}
        />
        <button type="button" className="alumni-info-back" onClick={onBackToWorld}>
          返回全球概览
        </button>
      </div>

      <div className="alumni-region-summary-line">
        <span>{selectedRegion.contacts.length} 位学长学姐 · {regionSchools} 所学校 · {regionCities} 个城市</span>
      </div>

      <div className="alumni-info-section-head">
        <span>选择学长学姐</span>
        <small>{selectedRegion.contacts.length} 位</small>
      </div>

      <div className="alumni-contact-list">
        {selectedRegion.contacts.map((contact) => (
          <button
            key={contact.alumniId}
            type="button"
            className="alumni-contact-row"
            onClick={() => onSelectContact(contact.alumniId)}
          >
            <span className="alumni-contact-mini-avatar" aria-hidden="true">
              {getInitial(contact)}
            </span>
            <span className="alumni-contact-row-copy">
              <strong>{contact.name}</strong>
              <small>{contact.universityAbbr} · {contact.major}</small>
              <em>{formatLocation(contact)}</em>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

type PanelHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function PanelHeader({ eyebrow, title, description }: PanelHeaderProps) {
  return (
    <div className="alumni-info-panel-head">
      <span>{eyebrow}</span>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

function getUniqueCount(contacts: AlumniContact[], field: 'university' | 'city' | 'state' | 'country') {
  return new Set(contacts.map((contact) => contact[field]).filter(Boolean)).size;
}

function getUniqueCountFromContacts(contacts: AlumniContact[], field: 'university' | 'city' | 'state' | 'country') {
  return getUniqueCount(contacts, field);
}

function getHotCities(worldRegions: AlumniRegion[]) {
  const cities = new Map<string, { name: string; count: number; region: AlumniRegion; color: string; order: number }>();
  let nextOrder = 0;

  worldRegions.forEach((region) => {
    region.contacts.forEach((contact) => {
      const current = cities.get(contact.city);
      if (current) {
        current.count += 1;
      } else {
        cities.set(contact.city, {
          name: contact.city,
          count: 1,
          region,
          color: region.color,
          order: nextOrder,
        });
        nextOrder += 1;
      }
    });
  });

  return Array.from(cities.values())
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, 6);
}

function formatRegionMeta(region: AlumniRegion) {
  const schoolCount = getUniqueCount(region.contacts, 'university');
  const cityCount = getUniqueCount(region.contacts, 'city');
  const firstContact = region.contacts[0];

  if (firstContact && schoolCount === 1) {
    return `${firstContact.universityAbbr} · ${firstContact.city}`;
  }

  return `${schoolCount} 所学校 · ${cityCount} 个城市`;
}

function getInitial(contact: AlumniContact) {
  return contact.name.charAt(0).toUpperCase();
}

function formatLocation(contact: AlumniContact) {
  return `${contact.city}${contact.state ? ` · ${contact.state}` : ''}`;
}

type AlumniDetailCardProps = {
  contact: AlumniContact;
  relatedContacts: AlumniContact[];
  onSelectContact: (alumniId: string) => void;
};

function AlumniDetailCard({ contact, relatedContacts, onSelectContact }: AlumniDetailCardProps) {
  return (
    <article className="alumni-detail-card" aria-live="polite">
      <div className="alumni-card-region-row">
        <span>{contact.country}</span>
        <strong>{contact.graduationYear} 届</strong>
      </div>

      <div className="alumni-card-head">
        <div className="alumni-card-avatar" aria-hidden="true">
          {getInitial(contact)}
        </div>
        <div>
          <h4>{contact.name}</h4>
          <p>{contact.universityAbbr} · {contact.major}</p>
        </div>
      </div>

      {relatedContacts.length > 1 && (
        <div className="alumni-card-switcher" aria-label={`${contact.university} 的校友`}>
          {relatedContacts.map((relatedContact) => (
            <button
              key={relatedContact.alumniId}
              type="button"
              className={relatedContact.alumniId === contact.alumniId ? 'is-selected' : ''}
              onClick={() => onSelectContact(relatedContact.alumniId)}
            >
              {relatedContact.name}
            </button>
          ))}
        </div>
      )}

      <dl className="alumni-card-facts">
        <div>
          <dt>学校</dt>
          <dd>{contact.university}</dd>
        </div>
        <div>
          <dt>位置</dt>
          <dd>{formatLocation(contact)}</dd>
        </div>
        <div>
          <dt>校区</dt>
          <dd>{contact.campus}</dd>
        </div>
      </dl>

      <div className="alumni-card-footer">
        {contact.rankType && contact.rankValue ? (
          <span className="alumni-rank-pill">{contact.rankType.replace('世界大学排名', '')} Top {contact.rankValue}</span>
        ) : (
          <span className="alumni-rank-pill is-muted">排名信息待补充</span>
        )}
        <span className="alumni-contact-pill">联系请咨询指导老师</span>
      </div>
    </article>
  );
}
