import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, ExternalLink, Upload } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import FileUploadZone from '@/components/admin/FileUploadZone';
import PDFUploadModal from '@/components/admin/PDFUploadModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = { title: '', year: '', source: '', subject: '', file_url: '' };

const AdminPaperManager = () => {
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
    const [showUploadPdf, setShowUploadPdf] = useState(false);

    const { data: papers = [], isLoading } = useQuery({
        queryKey: ['admin-papers'],
        queryFn: async () => (await api.get('/materials/question-papers/')).data,
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['admin-subjects-tiny'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
    });

    const buildPayload = () => ({
        title: formData.title.trim(),
        year: formData.year ? parseInt(formData.year, 10) : null,
        source: formData.source.trim(),
        subject: parseInt(formData.subject, 10),
        file_url: formData.file_url || '',
        description: '',
    });

    const createMutation = useMutation({
        mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/materials/question-papers/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-papers'] });
            closeModal();
            show('Model test paper added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add paper.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
            api.patch(`/materials/question-papers/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-papers'] });
            closeModal();
            show('Paper updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update paper.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/question-papers/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-papers'] });
            show('Paper deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete paper.'), 'error'),
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
            year: item.year?.toString() || '',
            source: item.source || '',
            subject: item.subject?.toString() || '',
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

    const filtered = papers.filter((p: any) =>
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.source || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Model Test Papers</h1>
                    <p className="page-subtitle">Manage previous year question papers and mock tests.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowUploadPdf(true)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg font-semibold text-sm hover:bg-emerald-100 transition-colors">
                        <Upload size={16} /> Upload PDF
                    </button>
                    <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                        <Plus size={20} /> <span>Add Paper</span>
                    </button>
                </div>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search papers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        {filtered.length} papers
                    </span>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Year</th>
                                <th>Source</th>
                                <th>Subject</th>
                                <th>PDF</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                                        No papers found. Click &quot;Add Paper&quot; to create one.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="font-bold text-main">{item.title}</td>
                                    <td className="text-muted">{item.year || '—'}</td>
                                    <td className="text-muted">{item.source || '—'}</td>
                                    <td className="text-muted">{item.subject_name || '—'}</td>
                                    <td>
                                        {item.file_url ? (
                                            <a href={item.file_url} target="_blank" rel="noreferrer" className="action-btn" title="Open PDF">
                                                <ExternalLink size={16} />
                                            </a>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
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
                                                title="Delete"
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Question Paper',
                                                    message: `Are you sure you want to delete the question paper "${item.title}"? This action cannot be undone.`,
                                                    onConfirm: () => {
                                                        deleteMutation.mutate(item.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                            >
                                                {deleteMutation.isPending && deleteMutation.variables === item.id ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={16} />
                                                )}
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
                title={modalMode === 'edit' ? 'Edit Question Paper' : 'Add Question Paper'}
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
                            <span>{modalMode === 'edit' ? 'Save Changes' : 'Save Paper'}</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Paper Title *</label>
                    <input
                        className="admin-form-input"
                        placeholder="e.g. Nov 2023 Accounts"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>
                <div className="admin-form-grid-2">
                    <div className="admin-form-group">
                        <label>Year</label>
                        <input
                            className="admin-form-input"
                            type="number"
                            placeholder="2024"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>Source</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. ICAI, MTP"
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                        />
                    </div>
                </div>
                <div className="admin-form-group">
                    <label>Subject *</label>
                    <select
                        className="admin-form-input"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    >
                        <option value="">Select Subject...</option>
                        {subjects.map((sub: any) => (
                            <option key={sub.id} value={sub.id}>
                                {sub.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>PDF Document</label>
                    <FileUploadZone
                        onFileUploaded={(url) => setFormData({ ...formData, file_url: url })}
                        accept="application/pdf"
                        label="Upload Question Paper PDF"
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

            <PDFUploadModal
                open={showUploadPdf}
                onClose={() => setShowUploadPdf(false)}
                onUploaded={() => {
                    queryClient.invalidateQueries({ queryKey: ['admin-papers'] });
                    show('PDF uploaded and paper record created!', 'success');
                    setShowUploadPdf(false);
                }}
            />
        </div>
    );
};

export default AdminPaperManager;
