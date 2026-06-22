import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Star, ChevronLeft, ChevronRight, Copy, Send, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

// Helper to render a single parsed table object safely
const DynamicTable = ({ parsedTable }: { parsedTable: any }) => {
    if (!parsedTable || !parsedTable.headers || !parsedTable.rows || parsedTable.headers.length === 0) return null;

    return (
        <div className="bg-bg rounded-2xl border border-border shadow-sm overflow-hidden my-4">
            <div className="overflow-x-auto">
                <table className="w-full text-xs font-bold border-collapse">
                    <thead>
                        <tr className="bg-[var(--table-header)] text-white">
                            {parsedTable.headers.map((h: string, i: number) => (
                                <th key={i} className="px-4 py-3 text-left font-black uppercase tracking-wider border-r border-white/10 last:border-none">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {parsedTable.rows.map((row: string[], rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-[var(--table-hover)] transition-colors text-text-primary">
                                {row.map((cell: string, cIdx: number) => (
                                    <td key={cIdx} className="px-4 py-3 border-r border-border last:border-none">
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
};

const parseMultipleTables = (tableJson: string): any[] => {
    if (!tableJson) return [];
    try {
        const parsed = JSON.parse(tableJson);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (parsed.headers && parsed.rows) {
            return [{ ...parsed, type: parsed.type || 'normal' }];
        }
    } catch (e) {
        console.error("Failed to parse tables JSON", e);
    }
    return [];
};

const parseFormattingTags = (text: string): React.ReactNode => {
    if (!text) return '';
    const regex = /(\[\/?(?:B|U|CENTER)\])/i;
    const tokens = text.split(regex);
    
    const stack: { type: 'B' | 'U' | 'CENTER'; children: React.ReactNode[] }[] = [];
    let currentChildren: React.ReactNode[] = [];
    
    tokens.forEach((token, index) => {
        if (!token) return;
        const upperToken = token.toUpperCase();
        if (upperToken === '[B]') {
            stack.push({ type: 'B', children: currentChildren });
            currentChildren = [];
        } else if (upperToken === '[/B]') {
            if (stack.length > 0 && stack[stack.length - 1].type === 'B') {
                const element = <strong key={`b-${index}`}>{currentChildren}</strong>;
                const parent = stack.pop()!;
                currentChildren = parent.children;
                currentChildren.push(element);
            } else {
                currentChildren.push(token);
            }
        } else if (upperToken === '[U]') {
            stack.push({ type: 'U', children: currentChildren });
            currentChildren = [];
        } else if (upperToken === '[/U]') {
            if (stack.length > 0 && stack[stack.length - 1].type === 'U') {
                const element = <u key={`u-${index}`}>{currentChildren}</u>;
                const parent = stack.pop()!;
                currentChildren = parent.children;
                currentChildren.push(element);
            } else {
                currentChildren.push(token);
            }
        } else if (upperToken === '[CENTER]') {
            stack.push({ type: 'CENTER', children: currentChildren });
            currentChildren = [];
        } else if (upperToken === '[/CENTER]') {
            if (stack.length > 0 && stack[stack.length - 1].type === 'CENTER') {
                const element = <div key={`center-${index}`} className="text-center w-full my-1 inline-block">{currentChildren}</div>;
                const parent = stack.pop()!;
                currentChildren = parent.children;
                currentChildren.push(element);
            } else {
                currentChildren.push(token);
            }
        } else {
            currentChildren.push(token);
        }
    });
    
    while (stack.length > 0) {
        const parent = stack.pop()!;
        const type = parent.type;
        let element: React.ReactNode;
        if (type === 'B') {
            element = <strong>{currentChildren}</strong>;
        } else if (type === 'U') {
            element = <u>{currentChildren}</u>;
        } else {
            element = <div className="text-center w-full my-1 inline-block">{currentChildren}</div>;
        }
        currentChildren = parent.children;
        currentChildren.push(element);
    }
    
    return currentChildren;
};

const renderTextWithInlineTables = (text: string, tableJson: string) => {
    if (!text) return null;
    const tables = parseMultipleTables(tableJson);
    const cursorTables = tables.filter(t => t.type === 'cursor');
    
    // Fallback for legacy format: if no cursor tables explicitly defined, but tables exist and text has placeholders, treat them as cursor tables
    const activeCursorTables = cursorTables.length > 0 
        ? cursorTables 
        : (text.includes('[TABLE]') ? tables : []);

    if (activeCursorTables.length === 0 || !text.includes('[TABLE')) {
        return <div className="whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>{parseFormattingTags(text)}</div>;
    }

    const regex = /(\[TABLE(?:_\d+)?\])/g;
    const parts = text.split(regex);
    let generalCursorIndex = 0;

    return (
        <div className="whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
            {parts.map((part, index) => {
                if (part.startsWith('[TABLE')) {
                    let targetTable = null;
                    const match = part.match(/\[TABLE_(\d+)\]/);
                    if (match) {
                        const tableNum = parseInt(match[1], 10);
                        targetTable = activeCursorTables[tableNum - 1];
                    } else {
                        targetTable = activeCursorTables[generalCursorIndex];
                        generalCursorIndex++;
                    }
                    
                    if (targetTable) {
                        return <DynamicTable key={index} parsedTable={targetTable} />;
                    }
                    return null;
                } else {
                    return part ? <span key={index}>{parseFormattingTags(part)}</span> : null;
                }
            })}
        </div>
    );
};

const RenderNormalTables = ({ tableJson, text }: { tableJson: string; text: string }) => {
    const tables = parseMultipleTables(tableJson);
    const cursorTables = tables.filter(t => t.type === 'cursor');
    
    // Fallback for legacy format: if no cursor tables exist and text has [TABLE], they were treated as cursor tables.
    // So normal tables should be empty.
    const activeNormalTables = cursorTables.length > 0
        ? tables.filter(t => t.type !== 'cursor')
        : (text && text.includes('[TABLE]') ? [] : tables);

    return (
        <>
            {activeNormalTables.map((t, idx) => (
                <DynamicTable key={idx} parsedTable={t} />
            ))}
        </>
    );
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
    const navigate = useNavigate();
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
        if (question?.question_type === 'MCQ') {
            setTab('question');
            setIsSplitView(false);
        } else {
            setTab('both');
        }
    }, [question?.id, question?.question_type]);

    // Solved Question State Tracking
    const [isSolved, setIsSolved] = useState(false);

    useEffect(() => {
        if (!question?.id) return;
        const solvedStr = localStorage.getItem('qubook_solved_questions');
        const solvedList = solvedStr ? JSON.parse(solvedStr) : [];
        setIsSolved(solvedList.includes(question.id));
    }, [question?.id, isOpen]);

    const toggleSolved = () => {
        if (!question?.id) return;
        const solvedStr = localStorage.getItem('qubook_solved_questions');
        let solvedList = solvedStr ? JSON.parse(solvedStr) : [];
        let markedSolved = false;
        if (solvedList.includes(question.id)) {
            solvedList = solvedList.filter((id: any) => id !== question.id);
            setIsSolved(false);
        } else {
            solvedList.push(question.id);
            setIsSolved(true);
            markedSolved = true;
        }
        localStorage.setItem('qubook_solved_questions', JSON.stringify(solvedList));

        // Automatic Streak Logic: Mark today as active in study streak when a question is marked solved
        if (markedSolved) {
            const getDayIndex = (day: number) => day === 0 ? 6 : day - 1;
            const todayIdx = getDayIndex(new Date().getDay());
            const storedStreakDays = localStorage.getItem('qubook_streak_days');
            const storedStreakCount = localStorage.getItem('qubook_streak_count');
            
            let days = [true, true, true, true, false, false, false];
            let count = 12;
            if (storedStreakDays) {
                days = JSON.parse(storedStreakDays);
            }
            if (storedStreakCount) {
                count = parseInt(storedStreakCount, 10);
            }
            if (!days[todayIdx]) {
                days[todayIdx] = true;
                count += 1;
                localStorage.setItem('qubook_streak_days', JSON.stringify(days));
                localStorage.setItem('qubook_streak_count', count.toString());
            }
        }
        window.dispatchEvent(new Event('solvedQuestionsChanged'));
    };

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

    if (!question) return null;

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
                    className={`h-1.5 rounded-full transition-all duration-500 ${isActive ? 'w-8 bg-primary' : 'w-1.5 bg-border'}`}
                />
            );
        }
        return dots;
    };

    const handleOptionSelect = (idx: number) => {
        if (selectedOptionIdx !== null) return; // Answer locked once selected
        setSelectedOptionIdx(idx);

        // Auto mark solved if correct
        if (question?.options?.[idx]?.is_correct) {
            const solvedStr = localStorage.getItem('qubook_solved_questions');
            let solvedList = solvedStr ? JSON.parse(solvedStr) : [];
            if (!solvedList.includes(question.id)) {
                solvedList.push(question.id);
                localStorage.setItem('qubook_solved_questions', JSON.stringify(solvedList));
                setIsSolved(true);
                window.dispatchEvent(new Event('solvedQuestionsChanged'));
            }
        }
    };

    const handlePartOptionSelect = (partIdx: number, optIdx: number) => {
        if (partSelections[partIdx] !== undefined) return; // Locked
        setPartSelections(prev => ({ ...prev, [partIdx]: optIdx }));
    };

    const togglePartSolution = (partIdx: number) => {
        setRevealedPartSolutions(prev => ({ ...prev, [partIdx]: !prev[partIdx] }));
    };

    return (
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
                    className={`relative w-full ${isSplitView ? 'max-w-[98vw]' : 'max-w-5xl'} bg-card rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[96vh] transition-all duration-700 ease-in-out border border-border`}
                >
                    {/* Top Bar - Unified Professional Design */}
                    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:pl-10 md:pr-12 md:py-5 bg-card border-b border-border shrink-0">
                        <div className="flex items-center justify-between gap-3 w-full md:w-auto">
                            {/* Layout Toggle */}
                            {question.question_type !== 'MCQ' && (
                                <button
                                    onClick={() => setIsSplitView(!isSplitView)}
                                    className={`hidden md:flex w-12 h-12 rounded-2xl items-center justify-center transition-all duration-300 ${isSplitView ? 'bg-primary text-white shadow-xl rotate-90' : 'bg-bg text-text-muted hover:bg-bg-secondary hover:text-primary'}`}
                                    title="Split View Mode"
                                >
                                    <Copy size={22} className={isSplitView ? 'animate-pulse' : ''} />
                                </button>
                            )}

                            {/* Tab System - Glassmorphism style */}
                            {!isSplitView && (question.question_type !== 'MCQ' || selectedOptionIdx !== null) && (
                                <div className="flex bg-bg p-1 rounded-xl md:p-1.5 md:rounded-2xl border border-border w-full md:w-auto justify-around md:justify-start">
                                    {(['both', 'question', 'answer'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTab(t)}
                                            className={`flex-1 md:flex-none px-3 py-2 md:px-6 md:py-2 rounded-lg md:rounded-[14px] text-[10px] md:text-[11px] font-black uppercase transition-all duration-300 tracking-[0.1em] md:tracking-[0.2em] ${tab === t ? 'bg-primary text-white shadow-[0_8px_16px_rgba(0,0,0,0.08)]' : 'text-text-muted hover:text-text-primary'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Professional Header Icons */}
                        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3 w-full md:w-auto">
                            {!isSplitView && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleSolved}
                                        className={`flex items-center gap-2 p-3 md:px-4 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSolved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-bg text-text-muted hover:bg-bg-secondary hover:text-primary'}`}
                                        title="Mark Solved"
                                    >
                                        <CheckCircle2 size={14} />
                                        <span className="hidden lg:inline">{isSolved ? 'SOLVED' : 'MARK SOLVED'}</span>
                                    </button>
                                    <button
                                        onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                                        className={`flex items-center gap-2 p-3 md:px-4 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFeedbackInput ? 'bg-[#00BFA5] text-white shadow-lg shadow-teal-100' : 'bg-bg text-text-muted hover:bg-bg-secondary hover:text-primary'}`}
                                        title="Submit Feedback"
                                    >
                                        <MessageSquare size={14} />
                                        <span className="hidden lg:inline">FEEDBACK</span>
                                    </button>
                                    <button
                                        onClick={() => toggleBookmark.mutate()}
                                        className={`flex items-center gap-2 p-3 md:px-4 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isImportant ? 'bg-[#FFB300] text-white shadow-lg shadow-amber-100' : 'bg-bg text-text-muted hover:bg-bg-secondary hover:text-primary'}`}
                                        title="Mark Important"
                                    >
                                        <Star size={14} fill={isImportant ? "white" : "none"} />
                                        <span className="hidden lg:inline">IMPORTANT</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            onClose();
                                            navigate('/dashboard/assistant', { state: { question } });
                                        }}
                                        className="flex items-center gap-2 p-3 md:px-4 md:py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                        title="Ask AI Tutor"
                                    >
                                        <Sparkles size={14} />
                                        <span className="hidden lg:inline">ASK AI TUTOR</span>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-10 h-10 md:w-12 md:h-12 bg-bg border border-border rounded-xl md:rounded-2xl flex items-center justify-center text-text-primary hover:bg-bg-secondary hover:scale-110 active:scale-95 transition-all duration-300 group shrink-0 ml-auto md:ml-0"
                                title="Close"
                            >
                                <X size={20} strokeWidth={3} className="md:size-6 group-hover:rotate-90 transition-transform duration-500" />
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
                                className="absolute top-36 md:top-24 right-4 md:right-8 z-[110] w-[calc(100%-2rem)] md:w-80 bg-card rounded-3xl shadow-2xl border border-border p-6 space-y-4"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-text-primary uppercase tracking-widest">Share Feedback</h3>
                                    <button onClick={() => setShowFeedbackInput(false)} className="text-text-muted"><X size={16} /></button>
                                </div>
                                <textarea
                                    className="w-full h-32 bg-bg rounded-2xl p-4 text-sm font-medium border-none focus:ring-2 focus:ring-[#00BFA5]/20 placeholder-text-muted text-text-primary"
                                    placeholder="Tell us about this question..."
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                />
                                <button
                                    onClick={handleSubmitFeedback}
                                    disabled={!feedback || isSubmitted}
                                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isSubmitted ? 'bg-teal-500 text-white' : 'bg-primary hover:bg-primary-hover text-white'}`}
                                >
                                    {isSubmitted ? 'SUBMITTED!' : <><Send size={14} /> SUBMIT FEEDBACK</>}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Workspace */}
                    <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar ${isSplitView ? 'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 md:divide-x divide-border' : 'max-w-4xl mx-auto w-full'}`}>

                        {/* Question Column */}
                        {(isSplitView || tab === 'both' || tab === 'question') && (
                            <motion.div
                                key={`q-${question.id}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <div className={`inline-flex items-center gap-3 px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-wider ${question.question_type === 'CASE_SCENARIO' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                                        {question.question_type === 'CASE_SCENARIO' ? 'MCQ Case Scenario' : `${question.question_type} Question`}
                                    </div>
                                    <h2 className="text-2xl font-black text-text-primary tracking-tight leading-tight">
                                        Question {question.q_no || `ID #${question.id}`}
                                        <span className="ml-3 text-lg text-text-muted font-bold">(Marks: {question.marks || '1'})</span>
                                    </h2>
                                </div>

                                {/* Case Scenario Passage Context */}
                                {question.question_type === 'CASE_SCENARIO' && question.case_scenario_passage && (
                                    <div className="border-l-4 border-amber-500 bg-amber-500/10 rounded-r-2xl p-6 text-sm font-semibold text-text-primary leading-relaxed whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                                        <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider mb-2">Case Scenario Passage / Context</h4>
                                        {question.case_scenario_passage}
                                    </div>
                                )}

                                {/* Main Text and Media */}
                                {question.question_type !== 'CASE_SCENARIO' && (question.question_text || (!question.image_url && !question.pdf_url)) && (
                                    <div className="bg-bg border border-border rounded-2xl p-5 text-sm font-semibold text-text-primary leading-relaxed">
                                        {renderTextWithInlineTables(question.question_text || 'No question text provided.', question.table_data)}
                                    </div>
                                )}
                                
                                {question.image_url && (
                                    <div className="w-full mt-4 rounded-2xl overflow-hidden border border-border shadow-sm">
                                        <img src={question.image_url} alt="Question Media" className="w-full h-auto object-contain" />
                                    </div>
                                )}

                                {question.pdf_url && (
                                    <div className="w-full mt-4 flex items-center justify-center p-8 border-2 border-dashed border-border rounded-2xl">
                                        <a href={question.pdf_url} target="_blank" rel="noreferrer" className="px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform">
                                            View PDF Document
                                        </a>
                                    </div>
                                )}

                                {/* Main Table */}
                                <RenderNormalTables tableJson={question.table_data} text={question.question_text || ''} />

                                {/* MCQ Options (Top Level) */}
                                {question.question_type === 'MCQ' && question.options && question.options.length > 0 && (
                                    <div className="space-y-3 mt-6">
                                        <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Select your answer:</h3>
                                        <div className="grid gap-2">
                                            {question.options.map((opt: any, oIdx: number) => {
                                                const letter = String.fromCharCode(65 + oIdx);
                                                const isSelected = selectedOptionIdx === oIdx;
                                                const isCorrect = opt.is_correct;
                                                const isLocked = selectedOptionIdx !== null;
 
                                                let btnStyle = "bg-bg hover:bg-bg-secondary border-border text-text-secondary";
                                                if (isSelected) {
                                                    btnStyle = isCorrect
                                                        ? "bg-green-500 border-green-500 text-white shadow-md dark:shadow-none"
                                                        : "bg-red-500 border-red-500 text-white shadow-md dark:shadow-none";
                                                } else if (isLocked && isCorrect) {
                                                    btnStyle = "bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400";
                                                }
 
                                                return (
                                                    <button
                                                        key={oIdx}
                                                        disabled={isLocked}
                                                        onClick={() => handleOptionSelect(oIdx)}
                                                        className={`flex items-center gap-3 p-4 border rounded-2xl text-left text-xs font-bold transition-all ${btnStyle}`}
                                                    >
                                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-muted'}`}>
                                                            {letter}
                                                        </span>
                                                        <span className="flex-1">{parseFormattingTags(opt.text)}</span>
                                                        {isSelected && (
                                                            <span>
                                                                {isCorrect ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                                             </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Show Answer details below options if answered */}
                                        {selectedOptionIdx !== null && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-6 p-6 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 space-y-4 text-text-primary"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm">
                                                        Correct Answer
                                                    </span>
                                                    <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm ${
                                                        question.options[selectedOptionIdx].is_correct 
                                                            ? 'bg-green-600 text-white' 
                                                            : 'bg-red-600 text-white'
                                                    }`}>
                                                        {question.options[selectedOptionIdx].is_correct ? 'Correct' : 'Incorrect'}
                                                    </span>
                                                </div>
                                                <div className="text-emerald-800 dark:text-emerald-300 font-bold text-lg">
                                                    Option {String.fromCharCode(65 + question.options.findIndex((o: any) => o.is_correct))} - {parseFormattingTags(question.options.find((o: any) => o.is_correct)?.text)}
                                                </div>
                                                <div className="text-xs font-semibold text-text-secondary leading-relaxed pt-4 border-t border-emerald-500/20">
                                                    <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-2">Explanation:</div>
                                                    {renderTextWithInlineTables(
                                                        question.correct_answer || 'No additional explanation provided.',
                                                        question.answer_table_data
                                                    )}
                                                </div>
                                                <RenderNormalTables tableJson={question.answer_table_data} text={question.correct_answer || ''} />
                                            </motion.div>
                                        )}
                                    </div>
                                )}

                                {/* Sub-Questions (Parts) */}
                                {(question.question_type === 'MIXED' || question.question_type === 'CASE_SCENARIO') && question.parts && question.parts.length > 0 && (
                                    <div className="space-y-6 mt-8">
                                        <h3 className="text-xs font-black text-primary uppercase tracking-wider border-b border-border pb-2">Sub-Questions / Parts:</h3>
                                        {question.parts.map((part: any, pIdx: number) => {
                                            const keyId = part.id || pIdx;
                                            const isSelected = partSelections[keyId] !== undefined;
                                            const showPartSol = revealedPartSolutions[keyId];

                                            return (
                                                <div key={keyId} className="border border-border rounded-2xl p-5 bg-card space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded uppercase tracking-wider">
                                                            Part {part.identifier || `(${pIdx + 1})`}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-text-muted">{part.marks} Marks</span>
                                                    </div>

                                                    <div className="text-xs font-bold text-text-primary">
                                                        {renderTextWithInlineTables(part.question_text, part.table_data)}
                                                    </div>

                                                    <RenderNormalTables tableJson={part.table_data} text={part.question_text || ''} />

                                                    {/* Part MCQ */}
                                                    {part.question_type === 'MCQ' && part.options && part.options.length > 0 && (
                                                        <div className="grid gap-1.5 mt-2">
                                                            {part.options.map((pOpt: any, poIdx: number) => {
                                                                const letter = String.fromCharCode(65 + poIdx);
                                                                const isPartOptSelected = partSelections[keyId] === poIdx;
                                                                const isPartOptCorrect = pOpt.is_correct;
                                                                const isPartLocked = isSelected;

                                                                let partOptStyle = "bg-bg border-border text-text-secondary hover:bg-bg-secondary";
                                                                if (isPartOptSelected) {
                                                                    partOptStyle = isPartOptCorrect
                                                                        ? "bg-green-500 border-green-500 text-white"
                                                                        : "bg-red-500 border-red-500 text-white";
                                                                } else if (isPartLocked && isPartOptCorrect) {
                                                                    partOptStyle = "bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400";
                                                                }

                                                                return (
                                                                    <button
                                                                        key={poIdx}
                                                                        disabled={isPartLocked}
                                                                        onClick={() => handlePartOptionSelect(keyId, poIdx)}
                                                                        className={`flex items-center gap-2 p-2.5 border rounded-xl text-left text-xs font-bold transition-all ${partOptStyle}`}
                                                                    >
                                                                        <span className="text-[10px] font-black text-text-muted w-4">{letter}.</span>
                                                                        <span className="flex-1">{parseFormattingTags(pOpt.text)}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Part Solutions Toggles */}
                                                    <div className="border-t border-border pt-3 flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                            {isSelected || part.question_type === 'NORMAL' ? 'Answer Key Available' : 'Select Option to Unlock Solution'}
                                                        </span>
                                                        <button
                                                            onClick={() => togglePartSolution(keyId)}
                                                            className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:scale-105 transition-transform"
                                                        >
                                                            {showPartSol ? 'Hide Answer' : 'Reveal Answer'}
                                                        </button>
                                                    </div>

                                                    {showPartSol && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="bg-bg border border-border rounded-xl p-4 text-xs font-bold text-text-secondary italic space-y-2 mt-2"
                                                        >
                                                            <div className="text-[10px] font-black uppercase text-teal-600 tracking-wider">Suggested Solution:</div>
                                                            <div>
                                                                {renderTextWithInlineTables(part.correct_answer || 'No solution text provided.', part.answer_table_data)}
                                                            </div>
                                                            <RenderNormalTables tableJson={part.answer_table_data} text={part.correct_answer || ''} />
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
                        {(isSplitView || tab === 'both' || tab === 'answer') && (question.question_type !== 'MCQ' || selectedOptionIdx !== null) && (
                            <motion.div
                                key={`a-${question.id}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`space-y-6 ${isSplitView ? 'pl-10' : 'mt-12 pt-12 border-t-2 border-dashed border-border'}`}
                            >
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-3 px-3 py-1 bg-[#00BFA5] text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm">
                                        Proposed Solution
                                    </div>
                                    <h2 className="text-2xl font-black text-text-primary tracking-tight leading-tight">
                                        Answer Keys & Steps
                                    </h2>
                                </div>

                                {/* Answer Text */}
                                {question.question_type !== 'MIXED' && question.question_type !== 'CASE_SCENARIO' ? (
                                    <div className="space-y-6">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] p-6 text-sm font-semibold text-text-primary italic leading-relaxed">
                                            {question.question_type === 'MCQ' && question.options && question.options.some((o: any) => o.is_correct) && (
                                                <div className="mb-4 pb-4 border-b border-emerald-500/20 not-italic">
                                                    <span className="text-emerald-500 font-black uppercase tracking-wider block mb-1 text-xs">Correct Option</span>
                                                    <div className="text-emerald-400 font-bold text-lg">
                                                        {String.fromCharCode(65 + question.options.findIndex((o: any) => o.is_correct))} - {parseFormattingTags(question.options.find((o: any) => o.is_correct)?.text)}
                                                    </div>
                                                </div>
                                            )}
                                            {renderTextWithInlineTables(
                                                question.correct_answer || (question.question_type === 'MCQ' ? 'No additional explanation provided.' : 'No suggested answer or key is entered.'),
                                                question.answer_table_data
                                            )}
                                        </div>
                                        <RenderNormalTables tableJson={question.answer_table_data} text={question.correct_answer || ''} />
                                    </div>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-border rounded-3xl text-center text-xs font-bold text-text-muted italic">
                                        This question has multi-part sub-questions. Please use the individual 'Reveal Answer' toggles next to each part on the left to see part-by-part detailed solutions.
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Cinematic Control Bar */}
                    <div className="px-4 py-4 md:px-12 md:py-6 bg-card border-t border-border shrink-0">
                        <div className="flex items-center justify-between max-w-3xl mx-auto gap-3">
                            <button
                                onClick={onPrev}
                                className="group flex items-center gap-2 md:gap-3 px-4 py-3 md:px-6 md:py-4 bg-bg border-2 border-border text-primary text-[10px] md:text-xs font-black rounded-[14px] md:rounded-2xl hover:border-primary transition-all uppercase tracking-widest active:scale-95"
                            >
                                <ChevronLeft size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="hidden xs:inline">PREVIOUS</span>
                            </button>

                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black uppercase tracking-wider mb-1 text-text-muted">
                                    Record {currentIndex + 1} of {totalCount}
                                </span>
                                <div className="flex gap-1.5 items-center">
                                    {renderDots()}
                                </div>
                            </div>

                            <button
                                onClick={onNext}
                                className="group flex items-center gap-2 md:gap-3 px-4 py-3 md:px-6 md:py-4 bg-primary text-white text-[10px] md:text-xs font-black rounded-[14px] md:rounded-2xl shadow-[0_12px_24px_-6px_rgba(63,81,181,0.3)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                <span className="hidden xs:inline">NEXT</span>
                                <ChevronRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
    );
}
