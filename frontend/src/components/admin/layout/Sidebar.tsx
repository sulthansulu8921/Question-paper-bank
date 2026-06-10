import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import {
    LayoutDashboard,
    FileQuestion,
    FilePlus,
    BookOpen,
    BarChart2,
    LogOut,
    Files,
    CheckSquare,
    Users,
    Settings,
    Database,
    Layers,
    Tag,
    CreditCard,
    Receipt,
    FileText,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import Logo from '@/components/Logo';
import '@/styles/admin/Sidebar.css';
import '@/styles/admin/Modal.css';

const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/master', name: 'Chapters & Topics', icon: Layers },
    { path: '/admin/questions', name: 'Question Management', icon: FileQuestion },
    { path: '/admin/questions/new', name: 'Add New Question', icon: FilePlus },
    { path: '/admin/subjects', name: 'Subjects', icon: BookOpen },
    { path: '/admin/papers', name: 'Model Test Papers', icon: Files },
    { path: '/admin/answers', name: 'Suggested Answers', icon: CheckSquare },
    { path: '/admin/notes', name: 'Study Notes', icon: FileText },
    { path: '/admin/analytics', name: 'Analytics', icon: BarChart2 },
    { path: '/admin/users', name: 'Users', icon: Users },
    { path: '/admin/courses', name: 'Courses', icon: Database },
    { path: '/admin/settings', name: 'Settings', icon: Settings },
    { path: '/admin/coupons', name: 'Coupons', icon: Tag },
    { path: '/admin/pricing', name: 'Pricing Plans', icon: CreditCard },
    { path: '/admin/payments', name: 'Payments', icon: Receipt },
];

interface SidebarProps {
    open?: boolean;
    collapsed?: boolean;
    onNavigate?: () => void;
    onToggleCollapse?: () => void;
}

const Sidebar = ({ open = false, collapsed = false, onNavigate, onToggleCollapse }: SidebarProps) => {
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);

    const visibleMenuItems = menuItems.filter((item) => {
        if (!user?.is_superuser) {
            const restrictedPaths = [
                '/admin',
                '/admin/analytics',
                '/admin/users',
                '/admin/coupons',
                '/admin/pricing',
                '/admin/payments',
            ];
            return !restrictedPaths.includes(item.path);
        }
        return true;
    });

    const handleLogout = () => {
        logout();
        onNavigate?.();
    };

    return (
        <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
            {/* Header: Logo + toggle button */}
            <div className="sidebar-header">
                {!collapsed && (
                    <Logo theme="dark" className="h-8 object-contain" style={{ flex: 1, minWidth: 0, transition: 'opacity 0.2s' }} />
                )}
                {/* Toggle button — visible only on desktop */}
                <button
                    type="button"
                    className="sidebar-toggle-btn"
                    onClick={onToggleCollapse}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    style={{ display: 'none' }}
                    id="sidebar-desktop-toggle"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <style>{`
                    @media (min-width: 769px) {
                        #sidebar-desktop-toggle { display: flex !important; }
                    }
                `}</style>
            </div>

            <nav className="sidebar-nav">
                <ul className="nav-list">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.path} className="nav-item">
                                <NavLink
                                    to={item.path}
                                    end={item.path === '/admin'}
                                    onClick={onNavigate}
                                    data-label={item.name}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                    title={collapsed ? item.name : undefined}
                                >
                                    <Icon size={20} className="nav-icon" />
                                    <span className="nav-label">{item.name}</span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="sidebar-footer">
                <button
                    type="button"
                    className="nav-link logout-btn"
                    onClick={handleLogout}
                    data-label="Logout"
                    title={collapsed ? 'Logout' : undefined}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <LogOut size={20} className="nav-icon" />
                    <span className="nav-label">Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
