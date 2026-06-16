import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Save, Search, Loader2, Bell, Users, BookOpen } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import { triggerCollectionSync } from '@/utils/firebaseSync';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    title: '',
    message: '',
    target_audience: 'ALL',
    target_course: ''
};

export default function AdminNotificationManager() {
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

    // Fetch notifications
    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['admin-notifications'],
        queryFn: async () => (await api.get('/materials/notifications/')).data
    });

    // Fetch courses list
    const { data: courses = [] } = useQuery({
        queryKey: ['admin-courses-small'],
        queryFn: async () => (await api.get('/courses/courses/')).data
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/materials/notifications/', data),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
            await triggerCollectionSync('notifications');
            closeModal();
            show('Alert broadcasted successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to broadcast alert.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/materials/notifications/${id}/`, data),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
            await triggerCollectionSync('notifications');
            closeModal();
            show('Alert updated.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update alert.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/materials/notifications/${id}/`),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
            await triggerCollectionSync('notifications');
            show('Alert deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete alert.'), 'error'),
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
            message: item.message || '',
            target_audience: item.target_audience || 'ALL',
            target_course: item.target_course?.toString() || ''
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.title.trim()) {
            show('Title is required.', 'error');
            return;
        }
        if (!formData.message.trim()) {
            show('Message text is required.', 'error');
            return;
        }
        if (formData.target_audience === 'COURSE' && !formData.target_course) {
            show('Target Course is required for course-wise alerts.', 'error');
            return;
        }

        const payload = {
            ...formData,
            target_course: formData.target_course ? Number(formData.target_course) : null
        };

        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const filteredAlerts = notifications.filter((item: any) =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Broadcast Alerts & Notifications</h1>
                    <p className="page-subtitle">Send announcements, schedule changes, and promotional highlights to students.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} />
                    <span>Send Announcement</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search announcements..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{filteredAlerts.length} sent notifications</span>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Notification Title & Body</th>
                                <th>Sent Date</th>
                                <th>Target Audience</th>
                                <th>Course scope</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredAlerts.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No announcements sent yet. Write your first broadcast above!
                                    </td>
                                </tr>
                            )}
                            {filteredAlerts.map((item: any) => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="flex gap-3">
                                            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                                                <Bell size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-main">{item.title}</p>
                                                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5" style={{ maxWidth: '400px' }}>{item.message}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="font-semibold text-slate-700 text-xs">
                                        {formatDate(item.created_at)}
                                    </td>
                                    <td>
                                        {item.target_audience === 'ALL' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                                <Users size={8} /> All Students
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                                <BookOpen size={8} /> Course-wise
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-xs font-semibold text-slate-600">
                                        {item.course_name || courses.find((c: any) => c.id === item.target_course)?.name || 'Global'}
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
                                                    title: 'Delete Announcement',
                                                    message: `Are you sure you want to delete this announcement? Students will no longer see it in their alerts.`,
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
                title={modalMode === 'edit' ? 'Edit Announcement' : 'Compose Announcement'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeModal}>
                            Cancel
                        </button>
                        <button type="button" className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider" onClick={handleSave} disabled={createMutation.isPending || editMutation.isPending}>
                            {(createMutation.isPending || editMutation.isPending) ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Send Alert</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Notification Title *</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. Schedule Update: CA Intermediate Law tomorrow rescheduled"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Announcement Body Text *</label>
                        <textarea
                            className="admin-form-input min-h-[100px]"
                            placeholder="Type the full message here for students..."
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Target Audience Scope</label>
                            <select 
                                className="admin-form-input" 
                                value={formData.target_audience} 
                                onChange={e => setFormData({ ...formData, target_audience: e.target.value, target_course: e.target.value === 'ALL' ? '' : formData.target_course })}
                            >
                                <option value="ALL">All Registered Students</option>
                                <option value="COURSE">Filter by Specific Course</option>
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Filter by Course</label>
                            <select 
                                className="admin-form-input" 
                                value={formData.target_course} 
                                onChange={e => setFormData({ ...formData, target_course: e.target.value })}
                                disabled={formData.target_audience !== 'COURSE'}
                            >
                                <option value="">Select Target Course...</option>
                                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
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
