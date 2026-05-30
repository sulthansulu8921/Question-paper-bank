import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileSearch, Download, Bookmark, ArrowRight, Zap, Star, Shield, Clock, GraduationCap, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import QuestionModal from '@/components/dashboard/QuestionModal';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';

export default function DashboardHome() {
    const navigate = useNavigate();
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // Live Backend Integrations
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

    // Compute active quick stats
    const activeCoursesCount = courses.filter((c: any) => c.is_active).length;
    const quickStats = [
        { label: 'Courses Active', value: activeCoursesCount.toString(), icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Papers Viewed', value: questions.length.toString(), icon: FileSearch, color: 'text-accent', bg: 'bg-accent/10' },
        { label: 'Downloads', value: '45', icon: Download, color: 'text-success', bg: 'bg-success/10' },
        { label: 'Saved Items', value: bookmarks.length.toString(), icon: Bookmark, color: 'text-primary', bg: 'bg-primary/10' },
    ];

    // Compute recent questions (first 3 from the fetched list)
    const recentQuestions = useMemo(() => {
        return questions.slice(0, 3);
    }, [questions]);

    const handleOpenQuestion = (q: any) => {
        setSelectedQuestion(q);
        setIsViewerOpen(true);
    };

    return (
        <div className="space-y-10 pb-20">
            {/* WELCOME SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                        <GraduationCap size={16} />
                        Academic Status: Active
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Welcome back, <span className="text-primary">Student</span>!</h1>
                    <p className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-[0.1em]">Ready to accelerate your CA preparation?</p>
                </div>
                <Link to="/dashboard/papers" className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 hover:-translate-y-1 transition-all flex items-center gap-3">
                    Start Learning <ArrowRight size={18} strokeWidth={3} />
                </Link>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickStats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-6 rounded-3xl border border-gray-50 shadow-sm flex items-center gap-5 group hover:shadow-xl hover:border-primary/20 transition-all duration-500 cursor-default"
                    >
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* DASHBOARD CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* RECENT ACTIVITY */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-gray-50 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <Clock size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">Recent Questions</h3>
                            </div>
                            <Link to="/dashboard/papers" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-2">
                                View Questbank <ArrowRight size={12} />
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {isLoadingQuestions ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                    <Loader2 className="animate-spin text-primary" size={32} strokeWidth={2} />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing live feed...</p>
                                </div>
                            ) : recentQuestions.length === 0 ? (
                                <p className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest py-10">No recent activity detected.</p>
                            ) : (
                                recentQuestions.map((q: any, idx: number) => (
                                    <motion.div
                                        key={q.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => handleOpenQuestion(q)}
                                        className="flex items-center justify-between p-5 rounded-2xl border border-gray-50 hover:bg-slate-50 hover:border-primary/10 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-primary font-black text-sm group-hover:bg-primary group-hover:text-white transition-all">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-gray-900 group-hover:text-primary transition-colors">{q.topic_name || q.topic}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{q.source} · {q.q_no || q.qNo}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-300 group-hover:bg-primary group-hover:text-white transition-all">
                                            <ArrowRight size={20} />
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* FEATURES HIGHLIGHT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-[#1E2B63] to-[#3F51B5] p-8 rounded-[2.5rem] text-white relative overflow-hidden group shadow-xl">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                                <Zap className="text-amber-400" size={24} />
                            </div>
                            <h4 className="text-xl font-black mb-3">AI Study Helper</h4>
                            <p className="text-white/70 text-sm font-medium mb-6 leading-relaxed">Need help with a tricky accounting concept? Our Assistant is here 24/7.</p>
                            <button className="px-8 py-3 bg-white text-[#1E2B63] rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform">Launch Assistant</button>
                        </div>
                        <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] relative overflow-hidden group shadow-sm hover:shadow-xl transition-all duration-500">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700" />
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
                                <Star className="text-amber-500 fill-amber-500" size={24} />
                            </div>
                            <h4 className="text-xl font-black mb-3 text-slate-900">Premium Vault</h4>
                            <p className="text-slate-500 text-sm font-medium mb-6 leading-relaxed">Unlock handwritten notes and exclusive MCQ banks today.</p>
                            <button className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-primary transition-all">Upgrade Plan</button>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR WIDGETS */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-gray-50 shadow-lg p-10 text-center flex flex-col items-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-accent" />
                        <div className="w-24 h-24 bg-primary/5 text-primary rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-inner">
                            <Shield size={40} />
                        </div>
                        <h4 className="text-2xl font-black text-gray-900 mb-3">Go Pro Today</h4>
                        <p className="text-gray-400 text-sm font-medium mb-10 leading-relaxed px-2">Access the complete vault of professional resources correctly mapped to your syllabus.</p>
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Lifetime Access</span>
                                <span className="text-sm font-black text-slate-900 mr-2">₹1,999</span>
                            </div>
                            <button className="w-full py-5 bg-primary text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">Subscribe Now</button>
                        </div>
                    </div>

                    <div className="bg-[#1E2B63] rounded-[2.5rem] shadow-xl p-8 text-white">
                        <h4 className="text-lg font-black mb-6 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                <Zap size={18} className="text-amber-400" />
                            </div>
                            Quick Tools
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => navigate('/dashboard/papers')} className="p-5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all flex flex-col items-center gap-3 group border border-white/5">
                                <FileSearch size={24} className="text-white/40 group-hover:text-white" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Search</span>
                            </button>
                            <button onClick={() => navigate('/dashboard/saved')} className="p-5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all flex flex-col items-center gap-3 group border border-white/5">
                                <Bookmark size={24} className="text-white/40 group-hover:text-white" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Saved</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cinematic Viewer Integration */}
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
