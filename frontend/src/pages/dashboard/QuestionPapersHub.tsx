import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, Layout, Info, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import QuestionTable from '@/components/dashboard/QuestionTable';

const groups = [
    {
        title: 'GROUP 1',
        subjects: [
            { id: 1, name: 'Advanced Accounting', code: 'PAPER 1' },
            { id: 2, name: 'Corporate and Other Laws', code: 'PAPER 2' },
            { id: 3, name: 'Taxation', code: 'PAPER 3' },
        ]
    },
    {
        title: 'GROUP 2',
        subjects: [
            { id: 4, name: 'Cost and Management Accounting', code: 'PAPER 4' },
            { id: 5, name: 'Auditing and Ethics', code: 'PAPER 5' },
            { id: 6, name: 'Financial Management and Strategic Management', code: 'PAPER 6' },
        ]
    }
];

export default function QuestionPapersHub() {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search');

    return (
        <div className="space-y-10 pb-20 px-10 w-full -m-8 bg-bg min-h-full">
            <div className="p-10">
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
                            {searchQuery ? 'SHOWING RESULTS ACROSS ALL SUBJECTS' : 'CA INTERMEDIATE · SELECT YOUR SUBJECT'}
                        </p>
                    </div>

                    <div className="px-6 py-3 bg-card rounded-2xl border border-border flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Info size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Course</p>
                            <p className="text-sm font-black text-text-primary leading-none mt-0.5">CA Intermediate</p>
                        </div>
                    </div>
                </div>

                {searchQuery ? (
                    <div className="mt-12">
                        <QuestionTable hideTabs={false} />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                            {groups.map((group, gIdx) => (
                                <motion.div
                                    key={group.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: gIdx * 0.1 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl font-black text-text-primary tracking-tight">{group.title}</h2>
                                        <div className="flex-1 h-[1px] bg-border" />
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{group.subjects.length} Subjects</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {group.subjects.map((subject) => (
                                            <Link
                                                key={subject.id}
                                                to={`/dashboard/papers/subject/${subject.id}`}
                                                className="group relative bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-[0_0_20px_var(--primary-glow)] hover:border-primary/20 transition-all overflow-hidden"
                                            >
                                                {/* Abstract background shape */}
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />

                                                <div className="relative flex items-center justify-between">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-2xl bg-bg text-text-muted group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all group-hover:rotate-12">
                                                            <BookOpen size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-text-primary group-hover:text-primary transition-colors pr-8">{subject.name}</h3>
                                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">{subject.code}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                        <ArrowRight size={20} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Resources Tip */}
                        <div className="bg-bg-secondary border border-border rounded-[3rem] p-12 text-text-primary relative overflow-hidden group mt-12 shadow-sm">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/20 transition-all duration-1000" />
                            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                                <div className="max-w-xl">
                                    <h3 className="text-3xl font-black mb-4 tracking-tight">Accessing Resources</h3>
                                    <p className="text-text-muted font-medium text-lg leading-relaxed">
                                        All question papers since 2018, including RTPs, MTPs, and Suggested Answers, are available in the tabular view. Select a subject to begin.
                                    </p>
                                </div>
                                <button className="px-10 py-5 bg-primary text-white rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-2xl">
                                    View Sample Paper
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
