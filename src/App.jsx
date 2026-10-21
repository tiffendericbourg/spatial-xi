import { useEffect, useMemo, useState } from 'react'

const dataUrl = file => `${import.meta.env.BASE_URL}data/${file}`
const valid = (x, y) => Number.isFinite(x) && Number.isFinite(y)
const number = n => n.toLocaleString('en-US')
const distance = e => Number.isFinite(e.end_x) && Number.isFinite(e.end_y)
  ? Math.hypot((e.end_x - e.x) * 105 / 120, (e.end_y - e.y) * 68 / 80) : null
const formatMeters = d => d == null ? '—' : `${d.toFixed(1)} m`
const completedPass = e => e.type === 'Pass' && e.outcome === 'Complete'
// StatsBomb pitch coordinates always increase towards the attacking goal.
const forwardGain = e => completedPass(e) && valid(e.x, e.y) && valid(e.end_x, e.end_y)
  ? Math.max(0, (e.end_x - e.x) * 105 / 120) : 0
const isForwardPass = e => forwardGain(e) > 0
const efficiency = e => {
  const gain=forwardGain(e)
  if(!gain)return 0
  if(Number.isFinite(e.bypassed))return gain*(1+.4*e.bypassed)
  const lateral=Math.abs(e.end_y-e.y)*68/80
  return gain*(.6+.4*gain/Math.max(1,Math.hypot(gain,lateral)))
}
const pitchLines = <g fill="none" stroke="#fff" strokeWidth="3"><rect x="24" y="24" width="1152" height="752"/><path d="M600 24V776"/><circle cx="600" cy="400" r="92"/><rect x="24" y="205" width="175" height="390"/><rect x="1001" y="205" width="175" height="390"/><rect x="24" y="302" width="61" height="196"/><rect x="1115" y="302" width="61" height="196"/></g>

function HeatPitch({ events }) {
  const cells = Array.from({length: 24 * 16}, (_, i) => {
    const col = i % 24, row = Math.floor(i / 24)
    const count = events.filter(e => valid(e.x, e.y) && Math.floor(e.x / 5) === col && Math.floor(e.y / 5) === row).length
    return {col, row, count}
  })
  const top = Math.max(1, ...cells.map(c => c.count))
  return <svg viewBox="0 0 1200 800" className="pitch" role="img" aria-label="Heat map of selected event origins">
    <rect width="1200" height="800" fill="#e6f3e1"/>
    {cells.map(c => c.count > 0 && <rect key={`${c.col}-${c.row}`} x={c.col * 50} y={c.row * 50} width="50" height="50" fill="#ed714e" opacity={.12 + .78 * Math.sqrt(c.count / top)}/>)}
    {pitchLines}
  </svg>
}

function NetworkPitch({ events, onPlayer }) {
  const passes = events.filter(e => completedPass(e) && e.recipient && e.player && e.recipient !== e.player && valid(e.x,e.y))
  const nodes = {}
  const edges = {}
  passes.forEach(e => {
    if (!nodes[e.player]) nodes[e.player] = {name:e.player,x:0,y:0,n:0}
    nodes[e.player].x += e.x; nodes[e.player].y += e.y; nodes[e.player].n++
    const key = [e.player,e.recipient].sort().join('||')
    edges[key] = (edges[key] || 0) + 1
  })
  const positions = Object.values(nodes).filter(n => n.n >= 2).map(n => ({...n,x:n.x / n.n * 10,y:n.y / n.n * 10}))
  const lookup = Object.fromEntries(positions.map(n => [n.name,n]))
  const links = Object.entries(edges).map(([key,count]) => ({names:key.split('||'),count})).filter(e => e.names.every(n => lookup[n]))
  const maxLink = Math.max(1,...links.map(e=>e.count))
  const maxNode = Math.max(1,...positions.map(n=>n.n))
  return <div className="network-wrap"><svg className="pitch" viewBox="0 0 1200 800" role="img" aria-label="Completed pass network between teammates">
    <rect width="1200" height="800" fill="#e6f3e1"/>{pitchLines}
    {links.map(e => <line key={e.names.join('-')} x1={lookup[e.names[0]].x} y1={lookup[e.names[0]].y} x2={lookup[e.names[1]].x} y2={lookup[e.names[1]].y} stroke="#176e58" strokeWidth={2+13*e.count/maxLink} opacity=".5"/>)}
    {positions.map(n => <g key={n.name} className="network-player" role="button" tabIndex="0" onClick={()=>onPlayer(n.name)} onKeyDown={e=>{if(e.key==='Enter')onPlayer(n.name)}}>
      <circle cx={n.x} cy={n.y} r={11+18*n.n/maxNode} fill="#174b83" stroke="white" strokeWidth="3"/>
      <text x={n.x} y={n.y+44} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1c3d46" stroke="#e6f3e1" strokeWidth="5" paintOrder="stroke">{n.name.split(' ').slice(-1)[0]}</text>
      <title>{n.name}: {n.n} completed passes sent</title>
    </g>)}
  </svg>
  {!passes.length && <div className="network-empty">Recipient data is not available for this selection yet. Update the match data to build the network.</div>}</div>
}


