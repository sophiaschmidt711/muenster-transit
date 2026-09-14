import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, BusFront, LocateFixed, Map as MapIcon, Navigation, RefreshCw, Search, Star } from "lucide-react";
import MapView, { type TripSelection } from "./MapView";

const API = "https://rest.busradar.conterra.de/prod";

type StopPart = { nr: string | number };
type Stop = { name: string; parts: StopPart[]; coordinates: [number, number][] };
type Departure = {
  fahrtbezeichner?: string;
  sequenz?: string | number;
  haltid?: string | number;
  einsteigeverbot?: boolean | string;
  linientext?: string | number;
  richtungstext?: string;
  delay?: number | string;
  abfahrtszeit?: number | string;
  tatsaechliche_abfahrtszeit?: number | string;
};

type StopFeature = {
  properties?: { lbez?: string; nr?: string | number };
  geometry?: { coordinates?: [number, number] };
};

type Tab = "now" | "map" | "plan";

const lineColors = ["#6a55e8", "#2785d8", "#df6d50", "#2f9a70", "#c4589a", "#8c6d31", "#118ab2", "#ef476f"];
const cleanName = (value: string) => value.replace(/str\.$/, "straße");
const normalize = (value: string) => value.toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
const departureTime = (d: Departure) => Number(d.tatsaechliche_abfahrtszeit || d.abfahrtszeit || 0);
const minutesUntil = (timestamp: number) => Math.max(0, Math.ceil((timestamp - Date.now() / 1000) / 60));
const clock = (timestamp: number) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp * 1000));
const lineColor = (line: string) => {
  let hash = 0;
  for (const char of line) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return lineColors[hash % lineColors.length];
};

