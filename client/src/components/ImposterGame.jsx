import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Users, Eye, Vote, Crown, Timer, Play, SkipForward, Target, RotateCcw, AlertCircle, Send, MessageSquare, Pencil, CheckCircle2, Clock3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { RulesModal } from './RulesModal'

export default function ImposterGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('lobby')
  const [players, setPlayers] = useState([])
  const [username, setUsername] = useState(localStorage.getItem('gp_username') || '')
  const [joined, setJoined] = useState(false)
  const [myWord, setMyWord] = useState(null)
  const [isImposter, setIsImposter] = useState(false)
  const [order, setOrder] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalRounds, setTotalRounds] = useState(1)
  const [selectedRounds, setSelectedRounds] = useState(1)
  const [currentRound, setCurrentRound] = useState(1)
  const [clues, setClues] = useState([])
  const [typingMap, setTypingMap] = useState({})
  const [canVote, setCanVote] = useState(false)
  const [votes, setVotes] = useState({})
  const [voted, setVoted] = useState(null)
  const [voteProgress, setVoteProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [dare, setDare] = useState(null)
  const [victim, setVictim] = useState(null)
  const [imposterName, setImposterName] = useState(null)
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [victimPick, setVictimPick] = useState('')
  const [clueInput, setClueInput] = useState('')
  const [warning, setWarning] = useState('')
  const typingTimeoutRef = useRef(null)
  const lastTypingRef = useRef(false)

  const currentSpeaker = order[currentIdx] || null
  const isMyTurn = currentSpeaker === username && phase === 'discussion'
  const myCluesThisGame = clues.filter(c => c.username === username)
  const cluesNeeded = players.length * totalRounds

  const checkSecretWord = (text) => {
    if (!myWord || !text) return false
    return text.toLowerCase().includes(myWord.toLowerCase())
  }

  useEffect(() => {
    const handleJoined = (d) => { if (d.gameType === 'imposter') { setJoined(true); setError('') } }
    const handleError = (m) => setError(m)
    const handleState = (s) => {
      setPhase(s.phase)
      setPlayers(s.players)
      setOrder(s.discussionOrder || [])
      setCurrentIdx(s.currentSpeakerIdx || 0)
      if (s.totalRounds) setTotalRounds(s.totalRounds)
      if (s.currentRound) setCurrentRound(s.currentRound)
      if (s.clues) setClues(s.clues)
      if (s.typing) setTypingMap(s.typing)
      if (typeof s.canVote === 'boolean') setCanVote(s.canVote)
      if (s.imposterUsername) setImposterName(s.imposterUsername)
      if (s.dare) setDare(s.dare)
      if (s.victim) setVictim(s.victim)
    }
    const handleYourWord = ({ word, isImposter, order, totalRounds }) => {
      setMyWord(word)
      setIsImposter(isImposter)
      setOrder(order)
      if (totalRounds) setTotalRounds(totalRounds)
    }
    const handleClues = ({ clues, currentRound, totalRounds, currentSpeaker, canVote }) => {
      setClues(clues || [])
      if (currentRound) setCurrentRound(currentRound)
      if (totalRounds) setTotalRounds(totalRounds)
      if (typeof canVote === 'boolean') setCanVote(canVote)
    }
    const handleTyping = ({ typing }) => setTypingMap(typing || {})
    const handleRoundsComplete = () => setCanVote(true)
    const handleSecretWarning = ({ word }) => setWarning(`⚠️ Secret word "${word}" is not allowed!`)
    const handleClueAccepted = () => { setClueInput(''); setWarning(''); emitTyping(false) }
    const handleDiscussionStarted = ({ order }) => setOrder(order)
    const handleVotingStarted = () => { setVoted(null); setVotes({}) }
    const handleVoted = ({ votedUsername }) => setVoted(votedUsername)
    const handleVoteProgress = ({ voted }) => setVoteProgress(voted)
    const handleResult = (r) => { setResult(r); setImposterName(r.imposterUsername); setPhase('result') }
    const handleDareChosen = ({ victim, dare }) => { setVictim(victim); setDare(dare); setPhase('dare') }
    const handleLobby = (d) => setPlayers(d.imposter.players)

    socket.on('joined', handleJoined)
    socket.on('error_msg', handleError)
    socket.on('imposter:state', handleState)
    socket.on('imposter:yourWord', handleYourWord)
    socket.on('imposter:clues', handleClues)
    socket.on('imposter:typing', handleTyping)
    socket.on('imposter:roundsComplete', handleRoundsComplete)
    socket.on('imposter:secretWordWarning', handleSecretWarning)
    socket.on('imposter:clueAccepted', handleClueAccepted)
    socket.on('imposter:discussionStarted', handleDiscussionStarted)
    socket.on('imposter:votingStarted', handleVotingStarted)
    socket.on('imposter:voted', handleVoted)
    socket.on('imposter:voteProgress', handleVoteProgress)
    socket.on('imposter:result', handleResult)
    socket.on('imposter:dareChosen', handleDareChosen)
    socket.on('lobby:update', handleLobby)

    return () => {
      socket.off('joined', handleJoined)
      socket.off('error_msg', handleError)
      socket.off('imposter:state', handleState)
      socket.off('imposter:yourWord', handleYourWord)
      socket.off('imposter:clues', handleClues)
      socket.off('imposter:typing', handleTyping)
      socket.off('imposter:roundsComplete', handleRoundsComplete)
      socket.off('imposter:secretWordWarning', handleSecretWarning)
      socket.off('imposter:clueAccepted', handleClueAccepted)
      socket.off('imposter:discussionStarted', handleDiscussionStarted)
      socket.off('imposter:votingStarted', handleVotingStarted)
      socket.off('imposter:voted', handleVoted)
      socket.off('imposter:voteProgress', handleVoteProgress)
      socket.off('imposter:result', handleResult)
      socket.off('imposter:dareChosen', handleDareChosen)
      socket.off('lobby:update', handleLobby)
    }
  }, [])

  const emitTyping = (isTyping) => {
    if (lastTypingRef.current === isTyping) return
    lastTypingRef.current = isTyping
    socket.emit('imposter:typing', { isTyping })
  }

  const handleClueInputChange = (e) => {
    const val = e.target.value
    setClueInput(val)
    if (checkSecretWord(val)) {
      setWarning(`⚠️ Secret word "${myWord}" is not allowed in your clue!`)
    } else {
      setWarning('')
    }
    // typing indicator
    if (isMyTurn) {
      emitTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1200)
    }
  }

  const handleJoin = () => {
    if (!username.trim()) { setError('Enter gang name'); return; }
    localStorage.setItem('gp_username', username.trim())
    socket.emit('join_game', { username: username.trim(), gameType: 'imposter' })
  }

  const startGame = () => socket.emit('imposter:startGame', { rounds: selectedRounds })
  const nextSpeaker = () => socket.emit('imposter:nextSpeaker')
  const goVoting = () => socket.emit('imposter:goToVoting')
  const skipReveal = () => socket.emit('imposter:skipWordReveal')
  const vote = (name) => socket.emit('imposter:vote', { votedUsername: name })
  const submitClue = () => {
    if (!clueInput.trim()) { setError('Type your clue first'); return; }
    if (checkSecretWord(clueInput)) {
      setWarning(`⚠️ Secret word "${myWord}" is not allowed!`)
      socket.emit('imposter:submitClue', { text: clueInput.trim() }) // let server also reject to show warning
      return
    }
    socket.emit('imposter:submitClue', { text: clueInput.trim() })
    // don't clear here, wait for clueAccepted
  }
  const chooseVictim = () => {
    if (!victimPick) { setError('Pick a victim'); return; }
    socket.emit('imposter:chooseVictim', { victimUsername: victimPick })
  }
  const reset = (keep) => {
    socket.emit('imposter:reset', { keepPlayers: keep })
    setMyWord(null)
    setIsImposter(false)
    setVoted(null)
    setResult(null)
    setDare(null)
    setVictim(null)
    setVictimPick('')
    setClues([])
    setTypingMap({})
    setCanVote(false)
    setCurrentRound(1)
    setClueInput('')
    setWarning('')
  }

  const getPlayerStatus = (name) => {
    const isTyping = !!typingMap[name]
    const cluesByPlayer = clues.filter(c => c.username === name).length
    const expectedCluesForCurrentRound = clues.filter(c => c.round === currentRound && c.username === name).length
    // For current round perspective, but overall we show done if they have submitted for current round? Better show overall progress
    const hasSubmittedCurrentRound = clues.some(c => c.username === name && c.round === currentRound)
    const totalByPlayer = clues.filter(c => c.username === name).length
    const doneAllRounds = totalByPlayer >= totalRounds

    if (phase !== 'discussion') return { label: 'Waiting', color: 'text-white/40' }
    if (doneAllRounds) return { label: 'Done ✓', sub: `${totalByPlayer}/${totalRounds}`, color: 'text-emerald-300' }
    if (name === currentSpeaker) {
      if (isTyping) return { label: 'Typing...', sub: `R${currentRound}/${totalRounds}`, color: 'text-[#EAB308]', dot: true }
      if (hasSubmittedCurrentRound) return { label: 'Done R' + currentRound, color: 'text-emerald-300' }
      return { label: 'Your turn', sub: `R${currentRound}/${totalRounds}`, color: 'text-[#EAB308] font-bold', dot: true }
    }
    if (isTyping) return { label: 'Typing...', color: 'text-[#EAB308]', dot: true }
    if (hasSubmittedCurrentRound) return { label: 'Done', sub: `R${currentRound}`, color: 'text-emerald-300' }
    return { label: 'Waiting', sub: `R${currentRound}/${totalRounds}`, color: 'text-white/40' }
  }

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#EAB308]/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-[#06B6D4]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white hover:bg-white/10">
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-white/70"><Users size={14} /> {players.length} players</span>
            <button onClick={() => setShowRules(true)} className="px-4 py-2 rounded-full glass text-white text-sm">Rules ?</button>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full neon-amber text-white font-bold text-sm">
            <Eye size={16} /> IMPOSTER 🕵️
          </div>
          <h1 className="text-3xl font-black grotesk text-white mt-3">Find The Liar</h1>
          <p className="text-white/50 text-sm mt-1">Phase: <span className="text-white font-bold capitalize">{phase}</span> • {players.length} players • 3-20 supported {phase === 'discussion' && `• Round ${currentRound}/${totalRounds}`}</p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error} <button onClick={() => setError('')} className="ml-auto">✕</button>
          </div>
        )}

        {!joined ? (
          <div className="max-w-md mx-auto rounded-[24px] glass-strong border border-white/10 p-6">
            <h3 className="text-white font-bold text-lg grotesk">Join Imposter</h3>
            <p className="text-white/60 text-sm mt-1">Unique name required. Host will start when everyone joined.</p>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Your gang name" maxLength={20} onKeyDown={e => e.key === 'Enter' && handleJoin()} className="w-full mt-4 px-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#EAB308]/50" />
            <button onClick={handleJoin} className="w-full mt-5 py-3.5 rounded-2xl neon-amber text-white font-bold">Join Lobby →</button>
            {players.length > 0 && (
              <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-xs text-white/50">In lobby ({players.length}):</p>
                <p className="text-sm text-white/80 mt-1 flex flex-wrap gap-1">{players.map(p => <span key={p} className="px-2 py-1 rounded-full bg-white/10 text-xs">{p}</span>)}</p>
              </div>
            )}
          </div>
        ) : phase === 'lobby' ? (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="rounded-[24px] glass-strong border border-white/10 p-6">
              <h3 className="text-white font-bold flex items-center gap-2"><Users size={18} /> Lobby • {players.length} / 20</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                {players.map(p => (
                  <span key={p} className={`px-4 py-2 rounded-full text-sm font-semibold border ${p === username ? 'bg-[#EAB308] text-black border-[#EAB308]' : 'bg-white/10 text-white border-white/10'}`}>{p} {p === username && '• You'}</span>
                ))}
                {players.length === 0 && <span className="text-white/40">Waiting...</span>}
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                <p className="text-white font-bold text-sm flex items-center gap-2"><Clock3 size={16} className="text-[#EAB308]" /> Rounds (how many times each player describes)</p>
                <div className="flex gap-2 mt-3">
                  {[1, 2, 3].map(r => (
                    <button key={r} onClick={() => setSelectedRounds(r)} className={`flex-1 py-3 rounded-xl font-bold border text-sm ${selectedRounds === r ? 'bg-[#EAB308] text-black border-[#EAB308]' : 'glass text-white/70 border-white/10 hover:bg-white/10'}`}>
                      {r} Round{r > 1 ? 's' : ''} <span className="block text-xs font-normal opacity-70">{players.length * r} clues total</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-2">Recommended: 1 round for 15-20 players, 2 rounds for 5-10 players. Voting enables after all {players.length * selectedRounds} clues.</p>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={startGame} disabled={players.length < 3} className="flex-1 py-3.5 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-2 disabled:opacity-40">
                  <Play size={18} /> START GAME {players.length < 3 && '(Need 3+)'}
                </button>
                <button onClick={() => reset(true)} className="px-5 py-3.5 rounded-2xl glass text-white">Reset</button>
              </div>
              <p className="text-xs text-white/40 mt-3">Dynamic count: works with 5, 10 or 20. Host selects rounds before start.</p>
            </div>
            <div className="rounded-[20px] glass border border-white/10 p-4">
              <p className="text-sm text-white/70"><b className="text-white">New:</b> Type clues instead of speaking. Secret word is blocked with warning. Status shows who is typing. Voting locks until all rounds done.</p>
            </div>
          </div>
        ) : phase === 'wordReveal' ? (
          <div className="max-w-md mx-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[24px] glass-strong border border-[#EAB308]/20 p-8 text-center">
              <p className="text-white/60 text-sm">YOUR SECRET WORD</p>
              <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="mt-6 p-8 rounded-[20px] bg-gradient-to-br from-[#EAB308] to-[#F97316] text-white shadow-xl">
                <p className="text-4xl font-black grotesk tracking-wider">{myWord || '...'}</p>
                <p className="text-white/80 text-xs mt-2">{isImposter ? 'You are IMPOSTER - your word is different!' : 'You are CIVILIAN - blend in!'}</p>
              </motion.div>
              <div className="mt-6 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/60 text-xs">Discussion Order (shuffled) • {totalRounds} Round{totalRounds > 1 ? 's' : ''}</p>
                <p className="text-white text-sm mt-1">{order.join(' → ')}</p>
              </div>
              <p className="text-white/40 text-xs mt-4">Auto moves to typing in 12s • Describe without typing the word</p>
              <button onClick={skipReveal} className="mt-4 w-full py-2.5 rounded-xl glass text-white text-sm">Skip to Typing →</button>
            </motion.div>
          </div>
        ) : phase === 'discussion' ? (
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Top bar: Round + progress */}
            <div className="rounded-[24px] glass-strong border border-[#EAB308]/20 p-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl neon-amber grid place-items-center text-white font-black text-xl">
                    <Timer size={24} />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">TYPING PHASE • ROUND {currentRound}/{totalRounds}</p>
                    <p className="text-2xl font-black grotesk text-white">{clues.length} / {cluesNeeded} clues</p>
                    <p className="text-xs text-white/40">{canVote ? '✅ All rounds complete — Voting ready' : `Waiting for ${cluesNeeded - clues.length} more clues`}</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className={`px-4 py-2.5 rounded-xl text-sm font-bold border ${canVote ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/10 text-white/60 border-white/10'}`}>
                    {canVote ? 'Voting Ready ✓' : `Round ${currentRound}/${totalRounds}`}
                  </div>
                  <button onClick={goVoting} disabled={!canVote} className={`px-6 py-2.5 rounded-xl font-bold text-sm ${canVote ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>
                    Go to Voting →
                  </button>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 mt-4 overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-[#EAB308] to-[#F97316]" initial={{ width: 0 }} animate={{ width: `${cluesNeeded ? (clues.length / cluesNeeded) * 100 : 0}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                <span>Turn: <b className="text-white">{currentSpeaker}</b> {currentSpeaker === username && '(You)'}</span>
                <span className="hidden sm:inline">Each player types 1 clue per round • Secret word blocked</span>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Left: Order + Status */}
              <div className="space-y-4">
                <div className="rounded-[24px] glass border border-white/10 p-5">
                  <h4 className="text-white font-bold flex items-center gap-2 text-sm"><Users size={14} /> Order & Status</h4>
                  <div className="mt-3 space-y-2">
                    {order.map((name, idx) => {
                      const st = getPlayerStatus(name)
                      const isCurrent = idx === currentIdx
                      return (
                        <div key={name} className={`flex items-center gap-3 p-3 rounded-xl border ${isCurrent ? 'bg-[#EAB308] text-black border-[#EAB308]' : 'bg-white/[0.04] border-white/10'}`}>
                          <span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-black shrink-0 ${isCurrent ? 'bg-black text-white' : 'bg-white/10 text-white/70'}`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${isCurrent ? 'text-black' : 'text-white'}`}>{name} {name === username && '• You'}</p>
                            <p className={`text-xs flex items-center gap-1.5 ${isCurrent ? 'text-black/70' : st.color}`}>
                              {st.dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />} {st.label} {st.sub && `• ${st.sub}`}
                            </p>
                          </div>
                          {isCurrent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                          {!isCurrent && st.label.includes('Done') && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                          {!isCurrent && st.label.includes('Typing') && <Pencil size={14} className="text-[#EAB308] animate-pulse shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] text-white/40">● Typing indicator updates live. Each player submits 1 clue per round.</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={nextSpeaker} className="flex-1 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 flex items-center justify-center gap-1"><SkipForward size={12} /> Skip Turn (host)</button>
                  </div>
                </div>

                {myWord && (
                  <div className="rounded-[20px] glass border border-white/10 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#EAB308]/20 border border-[#EAB308]/30 grid place-items-center text-[#EAB308]"><Eye size={20} /></div>
                    <div>
                      <p className="text-white/60 text-xs">Your word</p>
                      <p className="text-white font-black text-xl tracking-wider">{myWord}</p>
                    </div>
                    <span className="ml-auto text-xs px-3 py-1 rounded-full bg-white/10 text-white/60">{isImposter ? 'IMPOSTER' : 'CIVILIAN'}</span>
                  </div>
                )}
              </div>

              {/* Middle: Clue feed + Input */}
              <div className="lg:col-span-2 space-y-4">
                {/* Clues feed */}
                <div className="rounded-[24px] glass border border-white/10 p-5">
                  <h4 className="text-white font-bold flex items-center gap-2"><MessageSquare size={16} className="text-[#EAB308]" /> Clues Feed • {clues.length} submitted</h4>
                  {clues.length === 0 ? (
                    <p className="text-white/40 text-sm mt-4 text-center py-6">No clues yet — {currentSpeaker} is typing...</p>
                  ) : (
                    <div className="mt-4 space-y-3 max-h-[380px] overflow-auto scrollbar-hide pr-1">
                      {clues.map((c, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-2xl border ${c.username === username ? 'bg-[#EAB308]/10 border-[#EAB308]/20' : 'bg-white/[0.04] border-white/10'}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-white/10 grid place-items-center text-xs font-bold text-white">{c.username[0].toUpperCase()}</span>
                            <span className="text-white font-bold text-sm">{c.username}</span>
                            <span className="text-white/40 text-xs">• Round {c.round}</span>
                            <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/60">#{i + 1}</span>
                          </div>
                          <p className="text-white/90 text-sm mt-2 leading-relaxed">"{c.text}"</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {typingMap[currentSpeaker] && currentSpeaker !== username && (
                    <div className="mt-3 flex items-center gap-2 text-[#EAB308] text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] animate-pulse" /> {currentSpeaker} is typing<span className="animate-pulse">...</span>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className={`rounded-[24px] border p-5 ${isMyTurn ? 'glass-strong border-[#EAB308]/30' : 'glass border-white/10 bg-white/[0.02]'}`}>
                  {isMyTurn ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#EAB308] grid place-items-center text-black"><Pencil size={14} /></div>
                        <div>
                          <p className="text-white font-bold text-sm">Your Turn — Round {currentRound}/{totalRounds}</p>
                          <p className="text-white/50 text-xs">Describe <b className="text-white">{myWord}</b> without typing the word itself</p>
                        </div>
                        <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>

                      <textarea
                        value={clueInput}
                        onChange={handleClueInputChange}
                        placeholder={`Type your clue for round ${currentRound}... (e.g. for CHAI: "I drink it every morning with biscuit")`}
                        rows={3}
                        maxLength={200}
                        className="w-full mt-4 px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#EAB308]/50 resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-white/40">{clueInput.length}/200</span>
                        {myWord && <span className="text-xs text-white/30">Word: <b className="text-white/60">{myWord}</b> • Don't type it</span>}
                      </div>

                      <AnimatePresence>
                        {warning && (
                          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {warning}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={submitClue}
                        disabled={!!warning || !clueInput.trim()}
                        className="w-full mt-4 py-3.5 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90"
                      >
                        <Send size={16} /> Submit Clue for Round {currentRound}
                      </button>
                      <p className="text-center text-white/30 text-xs mt-2">Auto-advances to next player. Voting unlocks after all {cluesNeeded} clues.</p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto grid place-items-center text-white/40">
                        <Clock3 size={20} />
                      </div>
                      <p className="text-white font-bold mt-3">
                        Waiting for <span className="text-[#EAB308]">{currentSpeaker}</span> to type...
                      </p>
                      <p className="text-white/40 text-xs mt-1">Round {currentRound}/{totalRounds} • {clues.length}/{cluesNeeded} clues • You typed {myCluesThisGame.length}/{totalRounds}</p>
                      {typingMap[currentSpeaker] && (
                        <p className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/20 text-[#EAB308] text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] animate-pulse" /> {currentSpeaker} is typing...
                        </p>
                      )}
                      <p className="text-white/30 text-xs mt-4">Your word: <b className="text-white/60">{myWord}</b> {isImposter && '(IMPOSTER word)'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : phase === 'voting' ? (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="rounded-[24px] glass-strong border border-red-500/20 p-6 text-center">
              <h3 className="text-2xl font-black grotesk text-white">WHO IS THE SUS? 🕵️</h3>
              <p className="text-white/60 text-sm mt-1">Vote who you think is imposter. Can't vote yourself. {voteProgress}/{players.length} voted</p>
              <div className="w-full h-2 rounded-full bg-white/10 mt-4 overflow-hidden">
                <motion.div className="h-full bg-red-500" initial={{ width: 0 }} animate={{ width: `${(voteProgress / players.length) * 100}%` }} />
              </div>
              {clues.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/5 max-h-[180px] overflow-auto text-left">
                  <p className="text-xs text-white/50 mb-2">Clues recap:</p>
                  {clues.map((c, i) => <p key={i} className="text-xs text-white/70"><b className="text-white">{c.username} (R{c.round}):</b> "{c.text}"</p>)}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {players.filter(p => p !== username).map(p => (
                <button
                  key={p}
                  onClick={() => vote(p)}
                  disabled={!!voted}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 ${voted === p ? 'bg-red-500 text-white border-red-500' : voted ? 'bg-white/5 border-white/10 text-white/40' : 'glass border-white/10 text-white hover:bg-white/10'}`}
                >
                  <div className={`w-10 h-10 rounded-xl grid place-items-center font-black ${voted === p ? 'bg-white text-red-500' : 'bg-white/10'}`}>{p[0].toUpperCase()}</div>
                  <div className="flex-1">
                    <p className="font-bold">{p}</p>
                    <p className="text-xs opacity-60">{voted === p ? 'Your vote' : 'Tap to vote'}</p>
                  </div>
                  {voted === p && <Vote size={18} />}
                </button>
              ))}
            </div>
            {voted && <p className="text-center text-emerald-300 text-sm">✓ You voted {voted}. Waiting for {players.length - voteProgress} more...</p>}

            {myWord && <div className="text-center text-white/40 text-xs">Your word was <b className="text-white">{myWord}</b></div>}
          </div>
        ) : phase === 'result' && result ? (
          <div className="max-w-3xl mx-auto space-y-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-[24px] p-8 text-center text-white ${result.winner === 'civilians' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-orange-600'}`}>
              <p className="text-5xl">{result.winner === 'civilians' ? '🎉' : '😈'}</p>
              <h2 className="text-3xl font-black grotesk mt-3">{result.winner === 'civilians' ? 'CIVILIANS WIN!' : 'IMPOSTER WINS!'}</h2>
              <p className="text-white/90 mt-2">Imposter was <b className="bg-white text-black px-3 py-1 rounded-full">{result.imposterUsername}</b></p>
              <p className="text-white/80 text-sm mt-2">Word pair: <b>{result.wordPair.civilian}</b> (civilian) vs <b>{result.wordPair.imposter}</b> (imposter)</p>
            </motion.div>

            <div className="rounded-[24px] glass border border-white/10 p-5">
              <h4 className="text-white font-bold">Votes Breakdown</h4>
              <div className="space-y-2 mt-3">
                {Object.entries(result.counts).map(([name, cnt]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-24 text-white/70 text-sm truncate">{name}</span>
                    <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                      <motion.div className={`h-full ${name === result.imposterUsername ? 'bg-red-500' : 'bg-white'}`} initial={{ width: 0 }} animate={{ width: `${(cnt / players.length) * 100}%` }} />
                    </div>
                    <span className="text-white font-bold text-sm w-8">{cnt}</span>
                    {name === result.imposterUsername && <span className="text-xs px-2 py-1 rounded-full bg-red-500 text-white">IMPOSTER</span>}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-white/60">
                Detailed votes: {Object.entries(result.votes).map(([voter, voted]) => `${voter}→${voted}`).join(', ')}
              </div>
              {clues.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                  <p className="text-xs text-white/50 mb-2">All clues ({clues.length}):</p>
                  {clues.map((c, i) => <p key={i} className="text-xs text-white/70"><b className="text-white">{c.username} R{c.round}:</b> "{c.text}"</p>)}
                </div>
              )}
            </div>

            {result.winner === 'imposter' && imposterName === username ? (
              <div className="rounded-[24px] glass-strong border border-[#EAB308]/30 p-6">
                <h3 className="text-white font-black flex items-center gap-2"><Crown className="text-[#EAB308]" /> YOU SURVIVED! Choose victim for dare</h3>
                <p className="text-white/60 text-sm mt-1">Pick someone to give a random dare. Only you see this.</p>
                <select value={victimPick} onChange={e => setVictimPick(e.target.value)} className="w-full mt-4 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                  <option value="" className="bg-black">— Pick victim —</option>
                  {players.filter(p => p !== username).map(p => <option key={p} value={p} className="bg-black">{p}</option>)}
                </select>
                <button onClick={chooseVictim} disabled={!victimPick} className="w-full mt-4 py-3 rounded-xl neon-amber text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"><Target size={16} /> Give Random Dare</button>
              </div>
            ) : result.winner === 'imposter' ? (
              <div className="rounded-[24px] bg-[#EAB308]/10 border border-[#EAB308]/20 p-6 text-center">
                <p className="text-[#FDE68A] font-bold">Imposter {imposterName} is choosing a victim for dare...</p>
                <p className="text-white/60 text-xs mt-2">Watch the dare reveal!</p>
              </div>
            ) : null}

            <div className="flex gap-3">
              <button onClick={() => reset(true)} className="flex-1 py-3 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2"><RotateCcw size={16} /> Play Again (keep players)</button>
              <button onClick={() => reset(false)} className="px-6 py-3 rounded-2xl glass text-white">Full Reset</button>
            </div>
          </div>
        ) : phase === 'dare' ? (
          <div className="max-w-2xl mx-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[28px] overflow-hidden glass-strong border border-[#EAB308]/20">
              <div className="p-8 bg-gradient-to-br from-[#EAB308] to-[#F97316] text-white text-center">
                <p className="text-6xl">🔥</p>
                <h2 className="text-3xl font-black grotesk mt-3">DARE TIME!</h2>
                <p className="text-white/90 mt-2">Imposter <b>{imposterName}</b> chose <b className="bg-white text-black px-3 py-1 rounded-full">{victim}</b></p>
              </div>
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#EAB308]/20 border border-[#EAB308]/30 mx-auto grid place-items-center text-2xl">🎯</div>
                <p className="text-white/60 text-sm mt-4">DARE FOR {victim?.toUpperCase()}</p>
                <p className="text-white text-2xl font-black grotesk mt-3 leading-tight">"{dare}"</p>
                <div className={`mt-6 p-4 rounded-2xl border ${victim === username ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-white/70'}`}>
                  {victim === username ? '😱 IT\'S YOU! Do the dare now! Everyone is watching!' : `Watch ${victim} do the dare!`}
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => reset(true)} className="flex-1 py-3 rounded-2xl bg-white text-black font-bold">Next Round →</button>
                  <button onClick={() => reset(false)} className="px-6 py-3 rounded-2xl glass text-white">End Game</button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </div>
      <RulesModal open={showRules} onClose={() => setShowRules(false)} game="imposter" />
    </div>
  )
}
