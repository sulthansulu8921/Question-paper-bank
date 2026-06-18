import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut, Sun, Moon, Menu, ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '@/components/Logo';
import api from '@/api/axios';

interface TopbarProps {
    onMenuClick?: () => void;
}

const features = [
    { name: 'Practice Hub', path: '/dashboard/practice', description: 'Take quiz questions and learn' },
    { name: 'Mock Test Simulator', path: '/dashboard/mock', description: 'Simulate full exams' },
    { name: 'AI Study Planner', path: '/dashboard/planner', description: 'Get a personalized study calendar' },
    { name: 'Classroom Hub', path: '/dashboard/classroom', description: 'Attend live classes and view syllabus' },
    { name: 'AI Assistant', path: '/dashboard/assistant', description: 'Ask doubts to the AI tutor' },
    { name: 'Analytics', path: '/dashboard/analytics', description: 'View your progress and statistics' },
    { name: 'Leaderboard', path: '/dashboard/leaderboard', description: 'Compete with peers' },
    { name: 'Subscription', path: '/dashboard/subscription', description: 'Manage plans and billing' },
    { name: 'Notes', path: '/dashboard/notes', description: 'Access handwritten notes and material' },
    { name: 'Saved Questions', path: '/dashboard/saved', description: 'Review your bookmarked questions' },
];

