import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen, FileSearch, Bookmark, ArrowRight, Zap,
    Clock, GraduationCap, Loader2, Flame, Coins, Award,
    Sparkles, Plus, Calendar, ListTodo, CheckCircle2, ChevronRight,
    Trophy, Trash2, Lock, Video, FileText, Cpu, ExternalLink,
    CreditCard, RefreshCw, Receipt, AlertTriangle, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import QuestionModal from '@/components/dashboard/QuestionModal';
import { useQuery, useMutation } from '@tanstack/react-query';
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
        queryFn: async () => {
            const res = (await api.get('/courses/courses/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    // Fetch live classes
    const { data: liveClasses = [] } = useQuery<any[]>({
        queryKey: ['dashboard-live-classes'],
        queryFn: async () => {
            const res = (await api.get('/materials/live-classes/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        }
    });

    const activeLiveClass = useMemo(() => {
        const now = new Date();
        return liveClasses.find((lc: any) => {
            if (!lc.is_active) return false;
            // Check course mapping: must match user selected course or be null (All Courses)
            if (lc.course && lc.course !== user?.selected_course) return false;
            
            const startTime = new Date(lc.scheduled_time);
            const endTime = new Date(startTime.getTime() + (lc.duration_minutes || 60) * 60000);
            
            // It is active if:
            // 1. Explicitly marked LIVE
            // 2. Or current time is between startTime - 10 minutes and endTime
            const tenMinsBefore = new Date(startTime.getTime() - 10 * 60000);
            return lc.status === 'LIVE' || (now >= tenMinsBefore && now <= endTime);
        });
    }, [liveClasses, user?.selected_course]);

    const { data: questions = [], isLoading: isLoadingQuestions } = useQuery({
        queryKey: ['subjective-questions', user?.selected_course],
        queryFn: async () => {
            const url = user?.selected_course
                ? `/materials/subjective-questions/?page_size=5&course_id=${user.selected_course}`
                : '/materials/subjective-questions/?page_size=5';
            const res = (await api.get(url)).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: async () => {
            const res = (await api.get('/materials/bookmarks/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    // Fetch active user subscriptions
    const { data: userSubscriptions = [], isLoading: isLoadingSubs } = useQuery<any[]>({
        queryKey: ['user-subscriptions'],
        queryFn: async () => {
            const res = (await api.get('/subscriptions/my-subscriptions/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    // Filter subscriptions to only match the currently selected course
    const courseSubscriptions = useMemo(() => {
        if (!user?.selected_course) return userSubscriptions;
        return userSubscriptions.filter((sub: any) => {
            if (!sub.course_id) return false;
            return String(sub.course_id) === String(user.selected_course);
        });
    }, [userSubscriptions, user?.selected_course]);


    // Fetch user payment history — fetch enough to match all active subscriptions
    const { data: payments = [], isLoading: isLoadingPayments } = useQuery<any[]>({
        queryKey: ['user-payments'],
        queryFn: async () => {
            const res = (await api.get('/subscriptions/payments/?page_size=50')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showAllPlansModal, setShowAllPlansModal] = useState(false);
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
    const [expiryBannerDismissed, setExpiryBannerDismissed] = useState(false);

    const handleDownloadInvoice = async (paymentId: number, transactionId: string) => {
        setDownloadingInvoiceId(paymentId);
        try {
            const response = await api.get(`/subscriptions/payments/${paymentId}/download_invoice/`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${transactionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            alert('Unable to download invoice. Please try again.');
        } finally {
            setDownloadingInvoiceId(null);
        }
    };


    const { data: myProgress, refetch: refetchProgress } = useQuery({
        queryKey: ['my-student-progress'],
        queryFn: async () => {
            const res = await api.get('/courses/student-progress/my-progress/');
            return res.data;
        },
        enabled: !!user?.selected_course,
    });

    const { data: activePaths = [] } = useQuery({
        queryKey: ['my-upgrade-paths'],
        queryFn: async () => {
            const res = await api.get('/courses/progression-paths/');
            return res.data;
        },
    });

    const activePath = useMemo(() => {
        if (!myProgress || !activePaths.length) return null;
        return activePaths.find((p: any) => p.current_level === myProgress.level && p.is_active);
    }, [myProgress, activePaths]);

    const { data: upgradeRequests = [], refetch: refetchRequests } = useQuery({
        queryKey: ['my-upgrade-requests'],
        queryFn: async () => {
            const res = await api.get('/courses/upgrade-requests/');
            return res.data;
        },
    });

    const pendingRequest = useMemo(() => {
        if (!activePath || !upgradeRequests.length) return null;
        return upgradeRequests.find((r: any) => r.upgrade_path === activePath.id && r.status === 'PENDING');
    }, [activePath, upgradeRequests]);

    const getUpgradeButtonText = () => {
        if (!activePath || !myProgress) return '';
        if (myProgress.completion_percentage < (activePath.eligibility_rule?.min_score || 0)) {
            return 'Continue Learning';
        }
        return activePath.button_text || 'Upgrade';
    };

    const handleUpgradeClick = () => {
        if (!activePath || !myProgress) return;

        if (myProgress.completion_percentage < (activePath.eligibility_rule?.min_score || 0)) {
            navigate('/dashboard/classroom');
            return;
        }

        setShowUpgradeModal(true);
    };

    const createUpgradeRequestMutation = useMutation({
        mutationFn: async () => {
            if (!activePath) return;
            const res = await api.post('/courses/upgrade-requests/', {
                upgrade_path: activePath.id
            });
            return res.data;
        },
        onSuccess: () => {
            refetchRequests();
            refetchProgress();
            setShowUpgradeModal(false);
            if (activePath.upgrade_type === 'AUTOMATIC') {
                alert(`Successfully upgraded to ${activePath.next_level_name}!`);
                window.location.reload();
            } else {
                alert("Upgrade request submitted successfully! Pending admin approval.");
            }
        },
        onError: (e: any) => {
            alert(e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || "Failed to submit request.");
        }
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
            {activeLiveClass && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-600 text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 border border-red-500 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="relative flex h-4 w-4 shrink-0 animate-pulse">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded font-bold">
                                Live Session Active
                            </span>
                            <h2 className="text-xl font-black mt-1">{activeLiveClass.title}</h2>
                            <p className="text-white/85 text-xs font-semibold mt-0.5">
                                {activeLiveClass.course_name ? `${activeLiveClass.course_name}` : 'Open to All Students'}
                                {activeLiveClass.level_name ? ` • ${activeLiveClass.level_name}` : ''}
                                {activeLiveClass.subject_name ? ` • ${activeLiveClass.subject_name}` : ''}
                            </p>
                        </div>
                    </div>
                    <a
                        href={activeLiveClass.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative z-10 bg-white hover:bg-slate-100 text-red-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-colors w-full md:w-auto text-center font-bold shrink-0"
                    >
                        <span>Join Live Class</span>
                        <ExternalLink size={14} />
                    </a>
                </motion.div>
            )}
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
                        <p className="text-text-muted font-bold text-sm uppercase tracking-[0.1em]">Ready to accelerate your {user?.selected_course_name || 'academic'} preparation?</p>
                    </div>

                    <div className="flex flex-col xl:flex-row items-stretch gap-4 w-full xl:w-auto">
                        {/* Level / XP Progress Card */}
                        <div className="bg-bg border border-border p-4 rounded-2xl flex items-center gap-4 w-full xl:w-[300px] shrink-0">
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

                        {/* Course Progression & Upgrade Card */}
                        {myProgress && (
                            <div className="bg-bg border border-border p-4 rounded-2xl flex items-center justify-between gap-4 w-full xl:min-w-[420px] bg-gradient-to-br from-violet-500/5 via-primary/5 to-transparent relative overflow-hidden">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-primary text-white rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                                        <span className="text-[9px] font-black uppercase tracking-widest leading-none">Course</span>
                                        <span className="text-[9px] font-black mt-1 text-center truncate px-0.5 w-full max-w-[75px] leading-tight" title={myProgress.level_name}>{myProgress.level_name}</span>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase">
                                            <span>LEVEL PROGRESS</span>
                                            <span>{myProgress.completion_percentage}%</span>
                                        </div>
                                        <div className="h-2 bg-border rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-violet-500 to-primary"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${myProgress.completion_percentage}%` }}
                                                transition={{ duration: 1 }}
                                            />
                                        </div>
                                        <div className="text-[9px] text-text-muted font-bold">
                                            {activePath ? `Next Level: ${activePath.next_level_name}` : 'Course completed 🎉'}
                                        </div>
                                    </div>
                                </div>

                                {activePath && (
                                    <div className="border-l border-border pl-4 flex flex-col justify-center shrink-0">
                                        {pendingRequest ? (
                                            <span className="px-3 py-1.5 bg-slate-100 text-slate-400 font-black text-[10px] uppercase rounded-xl border border-slate-200 select-none">
                                                Pending Admin
                                            </span>
                                        ) : (
                                            <button
                                                onClick={handleUpgradeClick}
                                                className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-primary text-white font-black text-[10px] uppercase rounded-xl shadow-md hover:shadow-lg transition-all"
                                            >
                                                {getUpgradeButtonText()}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. QUICK STATS METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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

                    {/* Course-Specific Learning Center */}
                    <div className="bg-card rounded-[2.5rem] border border-border p-6 md:p-8 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-text-primary tracking-tight uppercase">
                                    {user?.selected_course_category || 'My'} Learning Center
                                </h3>
                                <p className="text-xs text-text-muted font-bold tracking-wider">
                                    {user?.selected_course_name ? `Custom resources for ${user.selected_course_name}` : 'Awaiting stream registration'}
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-wider self-start sm:self-auto">
                                {user?.selected_course_name || 'No Course Selected'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* If no course is assigned/added yet */}
                            {!user?.selected_course_category && (
                                <div className="col-span-full py-8 px-6 text-center bg-bg rounded-2xl border border-dashed border-border flex flex-col items-center justify-center space-y-3">
                                    <Lock className="text-slate-400" size={24} />
                                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">No Course Assigned</h4>
                                    <p className="text-[10px] text-text-muted max-w-sm font-medium leading-relaxed">
                                        Your learning stream or level has not been set yet. Once your institution admin assigns your batch and course levels, your curriculum content will appear here automatically.
                                    </p>
                                </div>
                            )}

                            {/* CA / CMA / CS / ACCA (Professional Courses) */}
                            {user?.selected_course_category === 'Professional Courses' && (
                                <>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(79,70,229,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Video size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name || 'Professional'} Classes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Watch live sessions and access complete video archives.</p>
                                        </div>
                                    </div>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-accent/40 hover:shadow-[0_0_15px_rgba(0,180,216,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name || 'Professional'} Notes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Comprehensive revision guides, formulas, and PDF resources.</p>
                                        </div>
                                    </div>
                                    <Link to="/dashboard/mock-tests" className="bg-bg border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Trophy size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name || 'Professional'} Mock Tests</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Test your preparation with timed exam simulations and rank lists.</p>
                                        </div>
                                    </Link>
                                    <Link to="/dashboard/papers" className="bg-bg border border-border rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <BookOpen size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name || 'Professional'} PYQs</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Practice previous year questions mapped to the curriculum.</p>
                                        </div>
                                    </Link>
                                </>
                            )}

                            {/* Kerala PSC / UPSC / SSC (Government Exams) */}
                            {user?.selected_course_category === 'Government Exams' && (
                                <>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(79,70,229,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Video size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Classes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Daily online live coaching sessions and mock walk-throughs.</p>
                                        </div>
                                    </div>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-accent/40 hover:shadow-[0_0_15px_rgba(0,180,216,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Notes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Download current syllabus notes and GK question sheets.</p>
                                        </div>
                                    </div>
                                    <Link to="/dashboard/mock-tests" className="bg-bg border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Trophy size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Mock Tests</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Rank list exams to evaluate your ranking among competitors.</p>
                                        </div>
                                    </Link>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Sparkles size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Current Affairs</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Daily curated news digests, quizzes, and revision capsules.</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* NEET / JEE / KEAM (Entrance Exams) */}
                            {user?.selected_course_category === 'Entrance Exams' && (
                                <>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-rose-500/40 hover:shadow-[0_0_15px_rgba(244,63,94,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Video size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Crash Classes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Concept clarification lectures, tips and shortcuts.</p>
                                        </div>
                                    </div>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-sky-500/40 hover:shadow-[0_0_15px_rgba(14,165,233,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Cpu size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Formula Sheets</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Quick reference cards for Physics, Chemistry, and Math.</p>
                                        </div>
                                    </div>
                                    <Link to="/dashboard/mock-tests" className="bg-bg border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Trophy size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Mock Tests</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Practice standard full-length test series matching exam patterns.</p>
                                        </div>
                                    </Link>
                                    <Link to="/dashboard/papers" className="bg-bg border border-border rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <BookOpen size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">{user?.selected_course_name} Chapter PYQs</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Chapter-wise past question bank to practice target concepts.</p>
                                        </div>
                                    </Link>
                                </>
                            )}

                            {/* Academic Courses (Plus One / Plus Two / Degree / PG) */}
                            {user?.selected_course_category === 'Academic Courses' && (
                                <>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(79,70,229,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Video size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Syllabus Classes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Lectures explaining all textbook topics and chapters.</p>
                                        </div>
                                    </div>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-teal-500/40 hover:shadow-[0_0_15px_rgba(20,184,166,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Chapter Notes</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Summarized curriculum notes, questions, and model answers.</p>
                                        </div>
                                    </div>
                                    <Link to="/dashboard/mock-tests" className="bg-bg border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Trophy size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Practice Exams</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Semester/term mock exams to test your scoring ability.</p>
                                        </div>
                                    </Link>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <ListTodo size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Syllabus Tracker</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Track your syllabus completion percentage topic by topic.</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Skill Development */}
                            {user?.selected_course_category === 'Skill Development' && (
                                <>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(79,70,229,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Cpu size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Interactive Code Labs</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Write, compile, and run code directly in the online playground.</p>
                                        </div>
                                    </div>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Sparkles size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Build Projects</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Follow step-by-step guides to build production-grade web applications.</p>
                                        </div>
                                    </div>
                                    <Link to="/dashboard/mock-tests" className="bg-bg border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Trophy size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Skill Certifications</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Verify your skills and earn completion badges for your profile.</p>
                                        </div>
                                    </Link>
                                    <div className="bg-bg border border-border rounded-2xl p-5 hover:border-violet-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.05)] transition-all cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                            <Award size={18} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Milestone Badges</h4>
                                            <p className="text-[10px] text-text-muted font-medium">Track your technical milestones and share achievements.</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

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
                                    <div className="absolute flex flex-col items-center justify-center max-w-[80px] text-center">
                                        <span className="text-2xl font-black text-text-primary">{progressPercent}%</span>
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-wider mt-0.5 leading-none">Completed</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center pt-2 border-t border-border">
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
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${isCompleted
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

                                    {/* ── EXPIRY BANNER ── */}
                                    {!isLoadingSubs && !expiryBannerDismissed && courseSubscriptions.length > 0 && courseSubscriptions.every((s: any) => !s.is_active) && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={18} />
                                                <div>
                                                    <p className="text-xs font-black text-amber-700">Your subscription has expired.</p>
                                                    <p className="text-[10px] text-amber-600/80 font-semibold mt-0.5">Renew your subscription to continue access to all premium materials and tests.</p>
                                                    <button
                                                        onClick={() => navigate('/dashboard/subscription')}
                                                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                                                    >
                                                        <RefreshCw size={11} /> Renew Now
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => setExpiryBannerDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0 mt-0.5">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Left Column: Active plans */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black text-text-muted uppercase tracking-wider">Active Access Plans</h4>
                                            {isLoadingSubs ? (
                                                <div className="flex items-center gap-2 text-xs text-text-muted py-4">
                                                    <Loader2 className="animate-spin text-primary" size={16} />
                                                    <span>Checking plans...</span>
                                                </div>
                                            ) : courseSubscriptions.filter((sub: any) => sub.is_active).length === 0 ? (
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
                                                    {courseSubscriptions.filter((sub: any) => sub.is_active).slice(0, 2).map((sub: any) => {
                                                        const daysLeft = getDaysRemaining(sub.end_date);
                                                        const isExpired = daysLeft <= 0;
                                                        // Find the matching payment for this sub
                                                        const linkedPayment = payments.find((p: any) => p.subscription_details?.id === sub.id)
                                                            || payments.find((p: any) => p.plan === sub.plan && p.status === 'SUCCESS');

                                                        return (
                                                            <div key={sub.id} className="group relative bg-card/45 backdrop-blur-md rounded-2xl border border-border/80 hover:border-primary/30 hover:bg-card/90 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                                                                {/* accent bar */}
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                                                {/* Header row: plan name + status pill */}
                                                                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                                        <p className="text-xs font-black text-text-primary uppercase tracking-wide break-words leading-relaxed">{sub.plan_name}</p>
                                                                        {sub.course_name && <p className="text-[10px] text-primary/80 font-bold">{sub.course_name}</p>}
                                                                    </div>
                                                                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                                        isExpired
                                                                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                                            : daysLeft <= 7
                                                                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                                                                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                                    }`}>
                                                                        {!isExpired && (
                                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${daysLeft <= 7 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                                                                        )}
                                                                        {isExpired ? 'Expired' : `${daysLeft}d left`}
                                                                    </span>
                                                                </div>

                                                                {/* Grid of details: Purchased, Expires, Scope */}
                                                                <div className="px-5 pb-4 space-y-2 text-[10px] text-text-muted font-bold border-b border-border/40">
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <BookOpen size={10} className="text-primary/70 shrink-0" />
                                                                            <span>Scope: {sub.subject_name ? `Paper - ${sub.subject_name}` : sub.group ? `${sub.group.replace('_', ' ')}` : sub.plan_scope === 'PAPER_WISE' ? 'Paper Wise' : sub.plan_scope === 'GROUP_WISE' ? 'Group Wise' : 'Whole Course'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <Clock size={10} className="text-primary/70 shrink-0" />
                                                                            <span>Duration: {sub.plan_duration === 9999 ? 'Lifetime' : `${sub.plan_duration || 30} Days`} ({sub.plan_billing_cycle?.replace('_', ' ') || 'Monthly'})</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <Calendar size={10} className="text-primary/70 shrink-0" />
                                                                            <span>Purchased: {new Date(sub.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <Calendar size={10} className="text-primary/70 shrink-0" />
                                                                            <span>Expires: {new Date(sub.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 border-t border-border/20 text-[9px] text-text-muted/80">
                                                                        {linkedPayment && (
                                                                            <>
                                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                                    <Coins size={10} className="text-primary/60 shrink-0" />
                                                                                    <span>Amount Paid: ₹{parseFloat(linkedPayment.amount).toFixed(2)}</span>
                                                                                </div>
                                                                                {linkedPayment.transaction_id && (
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <CreditCard size={10} className="text-primary/60 shrink-0" />
                                                                                        <span className="font-mono">Txn ID: {linkedPayment.transaction_id}</span>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        {sub.exam_attempt && (
                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                <Award size={10} className="text-primary/60 shrink-0" />
                                                                                <span>Attempt: {sub.exam_attempt} {sub.year}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Bottom Row Action Buttons */}
                                                                <div className="flex gap-2 p-3 bg-bg/25">
                                                                    {linkedPayment && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleDownloadInvoice(linkedPayment.id, linkedPayment.transaction_id)}
                                                                                disabled={downloadingInvoiceId === linkedPayment.id}
                                                                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-bg text-text-secondary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                            >
                                                                                {downloadingInvoiceId === linkedPayment.id ? (
                                                                                    <Loader2 className="animate-spin" size={11} />
                                                                                ) : (
                                                                                    <Receipt size={11} />
                                                                                )}
                                                                                Receipt
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDownloadInvoice(linkedPayment.id, linkedPayment.transaction_id)}
                                                                                disabled={downloadingInvoiceId === linkedPayment.id}
                                                                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-bg text-text-secondary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                            >
                                                                                <ExternalLink size={11} /> Invoice
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        onClick={() => navigate('/dashboard/subscription')}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-primary to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all"
                                                                    >
                                                                        <RefreshCw size={11} /> Renew
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {courseSubscriptions.filter((sub: any) => sub.is_active).length > 2 && (
                                                        <button
                                                            onClick={() => setShowAllPlansModal(true)}
                                                            className="w-full py-3 bg-gradient-to-r from-primary/5 to-indigo-500/5 hover:from-primary/10 hover:to-indigo-500/10 text-primary border border-primary/20 hover:border-primary/40 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm hover:shadow"
                                                        >
                                                            More Details <Sparkles size={11} className="fill-primary text-primary" />
                                                        </button>
                                                    )}
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
                                                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                                                    {payments.slice(0, 5).map((pay: any) => (
                                                        <div key={pay.id} className="flex items-start justify-between p-3 bg-bg/50 rounded-xl border border-border text-xs gap-3">
                                                            <div className="space-y-1 min-w-0 flex-1">
                                                                <p className="font-black text-text-primary text-[11px] truncate">{pay.plan_name}</p>
                                                                {pay.subscription_details && (
                                                                    <p className="text-[10px] text-primary/85 font-extrabold truncate">
                                                                        {pay.subscription_details.subject_name
                                                                            ? `Paper: ${pay.subscription_details.subject_name}`
                                                                            : pay.subscription_details.group
                                                                                ? `Scope: ${pay.subscription_details.group.replace('_', ' ')}`
                                                                                : 'Whole Course'}
                                                                        {pay.subscription_details.exam_attempt && ` · ${pay.subscription_details.exam_attempt}`}
                                                                    </p>
                                                                )}
                                                                <p className="text-[9px] text-text-muted font-bold tracking-wider uppercase truncate">{pay.transaction_id}</p>
                                                                <p className="text-[9px] text-text-muted font-bold">{new Date(pay.created_at).toLocaleDateString()}</p>
                                                                {pay.expiry_date && (
                                                                    <p className="text-[9px] text-text-muted font-bold">
                                                                        Expires: {new Date(pay.expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right space-y-1.5 shrink-0">
                                                                <p className="font-black text-primary text-xs">₹{parseFloat(pay.amount).toFixed(2)}</p>
                                                                <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase ${pay.status === 'SUCCESS' ? 'text-emerald-600' : pay.status === 'FAILED' ? 'text-red-500' : 'text-amber-500'}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${pay.status === 'SUCCESS' ? 'bg-emerald-500' : pay.status === 'FAILED' ? 'bg-red-500' : 'bg-amber-500'}`} /> {pay.status}
                                                                </span>
                                                                {pay.status === 'SUCCESS' && (
                                                                    <button
                                                                        onClick={() => handleDownloadInvoice(pay.id, pay.transaction_id)}
                                                                        disabled={downloadingInvoiceId === pay.id}
                                                                        className="flex items-center gap-1 text-[9px] font-black text-primary/70 hover:text-primary transition-colors mt-1 disabled:opacity-50"
                                                                    >
                                                                        {downloadingInvoiceId === pay.id ? <Loader2 className="animate-spin" size={10} /> : <CreditCard size={10} />}
                                                                        Invoice
                                                                    </button>
                                                                )}
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
                                    className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all ${badge.unlocked
                                            ? 'bg-bg border-primary/20 shadow-sm opacity-100 scale-100'
                                            : 'bg-bg/40 border-border opacity-40 grayscale'
                                        }`}
                                    title={badge.description}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${badge.unlocked ? 'bg-primary/10 text-primary' : 'bg-bg text-text-muted'
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
                                            <p className="text-[9px] text-text-muted font-bold mt-0.5">{new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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
                                                className={`w-4 h-4 rounded border flex items-center justify-center ${task.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
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

            {/* Progression Upgrade Request Modal */}
            {showUpgradeModal && activePath && myProgress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
                    <div className="bg-card border border-border w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full" />
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Level Up Journey</span>
                            <h3 className="text-xl font-black text-text-primary mt-1">Upgrade Level Course</h3>
                        </div>

                        <div className="space-y-4 bg-bg/50 border border-border p-4 rounded-2xl">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-text-muted">Current level:</span>
                                <span className="text-text-primary font-black">{activePath.current_level_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-text-muted">Target level:</span>
                                <span className="text-primary font-black">{activePath.next_level_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold border-t border-border/60 pt-3">
                                <span className="text-text-muted">Progression Mode:</span>
                                <span className="text-text-primary uppercase">{activePath.upgrade_type}</span>
                            </div>
                            {activePath.price && parseFloat(activePath.price) > 0 ? (
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-text-muted">Price:</span>
                                    <span className="text-emerald-500 font-black">${activePath.price}</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Eligibility details */}
                        {activePath.eligibility_rule && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Eligibility Requirements Status</h4>
                                <div className="space-y-2">
                                    {activePath.eligibility_rule.min_score > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Min Completion Score:</span>
                                            <span className={`font-black ${myProgress.completion_percentage >= activePath.eligibility_rule.min_score ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {myProgress.completion_percentage}% / {activePath.eligibility_rule.min_score}%
                                            </span>
                                        </div>
                                    )}
                                    {activePath.eligibility_rule.manual_approval_required && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Requires Admin Sign-off:</span>
                                            <span className="text-text-primary font-black">Yes</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2 border-t border-border/60">
                            <button
                                type="button"
                                className="px-4 py-2 border border-border hover:bg-bg/80 text-text-primary font-bold text-xs rounded-xl"
                                onClick={() => setShowUpgradeModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={createUpgradeRequestMutation.isPending}
                                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-primary text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-1.5"
                                onClick={() => createUpgradeRequestMutation.mutate()}
                            >
                                {createUpgradeRequestMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin" size={14} />
                                        Processing...
                                    </>
                                ) : (
                                    activePath.price && parseFloat(activePath.price) > 0 ? 'Pay & Upgrade' : 'Confirm Upgrade'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* All Active Access Plans Modal */}
            {showAllPlansModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/10" onClick={() => setShowAllPlansModal(false)} />
                    <div className="bg-card border border-border w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[80vh]">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full pointer-events-none" />
                        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Academic Account</span>
                                <h3 className="text-lg font-black text-text-primary mt-0.5 font-black">All Active Access Plans</h3>
                            </div>
                            <button 
                                onClick={() => setShowAllPlansModal(false)}
                                className="w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-text-secondary transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
                            {courseSubscriptions.filter((sub: any) => sub.is_active).map((sub: any) => {
                                const daysLeft = getDaysRemaining(sub.end_date);
                                const isExpired = daysLeft <= 0;
                                return (
                                    <div key={sub.id} className="group relative bg-card/65 backdrop-blur-md rounded-2xl p-5 border border-border/80 hover:border-primary/30 hover:bg-card/90 transition-all duration-300 flex flex-col sm:flex-row sm:items-start justify-between gap-3 overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="space-y-2 flex-1 min-w-0">
                                            <p className="text-xs font-black text-text-primary uppercase tracking-wide break-words leading-relaxed">{sub.plan_name}</p>
                                            
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-text-muted font-bold">
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <BookOpen size={10} className="text-primary/70 shrink-0" />
                                                    <span>Scope: {sub.subject_name ? `Paper - ${sub.subject_name}` : sub.group ? `${sub.group.replace('_', ' ')}` : sub.plan_scope === 'PAPER_WISE' ? 'Paper Wise' : sub.plan_scope === 'GROUP_WISE' ? 'Group Wise' : 'Whole Course'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Clock size={10} className="text-primary/70 shrink-0" />
                                                    <span>Duration: {sub.plan_duration === 9999 ? 'Lifetime' : `${sub.plan_duration || 30} Days`} ({sub.plan_billing_cycle?.replace('_', ' ') || 'Monthly'})</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Calendar size={10} className="text-primary/70 shrink-0" />
                                                    <span>Purchased: {new Date(sub.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Calendar size={10} className="text-primary/70 shrink-0" />
                                                    <span>Expires: {new Date(sub.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="shrink-0 flex items-center sm:mt-0.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                isExpired
                                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                    : daysLeft <= 5
                                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                                                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                            }`}>
                                                {!isExpired && (
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                        daysLeft <= 5 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'
                                                    }`} />
                                                )}
                                                {isExpired ? 'Expired' : `${daysLeft} days left`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
