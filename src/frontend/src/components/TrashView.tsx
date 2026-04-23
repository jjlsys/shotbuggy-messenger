import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MailOpen, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteThread,
  useEmptyTrash,
  useRestoreThread,
  useTrash,
} from "../hooks/useQueries";
import type { Message } from "../types";
import { formatTimestamp, truncatePrincipal } from "../utils/formatters";
import { InitialsAvatar } from "./InitialsAvatar";

interface TrashThreadGroup {
  threadId: bigint;
  latest: Message;
  count: number;
  partnerLabel: string;
}

interface TrashViewProps {
  callerPrincipal: string;
  userMap: Map<string, string>;
}

export function TrashView({ callerPrincipal, userMap }: TrashViewProps) {
  const [search, setSearch] = useState("");
  const { data: trashMessages = [], isLoading } = useTrash();
  const restoreThread = useRestoreThread();
  const deleteThread = useDeleteThread();
  const emptyTrash = useEmptyTrash();

  const threads = useMemo(() => {
    const threadMap = new Map<string, TrashThreadGroup>();
    for (const msg of trashMessages) {
      const key = msg.threadId.toString();
      const partner =
        msg.sender.toText() === callerPrincipal ? msg.recipient : msg.sender;
      const partnerStr = partner.toText();
      const partnerLabel =
        partnerStr === callerPrincipal
          ? "Me"
          : (userMap.get(partnerStr) ?? truncatePrincipal(partnerStr));

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          threadId: msg.threadId,
          latest: msg,
          count: 1,
          partnerLabel,
        });
      } else {
        const existing = threadMap.get(key)!;
        if (msg.timestamp > existing.latest.timestamp) {
          existing.latest = msg;
        }
        existing.count++;
      }
    }
    return Array.from(threadMap.values()).sort((a, b) =>
      Number(b.latest.timestamp - a.latest.timestamp),
    );
  }, [trashMessages, callerPrincipal, userMap]);

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

  const handleRestore = async (threadId: bigint) => {
    try {
      await restoreThread.mutateAsync(threadId);
      toast.success("Thread restored to inbox");
    } catch {
      toast.error("Failed to restore thread");
    }
  };

  const handleDeletePermanently = async (threadId: bigint) => {
    try {
      await deleteThread.mutateAsync(threadId);
      toast.success("Thread permanently deleted");
    } catch {
      toast.error("Failed to delete thread");
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash.mutateAsync();
      toast.success("Trash emptied");
    } catch {
      toast.error("Failed to empty trash");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Empty Trash button */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
        style={{
          background: "oklch(var(--card))",
          borderColor: "oklch(var(--border))",
        }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trash\u2026"
            className="pl-9 h-9 bg-input border-border text-sm"
          />
        </div>
        {threads.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmptyTrash}
            disabled={emptyTrash.isPending}
            className="ml-3 h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            {emptyTrash.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Empty Trash
          </Button>
        )}
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "oklch(var(--card))",
                border: "1px solid oklch(var(--border))",
              }}
            >
              <Trash2 className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-base font-medium text-muted-foreground">
              {search ? "No results found" : "Trash is empty"}
            </p>
            <p className="text-sm text-muted-foreground opacity-60 mt-1">
              {!search && "Deleted messages will appear here"}
            </p>
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "oklch(var(--border))" }}
          >
            {filtered.map((thread, idx) => (
              <div
                key={thread.threadId.toString()}
                data-ocid={`trash.item.${idx + 1}`}
                className="px-4 py-3 flex items-start gap-3"
                style={{ background: "oklch(var(--card))" }}
              >
                <InitialsAvatar name={thread.partnerLabel} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate text-foreground opacity-70">
                      {thread.partnerLabel}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {formatTimestamp(thread.latest.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {thread.latest.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate opacity-60 mt-0.5">
                    {thread.latest.body.slice(0, 60)}
                    {thread.latest.body.length > 60 ? "\u2026" : ""}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <Button
                    data-ocid={`trash.restore_button.${idx + 1}`}
                    size="sm"
                    variant="ghost"
                    title="Restore to inbox"
                    onClick={() => handleRestore(thread.threadId)}
                    disabled={restoreThread.isPending}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                  >
                    {restoreThread.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    data-ocid={`trash.delete_button.${idx + 1}`}
                    size="sm"
                    variant="ghost"
                    title="Delete permanently"
                    onClick={() => handleDeletePermanently(thread.threadId)}
                    disabled={deleteThread.isPending}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    {deleteThread.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
