import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { Calendar, Download, Loader2, TrendingUp, Star, FileText, PieChart, BarChart3, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import '@/styles/admin/Analytics.css';

const AdminAnalytics = () => {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => (await api.get('/materials/dashboard-stats/')).data,
        refetchInterval: 30000,
    });

    const { data: questions = [] } = useQuery({
        queryKey: ['admin-questions'],
        queryFn: async () => {
            const res = (await api.get('/materials/subjective-questions/?page_size=200')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    // Compute source breakdown
    const sourceCounts: Record<string, number> = {};
    questions.forEach((q: any) => {
        if (q.source) sourceCounts[q.source] = (sourceCounts[q.source] || 0) + 1;
    });
    const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const maxSource = topSources[0]?.[1] || 1;

    // Compute marks distribution
    const importantCount = questions.filter((q: any) => q.is_important).length;
    const importantPct = questions.length ? Math.round((importantCount / questions.length) * 100) : 0;

    // Year breakdown
    const yearCounts: Record<string, number> = {};
    questions.forEach((q: any) => {
        if (q.year) yearCounts[q.year] = (yearCounts[q.year] || 0) + 1;
    });
    const topYears = Object.entries(yearCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).slice(-6);
    const maxYear = Math.max(...topYears.map(y => y[1]), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="analytics-container"
        >
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981' }}></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Live Intelligence</span>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: 900 }}>Advanced Analytics</h1>
                    <p className="page-subtitle" style={{ color: '#64748b' }}>Real-time insights across your educational ecosystem</p>
                </div>
                <div className="header-actions" style={{ gap: '1rem' }}>
                    <button className="secondary-btn flex-center gap-sm">
                        <Calendar size={18} /><span>Report Center</span>
                    </button>
                    <button className="primary-btn flex-center gap-sm">
                        <Download size={18} /><span>Export Dataset</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {[
                    { label: 'System Questions', value: stats?.total_questions, icon: FileText, color: '#2563eb' },
                    { label: 'Active Subjects', value: stats?.total_subjects, icon: Activity, color: '#10b981' },
                    { label: 'Priority Issues', value: importantCount, icon: Star, color: '#f59e0b' },
                    { label: 'Platform Users', value: stats?.total_users, icon: TrendingUp, color: '#8b5cf6' },
                ].map((kpi, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -5, boxShadow: '0 12px 24px rgba(0,0,0,0.05)' }}
                        className="form-card"
                        style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}
                    >
                        <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${kpi.color}10`, color: kpi.color }}>
                            <kpi.icon size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>{kpi.label}</p>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b' }}>
                                {isLoading ? <Loader2 size={24} className="animate-spin" /> : (kpi.value?.toLocaleString() || '0')}
                            </h2>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="analytics-grid">
                {/* Real-time Growth Chart */}
                <div className="analytics-card full-width form-card">
                    <div className="card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 className="card-title" style={{ fontWeight: 800 }}>Growth by Year</h3>
                            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Question volume distribution across exam cycles</p>
                        </div>
                        <BarChart3 size={20} style={{ color: '#94a3b8' }} />
                    </div>
                    <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '2rem', padding: '0 1rem' }}>
                        {topYears.map(([year, count], index) => (
                            <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(count / maxYear) * 160}px` }}
                                    transition={{ duration: 1, delay: index * 0.1 }}
                                    style={{
                                        width: '100%',
                                        background: 'linear-gradient(to top, #2563eb, #60a5fa)',
                                        borderRadius: '8px 8px 2px 2px',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                />
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>{count}</p>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{year}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Donut Chart (Priority) */}
                <div className="analytics-card form-card">
                    <div className="card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ fontWeight: 800 }}>Content Priority</h3>
                        <PieChart size={20} style={{ color: '#94a3b8' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                        <div style={{
                            position: 'relative',
                            width: '160px',
                            height: '160px',
                            borderRadius: '50%',
                            background: `conic-gradient(#f59e0b 0% ${importantPct}%, #2563eb ${importantPct}% 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                width: '110px',
                                height: '110px',
                                borderRadius: '50%',
                                backgroundColor: '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>{importantPct}%</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>High Priority</span>
                            </div>
                        </div>
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}></div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Important</span>
                                </div>
                                <span style={{ fontWeight: 800 }}>{importantCount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }}></div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Normal</span>
                                </div>
                                <span style={{ fontWeight: 800 }}>{questions.length - importantCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Source List */}
                <div className="analytics-card form-card">
                    <div className="card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ fontWeight: 800 }}>Top Channels</h3>
                        <Activity size={20} style={{ color: '#94a3b8' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {topSources.map(([src, count], i) => (
                            <div key={src}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{src}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{count}</span>
                                </div>
                                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(count / maxSource) * 100}%` }}
                                        transition={{ duration: 1, delay: i * 0.1 }}
                                        style={{ height: '100%', background: i === 0 ? '#2563eb' : i === 1 ? '#10b981' : '#64748b', borderRadius: '4px' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default AdminAnalytics;
