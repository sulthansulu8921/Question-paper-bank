import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import lightBg from '@/assets/light-portal-bg.png';

export default function ComingSoonPage() {
    return (
        <div className="min-h-[100dvh] bg-[#F8FAFC] font-sans flex items-center justify-center p-6 relative overflow-hidden">
            {/* BACKGROUND SYSTEM */}
            <div className="absolute inset-0 z-0">
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage: `url(${lightBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(12px) brightness(1.2)'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/90 via-white/70 to-[#F8FAFC]/90" />

                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] max-w-[800px] max-h-[800px] bg-[#4F46E5]/20 blur-[120px] rounded-full mix-blend-multiply"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-2xl bg-white/80 backdrop-blur-2xl border border-white p-12 md:p-20 rounded-[3rem] shadow-2xl shadow-indigo-500/10 text-center relative z-10"
            >
                <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] rounded-[2rem] flex items-center justify-center text-white mb-10 shadow-lg shadow-indigo-500/30">
                    <Clock size={48} strokeWidth={2} />
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-[#0F172A] mb-6 tracking-tight">
                    Coming <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]">Soon</span>
                </h1>

                <p className="text-slate-500 text-lg font-medium leading-relaxed mb-12">
                    We're working incredibly hard to bring premium resources for this course to the qubook.in platform. Our faculty is finalizing the materials to ensure you get the absolute best.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/" className="w-full sm:w-auto px-8 py-4 bg-white text-[#0F172A] border border-slate-200 rounded-2xl font-bold text-sm tracking-widest uppercase hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3">
                        <ArrowLeft size={18} /> Back to Portal
                    </Link>
                    <button className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white rounded-2xl font-bold text-sm tracking-widest uppercase shadow-lg shadow-indigo-500/30 hover:-translate-y-1 hover:shadow-indigo-500/50 transition-all flex items-center justify-center gap-3">
                        <Sparkles size={18} /> Notify Me
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
