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
                    <div className="flex items-center gap-2 text-[#3F51B5] mb-2">
                        <Bookmark size={18} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Personal Repository</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        Saved Materials
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#3F51B5]/5 border border-[#3F51B5]/10 rounded-full">
                            <Sparkles size={12} className="text-[#3F51B5]" />
                            <span className="text-[10px] font-black text-[#3F51B5]">PREMIUM HUB</span>
                        </div>
                    </h1>
                    <p className="text-slate-500 font-bold mt-2 text-sm italic">Review and master the questions you've marked as important.</p>
                </motion.div>

                <div className="flex gap-4">
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[120px]">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Saved</span>
                        <span className="text-2xl font-black text-[#3F51B5]">{bookmarks.length}</span>
                    </div>
                </div>
            </div>

            {/* Questions Hub Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
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
