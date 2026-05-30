import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Loader2, ArrowRight, CheckCircle, ShieldCheck, Zap, Laptop } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const activeTabParams = searchParams.get('tab') === 'login' ? 'login' : 'register';
    const [tab, setTab] = useState<'login' | 'register'>(activeTabParams);

    // Auth Store
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);

    // Form States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        mobile: '',
        password: '',
        confirm_password: '',
        remember_me: false
    });

    const selectedCourse = searchParams.get('course');

    useEffect(() => {
        setTab(activeTabParams);
    }, [activeTabParams]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await login(formData.email, formData.password);
            const user = useAuthStore.getState().user;
            if (user?.is_staff) {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');

        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match');
            setLoading(false); return;
        }

        try {
            await register(formData.full_name, formData.mobile, formData.email, formData.password);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Registration Error:', err);
            const errData = err.response?.data;
            if (errData && typeof errData === 'object') {
                // DRF often returns { "field": ["error message"] } or { "detail": "message" }
                // We want to find the first string message we can
                const messages: string[] = [];
                Object.entries(errData).forEach(([key, value]) => {
                    const prefix = key !== 'detail' ? `${key}: ` : '';
                    if (Array.isArray(value)) {
                        messages.push(`${prefix}${value[0]}`);
                    } else if (typeof value === 'string') {
                        messages.push(`${prefix}${value}`);
                    }
                });
                setError(messages[0] || 'Registration failed');
            } else {
                setError('Registration failed. Please check your connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex items-center justify-center p-4 md:p-10 relative overflow-hidden text-slate-800 selection:bg-primary/30">
            {/* BG */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent -z-10" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-6xl h-full min-h-[700px] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/50"
            >
                {/* Visual Side (Left) */}
                <div className="w-full md:w-5/12 bg-slate-900 p-12 md:p-16 text-white flex flex-col justify-between relative">
                    <div className="absolute inset-0 bg-primary/20 mix-blend-overlay" />

                    <div className="relative z-10">
                        <Link to="/" className="flex items-center gap-2 mb-16 group">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-black group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">SP</div>
                            <span className="text-xl font-black tracking-tight text-white">Study Partner</span>
                        </Link>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black leading-tight">Master your <span className="text-primary italic">goals.</span></h2>
                            <p className="text-white/50 font-medium text-lg max-w-sm">Join India's most trusted portal for professional exam preparation.</p>
                        </div>
                    </div>

                    <div className="relative z-10 space-y-6">
                        {[
                            { icon: CheckCircle, text: "Verified solutions by industry experts", color: "text-primary" },
                            { icon: Zap, text: "Split-screen paper & answer viewer", color: "text-accent" },
                            { icon: ShieldCheck, text: "Secure enterprise-grade PDF delivery", color: "text-success" },
                            { icon: Laptop, text: "Seamless mobile & desktop transition", color: "text-white" }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <item.icon size={20} className={item.color} />
                                <span className="text-sm font-bold text-white/80">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="relative z-10 pt-12 border-t border-white/10 mt-12 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/30">
                        <span>© 2024 Portal</span>
                        <span>v3.0 Premium</span>
                    </div>
                </div>

                {/* Form Side (Right) */}
                <div className="w-full md:w-7/12 p-10 md:p-20 overflow-y-auto bg-white">
                    {/* TABS */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-12 w-fit mx-auto md:mx-0">
                        <button
                            onClick={() => setTab('login')}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'login' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setTab('register')}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'register' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Register
                        </button>
                    </div>

                    <div className="mb-10 text-center md:text-left">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                            {tab === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h1>
                        <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest">
                            {tab === 'login' ? 'Sign in to access your dashboard' : 'Join thousands of successful students'}
                        </p>
                    </div>

                    {selectedCourse && (
                        <div className="mb-8 p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-2">Course Track</span>
                            <span className="text-xs font-black text-slate-900 bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100 italic">
                                {selectedCourse.toUpperCase().replace('-', ' ')}
                            </span>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {tab === 'login' ? (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleLogin}
                                className="space-y-6"
                            >
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center shadow-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email or Mobile</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                        <input name="email" required value={formData.email} onChange={handleInputChange} placeholder="name@example.com" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
                                        <button type="button" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot?</button>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                        <input type="password" name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-1">
                                    <input type="checkbox" id="remember" name="remember_me" checked={formData.remember_me} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                    <label htmlFor="remember" className="text-xs font-bold text-gray-500">Remember me for 30 days</label>
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3 disabled:opacity-70">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <><ArrowRight size={18} /> Sign In</>}
                                </button>

                                <div className="pt-6 text-center">
                                    <button type="button" className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">Login with OTP Instead?</button>
                                </div>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="register"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleRegister}
                                className="space-y-5"
                            >
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center shadow-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                        <input name="full_name" required value={formData.full_name} onChange={handleInputChange} placeholder="John Doe" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email ID</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="john@email.com" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Mobile Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="tel" name="mobile" required value={formData.mobile} onChange={handleInputChange} placeholder="+91 00000 00000" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="password" name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Confirm</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="password" name="confirm_password" required value={formData.confirm_password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-4">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={18} /> Register Now</>}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
