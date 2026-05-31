import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Star, ChevronLeft, ChevronRight, Copy, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

interface QuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    question: any;
    onNext?: () => void;
    onPrev?: () => void;
    currentIndex?: number;
    totalCount?: number;
}

// Helper to render JSON table data safely
const DynamicTable = ({ tableJson, title }: { tableJson: string; title: string }) => {
    if (!tableJson) return null;
    try {
        const parsed = JSON.parse(tableJson);
        if (!parsed.headers || !parsed.rows || parsed.headers.length === 0) return null;

        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden my-4">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {title}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-bold border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                {parsed.headers.map((h: string, i: number) => (
                                    <th key={i} className="px-4 py-3 text-left font-black uppercase tracking-wider border-r border-white/10 last:border-none">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {parsed.rows.map((row: string[], rIdx: number) => (
                                <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                                    {row.map((cell: string, cIdx: number) => (
                                        <td key={cIdx} className="px-4 py-3 text-slate-600 border-r border-slate-100 last:border-none">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    } catch (e) {
        console.error("Failed to parse table JSON in modal", e);
        return null;
    }
};

export default function QuestionModal({
    isOpen,
    onClose,
    question,
    onNext,
    onPrev,
    currentIndex = 0,
    totalCount = 1
}: QuestionModalProps) {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'both' | 'question' | 'answer'>('both');
    const [isSplitView, setIsSplitView] = useState(false);
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Interactive MCQ selection states
    const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
    const [partSelections, setPartSelections] = useState<Record<number, number>>({});
    const [revealedPartSolutions, setRevealedPartSolutions] = useState<Record<number, boolean>>({});

    // Reset interaction states when question changes
    useEffect(() => {
        setSelectedOptionIdx(null);
        setPartSelections({});
        setRevealedPartSolutions({});
    }, [question?.id]);

    // Fetch Bookmarks
    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
        enabled: isOpen, // Only fetch when modal is open
    });

    // Check if the current question is bookmarked by the user
    const currentBookmark = bookmarks.find((b: any) => b.material_id === question?.id && b.material_type === 'SubjectiveQuestion');
    const toggleBookmark = useMutation({
        mutationFn: async () => {
            if (currentBookmark) {
                // Remove bookmark if it exists
                await api.delete(`/materials/bookmarks/${currentBookmark.id}/`);
            } else {
                // Add bookmark if it doesn't exist
                await api.post('/materials/bookmarks/', {
                    material_id: question.id,
                    material_type: 'SubjectiveQuestion'
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    const isImportant = toggleBookmark.isPending ? !currentBookmark : !!currentBookmark;

    const submitFeedback = useMutation({
        mutationFn: async (message: string) => {
            await api.post('/materials/feedback/', {
                material_id: question.id,
                material_type: 'SubjectiveQuestion',
                message: message
            });
        },
        onSuccess: () => {
            setIsSubmitted(true);
            setTimeout(() => {
                setShowFeedbackInput(false);
                setIsSubmitted(false);
                setFeedback('');
            }, 2000);
        }
    });

    if (!isOpen || !question) return null;

    const handleSubmitFeedback = () => {
        if (feedback.trim()) submitFeedback.mutate(feedback);
    };

    // Calculate dynamic dots (limited to 5 for clean UI)
    const renderDots = () => {
        const dots = [];
        const maxDots = Math.min(totalCount, 5);
        for (let i = 0; i < maxDots; i++) {
            const isActive = i === (currentIndex % maxDots);
            dots.push(
                <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${isActive ? 'w-8 bg-[#3F51B5]' : 'w-1.5 bg-slate-200'}`}
                />
            );
        }
        return dots;
    };

    const handleOptionSelect = (idx: number) => {
        if (selectedOptionIdx !== null) return; // Answer locked once selected
        setSelectedOptionIdx(idx);
    };

    const handlePartOptionSelect = (partIdx: number, optIdx: number) => {
        if (partSelections[partIdx] !== undefined) return; // Locked
        setPartSelections(prev => ({ ...prev, [partIdx]: optIdx }));
    };

    const togglePartSolution = (partIdx: number) => {
        setRevealedPartSolutions(prev => ({ ...prev, [partIdx]: !prev[partIdx] }));
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Cinematic Glass Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-[#0F172A]/80 backdrop-blur-md"
                />

                {/* Modal Container - Premium Elevation */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 30 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={`relative w-full ${isSplitView ? 'max-w-[98vw]' : 'max-w-5xl'} bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[96vh] transition-colors duration-500 ease-in-out border border-white/20 dark:border-slate-800`}
                >
                    {/* Top Bar - Unified Professional Design */}
                    <div className="flex items-center justify-between px-4 md:px-8 py-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-100 dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-6">
                            {/* Layout Toggle */}
                            <button
                                onClick={() => setIsSplitView(!isSplitView)}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isSplitView ? 'bg-[#3F51B5] text-white shadow-xl rotate-90' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                title="Split View Mode"
                            >
                                <Copy size={22} className={isSplitView ? 'animate-pulse' : ''} />
                            </button>

                            {/* Tab System - Glassmorphism style */}
                            {!isSplitView && (
                                <div className="flex flex-wrap md:flex-nowrap bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                                    {(['both', 'question', 'answer'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTab(t)}
                                            className={`px-4 md:px-10 py-2 md:py-3 rounded-[14px] text-[10px] md:text-[11px] font-black uppercase transition-all duration-300 tracking-[0.2em] ${tab === t ? 'bg-white dark:bg-slate-700 text-[#3F51B5] dark:text-blue-400 shadow-[0_8px_16px_rgba(0,0,0,0.08)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Professional Header Icons */}
                        <div className="flex items-center gap-4">
                            {!isSplitView && (
                                <div className="hidden md:flex items-center gap-3 mr-4">
                                    <button
                                        onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFeedbackInput ? 'bg-[#00BFA5] text-white shadow-lg shadow-teal-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        <MessageSquare size={14} /> FEEDBACK
                                    </button>
                                    <button
                                        onClick={() => toggleBookmark.mutate()}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isImportant ? 'bg-[#FFB300] text-white shadow-lg shadow-amber-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        <Star size={14} fill={isImportant ? "white" : "none"} /> IMPORTANT
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 group"
                            >
                                <X size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                        </div>
                    </div>

                    {/* Feedback Input Overlay */}
                    <AnimatePresence>
                        {showFeedbackInput && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="absolute top-24 right-8 z-[110] w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Share Feedback</h3>
                                    <button onClick={() => setShowFeedbackInput(false)} className="text-slate-400"><X size={16} /></button>
                                </div>
                                <textarea
                                    className="w-full h-32 bg-slate-50 rounded-2xl p-4 text-sm font-medium border-none focus:ring-2 focus:ring-[#00BFA5]/20 placeholder-slate-300"
                                    placeholder="Tell us about this question..."
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                />
                                <button
                                    onClick={handleSubmitFeedback}
                                    disabled={!feedback || isSubmitted}
                                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isSubmitted ? 'bg-teal-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                >
                                    {isSubmitted ? 'SUBMITTED!' : <><Send size={14} /> SUBMIT FEEDBACK</>}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Workspace */}
                    <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar ${isSplitView ? 'flex flex-col lg:grid lg:grid-cols-2 gap-10 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800' : 'max-w-4xl mx-auto w-full'}`}>
                        
                        {/* Question Column */}
                        {(isSplitView || tab === 'both' || tab === 'question') && (
                            <motion.div
                                key={`q-${question.id}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-3 px-3 py-1 bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] font-black rounded-full uppercase tracking-wider">
                                        {question.question_type} Question
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-black text-[#1A237E] dark:text-blue-300 tracking-tight leading-tight">
                                        Question {question.q_no || `ID #${question.id}`}
                                        <span className="ml-3 text-base md:text-lg text-slate-400 dark:text-slate-500 font-bold">(Marks: {question.marks || '1'})</span>
                                    </h2>
                                </div>

                                {/* Main Text */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 md:p-5 text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed white-space-pre-wrap">
                                    {question.question_text || 'No question text provided.'}
                                </div>

                                {/* Main Table */}
                                <DynamicTable tableJson={question.table_data} title="Question Data Table" />

                                {/* MCQ Options (Top Level) */}
                                {question.question_type === 'MCQ' && question.options && question.options.length > 0 && (
                                    <div className="space-y-3 mt-6">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Select your answer:</h3>
                                        <div className="grid gap-2">
                                            {question.options.map((opt: any, oIdx: number) => {
                                                const letter = String.fromCharCode(65 + oIdx);
                                                const isSelected = selectedOptionIdx === oIdx;
                                                const isCorrect = opt.is_correct;
                                                const isLocked = selectedOptionIdx !== null;

                                                let btnStyle = "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700";
                                                if (isSelected) {
                                                    btnStyle = isCorrect
                                                        ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-100"
                                                        : "bg-red-500 border-red-500 text-white shadow-md shadow-red-100";
                                                } else if (isLocked && isCorrect) {
                                                    btnStyle = "bg-green-100 border-green-300 text-green-800";
                                                }

                                                return (
                                                    <button
                                                        key={oIdx}
                                                        disabled={isLocked}
                                                        onClick={() => handleOptionSelect(oIdx)}
                                                        className={`flex items-center gap-3 p-4 border rounded-2xl text-left text-xs font-bold transition-all ${btnStyle}`}
                                                    >
                                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                            {letter}
                                                        </span>
                                                        <span className="flex-1">{opt.text}</span>
                                                        {isSelected && (
                                                            <span>
                                                                {isCorrect ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sub-Questions (Parts) */}
                                {question.question_type === 'MIXED' && question.parts && question.parts.length > 0 && (
                                    <div className="space-y-6 mt-8">
                                        <h3 className="text-xs font-black text-[#1A237E] uppercase tracking-wider border-b border-slate-100 pb-2">Sub-Questions / Parts:</h3>
                                        {question.parts.map((part: any, pIdx: number) => {
                                            const isSelected = partSelections[part.id] !== undefined;
                                            const showPartSol = revealedPartSolutions[part.id];

                                            return (
                                                <div key={part.id || pIdx} className="border border-slate-200/60 rounded-2xl p-5 bg-white space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded uppercase tracking-wider">
                                                            Part {part.identifier || `(${pIdx + 1})`}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">{part.marks} Marks</span>
                                                    </div>

                                                    <p className="text-xs font-bold text-slate-700">{part.question_text}</p>

                                                    <DynamicTable tableJson={part.table_data} title={`Part ${part.identifier} Table`} />

                                                    {/* Part MCQ */}
                                                    {part.question_type === 'MCQ' && part.options && part.options.length > 0 && (
                                                        <div className="grid gap-1.5 mt-2">
                                                            {part.options.map((pOpt: any, poIdx: number) => {
                                                                const letter = String.fromCharCode(65 + poIdx);
                                                                const isPartOptSelected = partSelections[part.id] === poIdx;
                                                                const isPartOptCorrect = pOpt.is_correct;
                                                                const isPartLocked = isSelected;

                                                                let partOptStyle = "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100";
                                                                if (isPartOptSelected) {
                                                                    partOptStyle = isPartOptCorrect
                                                                        ? "bg-green-500 border-green-500 text-white"
                                                                        : "bg-red-500 border-red-500 text-white";
                                                                } else if (isPartLocked && isPartOptCorrect) {
                                                                    partOptStyle = "bg-green-100 border-green-300 text-green-800";
                                                                }

                                                                return (
                                                                    <button
                                                                        key={poIdx}
                                                                        disabled={isPartLocked}
                                                                        onClick={() => handlePartOptionSelect(part.id, poIdx)}
                                                                        className={`flex items-center gap-2 p-2.5 border rounded-xl text-left text-xs font-bold transition-all ${partOptStyle}`}
                                                                    >
                                                                        <span className="text-[10px] font-black text-slate-400 w-4">{letter}.</span>
                                                                        <span className="flex-1">{pOpt.text}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Part Solutions Toggles */}
                                                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            {isSelected || part.question_type === 'NORMAL' ? 'Answer Key Available' : 'Select Option to Unlock Solution'}
                                                        </span>
                                                        <button
                                                            onClick={() => togglePartSolution(part.id)}
                                                            className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:scale-105 transition-transform"
                                                        >
                                                            {showPartSol ? 'Hide Answer' : 'Reveal Answer'}
                                                        </button>
                                                    </div>

                                                    {showPartSol && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-bold text-slate-600 italic space-y-2 mt-2"
                                                        >
                                                            <div className="text-[10px] font-black uppercase text-teal-600 tracking-wider">Suggested Solution:</div>
                                                            <div className="white-space-pre-wrap">{part.correct_answer || 'No solution text provided.'}</div>
                                                            <DynamicTable tableJson={part.answer_table_data} title={`Part ${part.identifier} Solution Table`} />
                                                        </motion.div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Answer Column */}
                        {(isSplitView || tab === 'both' || tab === 'answer') && (
                            <motion.div
                                key={`a-${question.id}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`space-y-6 ${isSplitView ? 'pl-10' : 'mt-12 pt-12 border-t-2 border-dashed border-slate-100'}`}
                            >
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-3 px-3 py-1 bg-[#00BFA5] text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm">
                                        Proposed Solution
                                    </div>
                                    <h2 className="text-2xl font-black text-[#1A237E] tracking-tight leading-tight">
                                        Answer Keys & Steps
                                    </h2>
                                </div>

                                {/* Answer Text */}
                                {question.question_type !== 'MIXED' ? (
                                    <div className="space-y-6">
                                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[24px] p-6 text-sm font-semibold text-slate-600 italic white-space-pre-wrap leading-relaxed">
                                            {question.question_type === 'MCQ' && question.options && question.options.some((o: any) => o.is_correct) && (
                                                <div className="mb-4 pb-4 border-b border-emerald-200/60 not-italic">
                                                    <span className="text-emerald-700 font-black uppercase tracking-wider block mb-1 text-xs">Correct Option</span>
                                                    <div className="text-emerald-900 font-bold text-lg">
                                                        {String.fromCharCode(65 + question.options.findIndex((o: any) => o.is_correct))} - {question.options.find((o: any) => o.is_correct)?.text}
                                                    </div>
                                                </div>
                                            )}
                                            {question.correct_answer || (question.question_type === 'MCQ' ? 'No additional explanation provided.' : 'No suggested answer or key is entered.')}
                                        </div>
                                        {question.answer_table_data && <DynamicTable tableJson={question.answer_table_data} title="Answer Details Table" />}
                                    </div>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl text-center text-xs font-bold text-slate-400 italic">
                                        This question has multi-part sub-questions. Please use the individual 'Reveal Answer' toggles next to each part on the left to see part-by-part detailed solutions.
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Cinematic Control Bar */}
                    <div className="px-12 py-6 bg-gradient-to-t from-slate-50 to-white border-t border-slate-100 shrink-0">
                        <div className="flex items-center justify-between max-w-3xl mx-auto">
                            <button
                                onClick={onPrev}
                                className="group flex items-center gap-3 px-6 py-4 bg-white border-2 border-slate-100 text-[#3F51B5] text-xs font-black rounded-2xl hover:border-[#3F51B5] hover:bg-[#3F51B5]/5 transition-all uppercase tracking-widest active:scale-95"
                            >
                                <ChevronLeft size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                                PREVIOUS
                            </button>

                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black uppercase tracking-wider mb-1 text-slate-300">
                                    Record {currentIndex + 1} of {totalCount}
                                </span>
                                <div className="flex gap-1.5 items-center">
                                    {renderDots()}
                                </div>
                            </div>

                            <button
                                onClick={onNext}
                                className="group flex items-center gap-3 px-6 py-4 bg-[#3F51B5] text-white text-xs font-black rounded-2xl shadow-[0_12px_24px_-6px_rgba(63,81,181,0.3)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                NEXT
                                <ChevronRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
