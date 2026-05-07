import { createFileRoute, Navigate } from "@tanstack/react-router";
import { CommandCenter } from "@/components/CommandCenter";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Gate,
  head: () => ({
    meta: [
      { title: "AeroPulse · Acoustic Wildfire Observability" },
      {
        name: "description",
        content:
          "Real-time wildfire detection through acoustic density analysis.",
      },
    ],
  }),
});

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-xs uppercase tracking-widest">
        Authenticating…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  return <CommandCenter />;
}
