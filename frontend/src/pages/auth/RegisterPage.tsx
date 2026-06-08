import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, CheckCircle, Zap, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function RegisterPage() {
    const navigate = useNavigate();
    const register = useAuthStore((state) => state.register);
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        mobile: '',
        password: '',
        confirm_password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (form.password !== form.confirm_password) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            await register(form.full_name, form.mobile, form.email, form.password, '');
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.email?.[0] || err.response?.data?.detail || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/5 to-transparent -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[1100px] bg-white rounded-[3rem] shadow-2xl shadow-gray-200/50 flex flex-col md:flex-row-reverse overflow-hidden border border-white/50"
            >
                {/* Visual Side */}
                <div className="w-full md:w-1/2 bg-primary p-12 md:p-16 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent mix-blend-overlay" />
                    <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-white/10 rounded-full blur-[120px]" />

                    <div className="relative z-10 space-y-2">
                        <Link to="/" className="flex items-center gap-2 mb-16">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary text-xs font-black">QB</div>
                            <span className="text-xl font-black tracking-tighter">qubook.in</span>
                        </Link>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Start your <br /> Success Story</h2>
                        <p className="text-white/80 font-medium text-lg pt-4 max-w-sm">Create an account to access the most comprehensive professional exam materials in India.</p>
                    </div>

                    <div className="relative z-10 space-y-6 pt-12">
                        {[
                            "Instant access to 10k+ papers",
                            "Handwritten notes via Premium",
                            "AI Study Assistant unlocked"
                        ].map((text, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center"><Zap size={18} className="text-white fill-white" /></div>
                                <p className="text-sm font-bold text-white/90">{text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Side */}
                <div className="w-full md:w-1/2 p-12 md:p-16 flex flex-col justify-center">
                    <div className="mb-8 text-center md:text-left">
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Create Account</h1>
                        <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest text-[10px]">Join the future of smart learning</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-danger/5 text-danger text-[10px] font-black rounded-xl border border-danger/10 uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={form.full_name}
                                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                    placeholder="Sulthan Shafeer"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Mobile</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                    <input
                                        type="tel"
                                        required
                                        value={form.mobile}
                                        onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Confirm</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={form.confirm_password}
                                        onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-4 underline-offset-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-6"
                        >
                            {loading ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={20} strokeWidth={3} /> Create Account</>}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium text-gray-400">
                        Already have an account? <Link to="/login" className="text-primary font-black uppercase tracking-widest text-[10px] ml-2 hover:underline">Sign In</Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
