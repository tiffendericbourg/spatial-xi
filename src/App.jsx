import { useEffect, useMemo, useState } from 'react'

const modules = [
  { number: '01', title: 'Passing Intelligence', detail: 'Passing lanes, connections and progression.', icon: '↗' },
  { number: '02', title: 'Spatial Dominance', detail: 'Where teams control and occupy the pitch.', icon: '▦' },
  { number: '03', title: 'Attacking Patterns', detail: 'Shot locations and attacking decisions.', icon: '◎' },
  { number: '04', title: 'Player Movement', detail: 'How players position themselves over time.', icon: '⌁' },
  { number: '05', title: 'Match Explorer', detail: 'Explore real match events, one action at a time.', icon: '◈', active: true },
  { number: '06', title: 'Goalkeeper Intelligence', detail: 'Understanding positioning between the posts.', icon: '⊞' },
  { number: '07', title: 'Set-Piece Intelligence', detail: 'Corners, free kicks and what happens next.', icon: '⤴' },
]

const dataUrl = (file) => `${import.meta.env.BASE_URL}data/${file}`
const validPoint = (x, y) => Number.isFinite(x) && Number.isFinite(y)

function Pitch({ events, selectedId, onSelect }) {
  return (
    <svg className="pitch" viewBox="0 0 1200 800" role="img" aria-label="Football pitch showing match events">
      <rect x="0" y="0" width="1200" height="800" fill="#152d2a" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 120} y="0" width="120" height="800" fill={i % 2 ? '#ffffff' : '#000000'} opacity=".025" />)}
      <g stroke="#94bbb0" strokeWidth="2.3" fill="none" opacity=".60">
        <rect x="35" y="35" width="1130" height="730" />
        <line x1="600" y1="35" x2="600" y2="765" />
        <circle cx="600" cy="400" r="92" />
        <circle cx="600" cy="400" r="3" fill="#94bbb0" />
        <rect x="35" y="210" width="165" height="380" />
        <rect x="1000" y="210" width="165" height="380" />
        <rect x="35" y="305" width="55" height="190" />
        <rect x="1110" y="305" width="55" height="190" />
        <circle cx="145" cy="400" r="3" fill="#94bbb0" />
        <circle cx="1055" cy="400" r="3" fill="#94bbb0" />
        <path d="M35 320 A95 95 0 0 1 35 480 M1165 320 A95 95 0 0 0 1165 480" opacity=".3" />
      </g>
      {events.map((event) => {
        const x = event.x * 10
        const y = event.y * 10
        const endX = event.end_x * 10
        const endY = event.end_y * 10
        const isShot = event.type === 'Shot'
        const selected = event.id === selectedId
        const color = isShot ? '#e7b76d' : '#91d3c5'
        return (
          <g key={event.id} onClick={() => onSelect(event.id)} tabIndex="0" role="button"
            aria-label={`${event.player || 'Unknown player'} ${event.type} at minute ${event.minute}`}
            onKeyDown={e => { if (e.key === 'Enter') onSelect(event.id) }}
            className="pitch-action" opacity={selectedId && !selected ? .38 : 1}>
            {validPoint(endX, endY) && <line x1={x} y1={y} x2={endX} y2={endY}
              stroke={color} strokeWidth={selected ? 5 : isShot ? 2.5 : 1.9} opacity={selected ? 1 : .48} />}
            <circle cx={x} cy={y} r={selected ? 10 : isShot ? 6.8 : 3.5}
              fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth="2.5" />
          </g>
        )
      })}
    </svg>
  )
}

