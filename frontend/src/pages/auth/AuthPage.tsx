import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Loader2, ArrowRight, CheckCircle, ShieldCheck, Zap, Laptop, Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import Logo from '@/components/Logo';
import api from '@/api/axios';

export default function AuthPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const activeTabParams = searchParams.get('tab') === 'login' ? 'login' : 'register';
    const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(activeTabParams);

    // Auth Store
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const googleLogin = useAuthStore((state) => state.googleLogin);

    // Form States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        mobile: '',
        password: '',
        confirm_password: '',
        otp: '',
        remember_me: false
    });

    const [sendingOtp, setSendingOtp] = useState(false);
    const [otpSentMsg, setOtpSentMsg] = useState('');

    const selectedCourse = searchParams.get('course');
    const [categories, setCategories] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');

    useEffect(() => {
        api.get('/courses/categories/')
            .then(res => {
                const results = res.data.results || res.data || [];
                setCategories(results);
            })
            .catch(err => {
                console.error("Failed to fetch categories", err);
            });

        api.get('/courses/courses/')
            .then(res => {
                const results = res.data.results || res.data || [];
                setCourses(results);
            })
            .catch(err => {
                console.error("Failed to fetch courses", err);
            });
    }, []);

    useEffect(() => {
        if (courses.length > 0 && selectedCourse) {
            const matched = courses.find(c => c.slug === selectedCourse || c.name.toLowerCase() === selectedCourse.toLowerCase());
            if (matched) {
                setSelectedCourseId(matched.id.toString());
                if (matched.category) {
                    setSelectedCategoryId(matched.category.toString());
                }
            }
        }
    }, [courses, selectedCourse]);

    const handleCategoryChange = (catId: string) => {
        setSelectedCategoryId(catId);
        setSelectedCourseId('');
    };

    const handleGoogleCredentialResponse = async (response: any) => {
        setLoading(true);
        setError('');
        try {
            await googleLogin(response.credential);
            const user = useAuthStore.getState().user;
            if (user?.is_staff) {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Google Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setTab(activeTabParams);
    }, [activeTabParams]);

    useEffect(() => {
        let intervalId: any;

        const initializeGoogleSignIn = () => {
            const googleObj = (window as any).google;
            if (googleObj) {
                if (intervalId) clearInterval(intervalId);
                
                try {
                    googleObj.accounts.id.initialize({
                        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1008719970978-hb24n2dstb40o45q4feep2gpkrc25143.apps.googleusercontent.com',
                        callback: handleGoogleCredentialResponse,
                    });
                    
                    const renderBtn = () => {
                        const btnEl = document.getElementById('google-signin-button');
                        if (btnEl) {
                            btnEl.innerHTML = ''; // Clear previous button instance
                            googleObj.accounts.id.renderButton(
                                btnEl,
                                { theme: 'outline', size: 'large', width: 320, text: tab === 'register' ? 'signup_with' : 'signin_with' }
                            );
                        }
                    };

                    // Add a micro-delay to let the DOM element mount
                    setTimeout(renderBtn, 150);
                } catch (e) {
                    console.error("Google accounts.id initialize error:", e);
                }
            }
        };

        const googleObj = (window as any).google;
        if (googleObj) {
            initializeGoogleSignIn();
        } else {
            // Poll for window.google to handle lazy-load / async-defer scripts
            intervalId = setInterval(() => {
                if ((window as any).google) {
                    initializeGoogleSignIn();
                }
            }, 100);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [tab]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSendRegisterOtp = async () => {
        if (!formData.email.trim()) {
            setError('Email is required to send OTP.');
            return;
        }
        setSendingOtp(true);
        setError('');
        setOtpSentMsg('');
        try {
            const res = await api.post('/auth/register/request-otp/', { email: formData.email });
            setOtpSentMsg(res.data.message || 'OTP sent successfully.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please check your email.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleSendForgotPasswordOtp = async () => {
        if (!formData.email.trim()) {
            setError('Email is required to send OTP.');
            return;
        }
        setSendingOtp(true);
        setError('');
        setOtpSentMsg('');
        try {
            const res = await api.post('/auth/forgot-password/request-otp/', { email: formData.email });
            setOtpSentMsg(res.data.message || 'OTP sent successfully.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please check your email.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleForgotPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        setOtpSentMsg('');

        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match');
            setLoading(false); return;
        }

        if (!formData.otp.trim()) {
            setError('Please enter the OTP verification code.');
            setLoading(false); return;
        }

        try {
            const res = await api.post('/auth/forgot-password/reset/', {
                email: formData.email,
                otp: formData.otp,
                password: formData.password
            });
            setOtpSentMsg(res.data.message || 'Password reset successful!');
            setTimeout(() => {
                setTab('login');
                setOtpSentMsg('');
                setError('');
            }, 3000);
            setFormData(prev => ({
                ...prev,
                password: '',
                confirm_password: '',
                otp: ''
            }));
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
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
                const targetCourseId = user?.selected_course || selectedCourseId;
                if (targetCourseId) {
                    navigate(`/dashboard/courses/${targetCourseId}`);
                } else {
                    navigate('/dashboard');
                }
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

        if (!formData.otp.trim()) {
            setError('Please enter the OTP verification code.');
            setLoading(false); return;
        }

        try {
            await register(formData.full_name, formData.mobile, formData.email, formData.password, formData.otp, selectedCourseId);
            const user = useAuthStore.getState().user;
            const targetCourseId = user?.selected_course || selectedCourseId;
            if (targetCourseId) {
                navigate(`/dashboard/courses/${targetCourseId}`);
            } else {
                navigate('/dashboard');
            }
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
                        <Link to="/" className="flex items-center gap-2 mb-16 group hover:scale-105 transition-transform duration-300">
                            <Logo theme="dark" className="h-10 object-contain" />
                        </Link>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black leading-tight">Every Question Counts</h2>
                            <p className="text-white/50 font-medium text-lg max-w-sm">Join India's premium portal for CA Foundation, Intermediate, and Final preparation.</p>
                        </div>
                    </div>

                    <div className="relative z-10 space-y-6">
                        {[
                            { icon: CheckCircle, text: "Verified suggested answers by top CA faculties", color: "text-primary" },
                            { icon: Zap, text: "Split-screen question paper & answer key viewer", color: "text-accent" },
                            { icon: ShieldCheck, text: "Topic-wise previous year questions (PYQs)", color: "text-success" },
                            { icon: Laptop, text: "Model Test Papers & Revision Test Papers (MTP/RTP)", color: "text-white" }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <item.icon size={20} className={item.color} />
                                <span className="text-sm font-bold text-white/80">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="relative z-10 pt-12 border-t border-white/10 mt-12 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/30">
                        <span>© 2026 qubook.in</span>
                        <span>v3.0 Premium</span>
                    </div>
                </div>

                {/* Form Side (Right) */}
                <div className="w-full md:w-7/12 p-10 md:p-20 overflow-y-auto bg-white">
                    {/* TABS */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-12 w-fit mx-auto md:mx-0">
                        <button
                            onClick={() => { setTab('login'); setError(''); setOtpSentMsg(''); }}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'login' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => { setTab('register'); setError(''); setOtpSentMsg(''); }}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'register' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Register
                        </button>
                    </div>

                    <div className="mb-10 text-center md:text-left">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                            {tab === 'login' ? 'Welcome Back' : tab === 'register' ? 'Create Account' : 'Reset Password'}
                        </h1>
                        <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest">
                            {tab === 'login' 
                                ? 'Sign in to access your dashboard' 
                                : tab === 'register' 
                                    ? 'Join thousands of successful students' 
                                    : 'Verify your email to recover your account'}
                        </p>
                    </div>

                    {tab !== 'forgot' && (
                        <div className="mb-8 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                                    Qualification / Main stream *
                                </label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                                    <select
                                        value={selectedCategoryId}
                                        onChange={(e) => handleCategoryChange(e.target.value)}
                                        className="w-full bg-white border border-gray-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Qualification (CA, CMA, CS)</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>

                            {selectedCategoryId && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                                        Course Level Name *
                                    </label>
                                    <div className="relative group">
                                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                                        <select
                                            value={selectedCourseId}
                                            onChange={(e) => setSelectedCourseId(e.target.value)}
                                            className="w-full bg-white border border-gray-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="">Select Course Level</option>
                                            {courses
                                                .filter((c) => c.category?.toString() === selectedCategoryId.toString())
                                                .map((course) => (
                                                    <option key={course.id} value={course.id}>
                                                        {course.name}
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {tab === 'login' && (
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
                                        <button type="button" onClick={() => { setTab('forgot'); setError(''); setOtpSentMsg(''); }} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot?</button>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                        <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-12 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all" />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-1">
                                    <input type="checkbox" id="remember" name="remember_me" checked={formData.remember_me} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                    <label htmlFor="remember" className="text-xs font-bold text-gray-500">Remember me for 30 days</label>
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3 disabled:opacity-70">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <><ArrowRight size={18} /> Sign In</>}
                                </button>
                            </motion.form>
                        )}

                        {tab === 'register' && (
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

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email ID</label>
                                    <div className="flex gap-2">
                                        <div className="relative group flex-1">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="john@email.com" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSendRegisterOtp}
                                            disabled={sendingOtp}
                                            className="px-4 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase tracking-wider rounded-2xl border border-primary/20 transition-all disabled:opacity-50 min-w-[100px]"
                                        >
                                            {sendingOtp ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Get OTP'}
                                        </button>
                                    </div>
                                    {otpSentMsg && (
                                        <p className="text-[10px] font-bold text-emerald-600 mt-1 pl-1">✓ {otpSentMsg}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Mobile Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="tel" name="mobile" required value={formData.mobile} onChange={handleInputChange} placeholder="+91 00000 00000" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">OTP Code</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input name="otp" required value={formData.otp} onChange={handleInputChange} placeholder="6-digit OTP" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
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
                                            <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" required value={formData.confirm_password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
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

                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-4">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={18} /> Register Now</>}
                                </button>
                            </motion.form>
                        )}

                        {tab === 'forgot' && (
                            <motion.form
                                key="forgot"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleForgotPasswordReset}
                                className="space-y-5"
                            >
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center shadow-sm">
                                        {error}
                                    </div>
                                )}
                                {otpSentMsg && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl text-center shadow-sm">
                                        {otpSentMsg}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email ID</label>
                                    <div className="flex gap-2">
                                        <div className="relative group flex-1">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="john@email.com" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSendForgotPasswordOtp}
                                            disabled={sendingOtp}
                                            className="px-4 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase tracking-wider rounded-2xl border border-primary/20 transition-all disabled:opacity-50 min-w-[100px]"
                                        >
                                            {sendingOtp ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Get OTP'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">OTP Code</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                        <input name="otp" required value={formData.otp} onChange={handleInputChange} placeholder="6-digit OTP code" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
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
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Confirm Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={18} />
                                            <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" required value={formData.confirm_password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all" />
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

                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-4">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={18} /> Reset Password</>}
                                </button>

                                <div className="pt-4 text-center">
                                    <button type="button" onClick={() => { setTab('login'); setError(''); setOtpSentMsg(''); }} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">Back to Login</button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {(tab === 'login' || tab === 'register') && (
                        <>
                            <div className="relative my-6 flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100"></div>
                                </div>
                                <span className="relative bg-white px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Or continue with</span>
                            </div>

                            <div className="flex justify-center">
                                <div id="google-signin-button" className="w-full flex justify-center"></div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