function km(a: [number, number], b: [number, number]) {
  const r = 6371;
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function groupStops(features: StopFeature[]): Stop[] {
  const grouped = new globalThis.Map<string, Stop>();
  for (const feature of features) {
    const name = feature.properties?.lbez;
    const nr = feature.properties?.nr;
    if (!name || nr == null) continue;
    if (!grouped.has(name)) grouped.set(name, { name, parts: [], coordinates: [] });
    const stop = grouped.get(name)!;
    stop.parts.push({ nr });
    if (feature.geometry?.coordinates) stop.coordinates.push(feature.geometry.coordinates);
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export default function App() {
  const [tab, setTab] = useState<Tab>("now");
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedName, setSelectedName] = useState(() => localStorage.getItem("mt-selected-stop") || "Hauptbahnhof");
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [query, setQuery] = useState("");
  const [loadingStops, setLoadingStops] = useState(true);
  const [loadingDepartures, setLoadingDepartures] = useState(false);
  const [error, setError] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripSelection | null>(null);
  const [planFrom, setPlanFrom] = useState("Mein Standort");
  const [planTo, setPlanTo] = useState("");
  const [planMessage, setPlanMessage] = useState("");

  const selected = stops.find((stop) => stop.name === selectedName) || stops[0];

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return stops
      .map((stop) => ({ stop, name: normalize(cleanName(stop.name)) }))
      .filter(({ name }) => name.includes(q))
      .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)))
      .slice(0, 7)
      .map(({ stop }) => stop);
  }, [query, stops]);

  const loadDepartures = useCallback(async (stop: Stop) => {
    setLoadingDepartures(true);
    setError("");
    try {
      const results = await Promise.all(stop.parts.map(async ({ nr }) => {
        const response = await fetch(`${API}/haltestellen/${nr}/abfahrten?sekunden=7200`, { cache: "no-store" });
        if (!response.ok) return [] as Departure[];
        return await response.json() as Departure[];
      }));
      const seen = new Set<string>();
      const now = Date.now() / 1000 - 30;
      const merged = results.flat().filter((d) => {
        const key = `${d.fahrtbezeichner}-${d.sequenz}-${d.haltid}`;
        if (seen.has(key) || String(d.einsteigeverbot) === "true" || departureTime(d) <= now) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => departureTime(a) - departureTime(b)).slice(0, 10);
      setDepartures(merged);
      setUpdatedAt(new Date());
    } catch {
      setError("Die Live-Abfahrten konnten gerade nicht geladen werden.");
    } finally {
      setLoadingDepartures(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API}/haltestellen`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json() as { features?: StopFeature[] };
        const grouped = groupStops(data.features || []);
        setStops(grouped);
        if (!grouped.some((stop) => stop.name === selectedName) && grouped[0]) setSelectedName(grouped[0].name);
      } catch {
        setError("Die Münster-Haltestellen konnten gerade nicht geladen werden.");
      } finally {
        setLoadingStops(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem("mt-selected-stop", selected.name);
    loadDepartures(selected);
    const timer = window.setInterval(() => loadDepartures(selected), 20000);
    return () => window.clearInterval(timer);
  }, [selected?.name, loadDepartures]);

  const chooseStop = useCallback((stop: Stop) => {
    setSelectedName(stop.name);
    setQuery("");
    setDistance(null);
  }, []);

  const chooseStopFromMap = useCallback((name: string) => {
    setSelectedName(name);
    setTab("now");
    setDistance(null);
  }, []);

  const chooseTrip = useCallback((trip: TripSelection) => {
    setSelectedTrip(trip);
    setTab("map");
  }, []);

  const clearTrip = useCallback(() => setSelectedTrip(null), []);

  function openDeparture(d: Departure) {
    const id = String(d.fahrtbezeichner || "");
    if (!id) return;
    chooseTrip({ id, line: String(d.linientext || "Bus"), direction: d.richtungstext || "Richtung unbekannt" });
  }

  function findNearest() {
    if (!navigator.geolocation || !stops.length) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const here: [number, number] = [coords.longitude, coords.latitude];
      const ranked = stops.map((stop) => ({
        stop,
        distance: Math.min(...stop.coordinates.map((point) => km(here, point)))
      })).filter((item) => Number.isFinite(item.distance)).sort((a, b) => a.distance - b.distance);
      if (ranked[0]) {
        setSelectedName(ranked[0].stop.name);
        setDistance(ranked[0].distance);
        setQuery("");
      }
    }, () => setError("Standort nicht freigegeben."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function swapPlan() {
    const from = planFrom;
    setPlanFrom(planTo || "Mein Standort");
    setPlanTo(from === "Mein Standort" ? "" : from);
  }

  function submitPlan() {
    if (!planTo.trim()) {
      setPlanMessage("Bitte zuerst ein Ziel eingeben.");
      return;
    }
    setPlanMessage("Die Verbindungssuche kommt als nächster Schritt. Genau hier werden später schnellste und sicherste Route inklusive Anschlussrisiko verglichen.");
  }

  return <div className="shell">
    {tab === "now" && <main className="app">
      <header className="topbar">
        <div><p className="eyebrow">Münster · live</p><h1>Wohin geht’s?</h1></div>
        <button className="round" onClick={() => selected && loadDepartures(selected)} aria-label="Aktualisieren"><RefreshCw size={20}/></button>
      </header>

      <div className="searchwrap">
        <div className="search"><Search size={20}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Haltestelle suchen" autoComplete="off"/></div>
        {query && <div className="suggestions">
          {matches.length ? matches.map((stop) => <button key={stop.name} onClick={() => chooseStop(stop)}><strong>{cleanName(stop.name)}</strong><small>{stop.parts.length > 1 ? `${stop.parts.length} Steige` : ""}</small></button>) : <div className="empty">Keine Haltestelle gefunden</div>}
        </div>}
      </div>

      <button className="nearbyButton" onClick={findNearest}><LocateFixed size={16}/> Nächste Haltestelle finden</button>

      <section className="card nearby">
        <div className="cardhead">
          <div><span className="tiny"><Navigation size={13}/>Live-Abfahrten</span><h2>{selected ? cleanName(selected.name) : "Haltestelle"}</h2><p>{distance == null ? "Münster" : distance < 1 ? `${Math.round(distance * 1000)} m entfernt` : `${distance.toFixed(1)} km entfernt`}</p></div>
          <button className="icon" aria-label="Favorit"><Star size={20}/></button>
        </div>

        <div className="departures">
          {(loadingStops || loadingDepartures) && !departures.length && <div className="message">Live-Abfahrten werden geladen …</div>}
          {error && !departures.length && <div className="message error">{error}</div>}
          {!loadingDepartures && !error && !departures.length && <div className="message">In den nächsten zwei Stunden ist keine Abfahrt gemeldet.</div>}
          {departures.map((d, index) => {
            const timestamp = departureTime(d);
            const delay = Math.round(Number(d.delay || 0) / 60);
            const line = String(d.linientext || "Bus");
            return <button className="departure" onClick={() => openDeparture(d)} key={`${d.fahrtbezeichner}-${d.sequenz}-${index}`}>
              <span className="line" style={{ background: lineColor(line) }}>{line}</span>
              <span className="copy"><strong>{d.richtungstext || "Richtung unbekannt"}</strong><span className={`meta ${delay > 0 ? "late" : delay < 0 ? "early" : ""}`}>{delay > 0 ? `+${delay} Min. später` : delay < 0 ? `${Math.abs(delay)} Min. früher` : "pünktlich"} · {clock(timestamp)}</span></span>
              <span className="mins"><strong>{minutesUntil(timestamp)}</strong><small>min</small></span>
            </button>;
          })}
        </div>
        <p className="updated">{updatedAt ? `Stand ${updatedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · automatisch alle 20 Sekunden` : "Live-Daten der Stadtwerke Münster"}</p>
      </section>

      <button className="wideAction" onClick={() => setTab("plan")}><ArrowLeftRight size={18}/><span><strong>Verbindung planen</strong><small>Später mit Anschlusschance & Zuverlässigkeit</small></span></button>
    </main>}

    {tab === "map" && <main className="mapApp">
      <MapView stops={stops} selectedTrip={selectedTrip} onSelectStop={chooseStopFromMap} onSelectTrip={chooseTrip} onClearTrip={clearTrip}/>
    </main>}

    {tab === "plan" && <main className="app planPage">
      <header className="topbar planTop"><div><p className="eyebrow">Münster · planen</p><h1>Deine Fahrt</h1></div></header>
      <section className="card planner">
        <div className="planField"><span>Von</span><input value={planFrom} onChange={(e) => setPlanFrom(e.target.value)} placeholder="Start"/></div>
        <button className="swap" onClick={swapPlan} aria-label="Start und Ziel tauschen"><ArrowLeftRight size={18}/></button>
        <div className="planField"><span>Nach</span><input value={planTo} onChange={(e) => setPlanTo(e.target.value)} placeholder="Haltestelle oder Ort"/></div>
        <button className="primary" onClick={submitPlan}>Verbindung suchen</button>
      </section>
      <section className="card planInfo">
        <p className="eyebrow neutral">Warum hier die Statistik hingehört</p>
        <h2>Schnell ist nicht immer sicher.</h2>
        <p>Bei einer konkreten Verbindung vergleichen wir später Fahrzeit, typische Verspätung und Umstiegsrisiko. Dann kannst du zwischen <strong>Schnellste</strong> und <strong>Sicherste</strong> wählen.</p>
        {planMessage && <div className="planMessage">{planMessage}</div>}
      </section>
    </main>}

    <nav>
      <button className={tab === "now" ? "active" : ""} onClick={() => setTab("now")}><BusFront size={20}/><span>Jetzt</span></button>
      <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon size={20}/><span>Karte</span></button>
      <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}><ArrowLeftRight size={20}/><span>Planen</span></button>
    </nav>
  </div>;
}
