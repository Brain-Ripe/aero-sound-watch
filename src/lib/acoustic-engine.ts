// Physics-based acoustic simulation engine.
// Sound speed: v ≈ 331.3 * sqrt(1 + T/273.15) m/s

export type NodeStatus = "HEALTHY" | "WARNING" | "FIRE" | "CRITICAL";

export interface SensorNode {
  id: string;
  x: number; // grid 0..1
  y: number; // grid 0..1
  status: NodeStatus;
  lastPing: number;
  temperature: number; // °C
  soundSpeed: number; // m/s
  smaSoundSpeed: number; // smoothed
  baseline: number;
  history: { t: number; v: number; T: number }[];
}

export interface Fire {
  id: string;
  x: number;
  y: number;
  startedAt: number;
  intensity: number; // 0..1 grows over time
}

export interface AlertEvent {
  id: string;
  ts: number;
  nodeId: string;
  type: "WARNING" | "WILDFIRE_CONFIRMED" | "NODE_CRITICAL" | "INFO";
  message: string;
  dvdt: number;
}

export const soundSpeed = (tempC: number) =>
  331.3 * Math.sqrt(1 + tempC / 273.15);

const HISTORY_LIMIT = 120; // 2 minutes @ 1Hz
const SMA_WINDOW = 5;
const DEAD_MAN_MS = 10_000;
const WARNING_DVDT = 0.25; // m/s per second
const CONFIRM_DVDT = 0.6;

export class AcousticEngine {
  nodes: SensorNode[] = [];
  fires: Fire[] = [];
  alerts: AlertEvent[] = [];
  ambientTemp = 18;
  windNoise = 0.3;
  hardwareLive = false; // simulated "live" mode
  private firedNotifications = new Set<string>(); // idempotency
  private tick = 0;

  constructor(gridSize = 5) {
    this.seedGrid(gridSize);
  }

  seedGrid(n: number) {
    this.nodes = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) / n;
        const y = (j + 0.5) / n;
        const T = this.ambientTemp;
        const v = soundSpeed(T);
        this.nodes.push({
          id: `N-${i}${j}`,
          x,
          y,
          status: "HEALTHY",
          lastPing: Date.now(),
          temperature: T,
          soundSpeed: v,
          smaSoundSpeed: v,
          baseline: v,
          history: [],
        });
      }
    }
  }

  placeFire(x: number, y: number) {
    const f: Fire = {
      id: `F-${Date.now()}`,
      x,
      y,
      startedAt: Date.now(),
      intensity: 0.05,
    };
    this.fires.push(f);
    this.log({
      type: "INFO",
      nodeId: "-",
      message: `Fire ignited at (${x.toFixed(2)}, ${y.toFixed(2)})`,
      dvdt: 0,
    });
    return f;
  }

  clearFires() {
    this.fires = [];
    this.firedNotifications.clear();
  }

  killNode(id: string) {
    const n = this.nodes.find((n) => n.id === id);
    if (n) n.lastPing = 0; // simulate dead man
  }

  private thermalAt(x: number, y: number): number {
    let T = this.ambientTemp;
    const now = Date.now();
    for (const f of this.fires) {
      const dx = x - f.x;
      const dy = y - f.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const age = (now - f.startedAt) / 1000;
      f.intensity = Math.min(1, 0.05 + age * 0.04);
      // Gaussian-ish thermal plume; up to +180°C at center
      const peak = 180 * f.intensity;
      const sigma = 0.18;
      T += peak * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    return T;
  }

  step() {
    this.tick++;
    const now = Date.now();

    for (const n of this.nodes) {
      // Dead man's switch
      if (now - n.lastPing > DEAD_MAN_MS) {
        if (n.status !== "CRITICAL") {
          n.status = "CRITICAL";
          this.log({
            type: "NODE_CRITICAL",
            nodeId: n.id,
            message: `Node ${n.id} unresponsive >10s`,
            dvdt: 0,
          });
        }
        continue;
      }

      // Hardware-live mode just adds extra jitter (mocked gRPC/REST jitter)
      const jitter = (Math.random() - 0.5) * this.windNoise * (this.hardwareLive ? 1.6 : 1);
      const T = this.thermalAt(n.x, n.y) + jitter;
      const v = soundSpeed(T);

      // Simple Moving Average filter to suppress wind noise
      const prev = n.history.slice(-SMA_WINDOW + 1).map((h) => h.v);
      const sma = (prev.reduce((s, x) => s + x, 0) + v) / (prev.length + 1);

      // Δv/Δt against smoothed baseline
      const lastSma = n.smaSoundSpeed;
      const dvdt = Math.abs(sma - lastSma); // per ~1s tick

      n.temperature = T;
      n.soundSpeed = v;
      n.smaSoundSpeed = sma;
      n.lastPing = now;
      n.history.push({ t: now, v: sma, T });
      if (n.history.length > HISTORY_LIMIT) n.history.shift();

      // Status from filtered Δv/Δt and absolute deviation
      const dev = Math.abs(sma - n.baseline);
      let nextStatus: NodeStatus = "HEALTHY";
      if (dvdt > CONFIRM_DVDT || dev > 8) nextStatus = "FIRE";
      else if (dvdt > WARNING_DVDT || dev > 3) nextStatus = "WARNING";

      if (nextStatus !== n.status) {
        n.status = nextStatus;
        if (nextStatus === "WARNING") {
          this.log({
            type: "WARNING",
            nodeId: n.id,
            message: `Δv/Δt anomaly on ${n.id} (${dvdt.toFixed(2)} m/s·s)`,
            dvdt,
          });
        } else if (nextStatus === "FIRE") {
          // Idempotency: only one confirmation per node per fire window
          const key = `${n.id}:${Math.floor(now / 30_000)}`;
          if (!this.firedNotifications.has(key)) {
            this.firedNotifications.add(key);
            this.log({
              type: "WILDFIRE_CONFIRMED",
              nodeId: n.id,
              message: `🔥 WILDFIRE CONFIRMED at ${n.id} — Δv/Δt=${dvdt.toFixed(2)}`,
              dvdt,
            });
          }
        }
      }
    }
  }

  private log(p: Omit<AlertEvent, "id" | "ts">) {
    this.alerts.unshift({
      id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      ...p,
    });
    if (this.alerts.length > 200) this.alerts.pop();
  }

  exportLogs(format: "json" | "csv"): string {
    if (format === "json") return JSON.stringify(this.alerts, null, 2);
    const head = "id,ts,iso,nodeId,type,dvdt,message";
    const rows = this.alerts.map(
      (a) =>
        `${a.id},${a.ts},${new Date(a.ts).toISOString()},${a.nodeId},${a.type},${a.dvdt.toFixed(3)},"${a.message.replace(/"/g, "'")}"`,
    );
    return [head, ...rows].join("\n");
  }
}
