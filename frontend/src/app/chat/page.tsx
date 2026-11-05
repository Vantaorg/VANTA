'use client';

import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload, invalidateCache } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  Bell, MessageCircle, Search, Compass, Radio, House, Clapperboard, User,
  Send, Paperclip, Check, CheckCheck,
  Loader2, Users, Hash, ArrowLeft, X, UserPlus, Camera, BellOff,
  Pin, Image as ImageIcon, FileText, Info, ChevronRight, Flag, Ban, Pencil, RefreshCw,
  Shield, Trash2, Crown, Globe2, Lock, UserMinus, Copy, Forward, Smile, MoreVertical, MapPin, BarChart3, Music2, Wallet as WalletIcon,
  Mic, Square, Phone, Video, Play,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import PullToRefresh from '@/components/ui/PullToRefresh';
import VerificationBadge from '@/components/ui/VerificationBadge';
import { useToast } from '@/components/ui/Toast';
import { createSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';
import MessageFab from '@/components/messages/MessageFab';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useCalls } from '@/context/CallContext';
import { useChatUnread } from '@/context/ChatUnreadContext';
import { useNotifications } from '@/context/NotificationContext';
import VideoTrimModal from '@/components/video/VideoTrimModal';
import type { VideoTrimResult } from '@/components/video/VideoTrimEditor';
import { VoiceNotePlayer, VideoFullscreenPlayer } from '@/components/messages/ChatMediaPlayer';
import { activeReplyFor, createReply, type ReplyState } from '@/lib/replyState';
import { isSecureMediaContext, mapMediaError } from '@/lib/mediaPermissions';
import { addDrafts, hasBusyDraft, readyDraftCount, removeDraft, type AttachmentDraft } from '@/lib/attachmentDrafts';
import { renderTextWithLinks } from '@/lib/linkify';
import { friendlyError, errorMessage } from '@/lib/errors';
import type { VerificationType } from '@/types/verification';

interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name: string;
  avatar?: string;
  lastMessage?: {
    text: string;
    sender: string;
    timestamp: string;
    read: boolean;
    type?: string;
    hasAttachments?: boolean;
  };
  unread: number;
  online: boolean;
  username?: string;
  verified?: boolean;
  verificationType?: VerificationType | null;
  lastSeen?: string;
  partnerId?: string;
  nextCursor?: string | null;
  pinned?: boolean;
  muted?: boolean;
  memberCount?: number;
  onlineMemberCount?: number;
  currentRole?: string;
  entityId?: string;
  description?: string;
  handle?: string;
  participants?: any[];
}

interface Message {
  id: string;
  text: string;
  type?: string;
  legacyPoll?: { question: string; options: string[] } | null;
  sender: { id: string; username: string; avatar?: string; verified?: boolean; fullName?: string; };
  timestamp: string;
  read: boolean;
  isOwn: boolean;
  content?: string;
  senderId?: string;
  conversationId?: string;
  createdAt?: string;
  reads?: Array<{ userId: string }>;
  attachments?: Array<{ id?: string; fileId?: string; url: string; fileType: string; fileName?: string; fileSize?: number }>;
  editedAt?: string | null;
  deletedAt?: string | null;
  pending?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  failed?: boolean;
  pinnedAt?: string | null;
  reactions?: Array<{ id: string; reaction: string; userId: string }>;
  replyTo?: any;
  // Story reply — private message referencing a Story (snapshot fields keep the
  // reference readable after the Story expires).
  storyReplyStoryId?: string | null;
  storyReplyMediaUrl?: string | null;
  storyReplyCaption?: string | null;
  storyReplyAuthor?: string | null;
}

const attachmentTextPattern = /^(?:https?:\/\/|www\.|\/?(?:storage|uploads?)\/|[^\s/]+\.(?:jpe?g|png|gif|webp|avif|mp4|webm|mov)(?:\?.*)?$)/i;
const imagePathPattern = /\.(?:jpe?g|png|gif|webp|avif)(?:\?.*)?$/i;
const videoPathPattern = /\.(?:mp4|webm|mov)(?:\?.*)?$/i;

const normalizeAttachmentType = (value: unknown, url: string): string => {
  const type = typeof value === 'string' ? value.toUpperCase() : '';
  if (type === 'IMAGE' || type.startsWith('IMAGE/')) return 'IMAGE';
  if (type === 'VIDEO' || type.startsWith('VIDEO/')) return 'VIDEO';
  if (type === 'AUDIO' || type.startsWith('AUDIO/')) return 'AUDIO';
  if (imagePathPattern.test(url)) return 'IMAGE';
  if (videoPathPattern.test(url)) return 'VIDEO';
  return type || 'FILE';
};

