import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    BookOpen, FileSearch, Bookmark, ArrowRight, Zap, 
    Clock, GraduationCap, Loader2, Flame, Coins, Award, 
    Sparkles, Plus, Calendar, ListTodo, CheckCircle2, ChevronRight,
    Trophy, Trash2, Lock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import QuestionModal from '@/components/dashboard/QuestionModal';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useAuthStore } from '@/store/useAuthStore';


export default function DashboardHome() {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // Form inputs for widgets
    const [showExamForm, setShowExamForm] = useState(false);
    const [examTitle, setExamTitle] = useState('');
    const [examDate, setExamDate] = useState('');

    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
    const [assignmentTitle, setAssignmentTitle] = useState('');
    const [assignmentDueDate, setAssignmentDueDate] = useState('');

    const [showMockForm, setShowMockForm] = useState(false);
    const [mockTitle, setMockTitle] = useState('');
    const [mockScore, setMockScore] = useState('');
    const [mockTotal, setMockTotal] = useState('');
    const [mockDate, setMockDate] = useState('');

    // Load states & actions from Zustand Dashboard Store
    const {
        stats, streak, quote, exams, assignments, mockTests, achievements, activityLogs,
        fetchDashboardData, addExam, deleteExam, addAssignment, toggleAssignment,
        deleteAssignment, addMockTest, deleteMockTest, recordStudyActivity
    } = useDashboardStore();

    // Fetch master questions and courses list for stats counting
    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    const { data: questions = [], isLoading: isLoadingQuestions } = useQuery({
        queryKey: ['subjective-questions'],
        queryFn: async () => (await api.get('/materials/subjective-questions/')).data,
    });

    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
    });

    // Fetch active user subscriptions
    const { data: userSubscriptions = [], isLoading: isLoadingSubs } = useQuery<any[]>({
        queryKey: ['user-subscriptions'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/')).data,
    });

    // Fetch user payment history
    const { data: payments = [], isLoading: isLoadingPayments } = useQuery<any[]>({
        queryKey: ['user-payments'],
        queryFn: async () => (await api.get('/subscriptions/payments/')).data,
    });

    const getDaysRemaining = (endDateStr: string) => {
        const end = new Date(endDateStr);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    useEffect(() => {
        fetchDashboardData();
        recordStudyActivity();
    }, [fetchDashboardData, recordStudyActivity]);

    // Track local solved questions to calculate real-time completion %
    const [solvedQuestions, setSolvedQuestions] = useState<number[]>([]);
    
    useEffect(() => {
        const syncSolved = () => {
            const solvedStr = localStorage.getItem('qubook_solved_questions');
            if (solvedStr) {
                setSolvedQuestions(JSON.parse(solvedStr));
            } else {
                const mockSolved = [1, 2, 3, 4, 5, 6, 7];
                localStorage.setItem('qubook_solved_questions', JSON.stringify(mockSolved));
                setSolvedQuestions(mockSolved);
            }
        };
        syncSolved();
        window.addEventListener('solvedQuestionsChanged', syncSolved);
        return () => window.removeEventListener('solvedQuestionsChanged', syncSolved);
    }, []);

    // Calculate overall course progress:
    // Total Chapters = number of unique topics (minimum 9)
    // Completed Chapters = number of unique topics solved by user
    const totalChapters = useMemo(() => {
        const uniqueTopics = new Set(questions.map((q: any) => q.topic_name || q.topic).filter(Boolean));
        return Math.max(uniqueTopics.size, 9);
    }, [questions]);

    const completedChapters = useMemo(() => {
        const solvedSet = new Set(solvedQuestions);
        const completedTopics = new Set(
            questions
                .filter((q: any) => solvedSet.has(q.id))
                .map((q: any) => q.topic_name || q.topic)
                .filter(Boolean)
        );
        return Math.min(completedTopics.size, totalChapters);
    }, [questions, solvedQuestions, totalChapters]);

    const remainingChapters = Math.max(totalChapters - completedChapters, 0);

    const progressPercent = useMemo(() => {
        if (totalChapters === 0) return 0;
        return Math.min(Math.round((completedChapters / totalChapters) * 100), 100);
    }, [completedChapters, totalChapters]);

    // Compute recent questions
    const recentQuestions = useMemo(() => {
        return questions.slice(0, 3);
    }, [questions]);

    const handleOpenQuestion = (q: any) => {
        setSelectedQuestion(q);
        setIsViewerOpen(true);

        // Record activity to stats (e.g. last activity url)
        useDashboardStore.setState((state) => {
            if (state.stats) {
                const updatedStats = {
                    ...state.stats,
                    last_activity_url: `/dashboard/papers/subject/${q.subject || 1}`,
                    last_activity_name: q.topic_name || q.topic || 'Subjective Question'
                };
                localStorage.setItem('qubook_stats', JSON.stringify(updatedStats));
                return { stats: updatedStats };
            }
            return {};
        });
        
        // Also trigger streak POST automatically
        recordStudyActivity();
    };

    // Level progression stats
    const xpPoints = stats?.xp_points || 0;
    const level = stats?.level || 1;
    const nextLevelXP = level * 500;
    const xpPercentage = Math.min(Math.round((xpPoints / nextLevelXP) * 100), 100);
    const coinsCount = stats?.coins || 0;

    // Study Streak stats
    const streakCount = streak?.current_streak || 0;
    const longestStreak = streak?.longest_streak || 0;
    const streakDays = streak?.streak_days || [false, false, false, false, false, false, false];

    // Quick Metrics counts
    const activeCoursesCount = courses.filter((c: any) => c.is_active).length;
    const quickStats = [
        { label: 'Courses Active', value: activeCoursesCount.toString(), icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Papers Solved', value: solvedQuestions.length.toString(), icon: FileSearch, color: 'text-accent', bg: 'bg-accent/10' },
        { label: 'Saved Items', value: bookmarks.length.toString(), icon: Bookmark, color: 'text-success', bg: 'bg-success/10' },
        { label: 'Study Coins', value: coinsCount.toString(), icon: Coins, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    // Badge list
    const unlockedBadges = achievements.filter(a => a.unlocked);

    // Add handlers
    const handleAddExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!examTitle || !examDate) return;
        await addExam(examTitle, examDate);
        setExamTitle('');
        setExamDate('');
        setShowExamForm(false);
    };

    const handleAddAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignmentTitle || !assignmentDueDate) return;
        await addAssignment(assignmentTitle, assignmentDueDate);
        setAssignmentTitle('');
        setAssignmentDueDate('');
        setShowAssignmentForm(false);
    };

    const handleAddMock = async (e: React.FormEvent) => {
        e.preventDefault();
        const scoreVal = parseInt(mockScore);
        const totalVal = parseInt(mockTotal);
        if (!mockTitle || isNaN(scoreVal) || isNaN(totalVal) || !mockDate) return;
        await addMockTest(mockTitle, scoreVal, totalVal, mockDate);
        setMockTitle('');
        setMockScore('');
        setMockTotal('');
        setMockDate('');
        setShowMockForm(false);
    };

    return (
        <div className="space-y-10 pb-20 p-4 max-w-7xl mx-auto">
            {/* 1. WELCOME & LEVEL PROGRESS */}
            <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm relative overflow-hidden group hover:shadow-[0_0_24px_rgba(0,0,0,0.02)] transition-shadow">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -z-10" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em]">
                            <GraduationCap size={16} />
                            Academic Status: Active ({user?.subscription_tier || 'Free Account'})
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight">
                            Welcome back, <span className="text-primary">{stats?.user?.name || 'Student'}</span>!
                        </h1>
                        <p className="text-text-muted font-bold text-sm uppercase tracking-[0.1em]">Ready to accelerate your CA preparation?</p>
                    </div>

                    {/* Level / XP Progress Card */}
                    <div className="bg-bg border border-border p-4 rounded-2xl flex items-center gap-4 w-full md:w-auto md:min-w-[320px]">
                        <div className="w-12 h-12 bg-primary text-white rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                            <span className="text-[9px] font-black uppercase tracking-wider leading-none">Level</span>
                            <span className="text-lg font-black leading-none mt-1">{level}</span>
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase">
                                <span>XP PROGRESS</span>
                                <span>{xpPoints} / {nextLevelXP} XP</span>
                            </div>
                            <div className="h-2 bg-border rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-gradient-to-r from-teal-400 to-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${xpPercentage}%` }}
                                    transition={{ duration: 1 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. QUICK STATS METRICS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {quickStats.map((stat, i) => (
                    <div
                        key={i}
                        className="bg-card p-5 md:p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4 group hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all duration-500 cursor-default"
                    >
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                            <stat.icon size={22} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest leading-none">{stat.label}</p>
                            <p className="text-2xl font-black text-text-primary mt-1 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. MAIN DASHBOARD CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: Progress, Achievements, Questions */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Progress & Streak Dual blocks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Circular Progress Tracker */}
                        <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm flex flex-col justify-between min-h-[360px] hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all duration-500">
                            <div>
                                <h4 className="text-base font-black text-text-primary uppercase tracking-wide">Course Progress</h4>
                                <div className="flex flex-col items-center justify-center my-6 relative">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <defs>
                                            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#00b4d8" />
                                                <stop offset="50%" stopColor="#4f46e5" />
                                                <stop offset="100%" stopColor="#7209b7" />
                                            </linearGradient>
                                        </defs>
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="48"
                                            stroke="var(--border)"
                                            strokeWidth="8"
                                            fill="transparent"
                                        />
                                        <motion.circle
                                            cx="64"
                                            cy="64"
                                            r="48"
                                            stroke="url(#progressGrad)"
                                            strokeWidth="8"
                                            fill="transparent"
                                            strokeDasharray={2 * Math.PI * 48}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                                            animate={{ strokeDashoffset: 2 * Math.PI * 48 * (1 - progressPercent / 100) }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-text-primary">{progressPercent}%</span>
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-wider mt-0.5">Chapters Completed</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
                                    <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase">Total</p>
                                        <p className="text-sm font-black text-text-primary mt-0.5">{totalChapters}</p>
                                    </div>
                                    <div className="border-x border-border">
                                        <p className="text-[9px] font-black text-text-muted uppercase">Solved</p>
                                        <p className="text-sm font-black text-emerald-500 mt-0.5">{completedChapters}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase">Left</p>
                                        <p className="text-sm font-black text-orange-500 mt-0.5">{remainingChapters}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Continue Learning Action */}
                            {stats?.last_activity_url ? (
                                <button 
                                    onClick={() => navigate(stats.last_activity_url)}
                                    className="mt-6 w-full py-3.5 bg-gradient-to-r from-teal-400 to-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2"
                                >
                                    Resume: {stats.last_activity_name || 'Last Activity'} <ChevronRight size={14} />
                                </button>
                            ) : (
                                <button 
                                    onClick={() => navigate('/dashboard/papers')}
                                    className="mt-6 w-full py-3.5 bg-gradient-to-r from-teal-400 to-primary hover:opacity-95 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2"
                                >
                                    CONTINUE LEARNING <ArrowRight size={14} />
                                </button>
                            )}
                        </div>

                        {/* Weekly Study Streak Calendar */}
                        <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm flex flex-col justify-between min-h-[360px] hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all duration-500">
                            <div>
                                <h4 className="text-base font-black text-text-primary uppercase tracking-wide mb-6">Study Streak</h4>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                        <Flame size={24} className="fill-white" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-text-primary">{streakCount} <span className="text-sm font-bold text-text-muted">Days Active</span></p>
                                        <p className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Longest Record: {longestStreak} days</p>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center gap-1.5 pt-4 border-t border-border">
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                        const isCompleted = streakDays[i];
                                        return (
                                            <div key={i} className="flex flex-col items-center gap-2">
                                                <span className="text-[9px] font-black text-text-muted">{day}</span>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                                                    isCompleted 
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                                                    : 'bg-bg border-border text-transparent'
                                                }`}>
                                                    {isCompleted ? (
                                                        <svg className="w-4 h-4 stroke-white fill-none stroke-[3]" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                        </svg>
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-border" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {streakDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ? (
                                <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl py-3.5 text-center text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                    <CheckCircle2 size={14} />
                                    <span>Today's Progress Auto-Tracked</span>
                                </div>
                            ) : (
                                <div className="mt-6 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl py-3.5 text-center text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                    <Clock size={14} className="animate-pulse" />
                                    <span>Progress Will Auto-Track On Study</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SUBSCRIPTION & BILLING (Payment & Expiry Details) */}
                    <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm space-y-6 hover:shadow-[0_0_24px_rgba(0,0,0,0.02)] transition-shadow">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-text-primary">Subscription & Billing</h3>
                                    <p className="text-xs text-text-muted font-bold mt-0.5 uppercase tracking-wider">Active plans & recent payments</p>
                                </div>
                            </div>
                            <Link to="/dashboard/subscription" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1">
                                Upgrade Plan <ArrowRight size={12} />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Active plans / Expiry details */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-text-muted uppercase tracking-wider">Active Access Plans</h4>
                                {isLoadingSubs ? (
                                    <div className="flex items-center gap-2 text-xs text-text-muted py-4">
                                        <Loader2 className="animate-spin text-primary" size={16} />
                                        <span>Checking plans...</span>
                                    </div>
                                ) : userSubscriptions.filter((sub: any) => sub.is_active).length === 0 ? (
                                    <div className="bg-bg/50 rounded-2xl p-5 border border-border flex flex-col items-center text-center gap-3">
                                        <Lock className="text-text-muted" size={24} />
                                        <div>
                                            <p className="text-xs font-black text-text-primary">No Active Subscription</p>
                                            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                                                Upgrade to a Premium plan to unlock all exam papers, suggested answers, and premium study notes.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => navigate('/dashboard/subscription')}
                                            className="px-4 py-2 bg-primary hover:bg-opacity-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                        >
                                            Get Premium
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {userSubscriptions.filter((sub: any) => sub.is_active).map((sub: any) => {
                                            const daysLeft = getDaysRemaining(sub.end_date);
                                            const isExpired = daysLeft <= 0;
                                            return (
                                                <div key={sub.id} className="bg-bg/50 rounded-2xl p-4 border border-border flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-black text-text-primary uppercase tracking-wider">{sub.plan_name}</p>
                                                        <p className="text-[10px] text-text-muted font-bold">
                                                            Scope: {sub.subject_name ? `Paper - ${sub.subject_name}` : sub.group ? `${sub.group.replace('_', ' ')}` : 'Whole Course'}
                                                        </p>
                                                        <p className="text-[10px] text-text-muted font-bold">
                                                            Valid: {new Date(sub.start_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})} to {new Date(sub.end_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                                        isExpired 
                                                        ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                                        : daysLeft <= 5 
                                                        ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 animate-pulse' 
                                                        : 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                    }`}>
                                                        {isExpired ? 'Expired' : `Active · ${daysLeft} days left`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Recent Transactions */}
                            <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-6">
                                <h4 className="text-xs font-black text-text-muted uppercase tracking-wider">Recent Transactions</h4>
                                {isLoadingPayments ? (
                                    <div className="flex items-center gap-2 text-xs text-text-muted py-4">
                                        <Loader2 className="animate-spin text-primary" size={16} />
                                        <span>Syncing transactions...</span>
                                    </div>
                                ) : payments.length === 0 ? (
                                    <p className="text-[10px] font-bold text-text-muted py-4">No recent payments found.</p>
                                ) : (
                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                        {payments.slice(0, 3).map((pay: any) => (
                                            <div key={pay.id} className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border text-xs">
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-text-primary text-[11px]">{pay.plan_name}</p>
                                                    <p className="text-[9px] text-text-muted font-bold tracking-wider uppercase">{pay.transaction_id} · {new Date(pay.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-primary text-xs">₹{parseFloat(pay.amount).toFixed(2)}</p>
                                                    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-emerald-600 mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Success
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Gamification Badge Achievements list */}
                    <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Award className="text-primary" size={20} />
                                <h3 className="text-lg font-black text-text-primary">Reward Badges</h3>
                            </div>
                            <span className="text-[10px] font-black text-text-muted bg-bg px-3 py-1 rounded-full uppercase tracking-wider">
                                {unlockedBadges.length} UNLOCKED
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {achievements.map((badge) => (
                                <div 
                                    key={badge.id}
                                    className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all ${
                                        badge.unlocked 
                                        ? 'bg-bg border-primary/20 shadow-sm opacity-100 scale-100' 
                                        : 'bg-bg/40 border-border opacity-40 grayscale'
                                    }`}
                                    title={badge.description}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                                        badge.unlocked ? 'bg-primary/10 text-primary' : 'bg-bg text-text-muted'
                                    }`}>
                                        {badge.badge_icon === 'footprints' && <GraduationCap size={20} />}
                                        {badge.badge_icon === 'zap' && <Zap size={20} />}
                                        {badge.badge_icon === 'shield' && <Award size={20} />}
                                        {badge.badge_icon === 'crown' && <Trophy size={20} />}
                                        {badge.badge_icon === 'award' && <Award size={20} />}
                                        {badge.badge_icon === 'sparkles' && <Sparkles size={20} />}
                                    </div>
                                    <span className="text-[9px] font-black text-text-primary uppercase truncate w-full">{badge.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent subjective questions table list */}
                    <div className="bg-card rounded-[2.5rem] border border-border shadow-sm p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                                    <Clock size={20} />
                                </div>
                                <h3 className="text-lg font-black text-text-primary">Recent Questions</h3>
                            </div>
                            <Link to="/dashboard/papers" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1.5">
                                View Questbank <ArrowRight size={12} />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {isLoadingQuestions ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <p className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Syncing live feed...</p>
                                </div>
                            ) : recentQuestions.length === 0 ? (
                                <p className="text-center text-text-muted font-bold text-xs uppercase tracking-widest py-8">No recent activity detected.</p>
                            ) : (
                                recentQuestions.map((q: any, idx: number) => (
                                    <div
                                        key={q.id}
                                        onClick={() => handleOpenQuestion(q)}
                                        className="flex items-center justify-between p-4 rounded-2xl border border-border hover:bg-bg hover:border-primary/20 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-bg shadow-sm border border-border rounded-xl flex items-center justify-center text-primary font-black text-sm group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="truncate max-w-[180px] md:max-w-xs">
                                                <h4 className="font-black text-xs text-text-primary group-hover:text-primary transition-colors truncate">{q.topic_name || q.topic}</h4>
                                                <p className="text-[9px] text-text-muted font-black uppercase tracking-wider mt-0.5">{q.source} · Q{q.q_no || q.qNo}</p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-bg text-text-muted group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                            <ChevronRight size={16} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR COLUMN: Widgets & daily motivation */}
                <div className="space-y-8">
                    
                    {/* Motivation quote of the day Card */}
                    <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm relative overflow-hidden group hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all duration-500">
                        <div className="absolute -top-6 -left-2 text-8xl font-serif text-border/40 select-none pointer-events-none">
                            “
                        </div>
                        <div className="relative z-10 space-y-4">
                            <h5 className="text-[10px] font-black text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={12} className="text-amber-500" /> Dynamic Motivation
                            </h5>
                            <p className="text-base font-black text-text-primary leading-snug">
                                {quote?.text || "Consistency today leads to success tomorrow."}
                            </p>
                            <p className="text-xs font-bold text-text-muted text-right">- {quote?.author || "qubook.in"}</p>
                        </div>
                    </div>

                    {/* UPCOMING EXAMS WIDGET */}
                    <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-xs text-text-primary uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={16} className="text-blue-500" /> Upcoming Exams
                            </h4>
                            <button 
                                onClick={() => setShowExamForm(!showExamForm)}
                                className="p-1 hover:bg-bg rounded-lg text-text-muted hover:text-primary transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        {showExamForm && (
                            <form onSubmit={handleAddExam} className="p-3 bg-bg rounded-xl border border-border space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="Exam Title..." 
                                    value={examTitle}
                                    onChange={(e) => setExamTitle(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <input 
                                    type="date" 
                                    value={examDate}
                                    onChange={(e) => setExamDate(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <button type="submit" className="w-full py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg">Save Exam</button>
                            </form>
                        )}

                        <div className="space-y-3">
                            {exams.length === 0 ? (
                                <p className="text-[10px] font-bold text-text-muted py-2">No upcoming exams defined.</p>
                            ) : (
                                exams.map((exam) => (
                                    <div key={exam.id} className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border">
                                        <div>
                                            <p className="text-xs font-black text-text-primary">{exam.title}</p>
                                            <p className="text-[9px] text-text-muted font-bold mt-0.5">{new Date(exam.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                        </div>
                                        <button 
                                            onClick={() => deleteExam(exam.id)}
                                            className="p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* PENDING ASSIGNMENTS WIDGET */}
                    <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-xs text-text-primary uppercase tracking-wider flex items-center gap-2">
                                <ListTodo size={16} className="text-emerald-500" /> Pending Work
                            </h4>
                            <button 
                                onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                                className="p-1 hover:bg-bg rounded-lg text-text-muted hover:text-primary transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        {showAssignmentForm && (
                            <form onSubmit={handleAddAssignment} className="p-3 bg-bg rounded-xl border border-border space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="Assignment Title..." 
                                    value={assignmentTitle}
                                    onChange={(e) => setAssignmentTitle(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <input 
                                    type="date" 
                                    value={assignmentDueDate}
                                    onChange={(e) => setAssignmentDueDate(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <button type="submit" className="w-full py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg">Save Work</button>
                            </form>
                        )}

                        <div className="space-y-3">
                            {assignments.length === 0 ? (
                                <p className="text-[10px] font-bold text-text-muted py-2">No pending assignments.</p>
                            ) : (
                                assignments.map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => toggleAssignment(task.id, task.status === 'PENDING' ? 'COMPLETED' : 'PENDING')}
                                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                    task.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
                                                }`}
                                            >
                                                {task.status === 'COMPLETED' && <CheckCircle2 size={12} />}
                                            </button>
                                            <div className={task.status === 'COMPLETED' ? 'line-through opacity-50' : ''}>
                                                <p className="text-xs font-black text-text-primary leading-none">{task.title}</p>
                                                <p className="text-[9px] text-text-muted font-bold mt-1">Due {new Date(task.due_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => deleteAssignment(task.id)}
                                            className="p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* MOCK TEST RESULTS WIDGET */}
                    <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-xs text-text-primary uppercase tracking-wider flex items-center gap-2">
                                <Trophy size={16} className="text-amber-500" /> Mock Exams
                            </h4>
                            <button 
                                onClick={() => setShowMockForm(!showMockForm)}
                                className="p-1 hover:bg-bg rounded-lg text-text-muted hover:text-primary transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        {showMockForm && (
                            <form onSubmit={handleAddMock} className="p-3 bg-bg rounded-xl border border-border space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="Mock Exam Name..." 
                                    value={mockTitle}
                                    onChange={(e) => setMockTitle(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Marks" 
                                        value={mockScore}
                                        onChange={(e) => setMockScore(e.target.value)}
                                        className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                        required
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Total" 
                                        value={mockTotal}
                                        onChange={(e) => setMockTotal(e.target.value)}
                                        className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                        required
                                    />
                                </div>
                                <input 
                                    type="date" 
                                    value={mockDate}
                                    onChange={(e) => setMockDate(e.target.value)}
                                    className="bg-sidebar border border-border px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                                    required
                                />
                                <button type="submit" className="w-full py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg">Submit Score</button>
                            </form>
                        )}

                        <div className="space-y-3">
                            {mockTests.length === 0 ? (
                                <p className="text-[10px] font-bold text-text-muted py-2">No mock tests submitted.</p>
                            ) : (
                                mockTests.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border">
                                        <div>
                                            <p className="text-xs font-black text-text-primary truncate max-w-[160px]">{t.title}</p>
                                            <p className="text-[10px] text-text-muted font-bold mt-0.5">Score: <span className="font-black text-primary">{t.score}/{t.total_marks}</span></p>
                                        </div>
                                        <button 
                                            onClick={() => deleteMockTest(t.id)}
                                            className="p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RECENT ACTIVITY LOG FEED */}
                    <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 space-y-4">
                        <h4 className="text-base font-black flex items-center gap-2 uppercase tracking-wide text-text-primary">
                            <Clock size={16} className="text-amber-500" /> Recent Action Logs
                        </h4>
                        
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-hide">
                            {activityLogs.length === 0 ? (
                                <p className="text-[10px] text-text-muted py-2">No activity recorded.</p>
                            ) : (
                                activityLogs.map((log) => (
                                    <div key={log.id} className="p-2.5 bg-bg/50 border border-border rounded-xl text-[10px]">
                                        <p className="font-black text-text-primary">{log.description}</p>
                                        <p className="text-[8px] text-text-muted mt-1">{new Date(log.created_at).toLocaleTimeString()}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Questions viewer modal popup */}
            <QuestionModal
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                question={selectedQuestion}
                onNext={() => {
                    const idx = recentQuestions.findIndex((q: any) => q.id === selectedQuestion?.id);
                    if (idx < recentQuestions.length - 1) setSelectedQuestion(recentQuestions[idx + 1]);
                }}
                onPrev={() => {
                    const idx = recentQuestions.findIndex((q: any) => q.id === selectedQuestion?.id);
                    if (idx > 0) setSelectedQuestion(recentQuestions[idx - 1]);
                }}
                currentIndex={recentQuestions.findIndex((q: any) => q.id === selectedQuestion?.id)}
                totalCount={recentQuestions.length}
            />
        </div>
    );
}
