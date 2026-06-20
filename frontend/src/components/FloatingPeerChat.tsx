import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Send, MessageSquare, Clock, X, MessageCircle, Sparkles } from 'lucide-react';
import api from '@/api/axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingPeerChat() {
    const currentUser = useAuthStore((state) => state.user);
    const token = useAuthStore((state) => state.token);

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // If user is not authenticated, don't show the floating chat
    if (!token || !currentUser) return null;

    const fetchMessages = async () => {
        try {
            const res = await api.get('/gamification/chat/');
            setMessages(res.data || []);
        } catch (err) {
            console.error('Failed to fetch chat messages:', err);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [isOpen]);

    // Auto scroll to latest message when open or when messages change
    useEffect(() => {
        if (isOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const res = await api.post('/gamification/chat/', { text: newMessage.trim() });
            setMessages((prev) => [...prev, res.data]);
            setNewMessage('');
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    };

    const formatChatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            return date.toLocaleDateString();
        } catch {
            return '';
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[999]">
            {/* FLOATING ACTION BUTTON */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`w-14 h-14 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all border border-white/20 focus:outline-none relative`}
                aria-label="Toggle Peer Study Room Chat"
            >
                {isOpen ? (
                    <X size={24} className="animate-spin-slow" />
                ) : (
                    <MessageSquare size={24} />
                )}
                {/* Active Indicator Pulse */}
                <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
                </span>
            </motion.button>

            {/* CHAT WINDOW PANEL */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: 50, x: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 50, x: 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="absolute bottom-20 right-0 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] bg-sidebar border border-border rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border bg-bg-secondary/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                                <h3 className="font-black text-sm text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-amber-500" />
                                    Peer Study Room
                                </h3>
                            </div>
                            <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                                <Clock size={10} /> 24-Hour Limit
                            </span>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-bg/10">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-bg border border-border flex items-center justify-center text-text-muted">
                                        <MessageCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-text-primary">No comments yet</p>
                                        <p className="text-[10px] text-text-secondary mt-0.5 max-w-[200px] mx-auto leading-relaxed">
                                            Start the conversation! Messages automatically delete after 24 hours.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((msg) => {
                                        const isOwnMessage = msg.user === currentUser?.id;
                                        const senderName = msg.user_detail?.full_name || 'Student';
                                        
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-start gap-2.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                                            >
                                                {/* Sender avatar */}
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm ${
                                                    isOwnMessage ? 'bg-primary' : 'bg-slate-500'
                                                }`}>
                                                    {senderName.substring(0, 1).toUpperCase()}
                                                </div>

                                                {/* Chat bubble body */}
                                                <div className="max-w-[75%] space-y-0.5">
                                                    <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : ''}`}>
                                                        <span className="text-[9px] font-black text-text-primary truncate max-w-[100px]">{isOwnMessage ? 'You' : senderName}</span>
                                                        <span className="text-[7px] font-bold text-text-muted">{formatChatTime(msg.created_at)}</span>
                                                    </div>
                                                    <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed break-words shadow-sm border ${
                                                        isOwnMessage 
                                                            ? 'bg-primary/10 border-primary/20 text-text-primary rounded-tr-none' 
                                                            : 'bg-card border-border text-text-primary rounded-tl-none'
                                                    }`}>
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-bg/30">
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a study comment..."
                                    className="w-full bg-card border border-border rounded-2xl py-3 pl-4 pr-12 text-xs font-semibold text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    maxLength={250}
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="absolute right-1.5 p-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center"
                                >
                                    <Send size={12} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
