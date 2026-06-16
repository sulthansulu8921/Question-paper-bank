import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/axios';
import {
    Search, Plus, Edit, Trash2, Filter, ChevronDown, ChevronUp,
    CheckCircle, XCircle, Loader2, Eye, EyeOff, BookOpen, Layers, Target
} from 'lucide-react';

const DIFFICULTIES = [
    { value: 'EASY', label: 'Easy', color: '#10b981', bg: '#dcfce7' },
    { value: 'MEDIUM', label: 'Medium', color: '#f59e0b', bg: '#fef9c3' },
    { value: 'HARD', label: 'Hard', color: '#ef4444', bg: '#fee2e2' },
];
const STATUSES = [
    { value: 'ACTIVE', label: 'Active', color: '#10b981', bg: '#dcfce7' },
    { value: 'DRAFT', label: 'Draft', color: '#94a3b8', bg: '#f1f5f9' },
    { value: 'PUBLISHED', label: 'Published', color: '#2563eb', bg: '#dbeafe' },
    { value: 'ARCHIVED', label: 'Archived', color: '#6b7280', bg: '#f8fafc' },
];

const Badge = ({ text, color, bg }: { text: string; color: string; bg: string }) => (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: bg, color, border: `1px solid ${color}33` }}>
        {text}
    </span>
);
export default function AdminMCQBank() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [filterDiff, setFilterDiff] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [sortKey, setSortKey] = useState('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const PAGE_SIZE = 25;

    const { data: questions = [], isLoading } = useQuery({
        queryKey: ['admin-mcq-bank'],
        queryFn: async () => {
            const res = await api.get('/materials/subjective-questions/?question_type=MCQ&page_size=500');
            return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/subjective-questions/${id}/`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-mcq-bank'] }),
    });

    const bulkStatusMutation = useMutation({
        mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
            Promise.all(ids.map(id => api.patch(`/materials/subjective-questions/${id}/`, { status }))),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-mcq-bank'] }),
    });

    const [selected, setSelected] = useState<number[]>([]);

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => sortKey === col
        ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
        : null;

    const filtered = useMemo(() => {
        let list = [...(questions as any[])];
        if (search) {
            const s = search.toLowerCase();
            list = list.filter(q => [q.question_text, q.icai_topic?.name, q.icai_topic?.chapter?.name].some(f => (f || '').toLowerCase().includes(s)));
        }
        if (filterDiff) list = list.filter(q => q.difficulty === filterDiff);
        if (filterStatus) list = list.filter(q => q.status === filterStatus);
        list.sort((a, b) => {
            const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return list;
    }, [questions, search, filterDiff, filterStatus, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleSelect = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const selectAll = () => setSelected(paginated.map(q => q.id));
    const clearSelect = () => setSelected([]);

    const mcqCount = (questions as any[]).filter((q: any) => q.question_type === 'MCQ').length;
    const activeCount = (questions as any[]).filter((q: any) => q.status === 'ACTIVE').length;

    return (
        <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>MCQ Question Bank</h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.9rem' }}>
                        Manage all MCQ questions powering Practice Hub &amp; Mock Tests
                    </p>
                </div>
                <Link to="/admin/mcq-bank/new" style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: '#fff', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none'
                }}>
                    <Plus size={18} /> Add MCQ Question
                </Link>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: '1.5rem' }}>
                {[
                    { icon: BookOpen, label: 'Total MCQs', value: mcqCount, color: '#4f46e5', bg: '#eef2ff' },
                    { icon: CheckCircle, label: 'Active', value: activeCount, color: '#10b981', bg: '#dcfce7' },
                    { icon: Layers, label: 'Filtered', value: filtered.length, color: '#f59e0b', bg: '#fef9c3' },
                    { icon: Target, label: 'Selected', value: selected.length, color: '#ef4444', bg: '#fee2e2' },
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

            {/* Table Card */}
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search questions, topics, chapters..."
                            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${showFilters ? '#4f46e5' : '#e2e8f0'}`, background: showFilters ? '#eef2ff' : '#fff', color: showFilters ? '#4f46e5' : '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                        <Filter size={15} /> Filters
                    </button>
                    {selected.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{selected.length} selected</span>
                            <button onClick={() => bulkStatusMutation.mutate({ ids: selected, status: 'ACTIVE' })}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #10b981', background: '#dcfce7', color: '#065f46', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                                Set Active
                            </button>
                            <button onClick={() => bulkStatusMutation.mutate({ ids: selected, status: 'ARCHIVED' })}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ef4444', background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                                Archive
                            </button>
                            <button onClick={clearSelect} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {showFilters && (
                    <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <select value={filterDiff} onChange={e => { setFilterDiff(e.target.value); setPage(1); }}
                            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none' }}>
                            <option value="">All Difficulties</option>
                            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none' }}>
                            <option value="">All Statuses</option>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                )}

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 12px', textAlign: 'left' }}>
                                    <input type="checkbox" onChange={e => e.target.checked ? selectAll() : clearSelect()} checked={selected.length === paginated.length && paginated.length > 0} />
                                </th>
                                {[['id', '#ID'], ['question_text', 'Question'], ['difficulty', 'Difficulty'], ['status', 'Status'], ['marks', 'Marks']].map(([key, label]) => (
                                    <th key={key} onClick={() => toggleSort(key)} style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        {label} <SortIcon col={key} />
                                    </th>
                                ))}
                                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Chapter / Topic</th>
                                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Preview</th>
                                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block' }} />
                                </td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No MCQ questions found.</td></tr>
                            ) : paginated.map((q: any) => {
                                const diff = DIFFICULTIES.find(d => d.value === q.difficulty) || DIFFICULTIES[1];
                                const stat = STATUSES.find(s => s.value === q.status) || STATUSES[0];
                                const isExpanded = expandedId === q.id;
                                const opts = q.options || [];
                                const correctOpt = opts.find((o: any) => o.is_correct);
                                return (
                                    <>
                                        <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9', background: selected.includes(q.id) ? '#f5f3ff' : 'white', transition: 'background 0.1s' }}>
                                            <td style={{ padding: '10px 12px' }}>
                                                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleSelect(q.id)} />
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 700 }}>#{q.id}</td>
                                            <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question_text || '—'}</p>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}><Badge text={diff.label} color={diff.color} bg={diff.bg} /></td>
                                            <td style={{ padding: '10px 12px' }}><Badge text={stat.label} color={stat.color} bg={stat.bg} /></td>
                                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4f46e5' }}>{q.marks}M</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                                                    <div style={{ fontWeight: 700 }}>{q.icai_topic?.chapter?.name || '—'}</div>
                                                    <div style={{ color: '#94a3b8' }}>{q.icai_topic?.name || '—'}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                                >
                                                    {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {isExpanded ? 'Hide' : 'Preview'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                    <Link to={`/admin/mcq-bank/${q.id}/edit`}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', textDecoration: 'none' }}>
                                                        <Edit size={15} />
                                                    </Link>
                                                    <button onClick={() => { if (confirm('Delete this MCQ?')) deleteMutation.mutate(q.id); }}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #fee2e2', background: '#fff1f2', color: '#ef4444', cursor: 'pointer' }}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr style={{ background: '#fafafe', borderBottom: '1px solid #e2e8f0' }}>
                                                <td colSpan={9} style={{ padding: '1rem 1.5rem 1.25rem' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Options</div>
                                                            {opts.map((opt: any, i: number) => (
                                                                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 12px', borderRadius: 8, background: opt.is_correct ? '#dcfce7' : '#f8fafc', border: `1px solid ${opt.is_correct ? '#86efac' : '#e2e8f0'}` }}>
                                                                    {opt.is_correct ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#94a3b8" />}
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: opt.is_correct ? 700 : 400, color: opt.is_correct ? '#065f46' : '#374151' }}>
                                                                        {String.fromCharCode(65 + i)}. {opt.text}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div>
                                                            {q.explanation && (
                                                                <div style={{ marginBottom: 12 }}>
                                                                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📖 Explanation</div>
                                                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>{q.explanation}</p>
                                                                </div>
                                                            )}
                                                            {q.related_concept && (
                                                                <div>
                                                                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📚 Related Concept</div>
                                                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>{q.related_concept}</p>
                                                                </div>
                                                            )}
                                                            {correctOpt && (
                                                                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac' }}>
                                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46' }}>✅ Correct: {correctOpt.text}</span>
                                                                </div>
                                                            )}
                                                        </div>
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

                {/* Pagination */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : '#fff', color: page === 1 ? '#cbd5e1' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: page === 1 ? 'default' : 'pointer' }}>
                            ← Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setPage(p)}
                                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${page === p ? '#4f46e5' : '#e2e8f0'}`, background: page === p ? '#4f46e5' : '#fff', color: page === p ? '#fff' : '#374151', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                {p}
                            </button>
                        ))}
                        <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}
                            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: page === totalPages || totalPages === 0 ? '#f8fafc' : '#fff', color: page === totalPages || totalPages === 0 ? '#cbd5e1' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: page === totalPages || totalPages === 0 ? 'default' : 'pointer' }}>
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
