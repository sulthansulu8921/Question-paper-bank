import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { Outlet, Link } from 'react-router-dom';
import { X, Phone, Loader2, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import FloatingPeerChat from '@/components/FloatingPeerChat';

interface ExpiryAlert {
    id: string;
    type: 'DANGER' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    days_left: number;
}

export default function DashboardLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const logout = useAuthStore((state) => state.logout);

    // Mobile verification modal state
    const [mobileInput, setMobileInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');



    // Expiry banner dismissed state per-user
    const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(`dismissed_alerts_${user?.id}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (user) {
            try {
                const stored = localStorage.getItem(`dismissed_alerts_${user.id}`);
                setDismissedAlertIds(stored ? JSON.parse(stored) : []);
            } catch {
                setDismissedAlertIds([]);
            }
        }
    }, [user]);

    const showMobilePrompt = user && !user.is_staff && !user.mobile_number?.trim();

    // Fetch expiry alerts (only for non-staff students)
    const { data: expiryAlerts = [] } = useQuery<ExpiryAlert[]>({
        queryKey: ['expiry-alerts', user?.id],
        queryFn: async () => {
            const res = await api.get('/subscriptions/my-subscriptions/notifications/');
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: !!user && !user.is_staff,
        staleTime: 120_000,
        refetchOnWindowFocus: false,
    });

    const visibleAlerts = expiryAlerts.filter((a) => !dismissedAlertIds.includes(a.id));
    const topAlert = visibleAlerts[0] ?? null;

    const dismissAlert = (alertId: string) => {
        const updated = [...dismissedAlertIds, alertId];
        setDismissedAlertIds(updated);
        if (user) {
            localStorage.setItem(`dismissed_alerts_${user.id}`, JSON.stringify(updated));
        }
    };

    const handleMobileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = mobileInput.replace(/\s+/g, '');
        if (cleaned.length < 10) {
            setModalError('Please enter a valid 10-digit mobile number.');
            return;
        }
        setIsSubmitting(true);
        setModalError('');
        try {
            await updateProfile({ mobile_number: cleaned });
        } catch (err: any) {
            setModalError(err.response?.data?.error || 'Failed to save mobile number. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const alertColors = {
        DANGER: { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
        WARNING: { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
        INFO: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
    };

    return (
        <div className="flex bg-bg min-h-screen text-text-primary font-sans relative overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block shrink-0">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 left-0 h-full w-72 bg-sidebar z-[70] lg:hidden flex flex-col"
                        >
                            <Sidebar />
                            <div className="absolute top-4 right-4 z-[80] lg:hidden">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-text-muted hover:text-text-primary hover:bg-bg rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col h-screen h-[100dvh] overflow-hidden">
                <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />

                {/* Subscription Expiry Banner */}
                <AnimatePresence>
                    {topAlert && (
                        <motion.div
                            key={topAlert.id}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className={`${alertColors[topAlert.type].bg} ${alertColors[topAlert.type].text} overflow-hidden shrink-0`}
                        >
                            <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0">
                                        {topAlert.type === 'DANGER' ? (
                                            <AlertTriangle size={15} />
                                        ) : (
                                            <Clock size={15} />
                                        )}
                                    </div>
                                    <p className="text-[11px] font-bold truncate">
                                        <span className="font-black">{topAlert.title}:</span>{' '}
                                        {topAlert.message}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        to="/dashboard/subscription"
                                        className="text-[10px] font-black uppercase tracking-wider underline underline-offset-2 opacity-90 hover:opacity-100 flex items-center gap-0.5 whitespace-nowrap"
                                    >
                                        Renew Now <ChevronRight size={11} />
                                    </Link>
                                    <button
                                        onClick={() => dismissAlert(topAlert.id)}
                                        className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded"
                                        title="Dismiss"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 lg:p-10 scrollbar-hide">
                    <div className="max-w-[1600px] mx-auto min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Dismissible Mobile Number Modal */}
            <AnimatePresence>
                {showMobilePrompt && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-card border border-border rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl relative overflow-hidden"
                        >

                            {/* Accent Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-36 bg-primary/20 rounded-full blur-3xl -z-10" />

                            <div className="text-center space-y-4">
                                <div className="inline-flex p-4 bg-primary/10 text-primary rounded-3xl mx-auto animate-bounce">
                                    <Phone size={32} />
                                </div>
                                <h2 className="text-2xl font-black text-text-primary tracking-tight">Complete Your Profile</h2>
                                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Mobile Number Required</p>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Please enter your mobile number to complete your registration. This is required for secure access and subscription features.
                                </p>
                            </div>

                            <form onSubmit={handleMobileSubmit} className="mt-8 space-y-6">
                                {modalError && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-2xl text-center">
                                        {modalError}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">Mobile Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                                        <input
                                            type="tel"
                                            required
                                            value={mobileInput}
                                            onChange={(e) => setMobileInput(e.target.value)}
                                            placeholder="Enter 10-digit number"
                                            className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-6 text-sm font-semibold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-75"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <>Save & Continue</>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="w-full text-text-muted hover:text-text-primary py-2 text-xs font-black uppercase tracking-widest transition-colors text-center animate-pulse"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            
            {/* Ephemeral Peer Chat Floating Widget */}
            <FloatingPeerChat />
        </div>
    );
}
