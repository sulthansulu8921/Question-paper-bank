import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
    Loader2, ArrowRight, Bookmark, BookmarkCheck,
    AlertCircle, Award, Clock, Flag, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MockTestSession() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<{ [qId: number]: number }>({});
    const [flaggedQuestions, setFlaggedQuestions] = useState<{ [qId: number]: boolean }>({});
    const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
    const [durationSeconds, setDurationSeconds] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

    const timerRef = useRef<any>(null);

    // Fetch session
    const { data: session, isLoading, error } = useQuery<any>({
        queryKey: ['mock-session', sessionId],
        queryFn: async () => (await api.get(`/materials/assessment-sessions/${sessionId}/`)).data,
        enabled: !!sessionId,
    });

    // Fetch bookmarks
    const { data: bookmarks = [] } = useQuery<any[]>({
        queryKey: ['bookmarks-list'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
    });

    // Initialize timer
    useEffect(() => {
        if (session && !session.is_completed && !isFinished) {
            // Read standard mock duration from localStorage, default to 60 mins
            const savedSecs = localStorage.getItem(`mock_duration_${sessionId}`);
            const totalSecs = savedSecs ? parseInt(savedSecs, 10) : 60 * 60;
            
            setTimeLeftSeconds(totalSecs);

            timerRef.current = setInterval(() => {
                setTimeLeftSeconds(prev => {
                    if (prev <= 1) {
                        // Time's up! Auto submit
                        clearInterval(timerRef.current!);
                        handleSubmitMock(true);
                        return 0;
                    }
                    return prev - 1;
                });
                setDurationSeconds(d => d + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session, isFinished]);

    // Bookmark mutations
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

    const handleSubmitMock = async (_autoSubmit = false) => {
        setIsSaving(true);
        if (timerRef.current) clearInterval(timerRef.current);
        setShowConfirmSubmit(false);

        try {
            const formattedAnswers = Object.keys(selectedOptions).map((qId) => ({
                question_id: parseInt(qId, 10),
                selected_option_id: selectedOptions[parseInt(qId, 10)]
            }));

            await api.post(`/materials/assessment-sessions/${sessionId}/submit/`, {
                answers: formattedAnswers,
                duration_seconds: durationSeconds
            });
            
            queryClient.invalidateQueries({ queryKey: ['mock-session', sessionId] });
            setIsFinished(true);
        } catch (err) {
            console.error('Failed to submit mock', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-sm font-semibold text-slate-500">Entering exam simulation environment...</p>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="max-w-md mx-auto my-12 bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl flex flex-col items-center gap-4 text-center">
                <AlertCircle size={40} className="text-red-500" />
                <div>
                    <h3 className="font-black text-sm">Failed to load mock session</h3>
                    <p className="text-xs mt-1 font-semibold leading-normal">
                        This session might have been completed or doesn't exist.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/mock')}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-colors"
                >
                    Back to Mocks
                </button>
            </div>
        );
    }

    const questions = session.answers || [];
    if (questions.length === 0) {
        return (
            <div className="max-w-md mx-auto my-12 text-center p-8 bg-card border border-border rounded-3xl space-y-4">
                <AlertCircle size={40} className="text-amber-500 mx-auto" />
                <h3 className="font-black text-slate-900">No mock questions found</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    No active questions found for the mock test criteria.
                </p>
                <button
                    onClick={() => navigate('/dashboard/mock')}
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
        marks: currentAnswerRecord.marks
    } as any : {} as any;

    // Formatting timer countdown
    const formatCountdown = (totalSecs: number) => {
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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

    const answeredCount = Object.keys(selectedOptions).length;

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            {/* Simulation Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        {session.title || 'Exam Mock Test'}
                    </h2>
                    <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wider mt-0.5">
                        EXAM SIMULATION IN PROGRESS
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-3.5 py-1.5 rounded-full text-xs font-black">
                        <Clock size={14} className="animate-pulse" />
                        <span>{formatCountdown(timeLeftSeconds)}</span>
                    </div>

                    <button
                        onClick={() => setShowConfirmSubmit(true)}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                    >
                        Submit Test
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!isFinished && !session.is_completed ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Questions Grid Sidebar */}
                        <div className="bg-card rounded-3xl p-5 border border-border shadow-sm space-y-4 h-fit">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-border pb-3">
                                Question Map
                            </h3>
                            <div className="grid grid-cols-5 gap-2">
                                {questions.map((qRec: any, idx: number) => {
                                    const qId = qRec.question.id;
                                    const isAnswered = selectedOptions[qId] !== undefined;
                                    const isFlagged = flaggedQuestions[qId] === true;
                                    const isCurrent = idx === currentIdx;

                                    let btnClass = 'bg-bg text-slate-500 border border-border';
                                    if (isAnswered) btnClass = 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10';
                                    if (isFlagged) btnClass = 'bg-amber-500 text-white border-amber-500';
                                    if (isCurrent) btnClass = 'ring-2 ring-indigo-500 ring-offset-2 ' + (isAnswered ? 'bg-indigo-600 text-white' : isFlagged ? 'bg-amber-500 text-white' : 'bg-bg text-indigo-600 border-indigo-600');

                                    return (
                                        <button
                                            key={qId}
                                            type="button"
                                            onClick={() => setCurrentIdx(idx)}
                                            className={`aspect-square rounded-xl text-xs font-bold transition-all flex items-center justify-center ${btnClass}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t border-border space-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded bg-indigo-600" />
                                    <span>Answered ({answeredCount})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded bg-amber-500" />
                                    <span>Flagged For Review</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded bg-bg border border-border" />
                                    <span>Unanswered ({questions.length - answeredCount})</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Question Panel */}
                        <div className="lg:col-span-3 space-y-6">
                            <motion.div
                                key={currentIdx}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black bg-slate-50 text-slate-600 px-2.5 py-1 rounded uppercase tracking-wider">
                                            {currentQuestion?.marks} Marks
                                        </span>
                                        <button
                                            onClick={() => setFlaggedQuestions({
                                                ...flaggedQuestions,
                                                [currentQuestion.id]: !flaggedQuestions[currentQuestion.id]
                                            })}
                                            className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded border transition-all ${
                                                flaggedQuestions[currentQuestion?.id]
                                                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                                                    : 'bg-bg hover:bg-slate-100 border-border text-text-muted'
                                            }`}
                                        >
                                            <Flag size={10} />
                                            <span>{flaggedQuestions[currentQuestion?.id] ? 'Flagged' : 'Flag for Review'}</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleToggleBookmark}
                                        className={`p-2 rounded-xl border transition-all ${
                                            isBookmarked 
                                                ? 'bg-amber-50 border-amber-200 text-amber-600'
                                                : 'bg-bg hover:bg-slate-100 border-border text-text-muted'
                                        }`}
                                    >
                                        {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                                    </button>
                                </div>

                                <div className="text-sm font-black text-slate-800 leading-relaxed white-space-pre-line">
                                    {currentQuestion?.question_text}
                                </div>

                                <div className="grid grid-cols-1 gap-3.5">
                                    {currentQuestion?.options?.map((opt: any) => {
                                        const isSelected = selectedOptions[currentQuestion.id] === opt.id;
                                        
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedOptions({
                                                        ...selectedOptions,
                                                        [currentQuestion.id]: opt.id
                                                    });
                                                }}
                                                className={`w-full p-4 rounded-2xl border text-left text-xs font-semibold leading-relaxed transition-all flex items-center justify-between ${
                                                    isSelected 
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/10'
                                                        : 'bg-bg hover:bg-slate-50 border-border text-slate-700'
                                                }`}
                                            >
                                                <span>{opt.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                                    <button
                                        type="button"
                                        disabled={currentIdx === 0}
                                        onClick={() => setCurrentIdx(prev => prev - 1)}
                                        className="px-5 py-2.5 rounded-xl border border-border bg-bg text-text-secondary hover:bg-slate-100 text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        Previous
                                    </button>

                                    {currentIdx < questions.length - 1 ? (
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
                                            onClick={() => setShowConfirmSubmit(true)}
                                            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                                        >
                                            <Award size={14} />
                                            <span>Finish Test</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                ) : (
                    // Mock test detailed results review
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card rounded-3xl p-8 border border-border shadow-sm text-center max-w-xl mx-auto space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center text-green-600 mx-auto">
                            <Award size={32} />
                        </div>

                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Mock Exam Submitted!</h2>
                            <p className="text-slate-500 font-semibold text-xs mt-1">
                                Your mock results have been evaluated under strict guidelines.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 bg-bg rounded-2xl p-5 border border-border">
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Score Obtained</p>
                                <p className="text-lg font-black text-text-primary mt-1">
                                    {session.score} / {session.max_score}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Accuracy</p>
                                <p className="text-lg font-black text-green-600 mt-1">
                                    {Math.round(session.accuracy)}%
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Duration</p>
                                <p className="text-lg font-black text-text-primary mt-1">
                                    {formatCountdown(session.duration_seconds || durationSeconds)}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                                onClick={() => navigate('/dashboard/mock')}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                            >
                                Back to Mock Dashboard
                            </button>
                            <button
                                onClick={() => navigate('/dashboard/analytics')}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border border-border"
                            >
                                View Performance Analytics
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Submit Dialog Modal */}
            <AnimatePresence>
                {showConfirmSubmit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card max-w-sm w-full rounded-3xl p-6 border border-border shadow-2xl text-center space-y-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                                <ShieldAlert size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Submit Mock Test?</h4>
                                <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1">
                                    You have completed {answeredCount} out of {questions.length} questions. Are you ready to submit your answers?
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowConfirmSubmit(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold bg-bg hover:bg-slate-100 text-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSubmitMock(false)}
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors"
                                >
                                    {isSaving ? 'Submitting...' : 'Yes, Submit'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
