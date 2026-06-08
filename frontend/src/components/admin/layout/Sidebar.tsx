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
    onNavigate?: () => void;
}

const Sidebar = ({ open = false, onNavigate }: SidebarProps) => {
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
                '/admin/payments'
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
        <aside className={`sidebar ${open ? 'open' : ''}`}>
            <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', padding: '0 1rem' }}>
                <Logo theme="dark" className="h-10 object-contain" style={{ transition: 'all 0.3s ease' }} />
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
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
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
