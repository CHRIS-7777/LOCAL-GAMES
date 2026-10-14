# GANG PACK - 2-in-1 Party Games 🎉

Local WiFi party games for your gang (5-20 players). No internet needed!

### Games Included
1. **💣 Confession Bomb** - Anonymous secrets, guess who wrote what with ONE total timer for all bombs
2. **🕵️ Imposter** - Word bluff game, find the liar + dare twist

Built for same WiFi network. All phones connect to host laptop's local IP.

---

## 🚀 Quick Start (Local WiFi)

### 1. Install
```bash
# from gang-pack folder
npm run install:all
# or manually:
cd server && npm install
cd ../client && npm install
```

### 2. Build Client (for single-port mode)
```bash
npm run build
# builds client/dist, server will serve it on port 3000
```

### 3. Start Server (Host Laptop)
```bash
npm start
# or: cd server && npm start
```
Server will print:
```
=== GANG PACK SERVER ===
Local:   http://localhost:3000
Network: http://192.168.x.x:3000  <- SHARE THIS with friends
DB: .../server/database.db
```

### 4. Friends Join (Same WiFi)
- Everyone connects to **same WiFi** as host
- Open browser on phone: `http://192.168.x.x:3000` (the Network URL)
- Or for dev: host runs `npm run dev:client` -> `http://192.168.x.x:5173`

### 5. Play
- Landing page shows 2 cards -> Pick game -> Join with unique name
- Works with 5, 10 or 20 players (dynamic)
- Project host laptop on TV for reveals

---

## 🎮 How To Play

### Confession Bomb (Updated Flow)
1. **Join**: Enter unique gang name (used for dropdown, but bomb stays anonymous)
2. **Drop Bomb**: Type one secret/roast (300 chars max). Anonymous storage.
3. **Guessing**: Once submissions done, host starts guessing. **ALL bombs shown together**. You get ONE total timer (3m/4m/5m/10m selectable) to guess WHO wrote each bomb via dropdown of real names.
4. **Reveal**: Final leaderboard shows who wrote what, who guessed correctly, points = correct guesses.

Host controls: Set timer, Start Guessing, Reveal Early, Play Again.

### Imposter
1. Lobby 3-20 players -> Host START GAME
2. Everyone gets secret word on phone. Imposter gets different similar word (e.g. CHAI vs COFFEE)
3. Discuss in shuffled order - describe without saying the word
4. Vote who is SUS
5. If civilians catch imposter -> Civilians win. Else Imposter wins and **chooses 1 victim** for random dare (30 dares stored in SQLite) shown full-screen.

---

## 🎨 UI Theme
Dark black `#050508` + Glassmorphism + Neon Purple/Cyan/Pink/Amber. Fully mobile responsive.

## 🛠 Stack
- **Frontend**: Vite + React + Tailwind CSS + Framer Motion + socket.io-client
- **Backend**: Node.js + Express + Socket.IO + better-sqlite3
- **DB**: SQLite file `server/database.db` (auto-created) + in-memory live state

## 📂 Structure
```
gang-pack/
  client/  # React frontend (port 5173 dev, or built to dist)
  server/  # Express + Socket.IO + SQLite (port 3000)
  package.json # root scripts
```

## 🔧 Dev Mode (Two Ports)
```bash
# Terminal 1 - Server
cd server && npm start   # http://localhost:3000

# Terminal 2 - Client
cd client && npm run dev # http://localhost:5173 (proxy to 3000)
```

## 📱 Tips
- Host should disable firewall for port 3000 or allow Node.js
- If `192.168.x.x` doesn't work, try the IP shown in server logs (Tailscale IP also works)
- All users differentiated by SocketID + Username (solves same IP problem)
- No login, just unique username per game lobby

## 🗄 DB Tables
- `confessions`, `guesses`, `players`, `dares` (30 pre-seeded)

Enjoy! 🎉
