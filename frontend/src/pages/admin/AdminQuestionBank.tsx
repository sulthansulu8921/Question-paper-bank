import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import {
    Search, Plus, Edit, Trash2,
    SortAsc, SortDesc, Filter, Upload, FileSpreadsheet, Loader2,
    Sparkles, Download, AlertTriangle, AlertCircle, X, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ICAICascadeSelector, { type ICAISelection } from '@/components/admin/ICAICascadeSelector';
import ExcelImportModal from '@/components/admin/ExcelImportModal';
import '@/styles/admin/QuestionManagement.css';

interface DeleteModalState {
    isOpen: boolean;
    mode: 'single' | 'bulk';
    singleQuestion?: any;
    ids: number[];
}

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
    { value: 'NONE', label: 'No Mention', color: '#64748b', bg: '#f8fafc' },
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
    const [filterYear, setFilterYear] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [importantOnly, setImportantOnly] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [sortKey, setSortKey] = useState('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const [icaiFilter, setIcaiFilter] = useState<ICAISelection>({
        levelId: '',
        paperId: '',
        chapterId: '',
        topicId: '',
    });

    const [currentPage, setCurrentPage] = useState(1);

    const [exporting, setExporting] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

    // Bulk selection state
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
    const headerCheckboxRef = useRef<HTMLInputElement>(null);

    // Delete confirmation modal & toast state
    const [deleteModalState, setDeleteModalState] = useState<DeleteModalState | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const { data: questions = [], isLoading } = useQuery({
        queryKey: ['admin-questions', icaiFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page_size', '1000');
            if (icaiFilter.levelId) params.append('level_id', icaiFilter.levelId);
            if (icaiFilter.paperId) params.append('paper_id', icaiFilter.paperId);
            if (icaiFilter.chapterId) params.append('chapter_id', icaiFilter.chapterId);
            if (icaiFilter.topicId) params.append('icai_topic_id', icaiFilter.topicId);
            
            const res = (await api.get(`/materials/subjective-questions/?${params.toString()}`)).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        }
    });

    const uniqueYears = useMemo(() => {
        const years = (questions as any[]).map((q: any) => q.year).filter(Boolean);
        return Array.from(new Set(years)).sort((a: any, b: any) => b - a) as any[];
    }, [questions]);

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => sortKey === col ? (sortDir === 'asc' ? <SortAsc size={13} /> : <SortDesc size={13} />) : null;

    const filtered = useMemo(() => {
        let list = [...questions];
        
        // Dynamic curriculum filters
        if (icaiFilter.levelId) {
            list = list.filter((q: any) => String(q.icai_level_id) === String(icaiFilter.levelId));
        }
        if (icaiFilter.paperId) {
            list = list.filter((q: any) => String(q.icai_paper_id) === String(icaiFilter.paperId));
        }
        if (icaiFilter.chapterId) {
            list = list.filter((q: any) => String(q.icai_chapter_id) === String(icaiFilter.chapterId));
        }
        if (icaiFilter.topicId) {
            list = list.filter((q: any) => String(q.icai_topic) === String(icaiFilter.topicId));
        }

        if (searchQuery) {
            const lowSearch = searchQuery.toLowerCase();
            list = list.filter((q: any) =>
                [q.topic_name, q.icai_topic_name, q.icai_chapter_name, q.icai_paper_name, q.icai_level_name, q.source, q.q_no, q.year, q.question_text, q.tags]
                    .some(f => (f || '').toLowerCase().includes(lowSearch))
            );
        }
        if (filterSource) list = list.filter((q: any) => q.source === filterSource);
        if (filterAttempt) list = list.filter((q: any) => q.attempt === filterAttempt);
        if (filterYear) list = list.filter((q: any) => String(q.year) === String(filterYear));
        if (filterStatus) list = list.filter((q: any) => q.status === filterStatus);
        if (importantOnly) list = list.filter((q: any) => q.is_important);

        list.sort((a: any, b: any) => {
            let av = a[sortKey] ?? '';
            let bv = b[sortKey] ?? '';
            if (sortKey === 'course_name') {
                av = a.icai_level_name || a.course_name || '';
                bv = b.icai_level_name || b.course_name || '';
            } else if (sortKey === 'subject_name') {
                av = a.icai_paper_name || a.subject_name || '';
                bv = b.icai_paper_name || b.subject_name || '';
            }
            if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return list;
    }, [questions, searchQuery, filterSource, filterAttempt, filterYear, filterStatus, importantOnly, sortKey, sortDir, icaiFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filtered.length]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    
    const paginated = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, currentPage]);

    const isAllOnPageSelected = useMemo(() => {
        return paginated.length > 0 && paginated.every((q: any) => selectedQuestionIds.includes(q.id));
    }, [paginated, selectedQuestionIds]);

    const isSomeOnPageSelected = useMemo(() => {
        return paginated.some((q: any) => selectedQuestionIds.includes(q.id)) && !isAllOnPageSelected;
    }, [paginated, selectedQuestionIds, isAllOnPageSelected]);

    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = isSomeOnPageSelected;
        }
    }, [isSomeOnPageSelected]);

    const handleToggleSelectAllOnPage = () => {
        if (isAllOnPageSelected) {
            const pageIds = new Set(paginated.map((q: any) => q.id));
            setSelectedQuestionIds(prev => prev.filter(id => !pageIds.has(id)));
        } else {
            const pageIds = paginated.map((q: any) => q.id);
            setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const handleSelectAllFiltered = () => {
        setSelectedQuestionIds(filtered.map((q: any) => q.id));
    };

    const handleClearSelection = () => {
        setSelectedQuestionIds([]);
    };

    const handleToggleSelectRow = (id: number) => {
        setSelectedQuestionIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Open single delete confirmation pop-up
    const handleOpenSingleDelete = (q: any) => {
        setDeleteModalState({
            isOpen: true,
            mode: 'single',
            singleQuestion: q,
            ids: [q.id]
        });
    };

    // Open bulk delete confirmation pop-up
    const handleOpenBulkDelete = () => {
        if (selectedQuestionIds.length === 0) return;
        setDeleteModalState({
            isOpen: true,
            mode: 'bulk',
            ids: [...selectedQuestionIds]
        });
    };

    const handleCloseDeleteModal = () => {
        if (isDeleting) return;
        setDeleteModalState(null);
    };

    // Execute deletion upon modal confirmation
    const handleConfirmDelete = async () => {
        if (!deleteModalState || deleteModalState.ids.length === 0) return;
        setIsDeleting(true);
        try {
            const targetIds = deleteModalState.ids;
            if (targetIds.length === 1 && deleteModalState.mode === 'single') {
                await api.delete(`/materials/subjective-questions/${targetIds[0]}/`);
            } else {
                await api.post('/materials/subjective-questions/bulk-delete/', { ids: targetIds });
            }

            // Remove deleted IDs from selection
            const deletedSet = new Set(targetIds);
            setSelectedQuestionIds(prev => prev.filter(id => !deletedSet.has(id)));

            setFeedbackToast({
                type: 'success',
                message: `✓ Successfully deleted ${targetIds.length} question${targetIds.length > 1 ? 's' : ''}.`
            });
            setTimeout(() => setFeedbackToast(null), 4000);

            setDeleteModalState(null);
            queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
        } catch (err: any) {
            console.error('Failed to delete questions', err);
            const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete question(s).';
            setFeedbackToast({
                type: 'error',
                message: errMsg
            });
            setTimeout(() => setFeedbackToast(null), 5000);
        } finally {
            setIsDeleting(false);
        }
    };

    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const downloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const resp = await api.get('/materials/questions/download-template/?type=all', { responseType: 'blob' });
            const url  = URL.createObjectURL(new Blob([resp.data]));
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'QBank_Import_Format.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Failed to download template. Please try again.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            const resp = await api.get('/materials/questions/export-excel/', { responseType: 'blob' });
            const url  = URL.createObjectURL(new Blob([resp.data]));
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'QBank_Exported_Questions.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="qm-container">
            {/* Excel Import Working Model Modal */}
            <ExcelImportModal
                isOpen={isExcelModalOpen}
                onClose={() => setIsExcelModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-questions'] })}
            />

            <div className="qm-header" style={{ marginBottom: '1rem' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Question Bank</h1>
                    <p className="page-subtitle" style={{ color: '#64748b' }}>Manage enterprise questions</p>
                </div>
                <div className="header-actions">
                    {/* Download Template */}
                    <button
                        className="secondary-btn flex-center gap-sm"
                        onClick={downloadTemplate}
                        disabled={downloadingTemplate}
                        style={{ borderColor: '#4f46e5', color: '#4f46e5', fontWeight: 600 }}
                        title="Download QBank_Import_Format.xlsx (Master Template)"
                    >
                        {downloadingTemplate ? <Loader2 size={18} className="spin" /> : <Download size={18} color="#4f46e5" />}
                        <span>{downloadingTemplate ? 'Downloading...' : 'Download Template'}</span>
                    </button>

                    {/* Export Excel */}
                    <button className="secondary-btn flex-center gap-sm" onClick={exportExcel} disabled={exporting}>
                        {exporting ? <Loader2 size={18} className="spin" /> : <FileSpreadsheet size={18} color="#16a34a" />}
                        <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
                    </button>

                    {/* Import Excel Working Model */}
                    <button
                        className="secondary-btn flex-center gap-sm"
                        onClick={() => setIsExcelModalOpen(true)}
                        style={{ background: '#f5f3ff', borderColor: '#7c3aed', color: '#7c3aed', fontWeight: 700 }}
                    >
                        <Upload size={18} />
                        <span>Import Excel (3 Models)</span>
                    </button>

                    {/* AI Dual-PDF Import (Secondary) */}
                    <Link
                        to="/admin/questions/import"
                        className="secondary-btn flex-center gap-sm"
                        style={{ color: '#64748b', borderColor: '#cbd5e1' }}
                        title="AI PDF Question Paper & Answer Sheet Import"
                    >
                        <Sparkles size={16} />
                        <span>AI PDF Import</span>
                    </Link>

                    {/* Add Single Question Manually */}
                    <Link to="/admin/questions/new" className="primary-btn flex-center gap-sm">
                        <Plus size={18} />
                        <span>Add Single Question</span>
                    </Link>
                </div>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                            <Filter size={18} /><span>Filters</span>
                        </button>
                        <button className={`filter-btn ${importantOnly ? 'active' : ''}`} onClick={() => setImportantOnly(!importantOnly)}>
                            <span>Important</span>
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="filter-drawer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 1.25rem' }}>
                        <div className="admin-question-bank-cascade" style={{ width: '100%' }}>
                            <ICAICascadeSelector
                                value={icaiFilter}
                                onChange={setIcaiFilter}
                                required={false}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select className="form-input" style={{ minWidth: '160px' }} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                                <option value="">All Sources</option>
                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select className="form-input" style={{ minWidth: '160px' }} value={filterAttempt} onChange={e => setFilterAttempt(e.target.value)}>
                                <option value="">All Attempts</option>
                                {ATTEMPTS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <select className="form-input" style={{ minWidth: '160px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                                <option value="">All Years</option>
                                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select className="form-input" style={{ minWidth: '160px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">All Statuses</option>
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            {(icaiFilter.levelId || icaiFilter.paperId || icaiFilter.chapterId || icaiFilter.topicId || filterSource || filterAttempt || filterYear || filterStatus) && (
                                <button
                                    onClick={() => {
                                        setIcaiFilter({ levelId: '', paperId: '', chapterId: '', topicId: '' });
                                        setFilterSource('');
                                        setFilterAttempt('');
                                        setFilterYear('');
                                        setFilterStatus('');
                                    }}
                                    className="secondary-btn text-xs"
                                    style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Bulk selection action bar */}
                {selectedQuestionIds.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1.25rem',
                        background: '#fef2f2',
                        borderBottom: '1px solid #fecaca',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                color: '#991b1b'
                            }}>
                                <span style={{
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem'
                                }}>
                                    {selectedQuestionIds.length}
                                </span>
                                <span>Question{selectedQuestionIds.length > 1 ? 's' : ''} Selected</span>
                            </span>

                            {filtered.length > paginated.length && selectedQuestionIds.length < filtered.length && (
                                <button
                                    type="button"
                                    onClick={handleSelectAllFiltered}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#4f46e5',
                                        fontSize: '0.825rem',
                                        fontWeight: 600,
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        padding: '0 4px'
                                    }}
                                >
                                    Select all {filtered.length} questions across all pages
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.85rem',
                                    fontSize: '0.825rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Selection
                            </button>

                            <button
                                type="button"
                                onClick={handleOpenBulkDelete}
                                style={{
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.45rem 1.1rem',
                                    fontSize: '0.825rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                                }}
                            >
                                <Trash2 size={15} />
                                <span>Delete Selected ({selectedQuestionIds.length})</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '44px', textAlign: 'center', paddingLeft: '1rem', paddingRight: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        ref={headerCheckboxRef}
                                        checked={isAllOnPageSelected}
                                        onChange={handleToggleSelectAllOnPage}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#4f46e5' }}
                                        title="Select all on this page"
                                    />
                                </th>
                                <th onClick={() => toggleSort('id')}>ID <SortIcon col="id" /></th>
                                <th onClick={() => toggleSort('course_name')}>Course <SortIcon col="course_name" /></th>
                                <th onClick={() => toggleSort('subject_name')}>Subject <SortIcon col="subject_name" /></th>
                                <th>Source</th>
                                <th>Attempt</th>
                                <th>Year</th>
                                <th>Q.No</th>
                                <th>Type</th>
                                <th>Marks</th>
                                <th>Difficulty</th>
                                <th>Status</th>
                                <th>Added By</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={14} style={{ textAlign: 'center' }}>Loading...</td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No questions found matching your filter criteria.</td></tr>
                            ) : paginated.map((q: any) => {
                                const isSelected = selectedQuestionIds.includes(q.id);
                                return (
                                <tr key={q.id} style={{ backgroundColor: isSelected ? '#f5f3ff' : undefined }}>
                                    <td style={{ textAlign: 'center', paddingLeft: '1rem', paddingRight: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectRow(q.id)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#4f46e5' }}
                                        />
                                    </td>
                                    <td>#{q.id}</td>
                                    <td>
                                        <span className="text-xs font-bold text-slate-700">
                                            {q.icai_level_name || q.course_name || '—'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-xs font-semibold text-slate-600">
                                            {q.icai_paper_name || q.subject_name || '—'}
                                        </span>
                                    </td>
                                    <td><Badge text={q.source} color="#2563eb" bg="#eff6ff" /></td>
                                    <td>{q.attempt}</td>
                                    <td>{q.year}</td>
                                    <td>
                                        {q.q_no?.startsWith('CS') ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-150 text-indigo-700 border border-indigo-200">
                                                CS-{q.q_no.replace('CS', '')}
                                            </span>
                                        ) : q.q_no}
                                    </td>
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
                                        <span className="text-xs font-semibold text-slate-600">
                                            {q.created_by_name || 'System'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Link to={`/admin/questions/${q.id}/edit`} className="action-btn" title="Edit Question"><Edit size={16} /></Link>
                                            <button className="action-btn danger" onClick={() => handleOpenSingleDelete(q)} title="Delete Question"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer with Pagination */}
                {filtered.length > 0 && (
                    <div className="table-footer">
                        <div className="showing-text">
                            Showing <span className="font-medium">{Math.min(filtered.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
                            <span className="font-medium">{Math.min(filtered.length, currentPage * ITEMS_PER_PAGE)}</span> of{' '}
                            <span className="font-medium">{filtered.length}</span> questions
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className={`page-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                    onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    style={{ cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    &laquo;
                                </button>
                                {Array.from({ length: totalPages }).map((_, i) => {
                                    const pageNum = i + 1;
                                    if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) {
                                        return (
                                            <button
                                                key={pageNum}
                                                className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(pageNum)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    if (pageNum === 2 || pageNum === totalPages - 1) {
                                        return <span key={pageNum} className="page-dots" style={{ padding: '0 4px', color: '#64748b' }}>...</span>;
                                    }
                                    return null;
                                })}
                                <button
                                    className={`page-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                    onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    style={{ cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    &raquo;
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confirm Delete Pop-Up Modal */}
            {deleteModalState && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isDeleting) {
                            handleCloseDeleteModal();
                        }
                    }}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: '1.25rem',
                            width: '100%',
                            maxWidth: '520px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '1.5rem 1.75rem 1rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                <div style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    background: '#fee2e2',
                                    border: '4px solid #fef2f2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#dc2626',
                                    flexShrink: 0
                                }}>
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                        {deleteModalState.mode === 'single'
                                            ? `Delete Question #${deleteModalState.singleQuestion?.id}?`
                                            : `Delete ${deleteModalState.ids.length} Questions?`}
                                    </h2>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.825rem', color: '#64748b' }}>
                                        {deleteModalState.mode === 'single'
                                            ? 'Are you sure you want to permanently remove this question?'
                                            : 'Are you sure you want to permanently remove these selected questions?'}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseDeleteModal}
                                disabled={isDeleting}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '0 1.75rem 1.25rem' }}>
                            {deleteModalState.mode === 'single' && deleteModalState.singleQuestion && (
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '0.85rem 1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>
                                            #{deleteModalState.singleQuestion.id}
                                        </span>
                                        <span style={{ color: '#94a3b8' }}>•</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb' }}>
                                            Q.{deleteModalState.singleQuestion.q_no || '—'}
                                        </span>
                                        <span style={{ color: '#94a3b8' }}>•</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                            {deleteModalState.singleQuestion.icai_paper_name || deleteModalState.singleQuestion.subject_name || 'Advanced Accounting'}
                                        </span>
                                        <span style={{ color: '#94a3b8' }}>•</span>
                                        <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                            {deleteModalState.singleQuestion.attempt || ''} {deleteModalState.singleQuestion.year || ''}
                                        </span>
                                    </div>

                                    {deleteModalState.singleQuestion.question_text && (
                                        <p style={{
                                            margin: '0.35rem 0 0',
                                            fontSize: '0.8rem',
                                            color: '#475569',
                                            lineHeight: 1.4,
                                            fontStyle: 'italic',
                                            maxHeight: '60px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            "{deleteModalState.singleQuestion.question_text.slice(0, 140)}
                                            {deleteModalState.singleQuestion.question_text.length > 140 ? '...' : ''}"
                                        </p>
                                    )}
                                </div>
                            )}

                            {deleteModalState.mode === 'bulk' && (
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '0.85rem 1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                                        Selected Questions to Delete ({deleteModalState.ids.length}):
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.35rem',
                                        maxHeight: '90px',
                                        overflowY: 'auto'
                                    }}>
                                        {deleteModalState.ids.slice(0, 30).map(id => (
                                            <span
                                                key={id}
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    padding: '2px 7px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    color: '#334155'
                                                }}
                                            >
                                                #{id}
                                            </span>
                                        ))}
                                        {deleteModalState.ids.length > 30 && (
                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, alignSelf: 'center' }}>
                                                + {deleteModalState.ids.length - 30} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Warning note */}
                            <div style={{
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.6rem'
                            }}>
                                <AlertCircle size={18} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ fontSize: '0.8rem', color: '#9f1239', lineHeight: 1.45 }}>
                                    <strong>Warning:</strong> This deletion is permanent and cannot be undone. All associated sub-questions, MCQ options, and suggested answers will be permanently deleted from the enterprise database.
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div style={{
                            padding: '1rem 1.75rem',
                            background: '#f8fafc',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.75rem'
                        }}>
                            <button
                                type="button"
                                onClick={handleCloseDeleteModal}
                                disabled={isDeleting}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '0.55rem 1.15rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                style={{
                                    background: isDeleting ? '#f87171' : '#dc2626',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.55rem 1.35rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
                                }}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        <span>
                                            {deleteModalState.mode === 'single'
                                                ? 'Delete Question'
                                                : `Delete ${deleteModalState.ids.length} Questions`}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Toast */}
            {feedbackToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    zIndex: 10000,
                    background: feedbackToast.type === 'success' ? '#15803d' : '#b91c1c',
                    color: '#ffffff',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.875rem',
                    fontWeight: 600
                }}>
                    {feedbackToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span>{feedbackToast.message}</span>
                </div>
            )}
        </div>
    );
}
