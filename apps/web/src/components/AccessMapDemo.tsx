'use client';

import Link from 'next/link';
import { Car, Check, Footprints, Route, Trees } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Badge, Card } from '@/components/ui';

type EntranceKind = 'step-free' | 'steps';

type Entrance = { x: number; y: number; label: string; kind: EntranceKind };

type MapBuilding = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  entrances: Entrance[];
  notes: string[];
};

// Sample campus layout used for the demo experience shown on the home page.
const buildings: MapBuilding[] = [
  {
    id: 'library', name: 'Central Library', x: 40, y: 40, w: 170, h: 110,
    entrances: [
      { x: 125, y: 150, label: 'Main entrance', kind: 'step-free' },
      { x: 210, y: 95, label: 'Side door', kind: 'steps' },
    ],
    notes: [
      'Step-free entrance and lift to all floors',
      'Accessible washrooms on levels 1–3',
      'Quiet study room near the north wing',
    ],
  },
  {
    id: 'student-services', name: 'Student Services', x: 40, y: 230, w: 170, h: 100,
    entrances: [
      { x: 125, y: 230, label: 'Courtyard entrance', kind: 'step-free' },
      { x: 60, y: 330, label: 'Accessible drop-off', kind: 'step-free' },
    ],
    notes: [
      'Fully step-free from the main courtyard',
      'Height-adjustable service desk',
      'Assistive listening available at reception',
    ],
  },
  {
    id: 'science-lab', name: 'Science Lab', x: 300, y: 40, w: 180, h: 110,
    entrances: [
      { x: 390, y: 150, label: 'Reception', kind: 'step-free' },
      { x: 480, y: 95, label: 'East door', kind: 'steps' },
    ],
    notes: [
      'Step-free reception; lift to lab floor',
      'Two wheelchair-accessible benches in Wet Lab B',
      'Emergency alarms include visual strobes',
    ],
  },
  {
    id: 'cafeteria', name: 'Student Café', x: 300, y: 230, w: 180, h: 100,
    entrances: [
      { x: 390, y: 230, label: 'Lobby', kind: 'step-free' },
      { x: 480, y: 330, label: 'Patio door', kind: 'steps' },
    ],
    notes: [
      'Ramped entry with wide, marked queues',
      'Seated tables near the garden window',
      'Staff help carry trays on request',
    ],
  },
  {
    id: 'design-studio', name: 'Design Studio', x: 560, y: 40, w: 170, h: 110,
    entrances: [
      { x: 560, y: 95, label: 'North door', kind: 'steps' },
      { x: 645, y: 150, label: 'Lift lobby', kind: 'step-free' },
    ],
    notes: [
      'Step-free via lift lobby; small thresholds inside',
      'Standing and seated workstations',
      'Quiet critique room bookable at reception',
    ],
  },
  {
    id: 'dormitories', name: 'Dormitories', x: 560, y: 230, w: 170, h: 100,
    entrances: [
      { x: 645, y: 230, label: 'Residence office', kind: 'step-free' },
      { x: 648, y: 330, label: 'Rear door', kind: 'step-free' },
      { x: 560, y: 330, label: 'Stair core', kind: 'steps' },
    ],
    notes: [
      'Accessible rooms with roll-in showers',
      'Lift lobby step-free with resident card access',
      'Tactile signage throughout corridors',
    ],
  },
];

// Solid, step-free walking routes between entrance markers.
const stepFreeRoutes: string[] = [
  'M125,150 L125,230',
  'M210,95 L300,95',
  'M390,150 L390,230',
  'M210,280 L300,280',
  'M480,95 L560,95',
  'M645,150 L645,230',
  'M480,280 L560,280',
  'M60,418 L60,332',
  'M648,424 L648,332',
];

// A tempting shortcut that involves steps — shown as the "not step-free" case.
const stepsRoutes: string[] = ['M210,150 L300,230'];

