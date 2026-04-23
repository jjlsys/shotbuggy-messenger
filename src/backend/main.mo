import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Nat64 "mo:core/Nat64";

import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";



actor {
  module User {
    public func compare(u1 : User, u2 : User) : Order.Order {
      switch (Text.compare(u1.username, u2.username)) {
        case (#equal) { Principal.compare(u1.principal, u2.principal) };
        case (order) { order };
      };
    };
    public func compareByPrincipal(u1 : User, u2 : User) : Order.Order {
      Principal.compare(u1.principal, u2.principal);
    };
  };

  module Message {
    public func compare(m1 : Message, m2 : Message) : Order.Order {
      Int.compare(m2.timestamp, m1.timestamp);
    };
  };

  module ThreadMessage {
    public func compareByTimestamp(m1 : Message, m2 : Message) : Order.Order {
      Int.compare(m1.timestamp, m2.timestamp);
    };
  };

  module Thread {
    public func compareByNewestMessage(t1 : [{ message : Message }], t2 : [{ message : Message }]) : Order.Order {
      switch (Text.compare(t1[0].message.subject, t2[0].message.subject)) {
        case (#equal) { Int.compare(t2[0].message.timestamp, t1[0].message.timestamp) };
        case (order) { order };
      };
    };
  };

  module ThreadMessageSummary {
    public func compareByTimestamp(s1 : ThreadMessageSummary, s2 : ThreadMessageSummary) : Order.Order {
      Int.compare(s2.latestMessage.timestamp, s1.latestMessage.timestamp);
    };
  };

  type User = {
    principal : Principal;
    username : Text;
    registrationTime : Time.Time;
  };

  type MessageId = Nat;

  type Attachment = {
    hash : Text;
    filename : Text;
    mimeType : Text;
    size : Nat;
  };

  // Payment metadata stored with a message (transfer is executed by frontend)
  type Payment = {
    token : Text;      // "ICP" or "SHBY"
    amount : Nat64;    // in e8s (1 ICP = 100_000_000 e8s)
    memo : ?Text;
  };

  // Legacy message type (before trash fields were added) - used for migration only
  type MessageV1 = {
    id : MessageId;
    threadId : Nat;
    subject : Text;
    body : Text;
    sender : Principal;
    recipient : Principal;
    timestamp : Time.Time;
    parentId : ?MessageId;
    isRead : Bool;
    deletedBySender : Bool;
    deletedByRecipient : Bool;
    attachments : [Attachment];
  };

  // V2: added trash fields
  type MessageV2 = {
    id : MessageId;
    threadId : Nat;
    subject : Text;
    body : Text;
    sender : Principal;
    recipient : Principal;
    timestamp : Time.Time;
    parentId : ?MessageId;
    isRead : Bool;
    deletedBySender : Bool;
    deletedByRecipient : Bool;
    trashedBySender : Bool;
    trashedByRecipient : Bool;
    attachments : [Attachment];
  };

  type Message = {
    id : MessageId;
    threadId : Nat;
    subject : Text;
    body : Text;
    sender : Principal;
    recipient : Principal;
    timestamp : Time.Time;
    parentId : ?MessageId;
    isRead : Bool;
    deletedBySender : Bool;
    deletedByRecipient : Bool;
    trashedBySender : Bool;
    trashedByRecipient : Bool;
    attachments : [Attachment];
    payment : ?Payment;
  };

  type ThreadMessage = {
    message : Message;
    replies : [ThreadMessage];
  };

  type ThreadMessageSummary = {
    threadId : Nat;
    messages : [Message];
    latestMessage : Message;
    totalMessages : Nat;
    unreadCount : Nat;
    subject : Text;
    participants : [Principal];
  };

  type MessageInput = {
    recipient : Principal;
    subject : Text;
    body : Text;
    parentId : ?MessageId;
    attachments : [Attachment];
    payment : ?Payment;
  };

  type MessageUpdate = {
    subject : ?Text;
    body : ?Text;
  };

  public type UserProfile = {
    principal : Principal;
    username : Text;
    registrationTime : Time.Time;
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinObjectStorage();

  var messageIdCounter = 0;
  var threadIdCounter = 0;
  let users = Map.empty<Principal, User>();
  let usernames = Map.empty<Text, Principal>();
  // `messages` keeps the stable variable name so the ICP runtime can load
  // on-chain data from the old deployment (which has the V1 Message shape).
  let messages = Map.empty<MessageId, MessageV1>();
  // V2 messages (with trash fields, no payment)
  let messagesNew = Map.empty<MessageId, MessageV2>();
  // V3 messages (with payment field) - current
  let messagesV3 = Map.empty<MessageId, Message>();

  let demoSubjects = [
    "Welcome!",
    "Project Update",
    "Question about meeting",
    "Thanks for your help",
    "Feedback request",
    "Reminder",
    "Documentation",
    "Bug report",
    "New features",
  ];
  let demoBodies = [
    "This is a sample message body.",
    "Let me know if you have any questions.",
    "Thanks!",
    "Please check the attached document.",
    "Looking forward to your response.",
    "Just wanted to follow up.",
    "Let me know if you need anything else.",
    "I really appreciate your support.",
    "Have a great day!",
    "This is a test message for demo purposes.",
  ];

  func getUserContext(caller : Principal, targetUsername : Text) : User {
    switch (users.get(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) { user };
    };
  };

  func getMessageContext(id : MessageId) : Message {
    switch (messagesV3.get(id)) {
      case (null) { Runtime.trap("Message not found: " # id.toText()) };
      case (?message) { message };
    };
  };

  // User Profile Functions (required by instructions)
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    switch (users.get(caller)) {
      case (null) { null };
      case (?user) {
        ?{
          principal = user.principal;
          username = user.username;
          registrationTime = user.registrationTime;
        };
      };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    if (profile.username != "") {
      switch (users.get(caller)) {
        case (null) {
          if (usernames.containsKey(profile.username)) {
            Runtime.trap("Username already taken");
          };
          let user : User = {
            principal = caller;
            username = profile.username;
            registrationTime = Time.now();
          };
          users.add(caller, user);
          usernames.add(profile.username, caller);
        };
        case (?existingUser) {
          if (existingUser.username != profile.username) {
            if (usernames.containsKey(profile.username)) {
              Runtime.trap("Username already taken");
            };
            usernames.remove(existingUser.username);
            usernames.add(profile.username, caller);
            users.add(caller, {
              existingUser with username = profile.username;
            });
          };
        };
      };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    switch (users.get(user)) {
      case (null) { null };
      case (?u) {
        ?{
          principal = u.principal;
          username = u.username;
          registrationTime = u.registrationTime;
        };
      };
    };
  };

  // Authentication functions
  public shared ({ caller }) func isAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // Admin-only debug functions
  public query ({ caller }) func getAllMessages() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort();
  };

  public query ({ caller }) func getAllMessagesBySender() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        Principal.compare(m1.sender, m2.sender);
      }
    );
  };

  public query ({ caller }) func getAllMessagesByRecipient() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        Principal.compare(m1.recipient, m2.recipient);
      }
    );
  };

  public query ({ caller }) func getAllMessagesByThread() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        Nat.compare(m1.threadId, m2.threadId);
      }
    );
  };

  public query ({ caller }) func getAllMessagesByTimestamp() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        Int.compare(m2.timestamp, m1.timestamp);
      }
    );
  };

  public query ({ caller }) func getAllMessagesBySubject() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        Text.compare(m1.subject, m2.subject);
      }
    );
  };

  public query ({ caller }) func getAllMessagesBySenderAndRecipient() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messagesV3.values().toArray().sort(
      func(m1, m2) {
        switch (Principal.compare(m1.sender, m2.sender)) {
          case (#equal) { Principal.compare(m1.recipient, m2.recipient) };
          case (order) { order };
        };
      }
    );
  };

  // User management
  public shared ({ caller }) func register(username : Text) : async () {
    if (username.size() < 3) { Runtime.trap("Username too short") };
    if (username.size() > 30) { Runtime.trap("Username too long") };

    func hasInvalidChar(username : Text) : Bool {
      username.chars().any(
        func(c) {
          not (
            c == '.' or c == '-' or c == '_' or
            ('0' <= c and c <= '9') or
            ('A' <= c and c <= 'Z') or
            ('a' <= c and c <= 'z')
          );
        }
      );
    };

    if (hasInvalidChar(username)) {
      Runtime.trap("Username contains invalid characters. Only a-z, A-Z, 0-9, '.', '-', '_' are allowed.");
    };

    if (users.containsKey(caller)) { Runtime.trap("Username already registered") };
    if (usernames.containsKey(username)) { Runtime.trap("Username already taken") };

    let user : User = {
      principal = caller;
      username;
      registrationTime = Time.now();
    };
    users.add(caller, user);
    usernames.add(username, caller);
  };

  public query ({ caller }) func isUsernameAvailable(username : Text) : async Bool {
    not users.containsKey(caller) and not usernames.containsKey(username);
  };

  public shared ({ caller }) func updateUsername(newUsername : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update usernames");
    };
    if (newUsername.size() < 3) { Runtime.trap("Username too short") };
    if (newUsername.size() > 30) { Runtime.trap("Username too long") };

    if (users.containsKey(caller)) {
      switch (users.get(caller)) {
        case (null) { Runtime.trap("User not found") };
        case (?user) {
          if (user.username == newUsername) { Runtime.trap("Username already in use") };
        };
      };
    };
    if (usernames.containsKey(newUsername)) { Runtime.trap("Username already taken") };
    let updateExisting = users.get(caller);
    switch (updateExisting) {
      case (null) { Runtime.trap("User not found") };
      case (?oldUser) {
        switch (usernames.get(oldUser.username)) {
          case (null) { Runtime.trap("Username not found") };
          case (_) {
            users.add(caller, { oldUser with username = newUsername });
            usernames.remove(oldUser.username);
            usernames.add(newUsername, caller);
          };
        };
      };
    };
  };

  func getNameTplIter() : Iter.Iter<(Principal, Text)> {
    users.values().map(
      func(user) { (user.principal, user.username) }
    );
  };

  public query ({ caller }) func getPrincipalByUsername(username : Text) : async Principal {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can lookup principals");
    };
    switch (usernames.get(username)) {
      case (null) { Runtime.trap("Username not found") };
      case (?principal) { principal };
    };
  };

  public query ({ caller }) func getUsernameByPrincipal(principal : Principal) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can lookup usernames");
    };
    switch (users.get(principal)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) { user.username };
    };
  };

  public query ({ caller }) func getOwnUsername() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view their username");
    };
    switch (users.get(caller)) {
      case (null) { Runtime.trap("User not registered") };
      case (?user) { user.username };
    };
  };

  public query ({ caller }) func getAllUsers() : async [(Principal, Text)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list all users");
    };
    getNameTplIter().toArray().sort(
      func(tuple1, tuple2) {
        Text.compare(tuple1.1, tuple2.1);
      }
    );
  };

  public query ({ caller }) func getAllUsersByPrincipal() : async [(Principal, Text)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list all users");
    };
    getNameTplIter().toArray().sort(
      func(tuple1, tuple2) {
        Principal.compare(tuple1.0, tuple2.0);
      }
    );
  };

  // Messaging
  public shared ({ caller }) func sendMessage(input : MessageInput) : async MessageId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send messages");
    };
    if (input.body.size() == 0) { Runtime.trap("Message body cannot be empty") };
    let threadId = switch (input.parentId) {
      case (null) { threadIdCounter += 1; threadIdCounter };
      case (?parentId) {
        switch (messagesV3.get(parentId)) {
          case (null) { Runtime.trap("Parent message not found") };
          case (?parentMessage) { parentMessage.threadId };
        };
      };
    };
    messageIdCounter += 1;
    let id = messageIdCounter;
    let message : Message = {
      id;
      threadId;
      subject = input.subject;
      body = input.body;
      sender = caller;
      recipient = input.recipient;
      timestamp = Time.now();
      parentId = input.parentId;
      isRead = false;
      deletedBySender = false;
      deletedByRecipient = false;
      trashedBySender = false;
      trashedByRecipient = false;
      attachments = input.attachments;
      payment = input.payment;
    };
    messagesV3.add(id, message);
    id;
  };

  public shared ({ caller }) func sendMessageWithReply(message : Message) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send messages");
    };
    ignore sendMessage(
      {
        recipient = message.recipient;
        subject = message.subject;
        body = message.body;
        parentId = ?message.id;
        attachments = message.attachments;
        payment = message.payment;
      }
    );
  };

  public shared ({ caller }) func replyToMessage(messageId : MessageId, subject : Text, body : Text) : async MessageId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send messages");
    };
    await sendMessage({
      recipient = getMessageContext(messageId).sender;
      subject;
      body;
      parentId = ?messageId;
      attachments = [];
      payment = null;
    });
  };

  public query ({ caller }) func getMessageById(id : MessageId) : async ?Message {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view messages");
    };
    switch (messagesV3.get(id)) {
      case (null) { null };
      case (?message) {
        if (message.sender == caller or message.recipient == caller) {
          ?message;
        } else {
          Runtime.trap("Unauthorized: Can only view your own messages");
        };
      };
    };
  };

  public query ({ caller }) func getInbox() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view inbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.recipient == caller and not message.deletedByRecipient and not message.trashedByRecipient }
    ).sort(ThreadMessage.compareByTimestamp);
  };

  public query ({ caller }) func getInboxBySender() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view inbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.recipient == caller and not message.deletedByRecipient and not message.trashedByRecipient }
    ).sort(
      func(m1, m2) {
        Principal.compare(m1.sender, m2.sender);
      }
    );
  };

  public query ({ caller }) func getInboxBySubject() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view inbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.recipient == caller and not message.deletedByRecipient and not message.trashedByRecipient }
    ).sort(
      func(m1, m2) {
        Text.compare(m1.subject, m2.subject);
      }
    );
  };

  public query ({ caller }) func getInboxByThread() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view inbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.recipient == caller and not message.deletedByRecipient and not message.trashedByRecipient }
    ).sort(
      func(m1, m2) {
        Nat.compare(m1.threadId, m2.threadId);
      }
    );
  };

  public query ({ caller }) func getOutbox() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view outbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.sender == caller and not message.deletedBySender and not message.trashedBySender }
    ).sort(ThreadMessage.compareByTimestamp);
  };

  public query ({ caller }) func getOutboxByRecipient() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view outbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.sender == caller and not message.deletedBySender and not message.trashedBySender }
    ).sort(
      func(m1, m2) {
        Principal.compare(m1.recipient, m2.recipient);
      }
    );
  };

  public query ({ caller }) func getOutboxBySubject() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view outbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.sender == caller and not message.deletedBySender and not message.trashedBySender }
    ).sort(
      func(m1, m2) {
        Text.compare(m1.subject, m2.subject);
      }
    );
  };

  public query ({ caller }) func getOutboxByThread() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view outbox");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.sender == caller and not message.deletedBySender and not message.trashedBySender }
    ).sort(
      func(m1, m2) {
        Nat.compare(m1.threadId, m2.threadId);
      }
    );
  };

  public query ({ caller }) func getThread(threadId : Nat) : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view threads");
    };
    messagesV3.values().toArray().filter(
      func(message) {
        message.threadId == threadId and
        (
          (message.sender == caller and not message.deletedBySender and not message.trashedBySender) or
          (message.recipient == caller and not message.deletedByRecipient and not message.trashedByRecipient)
        )
      }
    ).sort(ThreadMessage.compareByTimestamp);
  };

  public query ({ caller }) func getUnreadMessageCount() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view unread count");
    };
    messagesV3.values().toArray().filter(
      func(message) { message.recipient == caller and not message.isRead and not message.trashedByRecipient }
    ).size();
  };

  public shared ({ caller }) func markMessageAsRead(id : MessageId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can mark messages as read");
    };
    let updateMessage = messagesV3.get(id);
    switch (updateMessage) {
      case (null) { Runtime.trap("Message not found") };
      case (?message) {
        if (message.recipient != caller) { Runtime.trap("Not authorized") };
        messagesV3.add(id, { message with isRead = true });
      };
    };
  };

  public shared ({ caller }) func deleteMessage(id : MessageId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete messages");
    };
    switch (messagesV3.get(id)) {
      case (null) { /* Already deleted, nothing to do */ };
      case (?message) {
        if (caller == message.sender or caller == message.recipient) {
          messagesV3.remove(id);
        } else {
          Runtime.trap("Not authorized");
        };
      };
    };
  };

  // Delete all messages in a thread for the caller in one atomic call
  public shared ({ caller }) func deleteThread(threadId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete messages");
    };
    let toDelete = messagesV3.values().toArray().filter(
      func(message) {
        message.threadId == threadId and
        (message.sender == caller or message.recipient == caller)
      }
    );
    for (message in toDelete.vals()) {
      messagesV3.remove(message.id);
    };
  };

  // Move a thread to trash (soft delete)
  public shared ({ caller }) func trashThread(threadId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can trash messages");
    };
    let toTrash = messagesV3.values().toArray().filter(
      func(message) {
        message.threadId == threadId and
        (message.sender == caller or message.recipient == caller)
      }
    );
    for (message in toTrash.vals()) {
      if (message.sender == caller) {
        messagesV3.add(message.id, { message with trashedBySender = true });
      } else {
        messagesV3.add(message.id, { message with trashedByRecipient = true });
      };
    };
  };

  // Restore a thread from trash
  public shared ({ caller }) func restoreThread(threadId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can restore messages");
    };
    let toRestore = messagesV3.values().toArray().filter(
      func(message) {
        message.threadId == threadId and
        (message.sender == caller or message.recipient == caller)
      }
    );
    for (message in toRestore.vals()) {
      if (message.sender == caller) {
        messagesV3.add(message.id, { message with trashedBySender = false });
      } else {
        messagesV3.add(message.id, { message with trashedByRecipient = false });
      };
    };
  };

  // Get all trashed messages for the caller
  public query ({ caller }) func getTrash() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trash");
    };
    messagesV3.values().toArray().filter(
      func(message) {
        (message.sender == caller and message.trashedBySender) or
        (message.recipient == caller and message.trashedByRecipient)
      }
    ).sort(ThreadMessage.compareByTimestamp);
  };

  // Empty the entire trash for the caller (permanently delete trashed messages)
  public shared ({ caller }) func emptyTrash() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can empty trash");
    };
    let toDelete = messagesV3.values().toArray().filter(
      func(message) {
        (message.sender == caller and message.trashedBySender) or
        (message.recipient == caller and message.trashedByRecipient)
      }
    );
    for (message in toDelete.vals()) {
      messagesV3.remove(message.id);
    };
  };

  public shared ({ caller }) func updateMessage(id : MessageId, updates : MessageUpdate) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update messages");
    };
    switch (messagesV3.get(id)) {
      case (null) { Runtime.trap("Message not found") };
      case (?message) {
        if (caller != message.sender) { Runtime.trap("Not authorized") };
        messagesV3.add(
          id,
          {
            message with
            subject = switch (updates.subject) {
              case (null) { message.subject };
              case (?s) { s };
            };
            body = switch (updates.body) {
              case (null) { message.body };
              case (?b) { b };
            };
          },
        );
      };
    };
  };

  public shared ({ caller }) func seedSampleMessages(recipient : ?Principal, count : ?Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can seed messages");
    };
    let countValue = switch (count) {
      case (null) { 10 };
      case (?c) { c };
    };
    let recipientValue = switch (recipient) {
      case (null) { caller };
      case (?r) { r };
    };
    var i = 0;
    while (i < countValue) {
      let subject = if (i < demoSubjects.size()) {
        demoSubjects[i % demoSubjects.size()];
      } else {
        "Sample message " # i.toText();
      };
      let body = if (i < demoBodies.size()) {
        demoBodies[i % demoBodies.size()];
      } else {
        "This is sample message # " # i.toText();
      };
      ignore sendMessage({
        recipient = recipientValue;
        subject;
        body;
        parentId = null;
        attachments = [];
        payment = null;
      });
      i += 1;
    };
  };

  public shared ({ caller }) func seedReplyChain(count : ?Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can seed messages");
    };
    let countValue = switch (count) {
      case (null) { 5 };
      case (?c) { c };
    };
    var i = 0;
    var parentId : ?MessageId = null;
    while (i < countValue) {
      let subject = "Reply chain message # " # i.toText();
      let body = "This is reply # " # i.toText();
      let id = await sendMessage({
        recipient = caller;
        subject;
        body;
        parentId;
        attachments = [];
        payment = null;
      });
      parentId := ?id;
      i += 1;
    };
  };

  public shared ({ caller }) func markAllMessagesAsRead() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can mark messages as read");
    };
    for (message in messagesV3.values()) {
      if (message.recipient == caller and not message.isRead) {
        ignore markMessageAsRead(message.id);
      };
    };
  };

  public shared ({ caller }) func deleteAllMessages() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete messages");
    };
    let toDelete = messagesV3.values().toArray().filter(
      func(message) { message.sender == caller or message.recipient == caller }
    );
    for (message in toDelete.vals()) {
      messagesV3.remove(message.id);
    };
  };

  public query ({ caller }) func getAllThreads() : async [ThreadMessageSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view threads");
    };
    let threadMessages = Map.empty<Nat, [Message]>();

    for (message in messagesV3.values()) {
      switch (threadMessages.get(message.threadId)) {
        case (null) {
          threadMessages.add(message.threadId, [message]);
        };
        case (?existingMessages) {
          threadMessages.add(message.threadId, existingMessages.concat([message]));
        };
      }
    };

    threadMessages.values().toArray().filter(
      func(messages) {
        messages.size() > 0 and (messages[0].sender == caller or messages[0].recipient == caller);
      }
    ).map<[Message], ThreadMessageSummary>(
      func(messages) {
        {
          threadId = if (messages.size() > 0) { messages[0].threadId } else { 0 };
          messages;
          latestMessage = messages[0];
          totalMessages = messages.size();
          unreadCount = messages.filter(func(message) { not message.isRead }).size();
          subject = if (messages.size() > 0) { messages[0].subject } else { "" };
          participants = messages.map(
            func(message) { message.sender }
          ).concat(messages.map(
            func(message) { message.recipient }
          ));
        };
      }
    ).filter(
      func(threadSummary) {
        threadSummary.participants.filter(
          func(participant) { participant == caller }
        ).size() > 0 and threadSummary.subject != "";
      }
    ).sort(ThreadMessageSummary.compareByTimestamp);
  };

  public query ({ caller }) func getAllThreadsByTimestamp() : async [ThreadMessageSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all threads");
    };
    let threadMessages = Map.empty<Nat, [Message]>();

    for (message in messagesV3.values()) {
      switch (threadMessages.get(message.threadId)) {
        case (null) {
          threadMessages.add(message.threadId, [message]);
        };
        case (?existingMessages) {
          threadMessages.add(message.threadId, existingMessages.concat([message]));
        };
      }
    };

    threadMessages.values().toArray().map<[Message], ThreadMessageSummary>(
      func(messages) {
        {
          threadId = if (messages.size() > 0) { messages[0].threadId } else { 0 };
          messages;
          latestMessage = messages[0];
          totalMessages = messages.size();
          unreadCount = messages.filter(func(message) { not message.isRead }).size();
          subject = if (messages.size() > 0) { messages[0].subject } else { "" };
          participants = messages.map(
            func(message) { message.sender }
          ).concat(messages.map(
            func(message) { message.recipient }
          ));
        };
      }
    );
  };

  public query ({ caller }) func getAllThreadsBySubject() : async [ThreadMessageSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view threads");
    };
    let threadMessages = Map.empty<Nat, [Message]>();

    for (message in messagesV3.values()) {
      switch (threadMessages.get(message.threadId)) {
        case (null) {
          threadMessages.add(message.threadId, [message]);
        };
        case (?existingMessages) {
          threadMessages.add(message.threadId, existingMessages.concat([message]));
        };
      }
    };

    threadMessages.values().toArray().filter(
      func(messages) {
        messages.size() > 0 and (messages[0].sender == caller or messages[0].recipient == caller);
      }
    ).map<[Message], ThreadMessageSummary>(
      func(messages) {
        {
          threadId = if (messages.size() > 0) { messages[0].threadId } else { 0 };
          messages;
          latestMessage = messages[0];
          totalMessages = messages.size();
          unreadCount = messages.filter(func(message) { not message.isRead }).size();
          subject = if (messages.size() > 0) { messages[0].subject } else { "" };
          participants = messages.map(
            func(message) { message.sender }
          ).concat(messages.map(
            func(message) { message.recipient }
          ));
        };
      }
    ).filter(
      func(threadSummary) {
        threadSummary.participants.filter(
          func(participant) { participant == caller }
        ).size() > 0 and threadSummary.subject != "";
      }
    ).sort(
      func(s1, s2) {
        switch (Text.compare(s1.subject, s2.subject)) {
          case (#equal) { Int.compare(s2.latestMessage.timestamp, s1.latestMessage.timestamp) };
          case (order) { order };
        };
      }
    );
  };

  // New getConversation function
  public query ({ caller }) func getConversation(partner : Principal) : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view conversations");
    };
    messagesV3.values().toArray().filter(
      func(message) { (message.sender == caller and message.recipient == partner) or (message.sender == partner and message.recipient == caller) }
    ).sort(ThreadMessage.compareByTimestamp);
  };

  // Migrate any V1 and V2 messages into messagesV3 (current format with payment field)
  system func postupgrade() {
    // Migrate V1 (no trash, no payment)
    for ((id, m) in messages.entries()) {
      if (not messagesV3.containsKey(id)) {
        messagesV3.add(id, {
          id = m.id;
          threadId = m.threadId;
          subject = m.subject;
          body = m.body;
          sender = m.sender;
          recipient = m.recipient;
          timestamp = m.timestamp;
          parentId = m.parentId;
          isRead = m.isRead;
          deletedBySender = m.deletedBySender;
          deletedByRecipient = m.deletedByRecipient;
          trashedBySender = false;
          trashedByRecipient = false;
          attachments = m.attachments;
          payment = null;
        });
      };
    };
    // Migrate V2 (has trash, no payment)
    for ((id, m) in messagesNew.entries()) {
      if (not messagesV3.containsKey(id)) {
        messagesV3.add(id, {
          id = m.id;
          threadId = m.threadId;
          subject = m.subject;
          body = m.body;
          sender = m.sender;
          recipient = m.recipient;
          timestamp = m.timestamp;
          parentId = m.parentId;
          isRead = m.isRead;
          deletedBySender = m.deletedBySender;
          deletedByRecipient = m.deletedByRecipient;
          trashedBySender = m.trashedBySender;
          trashedByRecipient = m.trashedByRecipient;
          attachments = m.attachments;
          payment = null;
        });
      };
    };
    // Clear old stores after migration
    let toRemoveV1 = messages.keys().toArray();
    for (id in toRemoveV1.vals()) {
      messages.remove(id);
    };
    let toRemoveV2 = messagesNew.keys().toArray();
    for (id in toRemoveV2.vals()) {
      messagesNew.remove(id);
    };
  };

};
