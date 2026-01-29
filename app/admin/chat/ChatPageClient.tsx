'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { 
    HiOutlineChatBubbleLeftRight,
    HiOutlineUserGroup,
    HiOutlineGlobeAlt,
    HiOutlinePlus,
    HiOutlinePaperAirplane,
    HiOutlinePhoto,
    HiOutlineMagnifyingGlass,
    HiOutlineMegaphone,
    HiXMark,
} from 'react-icons/hi2'
import { usePermission } from '@/hooks/use-permission'
import { useSocket } from '@/lib/websocket/SocketContext'

interface ChatUser {
    id: string
    name: string | null
    image: string | null
    email?: string
    department?: string
    site?: string
}


interface ChatMessage {
    id: string
    content: string | null
    imageUrl?: string | null
    senderId: string
    senderName: string | null
    senderImage?: string | null
    createdAt: string
    isOwn: boolean
}

interface ChatConversation {
    id: string
    name: string
    image?: string | null
    isGlobal: boolean
    participants: ChatUser[]
    lastMessage?: {
        content: string | null
        senderName: string | null
        createdAt: string
    } | null
    hasUnread: boolean
    unreadCount?: number
    updatedAt: string
}

// Spinner component
const Spinner = ({ className = '' }: { className?: string }) => (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
)