const quietSpots = [
  { x: 85, y: 200, label: 'Quiet garden' },
  { x: 250, y: 190, label: 'Courtyard bench' },
  { x: 520, y: 330, label: 'Reading terrace' },
  { x: 690, y: 190, label: 'Studio courtyard' },
];

const parkingSpots = [
  { x: 50, y: 422, label: 'Bay 1' },
  { x: 640, y: 422, label: 'Bay 2' },
];

const layers = [
  { key: 'routes', label: 'Step-free routes', icon: <Route size={13} /> },
  { key: 'steps', label: 'Routes with steps', icon: <Footprints size={13} /> },
  { key: 'quiet', label: 'Quiet spots', icon: <Trees size={13} /> },
  { key: 'parking', label: 'Accessible parking', icon: <Car size={13} /> },
] as const;

type LayerKey = (typeof layers)[number]['key'];

export function AccessMapDemoSection() {
  const [selectedId, setSelectedId] = useState('library');
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    routes: true, steps: true, quiet: true, parking: true,
  });

  const selected = buildings.find((building) => building.id === selectedId) ?? buildings[0];

  const toggleLayer = (key: LayerKey) => setVisible((current) => ({ ...current, [key]: !current[key] }));

  const toggle = (key: LayerKey, label: ReactNode) => {
    const active = visible[key];
    return (
      <button type="button" className="map-toggle" aria-pressed={active} onClick={() => toggleLayer(key)}>
        {label}
      </button>
    );
  };

  return (
    <section className="section page-width" aria-labelledby="access-map-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><AccessibilityGlyph /> Campus access</span>
          <h2 id="access-map-heading">Campus Access Map <Badge>Demo</Badge></h2>
          <p>A sample, student-maintained map of step-free routes, entrances, and quiet study spots.</p>
        </div>
        <Link className="text-link" href="/projects/demo-project-access-map">Explore the project behind it</Link>
      </div>

      <div className="access-map-layout">
        <Card className="access-map-card">
          <div className="access-map-toggles" role="group" aria-label="Map layers">
            {layers.map((layer) => <span key={layer.key}>{toggle(layer.key, <span className="map-toggle-inner">{layer.icon} {layer.label}</span>)}</span>)}
          </div>
          <svg className="access-map-svg" viewBox="0 0 760 460" role="img" aria-label={`Campus map with ${buildings.length} buildings; ${selected.name} is selected`}>
            {/* Lawns and plaza backdrop */}
            <ellipse className="map-plaza" cx="390" cy="190" rx="120" ry="70" />
            <text className="access-map-sublabel" x="390" y="196" textAnchor="middle">Campus Quad</text>

            <g className="access-map-svg-layer" opacity={visible.routes ? 1 : 0} aria-hidden={!visible.routes}>
              {stepFreeRoutes.map((routeItem, index) => <path key={index} className="map-route" d={routeItem} />)}
            </g>
            <g className="access-map-svg-layer" opacity={visible.steps ? 1 : 0} aria-hidden={!visible.steps}>
              {stepsRoutes.map((routeItem, index) => <path key={index} className="map-steps" d={routeItem} />)}
            </g>

            {buildings.map((building) => (
              <g key={building.id}>
                <rect
                  className={`access-map-building${building.id === selectedId ? ' access-map-building-selected' : ''}`}
                  x={building.x} y={building.y} width={building.w} height={building.h} rx="10"
                  role="button" tabIndex={0} aria-label={`${building.name} — show accessibility details`}
                  onClick={() => setSelectedId(building.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(building.id); } }}
                />
                <text className="access-map-label" x={building.x + building.w / 2} y={building.y + building.h / 2 - 4} textAnchor="middle">{building.name}</text>
                <text className="access-map-sublabel" x={building.x + building.w / 2} y={building.y + building.h / 2 + 12} textAnchor="middle">
                  {building.entrances.filter((entrance) => entrance.kind === 'step-free').length} step-free way{building.entrances.filter((entrance) => entrance.kind === 'step-free').length === 1 ? '' : 's'} in
                </text>
              </g>
            ))}

            <g className="access-map-svg-layer" opacity={visible.quiet ? 1 : 0} aria-hidden={!visible.quiet}>
              {quietSpots.map((spot) => (
                <g key={spot.label}>
                  <circle className="map-quiet" cx={spot.x} cy={spot.y} r="5" />
                  <title>{`Quiet spot: ${spot.label}`}</title>
                </g>
              ))}
            </g>

            {buildings.flatMap((building) => building.entrances).map((entrance, index) => (
              entrance.kind === 'step-free'
                ? <g key={`entrance-${index}`} className="access-map-svg-layer" opacity={visible.routes ? 1 : 0} aria-hidden={!visible.routes}>
                    <circle className="map-entrance-free" cx={entrance.x} cy={entrance.y} r="7" />
                    <circle className="map-entrance-dot" cx={entrance.x} cy={entrance.y} r="2.5" />
                    <title>{entrance.label} — step-free</title>
                  </g>
                : <rect key={`entrance-${index}`} className={`map-entrance-steps access-map-svg-layer`} opacity={visible.steps ? 1 : 0} aria-hidden={!visible.steps} x={entrance.x - 6} y={entrance.y - 6} width="12" height="12" rx="2">
                    <title>{`${entrance.label} — steps`}</title>
                  </rect>
            ))}

            <g className="access-map-svg-layer" opacity={visible.parking ? 1 : 0} aria-hidden={!visible.parking}>
              {parkingSpots.map((spot) => (
                <g key={spot.label}>
                  <rect className="map-parking" x={spot.x} y={spot.y} width="18" height="14" rx="3" />
                  <text className="map-parking-label" x={spot.x + 9} y={spot.y + 10} textAnchor="middle">P</text>
                  <title>{`Accessible parking: ${spot.label}`}</title>
                </g>
              ))}
            </g>
          </svg>
          <ul className="map-legend" aria-label="Map legend">
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><path className="map-route" d="M2,10 L18,10" /></svg><span>Step-free route</span></li>
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><path className="map-steps" d="M2,10 L18,10" /></svg><span>Route with steps</span></li>
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><circle className="map-entrance-free" cx="10" cy="10" r="6" /></svg><span>Step-free entrance</span></li>
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect className="map-entrance-steps" x="5" y="5" width="10" height="10" rx="2" /></svg><span>Entrance with steps</span></li>
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><circle className="map-quiet" cx="10" cy="10" r="5" /></svg><span>Quiet spot</span></li>
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect className="map-parking" x="3" y="5" width="14" height="11" rx="2" /><text className="map-parking-label" x="10" y="14" textAnchor="middle" fontSize="7">P</text></svg><span>Accessible parking</span></li>
          </ul>
        </Card>

        <div className="access-map-panel">
          <Card className="detail-panel">
            <h2>{selected.name}</h2>
            <p className="access-panel-sub">Accessibility details</p>
            <ul className="access-facts">
              {selected.notes.map((note) => <li key={note}><Check className="map-check" size={14} /> {note}</li>)}
            </ul>
            <h3>Entrances</h3>
            <ul className="access-facts">
              {selected.entrances.map((entrance) => (
                <li key={`${entrance.label}-${entrance.x}`}>
                  <span className={`entrance-dot ${entrance.kind === 'step-free' ? 'entrance-dot-free' : 'entrance-dot-steps'}`} aria-hidden="true" />
                  {entrance.label} — {entrance.kind === 'step-free' ? 'step-free' : 'has steps'}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="card-body">
              <h3>Choose a building</h3>
              <div className="building-picker" role="group" aria-label="Building list">
                {buildings.map((building) => (
                  <button
                    key={building.id}
                    type="button"
                    className={building.id === selectedId ? 'picker-selected' : ''}
                    onClick={() => setSelectedId(building.id)}
                  >
                    {building.name}
                  </button>
                ))}
              </div>
              <small className="access-map-note">Sample data for demonstration — not live campus data.</small>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AccessibilityGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v6l4 4" />
      <path d="M12 12l-4 2a5 5 0 1 0 4 6" />
    </svg>
  );
}
