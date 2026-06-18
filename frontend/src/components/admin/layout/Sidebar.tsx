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
    Layers,
    Tag,
    CreditCard,
    Receipt,
    FileText,
    ChevronLeft,
    ChevronRight,
    Bell,
    MonitorPlay,
    Award,
    BrainCircuit,
    Activity,
    ClipboardList,
    Sliders,
    GitPullRequest,
} from 'lucide-react';
import Logo from '@/components/Logo';
import '@/styles/admin/Sidebar.css';
import '@/styles/admin/Modal.css';

const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: LayoutDashboard, section: 'main' },
    { path: '/admin/programs', name: 'Qualifications & Levels', icon: Award, section: 'main' },
    { path: '/admin/master', name: 'Chapters & Topics', icon: Layers, section: 'main' },
    { path: '/admin/questions', name: 'Question Management', icon: FileQuestion, section: 'main' },
    { path: '/admin/questions/new', name: 'Add New Question', icon: FilePlus, section: 'main' },
    { path: '/admin/subjects', name: 'Subjects', icon: BookOpen, section: 'main' },
    { path: '/admin/papers', name: 'Model Test Papers', icon: Files, section: 'main' },
    { path: '/admin/answers', name: 'Suggested Answers', icon: CheckSquare, section: 'main' },
    { path: '/admin/notes', name: 'Study Notes', icon: FileText, section: 'main' },
    // Assessment Engine section
    { path: '/admin/mcq-bank', name: 'MCQ Question Bank', icon: BrainCircuit, section: 'assessment' },
    { path: '/admin/mcq-bank/new', name: 'Add MCQ Question', icon: ClipboardList, section: 'assessment' },
    { path: '/admin/mock-templates', name: 'Mock Test Templates', icon: Sliders, section: 'assessment' },
    { path: '/admin/sessions', name: 'Student Sessions', icon: Activity, section: 'assessment' },
    // Other sections
    { path: '/admin/classroom', name: 'Classroom Hub', icon: MonitorPlay, section: 'other' },
    { path: '/admin/notifications', name: 'Announcements', icon: Bell, section: 'other' },
    { path: '/admin/analytics', name: 'Analytics', icon: BarChart2, section: 'other' },
    { path: '/admin/users', name: 'Users', icon: Users, section: 'other' },
    { path: '/admin/settings', name: 'Settings', icon: Settings, section: 'other' },
    { path: '/admin/coupons', name: 'Coupons', icon: Tag, section: 'other' },
    { path: '/admin/pricing', name: 'Pricing Plans', icon: CreditCard, section: 'other' },
    { path: '/admin/payments', name: 'Payments', icon: Receipt, section: 'other' },
    { path: '/admin/progression', name: 'Course Progression', icon: GitPullRequest, section: 'other' },
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
        const role = user?.role;
        
        // Super Admins see everything
        if (user?.is_superuser || role === 'SUPER_ADMIN') {
            return true;
        }
        
        // Institution Admins and Instructors can access admin panel
        if (role === 'INSTITUTION_ADMIN' || role === 'INSTRUCTOR') {
            const superAdminOnlyPaths = [
                '/admin/users',
                '/admin/coupons',
                '/admin/pricing',
                '/admin/payments',
                '/admin/notifications',
                '/admin/programs', // only Super Admin manages global course types
                '/admin/progression',
            ];
            if (role === 'INSTRUCTOR') {
                // Instructors don't manage global subjects, MTP definitions, or chapters/topics
                const instructorRestricted = [
                    '/admin/subjects',
                    '/admin/papers',
                    '/admin/master',
                ];
                return !superAdminOnlyPaths.includes(item.path) && !instructorRestricted.includes(item.path);
            }
            return !superAdminOnlyPaths.includes(item.path);
        }
        
        return false;
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
                    <Logo theme="dark" className="h-8 w-auto object-contain shrink-0" style={{ transition: 'opacity 0.2s' }} />
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
                    {/* Assessment Engine section header */}
                    {(() => {
                        const sections: { key: string; label: string }[] = [
                            { key: 'main', label: 'Content Management' },
                            { key: 'assessment', label: '🎯 Assessment Engine' },
                            { key: 'other', label: 'Platform' },
                        ];
                        return sections.map(({ key, label }) => {
                            const items = visibleMenuItems.filter(i => (i as any).section === key);
                            if (items.length === 0) return null;
                            return (
                                <>
                                    {!collapsed && (
                                        <li key={`section-${key}`} style={{ padding: '8px 14px 4px', fontSize: '0.65rem', fontWeight: 800, color: key === 'assessment' ? '#a78bfa' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: key !== 'main' ? 8 : 0 }}>
                                            {label}
                                        </li>
                                    )}
                                    {items.map(item => {
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.path} className="nav-item">
                                                <NavLink
                                                    to={item.path}
                                                    end={item.path === '/admin'}
                                                    onClick={onNavigate}
                                                    data-label={item.name}
                                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${key === 'assessment' ? 'assessment-item' : ''}`}
                                                    title={collapsed ? item.name : undefined}
                                                >
                                                    <Icon size={20} className="nav-icon" />
                                                    <span className="nav-label">{item.name}</span>
                                                </NavLink>
                                            </li>
                                        );
                                    })}
                                </>
                            );
                        });
                    })()}
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
