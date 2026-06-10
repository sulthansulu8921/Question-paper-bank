import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/admin/layout/Sidebar';
import Topbar from '@/components/admin/layout/Topbar';
import { AdminSearchProvider } from '@/context/AdminSearchContext';
import '@/styles/admin/variables.css';
import '@/styles/admin/AdminLayout.css';
import '@/styles/admin/Modal.css';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <AdminSearchProvider>
            <div className="admin-layout">
                {sidebarOpen && (
                    <div
                        className="sidebar-overlay"
                        onClick={() => setSidebarOpen(false)}
                        role="presentation"
                    />
                )}
                <Sidebar
                    open={sidebarOpen}
                    collapsed={sidebarCollapsed}
                    onNavigate={() => setSidebarOpen(false)}
                    onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
                />
                <div className="admin-main">
                    <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
                    <main className="admin-content">
                        <Outlet />
                    </main>
                </div>
            </div>
        </AdminSearchProvider>
    );
};

export default AdminLayout;
