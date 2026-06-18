import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ArrowRight, Layout, Info, Search, Loader2, CheckCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import QuestionTable from '@/components/dashboard/QuestionTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';

export default function QuestionPapersHub() {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search');
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const queryClient = useQueryClient();

    // For inline level picker (when no course selected)
    const [pickerLevel, setPickerLevel] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch all master levels (always — needed for both picker and main view)
    const { data: masterLevels = [], isLoading: isLevelsLoading } = useQuery<any[]>({
        queryKey: ['master-levels-list-hub'],
        queryFn: async () => {
            const res = await api.get('/master/levels/?page_size=200');
            return res.data.results || res.data || [];
        },
    });

    // Resolve user's active level from master list
    const activeLevel = useMemo(() => {
        if (!masterLevels.length || !user?.selected_course) return null;
        return (
            masterLevels.find((l: any) => l.course_id === user.selected_course) ||
            masterLevels.find((l: any) => l.id === user.selected_course) ||
            masterLevels.find(
                (l: any) =>
                    user.selected_course_name &&
                    l.name.toLowerCase() === user.selected_course_name.toLowerCase()
            ) ||
            null
        );
    }, [masterLevels, user?.selected_course, user?.selected_course_name]);

    // Fetch tree for the active level only
    const { data: activeLevelTree, isLoading: isTreeLoading } = useQuery<any>({
        queryKey: ['active-level-tree-hub', activeLevel?.id],
        queryFn: async () => {
            if (!activeLevel?.id) return null;
            return (await api.get(`/master/levels/${activeLevel.id}/tree/`)).data;
        },
        enabled: !!activeLevel?.id,
    });

    const isLoading = (!!user?.selected_course && isLevelsLoading) || (!!activeLevel && isTreeLoading);

    const papers = useMemo(() => {
        if (!activeLevelTree?.papers) return [];
        return activeLevelTree.papers.map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code || 'PAPER',
            chapterCount: p.chapters?.length ?? 0,
        }));
    }, [activeLevelTree]);

    const levelName = activeLevelTree?.level?.name || user?.selected_course_name || '';

    const handleSaveCourse = async () => {
        if (!pickerLevel) return;
        setSaving(true);
        try {
            await updateProfile({ selected_course: parseInt(pickerLevel) });
            queryClient.invalidateQueries({ queryKey: ['master-levels-list-hub'] });
            queryClient.invalidateQueries({ queryKey: ['active-level-tree-hub'] });
        } catch (e) {
            console.error('Failed to save course', e);
        } finally {
            setSaving(false);
        }
    };

    // ── No course selected: simple inline picker (no logout needed) ───────────
    if (!user?.selected_course) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-8 bg-bg">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-5">
                    <BookOpen size={28} className="text-primary" />
                </div>
                <h2 className="text-2xl font-black text-text-primary tracking-tight mb-2">Select Your Course Level</h2>
                <p className="text-sm text-text-muted font-medium leading-relaxed max-w-xs mb-8">
                    Pick your level below to see your question papers and study materials.
                </p>

                <div className="w-full max-w-sm space-y-4">
                    {isLevelsLoading ? (
                        <Loader2 className="animate-spin text-primary mx-auto" size={28} />
                    ) : (
                        <>
                            <div className="relative">
                                <select
                                    value={pickerLevel}
                                    onChange={(e) => setPickerLevel(e.target.value)}
                                    className="w-full bg-card border border-border rounded-2xl py-4 px-5 text-sm font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">— Select your level —</option>
                                    {masterLevels.map((lvl: any) => (
                                        <option key={lvl.id} value={lvl.course_id ?? lvl.id}>{lvl.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>

                            <AnimatePresence>
                                {pickerLevel && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        onClick={handleSaveCourse}
                                        disabled={saving}
                                        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.18em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        {saving
                                            ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                                            : <><CheckCircle size={16} /> Confirm Level</>}
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center bg-bg">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-sm font-semibold text-text-secondary">Loading your papers...</p>
            </div>
        );
    }

    // ── Main content — filtered to student's selected level ───────────────────
    return (
        <div className="space-y-10 pb-20 px-10 w-full -m-8 bg-bg min-h-full">
            <div className="p-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                {searchQuery ? <Search size={20} /> : <Layout size={20} />}
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em]">
                                {searchQuery ? 'Global Search' : 'Material Hub'}
                            </span>
                        </div>
                        <h1 className="text-4xl font-black text-text-primary tracking-tight">
                            {searchQuery ? `Search Results: "${searchQuery}"` : 'Question Papers'}
                        </h1>
                        <p className="text-text-muted font-bold text-sm tracking-wide mt-2">
                            {searchQuery
                                ? 'SHOWING RESULTS ACROSS ALL SUBJECTS'
                                : levelName
                                    ? `${levelName.toUpperCase()} · ALL PAPERS`
                                    : 'YOUR COURSE PAPERS'}
                        </p>
                    </div>

                    <div className="px-6 py-3 bg-card rounded-2xl border border-border flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Info size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Course</p>
                            <p className="text-sm font-black text-text-primary leading-none mt-0.5">
                                {levelName || user?.selected_course_name || 'Your Course'}
                            </p>
                        </div>
                    </div>
                </div>

                {searchQuery ? (
                    <div className="mt-12">
                        <QuestionTable hideTabs={false} />
                    </div>
                ) : (
                    <>
                        {papers.length === 0 ? (
                            <div className="bg-card rounded-3xl p-8 border border-border text-center space-y-3 mt-12">
                                <BookOpen size={48} className="mx-auto text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-700">No papers found for this course.</h3>
                                <p className="text-xs text-slate-500">Contact admin to add papers for your level.</p>
                            </div>
                        ) : (
                            <div className="mt-12 space-y-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <h2 className="text-xl font-black text-text-primary tracking-tight">
                                        {levelName || 'Your Papers'}
                                    </h2>
                                    <div className="flex-1 h-[1px] bg-border" />
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        {papers.length} Papers
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {papers.map((subject: any, idx: number) => (
                                        <motion.div
                                            key={subject.id}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                        >
                                            <Link
                                                to={`/dashboard/papers/subject/${subject.id}`}
                                                className="group relative bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all overflow-hidden flex items-center justify-between"
                                            >
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                                                <div className="relative flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-2xl bg-bg text-text-muted group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all group-hover:rotate-12">
                                                        <BookOpen size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-text-primary group-hover:text-primary transition-colors">
                                                            {subject.name}
                                                        </h3>
                                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">
                                                            {subject.code} · {subject.chapterCount} Chapters
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="relative w-10 h-10 rounded-full bg-bg flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                    <ArrowRight size={20} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Resources tip */}
                        <div className="bg-bg-secondary border border-border rounded-[3rem] p-12 text-text-primary relative overflow-hidden group mt-12 shadow-sm">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/20 transition-all duration-1000" />
                            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                                <div className="max-w-xl">
                                    <h3 className="text-3xl font-black mb-4 tracking-tight">Accessing Resources</h3>
                                    <p className="text-text-muted font-medium text-lg leading-relaxed">
                                        All question papers since 2018, including RTPs, MTPs, and Suggested Answers, are available in the tabular view. Select a subject above to begin.
                                    </p>
                                </div>
                                <button className="px-10 py-5 bg-primary text-white rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-2xl">
                                    View Sample Paper
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
