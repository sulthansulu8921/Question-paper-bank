import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, ChevronRight, CheckCircle, Zap, Shield, Search, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const courses = [
    { title: "CA Intermediate", subjects: 8, students: "15k+", color: "#5B4BFF" },
    { title: "CA Foundation", subjects: 4, students: "12k+", color: "#8B5CF6" },
    { title: "CA Final", subjects: 6, students: "10k+", color: "#6366F1" },
];

const features = [
    { icon: FileText, title: "Previous Year Papers", desc: "Access the last 10 years of validated question papers." },
    { icon: CheckCircle, title: "Suggested Answers", desc: "Verified answers by top academic experts." },
    { icon: Zap, title: "AI Study Assistant", desc: "Get instant doubt resolution using integrated AI." },
    { icon: Shield, title: "Premium Downloads", desc: "Offline access to watermarked notes and papers." },
];

import Logo from '@/components/Logo';

export default function LandingPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    return (
        <div className="min-h-screen bg-light text-dark font-sans overflow-x-hidden">
            {/* TOP NAVBAR */}
            <nav className="w-full h-20 flex items-center justify-between px-6 md:px-12 glass fixed top-0 z-[100] border-b border-white/20 transition-all">
                <div className="flex items-center gap-2">
                    <Link to="/" className="flex items-center gap-2 hover:scale-105 transition-transform duration-300">
                        <Logo theme="light" className="h-10 object-contain" />
                    </Link>
                </div>

                <div className="hidden lg:flex items-center gap-8">
                    <Link to="/" className="text-sm font-bold text-primary">Home</Link>
                    <Link to="/dashboard/courses" className="text-sm font-semibold hover:text-primary transition-colors">Courses</Link>
                    <Link to="/papers" className="text-sm font-semibold hover:text-primary transition-colors">Question Papers</Link>
                    <Link to="/notes" className="text-sm font-semibold hover:text-primary transition-colors">Notes</Link>
                    <Link to="/mcqs" className="text-sm font-semibold hover:text-primary transition-colors">MCQs</Link>
                    <Link to="/about" className="text-sm font-semibold hover:text-primary transition-colors">About Us</Link>
                    <Link to="/contact" className="text-sm font-semibold hover:text-primary transition-colors">Contact Us</Link>
                </div>

                <div className="hidden lg:flex items-center gap-3">
                    <Link to="/login" className="px-6 py-2 text-sm font-bold border border-gray-200 rounded-full hover:bg-gray-50 transition-colors hidden md:block">Login</Link>
                    <Link to="/register" className="px-6 py-2.5 bg-primary text-white text-sm font-extrabold rounded-full shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">Register</Link>
                </div>

                {/* Mobile Search & Hamburger Button */}
                <div className="flex items-center gap-3 lg:hidden">
                    <button className="p-2.5 bg-accent/10 text-accent rounded-full"><Search size={20} /></button>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-slate-600 hover:text-primary transition-colors"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed top-20 left-0 w-full glass z-[99] flex flex-col p-6 gap-6 transition-all duration-300 ease-in-out">
                    <div className="flex flex-col gap-4">
                        <Link
                            to="/"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            Home
                        </Link>
                        <Link
                            to="/dashboard/courses"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            Courses
                        </Link>
                        <Link
                            to="/papers"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            Question Papers
                        </Link>
                        <Link
                            to="/notes"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            Notes
                        </Link>
                        <Link
                            to="/mcqs"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            MCQs
                        </Link>
                        <Link
                            to="/about"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            About Us
                        </Link>
                        <Link
                            to="/contact"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            Contact Us
                        </Link>
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                        <Link
                            to="/login"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="w-full py-3 text-center bg-white border border-slate-200 text-dark text-sm font-bold rounded-full transition-colors"
                        >
                            Login
                        </Link>
                        <Link
                            to="/register"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="w-full py-3 text-center bg-primary text-white text-sm font-extrabold rounded-full shadow-xl shadow-primary/30 transition-all"
                        >
                            Register
                        </Link>
                    </div>
                </div>
            )}

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6 flex flex-col items-center justify-center text-center overflow-hidden">
                {/* Dynamic Background Elements */}
                <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse-slow"></div>
                <div className="absolute top-[40%] right-[10%] w-80 h-80 bg-accent/20 rounded-full blur-[120px] -z-10 animate-pulse-slow animation-delay-2000"></div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-5xl mx-auto"
                >
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-widest mb-8 border border-primary/20 shadow-sm"
                    >
                        <Zap size={14} className="fill-primary" /> Our Learning Platform
                    </motion.span>

                    <h1 className="text-5xl md:text-8xl font-black text-gray-900 leading-[1.1] tracking-tight mb-8">
                        Empowering Students with <br />
                        <span className="gradient-text">Smart Learning Resources</span>
                    </h1>

                    <p className="text-lg md:text-2xl text-gray-500 max-w-3xl mx-auto font-medium leading-relaxed mb-12">
                        Access Previous Year Question Papers, Suggested Answers, Notes, MCQs, and Premium Study Materials in One Platform.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                        <Link to="/dashboard/courses" className="w-full sm:w-auto px-10 py-5 bg-primary text-white rounded-2xl text-lg font-black shadow-2xl shadow-primary/40 hover:translate-y-[-4px] transition-transform flex items-center justify-center gap-3">
                            Explore Courses <ChevronRight size={22} strokeWidth={3} />
                        </Link>
                        <Link to="/contact" className="w-full sm:w-auto px-10 py-5 bg-white text-dark rounded-2xl text-lg font-bold border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center">
                            Contact Us
                        </Link>
                    </div>
                </motion.div>
            </section>

            {/* STATS SECTION */}
            <section className="pb-32 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { label: "Students", value: "50,000+" },
                        { label: "Question Papers", value: "10,000+" },
                        { label: "CA Courses", value: "3 Major" },
                        { label: "Rating", value: "4.9/5" }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 text-center flex flex-col items-center group hover:bg-primary transition-colors cursor-default duration-500"
                        >
                            <span className="text-3xl md:text-5xl font-black text-primary group-hover:text-white transition-colors">{stat.value}</span>
                            <span className="text-sm md:text-base font-bold text-gray-500 mt-2 group-hover:text-white/80 transition-colors">{stat.label}</span>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* COURSE SECTION */}
            <section className="py-32 bg-white px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">Start Your Journey</h2>
                            <p className="text-lg text-gray-500 font-medium">Premium content tailored to your syllabus.</p>
                        </div>
                        <Link to="/dashboard/courses" className="text-primary font-bold flex items-center gap-1 group">
                            View All Courses <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {courses.map((course, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                whileHover={{ y: -10 }}
                                className="bg-light p-8 rounded-[2.5rem] relative overflow-hidden group cursor-pointer border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500"
                            >
                                <div className="absolute top-6 right-6 px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Premium</div>
                                <div className="w-16 h-16 bg-white shadow-lg rounded-2xl flex items-center justify-center mb-8 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                    <BookOpen size={32} />
                                </div>
                                <h3 className="text-2xl font-black mb-4">{course.title}</h3>
                                <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">Access professional preparation materials, solved papers and expert guidance.</p>

                                <div className="pt-6 border-t border-gray-200/50 flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-dark font-black text-lg">{course.subjects}</span>
                                            <span className="text-gray-400 text-[10px] font-bold uppercase">Subjects</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-dark font-black text-lg">{course.students}</span>
                                            <span className="text-gray-400 text-[10px] font-bold uppercase">Learners</span>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 group-hover:border-primary group-hover:bg-primary group-hover:text-white transition-all">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-extrabold mb-4">Elite Learning Tools</h2>
                        <p className="text-gray-500">The most powerful dashboard for professional preparation.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((f, i) => (
                            <motion.div key={i} className="glass p-10 rounded-[2.5rem] group hover:bg-primary transition-all duration-500 cursor-default">
                                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-primary transition-colors">
                                    <f.icon size={26} />
                                </div>
                                <h4 className="text-xl font-bold mb-3 group-hover:text-white">{f.title}</h4>
                                <p className="text-sm text-gray-500 leading-relaxed group-hover:text-white/80">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-secondary p-12 md:p-24 text-white">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 pb-16 border-b border-white/10">
                        <div className="col-span-1 lg:col-span-1">
                            <div className="text-3xl font-black mb-6">qubook.in</div>
                            <p className="text-white/60 text-sm leading-relaxed mb-8">Empowering students across India with premium learning resources, suggested answers, and handwritten notes.</p>
                            <div className="flex gap-4">
                                <a href="https://www.instagram.com/p/DYrVIdHEqWf/?igsh=MTBiNGphbHV3bGNneA==" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-[#E1306C] hover:text-white transition-colors text-white/70" aria-label="Instagram">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                        <div>
                            <h5 className="font-bold mb-8 uppercase tracking-widest text-xs text-primary">Courses</h5>
                            <ul className="flex flex-col gap-5 text-white/50 text-sm">
                                <li className="hover:text-white cursor-pointer transition-colors">CA Foundation</li>
                                <li className="hover:text-white cursor-pointer transition-colors">CA Intermediate</li>
                                <li className="hover:text-white cursor-pointer transition-colors">CA Final</li>
                                <li className="hover:text-white cursor-pointer transition-colors">ACCA</li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-bold mb-8 uppercase tracking-widest text-xs text-primary">Company</h5>
                            <ul className="flex flex-col gap-5 text-white/50 text-sm">
                                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                                <li className="hover:text-white cursor-pointer transition-colors">Terms of Service</li>
                                <li className="hover:text-white cursor-pointer transition-colors">Privacy Policy</li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-bold mb-8 uppercase tracking-widest text-xs text-primary">Support</h5>
                            <ul className="flex flex-col gap-5 text-white/50 text-sm">
                                <li>
                                    <a href="mailto:qubook.helpline@gmail.com" className="hover:text-white transition-colors">qubook.helpline@gmail.com</a>
                                </li>
                                <li>
                                    <a href="tel:+918086390965" className="hover:text-white transition-colors">+91 8086390965</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-12 text-center text-white/30 text-xs font-medium">
                        &copy; 2026 qubook.in. Designed for Excellence. Premium Educational SaaS.
                    </div>
                </div>
            </footer>
        </div>
    )
}
