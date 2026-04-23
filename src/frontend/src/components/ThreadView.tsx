import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StorageClient } from "@caffeineai/object-storage";
import {
  Coins,
  CornerDownRight,
  Download,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Reply,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMessage,
  useMarkAsRead,
  useThread,
  useTrashThread,
} from "../hooks/useQueries";
import { useStorageClient } from "../hooks/useStorageClient";
import type { Attachment, Message } from "../types";
import { formatTimestamp, truncatePrincipal } from "../utils/formatters";
import { ComposeForm } from "./ComposeForm";
import { InitialsAvatar } from "./InitialsAvatar";

interface ThreadViewProps {
  threadId: bigint;
  latestMessage: Message;
  callerPrincipal: string;
  userMap: Map<string, string>;
  onClose?: () => void;
  onDeleted?: () => void;
}

function formatFileSize(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({
  attachment,
  getClient,
}: {
  attachment: Attachment;
  getClient: () => Promise<StorageClient>;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const client = await getClient();
      const url = await client.getDirectURL(attachment.hash);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download file",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs group"
      style={{
        background: "oklch(var(--muted))",
        border: "1px solid oklch(var(--border))",
      }}
    >
      <FileText
        className="w-3.5 h-3.5 flex-shrink-0"
        style={{ color: "oklch(0.52 0.19 253)" }}
      />
      <span
        className="font-medium max-w-[180px] truncate"
        style={{ color: "oklch(var(--foreground))" }}
        title={attachment.filename}
      >
        {attachment.filename}
      </span>
      <span style={{ color: "oklch(var(--muted-foreground))" }}>
        {formatFileSize(attachment.size)}
      </span>
      <button
        type="button"
        data-ocid="thread.upload_button"
        onClick={handleDownload}
        disabled={downloading}
        title="Download"
        className="ml-0.5 flex items-center justify-center w-5 h-5 rounded transition-colors hover:text-primary"
        style={{ color: "oklch(var(--muted-foreground))" }}
      >
        {downloading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Download className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

export function ThreadView({
  threadId,
  latestMessage,
  callerPrincipal,
  userMap,
  onDeleted,
}: ThreadViewProps) {
  const [showReply, setShowReply] = useState(false);
  const { data: messages, isLoading, refetch } = useThread(threadId);
  const markAsRead = useMarkAsRead();
  const deleteMessage = useDeleteMessage();
  const trashThread = useTrashThread();
  const { getClient } = useStorageClient();

  const markUnreadMessages = useCallback(() => {
    if (!messages) return;
    const unread = messages.filter(
      (m) => !m.isRead && m.recipient.toText() === callerPrincipal,
    );
    for (const msg of unread) {
      markAsRead.mutate(msg.id);
    }
  }, [messages, callerPrincipal, markAsRead.mutate]);

  // Mark unread messages as read when thread opens
  useEffect(() => {
    markUnreadMessages();
  }, [markUnreadMessages]);

  const getLabel = (principal: string) => {
    if (principal === callerPrincipal) return "Me";
    return userMap.get(principal) ?? truncatePrincipal(principal);
  };

  const handleDelete = async (id: bigint) => {
    try {
      await deleteMessage.mutateAsync(id);
      toast.success("Message deleted");
      if (messages?.length === 1) {
        onDeleted?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleTrashThread = async () => {
    try {
      await trashThread.mutateAsync(threadId);
      toast.success("Thread moved to Trash");
      onDeleted?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to move to trash",
      );
    }
  };

  const isTrashingThread = trashThread.isPending;

  const threadPartner =
    latestMessage.sender.toText() === callerPrincipal
      ? latestMessage.recipient.toText()
      : latestMessage.sender.toText();
  const partnerLabel = getLabel(threadPartner);
  const lastMsg = messages?.[messages.length - 1];

  // The principal of the person we are replying to
  const replyToPrincipal =
    lastMsg && lastMsg.sender.toText() !== callerPrincipal
      ? lastMsg.sender
      : lastMsg?.recipient;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: "oklch(var(--border))" }}
      >
        <div className="flex items-center gap-3">
          <InitialsAvatar name={partnerLabel} size="md" />
          <div>
            <div className="font-semibold text-foreground text-sm">
              {partnerLabel}
            </div>
            <div className="text-xs text-muted-foreground">
              {messages?.length ?? 1} message
              {(messages?.length ?? 1) !== 1 ? "s" : ""} in thread
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-ocid="thread.trash_thread_button"
            size="sm"
            variant="ghost"
            onClick={handleTrashThread}
            disabled={isTrashingThread || isLoading || !messages?.length}
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-destructive"
          >
            {isTrashingThread ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Move to Trash
          </Button>
          <Button
            data-ocid="thread.reply_button"
            size="sm"
            variant="ghost"
            onClick={() => setShowReply((v) => !v)}
            className="gap-1.5 h-8 text-xs"
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </Button>
          <Button
            data-ocid="thread.refresh_button"
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div
            data-ocid="thread.loading_state"
            className="flex items-center justify-center py-16"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {(messages ?? [latestMessage]).map((msg, idx) => {
              const senderLabel = getLabel(msg.sender.toText());
              const isSelf = msg.sender.toText() === callerPrincipal;
              const hasAttachments =
                msg.attachments && msg.attachments.length > 0;

              return (
                <div
                  key={msg.id.toString()}
                  data-ocid={`thread.item.${idx + 1}`}
                  className="p-4 rounded-xl animate-fade-in"
                  style={{
                    background: isSelf
                      ? "oklch(var(--muted))"
                      : "oklch(var(--card))",
                    border: "1px solid oklch(var(--border))",
                  }}
                >
                  {/* Message header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={senderLabel} size="sm" />
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {senderLabel}
                          {!msg.isRead && !isSelf && (
                            <Badge
                              className="text-xs px-1.5 py-0 h-4 font-medium"
                              style={{
                                background: "oklch(0.52 0.19 253)",
                                color: "white",
                                fontSize: "9px",
                              }}
                            >
                              New
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isSelf && idx === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowReply(true)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        data-ocid={`thread.delete_button.${idx + 1}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(msg.id)}
                        disabled={
                          deleteMessage.isPending || trashThread.isPending
                        }
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Subject */}
                  {msg.subject && (
                    <div className="font-medium text-sm text-foreground mb-2">
                      {msg.subject}
                    </div>
                  )}

                  {/* Body */}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {msg.body}
                  </p>

                  {/* Payment badge */}
                  {msg.payment.length > 0 &&
                    (() => {
                      const p = msg.payment[0]!;
                      return (
                        <div
                          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{
                            background: "oklch(0.25 0.05 253)",
                            border: "1px solid oklch(0.45 0.15 253 / 0.4)",
                          }}
                        >
                          <Coins
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "oklch(0.75 0.18 90)" }}
                          />
                          <div className="flex flex-col">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "oklch(0.85 0.12 90)" }}
                            >
                              {(Number(p.amount) / 1e8).toFixed(4)} {p.token}{" "}
                              sent
                            </span>
                            {p.memo.length > 0 && (
                              <span
                                className="text-xs"
                                style={{
                                  color: "oklch(var(--muted-foreground))",
                                }}
                              >
                                {p.memo[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Attachments */}
                  {hasAttachments && (
                    <>
                      <div
                        className="my-3"
                        style={{
                          borderTop: "1px solid oklch(var(--border))",
                        }}
                      />
                      <div className="flex items-center gap-1.5 mb-2">
                        <Paperclip
                          className="w-3 h-3"
                          style={{ color: "oklch(var(--muted-foreground))" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: "oklch(var(--muted-foreground))" }}
                        >
                          {msg.attachments.length} attachment
                          {msg.attachments.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.attachments.map((attachment, aIdx) => (
                          <AttachmentChip
                            key={`${attachment.hash}-${aIdx}`}
                            attachment={attachment}
                            getClient={getClient}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Reply composer */}
      {showReply && lastMsg && (
        <div
          className="border-t px-5 py-4 flex-shrink-0"
          style={{
            borderColor: "oklch(var(--border))",
            background: "oklch(var(--card))",
          }}
        >
          <ComposeForm
            replyTo={{
              messageId: lastMsg.id,
              recipientLabel: partnerLabel,
              subject: lastMsg.subject,
              recipientPrincipal: replyToPrincipal,
            }}
            onClose={() => setShowReply(false)}
            onSent={() => setShowReply(false)}
          />
        </div>
      )}
    </div>
  );
}
