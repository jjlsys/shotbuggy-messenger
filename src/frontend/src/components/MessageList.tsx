import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MailOpen, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Message } from "../types";
import { formatTimestamp, truncatePrincipal } from "../utils/formatters";
import { InitialsAvatar } from "./InitialsAvatar";
import type { NavView } from "./Sidebar";

interface ThreadGroup {
  threadId: bigint;
  latest: Message;
  count: number;
  hasUnread: boolean;
  partnerLabel: string;
}

interface MessageListProps {
  view: NavView;
  messages: Message[];
  isLoading: boolean;
  selectedThreadId: bigint | null;
  onSelectThread: (threadId: bigint, messageId: bigint) => void;
  onTrashThread?: (threadId: bigint) => void;
  callerPrincipal: string;
  userMap: Map<string, string>;
}

function groupByThread(
  messages: Message[],
  userMap: Map<string, string>,
  isOutbox: boolean,
): ThreadGroup[] {
  const threadMap = new Map<string, ThreadGroup>();

  for (const msg of messages) {
    const key = msg.threadId.toString();
    const partner = isOutbox ? msg.recipient : msg.sender;
    const partnerStr = partner.toText();
    const partnerLabel =
      userMap.get(partnerStr) ?? truncatePrincipal(partnerStr);

    if (!threadMap.has(key)) {
      threadMap.set(key, {
        threadId: msg.threadId,
        latest: msg,
        count: 1,
        hasUnread: !msg.isRead && !isOutbox,
        partnerLabel,
      });
    } else {
      const existing = threadMap.get(key)!;
      if (msg.timestamp > existing.latest.timestamp) {
        existing.latest = msg;
      }
      existing.count++;
      if (!msg.isRead && !isOutbox) existing.hasUnread = true;
    }
  }

  return Array.from(threadMap.values()).sort((a, b) =>
    Number(b.latest.timestamp - a.latest.timestamp),
  );
}

interface ThreadRowProps {
  thread: ThreadGroup;
  markerIdx: number;
  isSelected: boolean;
  onSelectThread: (threadId: bigint, messageId: bigint) => void;
}

function ThreadRow({
  thread,
  markerIdx,
  isSelected,
  onSelectThread,
}: ThreadRowProps) {
  return (
    <button
      type="button"
      data-ocid={`messages.item.${markerIdx}`}
      onClick={() => onSelectThread(thread.threadId, thread.latest.id)}
      className="w-full text-left px-4 py-3 transition-all relative"
      style={{
        background: isSelected ? "oklch(var(--accent))" : "transparent",
        borderLeft: isSelected
          ? "3px solid oklch(0.52 0.19 253)"
          : "3px solid transparent",
      }}
    >
      <div className="flex items-start gap-3">
        <InitialsAvatar name={thread.partnerLabel} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span
              className="text-sm font-semibold truncate"
              style={{
                color: thread.hasUnread
                  ? "oklch(var(--foreground))"
                  : "oklch(var(--foreground) / 0.8)",
              }}
            >
              {thread.partnerLabel}
            </span>
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
              {formatTimestamp(thread.latest.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs truncate flex-1"
              style={{
                color: thread.hasUnread
                  ? "oklch(var(--foreground) / 0.85)"
                  : "oklch(var(--muted-foreground))",
                fontWeight: thread.hasUnread ? 500 : 400,
              }}
            >
              {thread.latest.subject}
            </span>
            {thread.hasUnread && (
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "oklch(0.52 0.19 253)" }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {thread.latest.body.slice(0, 60)}
            {thread.latest.body.length > 60 ? "\u2026" : ""}
          </p>
        </div>
      </div>
    </button>
  );
}

export function MessageList({
  view,
  messages,
  isLoading,
  selectedThreadId,
  onSelectThread,
  onTrashThread,
  callerPrincipal: _callerPrincipal,
  userMap,
}: MessageListProps) {
  const [search, setSearch] = useState("");

  const isOutbox = view === "outbox";

  const threads = useMemo(() => {
    return groupByThread(messages, userMap, isOutbox);
  }, [messages, userMap, isOutbox]);

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(
      (t) =>
        t.partnerLabel.toLowerCase().includes(q) ||
        t.latest.subject.toLowerCase().includes(q) ||
        t.latest.body.toLowerCase().includes(q),
    );
  }, [threads, search]);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "oklch(var(--card))",
        borderRight: "1px solid oklch(var(--border))",
      }}
    >
      {/* Search */}
      <div
        className="px-4 py-4 border-b"
        style={{ borderColor: "oklch(var(--border))" }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-ocid="messages.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages, users\u2026"
            className="pl-9 h-9 bg-input border-border text-sm"
          />
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div
            data-ocid="messages.loading_state"
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div
            data-ocid="messages.empty_state"
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <MailOpen className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">
              {search
                ? "No results found"
                : isOutbox
                  ? "Your sent folder is empty"
                  : "Your inbox is empty"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((thread, idx) => {
              const isSelected = selectedThreadId === thread.threadId;
              const markerIdx = idx + 1;
              const threadKey = thread.threadId.toString();

              if (onTrashThread) {
                return (
                  <ContextMenu key={threadKey}>
                    <ContextMenuTrigger asChild>
                      <ThreadRow
                        thread={thread}
                        markerIdx={markerIdx}
                        isSelected={isSelected}
                        onSelectThread={onSelectThread}
                      />
                    </ContextMenuTrigger>
                    <ContextMenuContent
                      data-ocid="messages.dropdown_menu"
                      style={{
                        background: "oklch(var(--card))",
                        border: "1px solid oklch(var(--border))",
                      }}
                    >
                      <ContextMenuItem
                        data-ocid={`messages.trash_button.${markerIdx}`}
                        onClick={() => onTrashThread(thread.threadId)}
                        className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Move to Trash
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              }

              return (
                <ThreadRow
                  key={threadKey}
                  thread={thread}
                  markerIdx={markerIdx}
                  isSelected={isSelected}
                  onSelectThread={onSelectThread}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
