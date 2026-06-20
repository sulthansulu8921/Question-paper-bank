import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    Mail, Lock, User, Phone, Loader2, ArrowRight, CheckCircle, 
    ShieldCheck, Eye, EyeOff, BookOpen, 
    Cpu, Sparkles, Video, FileText, Trophy
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import Logo from '@/components/Logo';
import api from '@/api/axios';

export default function AuthPage() {
    const navigate = useNavigate();
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (token) {
            if (user?.is_staff) {
                navigate('/admin');
            } else if (user?.selected_course) {
                navigate(`/dashboard/courses/${user.selected_course}`);
            } else {
                navigate('/dashboard');
            }
        }
    }, [token, user, navigate]);

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

    // Google Onboarding Modal state
    const [showGoogleOnboarding, setShowGoogleOnboarding] = useState(false);
    const [googleMobile, setGoogleMobile] = useState('');
    const [googleQualification, setGoogleQualification] = useState('');
    const [googleCourseId, setGoogleCourseId] = useState('');
    const [googleOnboardingLoading, setGoogleOnboardingLoading] = useState(false);
    const [googleOnboardingError, setGoogleOnboardingError] = useState('');

    const selectedCourse = searchParams.get('course');
    // masterLevels: real-time data from admin's Master Database (/master/levels/)
    const [masterLevels, setMasterLevels] = useState<any[]>([]);
    const [qualifications, setQualifications] = useState<string[]>([]);
    const [selectedQualification, setSelectedQualification] = useState<string>('');
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [levelsLoading, setLevelsLoading] = useState(false);

    // Fetch real-time master levels created by admin
    useEffect(() => {
        setLevelsLoading(true);
        api.get('/master/levels/?page_size=200')
            .then(res => {
                const results = res.data.results || res.data || [];
                setMasterLevels(results);
                // Build unique qualification groups
                const quals: string[] = [];
                results.forEach((lvl: any) => {
                    if (lvl.qualification && !quals.includes(lvl.qualification)) {
                        quals.push(lvl.qualification);
                    }
                });
                setQualifications(quals);
            })
            .catch(err => {
                console.error("Failed to fetch master levels", err);
            })
            .finally(() => setLevelsLoading(false));
    }, []);

    // Auto-select if URL param matches a level name
    useEffect(() => {
        if (masterLevels.length > 0 && selectedCourse) {
            const matched = masterLevels.find(
                (l: any) => l.slug === selectedCourse || l.name.toLowerCase() === selectedCourse.toLowerCase()
            );
            if (matched) {
                setSelectedQualification(matched.qualification);
                setSelectedCourseId((matched.course_id ?? matched.id).toString());
            }
        }
    }, [masterLevels, selectedCourse]);

    const handleQualificationChange = (qual: string) => {
        setSelectedQualification(qual);
        setSelectedCourseId('');
    };

    // Levels under selected qualification
    const filteredLevels = masterLevels.filter((l: any) => l.qualification === selectedQualification);

    const handleGoogleCredentialResponse = async (response: any) => {
        setLoading(true);
        setError('');
        try {
            await googleLogin(response.credential, selectedCourseId);
            const loggedUser = useAuthStore.getState().user;
            if (loggedUser?.is_staff) {
                navigate('/admin');
                return;
            }
            // If missing mobile or course — show onboarding modal
            const needsOnboarding = !loggedUser?.mobile_number || !loggedUser?.selected_course;
            if (needsOnboarding) {
                setGoogleOnboardingError('');
                setShowGoogleOnboarding(true);
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Google Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOnboardingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!googleMobile.trim()) {
            setGoogleOnboardingError('Mobile number is required.');
            return;
        }
        if (!googleCourseId) {
            setGoogleOnboardingError('Please select your course level.');
            return;
        }
        setGoogleOnboardingLoading(true);
        setGoogleOnboardingError('');
        try {
            const updateProfile = useAuthStore.getState().updateProfile;
            await updateProfile({
                mobile_number: googleMobile.trim(),
                selected_course: parseInt(googleCourseId)
            });
            setShowGoogleOnboarding(false);
            navigate('/dashboard');
        } catch (err: any) {
            const errData = err.response?.data;
            if (errData && typeof errData === 'object') {
                const msgs: string[] = [];
                Object.entries(errData).forEach(([, v]) => {
                    if (Array.isArray(v)) msgs.push(v[0] as string);
                    else if (typeof v === 'string') msgs.push(v);
                });
                setGoogleOnboardingError(msgs[0] || 'Failed to save. Please try again.');
            } else {
                setGoogleOnboardingError('Failed to save. Please try again.');
            }
        } finally {
            setGoogleOnboardingLoading(false);
        }
    };

    useEffect(() => {
        setTab(activeTabParams);
    }, [activeTabParams]);

    // Initialize Google Sign-In
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
                            btnEl.innerHTML = ''; 
                            googleObj.accounts.id.renderButton(
                                btnEl,
                                { theme: 'outline', size: 'large', width: 340, text: tab === 'register' ? 'signup_with' : 'signin_with' }
                            );
                        }
                    };

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
                let targetCourseId = user?.selected_course;
                if (selectedCourseId && parseInt(selectedCourseId) !== user?.selected_course) {
                    try {
                        const updateProfile = useAuthStore.getState().updateProfile;
                        await updateProfile({ selected_course: parseInt(selectedCourseId) });
                        targetCourseId = parseInt(selectedCourseId);
                    } catch (profileErr) {
                        console.error("Failed to update selected course on login", profileErr);
                    }
                }
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


    const platformBenefits = [
        {
            icon: Cpu,
            title: "AI-Powered Learning Assistance",
            desc: "Instant answers, customized queries, and study summaries tailored by advanced AI models."
        },
        {
            icon: FileText,
            title: "Full-Length & Sectional Mock Tests",
            desc: "Simulate real exam pressures with detailed test templates, answer verification, and stats tracking."
        },
        {
            icon: Video,
            title: "Live Classes & Video Archives",
            desc: "Attend premium live sessions or learn at your own pace with a library of crystal-clear recorded courses."
        },
        {
            icon: BookOpen,
            title: "Curated Textbooks & Study Materials",
            desc: "Immediate access to handwritten revision notes, solved previous year papers (PYQs), and updates."
        },
        {
            icon: Trophy,
            title: "Accelerated Career Growth",
            desc: "Unlock master qualifications and industry-leading professional certificates with direct placement pathways."
        }
    ];

    return (
        <>
        <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4 md:p-8 lg:p-12 relative overflow-hidden text-slate-800 selection:bg-blue-200">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50/50 via-slate-50 to-transparent -z-10" />
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-[150px] -z-10" />
            <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-[150px] -z-10" />

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col lg:flex-row min-h-[800px]"
            >
                {/* LEFT SHOWCASE PANEL: Premium Deep Blue Gradient */}
                <div className="w-full lg:w-5/12 bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950 p-8 md:p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
                    {/* Background decorations */}
                    <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay" />
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />

                    <div className="relative z-10 space-y-12">
                        {/* Logo header */}
                        <Link to="/" className="flex items-center gap-2 group hover:scale-[1.02] transition-transform duration-300 w-fit">
                            <Logo theme="dark" className="h-9 object-contain" />
                        </Link>

                        {/* Title and Badge */}
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/20 shadow-inner">
                                <Sparkles size={12} className="animate-pulse" />
                                Multi-Category Learning Hub
                            </div>
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                                One Platform. <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-white">
                                    Infinite Success.
                                </span>
                            </h2>
                            <p className="text-blue-100/60 font-medium text-sm leading-relaxed max-w-md">
                                Empowering learners across diverse streams with AI-guided tools, curated study plans, and live mock test analysis.
                            </p>
                        </div>

                    </div>

                    {/* Features list */}
                    <div className="relative z-10 space-y-6 mt-12 pt-8 border-t border-white/10">
                        {platformBenefits.slice(0, 3).map((benefit, i) => (
                            <div key={i} className="flex gap-4 items-start group">
                                <div className="w-10 h-10 bg-white/5 border border-white/10 text-blue-300 rounded-2xl flex items-center justify-center shrink-0 shadow-lg group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-400 transition-all duration-300">
                                    <benefit.icon size={18} />
                                </div>
                                <div className="space-y-1">
                                    <h5 className="text-xs font-black text-white group-hover:text-blue-200 transition-colors">{benefit.title}</h5>
                                    <p className="text-[11px] text-white/50 leading-relaxed font-bold">{benefit.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer branding */}
                    <div className="relative z-10 pt-8 mt-12 border-t border-white/5 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/30">
                        <span>© 2026 qubook.in</span>
                        <span>Enterprise v3.1</span>
                    </div>
                </div>

                {/* RIGHT PANEL: Pure White & Premium Clean Form Area */}
                <div className="w-full lg:w-7/12 p-8 md:p-12 lg:p-16 flex flex-col justify-between bg-white relative">
                    <div className="max-w-xl mx-auto w-full space-y-8 my-auto">
                        
                        {/* Tab Switcher */}
                        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-fit mx-auto lg:mx-0 shadow-inner">
                            <button
                                onClick={() => { setTab('login'); setError(''); setOtpSentMsg(''); }}
                                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${tab === 'login' ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 hover:scale-[0.98]'}`}
                            >
                                Login Account
                            </button>
                            <button
                                onClick={() => { setTab('register'); setError(''); setOtpSentMsg(''); }}
                                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${tab === 'register' ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 hover:scale-[0.98]'}`}
                            >
                                Join Platform
                            </button>
                        </div>

                        {/* Header Titles */}
                        <div className="text-center lg:text-left space-y-2">
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                {tab === 'login' ? 'Welcome Back' : tab === 'register' ? 'Create Student Account' : 'Recover Password'}
                            </h1>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
                                {tab === 'login' 
                                    ? 'Sign in to access your customized learning space' 
                                    : tab === 'register' 
                                        ? 'Access premium study materials, mock tests, and AI assistance' 
                                        : 'Input your registered email to request password reset'}
                            </p>
                        </div>

                        {/* Error & Success Messages */}
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-2xl text-center shadow-sm"
                                >
                                    {error}
                                </motion.div>
                            )}
                            {otpSentMsg && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-2xl text-center shadow-sm"
                                >
                                    {otpSentMsg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Dynamic Course & Level Selectors — real-time from admin Master Database */}
                        {tab !== 'forgot' && (
                            <div className="space-y-3">
                                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-3xl shadow-sm space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest pl-1 mb-2 block">
                                            1. Select Learning Stream *
                                        </label>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/60 group-focus-within:text-blue-600 transition-colors" size={18} />
                                            <select
                                                value={selectedQualification}
                                                onChange={(e) => handleQualificationChange(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all appearance-none cursor-pointer"
                                                required
                                            >
                                                <option value="">
                                                    {levelsLoading ? 'Loading streams...' : 'Select Stream (e.g. CA, UPSC, IT Courses)'}
                                                </option>
                                                {qualifications.map((qual) => (
                                                    <option key={qual} value={qual}>
                                                        {qual}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedQualification && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest pl-1 mb-2 block">
                                                2. Choose Your Level *
                                            </label>
                                            <div className="relative group">
                                                <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/60 group-focus-within:text-blue-600 transition-colors" size={18} />
                                                <select
                                                    value={selectedCourseId}
                                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all appearance-none cursor-pointer"
                                                    required
                                                >
                                                    <option value="">Select Level</option>
                                                    {filteredLevels.map((level: any) => (
                                                        <option key={level.id} value={level.course_id ?? ''}>
                                                            {level.name}
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
                                {selectedCourseId && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-emerald-500 animate-pulse" />
                                            <span>Selected Program:</span>
                                        </div>
                                        <span className="uppercase text-emerald-600 bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm font-black text-[10px] tracking-wide select-none">
                                            {masterLevels.find(l => (l.course_id ?? l.id).toString() === selectedCourseId)?.name || 'Default Course'}
                                        </span>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {/* LOGIN FORM */}
                            {tab === 'login' && (
                                <motion.form
                                    key="login"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    onSubmit={handleLogin}
                                    className="space-y-5"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email or Mobile</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input 
                                                name="email" 
                                                required 
                                                value={formData.email} 
                                                onChange={handleInputChange} 
                                                placeholder="name@example.com" 
                                                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                                            <button 
                                                type="button" 
                                                onClick={() => { setTab('forgot'); setError(''); setOtpSentMsg(''); }} 
                                                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline hover:text-blue-700"
                                            >
                                                Forgot?
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input 
                                                type={showPassword ? "text" : "password"} 
                                                name="password" 
                                                required 
                                                value={formData.password} 
                                                onChange={handleInputChange} 
                                                placeholder="••••••••" 
                                                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-4 pl-12 pr-12 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-1">
                                        <input 
                                            type="checkbox" 
                                            id="remember" 
                                            name="remember_me" 
                                            checked={formData.remember_me} 
                                            onChange={handleInputChange} 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                                        />
                                        <label htmlFor="remember" className="text-xs font-bold text-slate-500 cursor-pointer select-none">Remember me for 30 days</label>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-6"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <><ArrowRight size={18} /> Sign In Dashboard</>}
                                    </button>
                                </motion.form>
                            )}

                            {/* REGISTRATION FORM */}
                            {tab === 'register' && (
                                <motion.form
                                    key="register"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    onSubmit={handleRegister}
                                    className="space-y-4"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input 
                                                name="full_name" 
                                                required 
                                                value={formData.full_name} 
                                                onChange={handleInputChange} 
                                                placeholder="Full Name" 
                                                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email ID</label>
                                        <div className="flex gap-2">
                                            <div className="relative group flex-1">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type="email" 
                                                    name="email" 
                                                    required 
                                                    value={formData.email} 
                                                    onChange={handleInputChange} 
                                                    placeholder="name@example.com" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendRegisterOtp}
                                                disabled={sendingOtp}
                                                className="px-5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-black uppercase tracking-wider rounded-2xl border border-blue-200 transition-all disabled:opacity-50 min-w-[110px]"
                                            >
                                                {sendingOtp ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Get OTP'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mobile Number</label>
                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type="tel" 
                                                    name="mobile" 
                                                    required 
                                                    value={formData.mobile} 
                                                    onChange={handleInputChange} 
                                                    placeholder="+91 99999 99999" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">OTP Code</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    name="otp" 
                                                    required 
                                                    value={formData.otp} 
                                                    onChange={handleInputChange} 
                                                    placeholder="OTP verification" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    name="password" 
                                                    required 
                                                    value={formData.password} 
                                                    onChange={handleInputChange} 
                                                    placeholder="••••••••" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type={showConfirmPassword ? "text" : "password"} 
                                                    name="confirm_password" 
                                                    required 
                                                    value={formData.confirm_password} 
                                                    onChange={handleInputChange} 
                                                    placeholder="••••••••" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-6"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle size={18} /> Complete Registration</>}
                                    </button>
                                </motion.form>
                            )}

                            {/* FORGOT PASSWORD FORM */}
                            {tab === 'forgot' && (
                                <motion.form
                                    key="forgot"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    onSubmit={handleForgotPasswordReset}
                                    className="space-y-5"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email ID</label>
                                        <div className="flex gap-2">
                                            <div className="relative group flex-1">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type="email" 
                                                    name="email" 
                                                    required 
                                                    value={formData.email} 
                                                    onChange={handleInputChange} 
                                                    placeholder="name@example.com" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendForgotPasswordOtp}
                                                disabled={sendingOtp}
                                                className="px-5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-black uppercase tracking-wider rounded-2xl border border-blue-200 transition-all disabled:opacity-50 min-w-[110px]"
                                            >
                                                {sendingOtp ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Get OTP'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">OTP Verification Code</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input 
                                                name="otp" 
                                                required 
                                                value={formData.otp} 
                                                onChange={handleInputChange} 
                                                placeholder="6-digit OTP code" 
                                                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">New Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    name="password" 
                                                    required 
                                                    value={formData.password} 
                                                    onChange={handleInputChange} 
                                                    placeholder="••••••••" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input 
                                                    type={showConfirmPassword ? "text" : "password"} 
                                                    name="confirm_password" 
                                                    required 
                                                    value={formData.confirm_password} 
                                                    onChange={handleInputChange} 
                                                    placeholder="••••••••" 
                                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-6"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle size={18} /> Reset Password</>}
                                    </button>

                                    <div className="pt-2 text-center">
                                        <button 
                                            type="button" 
                                            onClick={() => { setTab('login'); setError(''); setOtpSentMsg(''); }} 
                                            className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
                                        >
                                            Back to Login
                                        </button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {/* Third Party Auth (Google Sign-In) */}
                        {(tab === 'login' || tab === 'register') && (
                            <div className="space-y-6">
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-slate-100"></div>
                                    </div>
                                    <span className="relative bg-white px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Or credentials checkout
                                    </span>
                                </div>

                                <div className="flex justify-center">
                                    <div id="google-signin-button" className="w-full flex justify-center min-h-[44px]"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>

        {/* ── Google Onboarding Modal ────────────────────────────────────────── */}
        {showGoogleOnboarding && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 pt-10 pb-8 text-white text-center relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <ShieldCheck size={28} className="text-white" />
                            </div>
                            <h2 className="text-xl font-black tracking-tight">Complete Your Profile</h2>
                            <p className="text-blue-100/80 text-xs font-bold mt-2 uppercase tracking-wider">One more step to access the platform</p>
                        </div>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleGoogleOnboardingSubmit} className="px-8 py-7 space-y-5">
                        {googleOnboardingError && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-2xl text-center">
                                {googleOnboardingError}
                            </div>
                        )}

                        {/* Mobile Number */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mobile Number *</label>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    id="google-onboarding-mobile"
                                    type="tel"
                                    required
                                    value={googleMobile}
                                    onChange={e => setGoogleMobile(e.target.value)}
                                    placeholder="+91 99999 99999"
                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/30 transition-all"
                                />
                            </div>
                        </div>

                        {/* Learning Stream (Qualification) */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Learning Stream *</label>
                            <div className="relative group">
                                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/60 group-focus-within:text-blue-600 transition-colors" size={18} />
                                <select
                                    id="google-onboarding-qualification"
                                    value={googleQualification}
                                    onChange={e => { setGoogleQualification(e.target.value); setGoogleCourseId(''); }}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select Stream (e.g. CA, UPSC)</option>
                                    {qualifications.map(q => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>

                        {/* Course Level */}
                        {googleQualification && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Course Level *</label>
                                <div className="relative group">
                                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/60 group-focus-within:text-blue-600 transition-colors" size={18} />
                                    <select
                                        id="google-onboarding-level"
                                        value={googleCourseId}
                                        onChange={e => setGoogleCourseId(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Level</option>
                                        {masterLevels
                                            .filter((l: any) => l.qualification === googleQualification)
                                            .map((level: any) => (
                                                <option key={level.id} value={level.course_id ?? ''}>
                                                    {level.name}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={googleOnboardingLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-2"
                        >
                            {googleOnboardingLoading
                                ? <Loader2 size={20} className="animate-spin" />
                                : <><ArrowRight size={18} /> Enter Platform</>
                            }
                        </button>
                    </form>
                </motion.div>
            </div>
        )}
        </>
    );
}
