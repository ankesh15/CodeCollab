import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  MessageSummary,
  SOCKET_EVENTS,
  MessageNewPayload,
  MessageDeletePayload,
} from '@codecollab/shared';
import { fetchRoomMessagesApi, deleteMessageApi } from '../lib/api';
import { Send, Trash2, MessageSquare } from 'lucide-react';

interface RoomChatProps {
  roomId: string;
  currentUserId: string;
  socket: Socket | null;
}

export const RoomChat: React.FC<RoomChatProps> = ({ roomId, currentUserId, socket }) => {
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [unreadNewMessagesCount, setUnreadNewMessagesCount] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);

  // 1. Check if user is scrolled near bottom (within 80px)
  const checkIfNearBottom = () => {
    if (!scrollContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    return distanceToBottom <= 80;
  };

  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setUnreadNewMessagesCount(0);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
    setUnreadNewMessagesCount(0);
    isNearBottomRef.current = true;
  };

  // 2. Fetch initial messages
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchRoomMessagesApi(roomId, 50)
      .then((data) => {
        if (!isMounted) return;
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
        setLoading(false);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load chat history.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  // 3. Load older messages (Pagination upward)
  const handleLoadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await fetchRoomMessagesApi(roomId, 50, nextCursor);
      setMessages((prev) => [...data.messages, ...prev]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 4. Register real-time Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload: MessageNewPayload) => {
      if (payload.message.roomId !== roomId) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) {
          return prev;
        }
        return [...prev, payload.message];
      });

      if (isNearBottomRef.current || payload.message.userId === currentUserId) {
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        setUnreadNewMessagesCount((count) => count + 1);
      }
    };

    const handleMessageDeleted = (payload: MessageDeletePayload) => {
      if (payload.roomId !== roomId) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
    };

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, handleMessageDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETE, handleMessageDeleted);
    };
  }, [socket, roomId, currentUserId]);

  // 5. Send message handler
  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed || trimmed.length > 2000 || sending) return;

    if (socket && socket.connected) {
      setSending(true);
      socket.emit(SOCKET_EVENTS.MESSAGE_SEND, { roomId, content: trimmed });
      setInputText('');
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 6. Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessageApi(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const charCount = inputText.length;
  const isOverLimit = charCount > 2000;
  const isSendDisabled = !inputText.trim() || isOverLimit || sending;

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <h3 className="text-sm font-semibold text-slate-900">Room Chat</h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">{messages.length} messages</span>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-3 relative custom-scrollbar bg-slate-50/50"
      >
        {/* Load older messages button */}
        {nextCursor && (
          <div className="text-center pb-2">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="text-xs px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-full transition-colors font-medium disabled:opacity-50 shadow-sm"
            >
              {loadingOlder ? 'Loading older...' : 'Load previous messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm space-y-2 py-8">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading conversation...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-rose-600 text-sm py-8 space-y-2">
            <span>⚠️ {error}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm py-12 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-400 mb-1" />
            <span className="font-semibold text-slate-800">No messages yet</span>
            <span className="text-xs text-slate-500">Start the conversation with your team.</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`group flex flex-col space-y-1 max-w-[85%] ${
                  isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 px-1">
                  <span className="font-semibold text-slate-800">
                    {isMe ? 'You' : msg.username}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="relative group/bubble">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Message Delete Action */}
                  {isMe && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Unread Scroll Down Button */}
      {unreadNewMessagesCount > 0 && (
        <div className="absolute bottom-20 right-6 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-md transition-all animate-bounce"
          >
            <span>↓</span>
            <span>{unreadNewMessagesCount} new {unreadNewMessagesCount === 1 ? 'message' : 'messages'}</span>
          </button>
        </div>
      )}

      {/* Input Box Area */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-col space-y-2">
        <div className="relative flex items-end space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-none max-h-24 custom-scrollbar transition-colors"
          />

          <button
            onClick={handleSendMessage}
            disabled={isSendDisabled}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1 shadow-sm shrink-0"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Character Indicator */}
        <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-mono">
          <span>Enter to send, Shift+Enter for newline</span>
          <span className={isOverLimit ? 'text-rose-600 font-bold' : ''}>
            {charCount} / 2000
          </span>
        </div>
      </div>
    </div>
  );
};
