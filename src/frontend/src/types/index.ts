import type { Principal } from "@icp-sdk/core/principal";

export interface Attachment {
  hash: string;
  filename: string;
  mimeType: string;
  size: bigint;
}

export interface Payment {
  token: string;
  amount: bigint;
  memo: [] | [string];
}

export interface Message {
  id: bigint;
  threadId: bigint;
  subject: string;
  body: string;
  sender: Principal;
  recipient: Principal;
  timestamp: bigint;
  parentId: [] | [bigint];
  isRead: boolean;
  deletedBySender: boolean;
  deletedByRecipient: boolean;
  trashedBySender: boolean;
  trashedByRecipient: boolean;
  attachments: Attachment[];
  payment: [] | [Payment];
}

export interface MessageInput {
  recipient: Principal;
  subject: string;
  body: string;
  parentId: bigint | undefined;
  attachments: Attachment[];
  payment:
    | {
        token: string;
        amount: bigint;
        memo: string | undefined;
      }
    | undefined;
}

export interface UserProfile {
  principal: Principal;
  username: string;
  registrationTime: bigint;
}
