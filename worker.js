export class Room {
 constructor(state) {
  this.state = state;
  this.clients = new Map();
  this.phase = "waiting";
  this.level = 1;
  this.players = new Map();
    this.countdownAt = 0;
    this.raceAt = 0;
    this.startTimer = null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/ws" || req.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket endpoint", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = crypto.randomUUID();
    server.accept();
    this.clients.set(id, server);

    server.addEventListener("message", e => {
      try { this.message(id, JSON.parse(e.data || "{}")); } catch {}
    });
    server.addEventListener("close", () => {
      this.clients.delete(id);
      this.players.delete(id);
      this.broadcastState();
    });
    server.addEventListener("error", () => {
      this.clients.delete(id);
      this.players.delete(id);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  publicPlayers() {
    return [...this.players.values()].filter(p => p.role === "player");
  }

  message(id, m) {
    if (m.type === "hello") {
      const role = m.role === "server" ? "server" : "player";
      this.players.set(id, {
        id,
        role,
        name: String(m.name || (role === "server" ? "SERVER" : "Peserta")).slice(0, 20),
        emoji: m.emoji || (role === "server" ? "🏁" : "😀"),
        progress: 0,
        correct: 0,
        typed: 0,
        typo: 0,
        wpm: 0,
        acc: 100,
        done: false,
        time: 0,
        rank: null
      });
      this.send(id, { type: "hello", id });
      this.broadcastState();
      return;
    }

    const actor = this.players.get(id);
    if (!actor) return;

    if (m.type === "start") {
      if (actor.role !== "server" || this.phase !== "waiting") return;
      if (this.publicPlayers().length < 1) return;

      if (this.startTimer) clearTimeout(this.startTimer);
      for (const p of this.publicPlayers()) {
        Object.assign(p, { progress:0, correct:0, typed:0, typo:0, wpm:0, acc:100, done:false, time:0, rank:null });
      }

      this.phase = "countdown";
      this.countdownAt = Date.now() + 350;
      this.raceAt = this.countdownAt + (1250 * 3) + 900;
      this.broadcast({
  type: "countdown",
  countdownAt: this.countdownAt,
  raceAt: this.raceAt,
  level: this.level
});
      this.broadcastState();

      this.startTimer = setTimeout(() => {
        if (this.phase !== "countdown") return;
        this.phase = "race";
        this.broadcast({
  type: "race",
  raceAt: this.raceAt,
  level: this.level
});
        this.broadcastState();
      }, Math.max(0, this.raceAt - Date.now()));
      return;
    }

    if (m.type === "progress") {
      const p = this.players.get(id);
      if (!p || p.role !== "player" || this.phase !== "race" || p.done) return;
      Object.assign(p, {
        progress: Math.max(0, Math.min(1, Number(m.progress) || 0)),
        correct: Math.max(0, Number(m.correct) || 0),
        typed: Math.max(0, Number(m.typed) || 0),
        typo: Math.max(p.typo || 0, Number(m.typo) || 0),
        wpm: Math.max(0, Number(m.wpm) || 0),
        acc: Math.max(0, Math.min(100, Number(m.acc) || 0))
      });
      this.broadcast({ type: "progress", id, ...p });
      return;
    }

    if (m.type === "finish") {
      const p = this.players.get(id);
      if (!p || p.role !== "player" || this.phase !== "race" || p.done) return;
      Object.assign(p, {
        progress: 1,
        done: true,
        time: Math.max(0, Number(m.time) || 0),
        wpm: Math.max(0, Number(m.wpm) || 0),
        acc: Math.max(0, Math.min(100, Number(m.acc) || 0)),
        typo: Math.max(p.typo || 0, Number(m.typo) || 0)
      });
      this.broadcast({ type: "progress", id, ...p });

      const racers = this.publicPlayers();
      if (racers.length && racers.every(x => x.done)) this.finishRace();
      return;
    }

    if (m.type === "finishRace") {
      if (actor.role !== "server" || this.phase !== "race") return;
      this.finishRace();
      return;
    }

    if (m.type === "newRace") {
      if (actor.role !== "server") return;

      this.level = 2;
      
      if (this.startTimer) clearTimeout(this.startTimer);
      this.startTimer = null;
      this.phase = "waiting";
      this.countdownAt = 0;
      this.raceAt = 0;
      for (const p of this.publicPlayers()) {
        Object.assign(p, { progress:0, correct:0, typed:0, typo:0, wpm:0, acc:100, done:false, time:0, rank:null });
      }
      this.broadcastState();
    }
  }

  finishRace() {
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = null;
    this.phase = "result";

    const racers = this.publicPlayers();
    const finished = racers.filter(p => p.done).sort((a,b) => (a.time - b.time) || (b.wpm - a.wpm) || (a.typo - b.typo));
    const unfinished = racers.filter(p => !p.done);
    finished.forEach((p,i) => { p.rank = i + 1; });
    unfinished.forEach((p,i) => { p.rank = finished.length + i + 1; });

    this.broadcast({
  type: "result",
  players: racers,
  level: this.level
});
  }

  send(id, m) {
    const ws = this.clients.get(id);
    if (ws) try { ws.send(JSON.stringify(m)); } catch {}
  }

  broadcast(m) {
    const s = JSON.stringify(m);
    for (const ws of this.clients.values()) try { ws.send(s); } catch {}
  }

  broadcastState() {
  this.broadcast({
    type: "state",
    phase: this.phase,
    level: this.level,
    countdownAt: this.countdownAt,
    raceAt: this.raceAt,
    players: this.publicPlayers()
  });
}
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const room = url.searchParams.get("room");
      if (!room) return new Response("room required", { status: 400 });
      const id = env.ROOM.idFromName(room);
      return env.ROOM.get(id).fetch(req);
    }
    return env.ASSETS.fetch(req);
  }
}
