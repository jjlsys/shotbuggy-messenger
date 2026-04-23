import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Attachment, Message, UserProfile } from "../types";
import { useTypedActor } from "./useTypedActor";

export function useCallerUserProfile() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<UserProfile | null>({
    queryKey: ["callerUserProfile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useInbox() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<Message[]>({
    queryKey: ["inbox"],
    queryFn: async () => {
      if (!actor) return [];
      const msgs = await actor.getInbox();
      return msgs.sort((a, b) => Number(b.timestamp - a.timestamp));
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000,
  });
}

export function useOutbox() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<Message[]>({
    queryKey: ["outbox"],
    queryFn: async () => {
      if (!actor) return [];
      const msgs = await actor.getOutbox();
      return msgs.sort((a, b) => Number(b.timestamp - a.timestamp));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUnreadCount() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<bigint>({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getUnreadMessageCount();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000,
  });
}

export function useAllUsers() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<Array<[Principal, string]>>({
    queryKey: ["allUsers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllUsers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useThread(threadId: bigint | null) {
  const { actor, isFetching } = useTypedActor();
  return useQuery<Message[]>({
    queryKey: ["thread", threadId?.toString()],
    queryFn: async () => {
      if (!actor || threadId === null) return [];
      const msgs = await actor.getThread(threadId);
      return msgs.sort((a, b) => Number(a.timestamp - b.timestamp));
    },
    enabled: !!actor && !isFetching && threadId !== null,
  });
}

export function useTrash() {
  const { actor, isFetching } = useTypedActor();
  return useQuery<Message[]>({
    queryKey: ["trash"],
    queryFn: async () => {
      if (!actor) return [];
      const msgs = await actor.getTrash();
      return msgs.sort((a, b) => Number(b.timestamp - a.timestamp));
    },
    enabled: !!actor && !isFetching,
  });
}

interface SendMessageInput {
  recipient: Principal;
  subject: string;
  body: string;
  parentId: bigint | undefined;
  attachments: Attachment[];
  payment:
    | { token: string; amount: bigint; memo: string | undefined }
    | undefined;
}

export function useSendMessage() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!actor) throw new Error("Not connected");
      const paymentArg = input.payment
        ? {
            token: input.payment.token,
            amount: input.payment.amount,
            memo: input.payment.memo,
          }
        : undefined;
      return actor.sendMessage({
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        parentId: input.parentId,
        attachments: input.attachments,
        payment: paymentArg,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
}

export function useReplyToMessage() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      subject,
      body,
    }: {
      messageId: bigint;
      subject: string;
      body: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.replyToMessage(messageId, subject, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
    },
  });
}

export function useMarkAsRead() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.markMessageAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
    },
  });
}

export function useMarkAllRead() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.markAllMessagesAsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
}

export function useDeleteMessage() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteMessage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

// For deleting multiple messages sequentially
export function useDeleteMessages() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: bigint[]) => {
      if (!actor) throw new Error("Not connected");
      for (const id of ids) {
        await actor.deleteMessage(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useDeleteThread() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: bigint) => {
      if (!actor) throw new Error("Not connected");
      await actor.deleteThread(threadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useTrashThread() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: bigint) => {
      if (!actor) throw new Error("Not connected");
      await actor.trashThread(threadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useRestoreThread() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: bigint) => {
      if (!actor) throw new Error("Not connected");
      await actor.restoreThread(threadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["thread"] });
    },
  });
}

export function useEmptyTrash() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      await actor.emptyTrash();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useRegister() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.register(username);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["callerUserProfile"] });
      await queryClient.refetchQueries({ queryKey: ["callerUserProfile"] });
    },
  });
}

export function useUpdateUsername() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateUsername(newUsername);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callerUserProfile"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
}

export function useSeedMessages() {
  const { actor } = useTypedActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.seedSampleMessages(null, 5n);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
}

export function useGetPrincipalByUsername() {
  const { actor } = useTypedActor();
  return async (username: string): Promise<Principal> => {
    if (!actor) throw new Error("Not connected");
    return actor.getPrincipalByUsername(username);
  };
}

export function useIsUsernameAvailable() {
  const { actor } = useTypedActor();
  return async (username: string): Promise<boolean> => {
    if (!actor) throw new Error("Not connected");
    return actor.isUsernameAvailable(username);
  };
}
