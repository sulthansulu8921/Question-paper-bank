import { useState, useMemo, useEffect } from 'react';
import api from '@/api/axios';
import { 
    Sparkles, Compass, Loader2, Play, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';

export default function AIStudyPlanner() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);

    // Fetch active course details (levels and subjects)
    const { data: activeCourse } = useQuery<any>({
        queryKey: ['active-course-details', user?.selected_course],
        queryFn: async () => {
            if (!user?.selected_course) return null;
            return (await api.get(`/courses/courses/${user.selected_course}/`)).data;
        },
        enabled: !!user?.selected_course,
    });

    // Form states
    const [targetExam, setTargetExam] = useState('CA');
    const [examDate, setExamDate] = useState('2026-11-01');
    const [studyHours, setStudyHours] = useState(4);
    const [isGenerating, setIsGenerating] = useState(false);
    const [plan, setPlan] = useState<any[] | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isAiPowered, setIsAiPowered] = useState(false);

    // Map course name to correct target exam value
    useEffect(() => {
        if (activeCourse?.name) {
            const nameUpper = activeCourse.name.toUpperCase();
            if (nameUpper.includes('CHARTERED') || nameUpper.includes('CA ')) {
                setTargetExam('CA');
            } else if (nameUpper.includes('CMA') || nameUpper.includes('COST')) {
                setTargetExam('CMA');
            } else if (nameUpper.includes('CS ') || nameUpper.includes('SECRETARY')) {
                setTargetExam('CS');
            } else if (nameUpper.includes('ACCA')) {
                setTargetExam('ACCA');
            } else if (nameUpper.includes('NEET')) {
                setTargetExam('NEET');
            } else if (nameUpper.includes('JEE')) {
                setTargetExam('JEE');
            } else if (nameUpper.includes('UPSC') || nameUpper.includes('CIVIL')) {
                setTargetExam('UPSC');
            } else if (nameUpper.includes('BANK') || nameUpper.includes('IBPS')) {
                setTargetExam('BANKING');
            }
        }
    }, [activeCourse]);

    const examMap: { [key: string]: string } = {
        'CA': 'Chartered Accountant (CA)',
        'CMA': 'Cost & Management Accountant (CMA)',
        'CS': 'Company Secretary (CS)',
        'ACCA': 'ACCA Global',
        'NEET': 'NEET (UG)',
        'JEE': 'JEE (Mains/Adv)',
        'UPSC': 'UPSC Civil Services',
        'BANKING': 'Banking / IBPS'
    };

    // Calculate days remaining
    const daysRemaining = useMemo(() => {
        if (!examDate) return 0;
        const diff = new Date(examDate).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }, [examDate]);

    // Generator handler invoking backend endpoint
    const handleGeneratePlan = async () => {
        setIsGenerating(true);
        setErrorMsg('');
        try {
            const res = await api.post('/materials/assessment-sessions/generate-planner/', {
                target_exam: targetExam,
                exam_date: examDate,
                study_hours: studyHours
            });
            setPlan(res.data.plan);
            setIsAiPowered(res.data.real_time_ai);
        } catch (err: any) {
            console.error(err);
            setErrorMsg('Failed to generate plan. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartTaskAction = async (task: any) => {
        if (task.type === 'PRACTICE' && task.weaknessData) {
            // Auto generate practice session for this weakness
            try {
                const payload = {
                    session_type: 'PRACTICE',
                    title: `Planner Practice: ${task.weaknessData.topic}`,
                    qualification: task.weaknessData.qualification,
                    course_level: task.weaknessData.course_level,
                    subject: task.weaknessData.subject,
                    chapter: task.weaknessData.chapter,
                    topic: task.weaknessData.topic,
                    total_questions: 20,
                    difficulty: 'MIXED',
                    mode: 'LEARNING'
                };
                const res = await api.post('/materials/assessment-sessions/', payload);
                navigate(`/dashboard/practice/session/${res.data.id}`);
            } catch (err) {
                console.error(err);
            }
        } else if (task.type === 'MOCK') {
            navigate('/dashboard/mock');
        } else {
            navigate('/dashboard/practice');
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 min-h-[85vh]">
            {/* Header */}
            <div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                    Smart Study Assistant
                </span>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-3">AI Study Planner</h1>
                <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm mt-1">
                    Get a personalized study calendar based on your countdown goals and weakness profile.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration form */}
                <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6 h-fit">
                    <h2 className="text-md font-black text-slate-900 dark:text-white flex items-center gap-2.5 pb-4 border-b border-border">
                        <Compass className="text-primary" size={20} />
                        <span>Syllabus & Timeline</span>
                    </h2>

                    {/* Target Exam */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Exam / Stream</label>
                        {user?.selected_course ? (
                            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Your Active Program</span>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                                        {activeCourse?.name || user?.selected_course_name || examMap[targetExam] || 'Chartered Accountant (CA)'}
                                    </h3>
                                </div>
                                <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full uppercase tracking-wider shrink-0">
                                    {targetExam}
                                </span>
                            </div>
                        ) : (
                            <select
                                value={targetExam}
                                onChange={(e) => setTargetExam(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none bg-slate-50/50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
                            >
                                <option value="CA">Chartered Accountant (CA)</option>
                                <option value="CMA">Cost & Management Accountant (CMA)</option>
                                <option value="CS">Company Secretary (CS)</option>
                                <option value="ACCA">ACCA Global</option>
                                <option value="NEET">NEET (UG)</option>
                                <option value="JEE">JEE (Mains/Adv)</option>
                                <option value="UPSC">UPSC Civil Services</option>
                                <option value="BANKING">Banking / IBPS</option>
                            </select>
                        )}
                    </div>

                    {/* Target Date */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Exam Target Date</label>
                        <input
                            type="date"
                            value={examDate}
                            onChange={(e) => setExamDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-bg text-text-primary text-xs font-bold focus:outline-none"
                        />
                    </div>

                    {/* Target hours per day */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Daily Study Goal (Hours)</label>
                        <input
                            type="number"
                            min="1"
                            max="16"
                            value={studyHours}
                            onChange={(e) => setStudyHours(parseInt(e.target.value, 10) || 4)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-bg text-text-primary text-xs font-bold focus:outline-none"
                        />
                    </div>

                    {daysRemaining > 0 && (
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 text-center">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest block">Countdown</span>
                            <span className="text-xl font-black text-primary mt-1 block">{daysRemaining} Days Left</span>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 text-[11px] font-bold p-3.5 rounded-2xl border border-red-100 flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <button
                        onClick={handleGeneratePlan}
                        disabled={isGenerating}
                        className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                <span>Generating Plan...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                <span>Generate Weekly Plan</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Generated Plan Output Pane */}
                <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                        {!plan ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-card rounded-3xl p-8 border border-border border-dashed text-center flex flex-col items-center justify-center min-h-[40vh] space-y-4"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                    <Sparkles size={24} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">Plan Generator Standby</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-sm leading-relaxed">
                                    Select your exam parameters and click the button to map out a personalized 7-day study plan that focuses on your weakness profile.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Your 7-Day Personalized Schedule:
                                    </h3>
                                    {isAiPowered ? (
                                        <span className="flex items-center gap-1.5 text-[9px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 uppercase tracking-wider">
                                            <Sparkles size={10} className="animate-pulse" />
                                            <span>AI-Generated (Gemini)</span>
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                            Standard Dynamic Schedule
                                        </span>
                                    )}
                                </div>

                                {plan.map((task: any, idx: number) => (
                                    <div 
                                        key={idx}
                                        className="bg-card rounded-2xl p-5 border border-border hover:shadow-sm transition-all flex items-start justify-between gap-6"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                    {task.day}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded">
                                                    {task.duration} Target
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded">
                                                    {task.type}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white pt-0.5">
                                                {task.title}
                                            </h4>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                                                {task.description}
                                            </p>
                                            <div className="text-[9px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-wider pt-1 flex items-center gap-1">
                                                <span>Focus:</span>
                                                <span className="text-primary">{task.focus}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleStartTaskAction(task)}
                                            className="p-2.5 rounded-xl border border-border bg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-primary transition-colors shrink-0"
                                            title="Launch Session"
                                        >
                                            <Play size={14} />
                                        </button>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
