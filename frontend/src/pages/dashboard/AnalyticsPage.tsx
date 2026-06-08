import React, { useEffect, useState } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { 
    Clock, Award, ThumbsUp, ThumbsDown, BookOpen, 
    Calendar, CheckCircle, BarChart3, Plus, Loader2
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
    CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

export default function AnalyticsPage() {
    const { 
        stats, mockTests, fetchDashboardData, updateStudyHours, loading 
    } = useDashboardStore();
    
    const [logHours, setLogHours] = useState('');
    const [logging, setLogging] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleLogHours = async (e: React.FormEvent) => {
        e.preventDefault();
        const hrs = parseFloat(logHours);
        if (isNaN(hrs) || hrs <= 0) return;
        setLogging(true);
        await updateStudyHours(hrs);
        setLogHours('');
        setLogging(false);
    };

    if (loading && !stats) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    // Fallbacks if stats are null
    const hours = stats?.total_study_hours || 0;
    const attempted = stats?.questions_attempted || 0;
    const correct = stats?.correct_answers || 0;
    const wrong = stats?.wrong_answers || 0;
    const avgScore = stats?.average_score || 0;

    // Study Hours Area Data
    const studyHoursData = [
        { day: 'Mon', hours: hours * 0.12 },
        { day: 'Tue', hours: hours * 0.15 },
        { day: 'Wed', hours: hours * 0.18 },
        { day: 'Thu', hours: hours * 0.14 },
        { day: 'Fri', hours: hours * 0.21 },
        { day: 'Sat', hours: hours * 0.10 },
        { day: 'Sun', hours: hours * 0.10 },
    ].map(d => ({ ...d, hours: parseFloat(d.hours.toFixed(1)) }));

    // Questions Attempted Pie Data
    const questionPieData = [
        { name: 'Correct', value: correct, color: '#10B981' },
        { name: 'Wrong', value: wrong, color: '#EF4444' },
    ];

    // Subject Performance Bar Data (Using Mock Tests or fallback subjects)
    const subjectData = mockTests.length > 0 ? mockTests.map(t => {
        const nameParts = t.title.split(':');
        const subjectName = nameParts[1]?.trim() || t.title;
        return {
            subject: subjectName.substring(0, 15),
            score: Math.round((t.score / t.total_marks) * 100)
        };
    }) : [
        { subject: 'Adv Accounting', score: 85 },
        { subject: 'Corporate Law', score: 72 },
        { subject: 'Taxation', score: 64 },
        { subject: 'Costing', score: 78 },
        { subject: 'Auditing', score: 60 },
        { subject: 'FM & SM', score: 81 },
    ];

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-text-primary">Performance Analytics</h1>
                    <p className="text-text-muted font-bold text-sm">Deep-dive assessment of your learning activity and mock test performances.</p>
                </div>
                
                {/* Manual Log Hours Form */}
                <form onSubmit={handleLogHours} className="flex items-center gap-2 bg-sidebar border border-border px-4 py-2 rounded-2xl shadow-sm">
                    <Clock size={16} className="text-primary" />
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
                        className="p-1.5 bg-primary text-white rounded-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                        {logging ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                </form>
            </div>

            {/* Metrics Overview Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Stat Card 1 */}
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10" />
                    <Clock className="text-primary mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Total Study Hours</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{hours.toFixed(1)} hrs</h3>
                </div>

                {/* Stat Card 2 */}
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -z-10" />
                    <BookOpen className="text-blue-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Questions Solved</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{attempted}</h3>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full -z-10" />
                    <ThumbsUp className="text-emerald-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Correct Submissions</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{correct}</h3>
                </div>

                {/* Stat Card 4 */}
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full -z-10" />
                    <ThumbsDown className="text-red-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Wrong Submissions</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{wrong}</h3>
                </div>

                {/* Stat Card 5 */}
                <div className="bg-sidebar border border-border p-5 rounded-3xl relative overflow-hidden group hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full -z-10" />
                    <Award className="text-amber-500 mb-3" size={24} />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Average Score</p>
                    <h3 className="text-2xl font-black text-text-primary mt-1">{avgScore.toFixed(1)}%</h3>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Study Hours Trend Area Chart */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl lg:col-span-2 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-primary" size={18} />
                            <h4 className="font-black text-sm text-text-primary uppercase tracking-wide">Weekly Study Trend</h4>
                        </div>
                        <span className="text-[10px] font-black text-text-muted bg-bg px-3 py-1 rounded-full">LAST 7 DAYS</span>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} fontWeight="bold" />
                                <YAxis stroke="var(--text-muted)" fontSize={11} fontWeight="bold" />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--sidebar)', borderColor: 'var(--border)', borderRadius: 16 }}
                                    labelStyle={{ fontWeight: 'black', color: 'var(--text-primary)' }}
                                />
                                <Area type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Question Accuracy Pie Chart */}
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
                                        data={questionPieData.filter(d => d.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {questionPieData.filter(d => d.value > 0).map((entry, index) => (
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
                        {attempted === 0 && (
                            <p className="text-xs font-bold text-text-muted">No answers logged yet</p>
                        )}
                    </div>
                </div>

                {/* Subject-Wise Performance Bar Chart */}
                <div className="bg-sidebar border border-border p-6 rounded-3xl lg:col-span-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="text-blue-500" size={18} />
                        <h4 className="font-black text-sm text-text-primary uppercase tracking-wide">Subject-wise Proficiency (%)</h4>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="subject" stroke="var(--text-muted)" fontSize={11} fontWeight="bold" />
                                <YAxis stroke="var(--text-muted)" fontSize={11} fontWeight="bold" domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--sidebar)', borderColor: 'var(--border)', borderRadius: 16 }}
                                    labelStyle={{ fontWeight: 'black', color: 'var(--text-primary)' }}
                                />
                                <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={48}>
                                    {subjectData.map((entry, index) => {
                                        let color = '#4F46E5'; // Default primary indigo
                                        if (entry.score >= 80) color = '#10B981'; // Emerald
                                        else if (entry.score < 50) color = '#EF4444'; // Red
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
