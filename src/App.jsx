import { useEffect, useMemo, useState } from 'react'

const dataUrl = file => `${import.meta.env.BASE_URL}data/${file}`
const valid = (x, y) => Number.isFinite(x) && Number.isFinite(y)
const number = n => n.toLocaleString('en-US')
const distance = e => Number.isFinite(e.end_x) && Number.isFinite(e.end_y)
  ? Math.hypot((e.end_x - e.x) * 105 / 120, (e.end_y - e.y) * 68 / 80) : null
const formatMeters = d => d == null ? '—' : `${d.toFixed(1)} m`
const outfieldAction = e => e.type !== 'Pass' || !e.is_goalkeeper
const completedPass = e => e.type === 'Pass' && !e.is_goalkeeper && e.outcome === 'Complete'
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
      const shot=e.type==='Shot', dribble=e.type==='Dribble', active=e.id===selectedId
      const c=e._color || (shot ? '#f46d79':'#0c6d41')
      return <g key={e.id} tabIndex="0" role="button" className="pitch-action" aria-label={`${e.player || 'Player'} ${e.type}, minute ${e.minute}`}
        opacity={selectedId && !active ? .22 : 1} onClick={() => onSelect(e.id)}
        onKeyDown={ev => {if(ev.key==='Enter' || ev.key===' ') {ev.preventDefault();onSelect(e.id)}}}>
        {valid(ex,ey) && <line x1={x} y1={y} x2={ex} y2={ey} stroke={c} strokeWidth={active ? 4 : e._efficiency ? 2.5 + Math.min(4,efficiency(e)/30) : e._forward ? 2.5 + Math.min(3,forwardGain(e)/18) : 1.8} strokeDasharray={e.type==='Pass' && e.outcome!=='Complete' ? '8 6' : undefined} markerEnd={e.type==='Pass' && (active || e._forward) ? 'url(#pass-arrow)' : undefined} opacity={active ? 1 : .43}/>}
        {dribble
          ? <><circle cx={x} cy={y} r={active?13:9} fill={e.outcome==='Complete'?'#1e9b67':'#f26f7d'} stroke="white" strokeWidth={active?3:2} opacity=".95"/><circle cx={x} cy={y} r={active?5:3} fill="white"/></>
          : <circle cx={x} cy={y} r={active ? 8 : shot ? 5 : 3.2} fill={c} stroke={active ? '#fff' : 'none'} strokeWidth="3"/>}
      </g>
    })}
  </svg>
}

function SpatialKeeperMap({ shots, activeId, onSelect }) {
  const selected=shots.find(s=>s.id===activeId)||shots.find(s=>Array.isArray(s.keeper_xy))||shots[0]
  return <div className="keeper-map-layout">
    <svg viewBox="0 0 1200 800" className="pitch" role="img" aria-label="Shot locations and goalkeeper positioning">
      <rect width="1200" height="800" fill="#e6f3e1"/>{pitchLines}
      {shots.map(s=><g key={s.id} className="pitch-action" role="button" tabIndex="0" onClick={()=>onSelect(s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(s.id)}}}>
        <circle cx={s.x*10} cy={s.y*10} r={s.id===selected?.id?10:6} fill={s.outcome==='Goal'?'#df5663':'#276f98'} stroke="white" strokeWidth="2"/>
        <title>{s.player} · {s.minute}' · {s.outcome}</title>
      </g>)}
      {selected&&<g>
        <line x1={selected.x*10} y1={selected.y*10} x2="1200" y2="400" stroke="#e2a747" strokeWidth="3" strokeDasharray="11 7"/>
        {(selected.defender_xy||[]).map((pt,i)=><circle key={i} cx={pt[0]*10} cy={pt[1]*10} r="9" fill="#7a97b6" stroke="white" strokeWidth="2"/>)}
        {selected.keeper_xy&&<circle cx={selected.keeper_xy[0]*10} cy={selected.keeper_xy[1]*10} r="14" fill="#195d47" stroke="#fff" strokeWidth="4"/>}
        <circle cx={selected.x*10} cy={selected.y*10} r="9" fill="#df5663" stroke="white" strokeWidth="3"/>
      </g>}
    </svg>
    <div className="keeper-map-caption">{selected?<>Selected shot · {selected.minute}' · {selected.outcome || 'Unknown outcome'}
      {selected.keeper_xy?<span>Keeper: {selected.keeper_xy.map(n=>n.toFixed(1)).join(', ')} · {(selected.defender_xy||[]).length} visible outfield defenders</span>:<span>No 360 goalkeeper location for this shot</span>}
    </>: 'No shots available'}</div>
  </div>
}


