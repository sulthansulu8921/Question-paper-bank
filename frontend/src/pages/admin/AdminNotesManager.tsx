import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, ExternalLink } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import FileUploadZone from '@/components/admin/FileUploadZone';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    title: '',
    description: '',
    course: '',
    subject: '',
    topic: '',
    file_url: '',
    is_premium: true
};

const AdminNotesManager = () => {
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

    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['admin-notes'],
        queryFn: async () => (await api.get('/materials/notes/')).data,
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['courses-small'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects-small'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
    });

    const { data: topics = [] } = useQuery({
        queryKey: ['topics-small'],
        queryFn: async () => (await api.get('/courses/topics/')).data,
    });

    // Filter subjects based on selected course in form
    const filteredSubjectsForForm = subjects.filter(
        (s: any) => !formData.course || String(s.course) === String(formData.course)
    );

    // Filter topics based on selected subject in form
    const filteredTopicsForForm = topics.filter(
        (t: any) => String(t.subject) === String(formData.subject)
    );

    const buildPayload = () => {
        const selectedSubj = subjects.find((s: any) => String(s.id) === String(formData.subject));
        return {
            title: formData.title.trim(),
            description: formData.description.trim(),
            subject: parseInt(formData.subject, 10),
            topic: formData.topic ? parseInt(formData.topic, 10) : null,
            course: formData.course ? parseInt(formData.course, 10) : (selectedSubj ? selectedSubj.course : null),
            file_url: formData.file_url || '',
            is_premium: formData.is_premium,
        };
    };


    const createMutation = useMutation({
        mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/materials/notes/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
            closeModal();
            show('Study Notes PDF added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add notes.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
            api.patch(`/materials/notes/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
            closeModal();
            show('Study Notes updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update notes.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/notes/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
            show('Notes deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete notes.'), 'error'),
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
        const subjectId = item.subject?.toString() || '';
        const selectedSubj = subjects.find((s: any) => String(s.id) === String(subjectId));
        const courseId = item.course?.toString() || (selectedSubj ? selectedSubj.course?.toString() : '');

        setFormData({
            title: item.title || '',
            description: item.description || '',
            course: courseId,
            subject: subjectId,
            topic: item.topic?.toString() || '',
            file_url: item.file_url || '',
            is_premium: item.is_premium ?? true,
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim() || !formData.subject || !formData.file_url) {
            show('Title, Subject, and PDF upload are required.', 'error');
            return;
        }
        const payload = buildPayload();
        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const filtered = notes.filter((n: any) =>
        n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.topic_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Study Notes Management</h1>
                    <p className="page-subtitle">Upload and manage subject-wise study notes PDFs.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} /> <span>Add Study Notes</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search notes by title, subject or chapter..."
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
                                <th>Chapter / Topic</th>
                                <th>Access</th>
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
                                        No study notes found. Add your first PDF study notes.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="font-bold text-main">
                                        <div>{item.title}</div>
                                        {item.description && <div className="text-muted font-normal text-xs mt-0.5">{item.description}</div>}
                                    </td>
                                    <td className="text-muted">{item.subject_name || '—'}</td>
                                    <td className="text-muted">{item.topic_name || 'General'}</td>
                                    <td>
                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider ${
                                            item.is_premium ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                                        }`}>
                                            {item.is_premium ? 'Premium' : 'Free'}
                                        </span>
                                    </td>
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
                                                    title: 'Delete Study Notes',
                                                    message: `Are you sure you want to delete the study notes "${item.title}"? This action cannot be undone.`,
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
                title={modalMode === 'edit' ? 'Edit Study Notes' : 'Add Study Notes'}
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
                            <span>Save Notes</span>
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
                        placeholder="e.g. Chapter 1: Introduction to AS"
                    />
                </div>
                <div className="admin-form-group">
                    <label>Brief Description</label>
                    <textarea
                        className="admin-form-input"
                        style={{ height: '70px', resize: 'vertical' }}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Provide details about what these study notes cover..."
                    />
                </div>
                <div className="admin-form-group">
                    <label>Course (optional)</label>
                    <select
                        className="admin-form-input"
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: e.target.value, subject: '', topic: '' })}
                    >
                        <option value="">Select Course...</option>
                        {courses.map((c: any) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>Subject *</label>
                    <select
                        className="admin-form-input"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value, topic: '' })}
                    >
                        <option value="">Select Subject...</option>
                        {filteredSubjectsForForm.map((s: any) => (
                            <option key={s.id} value={s.id}>
                                {s.name} {s.course_name ? `(${s.course_name})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label>Chapter / Topic (optional)</label>
                    <select
                        className="admin-form-input"
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        disabled={!formData.subject}
                    >
                        <option value="">General Notes (All Topics)</option>
                        {filteredTopicsForForm.map((t: any) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                    <input
                        type="checkbox"
                        id="is_premium"
                        checked={formData.is_premium}
                        onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="is_premium" style={{ fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }}>
                        Premium Notes (Only Subscribed Students Can Read)
                    </label>
                </div>
                <div className="admin-form-group">
                    <label>Notes PDF File *</label>
                    <FileUploadZone
                        onFileUploaded={(url) => setFormData({ ...formData, file_url: url })}
                        accept="application/pdf"
                        label="Upload Notes PDF"
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

export default AdminNotesManager;
