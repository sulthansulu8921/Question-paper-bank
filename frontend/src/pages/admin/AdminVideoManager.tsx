import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, ExternalLink, PlaySquare } from 'lucide-react';
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
    duration_minutes: 30,
    is_premium: true
};

const AdminVideoManager = () => {
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

    const { data: videos = [], isLoading } = useQuery({
        queryKey: ['admin-videos'],
        queryFn: async () => (await api.get('/materials/videos/')).data,
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
            duration_seconds: Math.round(Number(formData.duration_minutes || 0) * 60),
            is_premium: formData.is_premium,
        };
    };

    const createMutation = useMutation({
        mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/materials/videos/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            closeModal();
            show('Recorded Class added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add recorded class.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
            api.patch(`/materials/videos/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            closeModal();
            show('Recorded Class updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update recorded class.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/videos/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            show('Recorded Class deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete recorded class.'), 'error'),
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
            duration_minutes: Math.round((item.duration_seconds || 0) / 60),
            is_premium: item.is_premium ?? true,
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim() || !formData.subject || !formData.file_url) {
            show('Title, Subject, and Video URL/file are required.', 'error');
            return;
        }
        const payload = buildPayload();
        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const filtered = videos.filter((v: any) =>
        v.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.subject_name || subjects.find((s: any) => s.id === v.subject)?.name || '')
            .toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Recorded Classes Management</h1>
                    <p className="page-subtitle">Upload recorded lectures and map them under subjects and courses.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} /> <span>Add Recorded Class</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search lectures by title or subject..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Lecture Title & Description</th>
                                <th>Subject</th>
                                <th>Duration</th>
                                <th>Access</th>
                                <th>Video Link</th>
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
                                        No recorded lectures found. Add your first recorded class.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((item: any) => {
                                const subjName = item.subject_name || subjects.find((s: any) => s.id === item.subject)?.name || '—';
                                return (
                                    <tr key={item.id}>
                                        <td className="font-bold text-main">
                                            <div className="flex items-center gap-2">
                                                <PlaySquare size={16} className="text-primary-light" />
                                                <span>{item.title}</span>
                                            </div>
                                            {item.description && <div className="text-muted font-normal text-xs mt-0.5">{item.description}</div>}
                                        </td>
                                        <td className="text-muted">{subjName}</td>
                                        <td className="text-muted">{Math.round((item.duration_seconds || 0) / 60)} mins</td>
                                        <td>
                                            <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider ${
                                                item.is_premium ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                                            }`}>
                                                {item.is_premium ? 'Premium' : 'Free'}
                                            </span>
                                        </td>
                                        <td>
                                            {item.file_url ? (
                                                <a href={item.file_url} target="_blank" rel="noreferrer" className="action-btn text-primary-light hover:underline flex items-center gap-1 text-xs" style={{ width: 'fit-content' }}>
                                                    <span>Open</span>
                                                    <ExternalLink size={12} />
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
                                                        title: 'Delete Recorded Class',
                                                        message: `Are you sure you want to delete the recorded lecture "${item.title}"? This action cannot be undone.`,
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <AdminModal
                open={modalMode !== null}
                onClose={closeModal}
                title={modalMode === 'edit' ? 'Edit Recorded Class' : 'Add Recorded Class'}
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeModal}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-bold"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Save Class</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Class Title *</label>
                        <input
                            className="admin-form-input"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. CA Inter Accounting - Cash Flow Statement Lecture 1"
                        />
                    </div>
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Brief Description</label>
                        <textarea
                            className="admin-form-input"
                            style={{ minHeight: '60px', resize: 'vertical' }}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Agenda, chapters covered, or notes for the session..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Course (optional)</label>
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
                            <label className="text-xs font-bold text-slate-700">Subject *</label>
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Chapter / Topic (optional)</label>
                            <select
                                className="admin-form-input"
                                value={formData.topic}
                                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                                disabled={!formData.subject}
                            >
                                <option value="">General (All Topics)</option>
                                {filteredTopicsForForm.map((t: any) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Duration (Minutes)</label>
                            <input
                                type="number"
                                className="admin-form-input"
                                value={formData.duration_minutes}
                                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value, 10) || 0 })}
                                placeholder="30"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center p-2 rounded bg-white shadow-sm border border-slate-200">
                            <input
                                type="checkbox"
                                checked={formData.is_premium}
                                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                                className="cursor-pointer"
                            />
                            <span className="font-bold text-xs text-slate-700">Premium recorded class (Only subscribers can access)</span>
                        </label>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Video Link / URL (e.g. YouTube, Vimeo or S3)</label>
                        <input
                            className="admin-form-input"
                            value={formData.file_url}
                            onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                            placeholder="Enter video URL or upload file below..."
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Or Upload Video Class File</label>
                        <FileUploadZone
                            onFileUploaded={(url) => setFormData({ ...formData, file_url: url })}
                            accept="video/*"
                            label="Upload Lecture Video File"
                            existingUrl={formData.file_url}
                            maxSizeMB={100}
                        />
                    </div>
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

export default AdminVideoManager;
