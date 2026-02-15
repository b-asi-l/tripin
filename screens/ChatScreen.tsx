import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { Icons } from '../constants';

interface Props {
  otherName: string;
  otherAvatar: string;
  onBack: () => void;
}

export const ChatScreen: React.FC<Props> = ({ otherName, otherAvatar, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', senderId: 'other', text: 'Hey! I will be at the pickup point in 10 mins.', timestamp: Date.now() - 60000, isMe: false }
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: input,
      timestamp: Date.now(),
      isMe: true
    };
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    // Simulate reply
    setTimeout(() => {
        const reply: Message = {
            id: (Date.now() + 1).toString(),
            senderId: 'other',
            text: 'Okay, see you soon!',
            timestamp: Date.now(),
            isMe: false
        };
        setMessages(prev => [...prev, reply]);
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col bg-surface">
        <div className="p-6 border-b border-subtle flex items-center gap-4 bg-surface/90 backdrop-blur-md sticky top-0 z-10">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-alt transition-colors">←</button>
            <img src={otherAvatar} className="w-10 h-10 rounded-full border border-subtle" />
            <div>
                <h3 className="text-sm font-black uppercase text-main">{otherName}</h3>
                <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">Online</p>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-alt/50">
            {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${msg.isMe ? 'bg-[var(--color-primary)] text-white rounded-br-none' : 'bg-white text-main border border-subtle rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            <div ref={endRef} />
        </div>

        <div className="p-6 border-t border-subtle bg-surface">
            <div className="relative">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="w-full bg-surface-alt p-4 pr-14 rounded-full font-bold text-sm text-main border border-subtle focus:border-[var(--color-primary)] outline-none"
                />
                <button onClick={handleSend} className="absolute right-2 top-2 p-2 bg-[var(--color-primary)] text-white rounded-full shadow-lg active:scale-95 transition-all">
                    <Icons.Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};