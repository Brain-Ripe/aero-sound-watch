import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/CommandCenter";

export const Route = createFileRoute("/")({
  component: CommandCenter,
  head: () => ({
    meta: [
      { title: "AeroPulse · Acoustic Wildfire Observability" },
      {
        name: "description",
        content:
          "Real-time wildfire detection through acoustic density analysis. Detect fires before heat or smoke sensors using sound-speed latency telemetry.",
      },
    ],
  }),
});
