import { useEffect, useMemo, useState } from 'react'

const dataUrl = file => `${import.meta.env.BASE_URL}data/${file}`
const valid = (x, y) => Number.isFinite(x) && Number.isFinite(y)
const number = n => n.toLocaleString('en-US')

function Pitch({ events, selectedId, onSelect }) {
  return <svg viewBox="0 0 1200 800" className="pitch" aria-label="Football event map" role="img">
    <rect width="1200" height="800" fill="#e6f3e1"/>
    {Array.from({length: 10}, (_, i) => <rect key={i} x={i * 120} width="120" height="800" fill={i % 2 ? '#d9ebd5' : '#edf7e9'} opacity=".55"/>)}
    <g stroke="#ffffff" strokeWidth="3.5" fill="none">
      <rect x="24" y="24" width="1152" height="752" rx="1"/><path d="M600 24 V776"/>
      <circle cx="600" cy="400" r="92"/><circle cx="600" cy="400" r="3" fill="white"/>
      <rect x="24" y="205" width="175" height="390"/><rect x="1001" y="205" width="175" height="390"/>
      <rect x="24" y="302" width="61" height="196"/><rect x="1115" y="302" width="61" height="196"/>
      <circle cx="144" cy="400" r="3" fill="white"/><circle cx="1056" cy="400" r="3" fill="white"/>
    </g>
    {events.map(e => {
      const x=e.x*10, y=e.y*10, ex=e.end_x*10, ey=e.end_y*10
      if (!valid(x,y)) return null
      const shot=e.type==='Shot', active=e.id===selectedId
      const c=e._color || (shot ? '#f46d79':'#0c6d41')
      return <g key={e.id} tabIndex="0" role="button" className="pitch-action" aria-label={`${e.player || 'Player'} ${e.type}, minute ${e.minute}`}
        opacity={selectedId && !active ? .22 : 1} onClick={() => onSelect(e.id)}
        onKeyDown={ev => {if(ev.key==='Enter' || ev.key===' ') {ev.preventDefault();onSelect(e.id)}}}>
        {valid(ex,ey) && <line x1={x} y1={y} x2={ex} y2={ey} stroke={c} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .48}/>}
        <circle cx={x} cy={y} r={active ? 8 : shot ? 5 : 3.2} fill={c} stroke={active ? '#fff' : 'none'} strokeWidth="3"/>
      </g>
    })}
  </svg>
}

function MiniPitch({ events, color }) {
  return <svg className="mini-pitch" viewBox="0 0 120 80" aria-hidden="true">
    <rect width="120" height="80" fill="#e8f3e7"/><g fill="none" stroke="#fff" strokeWidth=".7"><rect x="3" y="3" width="114" height="74"/><path d="M60 3v74"/><circle cx="60" cy="40" r="10"/><rect x="3" y="23" width="17" height="34"/><rect x="100" y="23" width="17" height="34"/></g>
    {events.slice(0,100).map((e,i) => valid(e.x,e.y) ? <circle key={i} cx={e.x} cy={e.y} r=".9" fill={color} opacity=".8"/>:null)}
  </svg>
}

function Metric({ label, left, right, leftName, rightName }) {
  const total=left+right
  return <div className="metric">
    <div className="metric-label">{label}</div>
    <div className="metric-values"><strong>{left}</strong><strong>{right}</strong></div>
    <div className="metric-bars" aria-label={`${leftName}: ${left}; ${rightName}: ${right}`}>
      <span style={{flex:total ? left/total : 1,background:'#174b83'}}/><span style={{flex:total ? right/total : 1,background:'#f26f7d'}}/>
    </div>
  </div>
}

