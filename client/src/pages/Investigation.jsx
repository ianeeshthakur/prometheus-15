import React, { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Investigation.css';

const vehicleIcon = L.divIcon({
  className: 'investigation-vehicle-marker',
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l1.4-5h11.2l1.4 5"/><path d="M4 16h16v4H4z"/><path d="M7 11l1.4-3h7.2l1.4 3"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const officerIcon = L.divIcon({
  className: 'investigation-officer-marker',
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21c.6-4 2.8-6 7-6s6.4 2 7 6"/><path d="M8 4.5l4-2 4 2"/></svg></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const nextPointIcon = L.divIcon({
  className: 'investigation-next-marker',
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function speakWithNaturalVoice(text, language) {
  if (!('speechSynthesis' in window)) return;

  const languageCode = language === 'Gujarati' ? 'gu-IN' : language === 'Hindi' ? 'hi-IN' : 'en-IN';
  const voices = window.speechSynthesis.getVoices();
  const languagePrefix = languageCode.slice(0, 2).toLowerCase();
  const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
  const preferredVoice = matchingVoices.find((voice) => /google|microsoft|samantha|alex|veena|rishi|lekha|natural|neural/i.test(voice.name))
    || matchingVoices.find((voice) => voice.lang.toLowerCase() === languageCode.toLowerCase())
    || matchingVoices[0];

  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = languageCode;
  voice.rate = language === 'English' ? 0.82 : 0.76;
  voice.pitch = 0.98;
  voice.volume = 0.92;
  if (preferredVoice) voice.voice = preferredVoice;
  window.speechSynthesis.speak(voice);
}

function RouteMapView({ incident, language, predictionStep, layers }) {
  const mapRef = useRef(null);
  const route = incident.id === 'ALT-20260908-001'
    ? [[21.1702, 72.8311], [21.19, 72.84], [21.205, 72.86], [21.225, 72.88], [21.245, 72.90]]
    : [[23.2156, 72.6369], [23.23, 72.65], [23.25, 72.67], [23.27, 72.69]];
  const mapCenter = incident.id === 'ALT-20260908-001' ? [21.25, 72.86] : [23.25, 72.66];
  const predictedPoint = route[predictionStep];

  const speakStatus = (status) => {
    speakWithNaturalVoice(status, language);
  };

  const focusPoint = (point, status) => {
    mapRef.current?.flyTo(point, 15, { duration: 1.1 });
    speakStatus(status);
  };

  const vehicleStatus = language === 'Gujarati'
    ? incident.icon === 'car' ? `વાહન ${incident.subject} કલાક દીઠ 48 કિલોમીટરની ઝડપે ${incident.officerLocation} તરફ જઈ રહ્યું છે. છેલ્લે ${incident.location} પર જોવા મળ્યું.` : `${incident.category} માટેનું ${incident.subject} એલર્ટ ${incident.location} પર મળ્યું છે. ${incident.officer} તપાસ માટે ${incident.eta} દૂર છે.`
    : language === 'Hindi'
      ? incident.icon === 'car' ? `वाहन ${incident.subject} 48 किलोमीटर प्रति घंटे की रफ्तार से ${incident.officerLocation} की ओर जा रहा है। इसे आखिरी बार ${incident.location} पर देखा गया।` : `${incident.category} का ${incident.subject} अलर्ट ${incident.location} पर मिला है। ${incident.officer} जांच के लिए ${incident.eta} दूर हैं।`
      : incident.icon === 'car' ? `Vehicle ${incident.subject} is driving at 48 kilometres per hour toward ${incident.officerLocation}. Last seen at ${incident.location}.` : `${incident.category} alert for ${incident.subject} was detected at ${incident.location}. ${incident.officer} is ${incident.eta} away for verification.`;
  const officerStatus = language === 'Gujarati'
    ? `${incident.officer}, પેટ્રોલ ID ${incident.officerId}, સૌથી નજીકના અધિકારી છે। પહોંચવાનો અંદાજિત સમય ${incident.eta} છે.`
    : language === 'Hindi'
      ? `${incident.officer}, पेट्रोल आईडी ${incident.officerId}, सबसे नज़दीकी अधिकारी हैं। अनुमानित पहुंचने का समय ${incident.eta} है।`
      : `${incident.officer}, patrol ID ${incident.officerId}, is the nearest officer. Estimated arrival is ${incident.eta}.`;
  const destinationStatus = language === 'Gujarati'
    ? `આગામી અનુમાનિત લોકેશન ${incident.officerLocation} છે. કાર્યવાહી પહેલાં દૃશ્ય પુષ્ટિ જાળવો.`
    : language === 'Hindi'
      ? `अगला अनुमानित स्थान ${incident.officerLocation} है। कार्रवाई से पहले दृश्य पुष्टि बनाए रखें।`
      : `Predicted next location is ${incident.officerLocation}. Maintain visual confirmation before taking action.`;

  return (
    <MapContainer ref={mapRef} className="investigation-leaflet-map" center={mapCenter} zoom={11} scrollWheelZoom={false} zoomControl={true}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {layers.route && <><Polyline positions={route.slice(0, predictionStep + 1)} pathOptions={{ color: '#ef4b5c', weight: 6, opacity: 0.9 }} /><Polyline positions={route.slice(Math.max(predictionStep - 1, 0))} pathOptions={{ color: '#2781aa', weight: 4, opacity: 0.72, dashArray: '8 9' }} /></>}
      {layers.cameras && <Marker position={route[0]} icon={vehicleIcon} eventHandlers={{ click: () => focusPoint(route[0], vehicleStatus) }}><Tooltip permanent direction="top" offset={[0, -14]}>Source location · {incident.location}</Tooltip></Marker>}
      {layers.patrols && <><Marker position={route[Math.floor(route.length / 2)]} icon={officerIcon} eventHandlers={{ click: () => focusPoint(route[Math.floor(route.length / 2)], officerStatus) }}><Tooltip permanent direction="right" offset={[12, 0]}>{incident.officer} · {incident.eta} ETA</Tooltip></Marker><CircleMarker center={[21.23, 72.875]} radius={18} pathOptions={{ color: '#16815d', fillColor: '#16815d', fillOpacity: .12, weight: 1, dashArray: '4 5' }} /></>}
      {layers.zones && <Circle center={incident.id === 'ALT-20260908-001' ? [21.225, 72.88] : [23.25, 72.67]} radius={1200} pathOptions={{ color: '#d99b2b', fillColor: '#f4c56a', fillOpacity: .12, weight: 2, dashArray: '7 6' }}><Tooltip>Active response zone</Tooltip></Circle>}
      {layers.prediction && <Marker position={predictedPoint} icon={nextPointIcon} eventHandlers={{ click: () => focusPoint(predictedPoint, destinationStatus) }}><Tooltip permanent direction="top" offset={[0, -12]}>Predicted next · {incident.officerLocation}</Tooltip></Marker>}
      {layers.clusters && <CircleMarker center={mapCenter} radius={22} pathOptions={{ color: '#2781aa', fillColor: '#2781aa', fillOpacity: .18, weight: 1 }}><Tooltip>3 nearby signals · zoom to inspect</Tooltip></CircleMarker>}
    </MapContainer>
  );
}

const incidents = [
  { id: 'ALT-20260908-001', category: 'Police', icon: 'car', subject: 'GJ05X7821', type: 'White Honda City Sedan', location: 'Surat Ring Road', zone: 'NH-53 Junction', time: '21:43:12', severity: 'Critical', confidence: '98.7%', officer: 'PSI Rakesh Solanki', officerId: 'PAT-SRT-0042', officerLocation: 'Varachha Junction', eta: '4 min', action: 'Vehicle match detected' },
  { id: 'ALT-20260908-002', category: 'Police', icon: 'car', subject: 'GJ01AB4456', type: 'Dark Blue SUV', location: 'Gandhinagar Road', zone: 'Infocity Circle', time: '21:38:06', severity: 'High', confidence: '93.2%', officer: 'ASI Mehul Desai', officerId: 'PAT-GNR-0018', officerLocation: 'Sargasan Cross Road', eta: '7 min', action: 'Vehicle match detected' },
  { id: 'ALT-20260908-003', category: 'Food Safety', icon: 'food', subject: 'Cold storage stock mismatch', type: 'Suspected edible oil diversion', location: 'APMC Market Yard', zone: 'Ahmedabad East', time: '21:31:44', severity: 'High', confidence: '91.4%', officer: 'Food Inspector Nisha Shah', officerId: 'FSI-AHM-0071', officerLocation: 'Naroda Inspection Unit', eta: '12 min', action: 'Stock anomaly detected' },
  { id: 'ALT-20260908-004', category: 'Civil Supplies', icon: 'box', subject: 'Ration depot inventory anomaly', type: 'Possible PDS stock theft', location: 'Kalupur Distribution Depot', zone: 'Ahmedabad Central', time: '21:26:08', severity: 'Critical', confidence: '96.1%', officer: 'CSO Harsh Trivedi', officerId: 'CIV-AHM-0033', officerLocation: 'Relief Road Supply Office', eta: '9 min', action: 'Inventory theft alert' },
];

const languageMessages = {
  English: 'Officer Solanki, a vehicle matching the watchlist has just passed your location. Please verify safely and report back.',
  Hindi: 'अधिकारी सोलंकी, वॉचलिस्ट से मिलता वाहन अभी आपकी लोकेशन से गुज़रा है। कृपया सुरक्षित रूप से जांच करें और रिपोर्ट करें।',
  Gujarati: 'અધિકારી સોલંકી, વૉચલિસ્ટ સાથે મેળ ખાતું વાહન હમણાં તમારી લોકેશન પરથી પસાર થયું છે. કૃપા કરીને સુરક્ષિત રીતે ચકાસો અને રિપોર્ટ કરો.',
};

function Investigation() {
  const [selectedId, setSelectedId] = useState(incidents[0].id);
  const [language, setLanguage] = useState('English');
  const [ticketState, setTicketState] = useState('ready');
  const [predictionStep, setPredictionStep] = useState(2);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [layers, setLayers] = useState({ route: true, cameras: true, patrols: true, prediction: true, zones: false, clusters: false });
  const [actionState, setActionState] = useState('ready');
  const incident = incidents.find((item) => item.id === selectedId);
  const filteredIncidents = incidents.filter((item) => {
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const query = search.toLowerCase();
    return matchesCategory && (!query || `${item.subject} ${item.location} ${item.category} ${item.id}`.toLowerCase().includes(query));
  });

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => setPredictionStep((step) => (step >= 4 ? 1 : step + 1)), 900);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const speakBriefing = () => {
    speakWithNaturalVoice(languageMessages[language], language);
  };

  const assignTicket = () => {
    setTicketState('assigned');
    speakBriefing();
  };

  return (
    <div className="investigation-page">
      <header className="investigation-header">
        <div>
          <span className="section-eyebrow">GUJARAT COMMAND NETWORK / LIVE RESPONSE</span>
          <h1>Incidents & Alerts</h1>
          <p>Coordinate vehicle detections with the nearest field officer.</p>
        </div>
        <div className="response-status"><span />Live response channel</div>
      </header>

      <section className="incident-layout">
        <div className="incident-main">
          <div className="incident-tabs">
            <strong>Cross-department alerts</strong><span className="incident-count">{incidents.length} active</span>
            <div className="severity-filters">{['All', 'Police', 'Food Safety', 'Civil Supplies'].map((item) => <button key={item} type="button" className={categoryFilter === item ? 'active' : ''} onClick={() => { const matchingIncident = item === 'All' ? incidents[0] : incidents.find((alert) => alert.category === item); setCategoryFilter(item); if (matchingIncident) { setSelectedId(matchingIncident.id); setTicketState('ready'); setPredictionStep(2); } }}>{item}</button>)}</div>
          </div>

          <div className="map-tools"><label className="alert-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plate, location, alert ID..." /></label><div className="layer-tools">{Object.entries({ cameras: 'Cameras', patrols: 'Patrols', route: 'Routes', prediction: 'AI forecast', zones: 'Geofences', clusters: 'Clusters' }).map(([key, label]) => <button key={key} type="button" className={layers[key] ? 'active' : ''} onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}>{label}</button>)}</div></div>

          <div className="incident-list">
            {filteredIncidents.map((item) => (
                <button key={item.id} type="button" className={`incident-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => { setSelectedId(item.id); setTicketState('ready'); setPredictionStep(2); }}>
                <span className={`severity-dot ${item.severity.toLowerCase()}`} />
                <span className="incident-row-copy"><strong>{item.subject}</strong><small>{item.category} · {item.location}</small></span>
                <span className="incident-row-meta"><strong>{item.severity}</strong><small>{item.time}</small></span>
                <span className="row-arrow">→</span>
              </button>
            ))}
          </div>

          <div className="route-map" aria-label="Live Gujarat incident response map">
            <div className="map-region-label">GUJARAT · LIVE PATROL ROUTE</div>
            <RouteMapView incident={incident} language={language} predictionStep={predictionStep} layers={layers} />
            <div className="route-legend"><span><i className="legend-route" />Observed route</span><span><i className="legend-prediction" />AI prediction</span></div>
          </div>
        </div>

        <aside className="incident-detail">
          <div className="detail-topline"><span className="critical-label">● {incident.severity}</span><span>{incident.id}</span></div>
          <h2>{incident.action}</h2>
          <p className="detail-subtitle">AI signal requires department officer verification.</p>
          <div className="vehicle-identity"><div className={`vehicle-icon ${incident.icon}`}><span>{incident.icon === 'car' ? '▰' : incident.icon === 'food' ? '◆' : '▣'}</span></div><div><strong>{incident.subject}</strong><span>{incident.category} · {incident.type}</span></div><b>{incident.confidence}</b></div>
          <dl className="detail-facts"><div><dt>Last seen</dt><dd>{incident.location}</dd></div><div><dt>Direction</dt><dd>South-east · 48 km/h</dd></div><div><dt>Captured</dt><dd>{incident.time} · Camera CAM-SRT-00421</dd></div></dl>
          <div className="patrol-match"><div className="patrol-heading"><span>Nearest patrol officer</span><em>{incident.eta} ETA</em></div><strong>{incident.officer}</strong><span>{incident.officerId}</span><small>Currently near {incident.officerLocation}</small></div>
          <div className="prediction-lens"><div className="prediction-heading"><span><i />AI activity lens</span><strong>{incident.confidence}</strong></div><p>Next likely response point: <b>{incident.officerLocation}</b></p><label htmlFor="prediction-progress"><span>Signal progression</span><span>{predictionStep + 1} of 5 points</span></label><input id="prediction-progress" type="range" min="1" max="4" value={predictionStep} onChange={(event) => setPredictionStep(Number(event.target.value))} /><div className="prediction-scale"><span>Detected</span><span>Correlated</span><span>Response</span></div><button type="button" className={`playback-button ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying((playing) => !playing)}>{isPlaying ? 'Pause route playback' : 'Play route playback'} <span>{isPlaying ? 'Ⅱ' : '▶'}</span></button></div>
          <div className="briefing-language"><span>Briefing language</span>{['English', 'Hindi', 'Gujarati'].map((item) => <button key={item} type="button" className={language === item ? 'active' : ''} onClick={() => setLanguage(item)}>{item}</button>)}</div>
          <div className="dispatch-actions"><button type="button" className={`assign-ticket ${ticketState}`} onClick={() => { setActionState('assigned'); assignTicket(); }}>{ticketState === 'assigned' ? '✓ Ticket assigned & officer briefed' : 'Assign response ticket'}<span>→</span></button><button type="button" className={`secondary-action ${actionState === 'acknowledged' ? 'done' : ''}`} onClick={() => setActionState('acknowledged')}>{actionState === 'acknowledged' ? '✓ Alert acknowledged' : 'Acknowledge alert'}</button></div>
          <div className="audit-trail"><span>Audit trail</span><small>21:43 · AI match created</small><small>21:44 · {actionState === 'acknowledged' ? 'Operator acknowledged alert' : 'Awaiting operator acknowledgement'}</small></div>
          <p className="human-note">Officer confirmation is required before any field action.</p>
        </aside>
      </section>
    </div>
  );
}

export default Investigation;