const normalizeMessageRecord = (msg: any, currentUserId?: string): Message => {
  const content = msg.content ?? msg.text ?? '';
  let legacyPoll: { question: string; options: string[] } | null = null;
  let pollPayload = false;
  if (typeof content === 'string' && (msg.type == null || ['TEXT', 'POLL'].includes(String(msg.type).toUpperCase()))) {
    try {
      const parsed = JSON.parse(content);
      pollPayload = Boolean(parsed && typeof parsed === 'object' && ('question' in parsed || 'options' in parsed));
      if (parsed && typeof parsed.question === 'string' && parsed.question.trim() && Array.isArray(parsed.options) && parsed.options.length >= 2 && parsed.options.length <= 10 && parsed.options.every((option: unknown) => typeof option === 'string' && option.trim())) {
        legacyPoll = { question: parsed.question.trim(), options: parsed.options.map((option: string) => option.trim()) };
      }
    } catch { /* ordinary text */ }
  }
  const safeLegacyPoll = legacyPoll ?? ((pollPayload || msg.type === 'POLL') ? { question: 'Poll', options: [] as string[] } : null);
  const attachments = (msg.attachments ?? []).map((attachment: any) => {
    const source = attachment.url ?? attachment.mediaUrl ?? attachment.path ?? attachment.fileName;
    return {
      ...attachment,
      url: resolveMediaUrl(source),
      fileType: normalizeAttachmentType(attachment.fileType ?? attachment.mimeType ?? attachment.type, String(source || '')),
    };
  });

  // Before Attachment rows existed, image messages stored the upload filename
  // in Message.content. Keep those messages usable without exposing that name.
  const messageType = typeof msg.type === 'string' ? msg.type.toUpperCase() : '';
  if (!attachments.length && messageType === 'IMAGE' && attachmentTextPattern.test(content)) {
    attachments.push({
      url: resolveMediaUrl(content),
      fileType: 'IMAGE',
      fileName: String(content).split('/').pop(),
    });
  }

  return {
    ...msg,
    ...(safeLegacyPoll ? { type: 'POLL', legacyPoll: safeLegacyPoll, text: '' } : (pollPayload || msg.type === 'POLL' || msg.type === 'WALLET' ? { text: '' } : {})),
    id: msg.id,
    text: (safeLegacyPoll || pollPayload || msg.type === 'POLL' || msg.type === 'WALLET') ? '' : content,
    sender: msg.sender ?? { id: msg.senderId, username: 'User' },
    senderId: msg.senderId ?? msg.sender?.id,
    conversationId: msg.conversationId,
    timestamp: msg.createdAt ?? msg.timestamp,
    createdAt: msg.createdAt ?? msg.timestamp,
    read: Boolean(msg.read ?? msg.isRead ?? msg.reads?.some((read: any) => read.userId !== currentUserId)),
    isOwn: (msg.senderId ?? msg.sender?.id) === currentUserId,
    attachments,
    reactions: msg.reactions ?? [],
    replyTo: msg.replyTo,
  };
};

const visibleMessageText = (message: Message): string => {
  if (!message.attachments?.some(attachment => attachment.fileType === 'IMAGE')) return message.text;
  const text = message.text.trim();
  if (!text) return '';
  const image = message.attachments.find(attachment => attachment.fileType === 'IMAGE');
  const candidates = [image?.fileName, image?.url].filter(Boolean).map(value => String(value).split('/').pop());
  return candidates.includes(text) || attachmentTextPattern.test(text) ? '' : message.text;
};

// ============================================================================
// RESPONSIVE MEDIA GALLERY GRID
//
// Used by BOTH the composer draft preview and the sent/received message bubbles
// so every place renders a multi-attachment group with the same Instagram-style
// responsive gallery rules:
//   1 attachment → full-size single tile
//   2 attachments → 2 equal columns
//   3 attachments → first large on the left, 2 & 3 stacked on the right
//   4 attachments → 2×2 grid
//   5+ attachments → polished multi-item grid with remaining-count overlay
//
// Only IMAGE / VIDEO tiles go in the grid (they share one object-fit:cover tile).
// FILE / AUDIO attachments keep their dedicated document/audio cards rendered
// adjacent to (not inside) the grid.
// ============================================================================

/** Versatile attachment shape shared by drafts and persisted messages. */
type GridAttachment = {
  id?: string;
  url?: string;
  previewUrl?: string;
  fileType: string;
  fileName?: string;
};

const GRID_MAX_VISIBLE = 5;

/** Aspect ratio of the whole grid container so `auto-rows-fr` yields even cells. */
function gridAspectClass(count: number): string {
  if (count === 1) return 'aspect-[4/3]';
  if (count === 2) return 'aspect-[2/1]';
  if (count === 3 || count === 4) return 'aspect-square';
  return 'aspect-[3/2]';
}

/** Grid template columns/rows per count; every row shares height via auto-rows-fr. */
function gridColumnsClass(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2 grid-rows-1 auto-rows-fr';
  if (count === 3) return 'grid-cols-2 grid-rows-2 auto-rows-fr';
  if (count === 4) return 'grid-cols-2 grid-rows-2 auto-rows-fr';
  return 'grid-cols-3 grid-rows-2 auto-rows-fr';
}

/** Per-tile placement classes (the 3-item "featured left" layout is custom). */
function gridTileClass(count: number, index: number): string {
  if (count === 3) return index === 0 ? 'col-span-1 row-span-2' : 'col-span-1 row-span-1';
  return '';
}

