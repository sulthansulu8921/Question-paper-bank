import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, BookOpen, Layers, Save, Search, Loader2 } from 'lucide-react';
import FileUploadZone from '@/components/admin/FileUploadZone';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = {
    name: '',
    short_description: '',
    description: '',
    is_premium: true,
    is_active: true,
    is_archived: false,
    duration: '6 Months',
    validity_days: 180,
    monthly_price: '0.00',
    yearly_price: '0.00',
    thumbnail: '',
    banner: ''
};

export default function AdminCourseManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState(emptyForm);

    // Level Management states
    const [selectedCourseForLevels, setSelectedCourseForLevels] = useState<any | null>(null);
    const [levelForm, setLevelForm] = useState({ name: '', order: 0, description: '' });
    const [editingLevelId, setEditingLevelId] = useState<number | null>(null);

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // Fetch all courses
    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['admin-courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    // Fetch all levels (to filter by selected course)
    const { data: levels = [], isLoading: isLevelsLoading } = useQuery({
        queryKey: ['admin-levels'],
        queryFn: async () => (await api.get('/courses/levels/')).data,
        enabled: !!selectedCourseForLevels,
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

    // Level CRUD mutations
    const createLevelMutation = useMutation({
        mutationFn: (newLevel: any) => api.post('/courses/levels/', newLevel),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-levels'] });
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            setLevelForm({ name: '', order: 0, description: '' });
            show('Level added successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to create level.'), 'error'),
    });

    const editLevelMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/courses/levels/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-levels'] });
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            setLevelForm({ name: '', order: 0, description: '' });
            setEditingLevelId(null);
            show('Level updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update level.'), 'error'),
    });

    const deleteLevelMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/levels/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-levels'] });
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            show('Level deleted successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete level.'), 'error'),
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
            short_description: course.short_description || '',
            description: course.description || '',
            is_premium: course.is_premium ?? true,
            is_active: course.is_active ?? true,
            is_archived: course.is_archived ?? false,
            duration: course.duration || '6 Months',
            validity_days: course.validity_days ?? 180,
            monthly_price: course.monthly_price || '0.00',
            yearly_price: course.yearly_price || '0.00',
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

    const handleLevelSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!levelForm.name.trim()) return;

        const payload = {
            ...levelForm,
            course: selectedCourseForLevels.id
        };

        if (editingLevelId) {
            editLevelMutation.mutate({ id: editingLevelId, data: payload });
        } else {
            createLevelMutation.mutate(payload);
        }
    };

    const filteredCourses = courses.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredLevels = levels.filter((l: any) => l.course === selectedCourseForLevels?.id);

    const isSaving = createMutation.isPending || editMutation.isPending;

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Course Selection Control</h1>
                    <p className="page-subtitle">Configure CA courses, validity periods, access limits, and student study tracks.</p>
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
                                <th>Duration / Validity</th>
                                <th>Price (INR)</th>
                                <th>Levels count</th>
                                <th>Status</th>
                                <th>Access</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredCourses.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No courses found.
                                    </td>
                                </tr>
                            )}
                            {filteredCourses.map((course: any) => (
                                <tr key={course.id} className={course.is_archived ? 'opacity-60 bg-slate-50' : ''}>
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
                                    <td>
                                        <div className="font-bold text-main">{course.name}</div>
                                        {course.is_archived && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1 rounded">Archived</span>}
                                    </td>
                                    <td>
                                        <div className="text-xs font-semibold text-slate-700">{course.duration || '—'}</div>
                                        <div className="text-[10px] text-slate-400 font-bold">{course.validity_days} Days validity</div>
                                    </td>
                                    <td>
                                        <div className="text-xs font-bold text-slate-800">M: ₹{course.monthly_price}</div>
                                        <div className="text-[10px] text-slate-500">Y: ₹{course.yearly_price}</div>
                                    </td>
                                    <td>
                                        <button 
                                            onClick={() => setSelectedCourseForLevels(course)}
                                            className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center gap-1"
                                        >
                                            <Layers size={13} />
                                            <span>{(course.levels || []).length} Levels</span>
                                        </button>
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
                                            <button type="button" className="action-btn" title="Edit Course" onClick={() => openEdit(course)}>
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-btn danger"
                                                title="Delete Course"
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Course',
                                                    message: `Are you sure you want to delete the course "${course.name}"? This action cannot be undone.`,
                                                    onConfirm: () => {
                                                        deleteMutation.mutate(course.id);
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

            {/* Course Form Modal */}
            <AdminModal
                open={modalMode !== null}
                onClose={closeModal}
                title={modalMode === 'edit' ? 'Edit Course' : 'Add New Course'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeModal}>
                            Cancel
                        </button>
                        <button type="button" className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>{modalMode === 'edit' ? 'Save Changes' : 'Save Course'}</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Course Name *</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. CA Intermediate Masterclass"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Short Description</label>
                            <input
                                className="admin-form-input"
                                placeholder="Brief overview text"
                                value={formData.short_description}
                                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Duration (e.g. 6 Months)</label>
                            <input
                                className="admin-form-input"
                                placeholder="6 Months"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Full Description</label>
                        <textarea
                            className="admin-form-input min-h-[80px]"
                            placeholder="Provide deep details of the educational material covered..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Validity days</label>
                            <input
                                type="number"
                                className="admin-form-input"
                                value={formData.validity_days}
                                onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 180 })}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Monthly Price (₹)</label>
                            <input
                                className="admin-form-input"
                                value={formData.monthly_price}
                                onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Yearly Price (₹)</label>
                            <input
                                className="admin-form-input"
                                value={formData.yearly_price}
                                onChange={(e) => setFormData({ ...formData, yearly_price: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center p-2 rounded bg-white shadow-sm border border-slate-200">
                            <input
                                type="checkbox"
                                checked={formData.is_premium}
                                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                            />
                            <span className="font-bold text-xs text-slate-700">Premium Course</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center p-2 rounded bg-white shadow-sm border border-slate-200">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <span className="font-bold text-xs text-slate-700">Live (Active)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer flex-1 justify-center p-2 rounded bg-white shadow-sm border border-slate-200">
                            <input
                                type="checkbox"
                                checked={formData.is_archived}
                                onChange={(e) => setFormData({ ...formData, is_archived: e.target.checked })}
                            />
                            <span className="font-bold text-xs text-slate-700">Archived</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Thumbnail Image</label>
                            <FileUploadZone
                                onFileUploaded={(url) => setFormData({ ...formData, thumbnail: url })}
                                accept="image/*"
                                label="Upload Thumbnail"
                                existingUrl={formData.thumbnail}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Banner Image</label>
                            <FileUploadZone
                                onFileUploaded={(url) => setFormData({ ...formData, banner: url })}
                                accept="image/*"
                                label="Upload Banner"
                                existingUrl={formData.banner}
                            />
                        </div>
                    </div>
                </div>
            </AdminModal>

            {/* Level Management Modal */}
            {selectedCourseForLevels && (
                <AdminModal
                    open={!!selectedCourseForLevels}
                    onClose={() => { setSelectedCourseForLevels(null); setEditingLevelId(null); setLevelForm({ name: '', order: 0, description: '' }); }}
                    title={`Manage Levels: ${selectedCourseForLevels.name}`}
                    size="lg"
                    footer={
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setSelectedCourseForLevels(null)}>
                            Close
                        </button>
                    }
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Level Form */}
                        <form onSubmit={handleLevelSave} className="lg:col-span-5 bg-slate-50/50 p-5 rounded-xl border border-slate-200/50 space-y-4 h-fit">
                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                                {editingLevelId ? 'Edit Level' : 'Add New Level'}
                            </h3>

                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Level Name *</label>
                                <input
                                    className="admin-form-input"
                                    placeholder="e.g. Foundation, Intermediate, Final"
                                    required
                                    value={levelForm.name}
                                    onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Sort Order</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    required
                                    value={levelForm.order}
                                    onChange={(e) => setLevelForm({ ...levelForm, order: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Description</label>
                                <textarea
                                    className="admin-form-input min-h-[60px]"
                                    placeholder="Optional description"
                                    value={levelForm.description}
                                    onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                {editingLevelId && (
                                    <button 
                                        type="button" 
                                        className="secondary-btn text-[11px] font-bold py-1.5 px-3" 
                                        onClick={() => { setEditingLevelId(null); setLevelForm({ name: '', order: 0, description: '' }); }}
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button 
                                    type="submit" 
                                    className="primary-btn text-[11px] font-black uppercase tracking-wide py-1.5 px-4"
                                    disabled={createLevelMutation.isPending || editLevelMutation.isPending}
                                >
                                    {(createLevelMutation.isPending || editLevelMutation.isPending) ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Save size={12} className="inline mr-1" />
                                    )}
                                    <span>{editingLevelId ? 'Save Changes' : 'Add Level'}</span>
                                </button>
                            </div>
                        </form>

                        {/* Levels List */}
                        <div className="lg:col-span-7 space-y-4">
                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Configured Levels</h3>
                            {isLevelsLoading ? (
                                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                            ) : filteredLevels.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed">
                                    No levels added yet. Create one on the left (e.g. Intermediate).
                                </div>
                            ) : (
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">Order</th>
                                                <th className="p-3">Level Name</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLevels.sort((a: any, b: any) => a.order - b.order).map((l: any) => (
                                                <tr key={l.id} className="hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono font-bold text-indigo-600">{l.order}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800">{l.name}</div>
                                                        {l.description && <div className="text-[10px] text-slate-400 mt-0.5">{l.description}</div>}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingLevelId(l.id);
                                                                    setLevelForm({ name: l.name, order: l.order, description: l.description || '' });
                                                                }}
                                                                className="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                                                                title="Edit"
                                                            >
                                                                <Edit size={12} />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    if (confirm(`Delete level "${l.name}"? All subjects inside this level will be orphaned.`)) {
                                                                        deleteLevelMutation.mutate(l.id);
                                                                    }
                                                                }}
                                                                className="p-1 border border-red-200 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </AdminModal>
            )}

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
