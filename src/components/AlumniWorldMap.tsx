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
const MAP_PAN_BOUNDS = { x: 0, y: 210, width: 920, height: 405 };
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
const REGION_HIT_AREAS: Partial<Record<AlumniRegionId, Array<{
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
} | {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}>>> = {
  'united-states': [
    { type: 'rect', x: 148, y: 306, width: 166, height: 94 },
    { type: 'ellipse', cx: 114, cy: 246, rx: 120, ry: 58 },
    { type: 'ellipse', cx: 53, cy: 403, rx: 22, ry: 12 },
  ],
  canada: [
    { type: 'rect', x: 112, y: 230, width: 205, height: 96 },
    { type: 'ellipse', cx: 232, cy: 172, rx: 120, ry: 86 },
  ],
  'united-kingdom': [
    { type: 'ellipse', cx: 463, cy: 295, rx: 28, ry: 46 },
  ],
  'hong-kong': [
    { type: 'ellipse', cx: 780, cy: 403, rx: 18, ry: 14 },
  ],
  australia: [
    { type: 'ellipse', cx: 832, cy: 544, rx: 82, ry: 62 },
  ],
};
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
const SCHOOL_FOCUS_RULES: Partial<Record<AlumniRegionId, {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
}>> = {
  'united-states': { width: 108, height: 70 },
  canada: { width: 112, height: 78 },
  'united-kingdom': { width: 58, height: 42 },
  'hong-kong': { width: 34, height: 22 },
  australia: { width: 96, height: 68 },
  europe: { width: 96, height: 68 },
};
const SCHOOL_LOGO_SOURCES: Record<string, string> = {
  Cardiff: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cardiff%20University%20(logo).svg',
  Duke: 'https://commons.wikimedia.org/wiki/Special:FilePath/Duke%20Athletics%20logo.svg',
  HKU: 'https://www.hku.hk/assets/img/hku-115.svg',
  Oxford: 'https://commons.wikimedia.org/wiki/Special:FilePath/University%20of%20Oxford.svg',
  UBC: 'https://commons.wikimedia.org/wiki/Special:FilePath/British%20columbia%20ca%20univ%20logo.svg',
  'UC Davis': 'https://commons.wikimedia.org/wiki/Special:FilePath/UC%20Davis%20wordmark.svg',
  UCL: '/alumni-logos/ucl.svg',
  UCSD: 'https://commons.wikimedia.org/wiki/Special:FilePath/University%20of%20California%2C%20San%20Diego%20logo.svg',
  UIUC: 'https://commons.wikimedia.org/wiki/Special:FilePath/University%20of%20Illinois%20at%20Urbana%E2%80%93Champaign%20logo.svg',
  'UNC-Chapel Hill': 'https://commons.wikimedia.org/wiki/Special:FilePath/North%20Carolina%20Tar%20Heels%20logo.svg',
  USC: 'https://commons.wikimedia.org/wiki/Special:FilePath/University%20of%20Southern%20California%20logo.svg',
  USYD: 'https://www.sydney.edu.au/content/dam/icons/logos/logo-usyd-dark.svg',
  'UW Seattle': 'https://commons.wikimedia.org/wiki/Special:FilePath/Washington%20Huskies%20logo.svg',
};
const SCHOOL_MAP_LOGO_SOURCES: Record<string, string> = {
  Cardiff: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shield%20of%20the%20University%20of%20Cardiff.svg',
  Duke: 'https://commons.wikimedia.org/wiki/Special:FilePath/Duke%20Blue%20Devils%20logo.svg',
  HKU: '/alumni-logos/hku-shield.png',
  Oxford: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coat%20of%20arms%20of%20the%20University%20of%20Oxford.svg',
  UBC: 'https://commons.wikimedia.org/wiki/Special:FilePath/British_columbia_univ_coat_arms.svg',
  'UC Davis': 'https://commons.wikimedia.org/wiki/Special:FilePath/UC%20Davis%20Aggies%20logo.svg',
  UCL: '/alumni-logos/ucl.svg',
  UCSD: 'https://commons.wikimedia.org/wiki/Special:FilePath/Seal%20of%20the%20University%20of%20California%2C%20San%20Diego.svg',
  UIUC: 'https://commons.wikimedia.org/wiki/Special:FilePath/Illinois%20Fighting%20Illini%20logo.svg',
  USC: 'https://commons.wikimedia.org/wiki/Special:FilePath/USC%20Trojans%20logo.svg',
  USYD: 'https://commons.wikimedia.org/wiki/Special:FilePath/Arms%20of%20Sydney.svg',
};
const SCHOOL_MAP_FAN_OUT: Record<string, { x: number; y: number }> = {
  Duke: { x: -1.4, y: -1.2 },
  'UNC-Chapel Hill': { x: 1.4, y: 1.2 },
  USC: { x: -0.35, y: -0.25 },
  UCSD: { x: 0.35, y: 0.25 },
};
function getSchoolLogoUrl(contact: AlumniContact) {
  return SCHOOL_LOGO_SOURCES[contact.universityAbbr] ?? contact.logoUrl;
}

