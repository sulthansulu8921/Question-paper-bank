import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, MapPin, Phone, Globe, Share2, Users, FileText, ChevronRight, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import api from '@/api/axios';
import lightBg from '@/assets/light-portal-bg.png';

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8, ease: "easeOut" }
};

export default function PortalHomePage() {
    const navigate = useNavigate();

    const { data: courses, isLoading } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-x-hidden selection:bg-primary/30">
            {/* PREMIUM MIXED THEME BACKGROUND SYSTEM */}
            <div className="fixed inset-0 z-0 bg-[#F8FAFC]">
                {/* Base Image with Light Overlay */}
                <div
                    className="absolute inset-0 opacity-40 transition-opacity duration-1000"
                    style={{
                        backgroundImage: `url(${lightBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(8px) brightness(1.2)'
                    }}
                />

                {/* Elegant Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/80 via-white/40 to-[#F8FAFC]" />

                {/* Animated Light Glows */}
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#4F46E5]/30 blur-[120px] rounded-full mix-blend-multiply"
                />
                <motion.div
                    animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#7C3AED]/30 blur-[150px] rounded-full mix-blend-multiply"
                />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05] pointer-events-none" />
            </div>

            {/* WHITE GLASS NAVBAR */}
            <nav className="w-full h-20 bg-white/70 backdrop-blur-xl flex items-center justify-between px-6 md:px-12 fixed top-0 z-[100] border-b border-slate-200/50 shadow-sm transition-all">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Qubook Logo" className="h-9 object-contain" />
                </div>

                <div className="hidden lg:flex items-center gap-10">
                    <Link to="/" className="text-sm font-black text-[#0F172A] hover:text-[#4F46E5] transition-all relative group">
                        Home
                        <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#4F46E5] scale-x-100 origin-left transition-transform" />
                    </Link>
                    <Link to="/about" className="text-sm font-bold text-slate-500 hover:text-[#0F172A] transition-all">About Us</Link>
                    <Link to="/contact" className="text-sm font-bold text-slate-500 hover:text-[#0F172A] transition-all">Contact Us</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/auth?tab=login" className="px-6 py-2.5 text-slate-600 text-sm font-bold hover:text-[#0F172A] transition-colors">Login</Link>
                    <Link to="/auth?tab=register" className="px-8 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all">Free Signup</Link>
                </div>
            </nav>

            {/* PROFESSIONAL TICKER ANNOUNCEMENT */}
            <div className="w-full bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#7C3AED] py-3 text-center mt-20 relative z-50 shadow-md overflow-hidden border-b border-indigo-400/30">
                <motion.div
                    animate={{ x: [0, -20, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="flex items-center justify-center gap-3 px-4"
                >
                    <Sparkles size={16} className="text-white/90 animate-pulse" />
                    <p className="text-[10px] md:text-xs font-bold text-white tracking-[0.2em] uppercase">
                        Access Previous Year Question Papers, RTPs, MTPs & Suggested Answers
                    </p>
                    <Sparkles size={16} className="text-white/90 animate-pulse" />
                </motion.div>
            </div>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto px-6 pt-10 pb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h1 className="text-5xl md:text-6xl font-black text-[#0F172A] tracking-tight leading-tight mb-8">
                        Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]">Course</span>
                    </h1>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] mx-auto rounded-full shadow-sm" />
                    <p className="text-slate-500 mt-6 font-semibold text-sm">Select an academic path to access premium resources and proven solutions.</p>
                </motion.div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-6">
                        <Loader2 className="animate-spin text-[#4F46E5]" size={48} strokeWidth={2} />
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Loading Portal Content...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
                        {(courses || []).map((course: any, idx: number) => (
                            <motion.div
                                key={course.id}
                                {...fadeUp}
                                transition={{ delay: idx * 0.1 }}
                                className="group relative"
                                onClick={() => {
                                    if (course.is_active) {
                                        navigate(`/auth?course=${course.slug}&tab=register`);
                                    } else {
                                        navigate('/coming-soon');
                                    }
                                }}
                            >
                                {/* Hover Glow Shadow – only for active */}
                                {course.is_active && (
                                    <div className="absolute -inset-1 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-[2.5rem] blur opacity-0 group-hover:opacity-20 transition duration-500" />
                                )}

                                {/* White Glass Card */}
                                <div className={`bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/60 shadow-xl shadow-slate-200/50 transition-all duration-500 flex flex-col h-full relative z-10 overflow-hidden ${course.is_active ? 'hover:shadow-2xl hover:shadow-[#4F46E5]/10 group-hover:-translate-y-2 cursor-pointer' : 'opacity-70 cursor-pointer'}`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#4F46E5]/5 to-transparent rounded-bl-full" />

                                    {/* Coming Soon Badge */}
                                    {!course.is_active && (
                                        <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                            Coming Soon
                                        </div>
                                    )}

                                    {/* Icon Container */}
                                    <div
                                        className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white mb-8 shadow-lg shadow-indigo-500/20 relative transition-transform duration-500 ${course.is_active ? 'group-hover:scale-110 group-hover:rotate-3' : 'grayscale-[30%]'}`}
                                        style={{
                                            background: `linear-gradient(135deg, ${course.color || '#4F46E5'}, ${course.color + 'DD' || '#7C3AEDDD'})`,
                                        }}
                                    >
                                        <BookOpen size={32} className="relative z-10" />
                                    </div>

                                    <div className="mt-auto">
                                        <h3 className={`text-2xl font-black text-[#0F172A] mb-3 transition-colors ${course.is_active ? 'group-hover:text-[#4F46E5]' : ''}`}>{course.name}</h3>
                                        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-10 line-clamp-2">
                                            {course.short_description || "Premium academic resources and suggested answers for " + course.name}
                                        </p>

                                        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${course.is_active ? 'text-[#4F46E5]' : 'text-slate-400'}`}>
                                                {course.is_active ? 'Explore Resources' : 'Launching Soon'}
                                            </span>
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm ${course.is_active ? 'bg-slate-50 text-slate-400 group-hover:bg-gradient-to-r group-hover:from-[#4F46E5] group-hover:to-[#7C3AED] group-hover:text-white group-hover:shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                                                <ChevronRight size={24} strokeWidth={2.5} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* SOFT LIGHT FOOTER */}
            <footer className="relative z-10 bg-white border-t border-slate-200/60 pt-20 pb-10 px-8 md:px-20">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Qubook Logo" className="h-9 object-contain" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">Trusted professional exam preparation platform featuring premium suggested answers and structured learning.</p>
                        <div className="flex gap-3 pt-2">
                            {[Globe, Share2, Users, FileText].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-100 hover:text-[#4F46E5] transition-colors text-slate-400">
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0F172A]">Platform</h4>
                        <div className="flex flex-col gap-4 text-sm font-semibold text-slate-500">
                            <Link to="/about" className="hover:text-[#4F46E5] transition-colors">Our Methodology</Link>
                            <Link to="/contact" className="hover:text-[#4F46E5] transition-colors">Contact Faculty</Link>
                            <Link to="/auth?tab=login" className="hover:text-[#4F46E5] transition-colors">Student Login</Link>
                            <Link to="/auth?tab=register" className="hover:text-[#4F46E5] transition-colors">Free Enrolment</Link>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0F172A]">Reach Us</h4>
                        <div className="flex flex-col gap-5 text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0"><MapPin size={16} /></div>
                                <span>BKC Financial District, Mumbai, IN</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0"><Phone size={16} /></div>
                                <span>+91 1800 572 900</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0F172A]">Updates</h4>
                        <p className="text-xs font-semibold text-slate-500 leading-relaxed">Join our mailing list for latest syllabus updates.</p>
                        <div className="relative">
                            <input placeholder="Email Address" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-5 text-sm font-semibold focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10 shadow-sm transition-all" />
                            <button className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors flex items-center justify-center shadow-md shadow-indigo-500/20"><ArrowRight size={16} /></button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <p>© 2024 Study Partner. All Rights Reserved.</p>
                    <div className="flex gap-8">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> System Operational</span>
                        <span>Privacy Policy</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
