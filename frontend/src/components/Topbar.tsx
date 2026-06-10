import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut, Sun, Moon, Menu } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '@/components/Logo';

interface TopbarProps {
    onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
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
        <header className="h-20 bg-card border-b border-border flex items-center justify-between px-4 md:px-10 shrink-0 relative z-[60]">
            {/* SEARCH / LOGO AREA */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 -ml-2 text-text-secondary hover:bg-bg-secondary rounded-xl transition-all"
                    >
                        <Menu size={24} />
                    </button>
                )}

                <div className="lg:hidden flex items-center mr-1 md:mr-2 shrink-0">
                    <Logo className="h-7 md:h-8 object-contain" />
                </div>

                <div className="relative group w-full hidden md:block md:w-64 lg:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="Quick search (Press Enter to search)..."
                        className="w-full bg-bg border border-border rounded-2xl py-3 pl-12 pr-6 text-sm font-medium text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-card focus:border-primary/20 transition-all"
                    />
                </div>
            </div>

            {/* ACTION CENTER */}
            <div className="flex items-center gap-2 md:gap-6 shrink-0">
                <div className="flex items-center gap-1.5 md:gap-3">
                    {/* Theme Toggle Button (Desktop Slider) */}
                    <button
                        onClick={toggleTheme}
                        className={`relative w-16 h-8 rounded-full transition-colors duration-300 shadow-inner hidden md:flex items-center px-1 ${theme === 'dark' ? 'bg-primary' : 'bg-gray-200'}`}
                    >
                        <motion.div
                            initial={false}
                            animate={{
                                x: theme === 'dark' ? 32 : 0,
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm"
                        >
                            {theme === 'dark' ? (
                                <Moon size={14} className="text-primary" />
                            ) : (
                                <Sun size={14} className="text-amber-500" />
                            )}
                        </motion.div>
                    </button>

                    {/* Theme Toggle Button (Mobile Icon Only) */}
                    <button
                        onClick={toggleTheme}
                        className="w-10 h-10 md:hidden flex items-center justify-center text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                    >
                        {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>

                    <button className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-2 h-2 bg-danger rounded-full border-2 border-[var(--bg-card)] ring-2 ring-danger/20 animate-pulse"></span>
                    </button>
                </div>

                <div className="h-8 w-[1px] bg-border hidden sm:block" />

                {/* PROFILE DROPDOWN */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2 md:gap-4 group cursor-pointer"
                    >
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-black text-text-primary leading-tight">{user?.full_name || 'Student User'}</p>
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter mt-0.5">{user?.subscription_tier || 'Free Account'}</p>
                        </div>
                        <div className="relative">
                            <div className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-tr from-primary to-accent rounded-[1rem] flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                <span className="text-white text-sm font-black relative z-10">{initials}</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success border-2 border-[var(--bg-card)] rounded-full shadow-sm" />
                        </div>
                        <ChevronDown size={16} className={`text-gray-300 group-hover:text-gray-900 transition-all hidden md:block ${isProfileOpen ? 'rotate-180 text-gray-900' : ''}`} />
                    </button>

                    {/* DROPDOWN MENU */}
                    <AnimatePresence>
                        {isProfileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute right-0 top-full mt-4 w-64 bg-card rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] border border-border overflow-hidden z-50"
                            >
                                <div className="p-4 border-b border-border bg-bg/50">
                                    <p className="text-sm font-black text-text-primary">{user?.full_name || 'Student User'}</p>
                                    <p className="text-xs font-bold text-text-muted mt-1">{user?.email || 'student@example.com'}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => navigate('/dashboard/account')} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-secondary hover:text-primary hover:bg-bg rounded-2xl transition-all">
                                        <User size={16} /> My Account
                                    </button>
                                    <button onClick={() => navigate('/dashboard/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-secondary hover:text-primary hover:bg-bg rounded-2xl transition-all">
                                        <Settings size={16} /> Settings & Preferences
                                    </button>
                                </div>
                                <div className="p-2 border-t border-border">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-danger hover:bg-danger/5 rounded-2xl transition-all"
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