function Pitch({ events, selectedId, onSelect }) {
  return <svg viewBox="0 0 1200 800" className="pitch" aria-label="Football event map" role="img">
    <defs><marker id="pass-arrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="none" stroke="#34546a" strokeWidth="1"/></marker></defs>
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
        {valid(ex,ey) && <line x1={x} y1={y} x2={ex} y2={ey} stroke={c} strokeWidth={active ? 4 : e._forward ? 2.5 + Math.min(3,forwardGain(e)/18) : 1.8} strokeDasharray={e.type==='Pass' && e.outcome!=='Complete' ? '8 6' : undefined} markerEnd={e.type==='Pass' && (active || e._forward) ? 'url(#pass-arrow)' : undefined} opacity={active ? 1 : .43}/>}
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
  const [year,setYear]=useState('2018')
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
      .then(data=>{if(live){setMatches(data);const final=data.find(m=>(m.year||2018)===2018&&m.home==='France'&&m.away==='Croatia');if(data.length)setMatchId(String((final||data.find(m=>(m.year||2018)===2018)||data[0]).id))}})
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
  const countries=[...new Set(matches.filter(m=>String(m.year||2018)===year).flatMap(m=>[m.home,m.away]))].sort()
  const yearMatches=matches.filter(m=>String(m.year||2018)===year)
  const fixtures=yearMatches.filter(m=>country==='All countries'||m.home===country||m.away===country)
  const teams=[...new Set(events.map(e=>e.team).filter(Boolean))]
  const players=[...new Set(events.filter(e=>team==='All teams'||e.team===team).map(e=>e.player).filter(Boolean))].sort()
  const byPeriod=useMemo(()=>events.filter(e=>period==='Full match'||String(e.period)===period),[events,period])
  const filtered=useMemo(()=>byPeriod.filter(e=>(team==='All teams'||e.team===team)&&(player==='All players'||e.player===player)&&(mode==='All events'||mode==='Network'||mode==='Heatmap'||(mode==='Forward'&&isForwardPass(e))||(mode==='Efficiency'&&efficiency(e)>0)||e.type===mode)),[byPeriod,team,player,mode])
  const displayEvents=useMemo(()=>filtered.map(e=>({...e,_forward:mode==='Forward'||mode==='Efficiency',_color:mode==='Efficiency'?'#b66d18':mode==='Forward'?'#11855b':e.type==='Shot'?'#f26f7d':(current && e.team===current.away?'#f26f7d':'#174b83')})),[filtered,current,mode])
  const selected=filtered.find(e=>e.id===selectedId)
  const passesForMetrics=filtered.filter(e=>e.type==='Pass' && distance(e)!==null)
  const passDistances=passesForMetrics.map(e=>({...e,meters:distance(e)}))
  const longest=passDistances.length?passDistances.reduce((a,b)=>a.meters>b.meters?a:b):null
  const averageDistance=passDistances.length?passDistances.reduce((sum,e)=>sum+e.meters,0)/passDistances.length:null
  const distanceLeader=Object.entries(passDistances.reduce((acc,e)=>{if(e.player)acc[e.player]=(acc[e.player]||0)+e.meters;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const progressivePasses=byPeriod.filter(e=>(team==='All teams'||e.team===team)&&isForwardPass(e))
  const forwardRanking=Object.values(progressivePasses.reduce((result,e)=>{
    if(!e.player)return result
    const key=`${e.team}::${e.player}`
    if(!result[key])result[key]={player:e.player,team:e.team,gain:0,passes:0}
    result[key].gain+=forwardGain(e)
    result[key].passes++
    return result
  },{})).sort((a,b)=>b.gain-a.gain)
  const forwardTotal=filtered.filter(isForwardPass).reduce((sum,e)=>sum+forwardGain(e),0)
  const efficiencyRanking=Object.values(byPeriod.filter(e=>(team==='All teams'||e.team===team)&&efficiency(e)>0).reduce((acc,e)=>{
    if(!e.player)return acc
    const key=e.team+'::'+e.player
    if(!acc[key])acc[key]={team:e.team,player:e.player,score:0,passes:0,bypassed:0,observed:0}
    acc[key].score+=efficiency(e);acc[key].passes++
    if(Number.isFinite(e.bypassed)){acc[key].bypassed+=e.bypassed;acc[key].observed++}
    return acc
  },{})).sort((a,b)=>b.score-a.score)
  const chartEvents=mode==='Network'?filtered.filter(e=>e.type==='Pass'):filtered
  const networkTeam=team==='All teams'?(current?.home||''):team
  const networkEvents=chartEvents.filter(e=>e.team===networkTeam)
  const handleNetworkPlayer=name=>{setPlayer(name);setMode('Pass');setSelectedId(null)}
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
  const changeCountry=value=>{setCountry(value);const first=yearMatches.find(m=>value==='All countries'||m.home===value||m.away===value);if(first)setMatchId(String(first.id))}
  const changeYear=value=>{setYear(value);setCountry('All countries');const first=matches.find(m=>String(m.year||2018)===value);if(first)setMatchId(String(first.id))}
  const modes=[['Pass','Passes'],['Forward','Forward passes'],['Efficiency','Pass efficiency'],['Shot','Shots'],['Carry','Carries'],['Dribble','Dribbles'],['Ball Receipt*','Ball receipts'],['All events','All actions'],['Network','Pass network'],['Heatmap','Heat map']]

  return <div className="site" id="home">
    <header className="topbar"><nav aria-label="Main navigation"><a href="#explorer" className="nav-active">Matches</a><a href="#team-insights">Teams</a><a href="#player-filter">Players</a><a href="#about">About</a></nav><span className="competition-label">World Cup {year} <span>⌄</span></span></header>
    <main className="dashboard" id="explorer">
      <section className="fixture-bar" aria-label="Match selection"><div className="fixture-select"><label htmlFor="tournament">Tournament</label><select id="tournament" value={year} onChange={e=>changeYear(e.target.value)}><option value="2018">World Cup 2018</option><option value="2022" disabled={!matches.some(m=>m.year===2022)}>World Cup 2022</option></select></div>
        <div className="fixture-select"><label htmlFor="country">Country</label><select id="country" value={country} onChange={e=>changeCountry(e.target.value)}><option>All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="fixture-centre"><div className="fixture-score">{current && Number.isFinite(current.home_score)&&Number.isFinite(current.away_score)?`${current.home_score} - ${current.away_score}`:'vs'}</div><div className="fixture-date">{current?.date||'Choose a match'}</div></div>
        <div className="fixture-select"><label htmlFor="fixture">Match</label><select id="fixture" value={matchId} onChange={e=>setMatchId(e.target.value)} disabled={!matches.length}>{!matches.length&&<option>Loading matches…</option>}{fixtures.map(m=><option key={m.id} value={m.id}>{m.home} vs {m.away}</option>)}</select></div>
      </section>
      <div className="dashboard-grid">
        <aside className="sidebar panel"><div className="side-label">Analysis</div><div className="mode-list">{modes.map(([value,label])=><button key={value} className={mode===value?'active':''} onClick={()=>{setMode(value);setSelectedId(null)}}><span className="mode-symbol">{value==='Efficiency'?'✦':value==='Forward'?'⇢':value==='Pass'?'↗':value==='Shot'?'◎':value==='Network'?'◇':value==='Heatmap'?'▦':'◌'}</span>{label}</button>)}</div>
        </aside>
        <section className="visual panel"><div className="visual-head"><div><span className="small-heading">MATCH MAP</span><p>{current?`${current.home} / ${current.away}`:'Match events'}</p></div><span className="visual-counter">{number(filtered.length)} {mode==='Forward'?'forward passes':'events'}</span></div>
          <div className="pitch-filters" aria-label="Pitch filters">
          <label className="pitch-filter">Team<select value={team} onChange={e=>{setTeam(e.target.value);setPlayer('All players');setSelectedId(null)}}><option>All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="pitch-filter" id="player-filter">Player<select value={player} onChange={e=>{setPlayer(e.target.value);setSelectedId(null)}}><option>All players</option>{players.map(p=><option key={p}>{p}</option>)}</select></label>
          <label className="pitch-filter">Period<select value={period} onChange={e=>{setPeriod(e.target.value);setSelectedId(null)}}><option>Full match</option><option value="1">First half</option><option value="2">Second half</option><option value="3">Extra time 1</option><option value="4">Extra time 2</option></select></label>
          <label className="pitch-check"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show all filtered events</label>
          </div>
          {error?<div className="error">{error} <a href="https://github.com/tiffendericbourg/spatial-xi/actions/workflows/update-data.yml">Update data ↗</a></div>:mode==='Heatmap'?<HeatPitch events={filtered}/>:mode==='Network'?<NetworkPitch events={networkEvents} onPlayer={handleNetworkPlayer}/>:<Pitch events={showAll?displayEvents:displayEvents.slice(0,400)} selectedId={selectedId} onSelect={setSelectedId}/>}
          <div className="pitch-legend"><span><i style={{background:'#174b83'}}/> {current?.home||'Home'}</span><span><i style={{background:'#f26f7d'}}/> {current?.away||'Away'}</span><span className="legend-hint">{mode==='Network'?'Select a player · choose a team for its network':mode==='Heatmap'?'Darker areas = more actions':mode==='Efficiency'?'Amber arrows · thicker = higher efficiency':mode==='Forward'?'Green arrows · thicker = greater territory gained':'Select a point for details'}</span></div>
          <div className="event-strip">{selected?<><strong>{selected.player||'Unknown player'}</strong><span>{selected.team} · {selected.type} · {selected.minute}' · {selected.outcome||'No outcome recorded'}</span>{Number.isFinite(selected.xg)&&<span>xG {selected.xg.toFixed(3)}</span>}{selected.type==='Pass'&&<span>{mode==='Forward'?`Ground gained ${formatMeters(forwardGain(selected))} · `:''}Distance {formatMeters(distance(selected))}{selected.recipient?` · To ${selected.recipient}`:''}{efficiency(selected)>0?` · PEI ${efficiency(selected).toFixed(1)}${Number.isFinite(selected.bypassed)?` · ${selected.bypassed} visible opponents bypassed`:' · estimated'}`:''}</span>}</>:<span>Explore passes, shots and their recorded locations on the pitch.</span>}</div>
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
      <section className="distance-section panel" aria-label="Passing distance insights">
        <div className="distance-heading"><span className="small-heading">PASS DISTANCE / METRES</span><span>Based on recorded start and end locations · approx. 105 × 68 m pitch</span></div>
        <div className="distance-grid">
          <div><span>Average pass</span><strong>{formatMeters(averageDistance)}</strong><small>{number(passDistances.length)} located passes in selection</small></div>
          <div><span>Longest pass</span><strong>{formatMeters(longest?.meters)}</strong><small>{longest ? `${longest.player || 'Unknown'} · ${longest.minute}'` : 'No passes'}</small></div>
          <div><span>Most metres passed</span><strong>{distanceLeader ? formatMeters(distanceLeader[1]) : '—'}</strong><small>{distanceLeader?.[0] || 'No passes'}</small></div>
        </div>
      </section>
      <section className="forward-section panel" aria-label="Forward passing leaderboard">
        <div className="forward-title">
          <div><span className="small-heading">TERRITORY GAINED</span><h2>Forward passing leaderboard</h2><p>Successful passes only. Ranked by cumulative metres advanced toward goal, not simply pass count.</p></div>
          <button className="forward-open" onClick={()=>{setMode('Forward');setSelectedId(null)}}>View on pitch ↗</button>
        </div>
        <div className="forward-summary"><strong>{formatMeters(forwardTotal)}</strong><span>Forward metres in the current map selection</span></div>
        <div className="forward-table">
          {forwardRanking.slice(0,10).map((entry,i)=><button key={entry.team+entry.player} className={player===entry.player&&team===entry.team?'selected':''} onClick={()=>{setTeam(entry.team);setPlayer(entry.player);setMode('Forward');setSelectedId(null);document.getElementById('explorer')?.scrollIntoView({behavior:'smooth'})}}>
            <span className="forward-rank">{String(i+1).padStart(2,'0')}</span>
            <span className="forward-person"><b>{entry.player}</b><small>{entry.team} · {entry.passes} forward passes</small></span>
            <span className="forward-track"><i style={{width:`${100*entry.gain/forwardRanking[0].gain}%`}}/></span>
            <strong>{formatMeters(entry.gain)}</strong>
          </button>)}
          {!forwardRanking.length&&<p className="forward-empty">No completed forward passes for these filters.</p>}
        </div>
        <p className="forward-note">Direction follows StatsBomb's standardised attacking coordinates. Lateral distance is excluded from territory gained. Choose a row to highlight that player's passes on the pitch.</p>
      </section>
      <section className="forward-section panel" aria-label="Pass efficiency leaderboard">
        <div className="forward-title"><div><span className="small-heading">CUSTOM SPATIAL METRIC</span><h2>Pass Efficiency Index</h2><p>{year==='2018'?'2018 · estimated from forward metres and direction.':'2022 · observed opponent positions when StatsBomb 360 is available; estimated otherwise.'}</p></div><button className="forward-open" onClick={()=>{setMode('Efficiency');setSelectedId(null);document.getElementById('explorer')?.scrollIntoView({behavior:'smooth'})}}>View on pitch ↗</button></div>
        <div className="forward-table">{efficiencyRanking.slice(0,10).map((entry,i)=><button key={entry.team+entry.player} onClick={()=>{setTeam(entry.team);setPlayer(entry.player);setMode('Efficiency');setSelectedId(null);document.getElementById('explorer')?.scrollIntoView({behavior:'smooth'})}}>
          <span className="forward-rank">{String(i+1).padStart(2,'0')}</span><span className="forward-person"><b>{entry.player}</b><small>{entry.team} · {entry.passes} passes · {entry.observed?entry.bypassed+' bypassed on '+entry.observed+' observed passes':'estimated'}</small></span><span className="forward-track"><i style={{width:`${100*entry.score/efficiencyRanking[0].score}%`}}/></span><strong>{entry.score.toFixed(1)}</strong>
        </button>)}{!efficiencyRanking.length&&<p className="forward-empty">No eligible passes for this selection.</p>}</div>
        <p className="forward-note">PEI: forward metres × (1 + 0.4 × opponents bypassed) when 360 positions are available. Without 360: forward metres adjusted by pass directness. Experimental indicator; mixed observation coverage can affect comparisons.</p>
      </section>
      <section className="detail-cards" aria-label="Match breakdown">
        <article className="small-card panel"><MiniPitch events={homePasses} color="#174b83"/><div><span>HOME TEAM</span><h3>{current?.home||'Home'} passes</h3><strong>{number(stats.home.passes)}</strong></div></article>
        <article className="small-card panel"><MiniPitch events={awayPasses} color="#f26f7d"/><div><span>AWAY TEAM</span><h3>{current?.away||'Away'} passes</h3><strong>{number(stats.away.passes)}</strong></div></article>
        <article className="small-card panel"><MiniPitch events={keyPasses} color="#137d52"/><div><span>SHOT LOCATIONS</span><h3>Recorded shots</h3><strong>{number(keyPasses.length)}</strong></div></article>
      </section>
      <footer id="about"><span>Spatial XI · Football spatial analysis</span><span>2018 World Cup events · <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noreferrer">StatsBomb Open Data ↗</a> · <a href="https://github.com/tiffendericbourg/spatial-xi" target="_blank" rel="noreferrer">GitHub ↗</a></span></footer>
    </main>
  </div>
}