/** Compact relative timestamp used in chat list and message metadata. */
const formatRelativeChatTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return seconds <= 5 ? 'now' : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
};

const formatVoiceTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const safe = Math.floor(seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Compact relative timestamps for presence metadata. */
const formatRelativePresenceTime = (value?: string | Date | null): string => {
  if (!value) return 'recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'recently';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { setChatUnread } = useChatUnread();
  const { unreadCount: notificationUnread } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'group' | 'channel' | null>(null);
  // Poll voting is not supported by this backend yet. Keep the attachment sheet
  // intact, but do not create messages that can only appear as raw JSON.
  const [pollDraft, setPollDraft] = useState<{ question: string; options: string[] } | null>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [specialSending, setSpecialSending] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createHandle, setCreateHandle] = useState('');
  const [createVisibility, setCreateVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [createAvatar, setCreateAvatar] = useState<string | null>(null);
  const [createAvatarFileId, setCreateAvatarFileId] = useState<string | null>(null);
  const [createAvatarError, setCreateAvatarError] = useState<string | null>(null);
  const [createValidationError, setCreateValidationError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
// Separates the one-time "open at latest unread / bottom" anchor from the
// live "only auto-scroll when already near the bottom" behaviour.
const initialScrollDoneRef = useRef(false);
const wasNearBottomRef = useRef(true);
const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
const [pendingNewMessage, setPendingNewMessage] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  // Source of truth for the temporary create-modal image so cleanup (cancel /
  // create success / failure) always targets the correct server file.
  const createAvatarFileIdRef = useRef<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Native document/file picker — multi-select documents for the composer.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const typingRenewRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingExpiryRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingDurationRef = useRef(0);
  const recordingTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);
  const swipeStartRef = useRef<{ id: string; x: number; y: number; offset: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatResults, setNewChatResults] = useState<any[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  // Toggles the compact Camera / Photos / Files attachment sheet above the composer.
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  // Retains local files + preview URLs for in-chat media messages that are
  // still uploading (or failed), so a retry can re-upload the same files.
  const pendingMediaRef = useRef<Record<string, { file: File; fileType: 'IMAGE' | 'VIDEO' | 'FILE'; fileName: string; previewUrl: string }[]>>({});
  const [trimVideoFile, setTrimVideoFile] = useState<File | null>(null);
  const [editEntityOpen, setEditEntityOpen] = useState(false);
  const [editEntityId, setEditEntityId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editVisibility, setEditVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [editHandle, setEditHandle] = useState('');
  const [managedEntity, setManagedEntity] = useState<any>(null);
  const [managementSearch, setManagementSearch] = useState('');
  const [managementResults, setManagementResults] = useState<any[]>([]);
  const [managementBusy, setManagementBusy] = useState<string | null>(null);
  const [ownershipConfirm, setOwnershipConfirm] = useState<any | null>(null);
  const [isSavingEntity, setIsSavingEntity] = useState(false);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'ready' | 'uploading'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingPreviewUrlRef = useRef<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [messageContextId, setMessageContextId] = useState<string | null>(null);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyState<Message> | null>(null);
  // Only a reply bound to the currently-open conversation may be shown/submitted.
  // If the stored conversation does not match the active one, treat it as absent.
  const activeReply: Message | null = activeReplyFor(replyingTo, activeConversation);
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'channel' | 'unread'>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [memberBrowserOpen, setMemberBrowserOpen] = useState(false);
  const [memberBrowserQuery, setMemberBrowserQuery] = useState('');
  const [isLoadingEntityInfo, setIsLoadingEntityInfo] = useState(false);
  // Unified Call button: opens the Voice/Video call-type menu. The menu closes
  // on selection, when the user taps outside, on back navigation, and the
  // moment a call starts (the in-call overlay takes over).
  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [mediaViewer, setMediaViewer] = useState<{ url: string; fileType: string; fileName?: string } | null>(null);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const newChatSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live auto-scroll: only follow the newest message when the user is already
  // at (or near) the bottom. When they are reading older messages, keep their
  // position and surface the "New messages" jump indicator instead.
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) { wasNearBottomRef.current = true; return; }
    const lastMessageId = messages.at(-1)?.id ?? null;
    const previousLastMessageId = previousLastMessageIdRef.current;
    previousLastMessageIdRef.current = lastMessageId;
    if (!lastMessageId || lastMessageId === previousLastMessageId) return;
    // Initial open is owned by the dedicated one-time anchor effect below
    // (which jumps instantly to the unread area / bottom). Only follow live
    // appends once the reader already has an established position in the thread.
    if (!previousLastMessageId) return;

    const isNearBottom = () => (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) < 140;
    const near = wasNearBottomRef.current && isNearBottom();
    const newest = messages[messages.length - 1];
    const isIncoming = newest?.id !== previousLastMessageId && Boolean(newest) &&
      (newest.sender?.id !== user?.id) && !newest.isOwn;

    if (near) {
      // Already reading the latest region → follow the new message.
      const frame = window.requestAnimationFrame(() => {
        const target = messagesViewportRef.current;
        target?.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
      });
      setPendingNewMessage(false);
      wasNearBottomRef.current = true;
    } else if (isIncoming) {
      // Reading older messages → never yank the user back down; show pill.
      setPendingNewMessage(true);
    }
  }, [messages, user?.id]);

  // Track proximity to the bottom so live auto-scroll knows when to engage and
  // so the "New messages" pill clears once the user scrolls back down.
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const near = (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) < 140;
      wasNearBottomRef.current = near;
      if (near) setPendingNewMessage(false);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [activeConversation]);

  // One-time anchor when a conversation opens: land on the latest unread area
  // (with a subtle "New messages" divider) or the bottom when everything is read.
  useEffect(() => {
    if (!activeConversation || messages.length === 0 || initialScrollDoneRef.current) return;
    // Wait until fetched messages belong to the conversation we just opened.
    if (!messages.some(item => item.conversationId === activeConversation)) return;
    initialScrollDoneRef.current = true;

    const unreadList = messages.filter(mg => !mg.isOwn && !(mg.reads || []).some(r => r.userId === user?.id));
    const firstUnread = unreadList[0] || null;
    setFirstUnreadId(firstUnread ? firstUnread.id : null);
    if (!firstUnread) setPendingNewMessage(false);

    const frame = window.requestAnimationFrame(() => {
      const viewport = messagesViewportRef.current;
      if (!viewport) return;
      if (firstUnread) {
        const el = document.getElementById(`message-${firstUnread.id}`);
        if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
        else viewport.scrollTop = viewport.scrollHeight;
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
      // Reflect the actual position after anchoring so subsequent live appends
      // only auto-follow when the reader is genuinely at the newest region.
      wasNearBottomRef.current = (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) < 140;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeConversation, messages, user?.id]);

  useEffect(() => {
    // Chat owns the viewport. Lock the document even on the list screen so
    // the browser cannot scroll the app shell behind the independent panes.
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const viewport = window.visualViewport;

    const syncVisualViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      root.style.setProperty('--chat-viewport-height', `${height}px`);
      root.style.setProperty('--chat-viewport-offset', `${offsetTop}px`);

      if (document.activeElement === messageInputRef.current) {
        // Only follow to the newest message when the reader was already near the
        // bottom. If they are browsing older messages, the keyboard resize must
        // not yank them back down — keep their position (the composer stays put).
        if (wasNearBottomRef.current) {
          window.requestAnimationFrame(() => {
            const messagesViewport = messagesViewportRef.current;
            messagesViewport?.scrollTo({ top: messagesViewport.scrollHeight });
          });
        }
      }
    };

    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    syncVisualViewport();
    viewport?.addEventListener('resize', syncVisualViewport);
    viewport?.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', syncVisualViewport);

    return () => {
      viewport?.removeEventListener('resize', syncVisualViewport);
      viewport?.removeEventListener('scroll', syncVisualViewport);
      window.removeEventListener('resize', syncVisualViewport);
      root.style.removeProperty('--chat-viewport-height');
      root.style.removeProperty('--chat-viewport-offset');
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { document.title = 'Chat | VANTA'; }, []);

  // Chat subviews participate in the URL history without becoming separate
  // app pages. This gives browser/system back the same contextual hierarchy
  // as the visible Chat headers: settings -> info -> conversation -> list.
  useEffect(() => {
    const view = searchParams.get('view');
    if (view !== 'info' && view !== 'settings') setDetailsOpen(false);
    if (view !== 'settings') setEditEntityOpen(false);
    if (view !== 'media') setMediaViewer(null);
    // Back navigation from any chat subview also closes the call menu.
    setCallMenuOpen(false);
  }, [searchParams]);

  const pushChatView = useCallback((view: 'info' | 'settings' | 'media') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`/chat?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const closeChatSubview = useCallback((fallback: () => void) => {
    if (searchParams.get('view')) router.back();
    else fallback();
  }, [router, searchParams]);

  const openConversationInfo = useCallback(async () => {
    setDetailsOpen(true);
    setMemberBrowserOpen(false);
    setMemberBrowserQuery('');
    pushChatView('info');
    setManagedEntity(null);
    const conversation = conversations.find(item => item.id === activeConversation);
    if (!conversation) return;
    if (conversation.type === 'direct' || !token) return;
    setIsLoadingEntityInfo(true);
    try {
      const entityId = conversation.entityId || conversation.id;
      const entity = await apiGet<any>(`/api/${conversation.type === 'group' ? 'groups' : 'channels'}/${entityId}`, token);
      setManagedEntity(entity);
    } catch {
      // The overview remains usable from conversation data if extra info is unavailable.
    } finally {
      setIsLoadingEntityInfo(false);
    }
  }, [activeConversation, conversations, pushChatView, token]);

  const openMediaViewer = useCallback((attachment: { url: string; fileType: string; fileName?: string }) => {
    setMediaViewer(attachment);
    pushChatView('media');
  }, [pushChatView]);

  const fetchConversations = useCallback(async (refresh?: unknown) => {
    // Pull-to-refresh passes an explicit `true`; legacy callers (e.g. the
    // error screen's onClick handler) pass other values and keep the default
    // full-page flow.
    const background = refresh === true;
    if (!token) return;
    if (!background) setError(null);
    try {
      const data = await apiGet<any>('/api/messages', token);
      const convList = Array.isArray(data) ? data : data?.conversations ?? data?.data ?? [];
      const normalizedConversations = convList.map((conv: any) => ({
        id: conv.id,
      type: (conv.type || (conv.isGroup ? 'GROUP' : 'DIRECT')).toLowerCase(),
        name: conv.name || conv.partner?.fullName || conv.partner?.username || 'Conversation',
        avatar: conv.partner?.avatar || conv.avatar,
        lastMessage: conv.lastMessage ? {
          text: conv.lastMessage.content ?? conv.lastMessage.text ?? '',
          sender: conv.lastMessage.sender?.username ?? 'Unknown',
          timestamp: conv.lastMessage.createdAt ?? conv.lastMessage.timestamp,
          read: conv.lastMessage.read ?? false,
          type: conv.lastMessage.type ?? 'TEXT',
          hasAttachments: Array.isArray(conv.lastMessage.attachments) && conv.lastMessage.attachments.length > 0,
        } : undefined,
        unread: conv.unreadCount ?? conv.unread ?? 0,
        online: (conv.type || (conv.isGroup ? 'GROUP' : 'DIRECT')).toUpperCase() === 'DIRECT'
          ? Boolean(conv.partner?.userPresence?.isOnline ?? conv.partner?.isOnline ?? conv.online)
          : false,
        onlineMemberCount: typeof conv.onlineMemberCount === 'number' ? conv.onlineMemberCount : undefined,
        username: conv.partner?.username,
        verified: Boolean(conv.partner?.verified),
        verificationType: conv.partner?.verificationType || undefined,
        lastSeen: conv.partner?.userPresence?.lastActive,
        partnerId: conv.partner?.id,
        memberCount: conv.memberCount,
        currentRole: conv.currentRole,
        entityId: conv.entityId ?? conv.group?.id ?? conv.channel?.id,
        muted: Boolean(conv.mutedAt),
        description: conv.description,
        handle: conv.handle,
        participants: conv.participants ?? conv.members?.map((member: any) => ({ ...member, user: member.user || member })) ?? [],
      }));
      setConversations(normalizedConversations);
      setConversationCursor(data?.nextCursor ?? null);
    } catch (err: any) {
      // A pull-to-refresh failure must not replace the whole chat screen:
      // rethrow so the gesture can show its retry hint instead.
      if (background) throw err;
      setError(err.message || 'Failed to load conversations');
    } finally {
      if (!background) setLoading(false);
    }
  }, [token]);

  const loadMoreConversations = async () => {
    if (!token || !conversationCursor) return;
    try {
      const data = await apiGet<any>(`/api/messages?limit=25&cursor=${encodeURIComponent(conversationCursor)}`, token);
      const next = (data?.conversations ?? []).map((conv: any) => ({
        id: conv.id, type: (conv.type || (conv.isGroup ? 'GROUP' : 'DIRECT')).toLowerCase(), name: conv.name || conv.partner?.fullName || conv.partner?.username || 'Conversation', avatar: conv.partner?.avatar || conv.avatar,
        lastMessage: conv.lastMessage ? { text: conv.lastMessage.content ?? conv.lastMessage.text ?? '', sender: conv.lastMessage.sender?.username ?? 'Unknown', timestamp: conv.lastMessage.createdAt, read: Boolean(conv.lastMessage.read), type: conv.lastMessage.type ?? 'TEXT', hasAttachments: Array.isArray(conv.lastMessage.attachments) && conv.lastMessage.attachments.length > 0 } : undefined,
        unread: conv.unreadCount ?? 0, description: conv.description, handle: conv.handle, participants: conv.participants ?? [], online: (conv.type || (conv.isGroup ? 'GROUP' : 'DIRECT')).toUpperCase() === 'DIRECT' ? Boolean(conv.partner?.userPresence?.isOnline ?? conv.partner?.isOnline ?? conv.online) : false, onlineMemberCount: typeof conv.onlineMemberCount === 'number' ? conv.onlineMemberCount : undefined, username: conv.partner?.username, verified: Boolean(conv.partner?.verified), verificationType: conv.partner?.verificationType || undefined, lastSeen: conv.partner?.userPresence?.lastActive, partnerId: conv.partner?.id, memberCount: conv.memberCount, currentRole: conv.currentRole, entityId: conv.entityId,
      }));
      setConversations(previous => [...previous, ...next.filter((item: Conversation) => !previous.some(existing => existing.id === item.id))]);
      setConversationCursor(data?.nextCursor ?? null);
    } catch (err: any) { showToast?.({ type: 'error', title: 'Could not load more conversations', message: errorMessage(err, { action: 'load more conversations', fallback: 'Please try again.' }) }); }
  };

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!token) return;
    try {
      const data = await apiGet<any>(`/api/messages/${conversationId}?limit=50`, token);
      const msgList = Array.isArray(data) ? data : data?.messages ?? data?.data ?? [];
      setMessages(msgList.map((msg: any) => normalizeMessageRecord(msg, user?.id)).filter((msg: Message) => !msg.deletedAt));
      setMessageCursor(data?.nextCursor ?? null);
      await apiPut<any>(`/api/messages/${conversationId}/read`, {}, token).catch(() => undefined);
      setConversations(previous => previous.map(conversation => conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation));
    } catch (err: any) { showToast?.({ type: 'error', title: 'Chat unavailable', message: errorMessage(err, { action: 'load this conversation', context: 'conversation', fallback: 'Could not load this conversation.' }) }); }
  }, [token, user?.id, showToast]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Keep the global header Chat badge in sync with this page's per-conversation
  // unread state (no page refresh needed). The backend also pushes the same
  // authoritative total via `chat_unread_count`; both converge on the same number.

  useEffect(() => {
    const total = conversations.reduce((sum, conv) => sum + (conv.unread || 0), 0);
    setChatUnread(total);
  }, [conversations, setChatUnread]);

  const normalizeMessage = useCallback((msg: any) => normalizeMessageRecord(msg, user?.id), [user?.id]);

  const loadOlderMessages = async () => {
    if (!token || !activeConversation || !messageCursor || loadingOlder) return;
    const viewport = messagesViewportRef.current;
    const prevScrollHeight = viewport?.scrollHeight ?? 0;
    const prevScrollTop = viewport?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const data = await apiGet<any>(`/api/messages/${activeConversation}?limit=50&cursor=${encodeURIComponent(messageCursor)}`, token);
      const older = (data?.messages ?? [])
        .map((msg: any) => normalizeMessageRecord(msg, user?.id))
        .filter((msg: Message) => !msg.deletedAt);
      setMessages(previous => [...older, ...previous]);
      setMessageCursor(data?.nextCursor ?? null);
      // Keep the reader exactly where they were after older messages are
      // prepended above the current viewport (prevents a jarring jump).
      const raf = window.requestAnimationFrame(() => {
        const target = messagesViewportRef.current;
        if (target) target.scrollTop = (target.scrollHeight - prevScrollHeight) + prevScrollTop;
      });
      window.setTimeout(() => window.cancelAnimationFrame(raf), 5000);
    } catch (err: any) { showToast?.({ type: 'error', title: 'Could not load older messages', message: errorMessage(err, { action: 'load older messages', fallback: 'Please try again.' }) }); }
    finally { setLoadingOlder(false); }
  };

  const clearTypingFor = (conversationId: string) => {
    setTypingByConversation(previous => {
      if (!previous[conversationId]) return previous;
      const next = { ...previous };
      delete next[conversationId];
      return next;
    });
    if (activeConversationRef.current === conversationId) setTypingUserId(null);
  };

  const stopOutgoingTyping = () => {
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      socketRef.current?.emit('typing:stop', { conversationId: activeConversationRef.current });
    }
    if (typingRenewRef.current) { clearInterval(typingRenewRef.current); typingRenewRef.current = null; }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  };

  const startVoiceRecording = async () => {
    if (recordingState !== 'idle' || !activeConversation) return;
    setRecordingError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Voice messages are not supported in this browser.');
      showToast?.({ type: 'error', title: 'Recording unavailable', message: 'Your browser does not support voice messages.' });
      return;
    }
    // Microphone access (getUserMedia) requires a secure context (HTTPS or
    // localhost). On a plain-HTTP LAN address navigator.mediaDevices is
    // undefined, and on insecure origins the request would fail anyway.
    if (!isSecureMediaContext()) {
      setRecordingError('Voice messages require a secure connection. Please open VANTA using HTTPS (or on localhost).');
      showToast?.({ type: 'error', title: 'Secure connection required', message: 'Open VANTA over HTTPS to record voice notes.' });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      // Map the raw browser error into a consistent VANTA message. This keeps
      // raw errors (e.g. NotAllowedError) out of the UI while giving the user a
      // precise, actionable explanation for camera/mic denial, missing hardware,
      // contention, unsupported browsers, and insecure contexts.
      const issue = mapMediaError(error, 'microphone');
      setRecordingError(issue.message);
      // technical detail is logged for developers by mapMediaError consumers.
      showToast?.({
        type: 'error',
        title: issue.title,
        message: issue.message,
      });
      return;
    }
    recordingStreamRef.current = stream;
    const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg'];
    const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recordingChunksRef.current = [];
    recordingDurationRef.current = 0;
    recordingCancelledRef.current = false;
    recorder.addEventListener('dataavailable', (event: BlobEvent) => { if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data); });
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      if (recordingCancelledRef.current) {
        recordingCancelledRef.current = false;
        return;
      }
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size === 0) { clearVoiceState(); return; }
      recordingBlobRef.current = blob;
      recordingPreviewUrlRef.current = URL.createObjectURL(blob);
      setRecordingDuration(recordingDurationRef.current);
      setRecordingState('ready');
    });
    recorder.start();
    setRecordingState('recording');
    recordingStartedAtRef.current = Date.now();
    if (recordingTickRef.current) clearInterval(recordingTickRef.current);
    recordingTickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      recordingDurationRef.current = elapsed;
      setRecordingDuration(elapsed);
      if (elapsed >= 120) stopRecordingPhase();
    }, 500);
  };

  const stopRecordingPhase = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (recordingTickRef.current) clearInterval(recordingTickRef.current);
    recorder.stop();
  };

  const clearVoiceState = () => {
    if (recordingTickRef.current) clearInterval(recordingTickRef.current);
    recordingBlobRef.current = null;
    if (recordingPreviewUrlRef.current) { URL.revokeObjectURL(recordingPreviewUrlRef.current); recordingPreviewUrlRef.current = null; }
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    setRecordingError(null);
    setRecordingState('idle');
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recordingTickRef.current) clearInterval(recordingTickRef.current);
    recordingCancelledRef.current = true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (recordingStreamRef.current) { recordingStreamRef.current.getTracks().forEach(track => track.stop()); recordingStreamRef.current = null; }
    clearVoiceState();
  };

  const sendVoiceNote = async () => {
    if (!token || !user || !activeConversation || recordingState !== 'ready') return;
    const blob = recordingBlobRef.current;
    if (!blob) return;
    const mimeType = blob.type || 'audio/webm';
    const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });
    setRecordingState('uploading');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('conversationId', activeConversation);
      const uploaded = await apiUpload<any>('/api/upload/message', form, token);
      const url = uploaded.url ?? uploaded.data?.url;
      const fileId = uploaded.fileId ?? uploaded.id ?? uploaded.data?.fileId;
      if (!url || !fileId) throw new Error('Upload did not return a usable attachment');
      await sendCurrentMessage('', [{ fileId, url, fileType: 'AUDIO', fileName: file.name, fileSize: file.size }]);
    } catch (err: any) {
      if (err?.statusCode === 499) { clearVoiceState(); return; }
      setRecordingState('ready');
      showToast?.({ type: 'error', title: 'Voice note not sent', message: errorMessage(err, { action: 'send the voice note', fallback: 'The recording could not be uploaded. Try again.' }) });
      return;
    }
    clearVoiceState();
  };

  const trackMessageSwipe = (event: React.PointerEvent, message: Message) => {
    const start = swipeStartRef.current;
    if (!start || start.id !== message.id || message.pending) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    // Vertical intent -> hand the gesture back to the scroll container.
    if (Math.abs(dy) > Math.abs(dx)) { swipeStartRef.current = null; setSwipeOffset(null); return; }
    if (dx < 0) { setSwipeOffset(null); return; }
    const offset = Math.min(76, Math.max(0, dx * 0.55));
    start.offset = offset;
    if (offset <= 0) { swipeOffsetRef.current = 0; setSwipeOffset(null); }
    else if (Math.abs(offset - swipeOffsetRef.current) >= 1.25) { swipeOffsetRef.current = offset; setSwipeOffset({ id: message.id, offset }); }
  };

  const finishMessageSwipe = () => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    swipeOffsetRef.current = 0;
    if (!start) { setSwipeOffset(null); return; }
    setSwipeOffset(null);
    if (start.offset < 56) return;
    const target = messages.find(message => message.id === start.id);
    if (!target || target.pending) return;
    setReplyingTo(createReply(activeConversation as string, target));
    if ('vibrate' in navigator) navigator.vibrate(14);
  };

  useEffect(() => {
    if (!token || !user?.id) return;
    const socket = createSocket(token, `messages-page-${user.id}`);
    socketRef.current = socket;
    const onMessage = (raw: any) => {
      const message = normalizeMessage(raw);
      // A message that arrives already deleted never enters the visible list.
      if (message.deletedAt) return;
      if (message.conversationId === activeConversationRef.current) {
        setMessages(previous => previous.some(item => item.id === message.id) ? previous.map(item => item.id === message.id ? message : item) : [...previous.filter(item => !(item.pending && item.text === message.text && item.senderId === message.senderId)), message]);
        apiPut<any>(`/api/messages/${message.conversationId}/read`, {}, token).catch(() => undefined);
      }
      fetchConversations();
    };
    // `message:updated` and `message:deleted` share one handler: an updated/deleted
    // message must finish its lifecycle in the same place. Deleted messages are
    // removed entirely (no placeholder) — the conversation behaves as if they
    // never existed. On refresh / other devices the backend omits them too.
    const onUpdated = (raw: any) => {
      const message = normalizeMessage(raw);
      if (message.deletedAt) {
        setMessages(previous => previous.filter(item => item.id !== message.id));
      } else {
        setMessages(previous => previous.map(item => item.id === message.id ? message : item));
      }
      fetchConversations();
    };
    const onRead = (data: any) => { if (data.readerId !== user.id) setMessages(previous => previous.map(item => item.isOwn ? { ...item, read: true } : item)); fetchConversations(); };
    const onPresence = (data: any) => setConversations(previous => previous.map(conversation => {
      if (conversation.type === 'direct') {
        return conversation.partnerId === data.userId ? { ...conversation, online: data.isOnline, lastSeen: data.lastActive } : conversation;
      }
      if (conversation.type === 'group' && conversation.participants?.some((p: any) => (p.id ?? p.userId) === data.userId)) {
        const participants = (conversation.participants || []).map((p: any) =>
          (p.id ?? p.userId) === data.userId ? { ...p, userPresence: { ...(p.userPresence || {}), isOnline: data.isOnline, lastActive: data.lastActive } } : p
        );
        return { ...conversation, participants, onlineMemberCount: participants.filter((p: any) => p.userPresence?.isOnline).length };
      }
      return conversation;
    }));
    const onTyping = (data: any) => {
      if (data.conversationId === activeConversationRef.current) setTypingUserId(data.typing ? data.userId : null);
      setTypingByConversation(previous => {
        const next = { ...previous };
        if (data.typing) next[data.conversationId] = true;
        else delete next[data.conversationId];
        return next;
      });
      // Auto-expire typing state so it never sticks after a dropped connection.
      if (typingExpiryRef.current[data.conversationId]) clearTimeout(typingExpiryRef.current[data.conversationId]);
      if (data.typing) {
        typingExpiryRef.current[data.conversationId] = setTimeout(() => clearTypingFor(data.conversationId), 5000);
      }
    };
    socket.on('message:new', onMessage); socket.on('message:updated', onUpdated); socket.on('message:deleted', onUpdated); socket.on('messages:read', onRead); socket.on('presence:changed', onPresence); socket.on('typing:changed', onTyping); socket.on('conversations:refresh', fetchConversations);
    socket.connect();
    return () => { socket.off('message:new', onMessage); socket.off('message:updated', onUpdated); socket.off('message:deleted', onUpdated); socket.off('messages:read', onRead); socket.off('presence:changed', onPresence); socket.off('typing:changed', onTyping); socket.off('conversations:refresh', fetchConversations); socket.disconnect(); stopOutgoingTyping(); };
  }, [token, user?.id, fetchConversations, normalizeMessage]);

  // Global cleanups when the chat screen unmounts.
  useEffect(() => () => {
    Object.values(typingExpiryRef.current).forEach(timer => clearTimeout(timer));
    if (recordingStreamRef.current) recordingStreamRef.current.getTracks().forEach(track => track.stop());
    if (recordingTickRef.current) clearInterval(recordingTickRef.current);
  }, []);

  const handleSelectConversation = (id: string) => {
    stopOutgoingTyping();
    // Leaving a conversation cancels any unsent reply/edits — a reply belongs to
    // the exact conversation it was created in, never to the whole messaging app.
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageInput('');
    if (activeConversationRef.current) socketRef.current?.emit('leave_conversation', activeConversationRef.current);
    activeConversationRef.current = id;
    previousLastMessageIdRef.current = null;
    initialScrollDoneRef.current = false;
    setFirstUnreadId(null);
    setPendingNewMessage(false);
    setActiveConversation(id);
    setShowMobileList(false);
    setDetailsOpen(false);
    fetchMessages(id);
    socketRef.current?.emit('conversation:join', id);
    if (searchParams.get('conversation') !== id) {
      router.push(`/chat?conversation=${encodeURIComponent(id)}`, { scroll: false });
    }
  };

  const handleCloseConversation = useCallback(() => {
    if (typingActiveRef.current) { typingActiveRef.current = false; socketRef.current?.emit('typing:stop', { conversationId: activeConversationRef.current }); }
    if (typingRenewRef.current) { clearInterval(typingRenewRef.current); typingRenewRef.current = null; }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (activeConversationRef.current) {
      socketRef.current?.emit('leave_conversation', activeConversationRef.current);
    }
    activeConversationRef.current = null;
    previousLastMessageIdRef.current = null;
    initialScrollDoneRef.current = false;
    setFirstUnreadId(null);
    setPendingNewMessage(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageInput('');
    setActiveConversation(null);
    setMessages([]);
    setShowMobileList(true);
    setDetailsOpen(false);
    router.replace('/chat', { scroll: false });
  }, [router]);

  const handleLeaveActiveConversation = async () => {
    if (!token || !activeConv || activeConv.type === 'direct') return;
    const entityId = activeConv.entityId || activeConv.id;
    setIsLeaving(true);
    try {
      if (activeConv.type === 'channel') {
        await apiPost<any>(`/api/channels/${entityId}/leave`, {}, token);
      } else {
        await apiDelete<any>(`/api/groups/${entityId}/members/${encodeURIComponent(user?.id || '')}`, token);
      }
      showToast?.({ type: 'success', title: activeConv.type === 'group' ? 'Left group' : 'Left channel', message: `You left ${activeConv.name}.` });
      setLeaveDialog(false);
      invalidateCache('api/messages');
      handleCloseConversation();
      fetchConversations();
    } catch (err: any) {
      showToast?.({ type: 'error', title: 'Could not leave', message: errorMessage(err, { action: 'leave', context: activeConv?.type === 'channel' ? 'channel' : 'group', fallback: 'Please try again.' }) });
    } finally {
      setIsLeaving(false);
    }
  };


  useEffect(() => {