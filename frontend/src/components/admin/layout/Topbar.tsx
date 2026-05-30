import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminSearch } from '@/context/AdminSearchContext';
import '@/styles/admin/Topbar.css';

interface TopbarProps {
    onMenuToggle?: () => void;
}

const Topbar = ({ onMenuToggle }: TopbarProps) => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const { setSearchQuery } = useAdminSearch();
    const [localSearch, setLocalSearch] = useState('');
    const fullName = user ? `${user.first_name} ${user.last_name}`.trim() || 'Admin User' : 'Admin User';

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        const q = localSearch.trim();
        setSearchQuery(q);
        navigate('/admin/questions');
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button type="button" className="menu-toggle-btn" onClick={onMenuToggle} aria-label="Toggle menu">
                    <Menu size={24} />
                </button>
                <form className="search-container" onSubmit={handleSearch}>
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search questions, subjects..."
                        className="search-input"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                </form>
            </div>

            <div className="topbar-right">
                <button
                    type="button"
                    className="notification-btn"
                    title="View analytics"
                    onClick={() => navigate('/admin/analytics')}
                >
                    <Bell size={20} />
                    <span className="notification-badge">•</span>
                </button>

                <button
                    type="button"
                    className="admin-profile"
                    onClick={() => navigate('/admin/settings')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <div className="admin-info">
                        <span className="admin-name">{fullName}</span>
                        <span className="admin-role">{user?.is_staff ? 'Super Admin' : 'Staff'}</span>
                    </div>
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0D8ABC&color=fff`}
                        alt="Admin"
                        className="admin-avatar"
                    />
                </button>
            </div>
        </header>
    );
};

export default Topbar;
