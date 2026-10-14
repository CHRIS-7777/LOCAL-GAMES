const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve client build if exists (for single-port deployment)
const clientDist = path.join(__dirname, '../client/dist');
try {
  const fs = require('fs');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    console.log('Serving client from', clientDist);
  }
} catch (e) {}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- DB Setup ---
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    authorUsername TEXT NOT NULL,
    authorSocketId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confessionId INTEGER,
    guesserUsername TEXT,
    guessedUsername TEXT,
    isCorrect INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    gameType TEXT,
    socketId TEXT
  );
  CREATE TABLE IF NOT EXISTS dares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL
  );
`);

const dareCount = db.prepare('SELECT COUNT(*) as c FROM dares').get().c;
if (dareCount === 0) {
  const dares = [
    "Do a funny proposal to the person on your right",
    "Dance for 30 seconds without music",
    "Imitate any teacher/friend for 1 minute",
    "Speak in English accent for next 3 rounds",
    "Do 10 pushups right now",
    "Sing a romantic song loudly",
    "Act like a monkey for 20 seconds",
    "Propose to a chair dramatically",
    "Do your best Bollywood hero entry",
    "Let the group check your last 3 Google searches",
    "Mimic the host for 30 seconds",
    "Do a catwalk across the room",
    "Say 'I love you' to the person on your left in filmy style",
    "Do the worm dance on floor",
    "Exchange your T-shirt with someone (over clothes funny)",
    "Talk without closing your mouth for 20 seconds",
    "Do 5 situps while singing",
    "Let someone else post a status from your phone (for 2 mins)",
    "Act like you are a news anchor reporting gossip",
    "Do a handstand or try (with support)",
    "Speak only in rhyme for next 2 minutes",
    "Do your best animal impression, others guess",
    "Cry like a baby for 15 seconds dramatically",
    "Do a TikTok trend dance",
    "Let the group give you a new funny nickname for tonight",
    "Do a dramatic slow-motion run",
    "Recreate your favorite meme face",
    "Do 20 seconds of free-style rap about the gang",
    "Act like a strict parent scolding everyone",
    "Do a funny walk till the door and back"
  ];
  const stmt = db.prepare('INSERT INTO dares (text) VALUES (?)');
  const insertMany = db.transaction((items) => {
    for (const t of items) stmt.run(t);
  });
  insertMany(dares);
  console.log('Inserted dares:', dares.length);
}

// --- In-Memory Game State ---
function createConfessionState() {
  return {
    phase: 'lobby', // lobby | submitting | guessing | reveal
    players: new Map(), // username -> {username, socketId}
    socketToUser: new Map(), // socketId -> username
    confessions: [], // {id, text, authorUsername, authorSocketId}
    guesses: new Map(), // guesserUsername -> Map(confessionId -> guessedUsername)
    guessDuration: 240, // seconds, configurable 180/240/300
    guessTimeLeft: 0,
    guessTimer: null,
    results: null // cached results after reveal
  };
}

function createImposterState() {
  return {
    phase: 'lobby', // lobby | wordReveal | discussion | voting | result | dare
    players: new Map(), // username -> {username, socketId}
    socketToUser: new Map(),
    wordPair: null,
    assignments: new Map(), // username -> {word, isImposter}
    imposterUsername: null,
    votes: new Map(), // voterUsername -> votedUsername
    discussionOrder: [],
    currentSpeakerIdx: 0,
    totalRounds: 1,
    currentRound: 1,
    clues: [], // {username, text, round, idx}
    typing: new Map(), // username -> boolean
    canVote: false,
    dare: null,
    victim: null,
    winner: null // 'civilians' | 'imposter'
  };
}

let confessionGame = createConfessionState();
let imposterGame = createImposterState();

const WORD_PAIRS = [
  { civilian: "CHAI", imposter: "COFFEE" },
  { civilian: "BEACH", imposter: "POOL" },
  { civilian: "MOVIE", imposter: "SERIES" },
  { civilian: "PIZZA", imposter: "BURGER" },
  { civilian: "CRICKET", imposter: "FOOTBALL" },
  { civilian: "INSTAGRAM", imposter: "SNAPCHAT" },
  { civilian: "BIKE", imposter: "CAR" },
  { civilian: "DOG", imposter: "CAT" },
  { civilian: "SCHOOL", imposter: "COLLEGE" },
  { civilian: "SINGING", imposter: "DANCING" },
  { civilian: "MOMO", imposter: "SAMOSA" },
  { civilian: "IPHONE", imposter: "ANDROID" },
  { civilian: "WINTER", imposter: "SUMMER" },
  { civilian: "BOOK", imposter: "MOVIE" },
  { civilian: "GOLD", imposter: "DIAMOND" },
  { civilian: "GUITAR", imposter: "PIANO" },
  { civilian: "BATMAN", imposter: "SPIDERMAN" },
  { civilian: "ROSOGOLLA", imposter: "GULAB JAMUN" },
  { civilian: "HOSTEL", imposter: "HOME" },
  { civilian: "EXAM", imposter: "INTERVIEW" }
];

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function emitLobby() {
  io.emit('lobby:update', {
    confession: {
      phase: confessionGame.phase,
      players: Array.from(confessionGame.players.values()).map(p => p.username),
      count: confessionGame.players.size
    },
    imposter: {
      phase: imposterGame.phase,
      players: Array.from(imposterGame.players.values()).map(p => p.username),
      count: imposterGame.players.size
    },
    totalOnline: io.engine.clientsCount
  });
}

function emitConfessionState() {
  const confessionsForClient = confessionGame.confessions.map(c => ({
    id: c.id,
    text: c.text
    // do NOT send authorUsername during guessing
  }));
  // For reveal, include author
  const revealData = confessionGame.phase === 'reveal' ? confessionGame.confessions.map(c => ({
    id: c.id,
    text: c.text,
    authorUsername: c.authorUsername
  })) : null;

  io.emit('confession:state', {
    phase: confessionGame.phase,
    players: Array.from(confessionGame.players.values()).map(p => p.username),
    confessions: confessionGame.phase === 'reveal' ? revealData : confessionsForClient,
    submittedCount: confessionGame.confessions.length,
    playerCount: confessionGame.players.size,
    guessDuration: confessionGame.guessDuration,
    guessTimeLeft: confessionGame.guessTimeLeft,
    hasSubmitted: null, // client will check locally
    results: confessionGame.results
  });
}

function emitImposterState() {
  io.emit('imposter:state', {
    phase: imposterGame.phase,
    players: Array.from(imposterGame.players.values()).map(p => p.username),
    assignments: null,
    wordPair: null,
    votesCount: imposterGame.votes.size,
    playerCount: imposterGame.players.size,
    discussionOrder: imposterGame.discussionOrder,
    currentSpeakerIdx: imposterGame.currentSpeakerIdx,
    totalRounds: imposterGame.totalRounds,
    currentRound: imposterGame.currentRound,
    clues: imposterGame.clues,
    typing: Object.fromEntries(imposterGame.typing),
    canVote: imposterGame.canVote,
    winner: imposterGame.winner,
    imposterUsername: imposterGame.phase === 'result' || imposterGame.phase === 'dare' ? imposterGame.imposterUsername : null,
    dare: imposterGame.dare,
    victim: imposterGame.victim
  });
}

function emitImposterClues() {
  io.emit('imposter:clues', {
    clues: imposterGame.clues,
    currentRound: imposterGame.currentRound,
    totalRounds: imposterGame.totalRounds,
    currentSpeaker: imposterGame.discussionOrder[imposterGame.currentSpeakerIdx] || null,
    canVote: imposterGame.canVote
  });
}

function emitTyping() {
  io.emit('imposter:typing', { typing: Object.fromEntries(imposterGame.typing) });
}

function computeConfessionResults() {
  // For each confession, determine who guessed correctly
  // guesses: Map guesser -> Map(confessionId -> guessedUsername)
  const confResults = confessionGame.confessions.map(c => {
    const correctGuessers = [];
    const wrongGuessers = [];
    for (const [guesser, map] of confessionGame.guesses.entries()) {
      const guessed = map.get(c.id);
      if (!guessed) continue;
      if (guessed === c.authorUsername) correctGuessers.push(guesser);
      else wrongGuessers.push({ guesser, guessed });
    }
    return {
      id: c.id,
      text: c.text,
      authorUsername: c.authorUsername,
      correctGuessers,
      wrongGuessers,
      correctCount: correctGuessers.length
    };
  });

  // Leaderboard: count correct guesses per player
  const leaderboard = Array.from(confessionGame.players.keys()).map(username => {
    const map = confessionGame.guesses.get(username);
    let correct = 0;
    if (map) {
      for (const c of confessionGame.confessions) {
        const guessed = map.get(c.id);
        if (guessed === c.authorUsername) correct++;
      }
    }
    return { username, correct, total: confessionGame.confessions.length };
  }).sort((a, b) => b.correct - a.correct);

  return { confResults, leaderboard };
}

function startGuessTimer() {
  if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
  confessionGame.guessTimeLeft = confessionGame.guessDuration;
  io.emit('confession:timer', { timeLeft: confessionGame.guessTimeLeft, duration: confessionGame.guessDuration });
  confessionGame.guessTimer = setInterval(() => {
    confessionGame.guessTimeLeft -= 1;
    io.emit('confession:timer', { timeLeft: confessionGame.guessTimeLeft, duration: confessionGame.guessDuration });
    if (confessionGame.guessTimeLeft <= 0) {
      clearInterval(confessionGame.guessTimer);
      confessionGame.guessTimer = null;
      confessionGame.phase = 'reveal';
      confessionGame.results = computeConfessionResults();
      // persist guesses isCorrect
      try {
        const stmt = db.prepare('INSERT INTO guesses (confessionId, guesserUsername, guessedUsername, isCorrect) VALUES (?,?,?,?)');
        for (const [guesser, map] of confessionGame.guesses.entries()) {
          for (const c of confessionGame.confessions) {
            const guessed = map.get(c.id);
            if (guessed) {
              const isCorrect = guessed === c.authorUsername ? 1 : 0;
              stmt.run(c.id, guesser, guessed, isCorrect);
            }
          }
        }
      } catch (e) { console.error('guess persist err', e); }
      emitConfessionState();
      io.emit('confession:reveal', confessionGame.results);
    }
  }, 1000);
}

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('connect', socket.id);
  emitLobby();
  // Send current state to new socket
  socket.emit('confession:state', {
    phase: confessionGame.phase,
    players: Array.from(confessionGame.players.values()).map(p => p.username),
    confessions: confessionGame.confessions.map(c => ({ id: c.id, text: c.text })),
    submittedCount: confessionGame.confessions.length,
    playerCount: confessionGame.players.size,
    guessDuration: confessionGame.guessDuration,
    guessTimeLeft: confessionGame.guessTimeLeft,
    results: confessionGame.results
  });
  socket.emit('imposter:state', {
    phase: imposterGame.phase,
    players: Array.from(imposterGame.players.values()).map(p => p.username),
    playerCount: imposterGame.players.size,
    discussionOrder: imposterGame.discussionOrder,
    currentSpeakerIdx: imposterGame.currentSpeakerIdx,
    totalRounds: imposterGame.totalRounds,
    currentRound: imposterGame.currentRound,
    clues: imposterGame.clues,
    typing: Object.fromEntries(imposterGame.typing),
    canVote: imposterGame.canVote,
    winner: imposterGame.winner,
    imposterUsername: imposterGame.imposterUsername,
    dare: imposterGame.dare,
    victim: imposterGame.victim
  });
  socket.emit('imposter:clues', {
    clues: imposterGame.clues,
    currentRound: imposterGame.currentRound,
    totalRounds: imposterGame.totalRounds,
    currentSpeaker: imposterGame.discussionOrder[imposterGame.currentSpeakerIdx] || null,
    canVote: imposterGame.canVote
  });

  socket.on('join_game', ({ username, gameType, guessDuration }) => {
    if (!username || !gameType) {
      socket.emit('error_msg', 'Username and gameType required');
      return;
    }
    username = username.trim();
    if (username.length < 2) {
      socket.emit('error_msg', 'Username too short');
      return;
    }
    if (username.length > 20) {
      socket.emit('error_msg', 'Username too long (max 20)');
      return;
    }

    if (gameType === 'confession') {
      if (confessionGame.players.has(username)) {
        const existing = confessionGame.players.get(username);
        if (existing.socketId !== socket.id) {
          socket.emit('error_msg', `Name "${username}" already taken, try ${username}_2`);
          return;
        }
      }
      // Remove from other game if exists
      // Check imposter same socket switching? keep separate but allow same username in both games? We allow.
      confessionGame.players.set(username, { username, socketId: socket.id });
      confessionGame.socketToUser.set(socket.id, username);
      if (guessDuration && Number(guessDuration) >= 10 && Number(guessDuration) <= 600) {
        confessionGame.guessDuration = Number(guessDuration);
      }
      socket.emit('joined', { username, gameType });
      emitLobby();
      emitConfessionState();
    } else if (gameType === 'imposter') {
      if (imposterGame.players.has(username)) {
        const existing = imposterGame.players.get(username);
        if (existing.socketId !== socket.id) {
          socket.emit('error_msg', `Name "${username}" already taken, try ${username}_2`);
          return;
        }
      }
      imposterGame.players.set(username, { username, socketId: socket.id });
      imposterGame.socketToUser.set(socket.id, username);
      socket.emit('joined', { username, gameType });
      emitLobby();
      emitImposterState();
    }
  });

  socket.on('confession:submit', ({ text }) => {
    const username = confessionGame.socketToUser.get(socket.id);
    if (!username) { socket.emit('error_msg', 'Join confession game first'); return; }
    if (confessionGame.phase !== 'lobby' && confessionGame.phase !== 'submitting') {
      socket.emit('error_msg', 'Not in submission phase');
      return;
    }
    if (confessionGame.phase === 'lobby') confessionGame.phase = 'submitting';
    // Check already submitted
    const already = confessionGame.confessions.find(c => c.authorUsername === username);
    if (already) {
      socket.emit('error_msg', 'You already dropped your bomb! Wait for guessing.');
      return;
    }
    if (!text || text.trim().length < 3) {
      socket.emit('error_msg', 'Confession too short (min 3 chars)');
      return;
    }
    if (text.length > 300) {
      socket.emit('error_msg', 'Confession too long (max 300 chars)');
      return;
    }
    // Insert to DB
    try {
      const info = db.prepare('INSERT INTO confessions (text, authorUsername, authorSocketId) VALUES (?,?,?)').run(text.trim(), username, socket.id);
      const id = info.lastInsertRowid;
      confessionGame.confessions.push({ id, text: text.trim(), authorUsername: username, authorSocketId: socket.id });
    } catch (e) {
      console.error(e);
      socket.emit('error_msg', 'DB error');
      return;
    }
    // If all players submitted, auto move to guessing? Host can also manually start.
    // We keep in submitting until host triggers or all submitted then wait 5 sec?
    socket.emit('confession:submitted', { ok: true });
    emitConfessionState();
    emitLobby();
    // Auto-start guessing if all submitted and at least 2 players
    if (confessionGame.confessions.length === confessionGame.players.size && confessionGame.players.size >= 2) {
      // give 3 sec grace then start
      // Don't auto-start immediately, let host control but notify
      io.emit('confession:allSubmitted', { count: confessionGame.confessions.length });
    }
  });

  socket.on('confession:startGuessing', ({ duration }) => {
    const username = confessionGame.socketToUser.get(socket.id);
    if (!username) { socket.emit('error_msg', 'Join first'); return; }
    if (confessionGame.confessions.length === 0) {
      socket.emit('error_msg', 'Need at least 1 confession to start');
      return;
    }
    if (duration && Number(duration) >= 10 && Number(duration) <= 600) {
      confessionGame.guessDuration = Number(duration);
    }
    confessionGame.phase = 'guessing';
    confessionGame.guesses.clear();
    confessionGame.results = null;
    confessionGame.guessTimeLeft = confessionGame.guessDuration;
    // Shuffle confessions for fairness? Keep order but client shuffles display.
    // Shuffle array
    for (let i = confessionGame.confessions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [confessionGame.confessions[i], confessionGame.confessions[j]] = [confessionGame.confessions[j], confessionGame.confessions[i]];
    }
    emitConfessionState();
    startGuessTimer();
    io.emit('confession:guessingStarted', { duration: confessionGame.guessDuration });
  });

  socket.on('confession:submitGuesses', ({ guesses }) => {
    const username = confessionGame.socketToUser.get(socket.id);
    if (!username) { socket.emit('error_msg', 'Join first'); return; }
    if (confessionGame.phase !== 'guessing') {
      socket.emit('error_msg', 'Not in guessing phase');
      return;
    }
    if (!Array.isArray(guesses)) { socket.emit('error_msg', 'Invalid guesses'); return; }
    // guesses = [{confessionId, guessedUsername}, ...]
    // Validate all confessions guessed
    // Store
    const map = new Map();
    for (const g of guesses) {
      const cid = Number(g.confessionId);
      const guessed = (g.guessedUsername || '').trim();
      if (!cid || !guessed) continue;
      // validate guessed username exists in players
      if (!confessionGame.players.has(guessed)) continue;
      // cannot guess self? Allow but will be wrong, but we prevent self-guess counting as correct? The confession author is someone else, so self guess will never be correct unless you guess yourself and you ARE the author, but you know your own. We allow but mark accordingly. To prevent cheating, if you guess yourself and you are author, that would be correct. But you know your own bomb, so you'd get free point. Let's disable self-guess correct: if g is your own confession and you guess yourself, it's not counted? Actually we could allow but it's trivial. Better to allow but server will count it, it's your bomb you'd know. But to make fair, we could allow but it's not interesting. Let's allow.
      map.set(cid, guessed);
    }
    confessionGame.guesses.set(username, map);
    socket.emit('confession:guessesLocked', { count: map.size });
    // Emit progress to host
    io.emit('confession:guessProgress', { guessedCount: confessionGame.guesses.size, playerCount: confessionGame.players.size });
    // If all players have submitted guesses, early reveal? Wait for timer still but notify host they can end early
    if (confessionGame.guesses.size === confessionGame.players.size) {
      io.emit('confession:allGuessed', {});
    }
  });

  socket.on('confession:endGuessingEarly', () => {
    if (confessionGame.phase !== 'guessing') return;
    if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
    confessionGame.guessTimer = null;
    confessionGame.guessTimeLeft = 0;
    confessionGame.phase = 'reveal';
    confessionGame.results = computeConfessionResults();
    try {
      const stmt = db.prepare('INSERT INTO guesses (confessionId, guesserUsername, guessedUsername, isCorrect) VALUES (?,?,?,?)');
      for (const [guesser, map] of confessionGame.guesses.entries()) {
        for (const c of confessionGame.confessions) {
          const guessed = map.get(c.id);
          if (guessed) {
            const isCorrect = guessed === c.authorUsername ? 1 : 0;
            stmt.run(c.id, guesser, guessed, isCorrect);
          }
        }
      }
    } catch (e) { console.error(e); }
    emitConfessionState();
    io.emit('confession:reveal', confessionGame.results);
  });

  socket.on('confession:revealNow', () => {
    // alias for endGuessingEarly
    if (confessionGame.phase === 'guessing') {
      if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
      confessionGame.guessTimer = null;
      confessionGame.guessTimeLeft = 0;
      confessionGame.phase = 'reveal';
      confessionGame.results = computeConfessionResults();
      emitConfessionState();
      io.emit('confession:reveal', confessionGame.results);
    }
  });

  socket.on('confession:reset', () => {
    if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
    confessionGame = createConfessionState();
    // Keep players? Reset should keep players in lobby? Better reset everything but keep players for quick replay?
    // Let's clear confessions/guesses but keep lobby
    // Actually create new but preserve players? Let's preserve players if they are still connected
    // The above already cleared, so we need to re-add players who are still in that game? But we lost them.
    // Instead we should reset phase only.
    // Quick fix: we cleared all, so emit empty. Players will need to rejoin. That's okay for now.
    emitConfessionState();
    emitLobby();
    io.emit('confession:resetDone');
  });

  socket.on('confession:resetKeepPlayers', () => {
    const oldPlayers = confessionGame.players;
    const oldSocketMap = confessionGame.socketToUser;
    if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
    confessionGame = createConfessionState();
    confessionGame.players = oldPlayers;
    confessionGame.socketToUser = oldSocketMap;
    // clear DB confessions? Keep history but clear in-memory
    emitConfessionState();
    emitLobby();
  });

  // --- Imposter Events ---
  socket.on('imposter:startGame', ({ rounds } = {}) => {
    const username = imposterGame.socketToUser.get(socket.id);
    if (!username) { socket.emit('error_msg', 'Join imposter lobby first'); return; }
    if (imposterGame.players.size < 3) {
      socket.emit('error_msg', 'Need at least 3 players for Imposter');
      return;
    }
    if (imposterGame.phase !== 'lobby' && imposterGame.phase !== 'result' && imposterGame.phase !== 'dare') {
      socket.emit('error_msg', 'Game already started');
      return;
    }
    // Pick word pair
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    imposterGame.wordPair = pair;
    // Pick imposter randomly
    const usernames = Array.from(imposterGame.players.keys());
    const imposter = usernames[Math.floor(Math.random() * usernames.length)];
    imposterGame.imposterUsername = imposter;
    imposterGame.assignments.clear();
    imposterGame.votes.clear();
    imposterGame.dare = null;
    imposterGame.victim = null;
    imposterGame.winner = null;
    imposterGame.discussionOrder = [...usernames].sort(() => Math.random() - 0.5);
    imposterGame.currentSpeakerIdx = 0;
    // Rounds init
    let r = parseInt(rounds);
    if (!r || r < 1 || r > 3) r = 1;
    imposterGame.totalRounds = r;
    imposterGame.currentRound = 1;
    imposterGame.clues = [];
    imposterGame.typing = new Map();
    imposterGame.canVote = false;
    for (const u of usernames) imposterGame.typing.set(u, false);

    for (const u of usernames) {
      const isImp = u === imposter;
      imposterGame.assignments.set(u, { word: isImp ? pair.imposter : pair.civilian, isImposter: isImp });
    }
    imposterGame.phase = 'wordReveal';
    emitImposterState();
    emitImposterClues();
    // Send private word to each
    for (const [uname, data] of imposterGame.assignments.entries()) {
      const player = imposterGame.players.get(uname);
      if (player) {
        io.to(player.socketId).emit('imposter:yourWord', { word: data.word, isImposter: data.isImposter, order: imposterGame.discussionOrder, totalRounds: imposterGame.totalRounds });
      }
    }
    // Auto move to discussion after 12 seconds
    setTimeout(() => {
      if (imposterGame.phase === 'wordReveal') {
        imposterGame.phase = 'discussion';
        emitImposterState();
        emitImposterClues();
        io.emit('imposter:discussionStarted', { order: imposterGame.discussionOrder });
      }
    }, 12000);
  });

  socket.on('imposter:nextSpeaker', () => {
    if (imposterGame.phase !== 'discussion') return;
    imposterGame.currentSpeakerIdx = (imposterGame.currentSpeakerIdx + 1) % imposterGame.discussionOrder.length;
    // If wrapped to 0, we completed a round
    if (imposterGame.currentSpeakerIdx === 0) {
      if (imposterGame.currentRound < imposterGame.totalRounds) {
        imposterGame.currentRound += 1;
      } else {
        // All rounds requested done? Keep at last round but canVote will be set via clues logic
        // We don't auto advance round beyond totalRounds
      }
    }
    emitImposterState();
    emitImposterClues();
  });

  // Typing indicator
  socket.on('imposter:typing', ({ isTyping }) => {
    const username = imposterGame.socketToUser.get(socket.id);
    if (!username) return;
    if (imposterGame.phase !== 'discussion') return;
    // Only allow current speaker to set typing? But allow any for simultaneous view -> we allow all but UI will highlight current speaker typing
    imposterGame.typing.set(username, !!isTyping);
    emitTyping();
  });

  // Submit clue (typing replacement for speaking)
  socket.on('imposter:submitClue', ({ text }) => {
    const username = imposterGame.socketToUser.get(socket.id);
    if (!username) { socket.emit('error_msg', 'Join first'); return; }
    if (imposterGame.phase !== 'discussion') { socket.emit('error_msg', 'Not in discussion phase'); return; }
    const expectedSpeaker = imposterGame.discussionOrder[imposterGame.currentSpeakerIdx];
    if (username !== expectedSpeaker) {
      socket.emit('error_msg', `Not your turn! It's ${expectedSpeaker}'s turn`);
      return;
    }
    if (!text || text.trim().length < 2) { socket.emit('error_msg', 'Clue too short (min 2 chars)'); return; }
    if (text.length > 200) { socket.emit('error_msg', 'Clue too long (max 200 chars)'); return; }
    const assignment = imposterGame.assignments.get(username);
    if (!assignment) { socket.emit('error_msg', 'No word assigned'); return; }
    const myWord = assignment.word;
    // Secret word block: if text contains own secret word (case-insensitive, whole word or substring)
    const lowerText = text.toLowerCase();
    const lowerWord = myWord.toLowerCase();
    // Check direct include and also word boundaries? Simple include for now to catch cheaters
    if (lowerText.includes(lowerWord)) {
      socket.emit('error_msg', `⚠️ Secret word "${myWord}" is not allowed in your clue!`);
      socket.emit('imposter:secretWordWarning', { word: myWord });
      return;
    }
    // Check already submitted for this round? One clue per player per round
    const existingForThisRound = imposterGame.clues.filter(c => c.round === imposterGame.currentRound && c.username === username);
    if (existingForThisRound.length > 0) {
      socket.emit('error_msg', 'You already submitted clue for this round');
      return;
    }

    const clue = { username, text: text.trim(), round: imposterGame.currentRound, idx: imposterGame.clues.length };
    imposterGame.clues.push(clue);
    imposterGame.typing.set(username, false);
    socket.emit('imposter:clueAccepted', { clue });
    emitImposterClues();
    emitTyping();

    // Advance speaker
    const totalNeeded = imposterGame.players.size * imposterGame.totalRounds;
    if (imposterGame.clues.length >= totalNeeded) {
      imposterGame.canVote = true;
      io.emit('imposter:roundsComplete', { totalRounds: imposterGame.totalRounds, clues: imposterGame.clues });
    }

    // Auto-advance to next speaker if not all done
    if (imposterGame.clues.length < totalNeeded) {
      // Move to next speaker
      const nextIdx = (imposterGame.currentSpeakerIdx + 1) % imposterGame.discussionOrder.length;
      // If wrapping, increase round if needed
      if (nextIdx === 0 && imposterGame.currentRound < imposterGame.totalRounds) {
        imposterGame.currentRound += 1;
      } else if (nextIdx === 0 && imposterGame.currentRound >= imposterGame.totalRounds) {
        // Completed all rounds but still need? Actually if totalNeeded reached we already canVote, keep round at totalRounds
      }
      imposterGame.currentSpeakerIdx = nextIdx;
    } else {
      // All clues done, stay at last speaker but canVote true
      imposterGame.canVote = true;
    }
    emitImposterState();
    emitImposterClues();
  });

  socket.on('imposter:goToVoting', () => {
    if (imposterGame.phase !== 'discussion' && imposterGame.phase !== 'wordReveal') return;
    // Only allow if rounds complete or canVote true
    if (!imposterGame.canVote) {
      socket.emit('error_msg', `Complete all rounds first! Round ${imposterGame.currentRound}/${imposterGame.totalRounds} - ${imposterGame.clues.length}/${imposterGame.players.size * imposterGame.totalRounds} clues done`);
      return;
    }
    imposterGame.phase = 'voting';
    imposterGame.votes.clear();
    emitImposterState();
    io.emit('imposter:votingStarted');
  });

  socket.on('imposter:vote', ({ votedUsername }) => {
    const voter = imposterGame.socketToUser.get(socket.id);
    if (!voter) { socket.emit('error_msg', 'Join first'); return; }
    if (imposterGame.phase !== 'voting') { socket.emit('error_msg', 'Not in voting phase'); return; }
    if (!imposterGame.players.has(votedUsername)) { socket.emit('error_msg', 'Invalid vote'); return; }
    if (votedUsername === voter) { socket.emit('error_msg', "Can't vote yourself"); return; }
    if (imposterGame.votes.has(voter)) { socket.emit('error_msg', 'Already voted'); return; }
    imposterGame.votes.set(voter, votedUsername);
    socket.emit('imposter:voted', { votedUsername });
    io.emit('imposter:voteProgress', { voted: imposterGame.votes.size, total: imposterGame.players.size });

    if (imposterGame.votes.size === imposterGame.players.size) {
      // All voted, compute result
      const counts = {};
      for (const v of imposterGame.votes.values()) {
        counts[v] = (counts[v] || 0) + 1;
      }
      let maxVoted = null;
      let maxCount = -1;
      for (const [name, cnt] of Object.entries(counts)) {
        if (cnt > maxCount) { maxCount = cnt; maxVoted = name; }
      }
      // If tie, no majority? We'll consider tie as imposter survives
      // Check if imposter got majority (> half) or is maxVoted
      const imposterVotes = counts[imposterGame.imposterUsername] || 0;
      const isImposterCaught = maxVoted === imposterGame.imposterUsername;
      // For tie, if multiple share maxCount and imposter is one of them, consider caught? We'll treat as caught if imposter is maxVoted (even tie)
      imposterGame.winner = isImposterCaught ? 'civilians' : 'imposter';
      imposterGame.phase = 'result';
      emitImposterState();
      io.emit('imposter:result', {
        imposterUsername: imposterGame.imposterUsername,
        wordPair: imposterGame.wordPair,
        votes: Object.fromEntries(imposterGame.votes),
        counts,
        winner: imposterGame.winner,
        maxVoted,
        assignments: Object.fromEntries(imposterGame.assignments)
      });
    }
  });

  socket.on('imposter:chooseVictim', ({ victimUsername }) => {
    const chooser = imposterGame.socketToUser.get(socket.id);
    if (!chooser) return;
    if (chooser !== imposterGame.imposterUsername) {
      socket.emit('error_msg', 'Only imposter can choose victim');
      return;
    }
    if (imposterGame.winner !== 'imposter') {
      socket.emit('error_msg', 'Imposter only chooses when he wins');
      return;
    }
    if (imposterGame.phase !== 'result') {
      socket.emit('error_msg', 'Not in result phase');
      return;
    }
    if (!imposterGame.players.has(victimUsername)) {
      socket.emit('error_msg', 'Invalid victim');
      return;
    }
    if (victimUsername === chooser) {
      socket.emit('error_msg', "Can't choose yourself");
      return;
    }
    const dareRow = db.prepare('SELECT text FROM dares ORDER BY RANDOM() LIMIT 1').get();
    imposterGame.victim = victimUsername;
    imposterGame.dare = dareRow ? dareRow.text : "Do a funny dance!";
    imposterGame.phase = 'dare';
    emitImposterState();
    io.emit('imposter:dareChosen', { victim: victimUsername, dare: imposterGame.dare, chooser });
  });

  socket.on('imposter:reset', ({ keepPlayers }) => {
    const oldPlayers = imposterGame.players;
    const oldMap = imposterGame.socketToUser;
    imposterGame = createImposterState();
    if (keepPlayers) {
      imposterGame.players = oldPlayers;
      imposterGame.socketToUser = oldMap;
    }
    emitImposterState();
    emitImposterClues();
    emitLobby();
  });

  socket.on('imposter:skipWordReveal', () => {
    if (imposterGame.phase === 'wordReveal') {
      imposterGame.phase = 'discussion';
      emitImposterState();
      emitImposterClues();
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    let changed = false;
    const cUser = confessionGame.socketToUser.get(socket.id);
    if (cUser) {
      confessionGame.players.delete(cUser);
      confessionGame.socketToUser.delete(socket.id);
      // If player had submitted confession, keep it but mark? Keep for now.
      // If lobby becomes empty, reset game?
      if (confessionGame.players.size === 0) {
        if (confessionGame.guessTimer) clearInterval(confessionGame.guessTimer);
        confessionGame = createConfessionState();
      }
      changed = true;
    }
    const iUser = imposterGame.socketToUser.get(socket.id);
    if (iUser) {
      imposterGame.players.delete(iUser);
      imposterGame.socketToUser.delete(socket.id);
      imposterGame.votes.delete(iUser);
      imposterGame.assignments.delete(iUser);
      imposterGame.typing.delete(iUser);
      // Remove clues by that user (optional keep for history? Remove to keep count accurate)
      // Don't remove clues history, but adjust indices? Keep them but filter display via player existence
      // Adjust order and currentSpeakerIdx
      const idx = imposterGame.discussionOrder.indexOf(iUser);
      imposterGame.discussionOrder = imposterGame.discussionOrder.filter(x => x !== iUser);
      if (idx !== -1 && imposterGame.currentSpeakerIdx >= imposterGame.discussionOrder.length) {
        imposterGame.currentSpeakerIdx = 0;
      } else if (idx !== -1 && idx < imposterGame.currentSpeakerIdx) {
        imposterGame.currentSpeakerIdx = Math.max(0, imposterGame.currentSpeakerIdx - 1);
      }
      // Recalculate canVote after player left (totalNeeded decreased)
      const totalNeeded = imposterGame.players.size * imposterGame.totalRounds;
      if (imposterGame.clues.length >= totalNeeded && totalNeeded > 0) {
        imposterGame.canVote = true;
      }
      if (imposterGame.players.size === 0) {
        imposterGame = createImposterState();
      } else if (imposterGame.imposterUsername === iUser) {
        // Imposter left, reset
        imposterGame.phase = 'lobby';
        imposterGame.imposterUsername = null;
        imposterGame.assignments.clear();
        imposterGame.clues = [];
        imposterGame.canVote = false;
      }
      changed = true;
    }
    if (changed) {
      emitLobby();
      emitConfessionState();
      emitImposterState();
      emitImposterClues();
      emitTyping();
    }
  });
});

// --- REST ---
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/confessions', (req, res) => {
  const rows = db.prepare('SELECT * FROM confessions ORDER BY id DESC LIMIT 100').all();
  res.json(rows);
});
app.get('/api/dares', (req, res) => {
  const rows = db.prepare('SELECT * FROM dares').all();
  res.json(rows);
});
app.get('/api/ip', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

// SPA fallback for client routing (if dist exists)
app.get(/^\/(?!api|socket\.io).*/, (req, res, next) => {
  const fs = require('fs');
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n=== GANG PACK SERVER ===`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${ip}:${PORT}`);
  console.log(`Share this Network URL with your gang (same WiFi)!\n`);
  console.log(`DB: ${dbPath}`);
});
