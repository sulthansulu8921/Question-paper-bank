import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Save, Search, Loader2, ArrowRight } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyForm = { name: '', code: '', category: '', course: '', level: '', order: 0 };

const AdminSubjectManager = () => {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(emptyForm);
    const [editForm, setEditForm] = useState(emptyForm);
    const { show, Toast } = useAdminToast();

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // Fetch subjects list
    const { data: subjects = [], isLoading } = useQuery({
        queryKey: ['admin-subjects-full'],
        queryFn: async () => (await api.get('/courses/subjects/')).data
    });

    // Fetch categories list (Qualifications / Main Streams)
    const { data: categories = [] } = useQuery({
        queryKey: ['admin-categories-small'],
        queryFn: async () => {
            const res = await api.get('/courses/categories/');
            return res.data.results || res.data || [];
        }
    });

    // Fetch courses list
    const { data: courses = [] } = useQuery({
        queryKey: ['admin-courses-small'],
        queryFn: async () => (await api.get('/courses/courses/')).data
    });

    // Fetch all levels
    const { data: levels = [] } = useQuery({
        queryKey: ['admin-levels-all'],
        queryFn: async () => (await api.get('/courses/levels/')).data
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/courses/subjects/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subjects-full'] });
            setIsAdding(false);
            setFormData(emptyForm);
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
        const courseObj = courses.find((c: any) => c.id === item.course);
        setEditItem(item);
        setEditForm({
            name: item.name,
            code: item.code || '',
            category: courseObj?.category?.toString() || '',
            course: item.course?.toString() || '',
            level: item.level?.toString() || '',
            order: item.order || 0
        });
    };

    const filteredItems = subjects.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter courses belonging to chosen category in forms
    const addFormCourses = courses.filter((c: any) => c.category === Number(formData.category));
    const editFormCourses = courses.filter((c: any) => c.category === Number(editForm.category));

    // Filter levels belonging to chosen course in forms
    const addFormLevels = levels.filter((l: any) => l.course === Number(formData.course));
    const editFormLevels = levels.filter((l: any) => l.course === Number(editForm.course));

    // Reset Course and Level when Category changes in forms
    useEffect(() => {
        setFormData(prev => ({ ...prev, course: '', level: '' }));
    }, [formData.category]);

    useEffect(() => {
        if (editItem) {
            const courseObj = courses.find((c: any) => c.id === editItem.course);
            if (courseObj && Number(editForm.category) !== courseObj.category) {
                setEditForm(prev => ({ ...prev, course: '', level: '' }));
            }
        }
    }, [editForm.category, editItem, courses]);

    // Reset Level when Course changes in forms
    useEffect(() => {
        if (formData.course) {
            const courseLevels = levels.filter((l: any) => l.course === Number(formData.course));
            if (courseLevels.length > 0) {
                setFormData(prev => ({ ...prev, level: courseLevels[0].id.toString() }));
            } else {
                setFormData(prev => ({ ...prev, level: '' }));
            }
        } else {
            setFormData(prev => ({ ...prev, level: '' }));
        }
    }, [formData.course, levels]);

    useEffect(() => {
        if (editForm.course && editItem) {
            const courseLevels = levels.filter((l: any) => l.course === Number(editForm.course));
            // Only overwrite if course actually changed from the original item's course
            if (Number(editForm.course) !== editItem.course) {
                if (courseLevels.length > 0) {
                    setEditForm(prev => ({ ...prev, level: courseLevels[0].id.toString() }));
                } else {
                    setEditForm(prev => ({ ...prev, level: '' }));
                }
            }
        }
    }, [editForm.course, levels, editItem]);

    return (
        <div className="qm-container">
            {Toast}
            <div className="qm-header">
                <div>
                    <h1 className="page-title">Subject & Paper Selection</h1>
                    <p className="page-subtitle">Configure subjects/papers mapped under courses and their study levels (e.g. Intermediate &rarr; Advanced Accounting).</p>
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
                                <th>Order</th>
                                <th>Subject Name</th>
                                <th>Code</th>
                                <th>Course Selection Path</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} /></td></tr>}
                            {!isLoading && filteredItems.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No subjects found. Add your first subject above.</td></tr>
                            )}
                            {filteredItems.sort((a: any, b: any) => a.order - b.order).map((item: any) => (
                                <tr key={item.id}>
                                    <td className="font-mono font-bold text-indigo-600">{item.order}</td>
                                    <td className="font-bold text-main">{item.name}</td>
                                    <td>
                                        {item.code ? <span className="attempt-tag">{item.code}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">{item.qualification_name || courses.find((c: any) => c.id === item.course)?.category_name || 'Qualification'}</span>
                                            <ArrowRight size={12} className="text-slate-400" />
                                            <span>{item.course_name || courses.find((c: any) => c.id === item.course)?.name || 'Course Level'}</span>
                                            <ArrowRight size={12} className="text-slate-400" />
                                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">{item.level_name || levels.find((l: any) => l.id === item.level)?.name || 'Level'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="action-btn" onClick={() => openEdit(item)}><Edit size={16} /></button>
                                            <button className="action-btn danger" onClick={() => setConfirmDelete({
                                                open: true,
                                                title: 'Delete Subject',
                                                message: `Are you sure you want to delete the subject "${item.name}"? This action cannot be undone.`,
                                                onConfirm: () => {
                                                    deleteMutation.mutate(item.id);
                                                    setConfirmDelete(prev => ({ ...prev, open: false }));
                                                }
                                            })}>
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

            {/* Add Subject Modal */}
            <AdminModal
                open={isAdding}
                onClose={() => { setIsAdding(false); setFormData(emptyForm); }}
                title="Add New Subject"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setIsAdding(false)}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider"
                            onClick={() => {
                                if (!formData.category) {
                                    show('Please select a qualification / main stream.', 'error');
                                    return;
                                }
                                if (!formData.course) {
                                    show('Please select a course level.', 'error');
                                    return;
                                }
                                if (!formData.level) {
                                    show('Please select a study level.', 'error');
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
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Qualifications / Main Streams *</label>
                        <select className="admin-form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                            <option value="">Choose Qualification / Main Stream...</option>
                            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Course Level *</label>
                        <select 
                            className="admin-form-input" 
                            value={formData.course} 
                            onChange={e => setFormData({ ...formData, course: e.target.value })}
                            disabled={!formData.category}
                        >
                            <option value="">Choose Course Level...</option>
                            {addFormCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {!formData.category && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Please select a qualification / main stream first to load course levels.</p>}
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Study Level *</label>
                        <select 
                            className="admin-form-input" 
                            value={formData.level} 
                            onChange={e => setFormData({ ...formData, level: e.target.value })}
                            disabled={!formData.course}
                        >
                            <option value="">Choose Study Level...</option>
                            {addFormLevels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        {formData.category && !formData.course && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Please select a course level first to load study levels.</p>}
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Subject Name *</label>
                        <input className="admin-form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Advanced Accounting" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Subject Code / Paper Number</label>
                            <input className="admin-form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. Paper 1" />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Sort Order</label>
                            <input type="number" className="admin-form-input" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                </div>
            </AdminModal>

            {/* Edit Subject Modal */}
            <AdminModal
                open={!!editItem}
                onClose={() => setEditItem(null)}
                title="Edit Subject"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setEditItem(null)}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider"
                            onClick={() => {
                                if (!editForm.category) {
                                    show('Qualification / Main Stream is required.', 'error');
                                    return;
                                }
                                if (!editForm.course) {
                                    show('Course level is required.', 'error');
                                    return;
                                }
                                if (!editForm.level) {
                                    show('Study level is required.', 'error');
                                    return;
                                }
                                editMutation.mutate({ id: editItem.id, data: editForm });
                            }}
                            disabled={editMutation.isPending || !editForm.name}
                        >
                            {editMutation.isPending ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            <span>Save Changes</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Qualifications / Main Streams *</label>
                        <select className="admin-form-input" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                            <option value="">Select Qualification / Main Stream...</option>
                            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Course Level *</label>
                        <select 
                            className="admin-form-input" 
                            value={editForm.course} 
                            onChange={e => setEditForm({ ...editForm, course: e.target.value })}
                            disabled={!editForm.category}
                        >
                            <option value="">Choose Course Level...</option>
                            {editFormCourses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Study Level *</label>
                        <select 
                            className="admin-form-input" 
                            value={editForm.level} 
                            onChange={e => setEditForm({ ...editForm, level: e.target.value })}
                            disabled={!editForm.course}
                        >
                            <option value="">Choose Study Level...</option>
                            {editFormLevels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Subject Name *</label>
                        <input className="admin-form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Subject Code / Paper Number</label>
                            <input className="admin-form-input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Sort Order</label>
                            <input type="number" className="admin-form-input" value={editForm.order} onChange={e => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })} />
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
};

export default AdminSubjectManager;
