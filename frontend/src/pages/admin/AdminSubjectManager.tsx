import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Save, Search, Loader2, BookOpen } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const AdminSubjectManager = () => {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({ name: '', code: '', course: '' });
    const [editForm, setEditForm] = useState({ name: '', code: '', course: '' });
    const { show, Toast } = useAdminToast();

    const { data: subjects = [], isLoading } = useQuery({
        queryKey: ['admin-subjects-full'],
        queryFn: async () => (await api.get('/courses/subjects/')).data
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['admin-courses-small'],
        queryFn: async () => (await api.get('/courses/courses/')).data
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/courses/subjects/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subjects-full'] });
            setIsAdding(false);
            setFormData({ name: '', code: '', course: '' });
            show('Subject added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to add subject.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/courses/subjects/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subjects-full'] });
            setEditItem(null);
            show('Subject updated.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update subject.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/subjects/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subjects-full'] });
            show('Subject deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete subject.'), 'error'),
    });

    const openEdit = (item: any) => {
        setEditItem(item);
        setEditForm({ name: item.name, code: item.code || '', course: item.course?.toString() || '' });
    };

    const filteredItems = subjects.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Subject Management</h1>
                    <p className="page-subtitle">Configure and manage subjects across all courses.</p>
                </div>
                <button onClick={() => setIsAdding(true)} className="primary-btn flex-center gap-sm">
                    <Plus size={20} /> <span>Add Subject</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input type="text" placeholder="Search subjects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{filteredItems.length} subjects</span>
                </div>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Icon</th>
                                <th>Subject Name</th>
                                <th>Code</th>
                                <th>Course</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} /></td></tr>}
                            {!isLoading && filteredItems.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No subjects found. Add your first subject above.</td></tr>
                            )}
                            {filteredItems.map((item: any) => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-light)' }}>
                                            <BookOpen size={18} />
                                        </div>
                                    </td>
                                    <td className="font-bold text-main">{item.name}</td>
                                    <td>
                                        {item.code ? <span className="attempt-tag">{item.code}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{item.course_name || courses.find((c: any) => c.id === item.course)?.name || '—'}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="action-btn" onClick={() => openEdit(item)}><Edit size={16} /></button>
                                            <button className="action-btn danger" onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id); }}>
                                                {deleteMutation.isPending && deleteMutation.variables === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
                open={isAdding}
                onClose={() => { setIsAdding(false); setFormData({ name: '', code: '', course: '' }); }}
                title="Add New Subject"
                footer={
                    <>
                        <button type="button" className="secondary-btn" onClick={() => setIsAdding(false)}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm"
                            onClick={() => {
                                if (!formData.course) {
                                    show('Please select a parent course.', 'error');
                                    return;
                                }
                                createMutation.mutate(formData);
                            }}
                            disabled={createMutation.isPending || !formData.name}
                        >
                            {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            <span>Save Subject</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Subject Name *</label>
                    <input className="admin-form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Financial Reporting" />
                </div>
                <div className="admin-form-group">
                    <label>Subject Code</label>
                    <input className="admin-form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. FR-101" />
                </div>
                <div className="admin-form-group">
                    <label>Parent Course *</label>
                    <select className="admin-form-input" value={formData.course} onChange={e => setFormData({ ...formData, course: e.target.value })}>
                        <option value="">Select Course...</option>
                        {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </AdminModal>

            <AdminModal
                open={!!editItem}
                onClose={() => setEditItem(null)}
                title="Edit Subject"
                footer={
                    <>
                        <button type="button" className="secondary-btn" onClick={() => setEditItem(null)}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm"
                            onClick={() => editMutation.mutate({ id: editItem.id, data: editForm })}
                            disabled={editMutation.isPending || !editForm.name}
                        >
                            {editMutation.isPending ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            <span>Save Changes</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Subject Name *</label>
                    <input className="admin-form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="admin-form-group">
                    <label>Subject Code</label>
                    <input className="admin-form-input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                </div>
                <div className="admin-form-group">
                    <label>Parent Course</label>
                    <select className="admin-form-input" value={editForm.course} onChange={e => setEditForm({ ...editForm, course: e.target.value })}>
                        <option value="">Select Course...</option>
                        {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </AdminModal>
        </div>
    );
};

export default AdminSubjectManager;
