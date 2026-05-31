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
} from 'lucide-react';
import '@/styles/admin/Sidebar.css';
import '@/styles/admin/Modal.css';

const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/master', name: 'Master Database', icon: Layers },
    { path: '/admin/questions', name: 'Question Management', icon: FileQuestion },
    { path: '/admin/questions/new', name: 'Add New Question', icon: FilePlus },
    { path: '/admin/subjects', name: 'Subjects', icon: BookOpen },
    { path: '/admin/papers', name: 'Model Test Papers', icon: Files },
    { path: '/admin/answers', name: 'Suggested Answers', icon: CheckSquare },
    { path: '/admin/analytics', name: 'Analytics', icon: BarChart2 },
    { path: '/admin/users', name: 'Users', icon: Users },
    { path: '/admin/courses', name: 'Courses', icon: Database },
    { path: '/admin/settings', name: 'Settings', icon: Settings },
];

interface SidebarProps {
    open?: boolean;
    onNavigate?: () => void;
}

const Sidebar = ({ open = false, onNavigate }: SidebarProps) => {
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = () => {
        logout();
        onNavigate?.();
    };

    return (
        <aside className={`sidebar ${open ? 'open' : ''}`}>
            <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', padding: '0 1rem' }}>
                <img src="/logo.png" alt="Qubook Logo" className="h-10 object-contain" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.75))', transition: 'all 0.3s ease' }} />
            </div>

            <nav className="sidebar-nav">
                <ul className="nav-list">
                    {menuItems.map((item) => {
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
