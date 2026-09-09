import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageCircle, Send, User, MoreVertical, Trash2, Search, Plus, 
  ArrowLeft, CheckCheck, Clock, ShieldCheck, X, Copy, 
  Sparkles, ExternalLink, Check, UserPlus, RefreshCw, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db, auth } from '../../firebase';
import { 
  collection, doc, query, where, onSnapshot, 
  addDoc, setDoc, deleteDoc, getDocs, limit, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { ChatParticipant, Conversation, DirectMessage } from '../../types';

interface MessagesViewProps {
  onNavigateToTab?: (tab: string) => void;
}

// Format timestamps into clean relative strings
const formatRelativeTime = (timestamp: any): string => {
  if (!timestamp) return 'Just now';
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return 'Just now';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMessageTime = (timestamp: any): string => {
  if (!timestamp) return '';
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatChatDateGroup = (timestamp: any): string => {
  if (!timestamp) return 'Today';
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    return 'Today';
  }
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  if (isToday) return 'Today';
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) return 'Yesterday';

  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const getDeterministicConvId = (uidA: string, uidB: string): string => {
  return [uidA, uidB].sort().join('_');
};

export default function MessagesView({ onNavigateToTab }: MessagesViewProps) {
  const currentUser = auth.currentUser;
  
  // Navigation & selection state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<ChatParticipant | null>(null);
  const [activeMessages, setActiveMessages] = useState<DirectMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Chat Modal state & Registered Users Directory
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userDirectory, setUserDirectory] = useState<ChatParticipant[]>([]);
  const [directorySearch, setDirectorySearch] = useState('');
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  // UI menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Check for pre-selected user to message (e.g. from UserProfile "Chat" button)
  useEffect(() => {
    try {
      const storedRecipient = localStorage.getItem('pultanc_open_chat_user');
      if (storedRecipient) {
        const parsed = JSON.parse(storedRecipient);
        if (parsed && parsed.uid && parsed.uid !== currentUser?.uid) {
          setSelectedPartner({
            uid: parsed.uid,
            name: parsed.name || 'Creator',
            username: parsed.username || 'creator',
            avatarUrl: parsed.avatarUrl || '',
            role: 'creator'
          });
        }
        localStorage.removeItem('pultanc_open_chat_user');
      }
    } catch (e) {
      console.warn('Error reading stored chat recipient:', e);
    }
  }, [currentUser]);

  // Load active user's conversations (people messages have been sent to or from)
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setIsLoadingConversations(false);
      return;
    }

    setIsLoadingConversations(true);

    // Query conversations where current user is a participant
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Conversation[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          participants: data.participants || [],
          participantDetails: data.participantDetails || {},
          lastMessage: data.lastMessage || '',
          lastSenderId: data.lastSenderId || '',
          lastTimestamp: data.lastTimestamp || data.updatedAt || Date.now(),
          updatedAt: data.updatedAt || 0,
          unreadCount: data.unreadCount || {},
        });
      });

      // Sort by latest message descending
      loaded.sort((a, b) => {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.lastTimestamp || 0);
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.lastTimestamp || 0);
        return timeB - timeA;
      });

      setConversations(loaded);
      setIsLoadingConversations(false);
    }, (error) => {
      console.error('Error listening to conversations:', error);
      setIsLoadingConversations(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Load messages for currently selected partner
  useEffect(() => {
    if (!currentUser || !selectedPartner) {
      setActiveMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    const convId = getDeterministicConvId(currentUser.uid, selectedPartner.uid);

    // Listen to messages subcollection for this specific conversation
    const messagesQuery = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: DirectMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        msgs.push({
          id: docSnap.id,
          conversationId: convId,
          text: d.text || '',
          senderId: d.senderId,
          senderName: d.senderName || 'Anonymous',
          senderAvatar: d.senderAvatar || '',
          recipientId: d.recipientId,
          timestamp: d.timestamp || d.createdAt || Date.now(),
          read: d.read ?? true,
        });
      });
      setActiveMessages(msgs);
      setIsLoadingMessages(false);
      
      // Auto-scroll to latest
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    }, (err) => {
      console.warn('Error fetching conversation messages:', err);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [currentUser, selectedPartner]);

  // Fetch registered users / creators for the "New Chat" modal & recommendations
  const fetchUserDirectory = async () => {
    setIsLoadingDirectory(true);
    try {
      const q = query(collection(db, 'users'), limit(50));
      const snap = await getDocs(q);
      const directory: ChatParticipant[] = [];
      snap.forEach(docSnap => {
        const u = docSnap.data();
        const uid = u.uid || docSnap.id;
        if (currentUser && uid === currentUser.uid) return; // exclude self
        
        directory.push({
          uid,
          name: u.displayName || u.name || u.username || 'Pultanc Creator',
          username: u.username || u.handle || (u.email ? u.email.split('@')[0] : 'creator'),
          avatarUrl: u.avatarUrl || u.photoURL || '',
          role: u.role || 'creator',
          isVerified: u.role === 'creator' || u.isVerified === true,
        });
      });
      setUserDirectory(directory);
    } catch (e) {
      console.warn('Could not fetch user directory:', e);
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserDirectory();
    }
  }, [currentUser]);

  // Send a message to the currently selected partner
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() || !currentUser || !selectedPartner) return;

    const textToSend = newMessageText.trim();
    setNewMessageText('');

    const convId = getDeterministicConvId(currentUser.uid, selectedPartner.uid);
    const nowTimestamp = Date.now();

    const myDetails: ChatParticipant = {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
      username: currentUser.email?.split('@')[0] || 'user',
      avatarUrl: currentUser.photoURL || '',
      role: 'user'
    };

    const partnerDetails: ChatParticipant = {
      uid: selectedPartner.uid,
      name: selectedPartner.name,
      username: selectedPartner.username,
      avatarUrl: selectedPartner.avatarUrl || '',
      role: selectedPartner.role || 'creator',
      isVerified: selectedPartner.isVerified
    };

    try {
      // 1. Add message to the conversation subcollection
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: textToSend,
        senderId: currentUser.uid,
        senderName: myDetails.name,
        senderAvatar: myDetails.avatarUrl || '',
        recipientId: selectedPartner.uid,
        timestamp: nowTimestamp,
        createdAt: serverTimestamp(),
      });

      // 2. Set or update the conversation parent doc
      await setDoc(doc(db, 'conversations', convId), {
        id: convId,
        participants: [currentUser.uid, selectedPartner.uid],
        participantDetails: {
          [currentUser.uid]: myDetails,
          [selectedPartner.uid]: partnerDetails
        },
        lastMessage: textToSend,
        lastSenderId: currentUser.uid,
        lastTimestamp: nowTimestamp,
        updatedAt: nowTimestamp,
      }, { merge: true });

      // 3. Fallback compatibility with legacy direct_messages collection
      await addDoc(collection(db, 'direct_messages'), {
        conversationId: convId,
        text: textToSend,
        userId: currentUser.uid,
        userName: myDetails.name,
        userPhoto: myDetails.avatarUrl || '',
        recipientId: selectedPartner.uid,
        timestamp: serverTimestamp()
      }).catch(() => {});

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err: any) {
      console.error('Failed to send direct message:', err);
      toast.error('Could not send message. Please try again.');
    }
  };

  // Start chat with a person from user directory
  const handleStartChatWith = (user: ChatParticipant) => {
    setSelectedPartner(user);
    setShowNewChatModal(false);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 150);
  };

  // Delete conversation
  const handleDeleteConversation = async (conv: Conversation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to remove this conversation from your list?')) return;

    try {
      await deleteDoc(doc(db, 'conversations', conv.id));
      if (selectedPartner && conv.participants.includes(selectedPartner.uid)) {
        setSelectedPartner(null);
      }
      toast.success('Conversation removed');
    } catch (err) {
      console.error('Error deleting conversation:', err);
      toast.error('Failed to remove conversation');
    }
  };

  // Copy text to clipboard
  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Message copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(conv => {
      const otherUid = conv.participants.find(p => p !== currentUser?.uid);
      const other = otherUid ? conv.participantDetails?.[otherUid] : null;
      const name = other?.name?.toLowerCase() || '';
      const username = other?.username?.toLowerCase() || '';
      const lastMsg = conv.lastMessage?.toLowerCase() || '';
      return name.includes(q) || username.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery, currentUser]);

  // Filter user directory based on search
  const filteredDirectory = useMemo(() => {
    if (!directorySearch.trim()) return userDirectory;
    const q = directorySearch.toLowerCase().trim();
    return userDirectory.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.username.toLowerCase().includes(q)
    );
  }, [userDirectory, directorySearch]);

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-950 flex flex-col pt-3 pb-24 md:pb-6 px-3 sm:px-6 relative overflow-hidden font-sans">
      <div className="max-w-6xl mx-auto w-full h-full flex flex-col md:flex-row bg-gray-50/80 dark:bg-[#111113] rounded-3xl border border-gray-200/80 dark:border-white/5 overflow-hidden shadow-xl">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: CONVERSATIONS LIST (People messages have been sent to or from)   */}
        {/* Visible on Desktop, or on Mobile when NO chat is actively opened           */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-80 lg:w-96 shrink-0 flex flex-col h-full border-r border-gray-200/80 dark:border-white/5 bg-white dark:bg-zinc-950/60 ${
          selectedPartner ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200/70 dark:border-white/5 flex items-center justify-between shrink-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-500 flex items-center justify-center font-bold">
                <MessageCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Chats
                  {conversations.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300">
                      {conversations.length}
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">Direct messages & connections</p>
              </div>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => {
                setShowNewChatModal(true);
                fetchUserDirectory();
              }}
              title="Start a new chat"
              className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-900/30">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search people or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500 transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation People List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 no-scrollbar">
            {!currentUser ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-3">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Sign in to view your chats</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs">
                  Connect with content creators and direct message fans securely.
                </p>
              </div>
            ) : isLoadingConversations ? (
              <div className="p-6 flex flex-col items-center justify-center text-gray-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-gray-400 dark:text-zinc-500">
                  <MessageSquare className="w-7 h-7 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {searchQuery ? 'No chats found' : 'No conversations yet'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-[240px] leading-relaxed">
                    {searchQuery 
                      ? `No conversations match "${searchQuery}"`
                      : 'Messages sent to or received from creators and friends will appear here.'}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => {
                      setShowNewChatModal(true);
                      fetchUserDirectory();
                    }}
                    className="mt-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Start a Conversation</span>
                  </button>
                )}

                {/* Suggested Creators Quick List if no conversations exist */}
                {!searchQuery && userDirectory.length > 0 && (
                  <div className="w-full pt-4 text-left border-t border-gray-100 dark:border-white/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 px-1">
                      Suggested Creators
                    </span>
                    <div className="space-y-1.5">
                      {userDirectory.slice(0, 3).map(creator => (
                        <div
                          key={creator.uid}
                          onClick={() => handleStartChatWith(creator)}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/60 dark:border-zinc-800 hover:border-red-500/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-gray-300 dark:border-zinc-700">
                              {creator.avatarUrl ? (
                                <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-xs text-gray-600 dark:text-zinc-300">
                                  {creator.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{creator.name}</p>
                              <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">@{creator.username}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-red-500 hover:text-red-600 shrink-0">
                            Message
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const otherUid = conv.participants.find(uid => uid !== currentUser.uid) || '';
                const partnerInfo = conv.participantDetails?.[otherUid] || {
                  uid: otherUid,
                  name: 'User ' + otherUid.slice(0, 5),
                  username: 'user_' + otherUid.slice(0, 5),
                  avatarUrl: '',
                  role: 'user'
                };

                const isSelected = selectedPartner?.uid === partnerInfo.uid;
                const isSentByMe = conv.lastSenderId === currentUser.uid;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedPartner(partnerInfo)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors relative group ${
                      isSelected 
                        ? 'bg-red-50/70 dark:bg-red-950/20 border-l-4 border-l-red-500' 
                        : 'hover:bg-gray-100/60 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Avatar with active status */}
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                          {partnerInfo.avatarUrl ? (
                            <img src={partnerInfo.avatarUrl} alt={partnerInfo.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-sm text-gray-600 dark:text-zinc-300">
                              {partnerInfo.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
                      </div>

                      {/* Name & Last Message */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate flex items-center gap-1">
                            <span>{partnerInfo.name}</span>
                            {partnerInfo.role === 'creator' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                          </h4>
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0 font-medium">
                            {formatRelativeTime(conv.lastTimestamp)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate leading-snug">
                            {isSentByMe && <span className="text-gray-400 font-medium">You: </span>}
                            {conv.lastMessage || 'Sent an attachment'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delete conversation button on hover */}
                    <button
                      onClick={(e) => handleDeleteConversation(conv, e)}
                      title="Delete chat"
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-gray-400 hover:text-red-500 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: 1-ON-1 CHAT THREAD WITH THE SELECTED PERSON                     */}
        {/* Visible on Desktop, or on Mobile when a chat is selected                   */}
        {/* ========================================================================= */}
        <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#121214] ${
          !selectedPartner ? 'hidden md:flex' : 'flex'
        }`}>
          
          {selectedPartner ? (
            <>
              {/* Active Chat Header */}
              <div className="px-4 py-3 border-b border-gray-200/80 dark:border-white/5 flex items-center justify-between bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button: returns to the list of people */}
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="p-1.5 -ml-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl text-gray-600 dark:text-zinc-300 transition-colors cursor-pointer md:hidden flex items-center gap-1 text-xs font-semibold"
                    title="Back to chats list"
                  >
                    <ArrowLeft className="w-5 h-5 text-red-500" />
                    <span className="hidden sm:inline">Chats</span>
                  </button>

                  {/* Partner Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                      {selectedPartner.avatarUrl ? (
                        <img src={selectedPartner.avatarUrl} alt={selectedPartner.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-sm text-gray-700 dark:text-zinc-200">
                          {selectedPartner.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
                  </div>

                  {/* Partner Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {selectedPartner.name}
                      </h2>
                      {selectedPartner.role === 'creator' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-500 border border-red-500/20">
                          Creator
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <span>@{selectedPartner.username}</span>
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      <span className="text-emerald-500 font-medium">Active now</span>
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1">
                  {onNavigateToTab && selectedPartner.role === 'creator' && (
                    <button
                      onClick={() => onNavigateToTab('profile')}
                      title="View Profile"
                      className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-semibold text-gray-700 dark:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      <span className="hidden sm:inline">Profile</span>
                    </button>
                  )}
                  
                  {/* Deselect on desktop */}
                  <button
                    onClick={() => setSelectedPartner(null)}
                    title="Close Chat"
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hidden md:flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Bubble History */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar bg-gray-50/40 dark:bg-[#121214]">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-100/70 dark:bg-red-500/10 flex items-center justify-center text-red-500 mb-1">
                      <MessageCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        Say hello to {selectedPartner.name}!
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm">
                        This is the beginning of your direct conversation with @{selectedPartner.username}. Messages are private and direct.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {['👋 Hey there!', 'Love your latest climer!', 'Looking forward to your next release!'].map((quickMsg) => (
                        <button
                          key={quickMsg}
                          onClick={() => {
                            setNewMessageText(quickMsg);
                            chatInputRef.current?.focus();
                          }}
                          className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs text-gray-700 dark:text-zinc-300 hover:border-red-500 transition-colors shadow-2xs cursor-pointer"
                        >
                          {quickMsg}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser?.uid;
                    const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                    const showDateDivider = !prevMsg || 
                      formatChatDateGroup(prevMsg.timestamp) !== formatChatDateGroup(msg.timestamp);

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {/* Date Divider */}
                        {showDateDivider && (
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-gray-200/80 dark:bg-zinc-800 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 shadow-2xs">
                              {formatChatDateGroup(msg.timestamp)}
                            </span>
                          </div>
                        )}

                        {/* Message Row */}
                        <div className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                          
                          {/* Partner Avatar on left */}
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden shrink-0 mb-1 border border-gray-200 dark:border-zinc-700">
                              {selectedPartner.avatarUrl ? (
                                <img src={selectedPartner.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="w-full h-full flex items-center justify-center font-bold text-[10px] text-gray-600 dark:text-zinc-300">
                                  {selectedPartner.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action Options (Copy) on hover */}
                          {isMe && (
                            <button
                              onClick={() => handleCopyMessage(msg.text, msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-opacity"
                              title="Copy message"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Bubble */}
                          <div
                            className={`max-w-[78%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative break-words ${
                              isMe
                                ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-br-xs'
                                : 'bg-white dark:bg-zinc-800/90 text-gray-900 dark:text-zinc-100 border border-gray-200/70 dark:border-white/5 rounded-bl-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            
                            <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                              isMe ? 'text-red-100' : 'text-gray-400 dark:text-zinc-500'
                            }`}>
                              <span>{formatMessageTime(msg.timestamp)}</span>
                              {isMe && <CheckCheck className="w-3 h-3 text-red-200 inline" />}
                            </div>
                          </div>

                          {!isMe && (
                            <button
                              onClick={() => handleCopyMessage(msg.text, msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-opacity"
                              title="Copy message"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}

                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer Input Bar */}
              <div className="p-3 sm:p-4 bg-white dark:bg-zinc-950 border-t border-gray-200/80 dark:border-white/5 shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={chatInputRef}
                      type="text"
                      placeholder={`Message @${selectedPartner.username}...`}
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="w-full bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white rounded-2xl py-3 pl-4 pr-10 focus:outline-none focus:border-red-500 text-xs sm:text-sm transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="w-11 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
                    title="Send message"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Desktop Blank State when no conversation is selected */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/30 dark:bg-zinc-950/30">
              <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Select a person to start chatting
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed">
                Choose a conversation from the left, or click <strong className="text-red-500 font-semibold">New Chat</strong> to connect with creators and friends.
              </p>
              <button
                onClick={() => {
                  setShowNewChatModal(true);
                  fetchUserDirectory();
                }}
                className="mt-4 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Conversation</span>
              </button>
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL: START A NEW CHAT (Directory of creators and registered users)      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Start a New Chat</h3>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400">Select a creator or user to direct message</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Search Input */}
              <div className="p-3 border-b border-gray-100 dark:border-zinc-900 bg-gray-50/50 dark:bg-zinc-900/30">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name or @username..."
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-100 dark:divide-zinc-900 no-scrollbar">
                {isLoadingDirectory ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                    <span className="text-xs">Finding people on Pultanc...</span>
                  </div>
                ) : filteredDirectory.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-1">
                    <p className="text-xs font-semibold">No people found</p>
                    <p className="text-[11px] text-gray-500">Try searching for a different name or handle</p>
                  </div>
                ) : (
                  filteredDirectory.map((user) => (
                    <div
                      key={user.uid}
                      onClick={() => handleStartChatWith(user)}
                      className="p-2.5 flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900/80 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-xs text-gray-600 dark:text-zinc-300">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate flex items-center gap-1">
                            {user.name}
                            {user.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          </h4>
                          <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">@{user.username}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 group-hover:bg-red-500 text-red-500 group-hover:text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
