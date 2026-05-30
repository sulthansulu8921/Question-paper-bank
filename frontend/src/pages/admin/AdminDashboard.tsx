import {
    FileText,
    BookOpen,
    List,
    AlignLeft,
    Users,
    Upload,
    ArrowUpRight,
    Loader2,
    Database,
    Download
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

    const statCards = [
        { title: 'Total Questions', value: stats?.total_questions || '0', icon: FileText, color: 'primary', trend: '+12%' },
        { title: 'Total Subjects', value: stats?.total_subjects || '0', icon: BookOpen, color: 'accent', trend: '+3%' },
        { title: 'MCQ Questions', value: stats?.mcq_questions || '0', icon: List, color: 'warning', trend: '+8%' },
        { title: 'Theory Questions', value: stats?.theory_questions || '0', icon: AlignLeft, color: 'danger', trend: '+15%' },
        { title: 'Total Users', value: stats?.total_users || '0', icon: Users, color: 'primary-light', trend: '+5%' },
        { title: 'Uploaded Papers', value: stats?.total_uploads || '0', icon: Upload, color: 'success', trend: '+20%' },
    ];

    const exportReport = () => {
        const rows = [
            ['Metric', 'Value'],
            ['Total Questions', stats?.total_questions ?? 0],
            ['Total Subjects', stats?.total_subjects ?? 0],
            ['MCQ Questions', stats?.mcq_questions ?? 0],
            ['Theory Questions', stats?.theory_questions ?? 0],
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
                        <div key={idx} className="stat-card">
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
                        <h3 className="card-title">Performance & Uploads</h3>
                        <button type="button" className="text-btn" onClick={() => navigate('/admin/analytics')}>
                            View Analytics
                        </button>
                    </div>
                    <div className="chart-placeholder">
                        <div className="bar-chart">
                            <div className="bar" style={{ height: '60%' }}></div>
                            <div className="bar" style={{ height: '80%' }}></div>
                            <div className="bar" style={{ height: '40%' }}></div>
                            <div className="bar" style={{ height: '90%' }}></div>
                            <div className="bar" style={{ height: '50%' }}></div>
                            <div className="bar" style={{ height: '75%' }}></div>
                        </div>
                        <p className="placeholder-text">Live Upload Trends (Past 6 Months)</p>
                    </div>
                </div>

                <div className="recent-activity-section card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Activity</h3>
                        <button type="button" className="text-btn" onClick={() => navigate('/admin/questions')}>
                            View All
                        </button>
                    </div>
                    <div className="activity-list">
                        {isLoading ? (
                            <div className="p-10 text-center"><Loader2 size={32} className="animate-spin mx-auto text-primary" /></div>
                        ) : (
                            stats?.recent_activity?.map((activity: any, i: number) => (
                                <div key={i} className="activity-item">
                                    <div className={`activity-indicator ${activity.type}`}></div>
                                    <div className="activity-details">
                                        <p className="activity-text">
                                            <strong>{activity.user}</strong> {activity.text}
                                        </p>
                                        <span className="activity-time">{new Date(activity.time).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
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
