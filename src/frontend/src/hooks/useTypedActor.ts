import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { createActor } from "../backend";
import type { Attachment, Message, Payment, UserProfile } from "../types";

// The full typed actor interface matching the backend methods
export interface BackendActor {
  getCallerUserProfile(): Promise<UserProfile | null>;
  getAllUsers(): Promise<Array<[Principal, string]>>;
  getInbox(): Promise<Message[]>;
  getOutbox(): Promise<Message[]>;
  getThread(threadId: bigint): Promise<Message[]>;
  getTrash(): Promise<Message[]>;
  getUnreadMessageCount(): Promise<bigint>;
  sendMessage(input: {
    recipient: Principal;
    subject: string;
    body: string;
    parentId?: bigint;
    attachments: Attachment[];
    payment?: {
      token: string;
      amount: bigint;
      memo?: string;
    };
  }): Promise<bigint>;
  replyToMessage(
    messageId: bigint,
    subject: string,
    body: string,
  ): Promise<bigint>;
  markMessageAsRead(id: bigint): Promise<void>;
  markAllMessagesAsRead(): Promise<void>;
  deleteMessage(id: bigint): Promise<void>;
  deleteThread(threadId: bigint): Promise<void>;
  trashThread(threadId: bigint): Promise<void>;
  restoreThread(threadId: bigint): Promise<void>;
  emptyTrash(): Promise<void>;
  register(username: string): Promise<void>;
  updateUsername(newUsername: string): Promise<void>;
  getPrincipalByUsername(username: string): Promise<Principal>;
  isUsernameAvailable(username: string): Promise<boolean>;
  seedSampleMessages(
    recipient: Principal | null,
    count: bigint | null,
  ): Promise<void>;
}

// Suppress unused import warnings — these types are used by consumers of this module
type _unused = Attachment | Payment | UserProfile;

export function useTypedActor() {
  const { actor, isFetching } = useActor(createActor);
  return {
    actor: actor as unknown as BackendActor | null,
    isFetching,
  };
}
