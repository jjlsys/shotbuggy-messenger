import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Principal } from "@icp-sdk/core/principal";
import { Loader2, MessageSquarePlus, Users } from "lucide-react";
import { useAllUsers } from "../hooks/useQueries";
import { truncatePrincipal } from "../utils/formatters";
import { InitialsAvatar } from "./InitialsAvatar";

interface ContactsListProps {
  onComposeTo: (username: string) => void;
  callerPrincipal: string;
}

export function ContactsList({
  onComposeTo,
  callerPrincipal,
}: ContactsListProps) {
  const { data: users, isLoading } = useAllUsers();

  const others = users?.filter(([p]) => p.toText() !== callerPrincipal) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "oklch(var(--border))" }}
      >
        <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Contacts
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {others.length} registered user{others.length !== 1 ? "s" : ""} on
          CypherMessage
        </p>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div
            data-ocid="contacts.loading_state"
            className="flex items-center justify-center py-16"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : others.length === 0 ? (
          <div
            data-ocid="contacts.empty_state"
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <Users className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">
              No other users found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Invite friends to join CypherMessage!
            </p>
          </div>
        ) : (
          <div className="py-2">
            {others.map(([principal, username], idx) => (
              <div
                key={principal.toText()}
                data-ocid={`contacts.item.${idx + 1}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
              >
                <InitialsAvatar
                  name={username || truncatePrincipal(principal.toText())}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    @{username || "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {truncatePrincipal(principal.toText())}
                  </div>
                </div>
                <Button
                  data-ocid={`contacts.compose_button.${idx + 1}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => onComposeTo(username || principal.toText())}
                  className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Message
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
