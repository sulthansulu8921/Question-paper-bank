import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import {
    Search, Download, Plus, Edit, Trash2,
    SortAsc, SortDesc, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '@/styles/admin/QuestionManagement.css';

const ITEMS_PER_PAGE = 20;

const SOURCES = [
    'MTP-01', 'MTP-02', 'RTP', 'Suggested Answers',
    'Model Test Paper 1', 'Model Test Paper 2', 'Model Test Paper 3', 'Model Test Paper 4',
    'Model Test Paper 5', 'Model Test Paper 6', 'Model Test Paper 7', 'Model Test Paper 8', 'Other'
];
const ATTEMPTS = ['JAN', 'MAY', 'SEP', 'NOV'];
const DIFFICULTIES = [
    { value: 'EASY', label: 'Easy', color: '#10b981', bg: '#eff6ff' },
    { value: 'MEDIUM', label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
    { value: 'HARD', label: 'Hard', color: '#ef4444', bg: '#fef2f2' },
];
const STATUSES = [
    { value: 'ACTIVE', label: 'Active', color: '#10b981', bg: '#dcfce7' },
    { value: 'DRAFT', label: 'Draft', color: '#94a3b8', bg: '#f1f5f9' },
    { value: 'PUBLISHED', label: 'Published', color: '#2563eb', bg: '#eff6ff' },
    { value: 'ARCHIVED', label: 'Archived', color: '#6b7280', bg: '#f8fafc' },
];

const Badge = ({ text, color, bg }: { text: string, color: string, bg: string }) => (
    <span style={{
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '0.7rem',
        fontWeight: 700,
        background: bg,
        color: color,
        border: `1px solid ${color}22`
    }}>
        {text}
    </span>
);

export default function AdminQuestionBank() {
    const queryClient = useQueryClient();

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSource, setFilterSource] = useState('');
    const [filterAttempt, setFilterAttempt] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [importantOnly, setImportantOnly] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [sortKey, setSortKey] = useState('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const { data: questions = [], isLoading } = useQuery({
        queryKey: ['admin-questions'],
        queryFn: async () => (await api.get('/materials/subjective-questions/')).data
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/subjective-questions/${id}/`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-questions'] }); }
    });

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => sortKey === col ? (sortDir === 'asc' ? <SortAsc size={13} /> : <SortDesc size={13} />) : null;

    const filtered = useMemo(() => {
        let list = [...questions];
        if (searchQuery) {
            const lowSearch = searchQuery.toLowerCase();
            list = list.filter((q: any) =>
                [q.topic_name, q.source, q.q_no, q.year, q.question_text, q.tags].some(f => (f || '').toLowerCase().includes(lowSearch))
            );
        }
        if (filterSource) list = list.filter((q: any) => q.source === filterSource);
        if (filterAttempt) list = list.filter((q: any) => q.attempt === filterAttempt);
        if (filterStatus) list = list.filter((q: any) => q.status === filterStatus);
        if (importantOnly) list = list.filter((q: any) => q.is_important);

        list.sort((a: any, b: any) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return list;
    }, [questions, searchQuery, filterSource, filterAttempt, filterStatus, importantOnly, sortKey, sortDir]);

    const paginated = filtered.slice(0, ITEMS_PER_PAGE);

    const exportCSV = () => {
        const headers = ['Question ID', 'Source Type', 'Attempt', 'Year', 'Section', 'Q.No', 'Type', 'Marks', 'Difficulty', 'Status', 'Tags'];
        const rows = filtered.map((q: any) => [
            q.id, q.source, q.attempt, q.year, q.section, q.q_no, q.question_type, q.marks, q.difficulty, q.status, q.tags
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `question_bank.csv`;
        a.click();
    };

    return (
        <div className="qm-container">
            <div className="qm-header" style={{ marginBottom: '1rem' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Question Bank</h1>
                    <p className="page-subtitle" style={{ color: '#64748b' }}>Manage enterprise questions</p>
                </div>
                <div className="header-actions">
                    <button className="secondary-btn flex-center gap-sm" onClick={exportCSV}><Download size={18} /><span>Export</span></button>
                    <Link to="/admin/questions/new" className="primary-btn flex-center gap-sm"><Plus size={18} /><span>Add New</span></Link>
                </div>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={`icon-btn filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                            <Filter size={18} /><span>Filters</span>
                        </button>
                        <button className={`icon-btn filter-btn ${importantOnly ? 'active' : ''}`} onClick={() => setImportantOnly(!importantOnly)}>
                            <span>Important</span>
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="filter-drawer" style={{ display: 'flex', gap: 12, padding: '0 1.25rem 1rem' }}>
                        <select className="form-input" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                            <option value="">All Sources</option>
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="form-input" value={filterAttempt} onChange={e => setFilterAttempt(e.target.value)}>
                            <option value="">All Attempts</option>
                            {ATTEMPTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                )}

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => toggleSort('id')}>ID <SortIcon col="id" /></th>
                                <th>Source</th>
                                <th>Attempt</th>
                                <th>Year</th>
                                <th>Section</th>
                                <th>Q.No</th>
                                <th>Type</th>
                                <th>Marks</th>
                                <th>Difficulty</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={11} style={{ textAlign: 'center' }}>Loading...</td></tr>
                            ) : paginated.map((q: any) => (
                                <tr key={q.id}>
                                    <td>#{q.id}</td>
                                    <td><Badge text={q.source} color="#2563eb" bg="#eff6ff" /></td>
                                    <td>{q.attempt}</td>
                                    <td>{q.year}</td>
                                    <td>{q.section}</td>
                                    <td>{q.q_no}</td>
                                    <td>{q.question_type}</td>
                                    <td>{q.marks}M</td>
                                    <td>
                                        {(() => {
                                            const d = DIFFICULTIES.find(x => x.value === q.difficulty) || DIFFICULTIES[1];
                                            return <Badge text={d.label} color={d.color} bg={d.bg} />;
                                        })()}
                                    </td>
                                    <td>
                                        {(() => {
                                            const s = STATUSES.find(x => x.value === q.status) || STATUSES[0];
                                            return <Badge text={s.label} color={s.color} bg={s.bg} />;
                                        })()}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Link to={`/admin/questions/${q.id}/edit`} className="action-btn"><Edit size={16} /></Link>
                                            <button className="action-btn danger" onClick={() => deleteMutation.mutate(q.id)}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
