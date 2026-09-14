import { useMemo, useState } from "react";
import { ArrowLeftRight, Clock3, ShieldCheck, TrendingUp } from "lucide-react";

const ROUTING = "https://v6.db.transport.rest";

type StopRef = { id?: string; name?: string };
type Leg = { origin?: StopRef; destination?: StopRef; departure?: string; plannedDeparture?: string; arrival?: string; plannedArrival?: string; walking?: boolean; line?: { name?: string; productName?: string } };
type Journey = { legs?: Leg[] };
type Found = { id?: string; name?: string };

type Props = { initialFrom?: string };

const time = (iso?: string) => iso ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "–";
const diff = (a?: string, b?: string) => a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0;

function stats(journey: Journey) {
  const legs = journey.legs || [];
  const transit = legs.filter((leg) => !leg.walking && leg.line);
  const first = legs[0], last = legs[legs.length - 1];
  const duration = diff(first?.departure || first?.plannedDeparture, last?.arrival || last?.plannedArrival);
  const planned = diff(first?.plannedDeparture || first?.departure, last?.plannedArrival || last?.arrival);
  const delays = transit.map((leg) => diff(leg.plannedArrival, leg.arrival)).filter(Number.isFinite);
  const gaps: number[] = [];
  for (let i = 0; i < transit.length - 1; i++) gaps.push(diff(transit[i].arrival, transit[i + 1].departure));
  return { duration, delay: Math.max(0, duration - planned), transfers: Math.max(0, transit.length - 1), minGap: gaps.length ? Math.min(...gaps) : null, maxLegDelay: delays.length ? Math.max(...delays) : 0 };
}

async function resolveStop(query: string): Promise<{ id: string; name: string }> {
  const q = query.trim();
  const response = await fetch(`${ROUTING}/locations?query=${encodeURIComponent(q.includes("Münster") ? q : `${q}, Münster`)}&results=10&language=de`, { cache: "no-store" });
  if (!response.ok) throw new Error("Ort konnte nicht gefunden werden.");
  const results = await response.json() as Found[];
  const hit = results.find((x) => x.id && (x.name || "").toLowerCase().includes("münster")) || results.find((x) => x.id);
  if (!hit?.id) throw new Error(`„${q}“ wurde nicht gefunden.`);
  return { id: hit.id, name: hit.name || q };
}

async function nearestStop() {
  const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }));
  const response = await fetch(`${ROUTING}/locations/nearby?latitude=${coords.latitude}&longitude=${coords.longitude}&results=8&distance=1500`, { cache: "no-store" });
  if (!response.ok) throw new Error("Keine Haltestelle in der Nähe gefunden.");
  const results = await response.json() as Found[];
  const hit = results.find((x) => x.id);
  if (!hit?.id) throw new Error("Keine Haltestelle in der Nähe gefunden.");
  return { id: hit.id, name: hit.name || "Mein Standort" };
}

export default function PlannerView({ initialFrom = "Mein Standort" }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState("");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"fast" | "safe">("fast");

  const ordered = useMemo(() => [...journeys].sort((a, b) => {
    const x = stats(a), y = stats(b);
    if (sort === "fast") return x.duration - y.duration;
    return (y.minGap ?? 999) - (x.minGap ?? 999) || x.duration - y.duration;
  }), [journeys, sort]);

  async function search() {
    if (!to.trim()) { setError("Bitte zuerst ein Ziel eingeben."); return; }
    setLoading(true); setError(""); setJourneys([]);
    try {
      const [start, target] = await Promise.all([from.trim().toLowerCase() === "mein standort" ? nearestStop() : resolveStop(from), resolveStop(to)]);
      const p = new URLSearchParams({ from: start.id, to: target.id, results: "5", stopovers: "true", language: "de" });
      const response = await fetch(`${ROUTING}/journeys?${p}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Die Verbindungssuche ist gerade nicht verfügbar.");
      const data = await response.json() as { journeys?: Journey[] };
      if (!data.journeys?.length) throw new Error("Keine Verbindung gefunden.");
      setFrom(start.name); setTo(target.name); setJourneys(data.journeys);
    } catch (e) { setError(e instanceof Error ? e.message : "Verbindung konnte nicht geladen werden."); }
    finally { setLoading(false); }
  }

  function swap() { const old = from; setFrom(to || "Mein Standort"); setTo(old === "Mein Standort" ? "" : old); }

  return <main className="app planPage">
    <header className="topbar planTop"><div><p className="eyebrow">Münster · planen</p><h1>Deine Fahrt</h1></div></header>
    <section className="card planner">
      <div className="planField"><span>Von</span><input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Start" /></div>
      <button className="swap" onClick={swap} aria-label="Start und Ziel tauschen"><ArrowLeftRight size={18}/></button>
      <div className="planField"><span>Nach</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Haltestelle oder Ort" /></div>
      <button className="primary" onClick={search}>{loading ? "Suche …" : "Verbindung suchen"}</button>
      {error && <div className="planMessage error">{error}</div>}
    </section>

    {!!journeys.length && <>
      <div className="routeSort"><button className={sort === "fast" ? "active" : ""} onClick={() => setSort("fast")}><Clock3 size={15}/> Schnellste</button><button className={sort === "safe" ? "active" : ""} onClick={() => setSort("safe")}><ShieldCheck size={15}/> Sicherste</button></div>
      <div className="journeyList">{ordered.map((journey, index) => {
        const s = stats(journey); const legs = journey.legs || []; const first = legs[0], last = legs[legs.length - 1];
        const transit = legs.filter((leg) => !leg.walking && leg.line);
        return <section className="card journeyCard" key={index}>
          <div className="journeyHead"><div><strong>{time(first?.departure || first?.plannedDeparture)} → {time(last?.arrival || last?.plannedArrival)}</strong><span>{s.duration} Min. · {s.transfers ? `${s.transfers}× umsteigen` : "direkt"}</span></div><div className={s.minGap != null && s.minGap < 6 ? "risk bad" : "risk good"}>{s.minGap == null ? "direkt" : `${s.minGap} Min. Umstieg`}</div></div>
          <div className="journeyLines">{transit.map((leg, i) => <span key={i}>{leg.line?.name || leg.line?.productName || "ÖPNV"}</span>)}</div>
          <div className="journeyStats"><span><TrendingUp size={14}/>{s.delay > 0 ? `aktuell +${s.delay} Min.` : "aktuell pünktlich"}</span><span><ShieldCheck size={14}/>{s.minGap == null ? "kein Anschluss nötig" : s.minGap >= 8 ? "guter Puffer" : s.minGap >= 5 ? "knapper Puffer" : "hohes Anschlussrisiko"}</span></div>
          <div className="journeyLegs">{transit.map((leg, i) => <div className="journeyLeg" key={i}><span className="journeyDot"/><div><strong>{leg.origin?.name || "Start"}</strong><small>{time(leg.departure || leg.plannedDeparture)} · {leg.line?.name || leg.line?.productName}</small></div><div className="legArrival"><strong>{leg.destination?.name || "Ziel"}</strong><small>{time(leg.arrival || leg.plannedArrival)}</small></div></div>)}</div>
        </section>;
      })}</div>
    </>}
  </main>;
}
