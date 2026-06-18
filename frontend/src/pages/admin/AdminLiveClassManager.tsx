import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Save, Search, Loader2, Video, Calendar, Clock, ExternalLink } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import { triggerCollectionSync } from '@/utils/firebaseSync';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    title: '',
    description: '',
    course: '',
    level: '',
    subject: '',
    scheduled_time: '',
    duration_minutes: 60,
    meeting_link: '',
    is_active: true
};

export default function AdminLiveClassManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(emptyForm);

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // Fetch live classes
    const { data: liveClasses = [], isLoading } = useQuery({
        queryKey: ['admin-live-classes'],
        queryFn: async () => (await api.get('/materials/live-classes/')).data
    });

    // Fetch courses list
    const { data: courses = [] } = useQuery({
        queryKey: ['admin-courses-small'],
        queryFn: async () => (await api.get('/courses/courses/')).data
    });

    // Fetch levels list
    const { data: levels = [] } = useQuery({
        queryKey: ['admin-levels-small'],
        queryFn: async () => (await api.get('/courses/levels/')).data
    });

    // Fetch subjects list
    const { data: subjects = [] } = useQuery({
        queryKey: ['admin-subjects-small'],
        queryFn: async () => (await api.get('/courses/subjects/')).data
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/materials/live-classes/', data),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-live-classes'] });
            await triggerCollectionSync('live-classes');
            closeModal();
            show('Live class scheduled successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to schedule live class.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/materials/live-classes/${id}/`, data),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-live-classes'] });
            await triggerCollectionSync('live-classes');
            closeModal();
            show('Live class updated.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update live class.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/live-classes/${id}/`),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-live-classes'] });
            await triggerCollectionSync('live-classes');
            show('Live class canceled.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to cancel live class.'), 'error'),
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
            description: item.description || '',
            course: item.course?.toString() || '',
            level: item.level?.toString() || '',
            subject: item.subject?.toString() || '',
            scheduled_time: item.scheduled_time ? new Date(item.scheduled_time).toISOString().slice(0, 16) : '',
            duration_minutes: item.duration_minutes || 60,
            meeting_link: item.meeting_link || '',
            is_active: item.is_active ?? true
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim()) {
            show('Title is required.', 'error');
            return;
        }
        if (!formData.meeting_link.trim()) {
            show('Meeting Link URL is required.', 'error');
            return;
        }
        if (!formData.scheduled_time) {
            show('Scheduled Date/Time is required.', 'error');
            return;
        }

        const linkLower = formData.meeting_link.toLowerCase();
        let meetingPlatform = 'MEET';
        if (linkLower.includes('zoom.us')) {
            meetingPlatform = 'ZOOM';
        } else if (linkLower.includes('meet.google') || linkLower.includes('google.com')) {
            meetingPlatform = 'MEET';
        } else if (linkLower.includes('jitsi')) {
            meetingPlatform = 'JITSI';
        }

        const payload = {
            ...formData,
            course: formData.course ? Number(formData.course) : null,
            level: formData.level ? Number(formData.level) : null,
            subject: formData.subject ? Number(formData.subject) : null,
            meeting_platform: meetingPlatform
        };

        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const filteredClasses = liveClasses.filter((lc: any) =>
        lc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lc.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const activeCourseLevels = levels.filter((l: any) => l.course === Number(formData.course));
    const activeLevelSubjects = formData.level
        ? subjects.filter((s: any) => s.level === Number(formData.level))
        : subjects.filter((s: any) => s.course === Number(formData.course));

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Live Interactive Classes</h1>
                    <p className="page-subtitle">Schedule interactive webinars, doubt-clearing sessions, and virtual class links.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} />
                    <span>Schedule Class</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search live classes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{filteredClasses.length} live classes</span>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Session</th>
                                <th>Schedule Date & Time</th>
                                <th>Duration</th>
                                <th>Course mapping</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredClasses.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No live classes scheduled yet.
                                    </td>
                                </tr>
                            )}
                            {filteredClasses.map((item: any) => {
                                const isUpcoming = new Date(item.scheduled_time) > new Date();
                                return (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                                    <Video size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-main">{item.title}</p>
                                                    <a href={item.meeting_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5 mt-0.5">
                                                        <span>Join URL</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="font-semibold text-slate-700">
                                            <div className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /> {formatDateTime(item.scheduled_time)}</div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold"><Clock size={13} /> {item.duration_minutes} Mins</div>
                                        </td>
                                        <td className="text-xs text-slate-500 font-semibold">
                                            <div>
                                                {item.course_name || courses.find((c: any) => c.id === item.course)?.name || 'All Courses'}
                                                {item.level_name && (
                                                    <span className="text-[10px] text-slate-400 block mt-0.5 font-bold">
                                                        ↳ {item.level_name}
                                                    </span>
                                                )}
                                                {item.subject_name && (
                                                    <span className="text-[10px] text-primary block mt-0.5 font-bold">
                                                        ↳ {item.subject_name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {item.is_active && isUpcoming ? (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Scheduled
                                                </span>
                                            ) : item.is_active ? (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                                    Past Class
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-50 text-slate-400 border border-slate-200">
                                                    Canceled
                                                </span>
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
                                                        title: 'Delete Live Class',
                                                        message: `Are you sure you want to delete/cancel the live session "${item.title}"?`,
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
                title={modalMode === 'edit' ? 'Edit Live Class Details' : 'Schedule New Live Class'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeModal}>
                            Cancel
                        </button>
                        <button type="button" className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider" onClick={handleSave} disabled={createMutation.isPending || editMutation.isPending}>
                            {(createMutation.isPending || editMutation.isPending) ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Schedule Class</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Class Title *</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. CA Intermediate Auditing Live Doubt Solver"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Description / Instructions</label>
                        <textarea
                            className="admin-form-input min-h-[60px]"
                            placeholder="Provide meeting agenda or notes for students..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Scheduled Date & Time *</label>
                            <input
                                type="datetime-local"
                                className="admin-form-input font-semibold"
                                value={formData.scheduled_time}
                                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Duration (Minutes)</label>
                            <input
                                type="number"
                                className="admin-form-input"
                                value={formData.duration_minutes}
                                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                            />
                        </div>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Zoom / Meet Link URL *</label>
                        <input
                            className="admin-form-input font-semibold text-blue-600"
                            placeholder="https://zoom.us/j/1234567890"
                            value={formData.meeting_link}
                            onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Target Course</label>
                            <select className="admin-form-input" value={formData.course} onChange={e => setFormData({ ...formData, course: e.target.value, level: '', subject: '' })}>
                                <option value="">All Courses (Public)</option>
                                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Target Level</label>
                            <select className="admin-form-input" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value, subject: '' })} disabled={!formData.course}>
                                <option value="">All Levels under Course</option>
                                {activeCourseLevels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Target Subject / Paper</label>
                            <select className="admin-form-input" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} disabled={!formData.course}>
                                <option value="">All Subjects under {formData.level ? 'Level' : 'Course'}</option>
                                {activeLevelSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center p-2 rounded bg-white shadow-sm border border-slate-200">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <span className="font-bold text-xs text-slate-700">Status Scheduled / Active</span>
                        </label>
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
}
