"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlinePlus,
  HiOutlinePaperAirplane,
  HiOutlinePhoto,
  HiOutlineMagnifyingGlass,
  HiOutlineMegaphone,
} from "react-icons/hi2";
import Image from "next/image";
import { usePermission } from "@/hooks/use-permission";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { shouldNotifyForChatMessage } from "@/modules/chat/client";

interface ChatUser {
  id: string;
  name: string | null;
  image: string | null;
  email?: string;
  department?: string;
  site?: string;
}

interface ChatMessage {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  senderId: string;
  senderName: string | null;
  senderImage?: string | null;
  createdAt: string;
  isOwn: boolean;
}

interface ChatConversation {
  id: string;
  name: string;
  image?: string | null;
  isGlobal: boolean;
  participants: ChatUser[];
  lastMessage?: {
    content: string | null;
    senderName: string | null;
    createdAt: string;
  } | null;
  hasUnread: boolean;
  unreadCount?: number;
  updatedAt: string;
}

// Spinner component
const Spinner = ({ className = "" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default function ChatPageClient() {
  // Permission checks - sesuai workflow RBAC
  const { hasPermission } = usePermission();
  const canSendMessage = hasPermission("chat:create");
  const canBroadcast = hasPermission("broadcast:create");

  // State for conversations
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [globalChat, setGlobalChat] = useState<{
    id: string;
    name: string;
    participantCount: number;
  } | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);

  // State for messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationInfo, setConversationInfo] = useState<{
    name?: string;
    image?: string | null;
    isGlobal?: boolean;
    participants?: ChatUser[];
  } | null>(null);

  // State for input
  const [messageInput, setMessageInput] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // State for loading
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingMessages]);

  // State for modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [newChatUsers, setNewChatUsers] = useState<ChatUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const [convResponse, globalResponse] = await Promise.all([
        fetch("/api/admin/chat/conversations"),
        fetch("/api/admin/chat/global"),
      ]);

      if (convResponse.ok) {
        const convData = await convResponse.json();
        setConversations(
          convData.data.filter((c: ChatConversation) => !c.isGlobal),
        );
      }

      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        setGlobalChat(globalData.data);
      }
    } catch (error) {
      clientLogger.error("Error loading conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const lastMessageIdRef = useRef<string | null>(null);

  // Request notification permission
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = useCallback(
    async (type: "default" | "chat" = "default") => {
      try {
        // Check global enable setting
        const soundEnabled = localStorage.getItem("chat_sound_enabled");
        if (soundEnabled === "false") return;

        // Check preferred sound source
        const soundType = localStorage.getItem("chat_sound_type");
        const customData = localStorage.getItem("chat_custom_sound_data");

        let src = "/sounds/notification.mp3"; // Absolute fallback

        // Priority: LocalStorage Custom -> LocalStorage Default -> Chat Argument -> Default
        if (soundType === "custom" && customData) {
          src = customData;
        } else if (soundType === "default") {
          src = "/sounds/notification.mp3";
        } else if (type === "chat") {
          src = "/sounds/notification.mp3";
        }

        let audioSrc = src;
        // Use Blob for large Data URIs to prevent playback errors
        if (src.startsWith("data:")) {
          try {
            const base64ToBlob = (dataURI: string) => {
              const split = dataURI.split(",");
              const base64 = split[1] ?? "";
              const byteString = atob(base64);
              const mimeString =
                split[0]?.split(":")[1]?.split(";")[0] ??
                "application/octet-stream";
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              return new Blob([ab], { type: mimeString });
            };

            const blob = base64ToBlob(src);
            audioSrc = URL.createObjectURL(blob);
          } catch (e) {
            clientLogger.error("Failed to convert data URI to blob:", e);
            // Fallback to original src if blob fails
          }
        }

        const audio = new Audio(audioSrc);

        audio.onended = () => {
          if (src.startsWith("data:") && audioSrc !== src) {
            URL.revokeObjectURL(audioSrc);
          }
        };

        // Fallback for file paths (not data URIs)
        if (!src.startsWith("data:")) {
          audio.onerror = () => {
            if (src === "/sounds/chat.mp3") {
              clientLogger.info(
                "[Chat] chat.mp3 not found, falling back to default",
              );
              new Audio("/sounds/notification.mp3")
                .play()
                .catch((e) => clientLogger.error("Fallback audio failed:", e));
            }
          };
        }

        await audio.play();
      } catch (e) {
        clientLogger.error("Audio init/play failed:", e);
      }
    },
    [],
  );

  const showBrowserNotification = (sender: string, content: string) => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(`Pesan baru dari ${sender}`, {
        body: content,
        icon: "/icon-192x192.png",
      });
    }
  };

  // Load messages for selected conversation
  const loadMessages = useCallback(
    async (conversationId: string, silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const response = await fetch(
          `/api/admin/chat/conversations/${conversationId}`,
        );
        if (response.ok) {
          const data = await response.json();
          const newMessages = data.data.messages.reverse(); // Reverse to show oldest first

          setMessages(newMessages);
          setConversationInfo(data.data.conversation);

          // Handle notifications only during silent updates (polling)
          if (silent && newMessages.length > 0) {
            const latestMsg = newMessages[newMessages.length - 1];
            clientLogger.info("[Chat] Polling check:", {
              latestId: latestMsg.id,
              trackedId: lastMessageIdRef.current,
              isOwn: latestMsg.isOwn,
            });

            // Verify correct condition: new ID, not own message, and different from last tracked
            if (latestMsg.id !== lastMessageIdRef.current && !latestMsg.isOwn) {
              clientLogger.info("[Chat] TRIGGERING NOTIFICATION");
              playNotificationSound("chat");
              showBrowserNotification(
                latestMsg.senderName || "User",
                latestMsg.content || "Mengirim gambar",
              );
            }
          }

          // Update tracker
          if (newMessages.length > 0) {
            lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
          } else {
            lastMessageIdRef.current = null;
          }
        }
      } catch (error) {
        clientLogger.error("Error loading messages:", error);
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [playNotificationSound],
  );

  // Send message
  const sendMessage = async () => {
    if (!selectedConversation || !messageInput.trim() || !canSendMessage)
      return;

    setSendingMessage(true);
    try {
      const response = await fetch(
        `/api/admin/chat/conversations/${selectedConversation}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageInput }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, data.data]);
        setMessageInput("");
        loadConversations(); // Refresh conversation list
      }
    } catch (error) {
      clientLogger.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Search users for new chat
  const searchUsers = useCallback(async (query: string) => {
    setSearchingUsers(true);
    try {
      const response = await fetch(
        `/api/admin/chat/users?search=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setNewChatUsers(data.data);
      }
    } catch (error) {
      clientLogger.error("Error searching users:", error);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  // Create new conversation
  const createConversation = async () => {
    if (selectedUsers.length === 0 || !canSendMessage) return;

    try {
      const response = await fetch("/api/admin/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedUsers }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.data.id);
        setShowNewChatModal(false);
        setSelectedUsers([]);
        loadConversations();
        loadMessages(data.data.id);
      }
    } catch (error) {
      clientLogger.error("Error creating conversation:", error);
    }
  };

  // Send broadcast
  const sendBroadcast = async () => {
    if (!broadcastContent.trim() || !canBroadcast) return;

    setSendingBroadcast(true);
    try {
      const response = await fetch("/api/admin/chat/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: broadcastTitle,
          content: broadcastContent,
        }),
      });

      if (response.ok) {
        setShowBroadcastModal(false);
        setBroadcastTitle("");
        setBroadcastContent("");
        loadConversations();
        // Open global chat to see the broadcast
        if (globalChat) {
          setSelectedConversation(globalChat.id);
          loadMessages(globalChat.id);
        }
      }
    } catch (error) {
      clientLogger.error("Error sending broadcast:", error);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Effects
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, loadMessages]);

  useEffect(() => {
    if (userSearchInput) {
      const timeout = setTimeout(() => searchUsers(userSearchInput), 300);
      return () => clearTimeout(timeout);
    } else {
      searchUsers("");
    }
  }, [userSearchInput, searchUsers]);

  const handleNewMessage = useCallback(
    (payload: ChatMessage & { conversationId: string }) => {
      if (
        shouldNotifyForChatMessage({
          isOwnMessage: Boolean(payload.isOwn),
          selectedConversationId: selectedConversation,
          incomingConversationId: payload.conversationId,
        })
      ) {
        playNotificationSound("chat");
        showBrowserNotification(
          payload.senderName || "User",
          payload.content || "Gambar",
        );
      }

      if (selectedConversation === payload.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        lastMessageIdRef.current = payload.id;
      }

      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === payload.conversationId);
        if (index !== -1) {
          const currentConv = prev[index];
          if (!currentConv) return prev;

          const updatedConv: ChatConversation = {
            ...currentConv,
            lastMessage: {
              content:
                payload.content ||
                (payload.imageUrl ? "📷 Gambar" : "Pesan baru"),
              senderName: payload.senderName || "User",
              createdAt: payload.createdAt,
            },
            updatedAt: payload.createdAt,
            hasUnread: selectedConversation !== payload.conversationId,
            unreadCount:
              selectedConversation === payload.conversationId
                ? 0
                : (currentConv.unreadCount || 0) + 1,
          };
          const newConvs = [...prev];
          newConvs.splice(index, 1);
          return [updatedConv, ...newConvs];
        }

        loadConversations();
        return prev;
      });
    },
    [selectedConversation, loadConversations, playNotificationSound],
  );

  useRealtimeEvent<ChatMessage & { conversationId: string }>(
    "chat.message",
    handleNewMessage,
  );

  // Filtered conversations
  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchInput.toLowerCase()),
  );

  return (
    <div className="h-[calc(100vh-120px)] flex bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Chat
            </h2>
            <div className="flex gap-2">
              {/* Broadcast button - only show if has permission */}
              {canBroadcast && (
                <Button
                  variant="warning"
                  size="icon"
                  onClick={() => setShowBroadcastModal(true)}
                  title="Broadcast"
                >
                  <HiOutlineMegaphone className="w-5 h-5" />
                </Button>
              )}
              {/* New chat button - only show if can send message */}
              {canSendMessage && (
                <Button
                  size="icon"
                  onClick={() => setShowNewChatModal(true)}
                  title="New Chat"
                >
                  <HiOutlinePlus className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari percakapan..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center h-32">
              <Spinner className="text-purple-500 w-6 h-6" />
            </div>
          ) : (
            <>
              {/* Global Chat */}
              {globalChat && (
                <button
                  onClick={() => setSelectedConversation(globalChat.id)}
                  className={`w-full flex items-center gap-3 p-4 border-b-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition ${
                    selectedConversation === globalChat.id
                      ? "bg-purple-100 dark:bg-purple-900/50"
                      : "bg-purple-50 dark:bg-purple-900/20"
                  }`}
                >
                  <div className="h-12 w-12 rounded-full bg-purple-500 dark:bg-purple-600 flex items-center justify-center">
                    <HiOutlineGlobeAlt className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-purple-900 dark:text-purple-100">
                      Global Chat
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <HiOutlineUserGroup className="w-4 h-4" />
                      {globalChat.participantCount} anggota
                    </div>
                  </div>
                </button>
              )}

              {/* Other Conversations */}
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                    selectedConversation === conv.id
                      ? "bg-gray-100 dark:bg-gray-700"
                      : ""
                  }`}
                >
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <HiOutlineChatBubbleLeftRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {conv.name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(
                            new Date(conv.lastMessage.createdAt),
                            { addSuffix: true, locale: idLocale },
                          )}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        <span className="font-medium">
                          {conv.lastMessage.senderName}:{" "}
                        </span>
                        {conv.lastMessage.content}
                      </div>
                    )}
                  </div>
                  {conv.hasUnread && (
                    <div className="h-3 w-3 rounded-full bg-purple-500 dark:bg-purple-400" />
                  )}
                </button>
              ))}

              {filteredConversations.length === 0 && !loadingConversations && (
                <div className="text-center py-8 text-gray-500">
                  <HiOutlineChatBubbleLeftRight className="mx-auto mb-2 opacity-50 w-12 h-12" />
                  <p>Belum ada percakapan</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    conversationInfo?.isGlobal
                      ? "bg-purple-500 dark:bg-purple-600"
                      : "bg-purple-100 dark:bg-purple-900"
                  }`}
                >
                  {conversationInfo?.isGlobal ? (
                    <HiOutlineGlobeAlt className="w-5 h-5 text-white" />
                  ) : (
                    <HiOutlineChatBubbleLeftRight className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {conversationInfo?.name || "Chat"}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {conversationInfo?.participants?.length || 0} peserta
                  </p>
                </div>
              </div>
            </div>
            {/* Header */}
            {selectedConversation && conversationInfo && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="relative w-10 h-10">
                    {conversationInfo.image ? (
                      <Image
                        src={conversationInfo.image}
                        alt={conversationInfo.name || "Conversation"}
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <HiOutlineUserGroup className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    {conversationInfo.isGlobal && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 dark:bg-blue-400 rounded-full p-0.5">
                        <HiOutlineGlobeAlt className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {conversationInfo.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {conversationInfo.isGlobal
                        ? "Broadcast Channel"
                        : "Conversation"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      playNotificationSound("chat");
                      showBrowserNotification(
                        "Test System",
                        "Ini adalah tes notifikasi suara dan visual.",
                      );
                      alert(
                        "Tes notifikasi dikirim. Jika tidak bunyi chat.mp3, akan fallback ke notification.mp3",
                      );
                    }}
                    title="Test Notification"
                  >
                    <span className="text-xl">🔔</span>
                  </Button>

                  {hasPermission("broadcast:create") && (
                    <Button
                      onClick={() => setShowBroadcastModal(true)}
                      size="sm"
                    >
                      Broadcast
                    </Button>
                  )}
                </div>
              </div>
            )}
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner className="text-purple-500 w-8 h-8" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] ${msg.isOwn ? "order-2" : "order-1"}`}
                    >
                      {!msg.isOwn && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
                          {msg.senderName}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          msg.isOwn
                            ? "bg-purple-500 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
                        }`}
                      >
                        {msg.imageUrl && (
                          <div className="relative w-full max-w-[300px] aspect-square mb-2">
                            <Image
                              src={msg.imageUrl}
                              alt="Chat image"
                              fill
                              className="rounded-lg object-cover"
                            />
                          </div>
                        )}
                        {msg.content && (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      <div
                        className={`text-xs text-gray-400 mt-1 ${msg.isOwn ? "text-right mr-1" : "ml-1"}`}
                      >
                        {formatDistanceToNow(new Date(msg.createdAt), {
                          addSuffix: true,
                          locale: idLocale,
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input - only show if can send */}
            {canSendMessage && (
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-purple-500"
                  >
                    <HiOutlinePhoto className="w-6 h-6" />
                  </Button>
                  <input
                    type="text"
                    placeholder="Ketik pesan..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && sendMessage()
                    }
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sendingMessage}
                    loading={sendingMessage}
                  >
                    <HiOutlinePaperAirplane className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <HiOutlineChatBubbleLeftRight className="mx-auto mb-4 opacity-50 w-16 h-16" />
              <p className="text-lg">Pilih percakapan untuk mulai chat</p>
              {canSendMessage && (
                <p className="text-sm mt-2">
                  Atau buat chat baru dengan tombol + di sidebar
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Modal
        isOpen={showNewChatModal && canSendMessage}
        onClose={() => setShowNewChatModal(false)}
        title="Chat Baru"
        size="md"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={userSearchInput}
            onChange={(e) => setUserSearchInput(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
          />
          <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
            {searchingUsers ? (
              <div className="text-center py-4">
                <Spinner className="mx-auto text-purple-500 w-6 h-6" />
              </div>
            ) : newChatUsers.length > 0 ? (
              newChatUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    if (selectedUsers.includes(user.id)) {
                      setSelectedUsers((prev) =>
                        prev.filter((id) => id !== user.id),
                      );
                    } else {
                      setSelectedUsers((prev) => [...prev, user.id]);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                    selectedUsers.includes(user.id)
                      ? "bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-500"
                      : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent"
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-semibold">
                    {user.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {user.department || user.email}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Tidak ada user ditemukan</p>
              </div>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button
            onClick={createConversation}
            disabled={selectedUsers.length === 0}
            className="w-full"
          >
            Mulai Chat ({selectedUsers.length} dipilih)
          </Button>
        </ModalFooter>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        isOpen={showBroadcastModal && canBroadcast}
        onClose={() => setShowBroadcastModal(false)}
        title="Broadcast"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul (opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Pengumuman Penting"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pesan
            </label>
            <textarea
              placeholder="Tulis pesan broadcast..."
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 resize-none"
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            📢 Pesan akan dikirim ke Global Chat dan notifikasi ke semua user
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="warning"
            onClick={sendBroadcast}
            disabled={!broadcastContent.trim() || sendingBroadcast}
            loading={sendingBroadcast}
            className="w-full"
          >
            <HiOutlineMegaphone className="w-5 h-5" />
            Kirim Broadcast
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
