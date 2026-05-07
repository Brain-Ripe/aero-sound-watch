import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Flame,
  LogOut,
  Lock,
  Power,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Skull,
  User as UserIcon,
  Waves,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { AcousticEngine } from "@/lib/acoustic-engine";
import { SensorMap } from "./SensorMap";
import { SensorChart } from "./SensorChart";
import { useAuth } from "@/lib/auth-context";

function useEngine() {
  const ref = useRef<AcousticEngine | null>(null);
  if (!ref.current) ref.current = new AcousticEngine(5);
  return ref.current;
}

export function CommandCenter() {
  const engine = useEngine();
  const { user, role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hardwareLive, setHardwareLive] = useState(false);
  const [wind, setWind] = useState(0.3);
  const lastNotifiedFire = useRef<string | null>(null);

  useEffect(() => {
    engine.windNoise = wind;
    engine.hardwareLive = hardwareLive;
  }, [wind, hardwareLive, engine]);

  useEffect(() => {
    const id = setInterval(() => {
      engine.step();
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [engine]);

  const selected = useMemo(
    () => engine.nodes.find((n) => n.id === selectedId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, engine.nodes.length, engine.alerts.length],
  );

  const counts = useMemo(() => {
    const c = { HEALTHY: 0, WARNING: 0, FIRE: 0, CRITICAL: 0 } as Record<string, number>;
    for (const n of engine.nodes) c[n.status]++;
    return c;
  }, [engine, /* re-eval each tick */ engine.alerts.length]);

  const download = (format: "json" | "csv") => {
    const data = engine.exportLogs(format);
    const blob = new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aeropulse-logs-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/15 grid place-items-center">
              <Waves className="text-primary" size={18} />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight">AeroPulse</h1>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Acoustic Wildfire Observability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-healthy animate-pulse" />
              SYS ONLINE
            </span>
            <span>v ≈ 331.3·√(1+T/273.15)</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-12 gap-4">
        {/* Stat cards */}
        <StatCard label="Healthy" value={counts.HEALTHY} icon={<Activity />} tone="healthy" />
        <StatCard label="Warning" value={counts.WARNING} icon={<AlertTriangle />} tone="warning" />
        <StatCard label="Fire Detected" value={counts.FIRE} icon={<Flame />} tone="critical" />
        <StatCard label="Node Critical" value={counts.CRITICAL} icon={<Skull />} tone="muted" />

        {/* Map */}
        <section className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
              Forest Grid · Sensor Mesh
            </h2>
            <button
              onClick={() => {
                engine.clearFires();
                force((n) => n + 1);
              }}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-secondary"
            >
              <RefreshCcw size={12} /> Reset Fires
            </button>
          </div>
          <SensorMap
            nodes={engine.nodes}
            fires={engine.fires}
            selectedId={selectedId}
            onPlaceFire={(x, y) => {
              engine.placeFire(x, y);
              force((n) => n + 1);
            }}
            onSelectNode={setSelectedId}
          />
        </section>

        {/* Right column */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <ControlPanel
            hardwareLive={hardwareLive}
            setHardwareLive={setHardwareLive}
            wind={wind}
            setWind={setWind}
            onExportJson={() => download("json")}
            onExportCsv={() => download("csv")}
            onKillRandom={() => {
              const alive = engine.nodes.filter((n) => n.status !== "CRITICAL");
              if (alive.length) engine.killNode(alive[Math.floor(Math.random() * alive.length)].id);
              force((n) => n + 1);
            }}
          />
          <SensorChart node={selected} />
        </aside>

        {/* Logs */}
        <section className="col-span-12">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
            Event Log · Time-Series Tail
          </h2>
          <div className="panel max-h-72 overflow-auto font-mono text-xs">
            {engine.alerts.length === 0 && (
              <div className="p-4 text-muted-foreground">No events. System nominal.</div>
            )}
            {engine.alerts.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[110px_120px_100px_1fr] gap-2 px-3 py-1.5 border-b border-border/50 last:border-0"
              >
                <span className="text-muted-foreground">
                  {new Date(a.ts).toLocaleTimeString()}
                </span>
                <span
                  className={
                    a.type === "WILDFIRE_CONFIRMED"
                      ? "text-critical"
                      : a.type === "WARNING"
                        ? "text-warning"
                        : a.type === "NODE_CRITICAL"
                          ? "text-muted-foreground"
                          : "text-primary"
                  }
                >
                  {a.type}
                </span>
                <span>{a.nodeId}</span>
                <span className="text-foreground/90">{a.message}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "healthy" | "warning" | "critical" | "muted";
}) {
  const toneCls =
    tone === "healthy"
      ? "text-healthy"
      : tone === "warning"
        ? "text-warning"
        : tone === "critical"
          ? "text-critical"
          : "text-muted-foreground";
  return (
    <div className="col-span-6 md:col-span-3 panel p-4 flex items-center justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className={`text-3xl font-semibold font-mono ${toneCls}`}>{value}</div>
      </div>
      <div className={`${toneCls} opacity-80`}>{icon}</div>
    </div>
  );
}

function ControlPanel({
  hardwareLive,
  setHardwareLive,
  wind,
  setWind,
  onExportJson,
  onExportCsv,
  onKillRandom,
}: {
  hardwareLive: boolean;
  setHardwareLive: (v: boolean) => void;
  wind: number;
  setWind: (v: number) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onKillRandom: () => void;
}) {
  return (
    <div className="panel p-4 space-y-4">
      <h3 className="text-sm uppercase tracking-widest text-muted-foreground">
        Control Panel
      </h3>

      <button
        onClick={() => setHardwareLive(!hardwareLive)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded border ${
          hardwareLive
            ? "border-primary bg-primary/10 text-primary"
            : "border-border hover:bg-secondary"
        }`}
      >
        <span className="flex items-center gap-2 text-sm">
          {hardwareLive ? <Radio size={14} /> : <Power size={14} />}
          {hardwareLive ? "Hardware Live (mocked gRPC)" : "Simulation Mode"}
        </span>
        <span className="text-[10px] font-mono">{hardwareLive ? "LIVE" : "SIM"}</span>
      </button>

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wind size={12} /> Ambient wind noise
          </span>
          <span className="font-mono">{wind.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={wind}
          onChange={(e) => setWind(parseFloat(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={onExportJson}
          className="flex items-center justify-center gap-1 text-xs py-2 rounded border border-border hover:bg-secondary"
        >
          <Download size={12} /> JSON
        </button>
        <button
          onClick={onExportCsv}
          className="flex items-center justify-center gap-1 text-xs py-2 rounded border border-border hover:bg-secondary"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      <button
        onClick={onKillRandom}
        className="w-full text-xs py-2 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1"
      >
        <Skull size={12} /> Simulate Node Failure
      </button>
    </div>
  );
}
