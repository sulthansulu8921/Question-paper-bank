import { motion } from 'framer-motion';
import { Bot, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AssistantPage() {
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 min-h-[calc(100vh-10rem)]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full bg-card rounded-[2.5rem] p-8 md:p-12 text-center shadow-xl border border-border relative overflow-hidden"
            >
                {/* Background glow effects */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />

                {/* Animated Mascot Icon */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                    <motion.div
                        animate={{ 
                            y: [0, -10, 0],
                            rotate: [0, 2, -2, 0]
                        }}
                        transition={{ 
                            duration: 4, 
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mx-auto border border-primary/20"
                    >
                        <Bot size={44} />
                    </motion.div>
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-1 -right-1 bg-accent text-white p-1.5 rounded-full shadow-lg border border-card"
                    >
                        <Sparkles size={14} />
                    </motion.div>
                </div>

                {/* Title and Badges */}
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.25em] bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/25 inline-block mb-4">
                    AI Assistant Update
                </span>
                <h1 className="text-3xl font-black text-text-primary mb-3 tracking-tight">Coming Soon</h1>
                
                {/* Descriptive Copy */}
                <p className="text-text-secondary font-semibold text-xs leading-relaxed mb-8 max-w-sm mx-auto">
                    We are currently upgrading our AI systems and expanding our server quotas. The Gemini-powered study assistant will be back online in the next major update!
                </p>

                {/* Action button */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 bg-primary hover:bg-opacity-95 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-primary/15 hover:scale-[1.02] active:scale-95 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Dashboard</span>
                </button>
            </motion.div>
        </div>
    );
}
