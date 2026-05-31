import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useThemeStore } from '../store/useThemeStore';

export default function Topbar() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { theme, toggleTheme } = useThemeStore();

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/dashboard/papers?search=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Calculate Initials
    const initials = user?.full_name
        ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : 'US';

    return (
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between px-4 md:px-10 shrink-0 relative z-[60] transition-colors">
            {/* SEARCH AREA */}
            <div className="relative group max-w-md w-full hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    placeholder="Quick search (Press Enter to search)..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                />
            </div>

            {/* ACTION CENTER */}
            <div className="flex items-center gap-4 md:gap-8 ml-auto">
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="w-11 h-11 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all"
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button className="w-11 h-11 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-primary dark:hover:bg-primary/10 hover:bg-primary/5 rounded-xl transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-3 right-3 w-2 h-2 bg-danger rounded-full border-2 border-white dark:border-slate-900 ring-2 ring-danger/20 animate-pulse"></span>
                    </button>
                </div>

                <div className="h-8 w-[1px] bg-gray-100 dark:bg-slate-700" />

                {/* PROFILE DROPDOWN */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-4 group cursor-pointer"
                    >
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-black text-gray-900 leading-tight">{user?.full_name || 'Student User'}</p>
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter mt-0.5">{user?.subscription_tier || 'Free Account'}</p>
                        </div>
                        <div className="relative">
                            <div className="w-11 h-11 bg-gradient-to-tr from-primary to-accent rounded-[1rem] flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                <span className="text-white text-sm font-black relative z-10">{initials}</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-white rounded-full shadow-sm" />
                        </div>
                        <ChevronDown size={16} className={`text-gray-300 group-hover:text-gray-900 transition-all ${isProfileOpen ? 'rotate-180 text-gray-900' : ''}`} />
                    </button>

                    {/* DROPDOWN MENU */}
                    <AnimatePresence>
                        {isProfileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute right-0 top-full mt-4 w-64 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-700 overflow-hidden"
                            >
                                <div className="p-4 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{user?.full_name || 'Student User'}</p>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{user?.email || 'student@example.com'}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => navigate('/dashboard/account')} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-2xl transition-all">
                                        <User size={16} /> My Account
                                    </button>
                                    <button onClick={() => navigate('/dashboard/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-2xl transition-all">
                                        <Settings size={16} /> Settings & Preferences
                                    </button>
                                </div>
                                <div className="p-2 border-t border-slate-50 dark:border-slate-700">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-danger hover:bg-danger/5 dark:hover:bg-danger/10 rounded-2xl transition-all"
                                    >
                                        <LogOut size={16} /> Sign Out securely
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
