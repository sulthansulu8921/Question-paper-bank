import {
    FileText,
    Users,
    Upload,
    ArrowUpRight,
    Loader2,
    Database,
    Download,
    CreditCard,
    ShieldAlert,
    UserX
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import '@/styles/admin/DashboardOverview.css';

const AdminDashboard = () => {
    const navigate = useNavigate();

    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => (await api.get('/materials/dashboard-stats/')).data,
        refetchInterval: 30000, // Refresh every 30 seconds for "real-time" feel
    });

    const chartData = stats?.monthly_charts || [
        { month: 'Jan', revenue: 45000, users: 30 },
        { month: 'Feb', revenue: 58000, users: 45 },
        { month: 'Mar', revenue: 72000, users: 50 },
        { month: 'Apr', revenue: 98000, users: 75 },
        { month: 'May', revenue: 120000, users: 110 },
        { month: 'Jun', revenue: stats?.total_revenue ? Math.round(stats.total_revenue) : 154000, users: stats?.total_users || 140 }
    ];

    const maxRev = Math.max(...chartData.map((d: any) => d.revenue), 1000);
    const maxUsers = Math.max(...chartData.map((d: any) => d.users), 10);

    const statCards = [
        { 
            title: 'Total Revenue', 
            value: stats?.total_revenue !== undefined ? `₹${parseFloat(stats.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '₹0', 
            icon: CreditCard, 
            color: 'success', 
            trend: '+18%' 
        },
        { 
            title: 'Active Subscriptions', 
            value: stats?.active_subscriptions || '0', 
            icon: ShieldAlert, 
            color: 'primary', 
            trend: '+4%' 
        },
        { 
            title: 'Unpaid Students', 
            value: stats?.unpaid_students || '0', 
            icon: UserX, 
            color: 'danger', 
            trend: '+12%',
            onClick: () => navigate('/admin/users')
        },
        { 
            title: 'Total Questions', 
            value: stats?.total_questions || '0', 
            icon: FileText, 
            color: 'accent', 
            trend: '+12%' 
        },
        { 
            title: 'Total Users', 
            value: stats?.total_users || '0', 
            icon: Users, 
            color: 'primary-light', 
            trend: '+5%' 
        },
        { 
            title: 'Uploaded Papers', 
            value: stats?.total_uploads || '0', 
            icon: Upload, 
            color: 'warning', 
            trend: '+20%' 
        },
    ];

    const exportReport = () => {
        const rows = [
            ['Metric', 'Value'],
            ['Total Revenue (INR)', stats?.total_revenue ?? 0],
            ['Active Subscriptions', stats?.active_subscriptions ?? 0],
            ['Unpaid Students', stats?.unpaid_students ?? 0],
            ['Total Questions', stats?.total_questions ?? 0],
            ['Total Subjects', stats?.total_subjects ?? 0],
            ['Total Users', stats?.total_users ?? 0],
            ['Uploaded Papers', stats?.total_uploads ?? 0],
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'dashboard_report.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center p-20 text-center">
            <Database size={48} className="text-danger mb-4" />
            <h2 className="text-xl font-bold">Failed to load statistics</h2>
            <p className="text-muted">Please check your backend connection.</p>
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <div className="flex items-center gap-2 text-accent mb-1">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Real-time System Status</span>
                    </div>
                    <h1 className="page-title">Dashboard Overview</h1>
                    <p className="page-subtitle">Welcome back, Admin. Here is what is happening today.</p>
                </div>
                <button type="button" className="primary-btn flex-center gap-sm" onClick={exportReport} disabled={isLoading}>
                    <Download size={18} />
                    <span>Generate Report</span>
                </button>
            </div>

            <div className="stats-grid">
                {statCards.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div 
                            key={idx} 
                            className={`stat-card ${stat.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                            onClick={stat.onClick}
                        >
                            <div className="stat-card-header">
                                <div className={`icon-wrapper bg-${stat.color}-light text-${stat.color}`}>
                                    {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Icon size={24} />}
                                </div>
                                {!isLoading && (
                                    <div className="trend positive">
                                        <ArrowUpRight size={16} />
                                        <span>{stat.trend}</span>
                                    </div>
                                )}
                            </div>
                            <div className="stat-card-body">
                                <h3 className="stat-title">{stat.title}</h3>
                                <p className="stat-value">{isLoading ? '...' : stat.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="dashboard-content-grid">
                <div className="charts-section card">
                    <div className="card-header">
                        <h3 className="card-title font-bold text-slate-800">Monthly Revenue & User Signups</h3>
                        <button type="button" className="text-btn font-bold text-blue-600 hover:text-blue-800" onClick={() => navigate('/admin/analytics')}>
                            View Analytics
                        </button>
                    </div>
                    
                    <div className="chart-placeholder p-6">
                        <div className="flex justify-between items-end h-48 w-full gap-4 pt-4 border-b border-slate-100">
                            {chartData.map((d: any, i: number) => {
                                const heightPercent = Math.min(100, (d.revenue / maxRev) * 100);
                                const usersPercent = Math.min(100, (d.users / maxUsers) * 100);
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                                        {/* Hover Tooltip */}
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] py-1 px-2.5 rounded-lg shadow-lg transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                            Rev: ₹{d.revenue.toLocaleString('en-IN')} | Signups: {d.users}
                                        </div>
                                        <div className="w-full flex gap-1.5 items-end h-36 justify-center">
                                            {/* Revenue Bar */}
                                            <div className="w-5 bg-indigo-600 rounded-t-sm transition-all duration-300 hover:bg-indigo-700" style={{ height: `${heightPercent}%` }}></div>
                                            {/* Users Bar */}
                                            <div className="w-5 bg-teal-400 rounded-t-sm transition-all duration-300 hover:bg-teal-500" style={{ height: `${usersPercent}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 mt-2">{d.month}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-6 justify-center mt-4 text-[11px] font-semibold text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-indigo-600 rounded-sm"></span> Revenue (₹)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-teal-400 rounded-sm"></span> Student Signups
                            </div>
                        </div>
                    </div>
                </div>

                <div className="recent-activity-section card">
                    <div className="card-header">
                        <h3 className="card-title font-bold text-slate-800">Recent Activity</h3>
                        <button type="button" className="text-btn font-bold text-blue-600 hover:text-blue-800" onClick={() => navigate('/admin/questions')}>
                            View All
                        </button>
                    </div>
                    <div className="activity-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {isLoading ? (
                            <div className="p-10 text-center"><Loader2 size={32} className="animate-spin mx-auto text-primary" /></div>
                        ) : (
                            stats?.recent_activity?.map((activity: any, i: number) => {
                                let badgeColor = "bg-blue-50 text-blue-700 border-blue-100";
                                if (activity.type === "feedback") badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                                if (activity.type === "user") badgeColor = "bg-green-50 text-green-700 border-green-100";

                                return (
                                    <div key={i} className="activity-item p-3 border-b border-slate-50 last:border-b-0 flex items-start gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeColor}`}>
                                            {activity.type}
                                        </span>
                                        <div className="activity-details flex-1 min-w-0">
                                            <p className="activity-text text-xs text-slate-700 font-semibold truncate">
                                                {activity.text}
                                            </p>
                                            <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold">
                                                <span className="truncate max-w-[150px]">{activity.user}</span>
                                                <span>{new Date(activity.time).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {!isLoading && stats?.recent_activity?.length === 0 && (
                            <p className="text-center py-10 text-muted">No recent activity detected.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
