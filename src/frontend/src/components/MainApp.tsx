import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { MailCheck, PenLine, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAllUsers,
  useInbox,
  useMarkAllRead,
  useOutbox,
  useTrashThread,
} from "../hooks/useQueries";
import type { Message, UserProfile } from "../types";
import { ComposeForm } from "./ComposeForm";
import { ContactsList } from "./ContactsList";
import { MessageList } from "./MessageList";
import { SettingsView } from "./SettingsView";
import { type NavView, Sidebar } from "./Sidebar";
import { ThreadView } from "./ThreadView";
import { TrashView } from "./TrashView";

interface MainAppProps {
  profile: UserProfile | null;
}

export function MainApp({ profile }: MainAppProps) {
  const [activeView, setActiveView] = useState<NavView>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<bigint | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeInitialTo, setComposeInitialTo] = useState("");

  const { identity } = useInternetIdentity();
  const callerPrincipal = identity?.getPrincipal().toText() ?? "";

  const {
    data: inboxMessages = [],
    isLoading: inboxLoading,
    refetch: refetchInbox,
  } = useInbox();
  const {
    data: outboxMessages = [],
    isLoading: outboxLoading,
    refetch: refetchOutbox,
  } = useOutbox();
  const { data: allUsers = [] } = useAllUsers();
  const markAllRead = useMarkAllRead();
  const trashThread = useTrashThread();

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [principal, username] of allUsers) {
      map.set(principal.toText(), username);
    }
    return map;
  }, [allUsers]);

  const handleSelectThread = useCallback(
    (threadId: bigint, messageId: bigint) => {
      setSelectedThreadId(threadId);
      // Find the message in inbox or outbox
      const allMsgs = [...inboxMessages, ...outboxMessages];
      const msg = allMsgs.find(
        (m) => m.id === messageId || m.threadId === threadId,
      );
      setSelectedMessage(msg ?? null);
    },
    [inboxMessages, outboxMessages],
  );

  const handleViewChange = (view: NavView) => {
    setActiveView(view);
    if (view !== "inbox" && view !== "outbox") {
      setSelectedThreadId(null);
      setSelectedMessage(null);
    }
    if (view === "compose") {
      setComposeInitialTo("");
    }
  };

  const handleComposeTo = (to: string) => {
    setComposeInitialTo(to);
    setActiveView("compose");
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("All messages marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleTrashThread = async (threadId: bigint) => {
    try {
      await trashThread.mutateAsync(threadId);
      toast.success("Thread moved to Trash");
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setSelectedMessage(null);
      }
    } catch {
      toast.error("Failed to move to trash");
    }
  };

  const currentMessages =
    activeView === "outbox" ? outboxMessages : inboxMessages;
  const isLoading = activeView === "outbox" ? outboxLoading : inboxLoading;

  const showMessageList = activeView === "inbox" || activeView === "outbox";

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "oklch(var(--background))",
      }}
    >
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
            color: "oklch(var(--foreground))",
          },
        }}
      />

      {/* Column 1: Sidebar */}
      <div className="w-[220px] flex-shrink-0">
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          profile={profile}
        />
      </div>

      {/* Column 2: Message list (only for inbox/outbox) */}
      {showMessageList && (
        <div className="w-[280px] flex-shrink-0">
          <MessageList
            view={activeView}
            messages={currentMessages}
            isLoading={isLoading}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onTrashThread={handleTrashThread}
            callerPrincipal={callerPrincipal}
            userMap={userMap}
          />
        </div>
      )}

      {/* Column 3: Detail / content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "oklch(var(--border))" }}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground capitalize">
              {activeView === "outbox"
                ? "Sent"
                : activeView === "compose"
                  ? "New Message"
                  : activeView === "trash"
                    ? "Trash"
                    : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {activeView === "inbox" && (
              <Button
                data-ocid="inbox.mark_all_read.button"
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <MailCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
            {(activeView === "inbox" || activeView === "outbox") && (
              <Button
                data-ocid="messages.refresh_button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  activeView === "inbox" ? refetchInbox() : refetchOutbox()
                }
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              data-ocid="compose.open_modal_button"
              size="sm"
              onClick={() => handleViewChange("compose")}
              className="h-8 gap-1.5 text-xs font-semibold"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.52 0.19 253), oklch(0.62 0.18 256))",
                color: "white",
              }}
            >
              <PenLine className="w-3.5 h-3.5" />
              New Message
            </Button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Thread detail */}
            {showMessageList && selectedThreadId && selectedMessage ? (
              <motion.div
                key={`thread-${selectedThreadId}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ThreadView
                  threadId={selectedThreadId}
                  latestMessage={selectedMessage}
                  callerPrincipal={callerPrincipal}
                  userMap={userMap}
                  onDeleted={() => {
                    setSelectedThreadId(null);
                    setSelectedMessage(null);
                  }}
                />
              </motion.div>
            ) : showMessageList ? (
              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "oklch(var(--card))",
                    border: "1px solid oklch(var(--border))",
                  }}
                >
                  <PenLine className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <p className="text-base font-medium text-muted-foreground">
                  Select a conversation
                </p>
                <p className="text-sm text-muted-foreground opacity-60 mt-1">
                  Choose a message thread from the list
                </p>
              </motion.div>
            ) : null}

            {/* Compose view */}
            {activeView === "compose" && (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto"
              >
                <div className="max-w-xl mx-auto px-6 py-8">
                  <ComposeForm
                    initialTo={composeInitialTo}
                    onSent={() => setActiveView("inbox")}
                  />
                </div>
              </motion.div>
            )}

            {/* Trash view */}
            {activeView === "trash" && (
              <motion.div
                key="trash"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <TrashView
                  callerPrincipal={callerPrincipal}
                  userMap={userMap}
                />
              </motion.div>
            )}

            {/* Contacts view */}
            {activeView === "contacts" && (
              <motion.div
                key="contacts"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ContactsList
                  onComposeTo={handleComposeTo}
                  callerPrincipal={callerPrincipal}
                />
              </motion.div>
            )}

            {/* Settings view */}
            {activeView === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <SettingsView profile={profile} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer
          className="flex items-center justify-between px-6 py-2 border-t flex-shrink-0"
          style={{
            borderColor: "oklch(var(--border))",
            background: "oklch(var(--card))",
          }}
        >
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Built with caffeine.ai
            </a>
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "oklch(var(--success))" }}
            />
            <span
              className="text-xs"
              style={{ color: "oklch(var(--success))" }}
            >
              Operational
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              · ICP Network
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
