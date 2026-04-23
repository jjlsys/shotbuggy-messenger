import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Lock, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";

export function LoginPage() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background gradient */}
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
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 overflow-hidden">
            <img
              src="/assets/shby.png-019d63c5-d96c-71db-9581-e1fb102adfb8.png"
              alt="SHBY Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">
            ShotBuggy Messenger
          </h1>
          <p className="text-muted-foreground text-base">
            A Decentralized Messenger on ICP
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Shield, label: "End-to-End", sub: "Decentralized" },
            { icon: Lock, label: "On-Chain", sub: "Storage" },
            { icon: Zap, label: "No Servers", sub: "Required" },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 p-4 rounded-lg"
              style={{
                background: "oklch(var(--card))",
                border: "1px solid oklch(var(--border))",
              }}
            >
              <Icon className="w-5 h-5 text-primary" />
              <div className="text-center">
                <div className="text-xs font-semibold text-foreground">
                  {label}
                </div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Login card */}
        <div
          className="p-6 rounded-xl"
          style={{
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Sign in to continue
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connect with Internet Identity — your secure, decentralized
            authentication on the Internet Computer.
          </p>
          <Button
            data-ocid="login.primary_button"
            onClick={login}
            disabled={isLoggingIn}
            className="w-full h-11 font-semibold"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.52 0.19 253), oklch(0.62 0.18 256))",
              color: "white",
            }}
          >
            {isLoggingIn ? "Connecting…" : "Login with Internet Identity"}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-4">
            No passwords. No email. Fully sovereign identity.
          </p>
        </div>

        <div className="text-center mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </div>
      </motion.div>
    </div>
  );
}
