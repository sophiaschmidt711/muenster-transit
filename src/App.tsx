import { ArrowRight, BusFront, Clock3, Map, Navigation, Search, ShieldCheck, Star, TrendingUp } from "lucide-react";

type Departure = { line:string; destination:string; minutes:number; delay:number; reliability:number; color:string };

const departures: Departure[] = [
  { line:"11", destination:"Dieckmannstraße", minutes:3, delay:2, reliability:91, color:"#6a55e8" },
  { line:"2", destination:"Alte Sternwarte", minutes:7, delay:0, reliability:96, color:"#2785d8" },
  { line:"14", destination:"Zoo", minutes:11, delay:4, reliability:76, color:"#d56a4c" }
];

function Reliability({value}:{value:number}) {
  const cls=value>=90?"good":value>=80?"medium":"risky";
  return <span className={`pill ${cls}`}><ShieldCheck size={13}/>{value}%</span>;
}

export default function App(){
  return <div className="shell">
    <main className="app">
      <header><div><p className="eyebrow">Münster · live</p><h1>Wohin geht’s?</h1></div></header>
      <button className="search"><Search size={20}/><span>Haltestelle oder Ziel suchen</span></button>

      <section className="card nearby">
        <div className="cardhead"><div><span className="tiny"><Navigation size={13}/>In deiner Nähe</span><h2>Aegidiimarkt</h2><p>ca. 3 Min zu Fuß</p></div><button className="icon"><Star size={20}/></button></div>
        <div className="departures">
          {departures.map(d=><button className="departure" key={d.line+d.destination}>
            <span className="line" style={{background:d.color}}>{d.line}</span>
            <span className="copy"><strong>{d.destination}</strong><span className="meta"><Reliability value={d.reliability}/>{d.delay?`+${d.delay} min`:"pünktlich"}</span></span>
            <span className="mins"><strong>{d.minutes}</strong><small>min</small></span>
          </button>)}
        </div>
      </section>

      <section className="card connection">
        <div className="sectionhead"><div><p className="eyebrow neutral">Dein möglicher Anschluss</p><h2>Schaffst du die 2?</h2></div><span className="chance">84%</span></div>
        <div className="flow">
          <div className="route"><span className="routebadge purple">11</span><span><strong>Aegidiimarkt → Hauptbahnhof</strong><small>voraussichtlich 13:48 · +2 min</small></span></div>
          <div className="transfer"><span></span><div><Clock3 size={15}/>5 Min Umstieg</div></div>
          <div className="route"><span className="routebadge blue">2</span><span><strong>Hauptbahnhof → Alte Sternwarte</strong><small>Abfahrt 13:53</small></span></div>
        </div>
        <div className="prediction"><ShieldCheck size={17}/><span><strong>Sieht gut aus.</strong> In 84% vergleichbarer Fahrten hätte dieser Anschluss funktioniert.</span></div>
      </section>

      <section className="card stats">
        <div className="sectionhead"><div><p className="eyebrow neutral">Letzte 30 Tage</p><h2>Linie 11</h2></div><TrendingUp size={22}/></div>
        <div className="statgrid"><div><strong>91%</strong><span>unter 5 Min</span></div><div><strong>+2,4</strong><span>Ø Verspätung</span></div><div><strong>3%</strong><span>Ausfälle</span></div></div>
        {[['Pünktlich','62%'],['1–5 min','29%'],['>5 min','9%']].map(([label,value])=><div className="bar" key={label}><span>{label}</span><i><b style={{width:value}}/></i><strong>{value}</strong></div>)}
      </section>

      <button className="card mapcard"><div className="mapmock"><span className="road a"/><span className="road b"/><span className="routeLine"/><span className="vehicle">11</span></div><div className="mapcopy"><div><p className="eyebrow neutral">Live-Karte</p><strong>Busse um dich herum</strong></div><ArrowRight size={21}/></div></button>
    </main>
    <nav><button className="active"><BusFront size={20}/><span>Jetzt</span></button><button><Map size={20}/><span>Karte</span></button><button><TrendingUp size={20}/><span>Statistik</span></button></nav>
  </div>
}
