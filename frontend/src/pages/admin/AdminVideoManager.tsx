import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Search, Loader2, Save, ExternalLink } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    title: '',
    description: '',
    course: '',
    level: '',
    subject: '',
    topic: '',
    file_url: '',
    duration_minutes: 0,
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

    // Helper: Find current selected course
    const selectedCourse = courses.find((c: any) => String(c.id) === String(formData.course));
    const levelsForForm = selectedCourse?.levels || [];

    // Filter subjects based on selected course AND selected level
    const filteredSubjectsForForm = subjects.filter((s: any) => {
        const matchesCourse = !formData.course || String(s.course) === String(formData.course);
        const matchesLevel = !formData.level || String(s.level) === String(formData.level);
        return matchesCourse && matchesLevel;
    });

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
            file_url: formData.file_url.trim(),
            duration_seconds: Math.round(Number(formData.duration_minutes || 0) * 60),
            is_premium: formData.is_premium,
        };
    };

    const createMutation = useMutation({
        mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/materials/videos/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            closeModal();
            show('Recorded video lecture added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add video lecture.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
            api.patch(`/materials/videos/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            closeModal();
            show('Video lecture updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update video lecture.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/videos/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
            show('Video lecture deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete video lecture.'), 'error'),
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
        const levelId = selectedSubj?.level?.toString() || '';

        setFormData({
            title: item.title || '',
            description: item.description || '',
            course: courseId,
            level: levelId,
            subject: subjectId,
            topic: item.topic?.toString() || '',
            file_url: item.file_url || '',
            duration_minutes: item.duration_seconds ? Math.round(item.duration_seconds / 60) : 0,
            is_premium: item.is_premium ?? true,
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim() || !formData.subject || !formData.file_url.trim()) {
            show('Title, Subject, and Video Link are required.', 'error');
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
        v.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.topic_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Recorded Video Lectures</h1>
                    <p className="page-subtitle">Publish and manage recorded video lectures for subjects and levels.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} /> <span>Publish Video</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search videos by title, subject or chapter..."
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
                                <th>Duration</th>
                                <th>Access</th>
                                <th>Link</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                                        No video lectures found. Publish your first recorded lecture.
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
                                    <td className="text-muted">
                                        {item.duration_seconds ? `${Math.round(item.duration_seconds / 60)} mins` : '—'}
                                    </td>
                                    <td>
                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider ${
                                            item.is_premium ? 'premium-badge' : 'free-badge'
                                        }`}>
                                            {item.is_premium ? 'Premium' : 'Free'}
                                        </span>
                                    </td>
                                    <td>
                                        {item.file_url ? (
                                            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--color-primary-light)] hover:underline text-xs">
                                                <ExternalLink size={14} /> Open Link
                                            </a>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="action-btn" type="button" onClick={() => openEdit(item)}><Edit size={16} /></button>
                                            <button
                                                className="action-btn danger"
                                                type="button"
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Video Lecture',
                                                    message: `Are you sure you want to delete "${item.title}"? This action is permanent.`,
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
                title={modalMode === 'edit' ? 'Edit Recorded Video' : 'Publish Recorded Video'}
                footer={
                    <>
                        <button type="button" className="secondary-btn" onClick={closeModal}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>{modalMode === 'edit' ? 'Save Changes' : 'Publish Video'}</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Video Title *</label>
                    <input
                        className="admin-form-input"
                        placeholder="e.g. Accounting Standards Lecture 1"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>
                <div className="admin-form-group">
                    <label>Description</label>
                    <textarea
                        className="admin-form-input"
                        rows={3}
                        placeholder="Provide details about the video contents..."
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="admin-form-group">
                        <label>Course *</label>
                        <select
                            className="admin-form-input"
                            value={formData.course}
                            onChange={e => setFormData({ ...formData, course: e.target.value, level: '', subject: '', topic: '' })}
                        >
                            <option value="">Select Course...</option>
                            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label>Level / Group *</label>
                        <select
                            className="admin-form-input"
                            value={formData.level}
                            onChange={e => setFormData({ ...formData, level: e.target.value, subject: '', topic: '' })}
                            disabled={!formData.course}
                        >
                            <option value="">Select Level...</option>
                            {levelsForForm.map((lvl: any) => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="admin-form-group">
                        <label>Subject *</label>
                        <select
                            className="admin-form-input"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value, topic: '' })}
                            disabled={!formData.level}
                        >
                            <option value="">Select Subject...</option>
                            {filteredSubjectsForForm.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label>Chapter / Topic</label>
                        <select
                            className="admin-form-input"
                            value={formData.topic}
                            onChange={e => setFormData({ ...formData, topic: e.target.value })}
                            disabled={!formData.subject}
                        >
                            <option value="">General / No Chapter</option>
                            {filteredTopicsForForm.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                    <div className="admin-form-group">
                        <label>Video URL / Embed Link *</label>
                        <input
                            className="admin-form-input"
                            placeholder="YouTube, Vimeo, iframe link or direct URL"
                            value={formData.file_url}
                            onChange={e => setFormData({ ...formData, file_url: e.target.value })}
                        />
                    </div>
                    <div className="admin-form-group">
                        <label>Duration (Minutes)</label>
                        <input
                            type="number"
                            className="admin-form-input"
                            placeholder="e.g. 45"
                            value={formData.duration_minutes || ''}
                            onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="admin-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
                        <input
                            type="checkbox"
                            checked={formData.is_premium}
                            onChange={e => setFormData({ ...formData, is_premium: e.target.checked })}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Premium Video Lecture</span>
                    </label>
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
