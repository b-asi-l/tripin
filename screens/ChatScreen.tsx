
import React, { useState, useEffect, useRef } from 'react';
import { Message, Booking, User } from '../types';
import { Icons } from '../constants';
import { chatService } from '../services/firebaseService';

interface Props {
  booking: Booking;
  currentUser: User;
  onBack: () => void;
}

export const ChatScreen: React.FC<Props> = ({ booking, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Determine the other user's name/avatar relative to current user
  const isRider = currentUser.id === booking.userId;
  const otherName = booking.ownerName; // Currently the booking object stores the Driver's name as ownerName
  const otherAvatar = booking.ownerAvatar; 

  const chatId = booking.id;

  useEffect(() => {
    let unsubscribe: () => void;

    const initChat = async () => {
      setInitializing(true);
      setError(null);
      
      // Ensure the chat document exists with correct participants
      const participants = [String(booking.userId), String(booking.driverId)];
      const { success, error: initError } = await chatService.ensureChatExists(chatId, participants);
      
      if (!success) {
        console.error("Failed to initialize chat:", initError);
        setError("Could not start chat session. " + (initError?.code || ''));
        setInitializing(false);
        return;
      }

      setInitializing(false);

      // Start Listening
      unsubscribe = chatService.listenToMessages(chatId, (incomingMessages) => {
        const formattedMessages = incomingMessages.map(msg => ({
          id: msg.id,
          senderId: msg.senderId,
          text: msg.text,
          timestamp: msg.timestamp,
          isMe: msg.senderId === currentUser.id
        }));
        setMessages(formattedMessages);
        setError(null);
      }, (err) => {
        if (err.code === 'permission-denied') {
            setError("Chat access denied. Participants only.");
        } else {
            setError("Connection error: " + err.code);
        }
      });
    };

    if (chatId && currentUser.id) {
        initChat();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, currentUser.id, booking.userId, booking.driverId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const textToSend = input;
    setInput(''); // Optimistic clear

    // Refactored call: senderId is no longer passed as it's handled in service for security
    const { error: sendError } = await chatService.sendMessage(chatId, textToSend);
    if (sendError) {
        alert("Failed to send message: " + sendError);
        setInput(textToSend); // Restore on failure
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface">
        <div className="p-4 border-b border-subtle flex items-center gap-4 bg-surface/95 backdrop-blur-sm sticky top-0 z-10">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-alt transition-colors active:bg-subtle text-lg">←</button>
            <img src={otherAvatar} className="w-10 h-10 rounded-full border border-subtle" />
            <div>
                <h3 className="text-sm font-black uppercase text-main">{otherName}</h3>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">
                       {initializing ? 'Connecting...' : 'Online'}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-alt/50">
            {error && (
                <div className="bg-rose-100 text-rose-700 p-4 rounded-2xl text-xs font-bold text-center border border-rose-200">
                    {error}
                </div>
            )}
            
            {initializing && !error && (
                <div className="flex justify-center p-4">
                     <div className="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
                </div>
            )}

            {messages.length === 0 && !error && !initializing && (
                <div className="flex flex-col items-center justify-center h-full opacity-30">
                     <div className="w-16 h-16 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white mb-4">
                        <Icons.Send className="w-8 h-8" />
                     </div>
                     <p className="text-xs font-bold uppercase tracking-widest">Start the conversation</p>
                </div>
            )}
            {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${msg.isMe ? 'bg-[var(--color-primary)] text-white rounded-br-none' : 'bg-white text-main border border-subtle rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            <div ref={endRef} />
        </div>

        <div className="p-4 border-t border-subtle bg-surface pb-[calc(1rem+env(safe-area-inset-bottom,20px))]">
            <div className="relative flex items-center gap-2">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={!!error || initializing}
                    placeholder={error ? "Disconnected" : "Type a message..."}
                    className="flex-1 bg-surface-alt p-4 rounded-full font-bold text-sm text-main border border-subtle focus:border-[var(--color-primary)] outline-none transition-colors disabled:opacity-50"
                />
                <button onClick={handleSend} disabled={!!error || initializing} className="p-4 bg-[var(--color-primary)] text-white rounded-full shadow-lg active:scale-95 transition-all shrink-0 disabled:opacity-50">
                    <Icons.Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};
