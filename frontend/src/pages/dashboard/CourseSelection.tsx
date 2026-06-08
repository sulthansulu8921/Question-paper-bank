import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Users, Star, Layers, Loader2 } from 'lucide-react';
import api from '@/api/axios';

interface Course {
    id: number;
    name: string;
    slug: string;
    short_description: string;
    thumbnail: string;
    color: string;
    is_premium: boolean;
    levels_count?: number;
}

export default function CourseSelection() {
    const { data: courses, isLoading } = useQuery<Course[]>({
        queryKey: ['courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Loading Syllabus...</p>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <span className="text-primary font-black uppercase tracking-widest text-[10px] mb-2 block">Choose your focus</span>
                    <h1 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">Available Courses</h1>
                </div>
                <div className="flex gap-2">
                    <button className="px-5 py-2.5 bg-card border border-border rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-bg-secondary transition-colors text-text-primary">All Categories</button>
                    <button className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">New Arrival</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(courses || []).map((course, idx) => (
                    <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <Link
                            to={`/dashboard/courses/${course.id}`}
                            className="bg-card p-8 rounded-[2.5rem] border border-border shadow-xl dark:shadow-none block group hover:translate-y-[-12px] transition-all duration-500 relative overflow-hidden"
                        >
                            {/* Premium Badge */}
                            {course.is_premium && (
                                <div className="absolute top-6 right-6 px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full z-10 shadow-lg shadow-accent/20">
                                    Premium
                                </div>
                            )}

                            {/* Course Icon/Thumbnail */}
                            <div
                                className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-white mb-8 shadow-2xl relative transition-transform duration-500 group-hover:scale-110"
                                style={{ backgroundColor: course.color || '#5B4BFF' }}
                            >
                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay rounded-[2rem]" />
                                <BookOpen size={40} className="relative z-10 p-0.5" />
                            </div>

                            <h3 className="text-2xl font-black text-text-primary mb-4 group-hover:text-primary transition-colors">{course.name}</h3>
                            <p className="text-text-secondary font-medium text-sm leading-relaxed mb-10 line-clamp-2">
                                {course.short_description || "Master your syllabus with comprehensive papers, suggested answers, and handwritten notes."}
                            </p>

                            <div className="pt-6 border-t border-border flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 text-text-primary font-black text-base">
                                            <Layers size={14} className="text-primary" /> {course.levels_count || 2}
                                        </div>
                                        <span className="text-text-muted text-[10px] font-black uppercase tracking-tighter">Levels</span>
                                    </div>
                                    <div className="w-[1px] h-8 bg-border mx-1" />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 text-text-primary font-black text-base">
                                            <Star size={14} className="text-accent fill-accent" /> 4.9
                                        </div>
                                        <span className="text-text-muted text-[10px] font-black uppercase tracking-tighter">Rating</span>
                                    </div>
                                </div>

                                <div className="w-12 h-12 rounded-2xl bg-bg text-text-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                                    <ChevronRight size={24} strokeWidth={3} />
                                </div>
                            </div>

                            {/* Hover Glow */}
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-[40px] group-hover:bg-primary/10 transition-colors" />
                        </Link>
                    </motion.div>
                ))}

                {/* Placeholder for future growth */}
                <div className="bg-card/50 border-4 border-dashed border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center opacity-60">
                    <div className="w-16 h-16 rounded-full bg-bg flex items-center justify-center text-text-muted mb-4">
                        <Users size={32} />
                    </div>
                    <h4 className="font-black text-text-primary uppercase tracking-widest text-xs">Request Course</h4>
                    <p className="text-[10px] font-bold text-text-secondary mt-1 max-w-[150px]">Don't see your course? Tell our team to add it.</p>
                </div>
            </div>
        </div>
    );
}
