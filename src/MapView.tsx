import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const API = "https://rest.busradar.conterra.de/prod";

type Stop = { name: string; coordinates: [number, number][] };
export type TripSelection = { id: string; line: string; direction: string };
type VehicleFeature = {
  properties?: {
    fahrtbezeichner?: string;
    fahrzeugid?: string | number;
    linientext?: string | number;
    richtungstext?: string;
    delay?: number | string;
    abfahrtstart?: number | string;
    ankunftziel?: number | string;
  };
  geometry?: { coordinates?: [number, number] };
};
type TripFeature = {
  properties?: { startzeit?: number | string; endzeit?: number | string };
  geometry?: { coordinates?: [number, number][] };
};
type RouteStop = { name: string; routeIndex: number; predictedTime: number | null };
type Props = { stops: Stop[]; selectedTrip: TripSelection | null; onSelectStop: (name: string) => void; onSelectTrip: (trip: TripSelection) => void; onClearTrip: () => void };

const palette = ["#6a55e8", "#2785d8", "#df6d50", "#2f9a70", "#c4589a", "#8c6d31", "#118ab2", "#ef476f"];
function color(line: string) { let hash = 0; for (const char of line) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return palette[hash % palette.length]; }
function center(stop: Stop): [number, number] | null { if (!stop.coordinates.length) return null; const lng = stop.coordinates.reduce((sum, c) => sum + c[0], 0) / stop.coordinates.length; const lat = stop.coordinates.reduce((sum, c) => sum + c[1], 0) / stop.coordinates.length; return [lat, lng]; }
function nearestRouteIndex(coords: [number, number][], lng: number, lat: number) { let best = Infinity, bestIndex = 0; coords.forEach((c, i) => { const d = (c[0] - lng) ** 2 + (c[1] - lat) ** 2; if (d < best) { best = d; bestIndex = i; } }); return { index: bestIndex, distance: Math.sqrt(best) }; }
function km(a: [number, number], b: [number, number]) { const r = 6371, rad = (v: number) => v * Math.PI / 180; return 2 * r * Math.asin(Math.sqrt(Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2)); }
function time(ts: number | null) { return ts ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts * 1000)) : ""; }

