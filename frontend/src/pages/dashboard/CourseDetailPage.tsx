import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Book, ChevronRight, Lock, Loader2, ArrowLeft } from 'lucide-react';
import api from '@/api/axios';

interface Course {
    id: number;
    name: string;
    description: string;
    thumbnail: string;
    banner: string;
    color: string;
    is_premium: boolean;
    levels: Array<{
        id: number;
        name: string;
        subjects: Array<{
            id: number;
            name: string;
            code: string;
        }>;
    }>;
}

export default function CourseDetailPage() {
    const { id } = useParams();
    const { data: course, isLoading } = useQuery<Course>({
        queryKey: ['course', id],
        queryFn: async () => (await api.get(`/courses/courses/${id}/`)).data,
    });

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>;
    if (!course) return <div className="p-20 text-center">Course not found.</div>;

    return (
        <div className="space-y-10 pb-20">
            {/* Header */}
            <div className="relative h-64 md:h-80 rounded-[2.5rem] overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${course.banner || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop'})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

                <div className="absolute inset-x-8 bottom-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <Link to="/dashboard/courses" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors">
                            <ArrowLeft size={16} /> Courses
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{course.name}</h1>
                        <p className="text-white/80 mt-3 text-lg line-clamp-2">{course.description}</p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <span className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold border border-white/20">
                            {course.levels.length} Levels
                        </span>
                        {course.is_premium && (
                            <span className="px-4 py-2 bg-accent text-white rounded-full text-sm font-bold flex items-center gap-2">
                                <Lock size={14} /> Premium
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Levels & Subjects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {course.levels.map((level, idx) => (
                    <motion.div
                        key={level.id}
                        initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
                    >
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Layers className="text-primary" size={20} /> {level.name}
                            </h2>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{level.subjects.length} Subjects</span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {level.subjects.map((subject) => (
                                <div key={subject.id} className="p-6 flex items-center justify-between group hover:bg-primary/[0.02] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                            <Book size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{subject.name}</h4>
                                            <p className="text-xs text-gray-400 font-medium">Subject Code: {subject.code}</p>
                                        </div>
                                    </div>

                                    <Link
                                        to={`/dashboard/papers/subject/${subject.id}`}
                                        className="p-2 text-gray-400 hover:text-primary bg-gray-50 group-hover:bg-primary/10 rounded-xl transition-all"
                                    >
                                        <ChevronRight size={20} />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Enrollment Card Placeholder */}
            <div className="bg-gradient-to-r from-primary to-accent rounded-[2rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-xl text-center md:text-left">
                    <h3 className="text-3xl font-bold mb-2">Ready to master this course?</h3>
                    <p className="text-white/80">Premium subscribers get access to all {course.name} question papers, suggested answers, and handwritten notes.</p>
                </div>
                <button className="px-10 py-5 bg-white text-primary rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-2xl">
                    Unlock Full Access
                </button>
            </div>
        </div>
    )
}

function Layers(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
    );
}
