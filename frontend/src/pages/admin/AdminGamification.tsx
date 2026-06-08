import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import api from '@/api/axios';
import { 
    Users, Award, RefreshCw, Flame, Sparkles, Plus, 
    CheckCircle, ShieldAlert, Loader2
} from 'lucide-react';

export default function AdminGamification() {
    const { adminAction } = useDashboardStore();
    
    // User search & list state
    const [usersList, setUsersList] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    // Gamification action states
    const [xpAmount, setXpAmount] = useState('100');
    const [coinsAmount, setCoinsAmount] = useState('50');
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [submittingAction, setSubmittingAction] = useState(false);

    // Quotes Management state
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loadingQuotes, setLoadingQuotes] = useState(false);
    const [newQuoteText, setNewQuoteText] = useState('');
    const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
    const [newQuoteDay, setNewQuoteDay] = useState('');

    useEffect(() => {
        fetchUsers();
        fetchQuotes();
    }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            // Fetch users list from backend (reuse existing user endpoint if possible)
            const res = await api.get('/auth/users/');
            setUsersList(res.data);
        } catch (err) {
            console.error("Failed to load users for gamification panel", err);
        }
        setLoadingUsers(false);
    };

    const fetchQuotes = async () => {
        setLoadingQuotes(true);
        try {
            const res = await api.get('/gamification/quote/');
            // Endpoint returns daily quote, but we can query master list if it exists
            // For now, represent in UI
            setQuotes([res.data]);
        } catch (err) {
            console.log("Quotes query fallback", err);
        }
        setLoadingQuotes(false);
    };

    const handleAction = async (action: string) => {
        if (!selectedUserId) {
            setStatusMsg({ type: 'error', text: 'Please select a student user first.' });
            return;
        }
        setSubmittingAction(true);
        setStatusMsg(null);
        try {
            let amount = 0;
            if (action === 'AWARD_XP') amount = parseInt(xpAmount);
            if (action === 'AWARD_COINS') amount = parseInt(coinsAmount);

            await adminAction(selectedUserId, action, amount);
            setStatusMsg({ 
                type: 'success', 
                text: `Successfully executed action ${action}! User stats updated.` 
            });
            fetchUsers(); // Refresh stats in users list
        } catch (err: any) {
            setStatusMsg({ 
                type: 'error', 
                text: err.response?.data?.error || 'Action execution failed.' 
            });
        }
        setSubmittingAction(false);
    };

    const handleAddQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuoteText || !newQuoteAuthor) return;
        try {
            const dayNum = parseInt(newQuoteDay) || undefined;
            await api.post('/gamification/quote/', {
                text: newQuoteText,
                author: newQuoteAuthor,
                day_of_year: dayNum
            });
            setStatusMsg({ type: 'success', text: 'New quote added to motivational catalog!' });
            setNewQuoteText('');
            setNewQuoteAuthor('');
            setNewQuoteDay('');
            fetchQuotes();
        } catch (err: any) {
            setStatusMsg({ type: 'error', text: 'Failed to create quote definition.' });
        }
    };

    const filteredUsers = usersList.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.first_name && u.first_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-text-primary">Gamification Control</h1>
                <p className="text-text-muted font-bold text-sm">Award XP/Coins, reset user streaks, and configure study resources.</p>
            </div>

            {/* Status Messages */}
            {statusMsg && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                    statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {statusMsg.type === 'success' ? <CheckCircle size={20} /> : <ShieldAlert size={20} />}
                    <span className="text-xs font-bold">{statusMsg.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Student Users Search List */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl shadow-sm flex flex-col h-[500px]">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="text-primary" size={18} />
                        <h3 className="font-black text-sm text-text-primary uppercase tracking-wide">Select Student</h3>
                    </div>
                    
                    <input 
                        type="text" 
                        placeholder="Search student email or name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-bg border border-border px-4 py-2.5 rounded-xl text-xs font-bold mb-4 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />

                    <div className="flex-1 overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                        {loadingUsers && (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
                        )}
                        {filteredUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => setSelectedUserId(u.id)}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between ${
                                    selectedUserId === u.id ? 'bg-primary/10 border-primary border text-primary font-bold' : 'border border-transparent hover:bg-bg'
                                }`}
                            >
                                <div className="truncate max-w-[180px]">
                                    <p className="text-xs font-black text-text-primary truncate">
                                        {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                                    </p>
                                    <p className="text-[10px] text-text-muted truncate">{u.email}</p>
                                </div>
                                {u.stats && (
                                    <span className="text-[9px] font-black uppercase bg-bg px-2 py-0.5 rounded text-text-muted">Lvl {u.stats.level}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Stat Operations Panel */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl shadow-sm space-y-6">
                    <div className="flex items-center gap-2">
                        <Award className="text-amber-500" size={18} />
                        <h3 className="font-black text-sm text-text-primary uppercase tracking-wide">Adjust Statistics</h3>
                    </div>

                    {/* Award XP */}
                    <div className="space-y-3 p-4 bg-bg/50 rounded-2xl border border-border">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">Award Bonus Experience (XP)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={xpAmount} 
                                onChange={(e) => setXpAmount(e.target.value)}
                                className="bg-bg border border-border px-3 py-2 rounded-xl text-xs font-bold flex-1 focus:outline-none"
                            />
                            <button 
                                onClick={() => handleAction('AWARD_XP')}
                                disabled={submittingAction}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-transform flex items-center gap-1.5"
                            >
                                <Sparkles size={12} /> Award
                            </button>
                        </div>
                    </div>

                    {/* Award Coins */}
                    <div className="space-y-3 p-4 bg-bg/50 rounded-2xl border border-border">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">Award Study Coins</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={coinsAmount} 
                                onChange={(e) => setCoinsAmount(e.target.value)}
                                className="bg-bg border border-border px-3 py-2 rounded-xl text-xs font-bold flex-1 focus:outline-none"
                            />
                            <button 
                                onClick={() => handleAction('AWARD_COINS')}
                                disabled={submittingAction}
                                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-transform flex items-center gap-1.5"
                            >
                                <Award size={12} /> Award
                            </button>
                        </div>
                    </div>

                    {/* Reset study streak */}
                    <div className="space-y-3 p-4 bg-red-50/10 rounded-2xl border border-red-500/10">
                        <label className="text-[10px] font-black text-danger uppercase tracking-wider block">Danger Zone</label>
                        <button 
                            onClick={() => handleAction('RESET_STREAK')}
                            disabled={submittingAction}
                            className="w-full py-2.5 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} /> Reset Study Streak
                        </button>
                    </div>
                </div>

                {/* 3. Quotes Catalog Management */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl shadow-sm flex flex-col h-[500px]">
                    <div className="flex items-center gap-2 mb-4">
                        <Flame className="text-orange-500" size={18} />
                        <h3 className="font-black text-sm text-text-primary uppercase tracking-wide">Add Motivational Quote</h3>
                    </div>

                    <form onSubmit={handleAddQuote} className="space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-1 block">Quote Text</label>
                            <textarea 
                                placeholder="Consistency today leads to success tomorrow..." 
                                value={newQuoteText}
                                onChange={(e) => setNewQuoteText(e.target.value)}
                                className="bg-bg border border-border p-3 rounded-xl text-xs font-bold w-full h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-1 block">Author</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Aristotle" 
                                    value={newQuoteAuthor}
                                    onChange={(e) => setNewQuoteAuthor(e.target.value)}
                                    className="bg-bg border border-border px-3 py-2.5 rounded-xl text-xs font-bold w-full focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-1 block">Day of Year (1-365)</label>
                                <input 
                                    type="number" 
                                    placeholder="e.g. 157" 
                                    value={newQuoteDay}
                                    onChange={(e) => setNewQuoteDay(e.target.value)}
                                    className="bg-bg border border-border px-3 py-2.5 rounded-xl text-xs font-bold w-full focus:outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                        >
                            <Plus size={14} /> Add Quote
                        </button>
                    </form>
                    
                    <div className="flex-1 overflow-y-auto divide-y divide-border pr-2 scrollbar-thin mt-4">
                        {loadingQuotes && (
                            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={16} /></div>
                        )}
                        {quotes.map((q, i) => q && (
                            <div key={i} className="py-2 text-[10px]">
                                <p className="font-black text-text-primary">"{q.text}"</p>
                                <p className="text-text-muted mt-1 font-bold">- {q.author} {q.day_of_year && `(Day ${q.day_of_year})`}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
