
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/axios';
import {
    Database, Layers, BookOpen, FileText, ListTree,
    Loader2, Plus, ChevronRight, ChevronDown, Search, Edit, Trash2, Save
} from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/MasterDatabase.css';
import '@/styles/admin/QuestionManagement.css';

const AdminMasterDatabase = () => {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [search, setSearch] = useState('');
    const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
    const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
    const hasAutoSelected = useState(false);

    // Modal state managers
    const [levelModal, setLevelModal] = useState<{ open: boolean; editId?: number; qualification: string; name: string; order: number }>({ open: false, qualification: '', name: '', order: 0 });
    const [selectedLevelNames, setSelectedLevelNames] = useState<string[]>([]);
    const [paperModal, setPaperModal] = useState<{ open: boolean; editId?: number; name: string; code: string; order: number }>({ open: false, name: '', code: '', order: 0 });
    const [chapterModal, setChapterModal] = useState<{ open: boolean; editId?: number; name: string; order: number }>({ open: false, name: '', order: 0 });
    const [topicModal, setTopicModal] = useState<{ open: boolean; editId?: number; chapterId?: number; name: string; order: number }>({ open: false, name: '', order: 0 });

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['master-stats'],
        queryFn: async () => (await api.get('/master/stats/')).data,
    });

    const { data: tree = [], isLoading: treeLoading } = useQuery({
        queryKey: ['master-tree'],
        queryFn: async () => (await api.get('/master/tree/')).data,
    });

    // Fetch dynamic Qualifications (Categories)
    const { data: categories = [] } = useQuery({
        queryKey: ['admin-categories'],
        queryFn: async () => {
            const res = await api.get('/courses/categories/');
            return res.data.results || res.data || [];
        },
    });

    // Fetch dynamic Course Levels (Courses)
    const { data: courses = [] } = useQuery({
        queryKey: ['admin-courses'],
        queryFn: async () => {
            const res = await api.get('/courses/courses/');
            return res.data.results || res.data || [];
        },
    });

    // Invalidate master queries
    const invalidateMaster = () => {
        queryClient.invalidateQueries({ queryKey: ['master-tree'] });
        queryClient.invalidateQueries({ queryKey: ['master-stats'] });
    };

    // Level mutations
    const saveLevelMutation = useMutation({
        mutationFn: async (data: { qualification: string; names: string[]; order: number }) => {
            if (levelModal.editId) {
                return api.patch(`/master/levels/${levelModal.editId}/`, {
                    qualification: data.qualification,
                    name: data.names[0],
                    order: data.order
                });
            }
            const promises = data.names.map(name =>
                api.post('/master/levels/', {
                    qualification: data.qualification,
                    name,
                    order: data.order
                })
            );
            return Promise.all(promises);
        },
        onSuccess: () => {
            invalidateMaster();
            setLevelModal({ open: false, qualification: categories[0]?.name || '', name: '', order: 0 });
            setSelectedLevelNames([]);
            show(levelModal.editId ? 'Level updated.' : 'Level(s) created.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to save level(s).'), 'error'),
    });

    const deleteLevelMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/master/levels/${id}/`),
        onSuccess: () => {
            invalidateMaster();
            setSelectedLevelId(null);
            show('Level deleted.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to delete Level.'), 'error')
    });

    // Paper mutations
    const savePaperMutation = useMutation({
        mutationFn: async (data: { name: string; code: string; order: number; level: number }) => {
            if (paperModal.editId) {
                return api.patch(`/master/papers/${paperModal.editId}/`, data);
            }
            return api.post('/master/papers/', data);
        },
        onSuccess: () => {
            invalidateMaster();
            setPaperModal({ open: false, name: '', code: '', order: 0 });
            show(paperModal.editId ? 'Paper updated.' : 'Paper created.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to save Paper.'), 'error')
    });

    const deletePaperMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/master/papers/${id}/`),
        onSuccess: () => {
            invalidateMaster();
            setSelectedPaperId(null);
            show('Paper deleted.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to delete Paper.'), 'error')
    });

    // Chapter mutations
    const saveChapterMutation = useMutation({
        mutationFn: async (data: { name: string; order: number; paper: number }) => {
            if (chapterModal.editId) {
                return api.patch(`/master/chapters/${chapterModal.editId}/`, data);
            }
            return api.post('/master/chapters/', data);
        },
        onSuccess: () => {
            invalidateMaster();
            setChapterModal({ open: false, name: '', order: 0 });
            show(chapterModal.editId ? 'Chapter updated.' : 'Chapter created.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to save Chapter.'), 'error')
    });

    const deleteChapterMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/master/chapters/${id}/`),
        onSuccess: () => {
            invalidateMaster();
            show('Chapter deleted.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to delete Chapter.'), 'error')
    });

    // Topic mutations
    const saveTopicMutation = useMutation({
        mutationFn: async (data: { name: string; order: number; chapter: number }) => {
            if (topicModal.editId) {
                return api.patch(`/master/topics/${topicModal.editId}/`, data);
            }
            return api.post('/master/topics/', data);
        },
        onSuccess: () => {
            invalidateMaster();
            setTopicModal({ open: false, name: '', order: 0 });
            show(topicModal.editId ? 'Topic updated.' : 'Topic created.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to save Topic.'), 'error')
    });

    const deleteTopicMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/master/topics/${id}/`),
        onSuccess: () => {
            invalidateMaster();
            show('Topic deleted.');
        },
        onError: (err) => show(getApiErrorMessage(err, 'Failed to delete Topic.'), 'error')
    });

    const filteredTree = useMemo(() => {
        if (!search.trim()) return tree;
        const q = search.toLowerCase();
        return tree
            .map((level: any) => ({
                ...level,
                papers: level.papers
                    .map((paper: any) => ({
                        ...paper,
                        chapters: paper.chapters.filter(
                            (ch: any) =>
                                ch.name.toLowerCase().includes(q) ||
                                paper.name.toLowerCase().includes(q) ||
                                ch.topics.some((t: any) => t.name.toLowerCase().includes(q))
                        ),
                    }))
                    .filter(
                        (paper: any) =>
                            paper.chapters.length > 0 || paper.name.toLowerCase().includes(q)
                    ),
            }))
            .filter(
                (level: any) =>
                    level.papers.length > 0 || level.name.toLowerCase().includes(q)
            );
    }, [tree, search]);

    const groupedTree = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        filteredTree.forEach((level: any) => {
            const q = level.qualification || 'Uncategorized';
            const upperQ = q.toUpperCase();
            if (!groups[upperQ]) {
                groups[upperQ] = [];
            }
            groups[upperQ].push(level);
        });
        return groups;
    }, [filteredTree]);

    useEffect(() => {
        if (filteredTree.length && !hasAutoSelected[0]) {
            hasAutoSelected[1](true);
            const first = filteredTree[0];
            setSelectedLevelId(first.id);
            setSelectedPaperId(first.papers?.[0]?.id ?? null);
        }
    }, [filteredTree]);

    const levelId = selectedLevelId;
    const displayLevel = filteredTree.find((l: any) => l.id === levelId);
    const paperId = selectedPaperId ?? displayLevel?.papers?.[0]?.id ?? null;
    const displayPaper = displayLevel?.papers?.find((p: any) => p.id === paperId);

    const statCards = [
        { label: 'Course Levels', value: stats?.levels, icon: Layers, color: 'var(--color-primary-light)' },
        { label: 'Papers', value: stats?.papers, icon: BookOpen, color: 'var(--color-accent)' },
        { label: 'Chapters', value: stats?.chapters, icon: ListTree, color: '#8b5cf6' },
        { label: 'Topics', value: stats?.topics, icon: FileText, color: '#f59e0b' },
        { label: 'Questions', value: stats?.questions, icon: Database, color: 'var(--color-danger)' },
    ];

    return (
        <div className="master-db-container px-6 py-6">
            {Toast}
            <div className="qm-header flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Database size={18} className="text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                            Enterprise Master DB
                        </span>
                    </div>
                    <h1 className="page-title text-xl font-bold text-slate-800">Master Database</h1>
                    <p className="page-subtitle text-xs text-slate-500">
                        Complete structure: Course Level → Paper → Chapter → Topic → Questions
                    </p>
                </div>
                <div className="header-actions flex gap-3">
                    <button
                        onClick={() => setLevelModal({ open: true, qualification: categories[0]?.name || '', name: '', order: tree.length + 1 })}
                        className="secondary-btn flex-center gap-xs font-bold text-xs"
                    >
                        <Plus size={16} />
                        <span>Add Course Level</span>
                    </button>
                    <Link to="/admin/questions/new" className="primary-btn flex-center gap-xs font-bold text-xs">
                        <Plus size={16} />
                        <span>Add Question</span>
                    </Link>
                </div>
            </div>

            <div className="master-stats-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                {statCards.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className="master-stat-card bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="stat-label text-[10px] font-bold text-slate-400 uppercase">{s.label}</span>
                                <Icon size={18} style={{ color: s.color, opacity: 0.7 }} />
                            </div>
                            <div className="stat-value text-2xl font-black text-slate-800">
                                {statsLoading ? '...' : (s.value ?? 0).toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="master-tree-layout grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                <div className="master-tree-panel bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="master-tree-toolbar p-4 border-b border-slate-50 flex flex-col gap-3">
                        <div className="search-box relative flex items-center">
                            <Search size={18} className="absolute left-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search papers, chapters, topics..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setLevelModal({ open: true, qualification: categories[0]?.name || '', name: '', order: tree.length + 1 })}
                            className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-blue-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                            <Plus size={14} /> Add Course Level
                        </button>
                    </div>
                    <div className="master-tree-scroll flex-1 overflow-y-auto p-3">
                        {treeLoading && (
                            <div className="p-10 text-center">
                                <Loader2 className="animate-spin mx-auto text-blue-600" />
                            </div>
                        )}
                        {Object.entries(groupedTree).map(([qualification, levels]) => (
                            <div key={qualification} className="mb-4">
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 border border-slate-100 rounded-lg px-2.5 py-1 mb-2 flex items-center justify-between">
                                    <span>{qualification}</span>
                                    <span className="bg-slate-200/50 text-slate-500 px-1 py-0.2 rounded-full font-bold text-[8px]">{levels.length}</span>
                                </div>
                                <div className="space-y-2 pl-0.5">
                                    {levels.map((level: any) => (
                                        <div key={level.id} className="tree-level mb-2">
                                            <div
                                                className={`tree-level-btn flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 ${
                                                    levelId === level.id
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                        : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                                                }`}
                                                onClick={() => {
                                                    if (selectedLevelId === level.id) {
                                                        setSelectedLevelId(null);
                                                        setSelectedPaperId(null);
                                                    } else {
                                                        setSelectedLevelId(level.id);
                                                        setSelectedPaperId(level.papers[0]?.id ?? null);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <ChevronDown
                                                        size={13}
                                                        className="flex-shrink-0 transition-transform duration-200"
                                                        style={{ transform: levelId === level.id ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                                    />
                                                    <span className="truncate max-w-[130px]">{level.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <button className="text-slate-400 hover:text-blue-600 transition-colors" onClick={() => setLevelModal({ open: true, editId: level.id, qualification: level.qualification || '', name: level.name, order: level.order })}><Edit size={12} /></button>
                                                    <button className="text-slate-400 hover:text-red-600 transition-colors" onClick={() => setConfirmDelete({
                                                        open: true,
                                                        title: 'Delete Course Level',
                                                        message: `Are you sure you want to delete the Course Level "${level.name}"? This will delete all papers, chapters, and topics within it.`,
                                                        onConfirm: () => {
                                                            deleteLevelMutation.mutate(level.id);
                                                            setConfirmDelete(prev => ({ ...prev, open: false }));
                                                        }
                                                    })}><Trash2 size={12} /></button>
                                                    <span className="tree-paper-meta text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded border border-slate-100">{level.paper_count} papers</span>
                                                </div>
                                            </div>
                                            {levelId === level.id && (
                                                <div className="mt-1 pl-3 flex flex-col gap-1 border-l border-slate-100 ml-3">
                                                    {level.papers.map((paper: any) => (
                                                        <div key={paper.id} className="flex flex-col gap-0.5">
                                                            <div
                                                                className={`tree-paper-btn flex justify-between items-center px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors ${paperId === paper.id ? 'bg-teal-50 text-teal-700 font-bold' : ''}`}
                                                                onClick={() => setSelectedPaperId(paper.id)}
                                                            >
                                                                <div className="truncate max-w-[140px]">{paper.name}</div>
                                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                                    <button className="text-slate-400 hover:text-blue-600 transition-colors" onClick={() => setPaperModal({ open: true, editId: paper.id, name: paper.name, code: paper.code || '', order: paper.order })}><Edit size={11} /></button>
                                                                    <button className="text-slate-400 hover:text-red-600 transition-colors" onClick={() => setConfirmDelete({
                                                                        open: true,
                                                                        title: 'Delete Paper',
                                                                        message: `Are you sure you want to delete the Paper "${paper.name}"? This will delete all chapters and topics within it.`,
                                                                        onConfirm: () => {
                                                                            deletePaperMutation.mutate(paper.id);
                                                                            setConfirmDelete(prev => ({ ...prev, open: false }));
                                                                        }
                                                                    })}><Trash2 size={11} /></button>
                                                                </div>
                                                            </div>
                                                            {paperId === paper.id && paper.chapters && paper.chapters.length > 0 && (
                                                                <div className="mt-0.5 mb-1.5 pl-4 flex flex-col gap-0.5 border-l border-teal-200 ml-4">
                                                                    {paper.chapters.map((chapter: any) => (
                                                                        <div
                                                                            key={chapter.id}
                                                                            className="flex items-center justify-between py-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
                                                                        >
                                                                            <span className="truncate max-w-[150px] font-medium">• {chapter.name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => setPaperModal({ open: true, name: '', code: '', order: level.papers.length + 1 })}
                                                        className="tree-paper-btn flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:bg-blue-50 py-1"
                                                    >
                                                        <Plus size={11} /> Add Paper
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="master-detail-panel bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                    {displayPaper ? (
                        <div className="flex flex-col h-full min-h-0">
                            <div className="master-detail-header p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-md font-bold text-slate-800">{displayPaper.name}</h2>
                                    <div className="breadcrumb-path flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                        <span>{displayLevel?.name}</span>
                                        <span className="sep">›</span>
                                        <span>{displayPaper.name}</span>
                                        <span className="sep">›</span>
                                        <span>{displayPaper.chapters?.length ?? 0} Chapters</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setChapterModal({ open: true, name: '', order: (displayPaper.chapters?.length || 0) + 1 })}
                                    className="primary-btn flex-center gap-xs font-bold text-xs"
                                >
                                    <Plus size={16} /> Add Chapter
                                </button>
                            </div>
                            <div className="chapter-grid p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0">
                                {displayPaper.chapters?.map((chapter: any) => (
                                    <div key={chapter.id} className="chapter-card bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-300 transition-colors">
                                        <div>
                                            <div className="flex justify-between items-start mb-3 gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-0.5">
                                                        {displayLevel?.qualification} › {displayLevel?.name}
                                                    </span>
                                                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{chapter.name}</h4>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                        Paper: {displayPaper.name} {displayPaper.code ? `(${displayPaper.code})` : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button className="text-slate-400 hover:text-blue-600 transition-colors p-1" onClick={() => setChapterModal({ open: true, editId: chapter.id, name: chapter.name, order: chapter.order })}><Edit size={12} /></button>
                                                    <button className="text-slate-400 hover:text-red-600 transition-colors p-1" onClick={() => setConfirmDelete({
                                                        open: true,
                                                        title: 'Delete Chapter',
                                                        message: `Are you sure you want to delete the Chapter "${chapter.name}"? This will delete all topics within it.`,
                                                        onConfirm: () => {
                                                            deleteChapterMutation.mutate(chapter.id);
                                                            setConfirmDelete(prev => ({ ...prev, open: false }));
                                                        }
                                                    })}><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                            <div className="topic-pills flex flex-wrap gap-1.5 mb-4">
                                                {chapter.topics?.map((t: any) => (
                                                    <span key={t.id} className="topic-pill flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 group/pill relative">
                                                        <span>{t.name}</span>
                                                        <button
                                                            className="hover:text-red-600 font-bold ml-1"
                                                            title="Delete Topic"
                                                            onClick={() => setConfirmDelete({
                                                                open: true,
                                                                title: 'Delete Topic',
                                                                message: `Are you sure you want to delete the Topic "${t.name}"?`,
                                                                onConfirm: () => {
                                                                    deleteTopicMutation.mutate(t.id);
                                                                    setConfirmDelete(prev => ({ ...prev, open: false }));
                                                                }
                                                            })}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={() => setTopicModal({ open: true, chapterId: chapter.id, name: '', order: (chapter.topics?.length || 0) + 1 })}
                                                    className="flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                                                >
                                                    <Plus size={10} /> Add Topic
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-auto">
                                            <span className="text-[10px] text-slate-400 font-bold">
                                                {chapter.question_count ?? 0} questions
                                            </span>
                                            <Link
                                                to={`/admin/questions/new?chapter=${chapter.id}&topic=${chapter.topics?.[0]?.id ?? ''}`}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                            >
                                                Add Question <ChevronRight size={12} />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 h-full">
                            <ListTree size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-semibold">Select a course level and paper to browse chapters.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Level Modal */}
            <AdminModal
                open={levelModal.open}
                onClose={() => {
                    setLevelModal({ open: false, qualification: categories[0]?.name || '', name: '', order: 0 });
                    setSelectedLevelNames([]);
                }}
                title={levelModal.editId ? "Edit Course Level" : "Add Course Level(s)"}
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => {
                            setLevelModal({ open: false, qualification: categories[0]?.name || '', name: '', order: 0 });
                            setSelectedLevelNames([]);
                        }}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-xs font-bold text-xs"
                            onClick={() => saveLevelMutation.mutate({
                                qualification: levelModal.qualification,
                                names: levelModal.editId ? [levelModal.name] : selectedLevelNames,
                                order: levelModal.order
                            })}
                            disabled={saveLevelMutation.isPending || !levelModal.qualification || (levelModal.editId ? !levelModal.name : selectedLevelNames.length === 0)}
                        >
                            {saveLevelMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>Save Level</span>
                        </button>
                    </>
                }
            >
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Qualification / Learning Stream *</label>
                    <select
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                        value={levelModal.qualification}
                        onChange={e => {
                            setLevelModal({ ...levelModal, qualification: e.target.value, name: '' });
                            setSelectedLevelNames([]);
                        }}
                    >
                        <option value="">Select Stream Qualification</option>
                        {categories.map((cat: any) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Course Level Name *</label>
                    {levelModal.editId ? (
                        <div className="space-y-2">
                            <input
                                type="text"
                                className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                placeholder="Enter Level Name"
                                value={levelModal.name}
                                onChange={e => setLevelModal({ ...levelModal, name: e.target.value })}
                            />
                            {courses.filter((c: any) => c.category_name?.toString() === levelModal.qualification?.toString()).length > 0 && (
                                <p className="text-[10px] text-slate-400">
                                    Suggested from existing courses: {courses.filter((c: any) => c.category_name?.toString() === levelModal.qualification?.toString()).map((c: any) => c.name).join(', ')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Option 1: Existing courses checkboxes */}
                            <div className="border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                                {(() => {
                                    const availableCourses = courses
                                        .filter((c: any) => c.category_name?.toString() === levelModal.qualification?.toString())
                                        .filter((c: any) => !tree.some((t: any) => t.name?.toLowerCase() === c.name?.toLowerCase()));

                                    if (availableCourses.length === 0) {
                                        return (
                                            <p className="text-xs text-slate-400 text-center py-2">
                                                No unmapped existing courses found for this qualification.
                                            </p>
                                        );
                                    }

                                    return (
                                        <>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Available Existing Courses:</p>
                                            {availableCourses.map((c: any) => {
                                                const isChecked = selectedLevelNames.includes(c.name);
                                                return (
                                                    <label key={c.id} className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer hover:bg-slate-100/60 p-1 rounded transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isChecked) {
                                                                    setSelectedLevelNames(selectedLevelNames.filter(n => n !== c.name));
                                                                } else {
                                                                    setSelectedLevelNames([...selectedLevelNames, c.name]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                                        />
                                                        {c.name}
                                                    </label>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Option 2: Add custom name */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    id="custom-level-input"
                                    placeholder="Type custom level name (e.g. CA Final)"
                                    className="admin-form-input flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = e.currentTarget.value.trim();
                                            if (val && !selectedLevelNames.includes(val)) {
                                                setSelectedLevelNames([...selectedLevelNames, val]);
                                                e.currentTarget.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById('custom-level-input') as HTMLInputElement;
                                        const val = input?.value.trim();
                                        if (val && !selectedLevelNames.includes(val)) {
                                            setSelectedLevelNames([...selectedLevelNames, val]);
                                            if (input) input.value = '';
                                        }
                                    }}
                                    className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    Add
                                </button>
                            </div>

                            {/* Display selected level names */}
                            {selectedLevelNames.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Levels to create:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedLevelNames.map(name => (
                                            <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                                                {name}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLevelNames(selectedLevelNames.filter(n => n !== name))}
                                                    className="hover:text-rose-500 font-bold ml-1"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="admin-form-group">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Display Order</label>
                    <input
                        type="number"
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={levelModal.order}
                        onChange={e => setLevelModal({ ...levelModal, order: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </AdminModal>

            {/* Paper Modal */}
            <AdminModal
                open={paperModal.open}
                onClose={() => setPaperModal({ open: false, name: '', code: '', order: 0 })}
                title={paperModal.editId ? "Edit Paper" : "Add New Paper"}
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setPaperModal({ open: false, name: '', code: '', order: 0 })}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-xs font-bold text-xs"
                            onClick={() => {
                                if (!levelId) return;
                                savePaperMutation.mutate({ name: paperModal.name, code: paperModal.code, order: paperModal.order, level: levelId });
                            }}
                            disabled={savePaperMutation.isPending || !paperModal.name}
                        >
                            {savePaperMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>Save Paper</span>
                        </button>
                    </>
                }
            >
                {displayLevel && (
                    <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Parent Level:</span>
                        <div className="text-xs font-bold text-slate-700">{displayLevel.name}</div>
                    </div>
                )}
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Paper Name *</label>
                    <input
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={paperModal.name}
                        onChange={e => setPaperModal({ ...paperModal, name: e.target.value })}
                        placeholder="e.g. Paper 1 - Accounting"
                    />
                </div>
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Paper Code</label>
                    <input
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={paperModal.code}
                        onChange={e => setPaperModal({ ...paperModal, code: e.target.value })}
                        placeholder="e.g. P1-ACC"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Display Order</label>
                    <input
                        type="number"
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={paperModal.order}
                        onChange={e => setPaperModal({ ...paperModal, order: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </AdminModal>

            {/* Chapter Modal */}
            <AdminModal
                open={chapterModal.open}
                onClose={() => setChapterModal({ open: false, name: '', order: 0 })}
                title={chapterModal.editId ? "Edit Chapter" : "Add New Chapter"}
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setChapterModal({ open: false, name: '', order: 0 })}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-xs font-bold text-xs"
                            onClick={() => {
                                if (!paperId) return;
                                saveChapterMutation.mutate({ name: chapterModal.name, order: chapterModal.order, paper: paperId });
                            }}
                            disabled={saveChapterMutation.isPending || !chapterModal.name}
                        >
                            {saveChapterMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>Save Chapter</span>
                        </button>
                    </>
                }
            >
                {displayPaper && (
                    <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Parent Paper:</span>
                        <div className="text-xs font-bold text-slate-700">{displayPaper.name}</div>
                    </div>
                )}
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Chapter Name *</label>
                    <input
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={chapterModal.name}
                        onChange={e => setChapterModal({ ...chapterModal, name: e.target.value })}
                        placeholder="e.g. Chapter 1: Introduction to Accounting"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Display Order</label>
                    <input
                        type="number"
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={chapterModal.order}
                        onChange={e => setChapterModal({ ...chapterModal, order: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </AdminModal>

            {/* Topic Modal */}
            <AdminModal
                open={topicModal.open}
                onClose={() => setTopicModal({ open: false, name: '', order: 0 })}
                title="Add New Topic"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setTopicModal({ open: false, name: '', order: 0 })}>Cancel</button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-xs font-bold text-xs"
                            onClick={() => {
                                const chId = topicModal.chapterId;
                                if (!chId) return;
                                saveTopicMutation.mutate({ name: topicModal.name, order: topicModal.order, chapter: chId });
                            }}
                            disabled={saveTopicMutation.isPending || !topicModal.name}
                        >
                            {saveTopicMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>Save Topic</span>
                        </button>
                    </>
                }
            >
                {displayPaper && topicModal.chapterId && (
                    <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Parent Chapter:</span>
                        <div className="text-xs font-bold text-slate-700">
                            {displayPaper.chapters?.find((c: any) => c.id === topicModal.chapterId)?.name}
                        </div>
                    </div>
                )}
                <div className="admin-form-group mb-4">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Topic Name *</label>
                    <input
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={topicModal.name}
                        onChange={e => setTopicModal({ ...topicModal, name: e.target.value })}
                        placeholder="e.g. Topic 1: Standard Settings"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Display Order</label>
                    <input
                        type="number"
                        className="admin-form-input w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={topicModal.order}
                        onChange={e => setTopicModal({ ...topicModal, order: parseInt(e.target.value) || 0 })}
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

export default AdminMasterDatabase;
