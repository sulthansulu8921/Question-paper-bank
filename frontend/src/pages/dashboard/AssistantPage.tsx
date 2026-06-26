import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, User, Send, Plus, Trash2, Sparkles, Loader2, Lock, ShieldOff, CreditCard } from 'lucide-react';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

interface ChatSession {
    id: number;
    title: string;
    created_at: string;
}

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export default function AssistantPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const { hasAIAccess, isLoading: subLoading } = useSubscriptionAccess();

    const questionContext = location.state?.question;

    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Chat Sessions
    const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
        queryKey: ['chat-sessions'],
        queryFn: async () => (await api.get('/assistant/sessions/')).data,
    });

    // Fetch Messages for active session
    const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
        queryKey: ['chat-messages', activeSessionId],
        queryFn: async () => {
            if (!activeSessionId) return [];
            return (await api.get(`/assistant/sessions/${activeSessionId}/messages/`)).data;
        },
        enabled: activeSessionId !== null,
    });

    // Create session mutation
    const createSessionMutation = useMutation({
        mutationFn: async (title: string) => {
            return (await api.post('/assistant/sessions/', { title })).data;
        },
        onSuccess: (newSession) => {
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
            setActiveSessionId(newSession.id);
        }
    });

    // Delete session mutation
    const deleteSessionMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/assistant/sessions/${id}/`);
        },
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
            if (activeSessionId === deletedId) {
                setActiveSessionId(null);
            }
        }
    });

    // Auto-create/select chat if question context is present
    useEffect(() => {
        if (questionContext && sessions.length >= 0 && !sessionsLoading) {
            // Find if there is a session with question title or create new
            const contextTitle = `Q: ${questionContext.topic?.name || 'Question'} - ${questionContext.source}`;
            const existing = sessions.find(s => s.title === contextTitle || s.title.includes(questionContext.source));
            
            if (existing) {
                setActiveSessionId(existing.id);
            } else {
                createSessionMutation.mutate(contextTitle);
            }
            // Clear location state to prevent loop
            navigate(location.pathname, { replace: true, state: {} });
        } else if (!activeSessionId && sessions.length > 0 && !sessionsLoading) {
            setActiveSessionId(sessions[0].id);
        }
    }, [questionContext, sessions, sessionsLoading]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || isSending) return;

        let sessionId = activeSessionId;
        
        // Create session if none active
        if (!sessionId) {
            try {
                const newSess = await api.post('/assistant/sessions/', { title: 'New Chat' });
                sessionId = newSess.data.id;
                setActiveSessionId(sessionId);
                queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
            } catch (err) {
                console.error(err);
                return;
            }
        }

        const userMsg = messageText;
        setMessageText('');
        setIsSending(true);

        // Optimistically add user message to query cache
        queryClient.setQueryData<ChatMessage[]>(['chat-messages', sessionId], (old = []) => [
            ...old,
            { id: Date.now(), role: 'user', content: userMsg, created_at: new Date().toISOString() }
        ]);

        try {
            await api.post(`/assistant/sessions/${sessionId}/message/`, {
                message: userMsg,
                question_id: questionContext?.id || null
            });
            queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSending(false);
        }
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);

    // Simple markdown link/bold/alert list-renderer for demo + gemini outputs
    const renderContent = (content: string) => {
        // Parse simple github-style notes or bold/bullet formatting
        return content.split('\n').map((line, i) => {
            let processedLine = line;
            
            // Check for Alert Block
            if (line.startsWith('> [!NOTE]')) {
                return (
                    <div key={i} className="my-2 p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold text-[10px] tracking-wider uppercase flex items-center gap-2">
                        <Sparkles size={12} />
                        <span>Demo Mode Active</span>
                    </div>
                );
            }
            if (line.startsWith('>')) {
                processedLine = line.replace('>', '').trim();
                return <blockquote key={i} className="border-l-4 border-primary/30 pl-4 py-1 my-2 text-text-secondary italic text-xs leading-relaxed">{processedLine}</blockquote>;
            }

            // Tables rendering
            if (line.startsWith('|')) {
                const cols = line.split('|').map(c => c.trim()).filter(c => c);
                if (cols.length > 0 && !line.includes('---')) {
                    return (
                        <div key={i} className="grid grid-cols-3 gap-2 py-2 border-b border-border font-bold text-[10px] text-text-primary uppercase tracking-wide">
                            {cols.map((col, idx) => <span key={idx}>{col}</span>)}
                        </div>
                    );
                }
                return null;
            }

            // Bold styling helper
            const boldRegex = /\*\*(.*?)\*\*/g;
            const parts = [];
            let lastIndex = 0;
            let match;
            while ((match = boldRegex.exec(processedLine)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(processedLine.substring(lastIndex, match.index));
                }
                parts.push(<strong key={match.index} className="font-extrabold text-primary">{match[1]}</strong>);
                lastIndex = boldRegex.lastIndex;
            }
            if (lastIndex < processedLine.length) {
                parts.push(processedLine.substring(lastIndex));
            }

            if (line.startsWith('### ')) {
                return <h3 key={i} className="text-sm font-black text-text-primary uppercase tracking-wide mt-4 mb-2">{parts.length > 0 ? parts : processedLine.replace('### ', '')}</h3>;
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 list-disc text-xs text-text-secondary leading-relaxed my-1">{parts.length > 0 ? parts : processedLine.replace('- ', '')}</li>;
            }

            return <p key={i} className="text-xs text-text-secondary leading-relaxed my-1.5 min-h-[1rem]">{parts.length > 0 ? parts : processedLine}</p>;
        });
    };

    // ── Subscription Gate ─────────────────────────────────────────────────────
    if (!subLoading && !hasAIAccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-[75vh] flex flex-col items-center justify-center text-center px-8 bg-bg"
            >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mb-6 border border-violet-500/20">
                    <Lock size={36} className="text-violet-500" />
                </div>
                <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-600 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest mb-4">
                    <ShieldOff size={12} /> AI Feature Locked
                </div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight mb-3">AI Tutor Locked</h2>
                <p className="text-sm text-text-secondary font-medium leading-relaxed max-w-sm mb-8">
                    The AI Study Assistant is a premium feature. Upgrade your plan to unlock unlimited AI tutoring sessions, instant doubt resolution, and personalized study guidance.
                </p>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all"
                >
                    <CreditCard size={18} /> Upgrade to Premium
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6.5rem)] rounded-3xl border border-border bg-card overflow-hidden shadow-xl">
            {/* LEFT SIDEBAR: CHAT HISTORY */}
            <aside className="w-80 border-r border-border bg-bg-secondary/20 flex flex-col shrink-0">
                <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                    <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">Tutor Sessions</h3>
                    <button
                        onClick={() => createSessionMutation.mutate('New Chat')}
                        className="p-2 bg-primary hover:bg-opacity-90 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
                    >
                        <Plus size={14} />
                        New
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
                    {sessionsLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <Loader2 className="animate-spin text-primary" size={24} />
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Loading Chats...</span>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-10 text-text-muted space-y-2">
                            <Bot className="mx-auto" size={28} />
                            <p className="text-[10px] font-bold uppercase tracking-wider">No Chat Sessions</p>
                        </div>
                    ) : (
                        sessions.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            return (
                                <div
                                    key={sess.id}
                                    className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer border transition-all ${
                                        isActive
                                            ? 'bg-primary/5 border-primary/20 shadow-sm'
                                            : 'border-transparent hover:bg-bg-secondary/40'
                                    }`}
                                    onClick={() => setActiveSessionId(sess.id)}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Bot size={16} className={isActive ? 'text-primary' : 'text-text-muted'} />
                                        <span className={`text-[11px] font-bold truncate ${isActive ? 'text-primary font-black' : 'text-text-secondary'}`}>
                                            {sess.title}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSessionMutation.mutate(sess.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-all shrink-0"
                                        title="Delete Chat"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>

            {/* MAIN PANEL: CHAT WINDOW */}
            <main className="flex-1 flex flex-col min-w-0 bg-card">
                {/* Header */}
                <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-bg-secondary/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-text-primary truncate">
                                {activeSession ? activeSession.title : 'AI Study Assistant'}
                            </h4>
                            <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Online & Ready to help
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                            <Sparkles size={12} className="text-primary animate-pulse" />
                            <span className="text-[9px] text-text-secondary font-extrabold uppercase">AI Credits:</span>
                            <span className="text-xs font-black text-primary">{user?.ai_credits ?? 0}</span>
                        </div>
                        <button
                            onClick={() => navigate('/dashboard/subscription')}
                            className="text-[9px] font-black uppercase tracking-wider text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-all"
                        >
                            Buy Pack
                        </button>
                    </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-bg/25">
                    {activeSessionId === null ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-md mx-auto">
                            <div className="w-20 h-20 bg-primary/5 rounded-[2rem] flex items-center justify-center text-primary border border-primary/15 relative">
                                <Bot size={40} />
                                <Sparkles className="absolute -top-1 -right-1 text-accent fill-accent" size={16} />
                            </div>
                            <div>
                                <h3 className="text-md font-black text-text-primary uppercase tracking-wider">Start an AI Tutor Session</h3>
                                <p className="text-xs text-text-muted font-bold mt-2 leading-relaxed">
                                    Create a new chat session to ask doubts, review formulas, understand ledger accounts, or summarize accounting concepts.
                                </p>
                            </div>
                            <button
                                onClick={() => createSessionMutation.mutate('New Chat')}
                                className="px-6 py-3 bg-primary hover:bg-opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
                            >
                                Create First Session
                            </button>
                        </div>
                    ) : messagesLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Retrieving chat log...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Welcome Assistant Message */}
                            {messages.length === 0 && (
                                <div className="flex gap-4 p-4 bg-primary/[0.02] border border-primary/10 rounded-3xl max-w-2xl">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                        <Bot size={16} />
                                    </div>
                                    <div className="space-y-1">
                                        <h5 className="text-[10px] font-black text-primary uppercase tracking-widest">qubook.in AI Tutor</h5>
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Hello! I am your interactive AI study tutor. Ask me any doubts about accounting policies, ledger entries, company audits, or select any question to explain step-by-step.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {messages.map((msg) => {
                                const isBot = msg.role === 'assistant';
                                return (
                                    <div key={msg.id} className={`flex gap-3.5 ${isBot ? 'justify-start' : 'justify-end'}`}>
                                        {isBot && (
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                                <Bot size={16} />
                                            </div>
                                        )}
                                        <div className={`p-4 rounded-3xl max-w-[80%] shadow-sm border ${
                                            isBot 
                                                ? 'bg-card border-border text-text-primary rounded-tl-none' 
                                                : 'bg-primary border-primary-hover text-white rounded-tr-none'
                                        }`}>
                                            <span className={`text-[8px] font-black uppercase tracking-wider block mb-1 ${isBot ? 'text-primary' : 'text-white/60'}`}>
                                                {isBot ? 'qubook.in AI Tutor' : user?.first_name || 'Student'}
                                            </span>
                                            <div className={isBot ? 'text-text-primary' : 'text-white'}>
                                                {isBot ? renderContent(msg.content) : <p className="text-xs font-semibold leading-relaxed">{msg.content}</p>}
                                            </div>
                                        </div>
                                        {!isBot && (
                                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 font-black text-[10px]">
                                                <User size={16} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {isSending && (
                                <div className="flex gap-3.5 justify-start">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                        <Bot size={16} />
                                    </div>
                                    <div className="p-4 bg-card border border-border rounded-3xl rounded-tl-none flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Tray */}
                {activeSessionId !== null && (
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-bg-secondary/15 shrink-0">
                        <div className="flex gap-3 items-end">
                            <textarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                placeholder="Type your doubt or ask about ledger rules..."
                                className="flex-1 px-4 py-3 bg-card border border-border rounded-2xl text-xs font-bold text-text-primary focus:outline-none focus:border-primary/40 shadow-inner resize-none h-11 max-h-32 min-h-[2.75rem] leading-relaxed"
                            />
                            <button
                                type="submit"
                                disabled={isSending || !messageText.trim()}
                                className="h-11 w-11 bg-primary hover:bg-opacity-95 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/10 transition-transform active:scale-95"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
}
