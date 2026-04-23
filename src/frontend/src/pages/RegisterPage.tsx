import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useIsUsernameAvailable, useRegister } from "../hooks/useQueries";
import { useTypedActor } from "../hooks/useTypedActor";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const { actor, isFetching } = useTypedActor();
  const register = useRegister();
  const checkAvailable = useIsUsernameAvailable();

  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    setAvailable(null);
    if (value.length < 3) return;
    if (!actor) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const ok = await checkAvailable(value);
      setAvailable(ok);
    } catch {
      // ignore — allow submission attempt
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 3) return;
    if (available === false) {
      toast.error("That username is already taken. Please choose another.");
      return;
    }
    try {
      await register.mutateAsync(username.trim());
      toast.success("Username registered!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const isDisabled =
    !actor ||
    isFetching ||
    !username.trim() ||
    username.trim().length < 3 ||
    checking ||
    register.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.52 0.19 253 / 0.08) 0%, transparent 60%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden">
            <img
              src="/assets/shby.png-019d63c5-d96c-71db-9581-e1fb102adfb8.png"
              alt="SHBY Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Choose a Username
          </h1>
          <p className="text-sm text-muted-foreground">
            This is how others will find you on ShotBuggy Messenger
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl"
          style={{
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="mb-5">
            <Label
              htmlFor="username"
              className="text-sm font-medium text-foreground mb-2 block"
            >
              Username
            </Label>
            <div className="relative">
              <Input
                id="username"
                data-ocid="register.input"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="e.g. satoshi.icp"
                className="pr-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
                minLength={3}
                maxLength={32}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {!checking && available === true && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
                {!checking && available === false && (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
            </div>
            {available === false && (
              <p
                data-ocid="register.error_state"
                className="text-xs text-destructive mt-1"
              >
                Username already taken — please choose another
              </p>
            )}
            {available === true && (
              <p
                data-ocid="register.success_state"
                className="text-xs text-success mt-1"
              >
                Username available!
              </p>
            )}
          </div>

          <Button
            data-ocid="register.submit_button"
            type="submit"
            className="w-full h-11 font-semibold"
            disabled={isDisabled}
            style={{
              background:
                "linear-gradient(135deg, oklch(0.52 0.19 253), oklch(0.62 0.18 256))",
              color: "white",
            }}
          >
            {!actor || isFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : register.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering…
              </>
            ) : checking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
