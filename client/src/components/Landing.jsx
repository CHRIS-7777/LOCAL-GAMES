import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bomb, Eye, Users, Wifi, Crown, Sparkles, ArrowRight, HelpCircle } from 'lucide-react'
import { RulesModal } from './RulesModal'
import { socket } from '../socket'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const [rulesGame, setRulesGame] = useState(null)
  const [online, setOnline] = useState(0)
  const [confCount, setConfCount] = useState(0)
  const [impCount, setImpCount] = useState(0)
  const [serverIP, setServerIP] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    socket.on('lobby:update', (d) => {
      setOnline(d.totalOnline)
      setConfCount(d.confession.count)
      setImpCount(d.imposter.count)
    })
    fetch('/api/ip').then(r=>r.json()).then(d=> setServerIP(`${d.ip}:${d.port}`)).catch(()=>{})
    // also fetch via socket? fallback
    return ()=> socket.off('lobby:update')
  }, [])

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      {/* bg glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#A855F7]/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-[#06B6D4]/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#EC4899]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl neon-purple grid place-items-center font-black text-white text-lg">GP</div>
            <div>
              <h1 className="font-black text-white grotesk text-xl tracking-tight">GANG PACK</h1>
              <p className="text-xs text-white/50 -mt-1">Party Games • Same WiFi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white/80">{online} Online</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-white/60">
              <Wifi size={14} /> {serverIP || 'Local Network'}
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 pt-6 pb-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[#A855F7]/20 text-sm mb-4">
              <Sparkles size={16} className="text-[#A855F7]" />
              <span className="text-white/90">2-in-1 Party Pack for your gang</span>
              <span className="px-2 py-0.5 rounded-full bg-[#A855F7] text-white text-xs font-bold">20 MAX</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black grotesk text-white leading-tight">
              CHOOSE YOUR<br />
              <span className="bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#06B6D4] bg-clip-text text-transparent">CHAOS MODE</span>
            </h2>
            <p className="text-white/60 mt-4 max-w-2xl mx-auto text-sm sm:text-base">
              Same WiFi, no internet needed. Everyone scans & joins. Dynamic players — works with 5, 10 or 20. Pick your mood.
            </p>
          </motion.div>
        </section>

        {/* Cards */}
        <section className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
          {/* Confession */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }}
            className="group relative rounded-[28px] overflow-hidden glass border-glow"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition bg-gradient-to-br from-[#A855F7] via-transparent to-[#EC4899] pointer-events-none" />
            <div className="relative p-7">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl neon-purple grid place-items-center text-2xl shadow-lg shadow-[#A855F7]/20">💣</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/80 flex items-center gap-1"><Users size={12}/> {confCount} in lobby</span>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">Live</span>
                </div>
              </div>
              <h3 className="text-2xl font-black grotesk text-white">CONFESSION BOMB</h3>
              <p className="text-[#D8B4FE] font-medium text-sm mt-1">Secrets will explode</p>
              <p className="text-white/60 text-sm mt-3 leading-relaxed">Everyone drops an anonymous bomb. Then you get <b className="text-white">one total timer (3-10 mins)</b> to guess WHO wrote each bomb. Most correct wins.</p>

              <div className="flex gap-2 mt-5 flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Anonymous</span>
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Dynamic 5-20</span>
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Total Timer</span>
              </div>

              <div className="flex gap-3 mt-7">
                <button onClick={() => navigate('/confession')} className="flex-1 py-3.5 rounded-2xl neon-purple text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition shadow-lg shadow-[#A855F7]/20">
                  PLAY NOW <ArrowRight size={18} />
                </button>
                <button onClick={() => setRulesGame('confession')} className="px-5 py-3.5 rounded-2xl glass text-white font-semibold flex items-center gap-2 hover:bg-white/10 transition">
                  <HelpCircle size={18}/> Rules
                </button>
              </div>
            </div>
          </motion.div>

          {/* Imposter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ y: -4 }}
            className="group relative rounded-[28px] overflow-hidden glass border-glow"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition bg-gradient-to-br from-[#EAB308] via-transparent to-[#06B6D4] pointer-events-none" />
            <div className="relative p-7">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl neon-amber grid place-items-center text-2xl shadow-lg shadow-[#EAB308]/20">🕵️</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/80 flex items-center gap-1"><Users size={12}/> {impCount} in lobby</span>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">Live</span>
                </div>
              </div>
              <h3 className="text-2xl font-black grotesk text-white">IMPOSTER</h3>
              <p className="text-[#FDE68A] font-medium text-sm mt-1">Find the liar</p>
              <p className="text-white/60 text-sm mt-3 leading-relaxed">One imposter gets a different word. Describe, bluff, then vote. If imposter survives, <b className="text-white">he picks a victim for a random dare</b>.</p>

              <div className="flex gap-2 mt-5 flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Word Bluff</span>
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Vote SUS</span>
                <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/70">Dare Twist</span>
              </div>

              <div className="flex gap-3 mt-7">
                <button onClick={() => navigate('/imposter')} className="flex-1 py-3.5 rounded-2xl neon-amber text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition shadow-lg shadow-[#EAB308]/20">
                  PLAY NOW <ArrowRight size={18} />
                </button>
                <button onClick={() => setRulesGame('imposter')} className="px-5 py-3.5 rounded-2xl glass text-white font-semibold flex items-center gap-2 hover:bg-white/10 transition">
                  <HelpCircle size={18}/> Rules
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer info */}
        <section className="max-w-6xl mx-auto px-4 pb-10">
          <div className="rounded-[20px] glass p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3 text-white/70">
              <div className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center"><Crown size={16} className="text-[#EAB308]" /></div>
              <div>
                <p className="font-semibold text-white">Local WiFi Only • No Internet Needed</p>
                <p className="text-xs text-white/50">Host runs server on laptop, friends join via <span className="text-white/80 font-mono">{serverIP || '192.168.x.x:3000'}</span> or <span className="text-white/80">5173</span> for dev</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="hidden sm:inline">Built for mixed gang • Boys & Girls • 5-20 players</span>
            </div>
          </div>
          <p className="text-center text-xs text-white/30 mt-6">Tip: Project the host laptop on TV for bomb reveals & voting results. Phones are controllers.</p>
        </section>
      </div>

      <RulesModal open={!!rulesGame} onClose={() => setRulesGame(null)} game={rulesGame} />
    </div>
  )
}
