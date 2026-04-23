import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ThreadMessageSummary {
    participants: Array<Principal>;
    subject: string;
    messages: Array<Message>;
    totalMessages: bigint;
    unreadCount: bigint;
    latestMessage: Message;
    threadId: bigint;
}
export type Time = bigint;
export type MessageId = bigint;
export interface Attachment {
    hash: string;
    size: bigint;
    mimeType: string;
    filename: string;
}
export interface MessageUpdate {
    subject?: string;
    body?: string;
}
export interface Payment {
    token: string;
    memo?: string;
    amount: bigint;
}
export interface Message {
    id: MessageId;
    deletedBySender: boolean;
    deletedByRecipient: boolean;
    subject: string;
    body: string;
    recipient: Principal;
    trashedByRecipient: boolean;
    isRead: boolean;
    sender: Principal;
    timestamp: Time;
    threadId: bigint;
    parentId?: MessageId;
    trashedBySender: boolean;
    attachments: Array<Attachment>;
    payment?: Payment;
}
export interface MessageInput {
    subject: string;
    body: string;
    recipient: Principal;
    parentId?: MessageId;
    attachments: Array<Attachment>;
    payment?: Payment;
}
export interface UserProfile {
    principal: Principal;
    username: string;
    registrationTime: Time;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteAllMessages(): Promise<void>;
    deleteMessage(id: MessageId): Promise<void>;
    deleteThread(threadId: bigint): Promise<void>;
    emptyTrash(): Promise<void>;
    getAllMessages(): Promise<Array<Message>>;
    getAllMessagesByRecipient(): Promise<Array<Message>>;
    getAllMessagesBySender(): Promise<Array<Message>>;
    getAllMessagesBySenderAndRecipient(): Promise<Array<Message>>;
    getAllMessagesBySubject(): Promise<Array<Message>>;
    getAllMessagesByThread(): Promise<Array<Message>>;
    getAllMessagesByTimestamp(): Promise<Array<Message>>;
    getAllThreads(): Promise<Array<ThreadMessageSummary>>;
    getAllThreadsBySubject(): Promise<Array<ThreadMessageSummary>>;
    getAllThreadsByTimestamp(): Promise<Array<ThreadMessageSummary>>;
    getAllUsers(): Promise<Array<[Principal, string]>>;
    getAllUsersByPrincipal(): Promise<Array<[Principal, string]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getConversation(partner: Principal): Promise<Array<Message>>;
    getInbox(): Promise<Array<Message>>;
    getInboxBySender(): Promise<Array<Message>>;
    getInboxBySubject(): Promise<Array<Message>>;
    getInboxByThread(): Promise<Array<Message>>;
    getMessageById(id: MessageId): Promise<Message | null>;
    getOutbox(): Promise<Array<Message>>;
    getOutboxByRecipient(): Promise<Array<Message>>;
    getOutboxBySubject(): Promise<Array<Message>>;
    getOutboxByThread(): Promise<Array<Message>>;
    getOwnUsername(): Promise<string>;
    getPrincipalByUsername(username: string): Promise<Principal>;
    getThread(threadId: bigint): Promise<Array<Message>>;
    getTrash(): Promise<Array<Message>>;
    getUnreadMessageCount(): Promise<bigint>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUsernameByPrincipal(principal: Principal): Promise<string>;
    isAdmin(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    isUsernameAvailable(username: string): Promise<boolean>;
    markAllMessagesAsRead(): Promise<void>;
    markMessageAsRead(id: MessageId): Promise<void>;
    register(username: string): Promise<void>;
    replyToMessage(messageId: MessageId, subject: string, body: string): Promise<MessageId>;
    restoreThread(threadId: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    seedReplyChain(count: bigint | null): Promise<void>;
    seedSampleMessages(recipient: Principal | null, count: bigint | null): Promise<void>;
    sendMessage(input: MessageInput): Promise<MessageId>;
    sendMessageWithReply(message: Message): Promise<void>;
    trashThread(threadId: bigint): Promise<void>;
    updateMessage(id: MessageId, updates: MessageUpdate): Promise<void>;
    updateUsername(newUsername: string): Promise<void>;
}
