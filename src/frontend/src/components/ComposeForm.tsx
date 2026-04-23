import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { Principal as PrincipalClass } from "@icp-sdk/core/principal";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useGetPrincipalByUsername,
  useReplyToMessage,
  useSendMessage,
} from "../hooks/useQueries";
import { useStorageClient } from "../hooks/useStorageClient";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { useTokenTransfer } from "../hooks/useTokenTransfer";
import type { Attachment } from "../types";
import { isLikelyUsername } from "../utils/formatters";

interface ComposeFormProps {
  onClose?: () => void;
  replyTo?: {
    messageId: bigint;
    recipientLabel: string;
    subject: string;
    /** The principal of the person to reply to (the original sender) */
    recipientPrincipal?: Principal;
  };
  initialTo?: string;
  onSent?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateFilename(name: string, maxLen = 28): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0) {
    const extPart = name.slice(ext);
    const namePart = name.slice(0, maxLen - extPart.length - 3);
    return `${namePart}...${extPart}`;
  }
  return `${name.slice(0, maxLen - 3)}...`;
}

export function ComposeForm({
  onClose,
  replyTo,
  initialTo = "",
  onSent,
}: ComposeFormProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject}` : "",
  );
  const [body, setBody] = useState("");
  const [resolving, setResolving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [copiedPrincipal, setCopiedPrincipal] = useState(false);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentToken, setPaymentToken] = useState<"ICP" | "SHBY">("ICP");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDestination, setPaymentDestination] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { identity } = useInternetIdentity();
  const sendMessage = useSendMessage();
  const replyToMessage = useReplyToMessage();
  const getPrincipalByUsername = useGetPrincipalByUsername();
  const { getClient } = useStorageClient();
  const { transfer, isPending: isTransferPending } = useTokenTransfer();

  // Always call hook (hooks can't be conditional) — only render when showPayment is true
  const { balance: tokenBalance, loading: balanceLoading } =
    useTokenBalance(paymentToken);

  const isUploading = uploadStatus !== null;
  const isPending =
    sendMessage.isPending ||
    replyToMessage.isPending ||
    isUploading ||
    isTransferPending;

  const hasPayment =
    showPayment &&
    paymentAmount.trim() !== "" &&
    Number.parseFloat(paymentAmount) > 0;

  const amountE8s = hasPayment
    ? BigInt(Math.round(Number.parseFloat(paymentAmount) * 1e8))
    : 0n;

  const isInsufficientBalance =
    hasPayment && tokenBalance !== null && amountE8s > tokenBalance;

  const handleCopyPrincipal = async () => {
    const principalText = identity?.getPrincipal().toText();
    if (!principalText) return;
    try {
      await navigator.clipboard.writeText(principalText);
      setCopiedPrincipal(true);
      setTimeout(() => setCopiedPrincipal(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    // Reset so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (pendingFiles.length === 0) return [];
    const client = await getClient();
    const attachments: Attachment[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      setUploadStatus(`Uploading ${i + 1}/${pendingFiles.length}…`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { hash } = await client.putFile(bytes);
      attachments.push({
        hash,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: BigInt(file.size),
      });
    }

    setUploadStatus(null);
    return attachments;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    try {
      const attachments = await uploadFiles();

      // Build payment metadata if provided
      const paymentData = hasPayment
        ? {
            token: paymentToken,
            amount: BigInt(Math.round(Number.parseFloat(paymentAmount) * 1e8)),
            memo: paymentMemo.trim() || undefined,
          }
        : undefined;

      let recipientPrincipal: Principal | undefined;

      if (replyTo) {
        if (attachments.length > 0 && replyTo.recipientPrincipal) {
          await sendMessage.mutateAsync({
            subject: subject.trim() || `Re: ${replyTo.subject}`,
            body: body.trim(),
            recipient: replyTo.recipientPrincipal,
            parentId: replyTo.messageId,
            attachments,
            payment: paymentData,
          });
          recipientPrincipal = replyTo.recipientPrincipal;
        } else {
          await replyToMessage.mutateAsync({
            messageId: replyTo.messageId,
            subject: subject.trim() || `Re: ${replyTo.subject}`,
            body: body.trim(),
          });
          if (attachments.length > 0 && !replyTo.recipientPrincipal) {
            toast(
              "Attachments could not be included in reply (recipient info missing)",
            );
          }
          recipientPrincipal = replyTo.recipientPrincipal;
        }
        toast.success("Reply sent!");
      } else {
        if (!to.trim()) {
          toast.error("Please enter a recipient");
          return;
        }

        setResolving(true);
        try {
          if (isLikelyUsername(to.trim())) {
            recipientPrincipal = await getPrincipalByUsername(to.trim());
          } else {
            recipientPrincipal = PrincipalClass.fromText(to.trim());
          }
        } catch {
          toast.error(`Could not find user: ${to.trim()}`);
          setResolving(false);
          return;
        } finally {
          setResolving(false);
        }

        await sendMessage.mutateAsync({
          subject: subject.trim() || "(no subject)",
          body: body.trim(),
          recipient: recipientPrincipal,
          parentId: undefined,
          attachments,
          payment: paymentData,
        });
        toast.success("Message sent!");
        setTo("");
        setSubject("");
        setBody("");
        setPendingFiles([]);
        setPaymentAmount("");
        setPaymentDestination("");
        setPaymentMemo("");
        setShowPayment(false);
      }

      // Execute the actual token transfer after message is sent
      if (paymentData && recipientPrincipal) {
        // Resolve transfer destination: custom address or fall back to message recipient
        let transferDestination: Principal;
        if (paymentDestination.trim()) {
          try {
            transferDestination = PrincipalClass.fromText(
              paymentDestination.trim(),
            );
          } catch {
            toast.error("Invalid destination address");
            return;
          }
        } else {
          transferDestination = recipientPrincipal;
        }

        const amountDisplay = `${(Number(paymentData.amount) / 1e8).toFixed(4)} ${paymentData.token}`;
        toast(`Sending ${amountDisplay}…`);
        try {
          await transfer(
            paymentData.token as "ICP" | "SHBY",
            transferDestination,
            paymentData.amount,
            paymentData.memo,
          );
          toast.success(`Payment of ${amountDisplay} sent!`);
        } catch (transferErr) {
          toast.error(
            `Payment failed: ${
              transferErr instanceof Error
                ? transferErr.message
                : "Unknown error"
            }`,
          );
        }
      }

      onSent?.();
    } catch (err) {
      setUploadStatus(null);
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  };

  const principalText = identity?.getPrincipal().toText() ?? "—";
  const balanceDisplay =
    tokenBalance !== null
      ? `${(Number(tokenBalance) / 1e8).toFixed(4)} ${paymentToken}`
      : `0.0000 ${paymentToken}`;
  const isZeroBalance = tokenBalance === null || tokenBalance === 0n;

  return (
    <form
      data-ocid="compose.modal"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      {onClose && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            {replyTo ? "Reply" : "New Message"}
          </h3>
          <button
            type="button"
            data-ocid="compose.close_button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!replyTo && (
        <div>
          <Label
            htmlFor="compose-to"
            className="text-xs text-muted-foreground mb-1.5 block"
          >
            To (username or principal ID)
          </Label>
          <Input
            id="compose-to"
            data-ocid="compose.input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="satoshi.icp or principal-id"
            className="h-9 bg-input border-border text-sm"
            required
          />
        </div>
      )}

      {replyTo && (
        <div
          className="text-sm px-3 py-2 rounded-lg"
          style={{
            background: "oklch(var(--muted))",
            color: "oklch(var(--muted-foreground))",
          }}
        >
          Replying to{" "}
          <span className="text-foreground font-medium">
            {replyTo.recipientLabel}
          </span>
        </div>
      )}

      <div>
        <Label
          htmlFor="compose-subject"
          className="text-xs text-muted-foreground mb-1.5 block"
        >
          Subject
        </Label>
        <Input
          id="compose-subject"
          data-ocid="compose.subject_input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="h-9 bg-input border-border text-sm"
        />
      </div>

      <div>
        <Label
          htmlFor="compose-body"
          className="text-xs text-muted-foreground mb-1.5 block"
        >
          Message
        </Label>
        <Textarea
          id="compose-body"
          data-ocid="compose.textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="min-h-[120px] bg-input border-border text-sm resize-none"
          required
        />
      </div>

      {/* Attach Payment toggle */}
      <div>
        <button
          type="button"
          data-ocid="compose.toggle"
          onClick={() => setShowPayment((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium transition-colors rounded-md px-2.5 py-1.5"
          style={{
            color: showPayment
              ? "oklch(0.75 0.18 90)"
              : "oklch(var(--muted-foreground))",
            background: showPayment
              ? "oklch(0.22 0.05 90 / 0.5)"
              : "oklch(var(--muted))",
            border: `1px solid ${
              showPayment ? "oklch(0.55 0.14 90 / 0.5)" : "oklch(var(--border))"
            }`,
          }}
        >
          <Coins className="w-3.5 h-3.5" />
          Attach Payment
          {showPayment ? (
            <ChevronUp className="w-3 h-3 ml-auto" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-auto" />
          )}
        </button>

        {showPayment && (
          <div
            className="mt-2 p-3 rounded-lg flex flex-col gap-3"
            style={{
              background: "oklch(0.18 0.04 90 / 0.4)",
              border: "1px solid oklch(0.45 0.10 90 / 0.35)",
            }}
          >
            {/* Your balance row */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Your balance
              </span>
              {balanceLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{
                    color: isZeroBalance
                      ? "oklch(0.65 0.12 40)"
                      : "oklch(0.78 0.16 145)",
                  }}
                >
                  {balanceDisplay}
                </span>
              )}
            </div>

            {/* Your ICRC-1 principal / account address */}
            <div
              className="rounded-md p-2.5 flex flex-col gap-1.5"
              style={{
                background: "oklch(0.16 0.04 240 / 0.5)",
                border: "1px solid oklch(0.40 0.09 240 / 0.45)",
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "oklch(0.65 0.10 240)" }}
              >
                Your ICRC-1 account (send tokens here first)
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono flex-1 break-all leading-relaxed"
                  style={{ color: "oklch(0.82 0.06 240)" }}
                >
                  {principalText}
                </span>
                <button
                  type="button"
                  data-ocid="compose.secondary_button"
                  onClick={handleCopyPrincipal}
                  title="Copy principal"
                  className="flex-shrink-0 p-1 rounded transition-colors"
                  style={{
                    color: copiedPrincipal
                      ? "oklch(0.78 0.16 145)"
                      : "oklch(0.60 0.08 240)",
                    background: "oklch(0.22 0.05 240 / 0.4)",
                  }}
                >
                  {copiedPrincipal ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Token selector */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Token
              </Label>
              <div className="flex gap-2">
                {(["ICP", "SHBY"] as const).map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    data-ocid={`compose.${tok.toLowerCase()}_toggle`}
                    onClick={() => setPaymentToken(tok)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                    style={{
                      background:
                        paymentToken === tok
                          ? "oklch(0.55 0.16 90)"
                          : "oklch(var(--muted))",
                      color:
                        paymentToken === tok
                          ? "oklch(0.98 0.01 90)"
                          : "oklch(var(--muted-foreground))",
                      border: `1px solid ${
                        paymentToken === tok
                          ? "oklch(0.65 0.18 90)"
                          : "oklch(var(--border))"
                      }`,
                    }}
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label
                htmlFor="payment-amount"
                className="text-xs text-muted-foreground mb-1.5 block"
              >
                Amount ({paymentToken})
              </Label>
              <Input
                id="payment-amount"
                data-ocid="compose.payment_amount_input"
                type="number"
                min="0"
                step="0.0001"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.0"
                className="h-9 bg-input border-border text-sm"
              />
            </div>

            {/* Send to address (optional) */}
            <div>
              <Label
                htmlFor="payment-destination"
                className="text-xs text-muted-foreground mb-1.5 block"
              >
                Send to (principal address)
              </Label>
              <Input
                id="payment-destination"
                data-ocid="compose.payment_destination_input"
                value={paymentDestination}
                onChange={(e) => setPaymentDestination(e.target.value)}
                placeholder="Leave blank to send to message recipient"
                className="h-9 bg-input border-border text-sm font-mono"
              />
            </div>

            {/* Memo */}
            <div>
              <Label
                htmlFor="payment-memo"
                className="text-xs text-muted-foreground mb-1.5 block"
              >
                Memo (optional)
              </Label>
              <Input
                id="payment-memo"
                data-ocid="compose.payment_memo_input"
                value={paymentMemo}
                onChange={(e) => setPaymentMemo(e.target.value)}
                placeholder="e.g. Thanks for lunch"
                className="h-9 bg-input border-border text-sm"
              />
            </div>

            {hasPayment &&
              (isInsufficientBalance ? (
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5"
                  data-ocid="compose.error_state"
                  style={{
                    background: "oklch(0.20 0.06 25 / 0.6)",
                    color: "oklch(0.75 0.18 25)",
                    border: "1px solid oklch(0.45 0.14 25 / 0.5)",
                  }}
                >
                  <X className="w-3 h-3 flex-shrink-0" />
                  <span>
                    Insufficient balance — you have{" "}
                    <span className="font-semibold">{balanceDisplay}</span> but
                    are trying to send{" "}
                    <span className="font-semibold">
                      {Number.parseFloat(paymentAmount).toFixed(4)}{" "}
                      {paymentToken}
                    </span>
                  </span>
                </div>
              ) : (
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md"
                  style={{
                    background: "oklch(0.22 0.06 90 / 0.6)",
                    color: "oklch(0.80 0.15 90)",
                    border: "1px solid oklch(0.50 0.12 90 / 0.4)",
                  }}
                >
                  Will send{" "}
                  <span className="font-semibold">
                    {Number.parseFloat(paymentAmount).toFixed(4)} {paymentToken}
                  </span>{" "}
                  {paymentDestination.trim() ? (
                    <>
                      to{" "}
                      <span className="font-mono">
                        {paymentDestination.trim().slice(0, 10)}…
                      </span>
                    </>
                  ) : (
                    "to message recipient"
                  )}{" "}
                  + ledger fee on send
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs"
              style={{
                background: "oklch(var(--muted))",
                border: "1px solid oklch(var(--border))",
                color: "oklch(var(--muted-foreground))",
              }}
            >
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span
                className="max-w-[160px] truncate font-medium"
                style={{ color: "oklch(var(--foreground))" }}
              >
                {truncateFilename(file.name)}
              </span>
              <span className="text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        data-ocid="compose.upload_button"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-ocid="compose.dropzone"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          title="Attach files"
          className="flex items-center justify-center w-9 h-9 rounded-lg border transition-colors flex-shrink-0"
          style={{
            border: "1px solid oklch(var(--border))",
            background: "oklch(var(--muted))",
            color: "oklch(var(--muted-foreground))",
          }}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <Button
          data-ocid="compose.submit_button"
          type="submit"
          disabled={
            isPending || resolving || !body.trim() || isInsufficientBalance
          }
          className="h-9 gap-2 font-semibold flex-1"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.52 0.19 253), oklch(0.62 0.18 256))",
            color: "white",
          }}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {uploadStatus}
            </>
          ) : isPending || resolving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send
              {hasPayment
                ? ` + ${Number.parseFloat(paymentAmount).toFixed(4)} ${paymentToken}`
                : pendingFiles.length > 0
                  ? ` (+${pendingFiles.length} file${
                      pendingFiles.length > 1 ? "s" : ""
                    })`
                  : " Message"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
