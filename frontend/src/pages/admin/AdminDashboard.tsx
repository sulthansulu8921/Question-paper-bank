import {
    FileText,
    Users,
    Loader2,
    Database,
    Download,
    CreditCard,
    ShieldAlert,
    BookOpen,
    FileSpreadsheet,
    Activity,
    Book,
    FileDown,
    ShieldCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { useRealTimeSync } from '@/utils/firebaseSync';
import '@/styles/admin/DashboardOverview.css';

const AdminDashboard = () => {
    const navigate = useNavigate();

    // Enable hybrid real-time cache updates from Firebase Firestore status doc!
    useRealTimeSync([['admin-stats']]);

    const { data: stats, isLoading, error, refetch } = useQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => (await api.get('/materials/dashboard-stats/')).data,
        refetchInterval: 30000, // Background fallback fallback
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
            trend: '+18%',
            onClick: () => navigate('/admin/users')
        },
        { 
            title: 'Active Subscriptions', 
            value: stats?.active_subscriptions || '0', 
            icon: ShieldCheck, 
            color: 'primary', 
            trend: '+8%',
            onClick: () => navigate('/admin/users')
        },
        { 
            title: 'Expired Subscriptions', 
            value: stats?.expired_subscriptions || '0', 
            icon: ShieldAlert, 
            color: 'danger', 
            trend: '+2%',
            onClick: () => navigate('/admin/users')
        },
        { 
            title: 'Total Students', 
            value: stats?.total_students || '0', 
            icon: Users, 
            color: 'primary-light', 
            trend: '+12%',
            onClick: () => navigate('/admin/users')
        },
        { 
            title: 'Total Courses', 
            value: stats?.total_courses || '0', 
            icon: Book, 
            color: 'accent', 
            trend: 'Active',
            onClick: () => navigate('/admin/courses')
        },
        { 
            title: 'Total Subjects', 
            value: stats?.total_subjects || '0', 
            icon: BookOpen, 
            color: 'warning', 
            trend: 'Active',
            onClick: () => navigate('/admin/subjects')
        },
        { 
            title: 'Question Papers', 
            value: stats?.total_question_papers || '0', 
            icon: FileSpreadsheet, 
            color: 'success-light', 
            trend: '+5%',
            onClick: () => navigate('/admin/papers')
        },
        { 
            title: 'Total Notes', 
            value: stats?.total_notes || '0', 
            icon: FileText, 
            color: 'accent-light', 
            trend: '+15%',
            onClick: () => navigate('/admin/notes')
        },
        { 
            title: 'Material Downloads', 
            value: stats?.total_downloads || '0', 
            icon: FileDown, 
            color: 'warning-light', 
            trend: 'Real-time',
        },
    ];

    const exportReport = () => {
        const rows = [
            ['Metric', 'Value'],
            ['Total Revenue (INR)', stats?.total_revenue ?? 0],
            ['Active Subscriptions', stats?.active_subscriptions ?? 0],
            ['Expired Subscriptions', stats?.expired_subscriptions ?? 0],
            ['Total Students', stats?.total_students ?? 0],
            ['Total Courses', stats?.total_courses ?? 0],
            ['Total Subjects', stats?.total_subjects ?? 0],
            ['Question Papers', stats?.total_question_papers ?? 0],
            ['Total Notes', stats?.total_notes ?? 0],
            ['Total Downloads', stats?.total_downloads ?? 0],
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'qubook_lms_report.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center p-20 text-center">
            <Database size={48} className="text-danger mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Failed to load system statistics</h2>
            <p className="text-muted mb-4">Please verify database connections.</p>
            <button className="primary-btn" onClick={() => refetch()}>Retry Connection</button>
        </div>
    );

    return (
        <div className="dashboard-container max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
            <div className="dashboard-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Firebase Firestore Real-time Synced</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Super Admin Hub</h1>
                    <p className="text-sm text-slate-500 font-semibold mt-0.5">Control live classes, courses, users, and subscriptions in real time.</p>
                </div>
                <button type="button" className="primary-btn flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow" onClick={exportReport} disabled={isLoading}>
                    <Download size={18} />
                    <span className="font-bold text-sm">Download LMS Audit Report</span>
                </button>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {statCards.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div 
                            key={idx} 
                            className={`p-5 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow transition ${stat.onClick ? 'cursor-pointer' : ''}`}
                            onClick={stat.onClick}
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-3 rounded-lg bg-slate-50 text-indigo-600`}>
                                    {isLoading ? <Loader2 size={22} className="animate-spin text-indigo-600" /> : <Icon size={22} />}
                                </div>
                                {!isLoading && (
                                    <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                                        {stat.trend}
                                    </span>
                                )}
                            </div>
                            <div className="mt-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.title}</h3>
                                <p className="text-2xl font-black text-slate-800 mt-1">{isLoading ? '...' : stat.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Charts & Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Revenue & Growth Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm lg:col-span-8 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                        <h3 className="text-sm font-bold text-slate-800">LMS Platform Growth</h3>
                        <span className="text-[11px] font-semibold text-slate-400">Past 6 Months</span>
                    </div>
                    
                    <div className="chart-placeholder">
                        <div className="flex justify-between items-end h-48 w-full gap-4 pt-4 border-b border-slate-100">
                            {chartData.map((d: any, i: number) => {
                                const heightPercent = Math.min(100, (d.revenue / maxRev) * 100);
                                const usersPercent = Math.min(100, (d.users / maxUsers) * 100);
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-lg transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                            Rev: ₹{d.revenue.toLocaleString('en-IN')} | Signups: {d.users}
                                        </div>
                                        <div className="w-full flex gap-1.5 items-end h-36 justify-center">
                                            <div className="w-4 bg-indigo-600 rounded-t-sm transition-all duration-300 hover:bg-indigo-700" style={{ height: `${heightPercent}%` }}></div>
                                            <div className="w-4 bg-teal-400 rounded-t-sm transition-all duration-300 hover:bg-teal-500" style={{ height: `${usersPercent}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 mt-2">{d.month}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-6 justify-center mt-4 text-[11px] font-bold text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-indigo-600 rounded-sm"></span> Monthly Revenue (₹)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-teal-400 rounded-sm"></span> Student Registrations
                            </div>
                        </div>
                    </div>
                </div>

                {/* Course-wise Analytics */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm lg:col-span-4 flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-slate-800">Course Analytics</h3>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Active Subscriptions</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: '200px' }}>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-600" /></div>
                        ) : stats?.course_wise_analytics?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                <span className="text-xs font-semibold text-slate-600 truncate max-w-[180px]">{item.course_name}</span>
                                <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full">{item.active_students} students</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Logs, Registrations & Payments Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Student Registrations */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm lg:col-span-4 flex flex-col">
                    <div className="border-b border-slate-50 pb-3 mb-4 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">New Registrations</h3>
                        <Users size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '300px' }}>
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                        ) : stats?.recent_registrations?.map((r: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{r.first_name || r.last_name ? `${r.first_name} ${r.last_name}` : 'Student'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate max-w-[160px]">{r.email}</p>
                                </div>
                                <span className="text-[9px] font-semibold text-slate-400">{new Date(r.date_joined).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Payments */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm lg:col-span-4 flex flex-col">
                    <div className="border-b border-slate-50 pb-3 mb-4 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">Recent Payments</h3>
                        <CreditCard size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '300px' }}>
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                        ) : stats?.recent_payments?.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
                                <div>
                                    <p className="text-xs font-extrabold text-slate-700">₹{p.amount}</p>
                                    <p className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">{p.user_email}</p>
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Student Activity Logs */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm lg:col-span-4 flex flex-col">
                    <div className="border-b border-slate-50 pb-3 mb-4 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">Student Logs</h3>
                        <Activity size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '300px' }}>
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                        ) : stats?.recent_activity?.map((activity: any, idx: number) => {
                            let typeClass = 'bg-blue-50 text-blue-700';
                            if (activity.type === 'download') typeClass = 'bg-indigo-50 text-indigo-700';
                            if (activity.type === 'feedback') typeClass = 'bg-amber-50 text-amber-700';
                            if (activity.type === 'user') typeClass = 'bg-emerald-50 text-emerald-700';

                            return (
                                <div key={idx} className="border-b border-slate-50 pb-2 last:border-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${typeClass}`}>{activity.type}</span>
                                        <span className="text-[9px] font-semibold text-slate-400">{new Date(activity.time).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-700 mt-1">{activity.text}</p>
                                    <p className="text-[9px] font-bold text-slate-400">{activity.user}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
