import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent -z-10" />
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -z-10 animate-pulse-slow" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[1100px] bg-white rounded-[3rem] shadow-2xl shadow-gray-200/50 flex flex-col md:flex-row overflow-hidden border border-white/50"
            >
                {/* Visual Side */}
                <div className="w-full md:w-1/2 bg-secondary p-12 md:p-16 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent mix-blend-overlay" />
                    <div className="absolute top-20 right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

                    <div className="relative z-10 space-y-2">
                        <Link to="/" className="flex items-center gap-2 mb-16 hover:scale-105 transition-transform duration-300">
                            <img src="/logo.png" alt="Qubook Logo" className="h-10 object-contain" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))' }} />
                        </Link>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Elevate your <br /> Exam Preparation</h2>
                        <p className="text-white/60 font-medium text-lg pt-4 max-w-sm">Join 50,000+ students already mastering their professional syllabus.</p>
                    </div>

                    <div className="relative z-10 space-y-6 pt-12">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><CheckCircle size={20} className="text-primary" /></div>
                            <p className="text-sm font-bold text-white/80">Premium content updated daily</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><ShieldCheck size={20} className="text-accent" /></div>
                            <p className="text-sm font-bold text-white/80">Secure anti-piracy downloads</p>
                        </div>
                    </div>
                </div>

                {/* Form Side */}
                <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
                    <div className="mb-10 text-center md:text-left">
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Welcome Back</h1>
                        <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest">Sign in to your student account</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-8 p-4 bg-danger/10 text-danger text-xs font-black rounded-xl border border-danger/20 uppercase tracking-widest text-center"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
                                <button type="button" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot?</button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:translate-y-[-2px] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-4"
                        >
                            {loading ? <Loader2 size={24} className="animate-spin" /> : <><ArrowRight size={20} strokeWidth={3} /> Login Account</>}
                        </button>
                    </form>

                    <div className="mt-12 text-center text-sm font-medium text-gray-400">
                        New to Study Partner? <Link to="/register" className="text-primary font-black uppercase tracking-widest text-[10px] ml-2 hover:underline">Join Today</Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
