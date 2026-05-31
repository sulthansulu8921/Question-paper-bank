import { useState, useMemo, useEffect } from 'react';
import { Eye, Home, Search, Star, X } from 'lucide-react';
import QuestionModal from './QuestionModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'react-router-dom';
import api from '@/api/axios';

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
    const { id: routeSubjectId } = useParams<{ id: string }>();
    const [activeRowId, setActiveRowId] = useState<number | null>(null);
    const [filter, setFilter] = useState<'subjective' | 'mcq' | 'important' | 'saved'>(defaultFilter);
    const [searchParams] = useSearchParams();

    // Read global search from Topbar
    const globalSearch = searchParams.get('search') || '';
    const [searchQuery, setSearchQuery] = useState(globalSearch);
    const [showSearch, setShowSearch] = useState(!!globalSearch);

    // Sync external search updates
    useEffect(() => {
        if (globalSearch) {
            setSearchQuery(globalSearch);
            setShowSearch(true);
        }
    }, [globalSearch]);

    // Fetch Questions
    const { data: questions = [], isLoading } = useQuery({
        queryKey: ['subjective-questions'],
        queryFn: async () => (await api.get('/materials/subjective-questions/')).data,
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

    const filteredQuestions = useMemo(() => {
        return questions.filter((q: any) => {
            // Filter by subject ID from the route parameter if present
            if (routeSubjectId && String(q.subject) !== String(routeSubjectId)) {
                return false;
            }

            const isBookmarkedRow = isBookmarked(q.id);
            const isStarred = q.is_important || isBookmarkedRow;

            let matchesType = true;
            if (filter === 'important') matchesType = isStarred;
            if (filter === 'saved') matchesType = isBookmarkedRow;
            if (filter === 'mcq') matchesType = q.question_type === 'MCQ';
            if (filter === 'subjective') matchesType = q.question_type !== 'MCQ';

            const searchStr = searchQuery.toLowerCase();
            const matchesSearch = (q.topic_name || '').toLowerCase().includes(searchStr) ||
                (q.source || '').toLowerCase().includes(searchStr) ||
                (q.q_no || '').toLowerCase().includes(searchStr);
            return matchesType && matchesSearch;
        });
    }, [questions, bookmarks, filter, searchQuery, routeSubjectId]);

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
        <div className="w-full bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 font-sans">
            {/* Legend & Stats Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <button className="px-5 py-2.5 bg-[#5C6BC0] text-white text-[11px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 hover:scale-105 transition-all">
                        MY PERFORMANCE
                    </button>
                    {!showSearch ? (
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-10 h-10 flex items-center justify-center bg-[#5C6BC0] text-white rounded-lg shadow-md hover:bg-[#4A59B0] transition-colors"
                        >
                            <Search size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 animate-in fade-in slide-in-from-left-4 duration-300">
                            <Search size={14} className="text-slate-400 mr-2" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search questions..."
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 w-40 h-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="ml-2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-5 text-[10px] font-black text-slate-500">
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
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                        TOTAL RECORDS : - <span className="text-2xl ml-2 align-middle">{filteredQuestions.length || 0}</span>
                    </div>
                </div>
            </div>

            {/* Sub Navigation Bar */}
            {!hideTabs && (
                <div className="flex flex-col md:flex-row items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100/50 dark:border-slate-800 gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
                        <button className="w-10 h-10 shrink-0 flex items-center justify-center bg-[#5C6BC0] dark:bg-indigo-900 text-white rounded-lg shadow-sm">
                            <Home size={18} />
                        </button>
                        <button
                            onClick={() => setFilter('subjective')}
                            className={`px-6 md:px-8 py-2.5 text-xs font-black rounded-lg transition-all border shrink-0 ${filter === 'subjective' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-slate-700 shadow-inner' : 'bg-[#5C6BC0] dark:bg-slate-800 text-white dark:text-slate-300 border-transparent shadow-sm hover:bg-[#4A59B0] dark:hover:bg-slate-700'}`}
                        >
                            Subjective
                        </button>
                        <button
                            onClick={() => setFilter('mcq')}
                            className={`px-6 md:px-8 py-2.5 text-xs font-black rounded-lg transition-all border shrink-0 ${filter === 'mcq' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-slate-700 shadow-inner' : 'bg-[#5C6BC0] dark:bg-slate-800 text-white dark:text-slate-300 border-transparent shadow-sm hover:bg-[#4A59B0] dark:hover:bg-slate-700'}`}
                        >
                            MCQs
                        </button>
                        <button
                            onClick={() => setFilter('important')}
                            className={`px-6 md:px-8 py-2.5 text-xs font-black rounded-lg transition-all border shrink-0 ${filter === 'important' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-slate-700 shadow-inner' : 'bg-[#5C6BC0] dark:bg-slate-800 text-white dark:text-slate-300 border-transparent shadow-sm hover:bg-[#4A59B0] dark:hover:bg-slate-700'}`}
                        >
                            Important
                        </button>
                    </div>

                    <button className="w-full md:w-auto px-8 py-2.5 bg-[#5C6BC0] dark:bg-indigo-600 text-white text-xs font-black rounded-lg uppercase tracking-widest shadow-md hover:bg-[#4A59B0] dark:hover:bg-indigo-500 transition-all shrink-0">
                        QUICK CONCEPTS
                    </button>
                </div>
            )}

            {/* Main Table */}
            <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-[#7986CB] dark:bg-slate-800 text-white border-b border-white/10 dark:border-slate-700/50">
                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700 w-16 text-center">S.N.</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700">TOPIC</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700">SOURCE</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700">YEAR</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700">Q NO</th>
                            <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest border-r border-white/20 dark:border-slate-700">MARKS</th>
                            <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-center">STATUS</th>
                        </tr>
                    </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {isLoading && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">
                                    Loading Questions...
                                </td>
                            </tr>
                        )}
                        {!isLoading && filteredQuestions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">
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
                                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-[#1E2B63] dark:bg-indigo-900/40 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:text-slate-300'}`}
                                >
                                    <td className={`px-4 py-5 text-xs font-bold text-center border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{idx + 1}</td>
                                    <td className={`px-6 py-5 text-xs font-black border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{q.topic_name}</td>
                                    <td className={`px-6 py-5 text-[11px] font-bold border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{q.source}</td>
                                    <td className={`px-6 py-5 text-[11px] font-bold border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{q.year}</td>
                                    <td className={`px-6 py-5 text-[11px] font-black border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{q.q_no}</td>
                                    <td className={`px-8 py-5 text-xs font-black border-r border-slate-100 dark:border-slate-800 ${isActive ? 'border-white/10 dark:border-indigo-800' : ''}`}>{q.marks}</td>
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
                                            className={`p-2 transition-transform hover:scale-125 ${isActive ? 'text-white' : 'text-slate-400'}`}
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Embedded Modal for Full Work Mode Consistency */}
            <QuestionModal
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                question={viewerQuestion}
                onNext={handleNext}
                onPrev={handlePrev}
                currentIndex={currentIdx}
                totalCount={filteredQuestions.length}
            />
        </div>
    );
}