export default function MapView({ stops, selectedTrip, onSelectStop, onSelectTrip, onClearTrip }: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vehicleLayer = useRef<L.LayerGroup | null>(null);
  const stopLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const vehiclesRef = useRef<VehicleFeature[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [mapError, setMapError] = useState("");
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [progressIndex, setProgressIndex] = useState(0);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = L.map(mapNode.current, { zoomControl: false }).setView([51.9607, 7.6261], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20, attribution: "© OpenStreetMap · © CARTO" }).addTo(map);
    vehicleLayer.current = L.layerGroup().addTo(map);
    stopLayer.current = L.layerGroup();
    routeLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = stopLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    stops.forEach((stop) => {
      const point = center(stop); if (!point) return;
      const marker = L.circleMarker(point, { radius: 4, color: "#fff", weight: 2, fillColor: "#403a44", fillOpacity: 0.84 });
      marker.bindTooltip(stop.name, { direction: "top", offset: [0, -5] });
      marker.on("click", () => { onSelectStop(stop.name); map.setView(point, Math.max(map.getZoom(), 15)); });
      marker.addTo(layer);
    });
    const update = () => { if (map.getZoom() >= 14) { if (!map.hasLayer(layer)) layer.addTo(map); } else if (map.hasLayer(layer)) map.removeLayer(layer); };
    map.on("zoomend", update); update();
    return () => { map.off("zoomend", update); };
  }, [stops, onSelectStop]);

  useEffect(() => {
    let cancelled = false;
    async function loadVehicles() {
      try {
        const response = await fetch(`${API}/fahrzeuge`, { cache: "no-store" }); if (!response.ok) throw new Error();
        const data = await response.json() as { features?: VehicleFeature[] }; if (cancelled) return;
        vehiclesRef.current = data.features || []; setVehicleCount(vehiclesRef.current.length); setMapError(""); renderVehicles();
      } catch { if (!cancelled) setMapError("Die Live-Positionen sind gerade nicht verfügbar."); }
    }
    function renderVehicles() {
      const map = mapRef.current, layer = vehicleLayer.current; if (!map || !layer) return;
      layer.clearLayers(); const bounds: L.LatLngTuple[] = [];
      vehiclesRef.current.forEach((feature) => {
        const coords = feature.geometry?.coordinates, p = feature.properties || {}, tripId = String(p.fahrtbezeichner || "");
        if (!coords || !tripId || (selectedTrip && tripId !== selectedTrip.id)) return;
        const line = String(p.linientext || "Bus"), point: [number, number] = [coords[1], coords[0]];
        const icon = L.divIcon({ className: "", html: `<div class="mapBus${selectedTrip ? " selected" : ""}" style="background:${color(line)}">${line}</div>`, iconSize: [38, 32], iconAnchor: [19, 16] });
        const marker = L.marker(point, { icon }).addTo(layer);
        marker.bindTooltip(`Linie ${line} · ${p.richtungstext || ""}`, { direction: "top", offset: [0, -12] });
        marker.on("click", () => onSelectTrip({ id: tripId, line, direction: p.richtungstext || "Richtung unbekannt" }));
        bounds.push(point);
      });
      if (!selectedTrip && bounds.length && map.getZoom() < 11) map.fitBounds(bounds, { padding: [15, 15], maxZoom: 13 });
    }
    loadVehicles(); const timer = window.setInterval(loadVehicles, 20000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selectedTrip, onSelectTrip]);

  useEffect(() => {
    const map = mapRef.current, layer = routeLayer.current; if (!map || !layer) return;
    layer.clearLayers(); setRouteStops([]); if (!selectedTrip) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API}/fahrten/${encodeURIComponent(selectedTrip.id)}`, { cache: "no-store" }); if (!response.ok) throw new Error();
        const trip = await response.json() as TripFeature; if (cancelled) return;
        const coords = trip.geometry?.coordinates || []; if (!coords.length) return;
        const vehicle = vehiclesRef.current.find((f) => String(f.properties?.fahrtbezeichner || "") === selectedTrip.id), v = vehicle?.geometry?.coordinates;
        let split = 0;
        if (v) split = nearestRouteIndex(coords, v[0], v[1]).index;
        setProgressIndex(split);
        const past = coords.slice(0, split + 1).map((c) => [c[1], c[0]] as [number, number]);
        const future = coords.slice(split).map((c) => [c[1], c[0]] as [number, number]);
        if (past.length > 1) L.polyline(past, { color: "#aaa3ad", weight: 5, opacity: 0.48 }).addTo(layer);
        if (future.length > 1) L.polyline(future, { color: color(selectedTrip.line), weight: 7, opacity: 0.92 }).addTo(layer);

        const cumulative = [0];
        for (let i = 1; i < coords.length; i++) cumulative.push(cumulative[i - 1] + km(coords[i - 1], coords[i]));
        const total = cumulative[cumulative.length - 1] || 1;
        const start = Number(trip.properties?.startzeit || vehicle?.properties?.abfahrtstart || 0);
        const end = Number(trip.properties?.endzeit || vehicle?.properties?.ankunftziel || 0);
        const delay = Number(vehicle?.properties?.delay || 0);

        const matched = stops.map((stop) => {
          let best = { index: 0, distance: Infinity };
          for (const point of stop.coordinates) {
            const near = nearestRouteIndex(coords, point[0], point[1]);
            if (near.distance < best.distance) best = near;
          }
          if (best.distance >= 0.00075) return null;
          const predictedTime = start && end ? start + (end - start) * (cumulative[best.index] / total) + delay : null;
          return { name: stop.name, routeIndex: best.index, predictedTime };
        }).filter(Boolean) as RouteStop[];
        matched.sort((a, b) => a.routeIndex - b.routeIndex);
        const deduped = matched.filter((stop, i, arr) => !i || stop.routeIndex - arr[i - 1].routeIndex > 2);
        setRouteStops(deduped);
        map.fitBounds(L.latLngBounds(coords.map((c) => [c[1], c[0]] as [number, number])), { padding: [28, 28] });
      } catch { if (!cancelled) setMapError("Der Fahrtweg konnte gerade nicht geladen werden."); }
    })();
    return () => { cancelled = true; };
  }, [selectedTrip, stops]);

  function locate() {
    const map = mapRef.current; if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => { const point: [number, number] = [coords.latitude, coords.longitude]; map.setView(point, 15); L.circleMarker(point, { radius: 7, color: "#fff", weight: 3, fillColor: "#1686ff", fillOpacity: 1 }).addTo(map); }, () => setMapError("Standort nicht freigegeben."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  const currentStopIndex = routeStops.reduce((best, stop, i) => Math.abs(stop.routeIndex - progressIndex) < Math.abs(routeStops[best]?.routeIndex - progressIndex || Infinity) ? i : best, 0);

  return <section className="mapCard">
    <div className="mapHeader"><div><p className="eyebrow">Münster · live</p><h1>{selectedTrip ? `Linie ${selectedTrip.line}` : "Live-Karte"}</h1><p>{selectedTrip ? `Richtung ${selectedTrip.direction}` : `${vehicleCount} Busse live · Haltestellen ab Zoom 14`}</p></div><button className="round" onClick={locate} aria-label="Zu meinem Standort"><span className="locateDot">◎</span></button></div>
    {selectedTrip && <button className="mapReset" onClick={onClearTrip}>← Alle Busse anzeigen</button>}
    <div ref={mapNode} className="mapCanvas" />
    <div className="mapLegend">{selectedTrip ? <><span><i className="legendPast"/> gefahren</span><span><i className="legendFuture" style={{ background: color(selectedTrip.line) }}/> kommt noch</span></> : <span>Bus oder Haltestelle antippen</span>}{mapError && <span className="mapError">{mapError}</span>}</div>
    {selectedTrip && routeStops.length > 0 && <div className="tripTimeline">
      <div className="timelineHead"><div><p className="eyebrow neutral">Fahrtverlauf</p><h2>Linie {selectedTrip.line}</h2></div><span>{routeStops.length} Haltestellen</span></div>
      <p className="timelineHint">Voraussichtliche Zeiten inklusive aktueller Verspätung.</p>
      <div className="timelineStops">{routeStops.map((stop, i) => {
        const status = i < currentStopIndex ? "past" : i === currentStopIndex ? "current" : "upcoming";
        const label = status === "past" ? "vorbei" : status === "current" ? "gerade hier" : time(stop.predictedTime);
        return <button className={`timelineStop ${status}`} key={`${stop.name}-${i}`} onClick={() => onSelectStop(stop.name)}>
          <span className="timelineDot"/><span className="timelineName">{stop.name}</span><span className="timelineState">{label}</span>
        </button>;
      })}</div>
    </div>}
  </section>;
}
