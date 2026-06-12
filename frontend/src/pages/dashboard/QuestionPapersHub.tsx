import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, Layout, Info, Search, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import QuestionTable from '@/components/dashboard/QuestionTable';

export default function QuestionPapersHub() {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search');
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

    // Fetch Courses (including nested levels & subjects)
    const { data: courses = [], isLoading } = useQuery<any[]>({
        queryKey: ['courses'],
        queryFn: async () => {
            const res = await api.get('/courses/courses/');
            return res.data;
        },
    });

    const activeCourseId = selectedCourseId || courses[0]?.id || null;
    const activeCourse = courses.find((c) => c.id === activeCourseId);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-bg">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 px-4 md:px-10 w-full -m-8 bg-bg min-h-full">
            <div className="p-4 md:p-10">
                {/* Header Area */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                {searchQuery ? <Search size={20} /> : <Layout size={20} />}
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em]">{searchQuery ? 'Global Search' : 'Material Hub'}</span>
                        </div>
                        <h1 className="text-4xl font-black text-text-primary tracking-tight">
                            {searchQuery ? `Search Results: "${searchQuery}"` : 'Question Papers'}
                        </h1>
                        <p className="text-text-muted font-bold text-sm tracking-wide mt-2">
                            {searchQuery ? 'SHOWING RESULTS ACROSS ALL SUBJECTS' : `${activeCourse?.name || 'COURSES'} · SELECT YOUR SUBJECT`}
                        </p>
                    </div>

                    {!searchQuery && activeCourse && (
                        <div className="px-6 py-3 bg-card rounded-2xl border border-border flex items-center gap-4 self-start md:self-auto">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Info size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Course</p>
                                <p className="text-sm font-black text-text-primary leading-none mt-0.5">{activeCourse.name}</p>
                            </div>
                        </div>
                    )}
                </div>

                {searchQuery ? (
                    <div className="mt-12">
                        <QuestionTable hideTabs={false} />
                    </div>
                ) : (
                    <>
                        {/* Course Selector Tabs */}
                        {courses.length > 1 && (
                            <div className="mt-10 flex flex-wrap bg-card p-1.5 rounded-[2rem] border border-border gap-1 w-fit">
                                {courses.map((course) => (
                                    <button
                                        key={course.id}
                                        onClick={() => setSelectedCourseId(course.id)}
                                        className={`px-8 py-3.5 rounded-[1.5rem] text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                                            activeCourseId === course.id
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                                        }`}
                                    >
                                        {course.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Levels & Subjects Sections */}
                        <div className="mt-12 space-y-12">
                            {activeCourse?.levels && activeCourse.levels.length > 0 ? (
                                activeCourse.levels.map((level: any, lIdx: number) => (
                                    <motion.div
                                        key={level.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: lIdx * 0.1 }}
                                        className="space-y-6"
                                    >
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-xl font-black text-text-primary tracking-tight uppercase">{level.name}</h2>
                                            <div className="flex-1 h-[1px] bg-border" />
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{level.subjects?.length || 0} Subjects</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {level.subjects?.map((subject: any) => (
                                                <Link
                                                    key={subject.id}
                                                    to={`/dashboard/papers/subject/${subject.id}`}
                                                    className="group relative bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)] hover:border-primary/20 transition-all overflow-hidden flex flex-col justify-between min-h-[140px]"
                                                >
                                                    {/* Abstract background shape */}
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />

                                                    <div className="relative flex items-start justify-between w-full">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-bg text-text-muted group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all group-hover:rotate-12 shrink-0">
                                                                <BookOpen size={20} />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-black text-text-primary group-hover:text-primary transition-colors text-sm pr-4 line-clamp-2">
                                                                    {subject.name}
                                                                </h3>
                                                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">
                                                                    {subject.code || `Paper ${subject.id}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                                                            <ArrowRight size={16} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-card rounded-[2.5rem] border border-border">
                                    <Info className="mx-auto text-text-muted mb-4 animate-bounce" size={40} />
                                    <p className="text-sm font-black text-text-muted uppercase tracking-widest">No subjects configured for this course yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Resources Tip */}
                        <div className="bg-bg-secondary border border-border rounded-[3rem] p-12 text-text-primary relative overflow-hidden group mt-12 shadow-sm">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/20 transition-all duration-1000" />
                            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                                <div className="max-w-xl">
                                    <h3 className="text-3xl font-black mb-4 tracking-tight">Accessing Resources</h3>
                                    <p className="text-text-muted font-medium text-lg leading-relaxed">
                                        All question papers, including RTPs, MTPs, and Suggested Answers, are available in the split-screen view. Select a subject to begin.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
