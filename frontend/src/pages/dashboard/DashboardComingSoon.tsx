import { motion } from 'framer-motion';
import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardComingSoon({ title }: { title: string }) {
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex items-center justify-center p-12 bg-bg">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-card rounded-[2.5rem] p-12 text-center shadow-xl dark:shadow-none border border-border"
            >
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8">
                    <Construction size={40} />
                </div>

                <h1 className="text-3xl font-black text-text-primary mb-4 tracking-tight">{title}</h1>
                <p className="text-text-secondary font-medium mb-10 leading-relaxed">
                    We're currently building the {title.toLowerCase()} module. This feature will be available in the next major update.
                </p>

                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3 group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );
}
