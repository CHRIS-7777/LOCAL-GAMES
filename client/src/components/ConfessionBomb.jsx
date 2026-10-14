import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Bomb, Users, Clock, Send, Trophy, Eye, RotateCcw, Check, AlertCircle, Crown, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { RulesModal } from './RulesModal'

export default function ConfessionBomb() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('lobby') // lobby | submitting | guessing | reveal
  const [players, setPlayers] = useState([])
  const [username, setUsername] = useState(localStorage.getItem('gp_username') || '')
  const [joined, setJoined] = useState(false)
  const [confessions, setConfessions] = useState([]) // {id, text, authorUsername?}
  const [submittedCount, setSubmittedCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [mySubmitted, setMySubmitted] = useState(false)
  const [confessionText, setConfessionText] = useState('')
  const [guessDuration, setGuessDuration] = useState(240)
  const [timeLeft, setTimeLeft] = useState(0)
  const [guesses, setGuesses] = useState({}) // confessionId -> guessedUsername
  const [hasLocked, setHasLocked] = useState(false)
  const [guessProgress, setGuessProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [error, setError] = useState('')
  const [allSubmitted, setAllSubmitted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('gp_username')
    if (saved) setUsername(saved)

    socket.on('joined', (d) => {
      if (d.gameType === 'confession') {
        setJoined(true)
        setError('')
      }
    })
    socket.on('error_msg', (msg) => setError(msg))
    socket.on('confession:state', (s) => {
      setPhase(s.phase)
      setPlayers(s.players)
      setConfessions(s.confessions || [])
      setSubmittedCount(s.submittedCount)
      setPlayerCount(s.playerCount)
      setGuessDuration(s.guessDuration)
      setTimeLeft(s.guessTimeLeft)
      if (s.results) setResults(s.results)
      if (s.phase === 'reveal' && s.results) setResults(s.results)
    })
    socket.on('confession:submitted', () => setMySubmitted(true))
    socket.on('confession:timer', ({ timeLeft }) => setTimeLeft(timeLeft))
    socket.on('confession:allSubmitted', () => setAllSubmitted(true))
    socket.on('confession:guessingStarted', () => {
      setHasLocked(false)
      setGuesses({})
      setError('')
    })
    socket.on('confession:guessesLocked', () => setHasLocked(true))
    socket.on('confession:guessProgress', ({ guessedCount }) => setGuessProgress(guessedCount))
    socket.on('confession:reveal', (r) => {
      setResults(r)
      setPhase('reveal')
    })
    socket.on('confession:resetDone', () => {
      setMySubmitted(false)
      setGuesses({})
      setHasLocked(false)
      setResults(null)
      setAllSubmitted(false)
    })
    socket.on('lobby:update', (d) => {
      setPlayers(d.confession.players)
      setPlayerCount(d.confession.count)
    })

    // request current state
    // socket already emits on connect

    return () => {
      socket.off('joined')
      socket.off('error_msg')
      socket.off('confession:state')
      socket.off('confession:submitted')
      socket.off('confession:timer')
      socket.off('confession:allSubmitted')
      socket.off('confession:guessingStarted')
      socket.off('confession:guessesLocked')
      socket.off('confession:guessProgress')
      socket.off('confession:reveal')
      socket.off('confession:resetDone')
      socket.off('lobby:update')
    }
  }, [])

  const handleJoin = () => {
    if (!username.trim()) { setError('Enter a gang name'); return; }
    if (username.trim().length < 2) { setError('Name too short'); return; }
    localStorage.setItem('gp_username', username.trim())
    socket.emit('join_game', { username: username.trim(), gameType: 'confession', guessDuration })
    setError('')
  }

  const submitConfession = () => {
    if (!confessionText.trim()) { setError('Type your bomb first'); return; }
    if (confessionText.trim().length < 3) { setError('Too short'); return; }
    socket.emit('confession:submit', { text: confessionText.trim() })
    setError('')
  }

  const startGuessing = () => {
    socket.emit('confession:startGuessing', { duration: guessDuration })
  }

  const submitGuesses = () => {
    // need to have guessed all?
    const arr = Object.entries(guesses).map(([cid, guessedUsername]) => ({ confessionId: Number(cid), guessedUsername }))
    if (arr.length === 0) { setError('Guess at least one bomb'); return; }
    if (arr.length < confessions.length) {
      if (!confirm(`You guessed ${arr.length}/${confessions.length}. Submit anyway? Timer will still run but you can lock now.`)) return;
    }
    socket.emit('confession:submitGuesses', { guesses: arr })
  }

  const endEarly = () => {
    if (confirm('Reveal results now? This ends the timer for everyone.')) {
      socket.emit('confession:endGuessingEarly')
    }
  }

  const resetKeep = () => {
    socket.emit('confession:resetKeepPlayers')
    setMySubmitted(false)
    setGuesses({})
    setHasLocked(false)
    setResults(null)
    setAllSubmitted(false)
    setConfessionText('')
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#A855F7]/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#EC4899]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white hover:bg-white/10">
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-white/70"><Users size={14}/> {players.length} players</span>
            <button onClick={() => setShowRules(true)} className="px-4 py-2 rounded-full glass text-white text-sm">Rules ?</button>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full neon-purple text-white font-bold text-sm">
            <Bomb size={16} /> CONFESSION BOMB 💣
          </div>
          <h1 className="text-3xl font-black grotesk text-white mt-3">Secrets Will Explode</h1>
          <p className="text-white/50 text-sm mt-1">Phase: <span className="text-white font-bold capitalize">{phase}</span> • Works with 5-20 players • One total timer for all guesses</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error} <button onClick={()=>setError('')} className="ml-auto text-red-300/60 hover:text-red-300">✕</button>
          </motion.div>
        )}

        {!joined ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto rounded-[24px] glass-strong border border-white/10 p-6">
            <h3 className="text-white font-bold text-lg grotesk">Join Confession Bomb</h3>
            <p className="text-white/60 text-sm mt-1">Enter a unique name. We use it to show dropdown for guessing but your bomb stays anonymous.</p>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Your gang name (e.g. Rahul)"
              className="w-full mt-4 px-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#A855F7]/50 focus:bg-white/[0.08]"
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <div className="mt-4">
              <label className="text-xs text-white/60">Total guessing timer (for ALL bombs together)</label>
              <div className="flex gap-2 mt-2">
                {[180, 240, 300, 600].map(sec => (
                  <button
                    key={sec}
                    onClick={() => setGuessDuration(sec)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${guessDuration === sec ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'glass text-white/70 border-white/10 hover:bg-white/10'}`}
                  >
                    {sec/60}m
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/40 mt-2">You get ONE timer to guess all bombs, not per bomb. Recommended 4m for 10 players.</p>
            </div>
            <button onClick={handleJoin} className="w-full mt-5 py-3.5 rounded-2xl neon-purple text-white font-bold hover:opacity-90">Join Lobby →</button>
            <p className="text-xs text-white/40 text-center mt-3">Same WiFi required • Name must be unique</p>
            {players.length > 0 && (
              <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-xs text-white/50">Already in lobby ({players.length}):</p>
                <p className="text-sm text-white/80 mt-1 flex flex-wrap gap-1">{players.map(p=> <span key={p} className="px-2 py-1 rounded-full bg-white/10 text-xs">{p}</span>)}</p>
              </div>
            )}
          </motion.div>
        ) : phase === 'lobby' || phase === 'submitting' ? (
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="lg:col-span-2 space-y-4">
              {!mySubmitted ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] glass-strong border border-white/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#A855F7]/20 border border-[#A855F7]/30 grid place-items-center"><Bomb size={18} className="text-[#A855F7]" /></div>
                    <div>
                      <h3 className="text-white font-bold">Drop Your Bomb Anonymously</h3>
                      <p className="text-white/50 text-xs">No one will see your name, only the text</p>
                    </div>
                  </div>
                  <textarea
                    value={confessionText}
                    onChange={e => setConfessionText(e.target.value)}
                    placeholder="Type your secret/confession/roast... e.g. I have a crush on someone in this room 😏"
                    maxLength={300}
                    rows={4}
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/50 resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-white/40">{confessionText.length}/300</span>
                    <button onClick={submitConfession} className="px-6 py-2.5 rounded-xl neon-purple text-white font-bold flex items-center gap-2 hover:opacity-90">
                      <Send size={16}/> Drop Bomb 💣
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[24px] bg-[#A855F7]/10 border border-[#A855F7]/20 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#A855F7] mx-auto grid place-items-center text-2xl">✅</div>
                  <h3 className="text-white font-bold mt-3">Bomb Dropped!</h3>
                  <p className="text-white/60 text-sm mt-1">Your confession is anonymous. Wait for others...</p>
                  <p className="text-[#E9D5FF] text-sm mt-3 font-medium">{submittedCount}/{playerCount || players.length} bombs dropped</p>
                  <div className="w-full h-2 rounded-full bg-white/10 mt-3 overflow-hidden">
                    <motion.div className="h-full bg-[#A855F7]" initial={{ width: 0 }} animate={{ width: `${playerCount ? (submittedCount/playerCount)*100 : 0}%` }} />
                  </div>
                </motion.div>
              )}

              {/* Host controls */}
              <div className="rounded-[24px] glass border border-white/10 p-5">
                <h4 className="text-white font-bold flex items-center gap-2"><Crown size={16} className="text-[#EAB308]"/> Host Controls</h4>
                <p className="text-white/50 text-xs mt-1">Anyone can start guessing when ready. Works with any player count (5-20).</p>
                <div className="flex gap-2 mt-4">
                  <select value={guessDuration} onChange={e=>setGuessDuration(Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm">
                    <option value={180} className="bg-black">3 mins total</option>
                    <option value={240} className="bg-black">4 mins total</option>
                    <option value={300} className="bg-black">5 mins total</option>
                    <option value={600} className="bg-black">10 mins total</option>
                  </select>
                  <button onClick={startGuessing} disabled={submittedCount===0} className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    <Timer size={16}/> Start Guessing ({formatTime(guessDuration)} for all)
                  </button>
                </div>
                {allSubmitted && <p className="text-emerald-300 text-xs mt-2">🎉 All {submittedCount} bombs dropped! Ready to guess.</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] glass border border-white/10 p-5">
                <h4 className="text-white font-bold flex items-center gap-2"><Users size={16}/> Lobby • {players.length} joined</h4>
                <div className="flex flex-wrap gap-2 mt-3">
                  {players.map(p=> (
                    <span key={p} className={`px-3 py-1.5 rounded-full text-sm border ${p===username ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-white/10 text-white/80 border-white/10'}`}>{p} {p===username && '• You'}</span>
                  ))}
                  {players.length===0 && <span className="text-white/40 text-sm">Waiting for players...</span>}
                </div>
                <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                  <p className="text-xs text-white/60">Progress: <b className="text-white">{submittedCount}</b> / {players.length} submitted</p>
                  <p className="text-[11px] text-white/40 mt-1">Dynamic lobby: you can start with even 3 players. No need for exactly 20.</p>
                </div>
              </div>

              {confessions.length>0 && (
                <div className="rounded-[24px] glass border border-white/10 p-5">
                  <h4 className="text-white font-bold text-sm">Bombs dropped (anonymous preview)</h4>
                  <div className="space-y-2 mt-3 max-h-[300px] overflow-auto scrollbar-hide pr-1">
                    {confessions.map((c,i)=> (
                      <div key={c.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/5">
                        <p className="text-xs text-[#A855F7] font-bold">BOMB #{i+1}</p>
                        <p className="text-white/80 text-sm mt-1 line-clamp-2">"{c.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : phase === 'guessing' ? (
          <div className="max-w-5xl mx-auto">
            <div className="rounded-[24px] glass-strong border border-[#A855F7]/20 p-5 mb-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl grid place-items-center font-black text-white text-xl ${timeLeft < 30 ? 'bg-red-500 animate-pulse' : 'neon-purple'}`}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">TOTAL TIMER FOR ALL BOMBS</p>
                    <p className={`text-3xl font-black grotesk ${timeLeft < 30 ? 'text-red-400' : 'text-white'}`}>{formatTime(timeLeft)}</p>
                    <p className="text-xs text-white/40">One timer for all {confessions.length} bombs • {guessProgress}/{players.length} locked guesses</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={endEarly} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-semibold hover:bg-white/20">Reveal Early</button>
                  <div className={`px-4 py-2.5 rounded-xl text-sm font-bold ${hasLocked ? 'bg-emerald-500 text-white' : 'bg-white text-black'}`}>
                    {hasLocked ? '✓ Locked' : 'Guessing...'}
                  </div>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 mt-4 overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-[#A855F7] to-[#EC4899]" initial={{ width: '100%' }} animate={{ width: `${(timeLeft / guessDuration)*100}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>

            <div className="grid gap-4">
              {confessions.map((c, idx) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="rounded-[20px] glass border border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-[#A855F7] text-white grid place-items-center text-xs font-black">#{idx+1}</span>
                        <span className="text-xs text-white/50">BOMB #{c.id}</span>
                      </div>
                      <p className="text-white font-medium mt-3 text-[16px] leading-relaxed">"{c.text}"</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className="text-sm text-white/60 whitespace-nowrap">Who wrote this?</span>
                    <select
                      value={guesses[c.id] || ''}
                      onChange={e => setGuesses(prev => ({ ...prev, [c.id]: e.target.value }))}
                      disabled={hasLocked}
                      className="flex-1 w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm focus:outline-none focus:border-[#A855F7]/50 disabled:opacity-60"
                    >
                      <option value="" className="bg-black">— Select a name —</option>
                      {players.map(p => (
                        <option key={p} value={p} className="bg-black">{p} {p===username ? '(You)' : ''}</option>
                      ))}
                    </select>
                    {guesses[c.id] && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check size={14}/> {guesses[c.id]}</span>}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={submitGuesses} disabled={hasLocked} className="flex-1 py-4 rounded-2xl neon-purple text-white font-black text-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {hasLocked ? '✓ Guesses Locked' : 'LOCK ALL GUESSES'} <Send size={18}/>
              </button>
            </div>
            <p className="text-center text-white/40 text-xs mt-3">Timer is for ALL bombs together. Auto-reveal when timer hits 0. Host can reveal early.</p>
          </div>
        ) : phase === 'reveal' && results ? (
          <div className="max-w-5xl mx-auto space-y-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[24px] neon-purple p-6 text-center text-white">
              <h2 className="text-3xl font-black grotesk">🎉 BOMBS REVEALED!</h2>
              <p className="text-white/90 text-sm mt-2">Here's who wrote what & who guessed right</p>
            </motion.div>

            <div className="grid gap-4">
              {results.confResults.map((cr, idx) => (
                <div key={cr.id} className="rounded-[20px] glass border border-white/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-[#A855F7] text-white text-xs font-bold">BOMB #{idx+1}</span>
                    <span className="text-white/60 text-xs">by</span>
                    <span className="px-3 py-1 rounded-full bg-white text-black text-sm font-bold">{cr.authorUsername}</span>
                    <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">{cr.correctCount} correct</span>
                  </div>
                  <p className="text-white text-[16px] font-medium">"{cr.text}"</p>
                  <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-emerald-300 font-bold text-xs">✅ Correct ({cr.correctGuessers.length})</p>
                      <p className="text-white/80 mt-1">{cr.correctGuessers.length ? cr.correctGuessers.join(', ') : 'No one guessed!'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-300 font-bold text-xs">❌ Wrong ({cr.wrongGuessers.length})</p>
                      <p className="text-white/60 mt-1 text-xs leading-relaxed">{cr.wrongGuessers.length ? cr.wrongGuessers.map(w=> `${w.guesser}→${w.guessed}`).join(', ') : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] glass-strong border border-[#EAB308]/20 overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-[#EAB308]/20 to-[#F97316]/20 border-b border-white/10 flex items-center gap-3">
                <Trophy className="text-[#EAB308]" />
                <h3 className="text-white font-black grotesk text-xl">Leaderboard</h3>
                <span className="ml-auto text-xs px-3 py-1 rounded-full bg-white text-black font-bold">Most Correct Wins</span>
              </div>
              <div className="p-5 space-y-3">
                {results.leaderboard.map((row, i) => (
                  <div key={row.username} className={`flex items-center gap-4 p-4 rounded-2xl border ${i===0 ? 'bg-gradient-to-r from-[#EAB308]/20 to-transparent border-[#EAB308]/30' : 'bg-white/[0.04] border-white/10'}`}>
                    <span className={`w-10 h-10 rounded-xl grid place-items-center font-black text-sm ${i===0 ? 'bg-[#EAB308] text-black' : i===1 ? 'bg-white/20 text-white' : i===2 ? 'bg-[#F97316]/30 text-white' : 'bg-white/10 text-white/60'}`}>#{i+1}</span>
                    <div className="flex-1">
                      <p className="text-white font-bold flex items-center gap-2">{row.username} {i===0 && <Crown size={16} className="text-[#EAB308]"/>} {row.username===username && <span className="text-xs px-2 py-0.5 rounded-full bg-[#A855F7] text-white">You</span>}</p>
                      <p className="text-white/50 text-xs">{row.correct} / {row.total} correct guesses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{row.correct}</p>
                      <p className="text-xs text-white/50">points</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-5 flex gap-3">
                <button onClick={resetKeep} className="flex-1 py-3 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2"><RotateCcw size={18}/> Play Again (Keep Players)</button>
                <button onClick={()=> { socket.emit('confession:reset'); setMySubmitted(false); setGuesses({}); setHasLocked(false); setResults(null); setConfessionText(''); }} className="px-6 py-3 rounded-2xl glass text-white font-semibold">Full Reset</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <RulesModal open={showRules} onClose={()=>setShowRules(false)} game="confession" />
    </div>
  )
}
