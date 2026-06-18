import { useState, useMemo, useEffect } from 'react';
import { Eye, Home, Search, Star, X, Lock, Filter } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import QuestionModal from './QuestionModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';

interface Question {
    id: number;
    subject_name: string;
    topic_name: string;
    sub_topic_name: string;
    source: string;
    year: string;
    q_no: string;
    marks: number;
    is_important: boolean;
    question_type?: string;
}

export default function QuestionTable({
    onShowQuestion,
    defaultFilter = 'subjective',
    hideTabs = false
}: {
    onShowQuestion?: (q: Question) => void;
    defaultFilter?: 'subjective' | 'mcq' | 'important' | 'saved';
    hideTabs?: boolean;
}) {
    const { user } = useAuthStore();
    const { id: routeSubjectId } = useParams<{ id: string }>();
    const [activeRowId, setActiveRowId] = useState<number | null>(null);
    const [filter, setFilter] = useState<'subjective' | 'mcq' | 'important' | 'saved'>(defaultFilter || 'subjective');
    const [searchParams] = useSearchParams();

    // Read global search from Topbar
    const globalSearch = searchParams.get('search') || '';
    const [searchQuery, setSearchQuery] = useState(globalSearch);
    const [showSearch, setShowSearch] = useState(!!globalSearch);
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedMarks, setSelectedMarks] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Sync external search updates
    useEffect(() => {
        if (globalSearch) {
            setSearchQuery(globalSearch);
            setShowSearch(true);
        }
    }, [globalSearch]);

    // Fetch Questions
    const { data: questionsResponse, isLoading } = useQuery({
        queryKey: ['subjective-questions', routeSubjectId],
        queryFn: async () => {
            const url = routeSubjectId
                ? `/materials/subjective-questions/?paper_id=${routeSubjectId}`
                : '/materials/subjective-questions/';
            return (await api.get(url)).data;
        },
        refetchInterval: 5000, // Live-sync with Django Admin
    });

    // Fetch Bookmarks to check what's "saved"
    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
        refetchInterval: 5000,
    });

    const isBookmarked = (qId: number) => bookmarks.some((b: any) => b.material_id === qId && b.material_type === 'SubjectiveQuestion');
    const getBookmarkId = (qId: number) => bookmarks.find((b: any) => b.material_id === qId && b.material_type === 'SubjectiveQuestion')?.id;

    const queryClient = useQueryClient();
    const toggleBookmark = useMutation({
        mutationFn: async ({ qId, bookmarkId }: { qId: number, bookmarkId?: number }) => {
            if (bookmarkId) {
                await api.delete(`/materials/bookmarks/${bookmarkId}/`);
            } else {
                await api.post('/materials/bookmarks/', {
                    material_id: qId,
                    material_type: 'SubjectiveQuestion'
                });
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    });

    // Internal Viewer State for "Full Work Mode"
    const [viewerQuestion, setViewerQuestion] = useState<Question | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    const uniqueSources = useMemo(() => {
        const questionsList = Array.isArray(questionsResponse) ? questionsResponse : (questionsResponse?.results || []);
        const set = new Set<string>();
        questionsList.forEach((q: any) => {
            if (q.source) set.add(q.source);
        });
        return Array.from(set).sort();
    }, [questionsResponse]);

    const uniqueYears = useMemo(() => {
        const questionsList = Array.isArray(questionsResponse) ? questionsResponse : (questionsResponse?.results || []);
        const set = new Set<string>();
        questionsList.forEach((q: any) => {
            if (q.year) set.add(q.year);
        });
        return Array.from(set).sort().reverse();
    }, [questionsResponse]);

    const uniqueMarks = useMemo(() => {
        const questionsList = Array.isArray(questionsResponse) ? questionsResponse : (questionsResponse?.results || []);
        const set = new Set<number>();
        questionsList.forEach((q: any) => {
            if (q.marks) set.add(Number(q.marks));
        });
        return Array.from(set).sort((a, b) => a - b);
    }, [questionsResponse]);

    const filteredQuestions = useMemo(() => {
        const questionsList = Array.isArray(questionsResponse) ? questionsResponse : (questionsResponse?.results || []);
        return questionsList.filter((q: any) => {
            // Scope by student's selected course level name if present
            // Skip check if we are already scoped to a specific paper (routeSubjectId) or user is staff
            if (user?.selected_course_name && !routeSubjectId && !user?.is_staff) {
                const qLevelName = q.icai_level_name || '';
                if (qLevelName.toLowerCase() !== user.selected_course_name.toLowerCase()) {
                    return false;
                }
            }

            // Filter by subject/paper ID from the route parameter if present
            if (routeSubjectId) {
                const legacyMatch = String(q.subject) === String(routeSubjectId);
                const masterMatch = String(q.icai_paper_id) === String(routeSubjectId);
                if (!legacyMatch && !masterMatch) {
                    return false;
                }
            }

            if (selectedSource !== 'all' && q.source !== selectedSource) {
                return false;
            }
            if (selectedYear !== 'all' && q.year !== selectedYear) {
                return false;
            }
            if (selectedMarks !== 'all' && String(q.marks) !== selectedMarks) {
                return false;
            }

            const isBookmarkedRow = isBookmarked(q.id);
            const isStarred = q.is_important || isBookmarkedRow;

            let matchesType = true;
            if (filter === 'important') matchesType = isStarred;
            if (filter === 'saved') matchesType = isBookmarkedRow;
            if (filter === 'mcq') matchesType = q.question_type === 'MCQ' || q.question_type === 'CASE_SCENARIO';
            if (filter === 'subjective') matchesType = q.question_type !== 'MCQ' && q.question_type !== 'CASE_SCENARIO';

            const searchStr = searchQuery.toLowerCase();
            const matchesSearch = (q.topic_name || '').toLowerCase().includes(searchStr) ||
                (q.icai_topic_name || '').toLowerCase().includes(searchStr) ||
                (q.source || '').toLowerCase().includes(searchStr) ||
                (q.q_no || '').toLowerCase().includes(searchStr);
            return matchesType && matchesSearch;
        });
    }, [questionsResponse, bookmarks, filter, searchQuery, routeSubjectId, user?.selected_course_name, selectedSource, selectedYear, selectedMarks]);

    const handleRowClick = (q: Question) => {
        setActiveRowId(q.id);
        setViewerQuestion(q);
        setIsViewerOpen(true);
        onShowQuestion?.(q);
    };

    const handleNext = () => {
        if (!viewerQuestion) return;
        const currentIndex = filteredQuestions.findIndex((q: Question) => q.id === viewerQuestion.id);
        if (currentIndex < filteredQuestions.length - 1) {
            const nextQ = filteredQuestions[currentIndex + 1];
            setViewerQuestion(nextQ);
            setActiveRowId(nextQ.id);
        }
    };

    const handlePrev = () => {
        if (!viewerQuestion) return;
        const currentIndex = filteredQuestions.findIndex((q: Question) => q.id === viewerQuestion.id);
        if (currentIndex > 0) {
            const prevQ = filteredQuestions[currentIndex - 1];
            setViewerQuestion(prevQ);
            setActiveRowId(prevQ.id);
        }
    };

    const currentIdx = viewerQuestion ? filteredQuestions.findIndex((q: Question) => q.id === viewerQuestion.id) : 0;

    return (
        <div className="w-full bg-card rounded-xl overflow-hidden shadow-sm border border-border font-sans">
            {searchParams.get('debug') === 'true' && (
                <div className="bg-red-50 border-b border-red-200 text-red-800 p-6 text-xs font-mono space-y-2">
                    <p className="font-bold text-sm">DEVELOPER DEBUG INFO (url has ?debug=true):</p>
                    <p><strong>user.email:</strong> {user?.email || 'N/A'}</p>
                    <p><strong>user.selected_course_name:</strong> {user?.selected_course_name || 'N/A'}</p>
                    <p><strong>routeSubjectId:</strong> {routeSubjectId || 'N/A'}</p>
                    <p><strong>questionsResponse type:</strong> {typeof questionsResponse}</p>
                    <p><strong>questionsResponse isArray:</strong> {String(Array.isArray(questionsResponse))}</p>
                    <p><strong>questionsList length:</strong> {((Array.isArray(questionsResponse) ? questionsResponse : (questionsResponse?.results || [])) || []).length}</p>
                    <p><strong>first question details:</strong> {JSON.stringify((Array.isArray(questionsResponse) ? questionsResponse[0] : (questionsResponse?.results?.[0] || {})))}</p>
                </div>
            )}
            {/* Legend & Stats Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between px-4 md:px-6 py-4 bg-card border-b border-border gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <button className="px-5 py-2.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 hover:scale-105 transition-all">
                        MY PERFORMANCE
                    </button>
                    {!showSearch ? (
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-lg shadow-md hover:bg-primary/95 transition-colors"
                        >
                            <Search size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center bg-bg border border-border rounded-lg px-3 py-1 animate-in fade-in slide-in-from-left-4 duration-300">
                            <Search size={14} className="text-text-muted mr-2" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search questions..."
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-text-primary w-40 h-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="ml-2 text-text-muted hover:text-text-primary">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${
                            showFilters
                                ? 'bg-primary border-primary text-white shadow-md'
                                : 'bg-bg border-border text-text-muted hover:text-text-primary'
                        }`}
                        title="Toggle Filters"
                    >
                        <Filter size={16} />
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 sm:gap-8 w-full lg:w-auto">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[10px] font-black text-text-muted">
                        <span className="flex items-center gap-1.5 uppercase tracking-widest">
                            ( <Eye size={14} className="text-blue-500" /> READ
                        </span>
                        <span className="flex items-center gap-1.5 uppercase tracking-widest">
                            <span className="w-3.5 h-3.5 bg-teal-500 rounded-sm" /> NOTES
                        </span>
                        <span className="flex items-center gap-1.5 uppercase tracking-widest">
                            <Star size={14} className="text-amber-400 fill-amber-400" /> IMPORTANT )
                        </span>
                    </div>
                    <div className="text-[11px] font-black text-text-primary uppercase tracking-widest shrink-0">
                        TOTAL RECORDS : - <span className="text-2xl ml-2 align-middle">{filteredQuestions.length || 0}</span>
                    </div>
                </div>
            </div>

            {showFilters && (
                <div className="px-4 md:px-6 py-3 bg-bg border-b border-border flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Source Filter Selector */}
                    {uniqueSources.length > 0 && (
                        <select
                            value={selectedSource}
                            onChange={(e) => setSelectedSource(e.target.value)}
                            className="h-10 px-3 border border-border rounded-lg bg-card text-text-primary text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer w-full sm:w-auto"
                        >
                            <option value="all">All Sources</option>
                            {uniqueSources.map(src => (
                                <option key={src} value={src}>{src}</option>
                            ))}
                        </select>
                    )}

                    {/* Year Filter Selector */}
                    {uniqueYears.length > 0 && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="h-10 px-3 border border-border rounded-lg bg-card text-text-primary text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer w-full sm:w-auto"
                        >
                            <option value="all">All Years</option>
                            {uniqueYears.map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    )}

                    {/* Marks Filter Selector */}
                    {uniqueMarks.length > 0 && (
                        <select
                            value={selectedMarks}
                            onChange={(e) => setSelectedMarks(e.target.value)}
                            className="h-10 px-3 border border-border rounded-lg bg-card text-text-primary text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer w-full sm:w-auto"
                        >
                            <option value="all">All Marks</option>
                            {uniqueMarks.map(mrk => (
                                <option key={mrk} value={String(mrk)}>{mrk} Marks</option>
                            ))}
                        </select>
                    )}

                    {/* Reset Button */}
                    {(selectedSource !== 'all' || selectedYear !== 'all' || selectedMarks !== 'all') && (
                        <button
                            onClick={() => {
                                setSelectedSource('all');
                                setSelectedYear('all');
                                setSelectedMarks('all');
                            }}
                            className="h-10 px-4 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-black uppercase tracking-wider rounded-lg transition-colors w-full sm:w-auto"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            )}

            {/* Sub Navigation Bar */}
            {!hideTabs && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 md:px-6 py-3 bg-card border-b border-border gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <button className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-lg shadow-sm hover:bg-primary/90 transition-colors shrink-0">
                            <Home size={18} />
                        </button>
                        <button
                            onClick={() => setFilter('subjective')}
                            className={`px-4 sm:px-8 py-2 sm:py-2.5 text-xs font-black rounded-lg transition-all border ${
                                filter === 'subjective'
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/10'
                                    : 'bg-bg hover:bg-slate-100 text-text-secondary border-border shadow-sm'
                            }`}
                        >
                            Subjective
                        </button>
                        <button
                            onClick={() => setFilter('mcq')}
                            className={`px-4 sm:px-8 py-2 sm:py-2.5 text-xs font-black rounded-lg transition-all border ${
                                filter === 'mcq'
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/10'
                                    : 'bg-bg hover:bg-slate-100 text-text-secondary border-border shadow-sm'
                            }`}
                        >
                            MCQs
                        </button>
                        <button
                            onClick={() => setFilter('important')}
                            className={`px-4 sm:px-8 py-2 sm:py-2.5 text-xs font-black rounded-lg transition-all border ${
                                filter === 'important'
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/10'
                                    : 'bg-bg hover:bg-slate-100 text-text-secondary border-border shadow-sm'
                            }`}
                        >
                            Important
                        </button>
                    </div>

                    <button className="px-4 sm:px-8 py-2 sm:py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-lg uppercase tracking-widest shadow-md transition-all text-center sm:text-left shrink-0">
                        QUICK CONCEPTS
                    </button>
                </div>
            )}

            {/* Main Table */}
            <div className="overflow-x-auto overflow-y-hidden">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-[var(--table-header)] text-white border-b border-white/10">
                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 w-16 text-center">S.N.</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20">TOPIC</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20">SOURCE</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20">YEAR</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20">Q NO</th>
                            <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20">MARKS</th>
                            <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-center">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-text-muted font-bold text-xs uppercase tracking-widest">
                                    Loading Questions...
                                </td>
                            </tr>
                        )}
                        {!isLoading && filteredQuestions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-text-muted font-bold text-xs uppercase tracking-widest">
                                    No questions found for this category.
                                </td>
                            </tr>
                        )}
                        {filteredQuestions.map((q: Question, idx: number) => {
                            const isActive = q.id === activeRowId;
                            const isSavedOrImportant = isBookmarked(q.id);
                            const bookmarkId = getBookmarkId(q.id);

                            return (
                                <tr
                                    key={q.id}
                                    onClick={() => handleRowClick(q)}
                                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-[var(--table-header)] text-white' : 'hover:bg-[var(--table-hover)]'}`}
                                >
                                    <td className={`px-4 py-5 text-xs font-bold text-center border-r border-border ${isActive ? 'border-white/10' : ''}`}>{idx + 1}</td>
                                    <td className={`px-6 py-5 text-xs font-black border-r border-border ${isActive ? 'border-white/10' : ''}`}>{(q as any).topic_name || (q as any).icai_topic_name}</td>
                                    <td className={`px-6 py-5 text-[11px] font-bold border-r border-border ${isActive ? 'border-white/10' : ''}`}>{q.source}</td>
                                    <td className={`px-6 py-5 text-[11px] font-bold border-r border-border ${isActive ? 'border-white/10' : ''}`}>{q.year}</td>
                                    <td className={`px-6 py-5 text-[11px] font-black border-r border-border ${isActive ? 'border-white/10' : ''}`}>{q.q_no}</td>
                                    <td className={`px-8 py-5 text-xs font-black border-r border-border ${isActive ? 'border-white/10' : ''}`}>{q.marks}</td>
                                    <td className="px-8 py-5 text-center flex items-center justify-center gap-3">
                                        {isSavedOrImportant && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleBookmark.mutate({ qId: q.id, bookmarkId }); }}
                                                disabled={toggleBookmark.isPending}
                                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#fbbf24] hover:bg-[#f59e0b] text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-sm min-w-[110px] transition-colors"
                                            >
                                                <Star size={10} className="fill-white" />
                                                <span>Important</span>
                                            </button>
                                        )}
                                        <button
                                            className={`p-2 transition-transform hover:scale-125 ${isActive ? 'text-white' : 'text-text-muted'}`}
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Render locked rows if present */}
                        {!isLoading && (questionsResponse as any)?.locked_count > 0 && (
                            <tr className="bg-bg/25 border-t border-border opacity-70">
                                <td className="px-4 py-5 text-xs font-bold text-center border-r border-border text-text-muted">
                                    {filteredQuestions.length + 1}
                                </td>
                                <td className="px-6 py-5 text-xs font-black border-r border-border text-text-muted blur-[2px] select-none">
                                    •••••••• ••••••••
                                </td>
                                <td className="px-6 py-5 text-[11px] font-bold border-r border-border text-text-muted blur-[2px] select-none">
                                    ••••••••
                                </td>
                                <td className="px-6 py-5 text-[11px] font-bold border-r border-border text-text-muted blur-[2px] select-none">
                                    ••••
                                </td>
                                <td className="px-6 py-5 text-[11px] font-black border-r border-border text-text-muted blur-[2px] select-none">
                                    ••
                                </td>
                                <td className="px-8 py-5 text-xs font-black border-r border-border text-text-muted blur-[2px] select-none">
                                    ••
                                </td>
                                <td className="px-8 py-5 text-center flex items-center justify-center">
                                    <Link 
                                        to="/dashboard/subscription"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all scale-95 hover:scale-100"
                                    >
                                        <Lock size={12} />
                                        <span>Unlock {(questionsResponse as any)?.locked_count} More</span>
                                    </Link>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Embedded Modal for Full Work Mode Consistency */}
            <AnimatePresence>
                {isViewerOpen && viewerQuestion && (
                    <QuestionModal
                        isOpen={isViewerOpen}
                        onClose={() => setIsViewerOpen(false)}
                        question={viewerQuestion}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        currentIndex={currentIdx}
                        totalCount={filteredQuestions.length}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
