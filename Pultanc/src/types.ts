export interface Episode {
 id: string;
 title: string;
 videoUrl: string; // Using image URLs for mock
 isLocked: boolean;
 priceGHS?: number;
 isClimer?: boolean;
 price?: number;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  creator: string;
  creatorVerified?: boolean;
  creatorAvatar?: string;
  creatorHandle?: string;
  creatorName?: string;
  creatorId?: string;
  unlocksCount?: string | number;
  supportsCount?: string | number;
  subscribersCount?: string | number;
  episodes: Episode[];
  thumbnailUrl?: string;
  subscribePrice?: number;
  creatorSubscribePrice?: number;
  isSubscribed?: boolean;
}

export interface Transaction {
  id: string;
  timestamp: string | number;
  userId: string;
  seriesId: string;
  episodeId: string;
  amount: number;
  creatorSplit: number;
  platformSplit: number;
  status?: 'pending_analysis' | 'cleared';
  title?: string;
  reference?: string;
  category?: string;
  type?: string;
  seriesTitle?: string;
  episodeTitle?: string;
  creatorName?: string;
}

export interface LiveCreator {
 id: string;
 name: string;
 handle: string;
 avatar: string;
 liveTitle: string;
 viewerCount: number;
 previewImage?: string;
 subscriptionPriceGHS?: number;
 isSubscribed: boolean;
 thumbnailUrl?: string;
 isVerified?: boolean;
}

export interface ChatParticipant {
  uid: string;
  name: string;
  username: string;
  avatarUrl?: string;
  role?: string;
  isVerified?: boolean;
}

export interface DirectMessage {
  id: string;
  conversationId?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  timestamp: any;
  read?: boolean;
  createdAt?: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantDetails: Record<string, ChatParticipant>;
  lastMessage: string;
  lastSenderId: string;
  lastTimestamp: any;
  updatedAt: number;
  unreadCount?: Record<string, number>;
}

