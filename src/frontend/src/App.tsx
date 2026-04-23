import { Skeleton } from "@/components/ui/skeleton";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { MainApp } from "./components/MainApp";
import { useCallerUserProfile } from "./hooks/useQueries";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const { data: profile, isLoading: profileLoading } = useCallerUserProfile();

  // Still booting
  if (isInitializing || (isAuthenticated && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton
            className="h-4 w-full"
            style={{ background: "oklch(var(--card))" }}
          />
          <Skeleton
            className="h-4 w-3/4"
            style={{ background: "oklch(var(--card))" }}
          />
          <Skeleton
            className="h-4 w-1/2"
            style={{ background: "oklch(var(--card))" }}
          />
        </div>
      </div>
    );
  }

  // Not authenticated → Login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated but no profile → Register
  if (profile === null || profile === undefined) {
    return <RegisterPage />;
  }

  // Fully authenticated with profile → Main App
  return <MainApp profile={profile} />;
}