export default function ChatPageClient() {
    const { socket } = useSocket()
    // Permission checks - sesuai workflow RBAC
    const { hasPermission } = usePermission()
    const canSendMessage = hasPermission('chat:create')
    const canBroadcast = hasPermission('broadcast:create')

    // State for conversations
    const [conversations, setConversations] = useState<ChatConversation[]>([])
    const [globalChat, setGlobalChat] = useState<{ id: string; name: string; participantCount: number } | null>(null)
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
    
    // State for messages
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [conversationInfo, setConversationInfo] = useState<{ name?: string; image?: string | null; isGlobal?: boolean; participants?: ChatUser[] } | null>(null)
    
    // State for input
    const [messageInput, setMessageInput] = useState('')
    const [searchInput, setSearchInput] = useState('')
    
    // State for loading
    const [loadingConversations, setLoadingConversations] = useState(true)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sendingMessage, setSendingMessage] = useState(false)

    // Ref for auto-scrolling
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom()
    }, [messages, loadingMessages])
    
    // State for modals
    const [showNewChatModal, setShowNewChatModal] = useState(false)
    const [showBroadcastModal, setShowBroadcastModal] = useState(false)
    const [newChatUsers, setNewChatUsers] = useState<ChatUser[]>([])
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [userSearchInput, setUserSearchInput] = useState('')
    const [searchingUsers, setSearchingUsers] = useState(false)
    
    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState('')
    const [broadcastContent, setBroadcastContent] = useState('')
    const [sendingBroadcast, setSendingBroadcast] = useState(false)

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const [convResponse, globalResponse] = await Promise.all([
                fetch('/api/admin/chat/conversations'),
                fetch('/api/admin/chat/global')
            ])
            
            if (convResponse.ok) {
                const convData = await convResponse.json()
                setConversations(convData.data.filter((c: ChatConversation) => !c.isGlobal))
            }
            
            if (globalResponse.ok) {
                const globalData = await globalResponse.json()
                setGlobalChat(globalData.data)
            }
        } catch (error) {
            console.error('Error loading conversations:', error)
        } finally {
            setLoadingConversations(false)
        }
    }, [])

    const lastMessageIdRef = useRef<string | null>(null)

    // Request notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    const playNotificationSound = async (type: 'default' | 'chat' = 'default') => {
        try {
            // Check global enable setting
            const soundEnabled = localStorage.getItem('chat_sound_enabled')
            if (soundEnabled === 'false') return

            // Check preferred sound source
            const soundType = localStorage.getItem('chat_sound_type')
            const customData = localStorage.getItem('chat_custom_sound_data')
            
            let src = '/sounds/notification.mp3' // Absolute fallback
            
            // Priority: LocalStorage Custom -> LocalStorage Default -> Chat Argument -> Default
            if (soundType === 'custom' && customData) {
                src = customData
            } else if (soundType === 'default') {
                src = '/sounds/notification.mp3'
            } else if (type === 'chat') {
                src = '/sounds/notification.mp3'
            }

            let audioSrc = src
            // Use Blob for large Data URIs to prevent playback errors
            if (src.startsWith('data:')) {
                try {
                    const base64ToBlob = (dataURI: string) => {
                        const split = dataURI.split(',')
                        const base64 = split[1] ?? ''
                        const byteString = atob(base64)
                        const mimeString = split[0]?.split(':')[1]?.split(';')[0] ?? 'application/octet-stream'
                        const ab = new ArrayBuffer(byteString.length)
                        const ia = new Uint8Array(ab)
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i)
                        }
                        return new Blob([ab], { type: mimeString })
                    }
                    
                    const blob = base64ToBlob(src)
                    audioSrc = URL.createObjectURL(blob)
                } catch (e) {
                    console.error('Failed to convert data URI to blob:', e)
                    // Fallback to original src if blob fails
                }
            }

            const audio = new Audio(audioSrc)
            
            audio.onended = () => {
                if (src.startsWith('data:') && audioSrc !== src) {
                    URL.revokeObjectURL(audioSrc)
                }
            }

            // Fallback for file paths (not data URIs)
            if (!src.startsWith('data:')) {
                audio.onerror = () => {
                    if (src === '/sounds/chat.mp3') {
                        console.log('[Chat] chat.mp3 not found, falling back to default')
                        new Audio('/sounds/notification.mp3').play().catch(e => console.error('Fallback audio failed:', e))
                    }
                }
            }

            await audio.play()
        } catch (e) {
            console.error('Audio init/play failed:', e)
        }
    }

    const showBrowserNotification = (sender: string, content: string) => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`Pesan baru dari ${sender}`, {
                body: content,
                icon: '/icon-192x192.png'
            })
        }
    }

    // Load messages for selected conversation
    const loadMessages = useCallback(async (conversationId: string, silent = false) => {
        if (!silent) setLoadingMessages(true)
        try {
            const response = await fetch(`/api/admin/chat/conversations/${conversationId}`)
            if (response.ok) {
                const data = await response.json()
                const newMessages = data.data.messages.reverse() // Reverse to show oldest first
                
                setMessages(newMessages)
                setConversationInfo(data.data.conversation)

                // Handle notifications only during silent updates (polling)
                if (silent && newMessages.length > 0) {
                    const latestMsg = newMessages[newMessages.length - 1]
                    console.log('[Chat] Polling check:', { latestId: latestMsg.id, trackedId: lastMessageIdRef.current, isOwn: latestMsg.isOwn })
                    
                    // Verify correct condition: new ID, not own message, and different from last tracked
                    if (latestMsg.id !== lastMessageIdRef.current && !latestMsg.isOwn) {
                        console.log('[Chat] TRIGGERING NOTIFICATION')
                        playNotificationSound('chat')
                        showBrowserNotification(latestMsg.senderName || 'User', latestMsg.content || 'Mengirim gambar')
                    }
                }
                
                // Update tracker
                if (newMessages.length > 0) {
                    lastMessageIdRef.current = newMessages[newMessages.length - 1].id
                } else {
                    lastMessageIdRef.current = null
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error)
        } finally {
            if (!silent) setLoadingMessages(false)
        }
    }, [])

    // Send message
    const sendMessage = async () => {
        if (!selectedConversation || !messageInput.trim() || !canSendMessage) return
        
        setSendingMessage(true)
        try {
            const response = await fetch(`/api/admin/chat/conversations/${selectedConversation}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: messageInput })
            })
            
            if (response.ok) {
                const data = await response.json()
                setMessages(prev => [...prev, data.data])
                setMessageInput('')
                loadConversations() // Refresh conversation list
            }
        } catch (error) {
            console.error('Error sending message:', error)
        } finally {
            setSendingMessage(false)
        }
    }

    // Search users for new chat
    const searchUsers = async (query: string) => {
        setSearchingUsers(true)
        try {
            const response = await fetch(`/api/admin/chat/users?search=${encodeURIComponent(query)}`)
            if (response.ok) {
                const data = await response.json()
                setNewChatUsers(data.data)
            }
        } catch (error) {
            console.error('Error searching users:', error)
        } finally {
            setSearchingUsers(false)
        }
    }

    // Create new conversation
    const createConversation = async () => {
        if (selectedUsers.length === 0 || !canSendMessage) return
        
        try {
            const response = await fetch('/api/admin/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantIds: selectedUsers })
            })
            
            if (response.ok) {
                const data = await response.json()
                setSelectedConversation(data.data.id)
                setShowNewChatModal(false)
                setSelectedUsers([])
                loadConversations()
                loadMessages(data.data.id)
            }
        } catch (error) {
            console.error('Error creating conversation:', error)
        }
    }

    // Send broadcast
    const sendBroadcast = async () => {
        if (!broadcastContent.trim() || !canBroadcast) return
        
        setSendingBroadcast(true)
        try {
            const response = await fetch('/api/admin/chat/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: broadcastTitle, content: broadcastContent })
            })
            
            if (response.ok) {
                setShowBroadcastModal(false)
                setBroadcastTitle('')
                setBroadcastContent('')
                loadConversations()
                // Open global chat to see the broadcast
                if (globalChat) {
                    setSelectedConversation(globalChat.id)
                    loadMessages(globalChat.id)
                }
            }
        } catch (error) {
            console.error('Error sending broadcast:', error)
        } finally {
            setSendingBroadcast(false)
        }
    }

    // Effects
    useEffect(() => {
        loadConversations()
    }, [loadConversations])

    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation)
        }
    }, [selectedConversation, loadMessages])

    useEffect(() => {
        if (userSearchInput) {
            const timeout = setTimeout(() => searchUsers(userSearchInput), 300)
            return () => clearTimeout(timeout)
        } else {
            searchUsers('')
        }
    }, [userSearchInput])

    // WebSocket Listener
    useEffect(() => {
        if (!socket) return

        const handleNewMessage = (payload: any) => {
            // 1. Notification (if not own message)
            if (!payload.isOwn) {
                playNotificationSound('chat')
                showBrowserNotification(payload.senderName || 'User', payload.content || 'Gambar')
            }

            // 2. Update Messages if viewing this conversation
            if (selectedConversation === payload.conversationId) {
                setMessages(prev => {
                     // Dedup to prevent duplicates
                     if (prev.some(m => m.id === payload.id)) return prev
                     return [...prev, payload]
                })
                lastMessageIdRef.current = payload.id
            }
            
            // 3. Update Conversation List
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === payload.conversationId)
                if (index !== -1) {
                    const currentConv = prev[index]
                    if (!currentConv) return prev

                    const updatedConv: ChatConversation = {
                        ...currentConv,
                        lastMessage: {
                            content: payload.content || (payload.imageUrl ? '📷 Gambar' : 'Pesan baru'),
                            senderName: payload.senderName || 'User',
                            createdAt: payload.createdAt
                        },
                        updatedAt: payload.createdAt,
                        hasUnread: (selectedConversation !== payload.conversationId),
                        unreadCount: (selectedConversation === payload.conversationId) ? 0 : ((currentConv.unreadCount || 0) + 1)
                    }
                    // Remove old position and insert at top
                    const newConvs = [...prev]
                    newConvs.splice(index, 1)
                    return [updatedConv, ...newConvs]
                } else {
                    // New conversation, refresh list
                    loadConversations()
                    return prev
                }
            })
        }

        socket.on('chat:message', handleNewMessage)

        return () => {
            socket.off('chat:message', handleNewMessage)
        }
    }, [socket, selectedConversation, loadConversations, playNotificationSound])

    // Filtered conversations
    const filteredConversations = conversations.filter(conv =>
        conv.name.toLowerCase().includes(searchInput.toLowerCase())
    )

    return (
        <div className="h-[calc(100vh-120px)] flex bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            {/* Sidebar */}
            <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chat</h2>
                        <div className="flex gap-2">
                            {/* Broadcast button - only show if has permission */}
                            {canBroadcast && (
                                <button
                                    onClick={() => setShowBroadcastModal(true)}
                                    className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition"
                                    title="Broadcast"
                                >
                                    <HiOutlineMegaphone className="w-5 h-5" />
                                </button>
                            )}
                            {/* New chat button - only show if can send message */}
                            {canSendMessage && (
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition"
                                    title="New Chat"
                                >
                                    <HiOutlinePlus className="w-5 h-5" />
                                </button>
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
                                        selectedConversation === globalChat.id ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-purple-50/50 dark:bg-purple-900/20'
                                    }`}
                                >
                                    <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                                        <HiOutlineGlobeAlt className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-bold text-purple-900 dark:text-purple-100">Global Chat</div>
                                        <div className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                            <HiOutlineUserGroup className="w-4 h-4" />
                                            {globalChat.participantCount} anggota
                                        </div>
                                    </div>
                                </button>
                            )}

                            {/* Other Conversations */}
                            {filteredConversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv.id)}
                                    className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                                        selectedConversation === conv.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                                    }`}
                                >
                                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                        <HiOutlineChatBubbleLeftRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-900 dark:text-white truncate">{conv.name}</span>
                                            {conv.lastMessage && (
                                                <span className="text-xs text-gray-400">
                                                    {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true, locale: idLocale })}
                                                </span>
                                            )}
                                        </div>
                                        {conv.lastMessage && (
                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                <span className="font-medium">{conv.lastMessage.senderName}: </span>
                                                {conv.lastMessage.content}
                                            </div>
                                        )}
                                    </div>
                                    {conv.hasUnread && (
                                        <div className="h-3 w-3 rounded-full bg-purple-500" />
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
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                    conversationInfo?.isGlobal ? 'bg-purple-500' : 'bg-purple-100 dark:bg-purple-900'
                                }`}>
                                    {conversationInfo?.isGlobal ? (
                                        <HiOutlineGlobeAlt className="w-5 h-5 text-white" />
                                    ) : (
                                        <HiOutlineChatBubbleLeftRight className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        {conversationInfo?.name || 'Chat'}
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
                                            <div className="relative">
                                                {conversationInfo.image ? (
                                                    <img 
                                                        src={conversationInfo.image} 
                                                        alt={conversationInfo.name} 
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                        <HiOutlineUserGroup className="w-6 h-6 text-gray-500" />
                                                    </div>
                                                )}
                                                {conversationInfo.isGlobal && (
                                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
                                                        <HiOutlineGlobeAlt className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-gray-900 dark:text-white">
                                                    {conversationInfo.name}
                                                </h2>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {conversationInfo.isGlobal ? 'Broadcast Channel' : 'Conversation'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    playNotificationSound('chat')
                                                    showBrowserNotification('Test System', 'Ini adalah tes notifikasi suara dan visual.')
                                                    alert('Tes notifikasi dikirim. Jika tidak bunyi chat.mp3, akan fallback ke notification.mp3')
                                                }}
                                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                                title="Test Notification"
                                            >
                                                <span className="text-xl">🔔</span>
                                            </button>
                                            
                                            {hasPermission('broadcast:create') && (
                                                <button
                                                    onClick={() => setShowBroadcastModal(true)}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                                >
                                                    Broadcast
                                                </button>
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
                                messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] ${msg.isOwn ? 'order-2' : 'order-1'}`}>
                                            {!msg.isOwn && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
                                                    {msg.senderName}
                                                </div>
                                            )}
                                            <div className={`rounded-2xl px-4 py-2 ${
                                                msg.isOwn 
                                                    ? 'bg-purple-500 text-white' 
                                                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                                            }`}>
                                                {msg.imageUrl && (
                                                    <img 
                                                        src={msg.imageUrl} 
                                                        alt="Chat image" 
                                                        className="max-w-full rounded-lg mb-2"
                                                    />
                                                )}
                                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                            </div>
                                            <div className={`text-xs text-gray-400 mt-1 ${msg.isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                                                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: idLocale })}
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
                                    <button className="p-2 text-gray-400 hover:text-purple-500 transition">
                                        <HiOutlinePhoto className="w-6 h-6" />
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Ketik pesan..."
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!messageInput.trim() || sendingMessage}
                                        className="p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {sendingMessage ? (
                                            <Spinner className="w-5 h-5" />
                                        ) : (
                                            <HiOutlinePaperAirplane className="w-5 h-5" />
                                        )}
                                    </button>
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
                                <p className="text-sm mt-2">Atau buat chat baru dengan tombol + di sidebar</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChatModal && canSendMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat Baru</h3>
                            <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-gray-600">
                                <HiXMark className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4">
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
                                ) : (
                                    newChatUsers.length > 0 ? (
                                        newChatUsers.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => {
                                                    if (selectedUsers.includes(user.id)) {
                                                        setSelectedUsers(prev => prev.filter(id => id !== user.id))
                                                    } else {
                                                        setSelectedUsers(prev => [...prev, user.id])
                                                    }
                                                }}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                                                    selectedUsers.includes(user.id)
                                                        ? 'bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-500'
                                                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                                                }`}
                                            >
                                                <div className="h-10 w-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-semibold">
                                                    {user.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
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
                                    )
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={createConversation}
                                disabled={selectedUsers.length === 0}
                                className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Mulai Chat ({selectedUsers.length} dipilih)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Broadcast Modal */}
            {showBroadcastModal && canBroadcast && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineMegaphone className="text-orange-500 w-5 h-5" />
                                Broadcast
                            </h3>
                            <button onClick={() => setShowBroadcastModal(false)} className="text-gray-400 hover:text-gray-600">
                                <HiXMark className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
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
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={sendBroadcast}
                                disabled={!broadcastContent.trim() || sendingBroadcast}
                                className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                            >
                                {sendingBroadcast ? (
                                    <Spinner className="w-5 h-5" />
                                ) : (
                                    <>
                                        <HiOutlineMegaphone className="w-5 h-5" />
                                        Kirim Broadcast
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