export default function Topbar({ onMenuClick }: TopbarProps) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [courses, setCourses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [lastReadId, setLastReadId] = useState<number>(() => {
        return Number(localStorage.getItem('last_read_notification_id') || '0');
    });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const notificationsDropdownRef = useRef<HTMLDivElement>(null);
    const { theme, toggleTheme } = useThemeStore();

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
            if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load searchable items & notifications
    useEffect(() => {
        if (!user) return;
        const fetchSearchData = async () => {
            try {
                const [coursesRes, subjectsRes, notificationsRes] = await Promise.all([
                    api.get('/courses/courses/'),
                    api.get('/courses/subjects/'),
                    api.get('/materials/notifications/')
                ]);
                setCourses(coursesRes.data || []);
                setSubjects(subjectsRes.data || []);
                
                // Filter notifications if user has a selected course
                const userCourse = user.selected_course;
                let allNotifications = notificationsRes.data || [];
                
                if (userCourse) {
                    allNotifications = allNotifications.filter((n: any) => 
                        n.target_audience === 'ALL' || 
                        (n.target_audience === 'COURSE' && n.target_course === userCourse)
                    );
                } else {
                    allNotifications = allNotifications.filter((n: any) => n.target_audience === 'ALL');
                }
                
                setNotifications(allNotifications);
            } catch (err) {
                console.error('Failed to load search data:', err);
            }
        };
        fetchSearchData();
    }, [user]);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/dashboard/papers?search=${encodeURIComponent(searchQuery.trim())}`);
            setIsSearchFocused(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenNotifications = () => {
        setIsNotificationsOpen(!isNotificationsOpen);
        if (notifications.length > 0) {
            const maxId = Math.max(...notifications.map(n => n.id));
            setLastReadId(maxId);
            localStorage.setItem('last_read_notification_id', String(maxId));
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return 'Yesterday';
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    // Calculate Initials
    const initials = user?.full_name
        ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : 'US';

    // Filters based on query
    const query = searchQuery.trim().toLowerCase();
    
    const matchedFeatures = query ? features.filter(f => 
        f.name.toLowerCase().includes(query) || f.description.toLowerCase().includes(query)
    ) : [];

    const matchedCourses = query ? courses.filter(c => 
        c.name.toLowerCase().includes(query) || (c.category_name && c.category_name.toLowerCase().includes(query))
    ) : [];

    const matchedSubjects = query ? subjects.filter(s => 
        s.name.toLowerCase().includes(query) || (s.course_name && s.course_name.toLowerCase().includes(query))
    ) : [];

    const hasResults = matchedFeatures.length > 0 || matchedCourses.length > 0 || matchedSubjects.length > 0;
    const unreadCount = notifications.filter(n => n.id > lastReadId).length;
    const renderSearchResults = (closeSearch: () => void) => {
        return (
            <div className="p-2 space-y-1">
                {!query ? (
                    <div>
                        {user?.selected_course_name && (
                            <div className="px-3 py-2 border-b border-border bg-bg/30">
                                <span className="text-[10px] font-black text-primary uppercase tracking-wider block">Active Program</span>
                                <button
                                    onClick={() => {
                                        navigate(`/dashboard/courses/${user.selected_course}`);
                                        closeSearch();
                                    }}
                                    className="w-full flex items-center justify-between text-left px-3 py-2 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl mt-1 transition-colors"
                                >
                                    <div>
                                        <p className="text-xs font-black text-text-primary">{user.selected_course_name}</p>
                                        <p className="text-[9px] font-bold text-text-muted mt-0.5">{user.selected_course_category || 'Active Course'}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-primary" />
                                </button>
                            </div>
                        )}
                        
                        <div className="px-3 py-1.5 mt-1">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Quick Shortcuts</span>
                        </div>
                        {features.slice(0, 5).map((f) => (
                            <button
                                key={f.path}
                                onClick={() => {
                                    navigate(f.path);
                                    closeSearch();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg rounded-xl transition-colors text-left"
                            >
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shrink-0">
                                    <Search size={12} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-text-primary">{f.name}</p>
                                    <p className="text-[9px] font-bold text-text-secondary">{f.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div>
                        {matchedFeatures.length > 0 && (
                            <div>
                                <div className="px-3 py-1.5 border-b border-border mb-1 bg-bg/10">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Features</span>
                                </div>
                                {matchedFeatures.map((f) => (
                                    <button
                                        key={f.path}
                                        onClick={() => {
                                            navigate(f.path);
                                            closeSearch();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-primary shrink-0">
                                            <Search size={12} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-text-primary">{f.name}</p>
                                            <p className="text-[9px] font-bold text-text-secondary">{f.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {matchedCourses.length > 0 && (
                            <div className="mt-2">
                                <div className="px-3 py-1.5 border-b border-border mb-1 bg-bg/10">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Courses</span>
                                </div>
                                {matchedCourses.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            navigate(`/dashboard/courses/${c.id}`);
                                            closeSearch();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 shrink-0">
                                            <Search size={12} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-text-primary">{c.name}</p>
                                            <p className="text-[9px] font-bold text-text-secondary">{c.category_name || 'Syllabus'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {matchedSubjects.length > 0 && (
                            <div className="mt-2">
                                <div className="px-3 py-1.5 border-b border-border mb-1 bg-bg/10">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Subjects / Papers</span>
                                </div>
                                {matchedSubjects.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            navigate(`/dashboard/courses/${s.course}`);
                                            closeSearch();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-600 shrink-0">
                                            <Search size={12} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-text-primary">{s.name}</p>
                                            <p className="text-[9px] font-bold text-text-secondary">{s.course_name} • {s.level_name || 'General'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!hasResults && (
                            <div className="p-6 text-center text-text-muted text-xs font-bold">
                                No matches found for "{searchQuery}"
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

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
                    <Logo className="h-7 md:h-8 w-auto object-contain shrink-0" />
                </div>

                <div className="relative group w-full hidden md:block md:w-64 lg:w-80" ref={searchContainerRef}>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onFocus={() => setIsSearchFocused(true)}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="Quick search..."
                        className="w-full bg-bg border border-border rounded-2xl py-3 pl-12 pr-6 text-sm font-medium text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-card focus:border-primary/20 transition-all"
                    />

                    {/* Active search dropdown */}
                    <AnimatePresence>
                        {isSearchFocused && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-50 max-h-96 overflow-y-auto"
                            >
                                {renderSearchResults(() => {
                                    setIsSearchFocused(false);
                                    setSearchQuery('');
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
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

                    {/* Mobile Search Toggle Button */}
                    <button
                        onClick={() => setIsMobileSearchOpen(true)}
                        className="w-10 h-10 md:hidden flex items-center justify-center text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                        aria-label="Search"
                    >
                        <Search size={20} />
                    </button>

                    {/* Interactive Notifications Bell */}
                    <div className="relative" ref={notificationsDropdownRef}>
                        <button
                            onClick={handleOpenNotifications}
                            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-text-secondary hover:text-primary hover:bg-primary/5 rounded-xl transition-all relative"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-2.5 h-2.5 bg-danger rounded-full border-2 border-[var(--bg-card)] ring-2 ring-danger/20 animate-pulse"></span>
                            )}
                        </button>

                        {/* Notifications Dropdown menu */}
                        <AnimatePresence>
                            {isNotificationsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 top-full mt-4 w-80 md:w-96 bg-card rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] border border-border overflow-hidden z-50"
                                >
                                    <div className="p-4 border-b border-border bg-bg/50 flex items-center justify-between">
                                        <h3 className="text-sm font-black text-text-primary">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-black text-white bg-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                {unreadCount} New
                                            </span>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-text-muted text-xs font-bold space-y-2">
                                                <p>All caught up!</p>
                                                <p className="text-[10px] font-semibold text-text-secondary">No notifications to display.</p>
                                            </div>
                                        ) : (
                                            notifications.map((n) => (
                                                <div 
                                                    key={n.id} 
                                                    className={`p-4 transition-colors hover:bg-bg/40 ${n.id > lastReadId ? 'bg-primary/[0.02]' : ''}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                                            <Bell size={14} />
                                                        </div>
                                                        <div className="space-y-1 min-w-0 flex-1">
                                                            <div className="flex justify-between items-baseline gap-2">
                                                                <h4 className="text-xs font-black text-text-primary truncate">{n.title}</h4>
                                                                <span className="text-[9px] font-bold text-text-muted shrink-0">{formatTime(n.created_at)}</span>
                                                            </div>
                                                            <p className="text-[11px] text-text-secondary font-semibold leading-relaxed break-words">{n.message}</p>
                                                            {n.course_name && (
                                                                <span className="inline-block text-[8px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider mt-1">
                                                                    {n.course_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-2 md:gap-3 p-1.5 md:pr-4 hover:bg-bg rounded-2xl transition-all border border-transparent hover:border-border"
                        >
                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white font-black text-xs md:text-sm flex items-center justify-center shadow-md shadow-primary/10">
                                {initials}
                            </div>
                            <span className="text-xs font-black text-text-secondary hidden md:inline-block max-w-[100px] truncate">{user?.full_name || 'Student'}</span>
                            <ChevronDown size={14} className="text-text-muted hidden md:inline-block" />
                        </button>

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
                                        <button onClick={() => { navigate('/dashboard/account'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-secondary hover:text-primary hover:bg-bg rounded-2xl transition-all">
                                            <User size={16} /> My Account
                                        </button>
                                        <button onClick={() => { navigate('/dashboard/settings'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-secondary hover:text-primary hover:bg-bg rounded-2xl transition-all">
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
            </div>

            {/* Mobile Search Overlay Modal */}
            <AnimatePresence>
                {isMobileSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] p-4 lg:hidden flex flex-col"
                    >
                        <div className="bg-card border border-border rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden w-full max-w-lg mx-auto mt-12">
                            {/* Search Header */}
                            <div className="flex items-center gap-3 p-4 border-b border-border">
                                <Search className="text-text-muted" size={18} />
                                <input
                                    type="text"
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchQuery.trim()) {
                                            navigate(`/dashboard/papers?search=${encodeURIComponent(searchQuery.trim())}`);
                                            setIsMobileSearchOpen(false);
                                            setSearchQuery('');
                                        }
                                    }}
                                    placeholder="Search papers, courses, shortcuts..."
                                    className="flex-1 bg-transparent text-sm font-semibold text-text-primary focus:outline-none"
                                />
                                <button
                                    onClick={() => {
                                        setIsMobileSearchOpen(false);
                                        setSearchQuery('');
                                    }}
                                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg rounded-lg transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Search Results */}
                            <div className="flex-1 overflow-y-auto bg-card">
                                {renderSearchResults(() => {
                                    setIsMobileSearchOpen(false);
                                    setSearchQuery('');
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
