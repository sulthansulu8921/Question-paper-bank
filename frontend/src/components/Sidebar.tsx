import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, BookOpen, FileText, Download, Bookmark, CreditCard, LogOut, FileSearch, Settings, Database, Sparkles, BarChart3, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import Logo from '@/components/Logo';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileSearch, label: 'Question Papers', path: '/dashboard/papers' },
    { icon: Sparkles, label: 'AI Assistant', path: '/dashboard/assistant' },
    { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: Trophy, label: 'Leaderboard', path: '/dashboard/leaderboard' },
    { icon: BookOpen, label: 'Courses', path: '/dashboard/courses' },
    { icon: FileText, label: 'Notes', path: '/dashboard/notes' },
    { icon: Download, label: 'Downloads', path: '/dashboard/downloads' },
    { icon: Bookmark, label: 'Saved', path: '/dashboard/saved' },
    { icon: CreditCard, label: 'Subscription', path: '/dashboard/subscription' },
];

const adminItems = [
    { icon: Database, label: 'Admin Panel', path: '/admin' },
    { icon: Sparkles, label: 'Gamification Control', path: '/admin/gamification' },
];

export default function Sidebar() {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    return (
        <aside className="w-72 bg-sidebar border-r border-border h-screen flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50">
            <div className="h-20 flex items-center px-8 border-b border-border">
                <Link to="/" className="flex items-center gap-2 hover:scale-105 transition-transform duration-300">
                    <Logo className="h-10 object-contain" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto py-8 px-6 flex flex-col gap-1.5 scrollbar-hide">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 ml-4">Main Menu</p>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/dashboard');
                    return (
                        <Link key={item.label} to={item.path} className="relative group">
                            <div className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-[0_0_20px_var(--primary-glow)] font-bold' : 'text-text-muted hover:text-text-primary hover:bg-bg'}`}>
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-sm tracking-tight">{item.label}</span>
                                {isActive && <motion.div layoutId="side-indicator" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        </Link>
                    );
                })}

                {user?.is_staff && (
                    <div className="mt-6 pt-6 border-t border-border flex flex-col gap-1.5">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 ml-4">Administration</p>
                        {adminItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <Link key={item.label} to={item.path} className="relative group">
                                    <div className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-secondary text-white shadow-xl shadow-secondary/20 font-bold' : 'text-text-muted hover:text-text-primary hover:bg-bg'}`}>
                                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="text-sm tracking-tight">{item.label}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-border flex flex-col gap-1.5">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 ml-4">Preferences</p>
                    {(() => {
                        const isSettingsActive = location.pathname.startsWith('/dashboard/settings');
                        return (
                            <Link to="/dashboard/settings" className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isSettingsActive ? 'bg-primary text-white shadow-[0_0_20px_var(--primary-glow)] font-bold' : 'text-text-muted hover:text-text-primary hover:bg-bg'}`}>
                                <Settings size={20} strokeWidth={isSettingsActive ? 2.5 : 2} />
                                <span className="text-sm tracking-tight">Settings</span>
                                {isSettingsActive && <motion.div layoutId="side-indicator" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                            </Link>
                        );
                    })()}
                    <button onClick={logout} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-danger hover:bg-danger/10 transition-all text-sm font-bold tracking-tight mt-2">
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {user?.subscription_tier && user.subscription_tier !== 'Free Account' ? (
                <div className="p-6">
                    <div className="bg-gradient-to-tr from-primary/10 to-accent/10 border border-primary/20 p-5 rounded-2xl relative overflow-hidden">
                        <Sparkles size={16} className="text-primary absolute top-4 right-4 animate-pulse" />
                        <h5 className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Premium Member</h5>
                        <p className="text-[9px] text-text-muted font-bold leading-relaxed">Thank you for supporting us! Enjoy your premium study access.</p>
                    </div>
                </div>
            ) : (
                <div className="p-6">
                    <div className="bg-bg border border-border p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
                        <h5 className="text-[10px] font-black text-text-primary uppercase tracking-widest mb-1">Advanced Learning?</h5>
                        <p className="text-[9px] text-text-muted font-bold mb-4">Unlock premium features</p>
                        <Link to="/dashboard/subscription" className="w-full block text-center py-2.5 bg-primary text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Get Premium</Link>
                    </div>
                </div>
            )}
        </aside>
    );
}
