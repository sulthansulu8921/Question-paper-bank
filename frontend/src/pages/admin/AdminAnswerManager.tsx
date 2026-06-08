import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, ExternalLink } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import FileUploadZone from '@/components/admin/FileUploadZone';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = { title: '', subject: '', question_paper: '', file_url: '' };

const AdminAnswerManager = () => {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    const [formData, setFormData] = useState(emptyForm);

    const { data: answers = [], isLoading } = useQuery({
        queryKey: ['admin-answers'],
        queryFn: async () => (await api.get('/materials/answers/')).data,
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects-small'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
    });

    const { data: papers = [] } = useQuery({
        queryKey: ['papers-small'],
        queryFn: async () => (await api.get('/materials/question-papers/')).data,
    });

    const buildPayload = () => ({
        title: formData.title.trim(),
        subject: parseInt(formData.subject, 10),
        question_paper: formData.question_paper ? parseInt(formData.question_paper, 10) : null,
        file_url: formData.file_url || '',
        description: '',
    });

    const createMutation = useMutation({
        mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/materials/answers/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-answers'] });
            closeModal();
            show('Suggested answer added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add answer.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
            api.patch(`/materials/answers/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-answers'] });
            closeModal();
            show('Answer updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update answer.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/answers/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-answers'] });
            show('Answer deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete answer.'), 'error'),
    });

    const closeModal = () => {
        setModalMode(null);
        setEditId(null);
        setFormData(emptyForm);
    };

    const openAdd = () => {
        setFormData(emptyForm);
        setModalMode('add');
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setFormData({
            title: item.title || '',
            subject: item.subject?.toString() || '',
            question_paper: item.question_paper?.toString() || '',
            file_url: item.file_url || '',
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim() || !formData.subject) {
            show('Title and subject are required.', 'error');
            return;
        }
        const payload = buildPayload();
        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const filtered = answers.filter((a: any) => a.title?.toLowerCase().includes(searchTerm.toLowerCase()));
    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Suggested Answers</h1>
                    <p className="page-subtitle">Upload and manage official model answer papers.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} /> <span>Add Answer</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search answers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Subject</th>
                                <th>Linked Paper</th>
                                <th>PDF</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                                        No answers yet. Add your first suggested answer.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="font-bold text-main">{item.title}</td>
                                    <td className="text-muted">{item.subject_name || '—'}</td>
                                    <td className="text-muted">{item.question_paper_title || '—'}</td>
                                    <td>
                                        {item.file_url ? (
                                            <a href={item.file_url} target="_blank" rel="noreferrer" className="action-btn" title="Open PDF">
                                                <ExternalLink size={16} />
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button type="button" className="action-btn" title="Edit" onClick={() => openEdit(item)}>
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-btn danger"
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Suggested Answer',
                                                    message: `Are you sure you want to delete the suggested answer "${item.title}"? This action cannot be undone.`,
                                                    onConfirm: () => {
                                                        deleteMutation.mutate(item.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AdminModal
                open={modalMode !== null}
                onClose={closeModal}
                title={modalMode === 'edit' ? 'Edit Suggested Answer' : 'Add Suggested Answer'}
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
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Save Answer</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Title *</label>
                    <input
                        className="admin-form-input"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Nov 2023 Suggested Answers"
                    />
                </div>
                <div className="admin-form-group">
                    <label>Subject *</label>
                    <select
                        className="admin-form-input"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    >
                        <option value="">Select Subject...</option>
                        {subjects.map((s: any) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>Linked Question Paper (optional)</label>
                    <select
                        className="admin-form-input"
                        value={formData.question_paper}
                        onChange={(e) => setFormData({ ...formData, question_paper: e.target.value })}
                    >
                        <option value="">None</option>
                        {papers.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>Answer PDF</label>
                    <FileUploadZone
                        onFileUploaded={(url) => setFormData({ ...formData, file_url: url })}
                        accept="application/pdf"
                        label="Upload Answer PDF"
                        existingUrl={formData.file_url}
                    />
                </div>
            </AdminModal>

            <AdminConfirmModal
                open={confirmDelete.open}
                onClose={() => setConfirmDelete(prev => ({ ...prev, open: false }))}
                onConfirm={confirmDelete.onConfirm}
                title={confirmDelete.title}
                message={confirmDelete.message}
            />
        </div>
    );
};

export default AdminAnswerManager;
