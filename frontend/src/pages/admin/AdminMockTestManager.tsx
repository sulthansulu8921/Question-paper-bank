import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, Play } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    title: '',
    description: '',
    qualification: '',
    course_level: '',
    duration_minutes: 60,
    total_questions: 50,
    difficulty: 'MIXED',
    is_published: true,
    questions: [] as number[],
};

export default function AdminMockTestManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'preview' | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    
    const [formData, setFormData] = useState(emptyForm);
    const [mcqSearch, setMcqSearch] = useState('');
    const [previewItem, setPreviewItem] = useState<any>(null);

    // Queries
    const { data: templates = [], isLoading: templatesLoading } = useQuery({
        queryKey: ['admin-mock-templates'],
        queryFn: async () => (await api.get('/materials/mock-templates/')).data,
    });

    const { data: mcqs = [], isLoading: mcqsLoading } = useQuery({
        queryKey: ['admin-active-mcqs'],
        queryFn: async () => {
            const res = await api.get('/materials/subjective-questions/?question_type=MCQ&page_size=1000');
            return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        }
    });

    const { data: tree = [] } = useQuery({
        queryKey: ['master-tree'],
        queryFn: async () => (await api.get('/master/tree/')).data,
    });

    // Unique exam streams from tree
    const streams = useMemo(() => {
        const set = new Set<string>();
        tree.forEach((level: any) => {
            if (level.qualification) {
                set.add(level.qualification.toUpperCase());
            }
        });
        return Array.from(set).sort();
    }, [tree]);

    // Levels for selected stream
    const levelsForSelectedStream = useMemo(() => {
        if (!formData.qualification) return [];
        return tree.filter((l: any) => l.qualification?.toUpperCase() === formData.qualification.toUpperCase());
    }, [tree, formData.qualification]);

    // Filter MCQs for selection list
    const filteredMcqs = useMemo(() => {
        let list = [...mcqs];
        // Filter by qualification and level if selected
        if (formData.qualification) {
            list = list.filter((q: any) => q.icai_topic?.chapter?.paper?.level?.qualification?.toUpperCase() === formData.qualification.toUpperCase());
        }
        if (formData.course_level) {
            list = list.filter((q: any) => q.icai_topic?.chapter?.paper?.level?.name?.toLowerCase() === formData.course_level.toLowerCase());
        }
        if (mcqSearch) {
            const s = mcqSearch.toLowerCase();
            list = list.filter((q: any) => (q.question_text || '').toLowerCase().includes(s) || (q.icai_topic?.name || '').toLowerCase().includes(s));
        }
        return list;
    }, [mcqs, formData.qualification, formData.course_level, mcqSearch]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: typeof formData) => api.post('/materials/mock-templates/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-mock-templates'] });
            closeModal();
            show('Mock Test Template created successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to create Mock Test Template.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
            api.patch(`/materials/mock-templates/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-mock-templates'] });
            closeModal();
            show('Mock Test Template updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update Mock Test Template.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/mock-templates/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-mock-templates'] });
            show('Mock Test Template deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete template.'), 'error'),
    });

    const closeModal = () => {
        setModalMode(null);
        setEditId(null);
        setFormData(emptyForm);
        setMcqSearch('');
        setPreviewItem(null);
    };

    const openAdd = () => {
        setFormData(emptyForm);
        setModalMode('add');
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setFormData({
            title: item.title || '',
            description: item.description || '',
            qualification: item.qualification || '',
            course_level: item.course_level || '',
            duration_minutes: item.duration_minutes || 60,
            total_questions: item.total_questions || 50,
            difficulty: item.difficulty || 'MIXED',
            is_published: item.is_published ?? true,
            questions: (item.questions || []).map((q: any) => typeof q === 'number' ? q : q.id),
        });
        setModalMode('edit');
    };

    const openPreview = (item: any) => {
        setPreviewItem(item);
        setModalMode('preview');
    };

    const handleSave = () => {
        if (!formData.title.trim() || !formData.qualification) {
            show('Title and Qualification are required.', 'error');
            return;
        }
        
        if (formData.questions.length > 0 && formData.questions.length !== formData.total_questions) {
            if (!confirm(`Warning: You have manually selected ${formData.questions.length} questions, but set total questions to ${formData.total_questions}. Proceed anyway?`)) {
                return;
            }
        }

        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const toggleQuestionSelection = (qId: number) => {
        setFormData(prev => {
            const exists = prev.questions.includes(qId);
            const updated = exists 
                ? prev.questions.filter(id => id !== qId)
                : [...prev.questions, qId];
            return {
                ...prev,
                questions: updated
            };
        });
    };

    const filteredTemplates = templates.filter((t: any) =>
        t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.qualification?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container" style={{ fontFamily: 'Inter, sans-serif' }}>
            {Toast}
            
            {/* Header */}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Mock Test Templates</h1>
                    <p className="page-subtitle">Configure structured mock examinations and assign fixed question sheets.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={20} /> <span>Create Template</span>
                </button>
            </div>

            {/* List */}
            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search templates by title or course..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Test Title</th>
                                <th>Category &amp; Level</th>
                                <th>Duration</th>
                                <th>Questions</th>
                                <th>Status</th>
                                <th>Mode</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {templatesLoading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#4f46e5' }} />
                                    </td>
                                </tr>
                            )}
                            {!templatesLoading && filteredTemplates.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        No Mock Test Templates found. Click "Create Template" to build one.
                                    </td>
                                </tr>
                            )}
                            {filteredTemplates.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="font-bold text-main">
                                        <div>{item.title}</div>
                                        {item.description && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>{item.description}</div>}
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.qualification}</span>
                                        {item.course_level && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 6 }}>({item.course_level})</span>}
                                    </td>
                                    <td style={{ fontWeight: 600, color: '#334155' }}>{item.duration_minutes} Mins</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontWeight: 700, color: '#4f46e5' }}>{item.total_questions} Qs</span>
                                            {item.questions && item.questions.length > 0 ? (
                                                <span style={{ padding: '2px 8px', borderRadius: 10, background: '#eef2ff', color: '#4f46e5', fontSize: '0.68rem', fontWeight: 700 }}>
                                                    {item.questions.length} Fixed
                                                </span>
                                            ) : (
                                                <span style={{ padding: '2px 8px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontSize: '0.68rem', fontWeight: 700 }}>
                                                    Auto-Gen
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider ${
                                            item.is_published ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                                        }`}>
                                            {item.is_published ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#ef4444' }}>
                                            CHALLENGE
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons" style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="action-btn" title="Preview Questions" onClick={() => openPreview(item)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }}>
                                                <Play size={15} color="#4f46e5" />
                                            </button>
                                            <button type="button" className="action-btn" title="Edit Template" onClick={() => openEdit(item)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }}>
                                                <Edit size={15} color="#475569" />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-btn danger"
                                                title="Delete"
                                                style={{ background: '#fff1f2', border: '1px solid #fee2e2', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }}
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Template',
                                                    message: `Are you sure you want to delete the Mock Template "${item.title}"?`,
                                                    onConfirm: () => {
                                                        deleteMutation.mutate(item.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                            >
                                                <Trash2 size={15} color="#ef4444" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AdminModal
                open={modalMode === 'add' || modalMode === 'edit'}
                onClose={closeModal}
                title={modalMode === 'edit' ? 'Edit Mock Test Template' : 'Create Mock Test Template'}
                footer={
                    <>
                        <button type="button" className="secondary-btn" onClick={closeModal}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: 'none' }}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Save Template</span>
                        </button>
                    </>
                }
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="admin-form-group">
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Template Title *</label>
                            <input
                                className="admin-form-input"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. CA Intermediate Accounts Mock 1"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        
                        <div className="admin-form-group">
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Description</label>
                            <textarea
                                className="admin-form-input"
                                style={{ height: '70px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detailed guidelines or exam rules..."
                            />
                        </div>

                        <div className="admin-form-group">
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Exam Category *</label>
                            <select
                                className="admin-form-input"
                                value={formData.qualification}
                                onChange={(e) => setFormData({ ...formData, qualification: e.target.value, course_level: '', questions: [] })}
                                style={{ width: '100%' }}
                            >
                                <option value="">Select Category...</option>
                                {streams.map(stream => (
                                    <option key={stream} value={stream}>{stream}</option>
                                ))}
                            </select>
                        </div>

                        <div className="admin-form-group">
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Course Level (optional)</label>
                            <select
                                className="admin-form-input"
                                value={formData.course_level}
                                onChange={(e) => setFormData({ ...formData, course_level: e.target.value, questions: [] })}
                                disabled={!formData.qualification}
                                style={{ width: '100%' }}
                            >
                                <option value="">Select Level...</option>
                                {levelsForSelectedStream.map((lvl: any) => (
                                    <option key={lvl.id} value={lvl.name}>{lvl.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="admin-form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Duration (Minutes)</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value, 10) || 60 })}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div className="admin-form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Total Questions</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    value={formData.total_questions}
                                    onChange={(e) => setFormData({ ...formData, total_questions: parseInt(e.target.value, 10) || 10 })}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>Target Difficulty</label>
                            <select
                                className="admin-form-input"
                                value={formData.difficulty}
                                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                style={{ width: '100%' }}
                            >
                                <option value="MIXED">Mixed (Balanced)</option>
                                <option value="EASY">Easy</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HARD">Hard</option>
                            </select>
                        </div>

                        <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                            <input
                                type="checkbox"
                                id="is_published"
                                checked={formData.is_published}
                                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <label htmlFor="is_published" style={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem' }}>
                                Publish Template immediately (Visible to Students)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Question Linker Section */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Link Specific MCQs</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                Pick specific MCQs to override auto-generation. Currently selected: {formData.questions.length} / {formData.total_questions}
                            </p>
                        </div>
                        <div style={{ position: 'relative', width: 220 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                value={mcqSearch}
                                onChange={e => setMcqSearch(e.target.value)}
                                placeholder="Filter MCQs to link..."
                                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                        {mcqsLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
                            </div>
                        ) : filteredMcqs.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                                No matching MCQs found in this category.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <tbody>
                                    {filteredMcqs.map((q: any) => {
                                        const isSelected = formData.questions.includes(q.id);
                                        return (
                                            <tr key={q.id} style={{ borderBottom: '1px solid #e2e8f0', background: isSelected ? '#f5f3ff' : 'transparent' }}>
                                                <td style={{ padding: '8px 10px', width: 40 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleQuestionSelection(q.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 10px', fontWeight: 700, color: '#94a3b8', width: 50 }}>#{q.id}</td>
                                                <td style={{ padding: '8px 10px', color: '#1e293b', fontWeight: 500 }}>
                                                    {q.question_text}
                                                </td>
                                                <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                                    {q.icai_topic?.chapter?.name || 'General'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </AdminModal>

            {/* Preview Modal */}
            <AdminModal
                open={modalMode === 'preview' && previewItem !== null}
                onClose={closeModal}
                title={`Mock Template Preview: ${previewItem?.title}`}
                footer={
                    <button type="button" className="secondary-btn" onClick={closeModal}>
                        Close Preview
                    </button>
                }
            >
                {previewItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Exam Stream</span>
                                <span style={{ fontWeight: 800, color: '#0f172a' }}>{previewItem.qualification}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Duration</span>
                                <span style={{ fontWeight: 800, color: '#0f172a' }}>{previewItem.duration_minutes} Minutes</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Difficulty</span>
                                <span style={{ fontWeight: 800, color: '#0f172a' }}>{previewItem.difficulty}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Total Questions</span>
                                <span style={{ fontWeight: 800, color: '#0f172a' }}>{previewItem.total_questions} Questions</span>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#4f46e5', letterSpacing: '0.05em' }}>
                                Linked Questions ({previewItem.question_details?.length || 0})
                            </h3>
                            {previewItem.question_details && previewItem.question_details.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                                    {previewItem.question_details.map((q: any, i: number) => (
                                        <div key={q.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: 'white' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                <span style={{ fontWeight: 800, color: '#334155', fontSize: '0.78rem' }}>Q{i+1}. MCQ</span>
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{q.id}</span>
                                            </div>
                                            <p style={{ margin: '0 0 10px', color: '#0f172a', fontWeight: 500, fontSize: '0.82rem' }}>{q.question_text}</p>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                {(q.options || []).map((o: any, idx: number) => (
                                                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: o.is_correct ? '#dcfce7' : '#f8fafc', border: `1px solid ${o.is_correct ? '#86efac' : '#e2e8f0'}` }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: o.is_correct ? 800 : 500, color: o.is_correct ? '#166534' : '#475569' }}>
                                                            {String.fromCharCode(65 + idx)}. {o.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 12, color: '#64748b', fontSize: '0.82rem' }}>
                                    No manually linked questions. This test will auto-generate {previewItem.total_questions} random MCQs matching the criteria at runtime.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </AdminModal>

            {/* Confirm Delete */}
            <AdminConfirmModal
                open={confirmDelete.open}
                onClose={() => setConfirmDelete(prev => ({ ...prev, open: false }))}
                onConfirm={confirmDelete.onConfirm}
                title={confirmDelete.title}
                message={confirmDelete.message}
            />
        </div>
    );
}
