import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import {
  Circle,
  Inbox,
  LogOut,
  PenLine,
  Send,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { useTrash, useUnreadCount } from "../hooks/useQueries";
import type { UserProfile } from "../types";
import { truncatePrincipal } from "../utils/formatters";

export type NavView =
  | "inbox"
  | "outbox"
  | "compose"
  | "contacts"
  | "settings"
  | "trash";

interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  profile: UserProfile | null;
}

const navItems: Array<{
  view: NavView;
  label: string;
  icon: React.ElementType;
}> = [
  { view: "inbox", label: "Inbox", icon: Inbox },
  { view: "outbox", label: "Sent", icon: Send },
  { view: "compose", label: "Compose", icon: PenLine },
  { view: "contacts", label: "Contacts", icon: Users },
  { view: "trash", label: "Trash", icon: Trash2 },
  { view: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, onViewChange, profile }: SidebarProps) {
  const { clear, identity } = useInternetIdentity();
  const { data: unreadCount } = useUnreadCount();
  const { data: trashMessages = [] } = useTrash();
  const principalText = identity?.getPrincipal().toText() ?? "";

  // Count unique trashed thread IDs
  const trashCount = new Set(trashMessages.map((m) => m.threadId.toString()))
    .size;

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        background: "oklch(var(--sidebar))",
        borderRight: "1px solid oklch(var(--sidebar-border))",
      }}
    >
      {/* Brand block */}
      <div
        className="px-5 py-6 border-b"
        style={{ borderColor: "oklch(var(--sidebar-border))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              src="/assets/shby.png-019d63c5-d96c-71db-9581-e1fb102adfb8.png"
              alt="SHBY Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="font-bold text-foreground text-sm leading-tight">
              ShotBuggy Messenger
            </div>
            <div
              className="text-muted-foreground"
              style={{ fontSize: "10px", lineHeight: "1.3" }}
            >
              Decentralized Messenger on ICP
            </div>
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          const inboxCount =
            view === "inbox" && unreadCount ? Number(unreadCount) : 0;
          const trashBadgeCount = view === "trash" ? trashCount : 0;

          return (
            <button
              type="button"
              key={view}
              data-ocid={`nav.${view}.link`}
              onClick={() => onViewChange(view)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group"
              style={{
                background: isActive
                  ? "oklch(var(--sidebar-accent))"
                  : "transparent",
                color: isActive
                  ? "oklch(var(--sidebar-primary))"
                  : "oklch(var(--sidebar-foreground) / 0.75)",
                boxShadow: isActive
                  ? "inset 3px 0 0 oklch(var(--sidebar-primary))"
                  : "none",
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{
                  color: isActive ? "oklch(var(--sidebar-primary))" : undefined,
                }}
              />
              <span className="flex-1 text-left font-medium">{label}</span>
              {/* Inbox unread badge */}
              {view === "inbox" && isActive && (
                <div className="flex flex-col items-end">
                  {inboxCount > 0 && (
                    <Badge
                      data-ocid="inbox.unread_count"
                      className="text-xs px-1.5 py-0 h-5 min-w-[1.25rem] font-semibold"
                      style={{
                        background: "oklch(0.52 0.19 253)",
                        color: "white",
                        fontSize: "10px",
                      }}
                    >
                      {inboxCount}
                    </Badge>
                  )}
                  <span
                    className="text-muted-foreground"
                    style={{ fontSize: "10px" }}
                  >
                    Active
                  </span>
                </div>
              )}
              {view === "inbox" && !isActive && inboxCount > 0 && (
                <Badge
                  className="text-xs px-1.5 py-0 h-5 min-w-[1.25rem] font-semibold"
                  style={{
                    background: "oklch(0.52 0.19 253)",
                    color: "white",
                    fontSize: "10px",
                  }}
                >
                  {inboxCount}
                </Badge>
              )}
              {/* Trash count badge */}
              {view === "trash" && trashBadgeCount > 0 && (
                <Badge
                  className="text-xs px-1.5 py-0 h-5 min-w-[1.25rem] font-semibold"
                  style={{
                    background: "oklch(0.45 0.18 25)",
                    color: "white",
                    fontSize: "10px",
                  }}
                >
                  {trashBadgeCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div
        className="px-4 py-4 border-t space-y-3"
        style={{ borderColor: "oklch(var(--sidebar-border))" }}
      >
        {/* Principal info */}
        <div
          className="px-3 py-2 rounded-lg"
          style={{ background: "oklch(var(--sidebar-accent))" }}
        >
          <div
            className="text-muted-foreground mb-0.5"
            style={{ fontSize: "10px" }}
          >
            Connected as
          </div>
          <div className="font-mono text-xs text-foreground truncate">
            {truncatePrincipal(principalText)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Circle className="w-2 h-2 fill-success text-success" />
            <span
              className="text-muted-foreground"
              style={{ fontSize: "10px" }}
            >
              ICP Mainnet · Operational
            </span>
          </div>
        </div>

        {/* Profile */}
        {profile && (
          <div className="text-xs text-muted-foreground px-1">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              @{profile.username}
            </span>
          </div>
        )}

        {/* Logout */}
        <Button
          data-ocid="nav.logout.button"
          variant="ghost"
          size="sm"
          onClick={clear}
          className="w-full justify-start text-muted-foreground hover:text-destructive gap-2 h-8"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
