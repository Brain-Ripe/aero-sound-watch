import type { SensorNode, Fire } from "@/lib/acoustic-engine";
import { Flame } from "lucide-react";

interface Props {
  nodes: SensorNode[];
  fires: Fire[];
  selectedId: string | null;
  onPlaceFire: (x: number, y: number) => void;
  onSelectNode: (id: string) => void;
}

const statusClass: Record<string, string> = {
  HEALTHY: "bg-healthy pulse-healthy",
  WARNING: "bg-warning pulse-warning",
  FIRE: "bg-critical pulse-critical",
  CRITICAL: "bg-muted-foreground opacity-60",
};

export function SensorMap({ nodes, fires, selectedId, onPlaceFire, onSelectNode }: Props) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPlaceFire(x, y);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full aspect-square grid-bg panel cursor-crosshair overflow-hidden select-none"
    >
      {/* fires */}
      {fires.map((f) => (
        <div
          key={f.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-critical/30 blur-2xl"
              style={{ width: 120, height: 120, transform: "translate(-50%,-50%)" }}
            />
            <Flame className="text-critical animate-pulse" size={28} />
          </div>
        </div>
      ))}

      {/* sensors */}
      {nodes.map((n) => {
        const sel = n.id === selectedId;
        return (
          <button
            key={n.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(n.id);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
          >
            <span
              className={`block w-3 h-3 rounded-full ${statusClass[n.status]} ${
                sel ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
              }`}
            />
            <span className="absolute left-1/2 -translate-x-1/2 mt-1 text-[10px] font-mono text-muted-foreground group-hover:text-foreground whitespace-nowrap">
              {n.id}
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-muted-foreground">
        CLICK TO IGNITE · {nodes.length} NODES · {fires.length} ACTIVE FIRES
      </div>
    </div>
  );
}
