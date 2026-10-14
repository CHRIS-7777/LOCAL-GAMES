import { motion, AnimatePresence } from 'framer-motion'
import { X, Bomb, Search, Trophy, Clock, Users, Zap } from 'lucide-react'

export function RulesModal({ open, onClose, game }) {
  if (!open) return null;
  const isConfession = game === 'confession';
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-[24px] glass-strong border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            <div className={`p-6 ${isConfession ? 'neon-purple' : 'neon-amber'} relative`}>
              <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white">
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
                  {isConfession ? '💣' : '🕵️'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white grotesk">{isConfession ? 'Confession Bomb' : 'Imposter Game'} Rules</h2>
                  <p className="text-white/80 text-sm">{isConfession ? 'Secrets explode, guess who wrote what' : 'Find the liar among you'}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 bg-[#0A0A0F]">
              {isConfession ? (
                <>
                  <RuleStep n="1" icon={<Users size={16}/>} title="Join with your name" desc="Enter a unique gang name. Works for same WiFi - we use name + connection to keep you unique." />
                  <RuleStep n="2" icon={<Bomb size={16}/>} title="Drop your bomb anonymously" desc="Type one secret/confession/roast. No one sees your name. Only the text is stored. Dynamic count: works with 5, 10 or 20 players." />
                  <RuleStep n="3" icon={<Search size={16}/>} title="Guess all bombs together" desc="Once everyone submitted, ALL bombs are shown at once. You get ONE total timer (3 / 4 / 5 / 10 mins) to guess WHO wrote each bomb via dropdown of real names." />
                  <RuleStep n="4" icon={<Trophy size={16}/>} title="Scoring" desc="+1 point for each correct guess. Author gets no points. Highest correct guesses wins Bomb Detective 👑. Final reveal shows real authors & leaderboard." />
                  <div className="rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/20 p-4">
                    <p className="text-sm text-[#E9D5FF] font-medium">💡 Pro Tip: Host can set timer (3, 4, 5 or 10 mins) before starting guessing. If everyone locks early, host can Reveal early.</p>
                  </div>
                </>
              ) : (
                <>
                  <RuleStep n="1" icon={<Users size={16}/>} title="Lobby (3-20 players)" desc="Everyone joins with unique name. Host picks Rounds (1-3) — each round every player types one clue. Host clicks START GAME." />
                  <RuleStep n="2" icon={<Zap size={16}/>} title="Secret word" desc="All get same word (e.g. CHAI) except IMPOSER who gets a similar word (COFFEE). You don't know if you're imposter until you compare clues!" />
                  <RuleStep n="3" icon={<Clock size={16}/>} title="Type in order (no speaking)" desc="In shuffled order, type ONE sentence clue without typing your secret word. If you type the word, you get ⚠️ warning and blocked. Others see live typing indicator: 'Rahul is typing...'." />
                  <RuleStep n="4" icon={<Trophy size={16}/>} title="Rounds & Vote" desc="After all rounds (e.g. 5 players × 2 rounds = 10 clues) voting unlocks. Vote who is imposter. Most votes → Civilians win. Else Imposter wins and picks 1 victim for random dare!" />
                  <div className="rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/20 p-4">
                    <p className="text-sm text-[#FEF08A] font-medium">🔥 Twist: If Imposter survives, only THEIR phone shows victim picker + random dare from 30 dares. Victim's dare shows full-screen! Typing status shows live: Waiting / Typing... / Done ✓</p>
                  </div>
                </>
              )}
              <button onClick={onClose} className={`w-full py-3 rounded-2xl font-bold text-white ${isConfession ? 'neon-purple' : 'neon-amber'} hover:opacity-90 transition`}>Got it, Let's Play!</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function RuleStep({ n, icon, title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 text-white/80">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold grid place-items-center">{n}</span>
          <h4 className="font-bold text-white text-[15px]">{title}</h4>
        </div>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
