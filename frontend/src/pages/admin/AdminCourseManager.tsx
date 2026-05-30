import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, BookOpen, Layers, Save, Search, Loader2 } from 'lucide-react';
import FileUploadZone from '@/components/admin/FileUploadZone';
import AdminModal from '@/components/admin/AdminModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = { name: '', is_premium: true, is_active: true, thumbnail: '', banner: '' };

export default function AdminCourseManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState(emptyForm);

    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['admin-courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    const createMutation = useMutation({
        mutationFn: (newCourse: typeof emptyForm) => api.post('/courses/courses/', newCourse),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            closeModal();
            show('Course created successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to create course.'), 'error'),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => api.patch(`/courses/courses/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            closeModal();
            show('Course updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update course.'), 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/courses/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            show('Course deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete course.'), 'error'),
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

    const openEdit = (course: any) => {
        setEditId(course.id);
        setFormData({
            name: course.name || '',
            is_premium: course.is_premium ?? true,
            is_active: course.is_active ?? true,
            thumbnail: course.thumbnail || '',
            banner: course.banner || '',
        });
        setModalMode('edit');
    };

    const handleSave = () => {
        if (!formData.name.trim()) {
            show('Course name is required.', 'error');
            return;
        }
        if (modalMode === 'edit' && editId) {
            editMutation.mutate({ id: editId, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const filteredCourses = courses.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Course Manager</h1>
                    <p className="page-subtitle">Manage all educational tracks and masterclasses.</p>
                </div>
                <button type="button" onClick={openAdd} className="primary-btn flex-center gap-sm">
                    <Plus size={20} />
                    <span>Create Course</span>
                </button>
            </div>

            <div className="qm-table-card">
                <div className="table-toolbar">
                    <div className="toolbar-left">
                        <div className="search-box">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Thumbnail</th>
                                <th>Course Name</th>
                                <th>Subjects</th>
                                <th>Status</th>
                                <th>Access</th>
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
                            {!isLoading && filteredCourses.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No courses found.
                                    </td>
                                </tr>
                            )}
                            {filteredCourses.map((course: any) => (
                                <tr key={course.id}>
                                    <td>
                                        {course.thumbnail ? (
                                            <img src={course.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                                        ) : (
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 8,
                                                    background: '#f1f5f9',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#94a3b8',
                                                }}
                                            >
                                                <BookOpen size={16} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="font-bold text-main">{course.name}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                            <Layers size={14} /> {course.subjects_count ?? 0} Subjects
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-dot ${course.is_active ? 'status-active' : 'status-inactive'}`}></span>
                                        {course.is_active ? 'Live' : 'Draft'}
                                    </td>
                                    <td>
                                        {course.is_premium ? (
                                            <span className="attempt-tag" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
                                                Premium
                                            </span>
                                        ) : (
                                            <span className="attempt-tag">Free</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button type="button" className="action-btn" title="Edit" onClick={() => openEdit(course)}>
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-btn danger"
                                                onClick={() => {
                                                    if (window.confirm(`Delete course "${course.name}"?`)) deleteMutation.mutate(course.id);
                                                }}
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
                title={modalMode === 'edit' ? 'Edit Course' : 'Add New Course'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn" onClick={closeModal}>
                            Cancel
                        </button>
                        <button type="button" className="primary-btn flex-center gap-sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>{modalMode === 'edit' ? 'Save Changes' : 'Save Course'}</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group">
                    <label>Course Name *</label>
                    <input
                        className="admin-form-input"
                        placeholder="e.g. CA Intermediate Masterclass"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
                        <input
                            type="checkbox"
                            checked={formData.is_premium}
                            onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Premium</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Live</span>
                    </label>
                </div>
                <div className="admin-form-group">
                    <label>Thumbnail</label>
                    <FileUploadZone
                        onFileUploaded={(url) => setFormData({ ...formData, thumbnail: url })}
                        accept="image/*"
                        label="Upload Thumbnail"
                        existingUrl={formData.thumbnail}
                    />
                </div>
            </AdminModal>
        </div>
    );
}
