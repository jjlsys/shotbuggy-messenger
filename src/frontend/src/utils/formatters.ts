import type { Principal } from "@icp-sdk/core/principal";

export function formatTimestamp(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / 1_000_000n);
  const now = Date.now();
  const diff = now - ms;

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 172_800_000) return "Yesterday";
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days}d ago`;
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function truncatePrincipal(
  principal: Principal | string,
  length = 12,
): string {
  const str = typeof principal === "string" ? principal : principal.toText();
  if (str.length <= length * 2 + 3) return str;
  return `${str.slice(0, length)}…${str.slice(-6)}`;
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  // For principal IDs, take first 2 chars after removing dashes
  if (cleaned.includes("-") && cleaned.length > 20) {
    return cleaned.replace(/-/g, "").slice(0, 2).toUpperCase();
  }
  const parts = cleaned.split(/[\s._-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "oklch(0.52 0.19 253)", // blue
  "oklch(0.55 0.18 285)", // purple
  "oklch(0.55 0.17 200)", // teal
  "oklch(0.55 0.19 160)", // green
  "oklch(0.58 0.18 30)", // orange
  "oklch(0.55 0.2 330)", // pink
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function isLikelyUsername(input: string): boolean {
  // Principal IDs contain dashes and are long; usernames are typically shorter alphanumeric
  const trimmed = input.trim();
  // Principal format: 5 groups separated by dashes like xxxxx-xxxxx-xxxxx-xxxxx-xxx
  const principalPattern = /^[a-z0-9]{5}-[a-z0-9]{5}/i;
  return !principalPattern.test(trimmed) && !trimmed.includes(":");
}
