import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Plus, Edit, Trash2, Save, Search, Loader2, ShieldCheck, Award } from 'lucide-react';

import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyCategoryForm = {
    name: '',
    description: ''
};

const emptyCourseForm = {
    category: '',
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

export default function AdminProgramManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [activeTab, setActiveTab] = useState<'qualifications' | 'courses'>('qualifications');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [categoryModalMode, setCategoryModalMode] = useState<'add' | 'edit' | null>(null);
    const [categoryEditId, setCategoryEditId] = useState<number | null>(null);
    const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

    const [courseModalMode, setCourseModalMode] = useState<'add' | 'edit' | null>(null);
    const [courseEditId, setCourseEditId] = useState<number | null>(null);
    const [courseForm, setCourseForm] = useState(emptyCourseForm);

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // Fetch Categories
    const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
        queryKey: ['admin-categories'],
        queryFn: async () => {
            const res = await api.get('/courses/categories/');
            return res.data.results || res.data || [];
        },
    });

    // Fetch Courses
    const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
        queryKey: ['admin-courses'],
        queryFn: async () => {
            const res = await api.get('/courses/courses/');
            return res.data.results || res.data || [];
        },
    });

    // Category CRUD mutations
    const createCategoryMutation = useMutation({
        mutationFn: (newCat: typeof emptyCategoryForm) => api.post('/courses/categories/', newCat),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            closeCategoryModal();
            show('Qualification created successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to create qualification.'), 'error'),
    });

    const editCategoryMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof emptyCategoryForm }) => api.patch(`/courses/categories/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            closeCategoryModal();
            show('Qualification updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update qualification.'), 'error'),
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/categories/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            show('Qualification deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete qualification.'), 'error'),
    });

    // Course CRUD mutations
    const createCourseMutation = useMutation({
        mutationFn: (newCourse: any) => api.post('/courses/courses/', newCourse),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            closeCourseModal();
            show('Course level created successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to create course level.'), 'error'),
    });

    const editCourseMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/courses/courses/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            closeCourseModal();
            show('Course level updated successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update course level.'), 'error'),
    });

    const deleteCourseMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/courses/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
            show('Course level deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete course level.'), 'error'),
    });

    // Modal Helpers
    const closeCategoryModal = () => {
        setCategoryModalMode(null);
        setCategoryEditId(null);
        setCategoryForm(emptyCategoryForm);
    };

    const openAddCategory = () => {
        setCategoryForm(emptyCategoryForm);
        setCategoryModalMode('add');
    };

    const openEditCategory = (cat: any) => {
        setCategoryEditId(cat.id);
        setCategoryForm({
            name: cat.name || '',
            description: cat.description || '',
        });
        setCategoryModalMode('edit');
    };

    const handleCategorySave = () => {
        if (!categoryForm.name.trim()) {
            show('Qualification name is required.', 'error');
            return;
        }
        if (categoryModalMode === 'edit' && categoryEditId) {
            editCategoryMutation.mutate({ id: categoryEditId, data: categoryForm });
        } else {
            createCategoryMutation.mutate(categoryForm);
        }
    };

    const closeCourseModal = () => {
        setCourseModalMode(null);
        setCourseEditId(null);
        setCourseForm(emptyCourseForm);
    };

    const openAddCourse = () => {
        setCourseForm(emptyCourseForm);
        setCourseModalMode('add');
    };

    const openEditCourse = (course: any) => {
        setCourseEditId(course.id);
        setCourseForm({
            category: course.category || '',
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
        setCourseModalMode('edit');
    };

    const handleCourseSave = () => {
        if (!courseForm.name.trim()) {
            show('Course level name is required.', 'error');
            return;
        }
        if (courseModalMode === 'edit' && courseEditId) {
            editCourseMutation.mutate({ id: courseEditId, data: courseForm });
        } else {
            createCourseMutation.mutate(courseForm);
        }
    };

    const filteredCategories = categories.filter((cat: any) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredCourses = courses.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.category_name && c.category_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="qm-container px-6 py-6">
            {Toast}
            {/* Header */}
            <div className="qm-header flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Award size={18} className="text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                            Academic Configuration
                        </span>
                    </div>
                    <h1 className="page-title text-xl font-bold text-slate-800">Qualifications & Levels</h1>
                    <p className="page-subtitle text-xs text-slate-500">
                        Configure stream qualifications (e.g. CA, CMA, CS) and associated course level registration tracks.
                    </p>
                </div>
                <div>
                    {activeTab === 'qualifications' ? (
                        <button type="button" onClick={openAddCategory} className="primary-btn flex-center gap-sm text-xs font-bold">
                            <Plus size={16} />
                            <span>Add Qualification</span>
                        </button>
                    ) : (
                        <button type="button" onClick={openAddCourse} className="primary-btn flex-center gap-sm text-xs font-bold">
                            <Plus size={16} />
                            <span>Add Course Level</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-100">
                <button
                    onClick={() => { setActiveTab('qualifications'); setSearchQuery(''); }}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'qualifications' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Qualifications / Main Streams
                </button>
                <button
                    onClick={() => { setActiveTab('courses'); setSearchQuery(''); }}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'courses' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Course Levels
                </button>
            </div>

            {/* Toolbar */}
            <div className="table-toolbar mb-4 flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
                <div className="search-box relative flex items-center w-full max-w-md">
                    <Search size={18} className="absolute left-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder={activeTab === 'qualifications' ? 'Search qualifications...' : 'Search course levels...'}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid/List views */}
            {activeTab === 'qualifications' ? (
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                    <table className="data-table w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                            <tr>
                                <th className="p-4">Qualification Name</th>
                                <th className="p-4">Description</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isCategoriesLoading && (
                                <tr>
                                    <td colSpan={3} className="text-center p-8">
                                        <Loader2 className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            )}
                            {!isCategoriesLoading && filteredCategories.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center p-8 text-slate-400">
                                        No qualifications found.
                                    </td>
                                </tr>
                            )}
                            {filteredCategories.map((cat: any) => (
                                <tr key={cat.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-primary" />
                                        {cat.name}
                                    </td>
                                    <td className="p-4 text-slate-500 max-w-md truncate">{cat.description || '—'}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditCategory(cat)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors">
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Qualification',
                                                    message: `Are you sure you want to delete "${cat.name}"? Courses under this stream will lose their association.`,
                                                    onConfirm: () => {
                                                        deleteCategoryMutation.mutate(cat.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                                className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                    <table className="data-table w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                            <tr>
                                <th className="p-4">Course Level</th>
                                <th className="p-4">Qualification Stream</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isCoursesLoading && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8">
                                        <Loader2 className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            )}
                            {!isCoursesLoading && filteredCourses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-slate-400">
                                        No course levels found.
                                    </td>
                                </tr>
                            )}
                            {filteredCourses.map((course: any) => (
                                <tr key={course.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${course.is_archived ? 'opacity-60' : ''}`}>
                                    <td className="p-4 font-bold text-slate-800">
                                        {course.name}
                                        {course.is_archived && <span className="ml-2 text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1 rounded">Archived</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                            {course.category_name || 'No Qualification'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${course.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${course.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                            {course.is_active ? 'Active' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditCourse(course)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors">
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Course Level',
                                                    message: `Are you sure you want to delete course level "${course.name}"? This cannot be undone.`,
                                                    onConfirm: () => {
                                                        deleteCourseMutation.mutate(course.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                                className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Category Modal */}
            <AdminModal
                open={categoryModalMode !== null}
                onClose={closeCategoryModal}
                title={categoryModalMode === 'edit' ? 'Edit Qualification' : 'Add Qualification'}
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeCategoryModal}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider"
                            onClick={handleCategorySave}
                            disabled={createCategoryMutation.isPending || editCategoryMutation.isPending}
                        >
                            <Save size={16} />
                            <span>Save Qualification</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Qualification Name *</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. CA, CMA, CS"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        />
                    </div>
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Description</label>
                        <textarea
                            className="admin-form-input min-h-[100px]"
                            placeholder="Short description of the stream track..."
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        />
                    </div>
                </div>
            </AdminModal>

            {/* Course Modal */}
            <AdminModal
                open={courseModalMode !== null}
                onClose={closeCourseModal}
                title={courseModalMode === 'edit' ? 'Edit Course Level' : 'Add Course Level'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={closeCourseModal}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider"
                            onClick={handleCourseSave}
                            disabled={createCourseMutation.isPending || editCourseMutation.isPending}
                        >
                            <Save size={16} />
                            <span>Save Course Level</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Parent Qualification Stream *</label>
                            <select
                                className="admin-form-input"
                                value={courseForm.category}
                                onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                                required
                            >
                                <option value="">Select Stream Qualification</option>
                                {categories.map((cat: any) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="text-xs font-bold text-slate-700">Course Level Name *</label>
                            <input
                                className="admin-form-input"
                                placeholder="e.g. CA Intermediate, CMA Final"
                                value={courseForm.name}
                                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Short Description</label>
                        <input
                            className="admin-form-input"
                            placeholder="Brief overview text"
                            value={courseForm.short_description}
                            onChange={(e) => setCourseForm({ ...courseForm, short_description: e.target.value })}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Full Description</label>
                        <textarea
                            className="admin-form-input min-h-[80px]"
                            placeholder="Provide deep details of the educational material covered..."
                            value={courseForm.description}
                            onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                        />
                    </div>

                    {/* Checkboxes and images removed */}
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
