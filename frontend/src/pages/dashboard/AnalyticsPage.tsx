import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { 
    Clock, Award, ThumbsUp, ThumbsDown, BookOpen, 
    CheckCircle, BarChart3, Plus, Loader2,
    ShieldAlert, Play
} from 'lucide-react';
import { 
    ResponsiveContainer, XAxis, YAxis, Tooltip, 
    CartesianGrid, BarChart as RechartsBarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { useDashboardStore } from '@/store/useDashboardStore';

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const { stats, fetchDashboardData, updateStudyHours } = useDashboardStore();
    
    const [logHours, setLogHours] = useState('');
    const [logging, setLogging] = useState(false);
    const [isStartingPractice, setIsStartingPractice] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Load completed sessions from backend
    const { data: sessions = [] } = useQuery<any[]>({
        queryKey: ['assessment-sessions-list'],
        queryFn: async () => {
            const res = await api.get('/materials/assessment-sessions/');
            return Array.isArray(res.data) ? res.data : (res.data.results || []);
        }
    });

    // Load weakness suggestions
    const { data: weaknessResponse, isLoading: weaknessesLoading } = useQuery<any>({
        queryKey: ['weaknesses-report'],
        queryFn: async () => (await api.get('/materials/assessment-sessions/weaknesses/')).data
    });

    const weaknesses = weaknessResponse?.weaknesses || [];

    const handleLogHours = async (e: React.FormEvent) => {
        e.preventDefault();
        const hrs = parseFloat(logHours);
        if (isNaN(hrs) || hrs <= 0) return;
        setLogging(true);
        await updateStudyHours(hrs);
        setLogHours('');
        setLogging(false);
    };

    // Mutation to start practice from weakness recommendation card
    const handleStartWeaknessPractice = async (weakness: any) => {
        const key = `${weakness.subject}-${weakness.topic}`;
        setIsStartingPractice(key);
        try {
            const payload = {
                session_type: 'PRACTICE',
                title: `Weakness Trainer: ${weakness.topic}`,
                qualification: weakness.qualification,
                course_level: weakness.course_level,
                subject: weakness.subject,
                chapter: weakness.chapter,
                topic: weakness.topic,
                total_questions: weakness.recommended_questions || 25,
                difficulty: 'MIXED',
                mode: 'LEARNING'
            };
            const res = await api.post('/materials/assessment-sessions/', payload);
            navigate(`/dashboard/practice/session/${res.data.id}`);
        } catch (err) {
            console.error('Failed to start trainer session', err);
        } finally {
            setIsStartingPractice(null);
        }
    };

    // Calculate aggregated metrics from sessions
    const completedSessions = useMemo(() => sessions.filter(s => s.is_completed), [sessions]);
    const mockTestSessions = useMemo(() => completedSessions.filter(s => s.session_type === 'MOCK'), [completedSessions]);
    const practiceSessions = useMemo(() => completedSessions.filter(s => s.session_type === 'PRACTICE'), [completedSessions]);

    const overallStats = useMemo(() => {
        if (completedSessions.length === 0) {
            return {
                averageAccuracy: 0,
                totalQuestionsSolved: 0,
                totalTimeSpentMinutes: 0
            };
        }
        const totalAccuracy = completedSessions.reduce((acc, s) => acc + (s.accuracy || 0), 0);
        const totalQuestions = completedSessions.reduce((acc, s) => acc + (s.total_questions || 0), 0);
        const totalDurationSecs = completedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

        return {
            averageAccuracy: totalAccuracy / completedSessions.length,
            totalQuestionsSolved: totalQuestions,
            totalTimeSpentMinutes: Math.round(totalDurationSecs / 60)
        };
    }, [completedSessions]);

    // Format Pie chart data
    const pieData = useMemo(() => {
        const correct = completedSessions.reduce((acc, s) => acc + Math.round((s.accuracy / 100) * s.total_questions), 0);
        const total = completedSessions.reduce((acc, s) => acc + s.total_questions, 0);
        const wrong = Math.max(total - correct, 0);

        return [
            { name: 'Correct Answers', value: correct, color: '#10B981' },
            { name: 'Wrong Answers', value: wrong, color: '#EF4444' }
        ];
    }, [completedSessions]);

    // Group subject performances for Bar Chart
    const subjectProficiencyData = useMemo(() => {
        const subjectScores: { [sub: string]: { totalAccuracy: number; count: number } } = {};
        completedSessions.forEach(s => {
            const subName = s.subject || 'General';
            if (!subjectScores[subName]) {
                subjectScores[subName] = { totalAccuracy: 0, count: 0 };
            }
            subjectScores[subName].totalAccuracy += s.accuracy || 0;
            subjectScores[subName].count += 1;
        });

        const chartData = Object.keys(subjectScores).map(subName => ({
            subject: subName.substring(0, 15),
            score: Math.round(subjectScores[subName].totalAccuracy / subjectScores[subName].count)
        }));

        if (chartData.length === 0) {
            return [
                { subject: 'Syllabus Core', score: 80 },
                { subject: 'Topic Review', score: 65 }
            ];
        }
        return chartData;
    }, [completedSessions]);

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Performance Analytics</h1>
                    <p className="text-slate-500 font-semibold text-sm">Deep-dive assessment of your learning activity and mock test performances.</p>
                </div>
                
                {/* Manual Log Hours Form */}
                <form onSubmit={handleLogHours} className="flex items-center gap-2 bg-sidebar border border-border px-4 py-2 rounded-2xl shadow-sm">
                    <Clock size={16} className="text-indigo-600" />
                    <input 
                        type="number" 
                        step="0.5" 
                        placeholder="Log study hours (e.g. 2.5)" 
                        value={logHours} 
                        onChange={(e) => setLogHours(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs font-bold w-44 focus:ring-0"
                    />
                    <button 
                        type="submit" 
                        disabled={logging} 
                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                        {logging ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                </form>
            </div>

            {/* Metrics Overview Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <Clock className="text-indigo-600 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Total Study Hours</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{(stats?.total_study_hours || 0).toFixed(1)} hrs</h3>
                </div>

                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <BookOpen className="text-blue-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Mocks Attempted</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{mockTestSessions.length}</h3>
                </div>

                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <ThumbsUp className="text-emerald-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Practice Sets</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{practiceSessions.length}</h3>
                </div>

                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <ThumbsDown className="text-red-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Questions Answered</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{overallStats.totalQuestionsSolved}</h3>
                </div>

                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
                    <Award className="text-amber-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Average Accuracy</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{Math.round(overallStats.averageAccuracy)}%</h3>
                </div>
            </div>

            {/* Weakness Detection recommendations */}
            <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                <div className="flex items-center gap-2.5 pb-4 border-b border-border">
                    <ShieldAlert className="text-red-500 animate-pulse" size={22} />
                    <div>
                        <h2 className="text-md font-black text-slate-900">Weakness Detection & Recommendations</h2>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Chapters where your accuracy is below 60% requiring priority focus.</p>
                    </div>
                </div>

                {weaknessesLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="animate-spin text-indigo-600" />
                    </div>
                ) : weaknesses.length === 0 ? (
                    <div className="p-8 border border-dashed border-border rounded-2xl text-center space-y-2">
                        <CheckCircle className="text-emerald-500 mx-auto" size={28} />
                        <h4 className="text-xs font-black text-slate-900">No Weaknesses Detected!</h4>
                        <p className="text-[11px] text-slate-500 font-semibold max-w-sm mx-auto">
                            Awesome job! Continue taking practice sets and mocks to maintain high-level proficiency.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weaknesses.map((weak: any, idx: number) => {
                            const isStarting = isStartingPractice === `${weak.subject}-${weak.topic}`;
                            return (
                                <div 
                                    key={idx}
                                    className="bg-bg border border-border p-5 rounded-2xl flex items-start justify-between gap-4 hover:shadow-sm transition-all"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase">
                                                {weak.accuracy}% Accuracy
                                            </span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase">
                                                {weak.qualification} • {weak.course_level}
                                            </span>
                                        </div>
                                        <h4 className="text-xs font-black text-slate-900 pt-1">
                                            {weak.topic}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 font-semibold">
                                            Subject: <span className="text-slate-700">{weak.subject}</span> • Chapter: <span className="text-slate-700">{weak.chapter}</span>
                                        </p>
                                        <p className="text-[10px] text-indigo-600 font-black pt-1">
                                            Recommended: Solve {weak.recommended_questions} Practice Questions
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleStartWeaknessPractice(weak)}
                                        disabled={!!isStartingPractice}
                                        className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-sm transition-colors"
                                    >
                                        {isStarting ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <Play size={12} />
                                        )}
                                        <span>Start Practice</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Accuracy Ratio */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <CheckCircle className="text-emerald-500" size={18} />
                        <h4 className="font-black text-sm text-text-primary uppercase tracking-wide">Accuracy Ratio</h4>
                    </div>
                    <div className="h-72 flex flex-col justify-between items-center">
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData.filter(d => d.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.filter(d => d.value > 0).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ background: 'var(--sidebar)', borderColor: 'var(--border)', borderRadius: 16 }}
                                    />
                                    <Legend formatter={(value) => <span className="text-xs font-bold text-text-primary">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {completedSessions.length === 0 && (
                            <p className="text-xs font-bold text-text-muted">No answers logged yet</p>
                        )}
                    </div>
                </div>

                {/* Subject-Wise Performance */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl lg:col-span-2 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="text-indigo-600" size={18} />
                        <h4 className="font-black text-sm text-text-primary uppercase tracking-wide">Subject-wise Proficiency (%)</h4>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={subjectProficiencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="subject" stroke="var(--text-muted)" fontSize={11} fontWeight="bold" />
                                <YAxis stroke="var(--text-muted)" fontSize={11} fontWeight="bold" domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--sidebar)', borderColor: 'var(--border)', borderRadius: 16 }}
                                    labelStyle={{ fontWeight: 'black', color: 'var(--text-primary)' }}
                                />
                                <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={48}>
                                    {subjectProficiencyData.map((entry, index) => {
                                        let color = '#4F46E5'; 
                                        if (entry.score >= 80) color = '#10B981'; 
                                        else if (entry.score < 50) color = '#EF4444'; 
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Bar>
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