function GoalkeeperActionsMap({ actions }) {
  // Each team has its own attacking orientation in StatsBomb.
  // Rotate keeper events 180 degrees to align with opposition shots.
  return <div className="keeper-action-layout">
    <svg viewBox="650 140 550 520" className="pitch" role="img" aria-label="Goalkeeper event locations rotated to the defending goal on the right">
      <rect width="1200" height="800" fill="#e6f3e1"/>{pitchLines}
      <rect x="1135" y="300" width="65" height="200" fill="#11865e" opacity=".16"/>
      {actions.filter(e=>valid(e.x,e.y)).map(e=>{
        const aerial=e.outcome==='Punch'||e.outcome==='Collected'
        const shot=['Shot Saved','Shot Faced','Goal Conceded','Penalty Saved'].includes(e.outcome)
        return <circle key={e.id} cx={(120-e.x)*10} cy={(80-e.y)*10} r="8" stroke="#fff" strokeWidth="2"
          fill={aerial?'#177c58':shot?'#2c7ba1':'#d09b4e'}>
          <title>{e.minute}' · {e.outcome||'Goalkeeper action'}</title>
        </circle>
      })}
    </svg>
    <div className="keeper-map-key"><span><i style={{background:'#2c7ba1'}}/> Shot-related</span><span><i style={{background:'#177c58'}}/> Punch / collected</span><span><i style={{background:'#d09b4e'}}/> Other</span></div>
  </div>
}


