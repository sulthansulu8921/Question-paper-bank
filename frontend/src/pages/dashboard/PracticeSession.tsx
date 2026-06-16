import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
    Loader2, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck,
    CheckCircle2, XCircle, AlertCircle, Award, Sparkles, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PracticeSession() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<{ [qId: number]: number }>({});
    const [submittedQuestions, setSubmittedQuestions] = useState<{ [qId: number]: boolean }>({});
    const [isSavingSession, setIsSavingSession] = useState(false);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    // Timer tracking
    const timerRef = useRef<any>(null);

    // Fetch the active practice session
    const { data: session, isLoading, error } = useQuery<any>({
        queryKey: ['practice-session', sessionId],
        queryFn: async () => (await api.get(`/materials/assessment-sessions/${sessionId}/`)).data,
        enabled: !!sessionId,
    });

    // Fetch user bookmarks to check bookmark status
    const { data: bookmarks = [] } = useQuery<any[]>({
        queryKey: ['bookmarks-list'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
    });

    // Start timer on mount
    useEffect(() => {
        if (session && !session.is_completed && !isFinished) {
            timerRef.current = setInterval(() => {
                setDurationSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session, isFinished]);

    // Mutations for bookmark toggles
    const addBookmarkMutation = useMutation({
        mutationFn: (qId: number) => api.post('/materials/bookmarks/', {
            material_id: qId,
            material_type: 'question'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks-list'] });
        }
    });

    const removeBookmarkMutation = useMutation({
        mutationFn: (bookmarkId: number) => api.delete(`/materials/bookmarks/${bookmarkId}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks-list'] });
        }
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-sm font-semibold text-slate-500">Initializing practice session...</p>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="max-w-md mx-auto my-12 bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl flex flex-col items-center gap-4 text-center">
                <AlertCircle size={40} className="text-red-500" />
                <div>
                    <h3 className="font-black text-sm">Failed to load session</h3>
                    <p className="text-xs mt-1 font-semibold leading-normal">
                        This session might have been completed or doesn't exist.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/practice')}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors hover:bg-red-700"
                >
                    Back to Practice
                </button>
            </div>
        );
    }

    const questions = session.answers || [];
    if (questions.length === 0) {
        return (
            <div className="max-w-md mx-auto my-12 text-center p-8 bg-card border border-border rounded-3xl space-y-4">
                <AlertCircle size={40} className="text-amber-500 mx-auto" />
                <h3 className="font-black text-slate-900">No questions found</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    This practice set contains no valid questions. Please try choosing a different chapter or subject.
                </p>
                <button
                    onClick={() => navigate('/dashboard/practice')}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                    Back
                </button>
            </div>
        );
    }

    const currentAnswerRecord = questions[currentIdx];
    const currentQuestion = currentAnswerRecord ? {
        id: currentAnswerRecord.question,
        question_text: currentAnswerRecord.question_text,
        options: currentAnswerRecord.options,
        marks: currentAnswerRecord.marks,
        difficulty: currentAnswerRecord.difficulty,
        explanation: currentAnswerRecord.explanation,
        related_concept: currentAnswerRecord.related_concept
    } as any : {} as any;
    const isLearningMode = session.mode === 'LEARNING';
    const isChallengeMode = session.mode === 'CHALLENGE';

    // Format timer
    const formatTime = (totalSecs: number) => {
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Bookmark helpers
    const currentBookmark = bookmarks.find(b => b.material_id === currentQuestion?.id && b.material_type === 'question');
    const isBookmarked = !!currentBookmark;

    const handleToggleBookmark = () => {
        if (!currentQuestion) return;
        if (isBookmarked) {
            removeBookmarkMutation.mutate(currentBookmark.id);
        } else {
            addBookmarkMutation.mutate(currentQuestion.id);
        }
    };

    // Submitting final answers
    const handleSubmitPractice = async () => {
        setIsSavingSession(true);
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            const formattedAnswers = Object.keys(selectedOptions).map((qId) => ({
                question_id: parseInt(qId, 10),
                selected_option_id: selectedOptions[parseInt(qId, 10)]
            }));

            await api.post(`/materials/assessment-sessions/${sessionId}/submit/`, {
                answers: formattedAnswers,
                duration_seconds: durationSeconds
            });
            
            // Reload query cache
            queryClient.invalidateQueries({ queryKey: ['practice-session', sessionId] });
            setIsFinished(true);
        } catch (err) {
            console.error('Failed to submit practice', err);
        } finally {
            setIsSavingSession(false);
        }
    };

    // Calculate accuracy and answers metrics
    const answeredCount = Object.keys(selectedOptions).length;

    return (
        <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
            {/* Header section with back link and timer */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <button
                    onClick={() => navigate('/dashboard/practice')}
                    className="flex items-center gap-2 text-xs font-black text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span>Exit Session</span>
                </button>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-black">
                        <Clock size={14} />
                        <span>{formatTime(durationSeconds)}</span>
                    </div>

                    <div className="text-xs text-text-secondary font-bold">
                        Question {currentIdx + 1} of {questions.length}
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
            </div>

            <AnimatePresence mode="wait">
                {!isFinished && !session.is_completed ? (
                    <motion.div
                        key={currentIdx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6"
                    >
                        {/* Question metadata */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-2.5 py-1 rounded uppercase tracking-wider ${
                                    currentQuestion?.difficulty === 'EASY' ? 'bg-green-50 text-green-700' :
                                    currentQuestion?.difficulty === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                }`}>
                                    {currentQuestion?.difficulty}
                                </span>
                                <span className="text-[9px] font-black bg-slate-50 text-slate-600 px-2.5 py-1 rounded uppercase tracking-wider">
                                    {currentQuestion?.marks} Marks
                                </span>
                            </div>

                            <button
                                onClick={handleToggleBookmark}
                                className={`p-2 rounded-xl border transition-all ${
                                    isBookmarked 
                                        ? 'bg-amber-50 border-amber-200 text-amber-600'
                                        : 'bg-bg hover:bg-slate-100 border-border text-text-muted'
                                }`}
                                title={isBookmarked ? 'Saved to Bookmarks' : 'Save to Bookmarks'}
                            >
                                {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                            </button>
                        </div>

                        {/* Question text */}
                        <div className="text-sm font-black text-slate-800 leading-relaxed white-space-pre-line">
                            {currentQuestion?.question_text}
                        </div>

                        {/* Options List */}
                        <div className="grid grid-cols-1 gap-3.5">
                            {currentQuestion?.options?.map((opt: any) => {
                                const isSelected = selectedOptions[currentQuestion.id] === opt.id;
                                const isSubmitted = submittedQuestions[currentQuestion.id] || session.is_completed;
                                
                                let optClass = 'bg-bg hover:bg-slate-50 border-border text-slate-700';
                                if (isSelected) {
                                    optClass = 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/10';
                                }

                                // Learning Mode coloring after submit
                                if (isLearningMode && isSubmitted) {
                                    if (opt.is_correct) {
                                        optClass = 'bg-green-50 border-green-300 text-green-800 ring-2 ring-green-500/10';
                                    } else if (isSelected) {
                                        optClass = 'bg-red-50 border-red-300 text-red-800 ring-2 ring-red-500/10';
                                    } else {
                                        optClass = 'bg-bg opacity-50 border-border text-slate-400';
                                    }
                                }

                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        disabled={isSubmitted}
                                        onClick={() => {
                                            setSelectedOptions({
                                                ...selectedOptions,
                                                [currentQuestion.id]: opt.id
                                            });
                                        }}
                                        className={`w-full p-4 rounded-2xl border text-left text-xs font-semibold leading-relaxed transition-all flex items-center justify-between ${optClass}`}
                                    >
                                        <span>{opt.text}</span>
                                        {isLearningMode && isSubmitted && opt.is_correct && (
                                            <CheckCircle2 size={16} className="text-green-600 shrink-0 ml-2" />
                                        )}
                                        {isLearningMode && isSubmitted && isSelected && !opt.is_correct && (
                                            <XCircle size={16} className="text-red-600 shrink-0 ml-2" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation block (Learning Mode only, visible after check) */}
                        {isLearningMode && submittedQuestions[currentQuestion.id] && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-indigo-50/30 rounded-2xl p-5 border border-indigo-100 space-y-4"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-indigo-600" />
                                    <h4 className="text-xs font-black text-slate-900">Key Explanation</h4>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                                    {currentQuestion?.explanation || currentQuestion?.correct_answer || 'No explanation recorded for this question.'}
                                </p>

                                {currentQuestion?.related_concept && (
                                    <div className="pt-4 border-t border-indigo-100 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-indigo-600" />
                                            <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Related Concept</h5>
                                        </div>
                                        <p className="text-xs text-indigo-950/80 leading-relaxed font-semibold">
                                            {currentQuestion.related_concept}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Actions footer */}
                        <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                            <button
                                type="button"
                                disabled={currentIdx === 0}
                                onClick={() => setCurrentIdx(prev => prev - 1)}
                                className="px-5 py-2.5 rounded-xl border border-border bg-bg text-text-secondary hover:bg-slate-100 text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none"
                            >
                                Previous
                            </button>

                            <div className="flex items-center gap-3">
                                {isLearningMode && !submittedQuestions[currentQuestion.id] ? (
                                    <button
                                        type="button"
                                        disabled={!selectedOptions[currentQuestion.id]}
                                        onClick={() => {
                                            setSubmittedQuestions({
                                                ...submittedQuestions,
                                                [currentQuestion.id]: true
                                            });
                                        }}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                                    >
                                        Check Answer
                                    </button>
                                ) : (
                                    currentIdx < questions.length - 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentIdx(prev => prev + 1)}
                                            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                                        >
                                            <span>Next Question</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={isSavingSession || (isChallengeMode && answeredCount === 0)}
                                            onClick={handleSubmitPractice}
                                            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                                        >
                                            {isSavingSession ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Award size={14} />
                                            )}
                                            <span>Finish Practice</span>
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // Session results view
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card rounded-3xl p-8 border border-border shadow-sm text-center max-w-xl mx-auto space-y-6"
                    >
                        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
                            <Award size={32} />
                        </div>

                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Practice Completed!</h2>
                            <p className="text-slate-500 font-semibold text-xs mt-1">
                                Great job! Here's a review of your practice performance.
                            </p>
                        </div>

                        {/* Performance metrics grid */}
                        <div className="grid grid-cols-3 gap-4 bg-bg rounded-2xl p-5 border border-border">
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Score</p>
                                <p className="text-lg font-black text-text-primary mt-1">
                                    {session.score} / {session.max_score}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Accuracy</p>
                                <p className="text-lg font-black text-indigo-600 mt-1">
                                    {Math.round(session.accuracy)}%
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Time Spent</p>
                                <p className="text-lg font-black text-text-primary mt-1">
                                    {formatTime(session.duration_seconds || durationSeconds)}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                                onClick={() => navigate('/dashboard/practice')}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                            >
                                Start New Practice
                            </button>
                            <button
                                onClick={() => {
                                    // Reset state to review questions
                                    setIsFinished(false);
                                    // Trigger query reload to show completed answers
                                    queryClient.invalidateQueries({ queryKey: ['practice-session', sessionId] });
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border border-border"
                            >
                                Review Questions
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
