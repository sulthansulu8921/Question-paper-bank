import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { Search, Eye, Loader2, Clock, User, BarChart2, Target, BookOpen, Activity } from 'lucide-react';

const fmt = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}m ${s}s`; };
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const accColor = (a: number) => a >= 70 ? '#10b981' : a >= 40 ? '#f59e0b' : '#ef4444';
const accBg = (a: number) => a >= 70 ? '#dcfce7' : a >= 40 ? '#fef9c3' : '#fee2e2';

export default function AdminAssessmentMonitor() {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const { data: sessions = [], isLoading } = useQuery({
        queryKey: ['admin-all-sessions'],
        queryFn: async () => {
            const res = await api.get('/materials/assessment-sessions/?page_size=500');
            return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        }
    });

    const { data: stats } = useQuery({
        queryKey: ['platform-stats'],
        queryFn: async () => { const r = await api.get('/materials/assessment-sessions/platform-stats/'); return r.data; }
    });

    const filtered = (sessions as any[]).filter((s: any) => {
        const q = search.toLowerCase();
        const matchSearch = !search || [s.user?.email, s.title, s.qualification, s.course_level, s.chapter].some(f => (f || '').toLowerCase().includes(q));
        const matchType = !filterType || s.session_type === filterType;
        return matchSearch && matchType;
    });

    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    return (
        <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Student Sessions Monitor</h1>
                <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.9rem' }}>Real-time view of all practice and mock test sessions across all students</p>
            </div>

            {/* Platform Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: '1.5rem' }}>
                {[
                    { icon: Activity, label: 'Total Sessions', value: stats?.total_sessions ?? '—', color: '#4f46e5', bg: '#eef2ff' },
                    { icon: User, label: 'Active Students', value: stats?.total_students ?? '—', color: '#0ea5e9', bg: '#e0f2fe' },
                    { icon: Target, label: 'Avg Accuracy', value: stats ? `${stats.avg_accuracy}%` : '—', color: '#10b981', bg: '#dcfce7' },
                    { icon: BookOpen, label: 'Practice Sessions', value: stats?.practice_count ?? '—', color: '#7c3aed', bg: '#ede9fe' },
                    { icon: BarChart2, label: 'Mock Tests', value: stats?.mock_count ?? '—', color: '#f59e0b', bg: '#fef9c3' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                    <div key={label} style={{ background: '#fff', borderRadius: 16, padding: '1rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={20} color={color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by student email, chapter, qualification..."
                            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                        style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none' }}>
                        <option value="">All Types</option>
                        <option value="PRACTICE">Practice</option>
                        <option value="MOCK">Mock Test</option>
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['#', 'Student', 'Type', 'Qualification / Level', 'Chapter / Topic', 'Score', 'Accuracy', 'Duration', 'Date', 'Detail'].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 size={24} style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                                </td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No sessions found.</td></tr>
                            ) : paginated.map((s: any) => {
                                const isEx = expandedId === s.id;
                                return (
                                    <>
                                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 700 }}>#{s.id}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.user?.email || s.user || '—'}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: s.session_type === 'MOCK' ? '#fef9c3' : '#dbeafe', color: s.session_type === 'MOCK' ? '#a16207' : '#1d4ed8' }}>
                                                    {s.session_type === 'MOCK' ? '🎯 Mock' : '📝 Practice'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>{s.qualification || '—'}</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{s.course_level || '—'}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.chapter || s.subject || '—'}</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{s.topic || '—'}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4f46e5' }}>
                                                {s.is_completed ? `${s.score}/${s.max_score}` : <span style={{ color: '#94a3b8', fontWeight: 400 }}>In Progress</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {s.is_completed ? (
                                                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: accBg(s.accuracy), color: accColor(s.accuracy) }}>
                                                        {s.accuracy?.toFixed(1)}%
                                                    </span>
                                                ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#475569' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Clock size={13} color="#94a3b8" />
                                                    {s.duration_seconds > 0 ? fmt(s.duration_seconds) : '—'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <button onClick={() => setExpandedId(isEx ? null : s.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: isEx ? '#eef2ff' : '#fff', color: isEx ? '#4f46e5' : '#475569', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <Eye size={13} /> {isEx ? 'Hide' : 'View'}
                                                </button>
                                            </td>
                                        </tr>
                                        {isEx && (
                                            <tr style={{ background: '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
                                                <td colSpan={10} style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: 12, fontSize: '0.85rem' }}>
                                                        Session Answers — {s.answers?.length || 0} questions
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
                                                        {(s.answers || []).map((ans: any, i: number) => (
                                                            <div key={ans.id} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${ans.is_correct ? '#86efac' : '#fca5a5'}`, background: ans.is_correct ? '#f0fdf4' : '#fff1f2' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Q{i + 1}</span>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: ans.is_correct ? '#065f46' : '#b91c1c' }}>
                                                                        {ans.is_correct ? '✅ Correct' : '❌ Wrong'} (+{ans.score_obtained})
                                                                    </span>
                                                                </div>
                                                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                    {ans.question?.question_text || 'Question text unavailable'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                        {(!s.answers || s.answers.length === 0) && (
                                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No answer data available for this session.</p>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {filtered.length} sessions total
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: page === 1 ? '#cbd5e1' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: page === 1 ? 'default' : 'pointer' }}>
                            ← Prev
                        </button>
                        <span style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Page {page} / {totalPages || 1}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: page >= totalPages ? '#cbd5e1' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: page >= totalPages ? 'default' : 'pointer' }}>
                            Next →
                        </button>
                    </div>
                </div>
            </div>

            {/* Chapter Weakness Table */}
            {stats?.chapter_weakness?.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '1.5rem', marginTop: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '1rem' }}>📉 Platform-Wide Chapter Weakness Heatmap</h2>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1rem' }}>Chapters ranked by lowest average student accuracy</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Rank</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Chapter</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Questions Attempted</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Avg Accuracy</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Weakness Indicator</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.chapter_weakness.map((ch: any, i: number) => (
                                    <tr key={ch.chapter} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 700, color: i < 3 ? '#ef4444' : '#64748b' }}>#{i + 1}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{ch.chapter}</td>
                                        <td style={{ padding: '10px 12px', color: '#475569' }}>{ch.attempted}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: accBg(ch.accuracy), color: accColor(ch.accuracy) }}>
                                                {ch.accuracy}%
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden', maxWidth: 120 }}>
                                                    <div style={{ width: `${ch.accuracy}%`, height: '100%', borderRadius: 3, background: accColor(ch.accuracy), transition: 'width 0.4s' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{ch.accuracy < 40 ? '🔴 Critical' : ch.accuracy < 60 ? '🟡 Weak' : '🟢 OK'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