function Explorer() {
  const [matches, setMatches] = useState([])
  const [matchId, setMatchId] = useState('')
  const [matchTeam, setMatchTeam] = useState('All countries')
  const [events, setEvents] = useState([])
  const [team, setTeam] = useState('All teams')
  const [player, setPlayer] = useState('All players')
  const [eventType, setEventType] = useState('All events')
  const [period, setPeriod] = useState('Full match')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(dataUrl('matches.json')).then(response => {
      if (!response.ok) throw Error('Match catalogue is not available yet.')
      return response.json()
    }).then(data => { setMatches(data); if (data.length) setMatchId(String(data[0].id)) })
      .catch(() => setError('Match data is not published yet. Run the Update match data action on GitHub to load real StatsBomb events.'))
  }, [])

  useEffect(() => {
    if (!matchId) return
    setEvents([]); setSelectedId(null); setTeam('All teams'); setPlayer('All players'); setError('')
    fetch(dataUrl(`${matchId}.json`)).then(response => {
      if (!response.ok) throw Error('Match data could not be loaded.')
      return response.json()
    }).then(data => setEvents(data.events || []))
      .catch(() => setError('This match is temporarily unavailable.'))
  }, [matchId])

  const countries = [...new Set(matches.flatMap(match => [match.home, match.away]))].sort()
  const visibleMatches = matches.filter(match => matchTeam === 'All countries' || match.home === matchTeam || match.away === matchTeam)
  const currentMatch = matches.find(match => String(match.id) === matchId)
  const teams = [...new Set(events.map(event => event.team).filter(Boolean))]
  const players = [...new Set(events.filter(event => team === 'All teams' || event.team === team).map(event => event.player).filter(Boolean))].sort()
  const filtered = useMemo(() => events.filter(event =>
    (team === 'All teams' || event.team === team) &&
    (player === 'All players' || event.player === player) &&
    (eventType === 'All events' || event.type === eventType) &&
    (period === 'Full match' || String(event.period) === period)
  ), [events, team, player, eventType, period])
  const selected = filtered.find(event => event.id === selectedId)
  const passes = filtered.filter(event => event.type === 'Pass')
  const shots = filtered.filter(event => event.type === 'Shot')
  const completedPasses = passes.filter(event => event.outcome === 'Complete').length
  const accuracy = passes.length ? Math.round(100 * completedPasses / passes.length) : null
  const knownXg = shots.filter(event => Number.isFinite(event.xg))
  const totalXg = knownXg.reduce((sum, event) => sum + event.xg, 0)

  return (
    <section className="explorer" id="explorer">
      <div className="section-heading">
        <div><span className="eyebrow">THE SANDBOX / 05</span><h2>Match Explorer<span className="accent">.</span></h2></div>
        <p>Real events. Real positions. A clearer view of the game.</p>
      </div>
      <div className="explorer-shell">
        <div className="control-bar">
          <label>COUNTRY<select value={matchTeam} onChange={e => { const next = e.target.value; setMatchTeam(next); const first = matches.find(match => next === 'All countries' || match.home === next || match.away === next); if (first) setMatchId(String(first.id)) }}>
            <option>All countries</option>{countries.map(country => <option key={country}>{country}</option>)}
          </select></label>
          <label>MATCH<select value={matchId} onChange={e => setMatchId(e.target.value)} disabled={!matches.length}>
            {!matches.length && <option>Loading matches…</option>}
            {visibleMatches.map(match => <option value={match.id} key={match.id}>{match.date.slice(5)} · {match.home} vs {match.away}</option>)}
          </select></label>
          <label>TEAM<select value={team} onChange={e => { setTeam(e.target.value); setPlayer('All players'); setSelectedId(null) }}>
            <option>All teams</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>PLAYER<select value={player} onChange={e => { setPlayer(e.target.value); setSelectedId(null) }}>
            <option>All players</option>{players.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>PERIOD<select value={period} onChange={e => { setPeriod(e.target.value); setSelectedId(null) }}>
            <option>Full match</option><option value="1">1st half</option><option value="2">2nd half</option><option value="3">Extra time 1</option><option value="4">Extra time 2</option></select></label>
        </div>
        <div className="event-tabs">
          {['All events', 'Pass', 'Shot'].map(type => <button key={type} className={eventType === type ? 'selected' : ''} onClick={() => { setEventType(type); setSelectedId(null) }}>{type === 'All events' ? 'All actions' : type === 'Pass' ? 'Passes' : 'Shots'}</button>)}
          <span className="data-credit">STATSBOMB OPEN DATA · 120 × 80 PITCH</span>
        </div>
        <div className="explorer-body">
          <div className="pitch-area">
            {error ? <div className="pitch-message">{error}<br /><a href="https://github.com/tiffendericbourg/spatial-xi/actions/workflows/update-data.yml" target="_blank" rel="noreferrer">Open data workflow ↗</a></div> : <Pitch events={filtered} selectedId={selectedId} onSelect={setSelectedId} />}
            <div className="pitch-legend"><span><i className="dot pass" /> Passes</span><span><i className="dot shot" /> Shots</span><span>Click an event to inspect</span></div>
          </div>
          <aside className="insights">
            <span className="eyebrow">MATCH SNAPSHOT</span>
            <h3>{currentMatch ? `${currentMatch.home} vs ${currentMatch.away}` : 'Awaiting match data'}</h3>
            <p className="match-date">{currentMatch ? `${currentMatch.competition} · ${currentMatch.stage || 'Tournament'} · ${currentMatch.date}` : 'StatsBomb Open Data'}</p>
            {currentMatch && Number.isFinite(currentMatch.home_score) && Number.isFinite(currentMatch.away_score) && <p className="match-score">{currentMatch.home} <strong>{currentMatch.home_score} – {currentMatch.away_score}</strong> {currentMatch.away}</p>}
            <div className="numbers"><div><strong>{filtered.length.toLocaleString()}</strong><span>EVENTS</span></div><div><strong>{passes.length.toLocaleString()}</strong><span>PASSES</span></div><div><strong>{shots.length.toLocaleString()}</strong><span>SHOTS</span></div></div>
            <div className="secondary-numbers"><span>PASS ACCURACY <strong>{accuracy === null ? '—' : `${accuracy}%`}</strong></span><span>RECORDED xG <strong>{knownXg.length ? totalXg.toFixed(2) : '—'}</strong></span></div>
            <div className="event-detail">
              <span className="eyebrow">EVENT INSPECTOR</span>
              {selected ? <><h4>{selected.player || 'Unknown player'}</h4><p>{selected.team} · {selected.type} · {selected.minute}'</p>
                <p>Outcome: {selected.outcome || 'Not recorded'}</p>
                {selected.type === 'Shot' && Number.isFinite(selected.xg) && <p>StatsBomb xG: {selected.xg.toFixed(3)}</p>}
                <p>Location: ({selected.x}, {selected.y})</p></> :
                <p>Select a pass or shot on the pitch to explore its details.</p>}
            </div>
            <p className="note">Statistics reflect the current filters. Pass accuracy uses StatsBomb pass outcomes, and xG sums only recorded values. Only recorded event coordinates are shown. Lines connect recorded start and end locations; they are not player tracking paths.</p>
          </aside>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  return <div className="site">
    <header className="topbar"><a className="brand" href="#home"><span className="brand-mark">XI<span>✳</span></span> SPATIAL <b>XI</b></a>
      <nav><a href="#modules">Modules</a><a href="#explorer">Match Explorer</a><a href="https://github.com/tiffendericbourg/spatial-xi" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
    <main id="home">
      <section className="hero"><div className="hero-content"><span className="eyebrow"><span className="live-dot" /> FOOTBALL / DATA / SPACE</span>
        <h1>See the game<br /><em>between</em> the lines<span className="accent">.</span></h1>
        <p>Football is more than a scoreline. Explore the spaces, patterns and decisions that shape every match — powered by open event data.</p>
        <div className="hero-actions"><a className="primary-link" href="#explorer">Explore a match <span>↗</span></a><a className="quiet-link" href="#modules">Discover the modules ↓</a></div>
        <div className="hero-foot"><span>BUILT FOR CURIOSITY</span><span>POWERED BY OPEN DATA</span><span>MADE TO EXPLORE</span></div>
      </div><div className="hero-art" aria-hidden="true"><div className="art-pitch"><div className="centre-circle" /><div className="halfway" /><div className="box-left" /><div className="box-right" /><div className="arc arc-one" /><div className="arc arc-two" /><div className="art-dot one" /><div className="art-dot two" /><div className="art-dot three" /><div className="art-dot four" /><div className="art-dot five" /><div className="art-dot six" /><div className="art-path" /></div><div className="art-label">THE BEAUTIFUL GAME, DECODED ↗</div></div></section>
      <section className="modules-section" id="modules"><div className="section-heading"><div><span className="eyebrow">EXPLORE THE PLATFORM</span><h2>Seven ways to see <em>more.</em></h2></div><p>Different perspectives. One shared pitch.<br />Built one module at a time.</p></div>
        <div className="module-grid">{modules.map(module => <article className={`module-card ${module.active ? 'featured' : ''}`} key={module.number}>
          <div className="module-top"><span>{module.number} / 07</span><span className="module-icon">{module.icon}</span></div>
          <div><h3>{module.title}</h3><p>{module.detail}</p></div>
          <div className="module-bottom">{module.active ? <a href="#explorer">EXPLORE NOW <span>↗</span></a> : <span>COMING SOON <span>↗</span></span>}</div>
        </article>)}</div>
      </section>
      <Explorer />
    </main>
    <footer><span className="brand">SPATIAL <b>XI</b></span><p>Football, viewed differently. Data by <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noreferrer">StatsBomb Open Data ↗</a></p><span>© {new Date().getFullYear()} SPATIAL XI</span></footer>
  </div>
}