function getMapSchoolLogoUrl(contact: AlumniContact) {
  return SCHOOL_MAP_LOGO_SOURCES[contact.universityAbbr] ?? getSchoolLogoUrl(contact);
}

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
type HotSchool = {
  key: string;
  university: string;
  universityAbbr: string;
  campus: string;
  city: string;
  count: number;
  region: AlumniRegion;
  firstContact: AlumniContact;
  color: string;
  order: number;
};

type MapViewBox = typeof WORLD_VIEW_BOX;
type MapDragState = {
  pointerId: number;
  startRegionId: AlumniRegionId | null;
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

function getSchoolFocusViewBox(region: AlumniRegion, point: AlumniMapPoint): MapViewBox {
  const regionViewBox = getRegionFocusViewBox(region);
  const rule = SCHOOL_FOCUS_RULES[region.id];
  const fallbackWidth = Math.max(MIN_ZOOM_VIEW_BOX.width, regionViewBox.width * 0.52);
  const fallbackHeight = Math.max(MIN_ZOOM_VIEW_BOX.height, regionViewBox.height * 0.56);
  const width = Math.min(regionViewBox.width, Math.max(MIN_ZOOM_VIEW_BOX.width, rule?.width ?? fallbackWidth));
  const height = Math.min(regionViewBox.height, Math.max(MIN_ZOOM_VIEW_BOX.height, rule?.height ?? fallbackHeight));
  const centerX = point.x + (rule?.offsetX ?? 0);
  const centerY = point.y + (rule?.offsetY ?? 0);

  return clampViewBox({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
}

function getCurrentTargetViewBox(
  region: AlumniRegion | null,
  selectedPoint: AlumniMapPoint | null,
): MapViewBox {
  if (region && selectedPoint) {
    return getSchoolFocusViewBox(region, selectedPoint);
  }

  return getTargetViewBox(region);
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
    const fanOut = SCHOOL_MAP_FAN_OUT[anchor.universityAbbr] ?? { x: 0, y: 0 };

    return {
      id,
      regionId,
      contact: selectedContact,
      contacts: group,
      anchorX: projectedPoint.x,
      anchorY: projectedPoint.y,
      x: projectedPoint.x + fanOut.x,
      y: projectedPoint.y + fanOut.y,
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
  const targetViewBox = useMemo(
    () => getCurrentTargetViewBox(selectedRegion, selectedPoint),
    [selectedPoint, selectedRegion],
  );

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
    animateViewBoxTo(targetViewBox);
  }, [
    animateViewBoxTo,
    targetViewBox.height,
    targetViewBox.width,
    targetViewBox.x,
    targetViewBox.y,
  ]);

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

  const selectHotSchool = (school: HotSchool) => {
    setSelectedRegionId(school.region.id);
    setSelectedAlumniId(school.firstContact.alumniId);
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
    animateViewBoxTo(targetViewBox);
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as Element;
    const clickedRegion = findRegionFromTarget(target);
    if (clickedRegion) {
      selectRegion(clickedRegion);
      return;
    }

    if (isMapInteractiveTarget(target)) return;

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

    const pressedRegion = findRegionFromTarget(event.target);

    cancelAnimationFrame(viewBoxAnimationRef.current);
    mapDragRef.current = {
      pointerId: event.pointerId,
      startRegionId: pressedRegion?.id ?? null,
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
    if (!dragState.moved && dragState.startRegionId) {
      const pressedRegion = worldRegionById.get(dragState.startRegionId);
      if (pressedRegion) {
        suppressNextClickRef.current = true;
        selectRegion(pressedRegion);
      }
    }
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
                    <g className="alumni-region-hit-areas" aria-hidden="true">
                      {worldRegions.flatMap((region) =>
                        (REGION_HIT_AREAS[region.id] ?? []).map((area, index) => (
                          area.type === 'rect' ? (
                            <rect
                              key={`${region.id}-${index}`}
                              className="alumni-region-hit-area"
                              data-region={region.id}
                              x={area.x}
                              y={area.y}
                              width={area.width}
                              height={area.height}
                              rx={14}
                            />
                          ) : (
                            <ellipse
                              key={`${region.id}-${index}`}
                              className="alumni-region-hit-area"
                              data-region={region.id}
                              cx={area.cx}
                              cy={area.cy}
                              rx={area.rx}
                              ry={area.ry}
                            />
                          )
                        )),
                      )}
                    </g>
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
            onSelectSchool={selectHotSchool}
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
  const hitRadius = Math.max(ringRadius * 1.16, coreRadius + 8 * markerScale);

  return (
    <g
      className={`alumni-region-cluster${isHovered ? ' is-hovered' : ''}`}
      data-region={region.id}
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
      <circle className="alumni-region-cluster-hit-area" cx={x} cy={y} r={hitRadius} fill="transparent" />
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
  const logoSize = Math.max(region.id === 'hong-kong' ? 8.5 : 2.2, Math.min(34, baseViewBoxWidth * 0.034));
  const hitSize = logoSize * 1.5;
  const countFontSize = Math.max(1.55, logoSize * 0.24);
  const countBadgeRadius = logoSize * 0.24;
  const countX = point.x + logoSize * 0.42;
  const countY = point.y - logoSize * 0.42;
  const logoUrl = getMapSchoolLogoUrl(point.contact);

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
      <rect
        className="alumni-city-pin-hit-area"
        x={point.x - hitSize / 2}
        y={point.y - hitSize / 2}
        width={hitSize}
        height={hitSize}
        rx={hitSize * 0.28}
        fill="transparent"
      />
      <image
        className="alumni-city-pin-logo"
        href={logoUrl}
        x={point.x - logoSize / 2}
        y={point.y - logoSize / 2}
        width={logoSize}
        height={logoSize}
        preserveAspectRatio="xMidYMid meet"
        onError={(event) => {
          const fallbackUrl = getSchoolLogoUrl(point.contact);
          if (event.currentTarget.getAttribute('href') === fallbackUrl) return;
          event.currentTarget.setAttribute('href', fallbackUrl);
        }}
      />
      {point.contacts.length > 1 && (
        <>
          <circle className="alumni-city-pin-count-badge" cx={countX} cy={countY} r={countBadgeRadius} fill={region.color} />
          <text
            className="alumni-city-pin-count"
            x={countX}
            y={countY + countFontSize * 0.34}
            style={{ fontSize: `${countFontSize}px` }}
          >
            {point.contacts.length}
          </text>
        </>
      )}
    </g>
  );
}

type AlumniInfoPanelProps = {
  worldRegions: AlumniRegion[];
  selectedRegion: AlumniRegion | null;
  selectedAlumni: AlumniContact | null;
  relatedContacts: AlumniContact[];
  onSelectRegion: (region: AlumniRegion) => void;
  onSelectSchool: (school: HotSchool) => void;
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
  onSelectSchool,
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
            <h4>热门学校</h4>
            <span>按校友人数排序</span>
          </div>
          <div className="alumni-hot-school-list">
            {getHotSchools(worldRegions).map((school) => (
              <button
                key={school.key}
                type="button"
                className="alumni-hot-school"
                style={{ '--accent': school.color } as CSSProperties}
                onClick={() => onSelectSchool(school)}
                onMouseEnter={() => onHoverRegion(school.region.id)}
                onMouseLeave={() => onHoverRegion(null)}
              >
                <span className="alumni-hot-school-logo" aria-hidden="true">
                  <img
                    src={getSchoolLogoUrl(school.firstContact)}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      const fallbackUrl = school.firstContact.logoUrl;
                      if (event.currentTarget.src.endsWith(fallbackUrl)) return;
                      event.currentTarget.src = fallbackUrl;
                    }}
                  />
                </span>
                <span className="alumni-hot-school-copy">
                  <strong>{school.universityAbbr}</strong>
                  <small>{school.university} · {school.city}</small>
                </span>
                <span className="alumni-hot-school-count">{school.count}</span>
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
        <div className="alumni-info-nav-row">
          <button type="button" className="alumni-info-back" onClick={onBackToRegion}>
            ← 返回
          </button>
        </div>
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
        <div className="alumni-info-nav-row">
          <button type="button" className="alumni-info-back" onClick={onBackToWorld}>
            ← 返回
          </button>
        </div>
        <PanelHeader
          eyebrow={selectedRegion.groupLabel}
          title={`${selectedRegion.label}校友`}
          description={selectedRegion.summary}
        />
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
            <span className="alumni-contact-school-logo" aria-hidden="true">
              <img
                src={getSchoolLogoUrl(contact)}
                alt=""
                loading="lazy"
                onError={(event) => {
                  const fallbackUrl = contact.logoUrl;
                  if (event.currentTarget.src.endsWith(fallbackUrl)) return;
                  event.currentTarget.src = fallbackUrl;
                }}
              />
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
      <div className="alumni-info-panel-heading">
        <h4>{title}</h4>
        <span>{eyebrow}</span>
      </div>
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

function getHotSchools(worldRegions: AlumniRegion[]): HotSchool[] {
  const schools = new Map<string, HotSchool>();
  let nextOrder = 0;

  worldRegions.forEach((region) => {
    region.contacts.forEach((contact) => {
      const key = `${contact.university}-${contact.campus}`;
      const current = schools.get(key);
      if (current) {
        current.count += 1;
      } else {
        schools.set(key, {
          key,
          university: contact.university,
          universityAbbr: contact.universityAbbr,
          campus: contact.campus,
          city: contact.city,
          count: 1,
          region,
          firstContact: contact,
          color: region.color,
          order: nextOrder,
        });
        nextOrder += 1;
      }
    });
  });

  return Array.from(schools.values())
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
        <div className="alumni-card-school-logo" aria-hidden="true">
          <img
            src={getSchoolLogoUrl(contact)}
            alt=""
            loading="lazy"
            onError={(event) => {
              const fallbackUrl = contact.logoUrl;
              if (event.currentTarget.src.endsWith(fallbackUrl)) return;
              event.currentTarget.src = fallbackUrl;
            }}
          />
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
        <span className="alumni-contact-pill">点击获取联系方式</span>
      </div>
    </article>
  );
}