export default function App(){
  const [matches,setMatches]=useState([])
  const [matchId,setMatchId]=useState('')
  const [events,setEvents]=useState([])
  const [country,setCountry]=useState('All countries')
  const [team,setTeam]=useState('All teams')
  const [player,setPlayer]=useState('All players')
  const [period,setPeriod]=useState('Full match')
  const [mode,setMode]=useState('Pass')
  const [selectedId,setSelectedId]=useState(null)
  const [error,setError]=useState('')
  const [insightTab,setInsightTab]=useState('Summary')
  const [showAll,setShowAll]=useState(true)

  useEffect(()=>{
    let live=true
    fetch(dataUrl('matches.json')).then(r=>{if(!r.ok)throw Error();return r.json()})
      .then(data=>{if(live){setMatches(data);const final=data.find(m=>m.home==='France' && m.away==='Croatia');if(data.length)setMatchId(String((final||data[0]).id))}})
      .catch(()=>{if(live)setError('Match catalogue unavailable. Check the data update workflow.')})
    return()=>{live=false}
  },[])
  useEffect(()=>{
    if(!matchId)return
    let live=true;setEvents([]);setError('');setTeam('All teams');setPlayer('All players');setSelectedId(null)
    fetch(dataUrl(`${matchId}.json`)).then(r=>{if(!r.ok)throw Error();return r.json()})
      .then(data=>{if(live)setEvents(data.events||[])})
      .catch(()=>{if(live)setError('Match events unavailable for this fixture.')})
    return()=>{live=false}
  },[matchId])

  const current=matches.find(m=>String(m.id)===matchId)
  const countries=[...new Set(matches.flatMap(m=>[m.home,m.away]))].sort()
  const fixtures=matches.filter(m=>country==='All countries'||m.home===country||m.away===country)
  const teams=[...new Set(events.map(e=>e.team).filter(Boolean))]
  const players=[...new Set(events.filter(e=>team==='All teams'||e.team===team).map(e=>e.player).filter(Boolean))].sort()
  const byPeriod=useMemo(()=>events.filter(e=>period==='Full match'||String(e.period)===period),[events,period])
  const filtered=useMemo(()=>byPeriod.filter(e=>(team==='All teams'||e.team===team)&&(player==='All players'||e.player===player)&&(mode==='All events'||e.type===mode)),[byPeriod,team,player,mode])
  const displayEvents=useMemo(()=>filtered.map(e=>({...e,_color:e.type==='Shot'?'#f26f7d':(current && e.team===current.away?'#f26f7d':'#174b83')})),[filtered,current])
  const selected=filtered.find(e=>e.id===selectedId)
  const stats=useMemo(()=> {
    const collect=name=>{
      const teamEvents=byPeriod.filter(e=>e.team===name)
      const passes=teamEvents.filter(e=>e.type==='Pass')
      const shots=teamEvents.filter(e=>e.type==='Shot')
      const complete=passes.filter(e=>e.outcome==='Complete').length
      const xg=shots.filter(e=>Number.isFinite(e.xg)).reduce((s,e)=>s+e.xg,0)
      return {passes:passes.length,shots:shots.length,complete,accuracy:passes.length?Math.round(100*complete/passes.length):0,xg}
    }
    return {home:collect(current?.home),away:collect(current?.away)}
  },[byPeriod,current])
  const homePasses=byPeriod.filter(e=>e.team===current?.home&&e.type==='Pass')
  const awayPasses=byPeriod.filter(e=>e.team===current?.away&&e.type==='Pass')
  const keyPasses=byPeriod.filter(e=>e.type==='Shot')
  const changeCountry=value=>{setCountry(value);const first=matches.find(m=>value==='All countries'||m.home===value||m.away===value);if(first)setMatchId(String(first.id))}
  const modes=[['Pass','Passes'],['Shot','Shots'],['All events','All actions']]

  return <div className="site" id="home">
    <header className="topbar"><nav aria-label="Main navigation"><a href="#explorer" className="nav-active">Matches</a><a href="#team-insights">Teams</a><a href="#player-filter">Players</a><a href="#about">About</a></nav><span className="competition-label">World Cup 2018 <span>⌄</span></span></header>
    <main className="dashboard" id="explorer">
      <section className="fixture-bar" aria-label="Match selection">
        <div className="fixture-select"><label htmlFor="country">Country</label><select id="country" value={country} onChange={e=>changeCountry(e.target.value)}><option>All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="fixture-centre"><div className="fixture-score">{current && Number.isFinite(current.home_score)&&Number.isFinite(current.away_score)?`${current.home_score} - ${current.away_score}`:'vs'}</div><div className="fixture-date">{current?.date||'Choose a match'}</div></div>
        <div className="fixture-select"><label htmlFor="fixture">Match</label><select id="fixture" value={matchId} onChange={e=>setMatchId(e.target.value)} disabled={!matches.length}>{!matches.length&&<option>Loading matches…</option>}{fixtures.map(m=><option key={m.id} value={m.id}>{m.home} vs {m.away}</option>)}</select></div>
      </section>
      <div className="dashboard-grid">
        <aside className="sidebar panel"><div className="side-label">Analysis</div><div className="mode-list">{modes.map(([value,label])=><button key={value} className={mode===value?'active':''} onClick={()=>{setMode(value);setSelectedId(null)}}><span className="mode-symbol">{value==='Pass'?'↗':value==='Shot'?'◎':'◌'}</span>{label}</button>)}</div>
          <div className="sidebar-divider"/><div className="side-label">Filters</div>
          <label className="field">Team<select value={team} onChange={e=>{setTeam(e.target.value);setPlayer('All players');setSelectedId(null)}}><option>All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="field" id="player-filter">Player<select value={player} onChange={e=>{setPlayer(e.target.value);setSelectedId(null)}}><option>All players</option>{players.map(p=><option key={p}>{p}</option>)}</select></label>
          <label className="field">Period<select value={period} onChange={e=>{setPeriod(e.target.value);setSelectedId(null)}}><option>Full match</option><option value="1">First half</option><option value="2">Second half</option><option value="3">Extra time 1</option><option value="4">Extra time 2</option></select></label>
          <label className="check-line"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show all filtered events</label>
        </aside>
        <section className="visual panel"><div className="visual-head"><div><span className="small-heading">MATCH MAP</span><p>{current?`${current.home} / ${current.away}`:'Match events'}</p></div><span className="visual-counter">{number(filtered.length)} events</span></div>
          {error?<div className="error">{error} <a href="https://github.com/tiffendericbourg/spatial-xi/actions/workflows/update-data.yml">Update data ↗</a></div>:<Pitch events={showAll?displayEvents:displayEvents.slice(0,400)} selectedId={selectedId} onSelect={setSelectedId}/>}
          <div className="pitch-legend"><span><i style={{background:'#174b83'}}/> {current?.home||'Home'}</span><span><i style={{background:'#f26f7d'}}/> {current?.away||'Away'}</span><span className="legend-hint">Select a point for details</span></div>
          <div className="event-strip">{selected?<><strong>{selected.player||'Unknown player'}</strong><span>{selected.team} · {selected.type} · {selected.minute}' · {selected.outcome||'No outcome recorded'}</span>{Number.isFinite(selected.xg)&&<span>xG {selected.xg.toFixed(3)}</span>}</>:<span>Explore passes, shots and their recorded locations on the pitch.</span>}</div>
        </section>
        <aside className="insights panel" id="team-insights"><div className="insight-tabs">{['Summary','Events'].map(v=><button className={insightTab===v?'active':''} key={v} onClick={()=>setInsightTab(v)}>{v}</button>)}</div>
          {insightTab==='Summary'?<><div className="team-key"><span><i className="home-dot"/> {current?.home||'Home'}</span><span><i className="away-dot"/> {current?.away||'Away'}</span></div>
            <Metric label="Passes" left={stats.home.passes} right={stats.away.passes} leftName={current?.home||'Home'} rightName={current?.away||'Away'}/>
            <Metric label="Pass accuracy" left={stats.home.accuracy} right={stats.away.accuracy} leftName={current?.home||'Home'} rightName={current?.away||'Away'}/>
            <Metric label="Shots" left={stats.home.shots} right={stats.away.shots} leftName={current?.home||'Home'} rightName={current?.away||'Away'}/>
            <Metric label="Recorded xG" left={Number(stats.home.xg.toFixed(2))} right={Number(stats.away.xg.toFixed(2))} leftName={current?.home||'Home'} rightName={current?.away||'Away'}/>
          </>:<div className="event-list">{filtered.slice(0,16).map(e=><button key={e.id} onClick={()=>setSelectedId(e.id)}><b>{e.minute}'</b><span>{e.player||'Unknown'} · {e.type}</span></button>)}{!filtered.length&&<p>No events for this selection.</p>}</div>}
        </aside>
      </div>
      <section className="detail-cards" aria-label="Match breakdown">
        <article className="small-card panel"><MiniPitch events={homePasses} color="#174b83"/><div><span>HOME TEAM</span><h3>{current?.home||'Home'} passes</h3><strong>{number(stats.home.passes)}</strong></div></article>
        <article className="small-card panel"><MiniPitch events={awayPasses} color="#f26f7d"/><div><span>AWAY TEAM</span><h3>{current?.away||'Away'} passes</h3><strong>{number(stats.away.passes)}</strong></div></article>
        <article className="small-card panel"><MiniPitch events={keyPasses} color="#137d52"/><div><span>SHOT LOCATIONS</span><h3>Recorded shots</h3><strong>{number(keyPasses.length)}</strong></div></article>
      </section>
      <footer id="about"><span>Spatial XI · Football spatial analysis</span><span>2018 World Cup events · <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noreferrer">StatsBomb Open Data ↗</a> · <a href="https://github.com/tiffendericbourg/spatial-xi" target="_blank" rel="noreferrer">GitHub ↗</a></span></footer>
    </main>
  </div>
}