function CornerSequenceAnalysis({ matchId, events, defendingTeam, keeper, period }) {
  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [cornerId, setCornerId] = useState(null)

  useEffect(() => {
    let live = true
    setData(null)
    setLoadState('loading')
    fetch(dataUrl('corners/' + matchId + '.json'))
      .then(response => {
        if (!response.ok) throw Error('Corner data unavailable')
        return response.json()
      })
      .then(result => {
        if (!result || result.schema_version !== 1 || !Array.isArray(result.corners)) {
          throw Error('Unsupported corner data')
        }
        if (live) { setData(result); setLoadState('ready') }
      })
      .catch(() => { if (live) setLoadState('missing') })
    return () => { live = false }
  }, [matchId])

  const rows = (data?.corners || []).filter(c =>
    c.team !== defendingTeam && (period === 'Full match' || String(c.period) === period))
  const interventions = c => (c.interventions || []).filter(a =>
    a.team === defendingTeam && (!keeper || a.player === keeper))
  const linked = rows.filter(c => interventions(c).length)
  const claims = rows.filter(c => interventions(c).some(a => a.type === 'Collected')).length
  const punches = rows.filter(c => interventions(c).some(a => a.type === 'Punch')).length
  const selected = rows.find(c => c.id === cornerId) || linked[0] || rows[0]
  const selectedActions = selected ? interventions(selected) : []
  const originalCorner = events.find(e => e.id === selected?.id)
  const startXY = originalCorner?.corner_keeper_xy
  const hasStart = Array.isArray(startXY) && valid(startXY[0], startXY[1])

  return <div className="keeper-spatial corner-sequences">
    <div className="forward-title"><div>
      <span className="small-heading">CORNER SEQUENCES · 2018 + 2022</span>
      <h2>Claims & punches after corners</h2>
      <p>Actual logged goalkeeper actions linked to the corner possession, not actions matched by time alone.</p>
    </div></div>
    {loadState === 'loading' && <p className="keeper-empty">Loading corner sequences…</p>}
    {loadState === 'missing' && <p className="keeper-empty">Corner sequence data is not available for this match. The event dataset can be refreshed through the data workflow; no result is assumed.</p>}
    {loadState === 'ready' && <>
      <div className="keeper-metrics">
        <div><small>Opposition corners</small><strong>{rows.length}</strong></div>
        <div><small>Corners with linked collection</small><strong>{claims}</strong></div>
        <div><small>Corners with linked punch</small><strong>{punches}</strong></div>
        <div><small>Corners with no linked action</small><strong>{rows.length - linked.length}</strong></div>
      </div>
      {rows.length ? <div className="corner-sequence-grid">
        <div className="corner-sequence-list" aria-label="Corners and associated goalkeeper actions">
          {rows.map(c => {
            const actions = interventions(c)
            return <button type="button" key={c.id}
              className={'corner-sequence-row' + (c.id === selected?.id ? ' selected' : '')}
              onClick={() => setCornerId(c.id)}>
              <span className="corner-sequence-minute">{c.minute}'</span>
              <span><strong>{c.side} corner</strong><small>{actions.length ? actions.map(a => a.type === 'Collected' ? 'Collection' : 'Punch').join(' + ') : 'No linked keeper action'}</small></span>
              <span className={'corner-sequence-status' + (actions.length ? ' linked' : '')}>{actions.length ? 'Logged' : '—'}</span>
            </button>
          })}
        </div>
        <div className="corner-sequence-detail">
          <svg className="pitch" viewBox="640 0 560 800" role="img" aria-label="Goalkeeper starting position at corner and recorded intervention point">
            <rect width="1200" height="800" fill="#e6f3e1"/>{pitchLines}
            <rect x="1135" y="300" width="65" height="200" fill="#13885f" opacity=".16"/>
            {selected && <circle cx="1180" cy={selected.side === 'Left' ? 30 : 770} r="12" fill="#c48a42" stroke="white" strokeWidth="3"/>}
            {hasStart && <circle cx={startXY[0] * 10} cy={startXY[1] * 10} r="12" fill="#2d83ac" stroke="white" strokeWidth="3"/>}
            {selectedActions.filter(a => valid(a.x, a.y)).map(a =>
              <g key={a.id}><circle cx={(120 - a.x) * 10} cy={(80 - a.y) * 10} r="13"
                fill={a.type === 'Collected' ? '#17885c' : '#d26d50'} stroke="white" strokeWidth="3">
                <title>{a.type} · {a.player} · {a.elapsed_seconds} s after corner</title>
              </circle></g>)}
          </svg>
          <div className="keeper-map-key">
            <span><i style={{background:'#c48a42'}}/>Corner</span>
            <span><i style={{background:'#2d83ac'}}/>360 starting position</span>
            <span><i style={{background:'#17885c'}}/>Collection</span>
            <span><i style={{background:'#d26d50'}}/>Punch</span>
          </div>
          {selectedActions.length ? <div className="corner-action-detail">
            {selectedActions.map(a => <div key={a.id}>
              <strong>{a.player || 'Goalkeeper'} · {a.type === 'Collected' ? 'Collection' : 'Punch'}</strong>
              <span>{a.outcome || 'Outcome not recorded'} · {a.elapsed_seconds} s after delivery · {a.link === 'related_event' ? 'Direct event link' : 'Same corner possession'}</span>
            </div>)}
          </div> : <p className="keeper-empty">No collection or punch linked to this corner. This is not evidence that the keeper stayed on the line or made a mistake.</p>}
        </div>
      </div> : <p className="keeper-empty">No opposition corners in this period.</p>}
    </>}
    <p className="forward-note">A link requires the same StatsBomb possession or an explicit related-event reference, with an 18-second maximum and no intervening restart. The logged action is real, but a same-possession link does not prove direct contact with the corner delivery. Missing links do not measure unsuccessful outings. The 360 starting dot is displayed only when observed.</p>
  </div>
}

