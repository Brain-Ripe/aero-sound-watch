import type { SensorNode } from "@/lib/acoustic-engine";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export function SensorChart({ node }: { node: SensorNode | null }) {
  if (!node) {
    return (
      <div className="panel p-6 h-64 flex items-center justify-center text-muted-foreground text-sm">
        Select a sensor node to inspect telemetry
      </div>
    );
  }
  const data = node.history.map((h) => ({
    t: new Date(h.t).toLocaleTimeString().slice(3, 8),
    v: +h.v.toFixed(2),
    T: +h.T.toFixed(1),
  }));

  return (
    <div className="panel p-4 h-72">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Sound speed · {node.id}
          </div>
          <div className="text-2xl font-mono">
            {node.smaSoundSpeed.toFixed(2)}{" "}
            <span className="text-sm text-muted-foreground">m/s</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Temp</div>
          <div className="text-lg font-mono">{node.temperature.toFixed(1)} °C</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="78%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
          <XAxis dataKey="t" stroke="var(--color-muted-foreground)" fontSize={10} />
          <YAxis
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <ReferenceLine y={node.baseline} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
