import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, BookOpen, FileText, Download, Bookmark, CreditCard, LogOut, FileSearch, Settings, Database } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileSearch, label: 'Question Papers', path: '/dashboard/papers' },
    { icon: BookOpen, label: 'Courses', path: '/dashboard/courses' },
    { icon: FileText, label: 'Notes', path: '/dashboard/notes' },
    { icon: Download, label: 'Downloads', path: '/dashboard/downloads' },
    { icon: Bookmark, label: 'Saved', path: '/dashboard/saved' },
    { icon: CreditCard, label: 'Subscription', path: '/dashboard/subscription' },
];

const adminItems = [
    { icon: Database, label: 'Admin Panel', path: '/admin' },
];

export default function Sidebar() {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    return (
        <aside className="w-72 bg-white border-r border-gray-100 h-screen flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50">
            <div className="h-20 flex items-center px-8 border-b border-gray-50">
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-black shadow-lg shadow-primary/30">SP</div>
                    <span className="text-lg font-black tracking-tighter text-gray-900">Study Partner</span>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto py-8 px-6 flex flex-col gap-1.5 scrollbar-hide">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 ml-4">Main Menu</p>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/dashboard');
                    return (
                        <Link key={item.label} to={item.path} className="relative group">
                            <div className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-xl shadow-primary/20 font-bold' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}>
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-sm tracking-tight">{item.label}</span>
                                {isActive && <motion.div layoutId="side-indicator" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        </Link>
                    );
                })}

                {user?.is_staff && (
                    <div className="mt-6 pt-6 border-t border-gray-50 flex flex-col gap-1.5">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 ml-4">Administration</p>
                        {adminItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <Link key={item.label} to={item.path} className="relative group">
                                    <div className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-secondary text-white shadow-xl shadow-secondary/20 font-bold' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}>
                                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="text-sm tracking-tight">{item.label}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-gray-50 flex flex-col gap-1.5">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 ml-4">Preferences</p>
                    {(() => {
                        const isSettingsActive = location.pathname.startsWith('/dashboard/settings');
                        return (
                            <Link to="/dashboard/settings" className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isSettingsActive ? 'bg-primary text-white shadow-xl shadow-primary/20 font-bold' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}>
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

            <div className="p-6">
                <div className="bg-gradient-to-br from-secondary to-secondary/80 p-5 rounded-3xl relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/5 rounded-full blur-xl" />
                    <p className="text-white text-xs font-bold mb-3 relative z-10">Advanced Learning?</p>
                    <button className="w-full py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg relative z-10 hover:scale-105 transition-transform">Get Premium</button>
                </div>
            </div>
        </aside>
    );
}
