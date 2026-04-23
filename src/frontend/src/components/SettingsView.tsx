import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { CheckCircle2, Database, Loader2, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSeedMessages, useUpdateUsername } from "../hooks/useQueries";
import type { UserProfile } from "../types";

interface SettingsViewProps {
  profile: UserProfile | null;
}

export function SettingsView({ profile }: SettingsViewProps) {
  const [newUsername, setNewUsername] = useState("");
  const { identity } = useInternetIdentity();
  const updateUsername = useUpdateUsername();
  const seedMessages = useSeedMessages();
  const principalText = identity?.getPrincipal().toText() ?? "";

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    try {
      await updateUsername.mutateAsync(newUsername.trim());
      toast.success("Username updated!");
      setNewUsername("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleSeedMessages = async () => {
    try {
      await seedMessages.mutateAsync();
      toast.success("Sample messages seeded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "oklch(var(--border))" }}
      >
        <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
        {/* Profile info */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
          }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Profile
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Username</span>
              <span className="text-sm font-medium text-foreground">
                @{profile?.username ?? "—"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs text-muted-foreground flex-shrink-0">
                Principal ID
              </span>
              <span className="text-xs font-mono text-foreground break-all text-right">
                {principalText}
              </span>
            </div>
          </div>
        </div>

        {/* Update username */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
          }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Change Username
          </h3>
          <form onSubmit={handleUpdateUsername} className="space-y-3">
            <div>
              <Label
                htmlFor="new-username"
                className="text-xs text-muted-foreground mb-1.5 block"
              >
                New Username
              </Label>
              <Input
                id="new-username"
                data-ocid="settings.username.input"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={profile?.username ?? "Enter new username"}
                className="h-9 bg-input border-border text-sm"
                minLength={3}
                maxLength={32}
              />
            </div>
            <Button
              data-ocid="settings.username.save_button"
              type="submit"
              size="sm"
              disabled={!newUsername.trim() || updateUsername.isPending}
              className="gap-1.5"
              style={{ background: "oklch(0.52 0.19 253)", color: "white" }}
            >
              {updateUsername.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Update Username
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Sample data */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
          }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Developer Tools
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Seed sample messages into your inbox for testing.
          </p>
          <Button
            data-ocid="settings.seed.button"
            variant="outline"
            size="sm"
            onClick={handleSeedMessages}
            disabled={seedMessages.isPending}
            className="gap-1.5 border-border"
          >
            {seedMessages.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Seeding…
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                Seed Sample Messages
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
