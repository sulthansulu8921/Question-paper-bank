import QuestionTable from '@/components/dashboard/QuestionTable';
import { Bookmark, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';

export default function SavedQuestionsPage() {
    // Viewer logic is now self-contained within QuestionTable
    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: async () => (await api.get('/materials/bookmarks/')).data,
    });

    return (
        <div className="space-y-8 pb-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <Bookmark size={18} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Personal Repository</span>
                    </div>
                    <h1 className="text-4xl font-black text-text-primary tracking-tight flex items-center gap-4">
                        Saved Materials
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full">
                            <Sparkles size={12} className="text-primary" />
                            <span className="text-[10px] font-black text-primary">PREMIUM HUB</span>
                        </div>
                    </h1>
                    <p className="text-text-secondary font-bold mt-2 text-sm italic">Review and master the questions you've marked as important.</p>
                </motion.div>

                <div className="flex gap-4">
                    <div className="p-4 bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[120px]">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Total Saved</span>
                        <span className="text-2xl font-black text-primary">{bookmarks.length}</span>
                    </div>
                </div>
            </div>

            {/* Questions Hub Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-[32px] border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden"
            >
                {/* Pre-filtered for only 'important' items as requested. navigation is internal. */}
                <QuestionTable
                    defaultFilter="saved"
                    hideTabs={true}
                />
            </motion.div>
        </div>
    );
}