function KeeperAnalysis({ events, current }) {
  const [keeperTeam,setKeeperTeam]=useState('')
  const [keeperName,setKeeperName]=useState('')
  const [keeperPeriod,setKeeperPeriod]=useState('Full match')
  const [selectedShot,setSelectedShot]=useState(null)
  const teamNames=[current?.home,current?.away].filter(Boolean)
  const activeTeam=teamNames.includes(keeperTeam)?keeperTeam:teamNames[0]
  const matchEvents=keeperPeriod==='Full match'?events:events.filter(e=>String(e.period)===keeperPeriod)
  const keeperActions=matchEvents.filter(e=>e.type==='Goal Keeper'&&e.team===activeTeam)
  const keeperNames=[...new Set(events.filter(e=>e.type==='Goal Keeper'&&e.team===activeTeam).map(e=>e.player).filter(Boolean))]
  const activeKeeper=keeperNames.includes(keeperName)?keeperName:keeperNames[0]
  const gkEvents=keeperActions.filter(e=>e.player===activeKeeper)
  const shots=matchEvents.filter(e=>e.type==='Shot'&&e.team&&e.team!==activeTeam&&e.shot_type==='Open Play'&&valid(e.x,e.y))
  const zones=[{name:'Left flank',check:e=>e.y<80/3},{name:'Centre',check:e=>e.y>=80/3&&e.y<=160/3},{name:'Right flank',check:e=>e.y>160/3}]
  const corners=matchEvents.filter(e=>e.type==='Pass'&&e.team&&e.team!==activeTeam&&e.is_corner)
  const box6=gkEvents.filter(e=>valid(e.x,e.y)&&e.x>=0&&e.x<=6.5&&e.y>=30&&e.y<=50)
  const observed=shots.filter(s=>Array.isArray(s.keeper_xy)&&valid(s.keeper_xy[0],s.keeper_xy[1]))
  const positioning=observed.map(s=>{
    const [kx,ky]=s.keeper_xy
    const expectedY=s.y+(40-s.y)*(kx-s.x)/(120-s.x)
    return {...s,offLine:Math.abs((ky-expectedY)*68/80),lineDistance:(120-kx)*105/120}
  }).filter(s=>Number.isFinite(s.offLine)&&Number.isFinite(s.lineDistance)&&s.lineDistance>=0&&s.lineDistance<=105)
  const avg=(array,key)=>array.length?array.reduce((sum,e)=>sum+e[key],0)/array.length:null
  const observedCorners=corners.filter(e=>Array.isArray(e.corner_keeper_xy)&&valid(e.corner_keeper_xy[0],e.corner_keeper_xy[1]))
  const keeperInSix=observedCorners.filter(e=>e.corner_keeper_xy[0]>=113.5&&e.corner_keeper_xy[1]>=30&&e.corner_keeper_xy[1]<=50).length
  const teamGoals=shots.filter(e=>e.outcome==='Goal').length
  const teamXg=shots.filter(e=>Number.isFinite(e.xg)).reduce((sum,e)=>sum+e.xg,0)
  const keeperDepth=gkEvents.filter(e=>valid(e.x,e.y))
  const avgDepth=keeperDepth.length?keeperDepth.reduce((sum,e)=>sum+e.x*105/120,0)/keeperDepth.length:null
  const defendedShots=observed.filter(s=>Array.isArray(s.defender_xy)&&s.defender_xy.some(p=>valid(p[0],p[1])))
  const nearestDefender=defendedShots.length?defendedShots.reduce((sum,s)=>{
    const distances=s.defender_xy.filter(p=>valid(p[0],p[1])).map(p=>Math.hypot((p[0]-s.x)*105/120,(p[1]-s.y)*68/80))
    return sum+Math.min(...distances)
  },0)/defendedShots.length:null
  return <section className="keeper-section panel" id="goalkeepers">
    <div className="forward-title"><div><span className="small-heading">GOALKEEPER · SPATIAL STUDY</span><h2>Defending the goal</h2><p>{current?.home} vs {current?.away} · Team-level shot context and individual goalkeeper events are analysed separately.</p></div></div>
    <div className="keeper-controls"><label>Defending team<select value={activeTeam||''} onChange={e=>{setKeeperTeam(e.target.value);setKeeperName('');setSelectedShot(null)}}>{teamNames.map(n=><option key={n}>{n}</option>)}</select></label><label>Goalkeeper<select value={activeKeeper||''} onChange={e=>setKeeperName(e.target.value)}>{keeperNames.length?keeperNames.map(n=><option key={n}>{n}</option>):<option value="">No keeper actions</option>}</select></label><label>Period<select value={keeperPeriod} onChange={e=>{setKeeperPeriod(e.target.value);setSelectedShot(null)}}><option>Full match</option><option value="1">First half</option><option value="2">Second half</option><option value="3">Extra time 1</option><option value="4">Extra time 2</option></select></label></div>
    <div className="keeper-metrics"><div><small>Open-play shots faced · team</small><strong>{shots.length}</strong></div><div><small>Goals from these shots · team</small><strong>{teamGoals}</strong></div><div><small>Opponent open-play xG</small><strong>{teamXg.toFixed(2)}</strong></div><div><small>Goalkeeper events · player</small><strong>{gkEvents.length}</strong></div></div>
    <div className="keeper-spatial">
      <div className="forward-title"><div><span className="small-heading">POSITIONAL EVENTS · 2018 + 2022</span><h2>Where does the goalkeeper intervene?</h2><p>Recorded goalkeeper actions rotated into the same orientation as the opposition shots.</p></div></div>
      <div className="keeper-metrics"><div><small>Events inside the six-yard box</small><strong>{box6.length} / {gkEvents.length}</strong></div><div><small>Average event distance from goal line</small><strong>{avgDepth==null?'—':avgDepth.toFixed(1)+' m'}</strong></div><div><small>Logged aerial responses to corners</small><strong>See corner sequences below</strong></div></div>
      {gkEvents.length?<GoalkeeperActionsMap actions={gkEvents}/>:<p className="keeper-empty">No goalkeeper actions recorded in this period.</p>}
      <p className="forward-note">These are the locations of logged events, not continuous goalkeeper tracking. The green shading shows the six-yard box. Corner proximity is temporal association only, not evidence of a claim.</p>
    </div>
    <div className="keeper-spatial">
      <div className="forward-title"><div><span className="small-heading">SHOT ORIGINS · 2018 + 2022</span><h2>Shot direction & goalkeeper positioning</h2><p>Select a shot to see its origin, outcome and, when available, the goalkeeper and defenders present at that moment.</p></div></div>
      <div className="keeper-metrics"><div><small>Shots with 360 goalkeeper position</small><strong>{observed.length} / {shots.length}</strong></div><div><small>Average lateral offset from goal-centre ray</small><strong>{positioning.length?avg(positioning,'offLine').toFixed(1)+' m':'—'}</strong></div><div><small>Average goalkeeper depth from goal line</small><strong>{positioning.length?avg(positioning,'lineDistance').toFixed(1)+' m':'—'}</strong></div><div><small>Nearest visible defender to shooter</small><strong>{nearestDefender==null?'—':nearestDefender.toFixed(1)+' m'}</strong></div></div>
    <div className="keeper-zones">{zones.map(zone=>{const items=shots.filter(zone.check);const goals=items.filter(e=>e.outcome==='Goal').length;const xg=items.filter(e=>Number.isFinite(e.xg)).reduce((sum,e)=>sum+e.xg,0);return <div key={zone.name}><span>{zone.name}</span><strong>{items.length} shots · {goals} goals</strong><small>{xg.toFixed(2)} xG · {items.length?Math.round(goals/items.length*100):0}% conversion</small><div className="keeper-meter"><i style={{width:shots.length?Math.round(items.length/shots.length*100)+'%':'0%'}}/></div></div>})}</div>
      <SpatialKeeperMap shots={shots} activeId={selectedShot} onSelect={setSelectedShot}/>
      {!observed.length&&<p className="keeper-empty">No goalkeeper freeze-frame coordinates for these shots. The shot-origin and goalkeeper event maps remain available without StatsBomb 360.</p>}
      <p className="forward-note">Green marker: observed goalkeeper. Blue-grey markers: visible defenders. Dashed line: shot-to-goal-centre reference, not ball trajectory. Spatial offsets describe positioning, not save quality. StatsBomb 360 is only available for some 2022 events in this dataset, and snapshots contain visible players only.</p>
    </div>
    <CornerSequenceAnalysis matchId={current?.id} events={events} defendingTeam={activeTeam} keeper={activeKeeper} period={keeperPeriod}/>
    <div className="keeper-spatial"><div className="forward-title"><div><span className="small-heading">CORNER POSITIONING · 360</span><h2>Goalkeeper starting position</h2><p>Observed placement at the moment a corner is delivered, not proof of a claim or a successful intervention.</p></div></div>
      <div className="keeper-metrics"><div><small>Corners faced</small><strong>{corners.length}</strong></div><div><small>Corners with observed keeper position</small><strong>{observedCorners.length}</strong></div><div><small>Inside six-yard box on delivery</small><strong>{keeperInSix} / {observedCorners.length}</strong></div></div>
      {observedCorners.length?<svg className="pitch" viewBox="650 140 550 520" role="img" aria-label="Goalkeeper locations at opposing corner deliveries">
        <rect width="1200" height="800" fill="#e6f3e1"/>{pitchLines}
        <rect x="1135" y="300" width="65" height="200" fill="#188856" opacity=".2"/>
        {observedCorners.map(e=><g key={e.id}><circle cx={e.corner_keeper_xy[0]*10} cy={e.corner_keeper_xy[1]*10} r="10" fill="#116d4d" stroke="#fff" strokeWidth="3"><title>{e.minute}' · {e.team}</title></circle></g>)}
      </svg>:<p className="keeper-empty">No 360 goalkeeper position recorded at corner delivery for this selection.</p>}
      <p className="forward-note">Each dot represents the goalkeeper observed at a corner delivery; the shaded area is the six-yard box. This is a starting position, not a measured claim, and missing 360 does not mean a missing goalkeeper.</p>
    </div>

    <p className="forward-note">Shot channels are from the attacker's perspective, not the goalkeeper's left/right hand. Open-play shots exclude penalties and free kicks. All shot outcomes are team-level, not necessarily attributable to the selected goalkeeper. Goal rates are descriptive and cannot establish a weak side from a single match.</p>
  </section>
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
  const [page,setPage]=useState('matches')
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
  const players=[...new Set(events.filter(e=>(team==='All teams'||e.team===team)&&outfieldAction(e)).map(e=>e.player).filter(Boolean))].sort()
  const byPeriod=useMemo(()=>events.filter(e=>period==='Full match'||String(e.period)===period),[events,period])
  const filtered=useMemo(()=>byPeriod.filter(e=>outfieldAction(e)&&(team==='All teams'||e.team===team)&&(player==='All players'||e.player===player)&&(mode==='All events'||mode==='Network'||mode==='Heatmap'||(mode==='Forward'&&isForwardPass(e))||(mode==='Efficiency'&&efficiency(e)>0)||e.type===mode)),[byPeriod,team,player,mode])
  const displayEvents=useMemo(()=>filtered.map(e=>({...e,_forward:mode==='Forward'||mode==='Efficiency',_efficiency:mode==='Efficiency',_color:mode==='Efficiency'?'#b66d18':mode==='Forward'?'#11855b':e.type==='Shot'?'#f26f7d':(current && e.team===current.away?'#f26f7d':'#174b83')})),[filtered,current,mode])
  const selected=filtered.find(e=>e.id===selectedId)
  const passesForMetrics=filtered.filter(e=>e.type==='Pass' && distance(e)!==null)
  const passDistances=passesForMetrics.map(e=>({...e,meters:distance(e)}))
  const longest=passDistances.length?passDistances.reduce((a,b)=>a.meters>b.meters?a:b):null
  const averageDistance=passDistances.length?passDistances.reduce((sum,e)=>sum+e.meters,0)/passDistances.length:null
  const distanceLeader=Object.entries(passDistances.reduce((acc,e)=>{if(e.player)acc[e.player]=(acc[e.player]||0)+e.meters;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const progressivePasses=byPeriod.filter(e=>outfieldAction(e)&&(team==='All teams'||e.team===team)&&isForwardPass(e))
  const forwardRanking=Object.values(progressivePasses.reduce((result,e)=>{
    if(!e.player)return result
    const key=`${e.team}::${e.player}`
    if(!result[key])result[key]={player:e.player,team:e.team,gain:0,passes:0}
    result[key].gain+=forwardGain(e)
    result[key].passes++
    return result
  },{})).sort((a,b)=>b.gain-a.gain)
  const forwardTotal=filtered.filter(isForwardPass).reduce((sum,e)=>sum+forwardGain(e),0)
  const efficiencyRanking=Object.values(byPeriod.filter(e=>outfieldAction(e)&&(team==='All teams'||e.team===team)&&efficiency(e)>0).reduce((acc,e)=>{
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
      const passes=teamEvents.filter(e=>e.type==='Pass'&&!e.is_goalkeeper)
      const shots=teamEvents.filter(e=>e.type==='Shot')
      const complete=passes.filter(e=>e.outcome==='Complete').length
      const xg=shots.filter(e=>Number.isFinite(e.xg)).reduce((s,e)=>s+e.xg,0)
      return {passes:passes.length,shots:shots.length,complete,accuracy:passes.length?Math.round(100*complete/passes.length):0,xg}
    }
    return {home:collect(current?.home),away:collect(current?.away)}
  },[byPeriod,current])
  const homePasses=byPeriod.filter(e=>e.team===current?.home&&e.type==='Pass'&&!e.is_goalkeeper)
  const awayPasses=byPeriod.filter(e=>e.team===current?.away&&e.type==='Pass'&&!e.is_goalkeeper)
  const keyPasses=byPeriod.filter(e=>e.type==='Shot')
  const changeCountry=value=>{setCountry(value);const first=yearMatches.find(m=>value==='All countries'||m.home===value||m.away===value);if(first)setMatchId(String(first.id))}
  const changeYear=value=>{setYear(value);setCountry('All countries');const first=matches.find(m=>String(m.year||2018)===value);if(first)setMatchId(String(first.id))}
  const modes=[['Pass','Passes'],['Forward','Forward passes'],['Efficiency','Pass efficiency'],['Shot','Shots'],['Carry','Carries'],['Dribble','Dribbles'],['Ball Receipt*','Ball receipts'],['All events','All actions'],['Network','Pass network'],['Heatmap','Heat map']]

  return <div className="site" id="home">
    <header className="topbar"><nav aria-label="Main navigation"><button className={page==='matches'?'nav-active':''} onClick={()=>setPage('matches')}>Matches</button><button className={page==='keepers'?'nav-active':''} onClick={()=>setPage('keepers')}>Goalkeepers</button><a href="#about">About</a></nav><select className="competition-label competition-select" aria-label="World Cup tournament" value={year} onChange={e=>changeYear(e.target.value)}><option value="2018">World Cup 2018</option><option value="2022" disabled={!matches.some(m=>m.year===2022)}>World Cup 2022</option></select></header>
    <main className="dashboard" id="explorer">
      <section className="fixture-bar" aria-label="Match selection">
        <div className="fixture-select"><label htmlFor="country">Country</label><select id="country" value={country} onChange={e=>changeCountry(e.target.value)}><option>All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="fixture-centre"><div className="fixture-score">{current && Number.isFinite(current.home_score)&&Number.isFinite(current.away_score)?`${current.home_score} - ${current.away_score}`:'vs'}</div><div className="fixture-date">{current?.date||'Choose a match'}</div></div>
        <div className="fixture-select"><label htmlFor="fixture">Match</label><select id="fixture" value={matchId} onChange={e=>setMatchId(e.target.value)} disabled={!matches.length}>{!matches.length&&<option>Loading matches…</option>}{fixtures.map(m=><option key={m.id} value={m.id}>{m.home} vs {m.away}</option>)}</select></div>
      </section>
      {page==='keepers' ? <KeeperAnalysis key={matchId} events={events} current={current}/> : <>
      <div className="dashboard-grid">
        <aside className="sidebar panel"><div className="side-label">Analysis</div><div className="mode-list">{modes.map(([value,label])=><button key={value} className={mode===value?'active':''} onClick={()=>{setMode(value);setSelectedId(null)}}><span className="mode-symbol">{value==='Efficiency'?'✦':value==='Forward'?'⇢':value==='Pass'?'↗':value==='Shot'?'◎':value==='Network'?'◇':value==='Heatmap'?'▦':'◌'}</span>{label}</button>)}</div>
        </aside>
        <section className="visual panel"><div className="visual-head"><div><span className="small-heading">MATCH MAP</span><p>{current?`${current.home} / ${current.away}`:'Match events'}</p></div><span className="visual-counter">{number(filtered.length)} {mode==='Dribble'?'dribbles':mode==='Forward'?'forward passes':'events'}</span></div>
          <div className="pitch-filters" aria-label="Pitch filters">
          <label className="pitch-filter">Team<select value={team} onChange={e=>{setTeam(e.target.value);setPlayer('All players');setSelectedId(null)}}><option>All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="pitch-filter" id="player-filter">Player<select value={player} onChange={e=>{setPlayer(e.target.value);setSelectedId(null)}}><option>All players</option>{players.map(p=><option key={p}>{p}</option>)}</select></label>
          <label className="pitch-filter">Period<select value={period} onChange={e=>{setPeriod(e.target.value);setSelectedId(null)}}><option>Full match</option><option value="1">First half</option><option value="2">Second half</option><option value="3">Extra time 1</option><option value="4">Extra time 2</option></select></label>
          <label className="pitch-check"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show all filtered events</label>
          </div>
          {error?<div className="error">{error} <a href="https://github.com/tiffendericbourg/spatial-xi/actions/workflows/update-data.yml">Update data ↗</a></div>:mode==='Heatmap'?<HeatPitch events={filtered}/>:mode==='Network'?<NetworkPitch events={networkEvents} onPlayer={handleNetworkPlayer}/>:<Pitch events={showAll?displayEvents:displayEvents.slice(0,400)} selectedId={selectedId} onSelect={setSelectedId}/>}
          <div className="pitch-legend"><span><i style={{background:'#174b83'}}/> {current?.home||'Home'}</span><span><i style={{background:'#f26f7d'}}/> {current?.away||'Away'}</span><span className="legend-hint">{mode==='Network'?'Select a player · choose a team for its network':mode==='Dribble'?'Green = successful dribble · coral = unsuccessful':mode==='Heatmap'?'Darker areas = more actions':mode==='Efficiency'?'Amber arrows · thicker = higher efficiency':mode==='Forward'?'Green arrows · thicker = greater territory gained':'Select a point for details'}</span></div>
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
      </>}
      <footer id="about"><span>Spatial XI · Football spatial analysis</span><span>2018 &amp; 2022 World Cup events · <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noreferrer">StatsBomb Open Data ↗</a> · <a href="https://github.com/tiffendericbourg/spatial-xi" target="_blank" rel="noreferrer">GitHub ↗</a></span></footer>
    </main>
  </div>
}
