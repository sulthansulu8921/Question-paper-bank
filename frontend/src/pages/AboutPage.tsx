import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Zap, Smartphone, Layers, BookOpen, Users, ArrowRight, Menu, X } from 'lucide-react';
import api from '@/api/axios';

const features = [
    { icon: BookOpen, title: 'Premium Study Materials', desc: 'Previous Year Question Papers, Suggested Answers, Notes and MCQs in one place.' },
    { icon: ShieldCheck, title: 'Secure Platform', desc: 'Enterprise-grade security with watermarked PDFs, signed URLs, and anti-piracy protection.' },
    { icon: Zap, title: 'Fast Search', desc: 'Full-text search across all subjects, years, topics and keywords instantly.' },
    { icon: Smartphone, title: 'Mobile Friendly', desc: 'Fully responsive design optimized for mobile, tablet and desktop.' },
    { icon: Layers, title: 'Multi-Course Support', desc: 'Scalable architecture supporting CA, ACCA, CMA, MBA, NEET and more.' },
    { icon: Users, title: 'AI Learning Assistant', desc: 'Get instant help from our AI study assistant, available 24/7.' },
];

const stats = [
    { value: '50,000+', label: 'Registered Students' },
    { value: '10,000+', label: 'Question Papers' },
    { value: '3 Major', label: 'CA Courses Supported' },
    { value: '4.9/5', label: 'Overall Rating' },
];

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 },
};

interface TeamMember { id: number; name: string; role: string; image: string | null; description: string; social_links: Record<string, string>; }

import Logo from '@/components/Logo';
import SEO from '@/components/SEO';

export default function AboutPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { data: team } = useQuery<TeamMember[]>({
        queryKey: ['team'],
        queryFn: async () => (await api.get('/about/team/')).data,
    });

    return (
        <div className="min-h-screen bg-light font-sans text-dark overflow-x-hidden">
            <SEO 
                title="About Us | Our Mission & Learning Ecosystem" 
                description="Learn about StudyQue's mission to empower students with smart, accessible, and high-quality preparation materials for CA, NEET, JEE, and KEAM exams."
            />
            {/* TOP NAVBAR */}
            <nav className="w-full h-20 flex items-center justify-between px-6 md:px-12 glass fixed top-0 z-[100] border-b border-white/20 transition-all">
                <div className="flex items-center gap-2">
                    <Link to="/" className="flex items-center gap-2 hover:scale-105 transition-transform duration-300">
                        <Logo theme="light" className="h-10 object-contain" />
                    </Link>
                </div>

                <div className="hidden lg:flex items-center gap-8">
                    <Link to="/" className="text-sm font-semibold hover:text-primary transition-colors">Home</Link>
                    <Link to="/dashboard/courses" className="text-sm font-semibold hover:text-primary transition-colors">Courses</Link>
                    <Link to="/about" className="text-sm font-bold text-primary">About Us</Link>
                    <Link to="/contact" className="text-sm font-semibold hover:text-primary transition-colors">Contact Us</Link>
                </div>

                <div className="hidden lg:flex items-center gap-3">
                    <Link to="/login" className="px-6 py-2.5 bg-primary text-white text-sm font-extrabold rounded-full shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">Login</Link>
                </div>

                {/* Mobile Hamburger Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="lg:hidden p-2 text-slate-600 hover:text-primary transition-colors"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </nav>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed top-20 left-0 w-full glass z-[99] flex flex-col p-6 gap-6 transition-all duration-300 ease-in-out">
                    <div className="flex flex-col gap-4">
                        <Link
                            to="/"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
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
                            to="/about"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-primary py-2 border-b border-slate-100/10 transition-colors"
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
                            className="w-full py-3 text-center bg-primary text-white text-sm font-extrabold rounded-full shadow-xl shadow-primary/30 transition-all"
                        >
                            Login
                        </Link>
                    </div>
                </div>
            )}

            {/* HERO SECTION */}
            <section className="relative pt-40 pb-24 px-6 text-center overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-primary/5 to-transparent -z-10" />
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -z-10" />

                <motion.div {...fadeUp} className="max-w-4xl mx-auto">
                    <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] uppercase tracking-widest mb-6 border border-primary/20">
                        Our Mission & Story
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight mb-8">
                        Empowering Students with <br />
                        <span className="gradient-text">Smart Learning Resources</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        qubook.in is built to bridge the gap between hard work and success by providing premium previous year papers, verified answers, and strategic study tools in a single modern experience.
                    </p>
                </motion.div>
            </section>

            {/* STATS SECTION */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {stats.map((s, i) => (
                        <motion.div
                            key={i}
                            {...fadeUp}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 text-center"
                        >
                            <p className="text-3xl md:text-5xl font-black text-primary">{s.value}</p>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">{s.label}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* VISION & MISSION */}
            <section className="py-32 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <motion.div {...fadeUp} className="space-y-6">
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900">Education Reimagined <br /> for the Modern Era</h2>
                        <div className="h-1.5 w-20 bg-gradient-to-r from-primary to-accent rounded-full" />
                        <p className="text-gray-500 font-medium leading-relaxed">
                            Our platform started as a simple idea: how can we make the massive syllabus of professional courses like CA, ACCA, and MBA more accessible?
                        </p>
                        <div className="space-y-4 pt-4">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold">Trust & Integrity</h4>
                                    <p className="text-sm text-gray-400 font-medium">Verified solutions by academic experts.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold">Seamless Experience</h4>
                                    <p className="text-sm text-gray-400 font-medium">Intuitive split-screen viewers and global search.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="relative group">
                        <div className="absolute -inset-4 bg-primary/20 rounded-[3rem] blur-2xl group-hover:bg-primary/30 transition-all duration-700" />
                        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/50 aspect-video">
                            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" alt="The qubook.in Team" className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* WHY CHOOSE US CARDS */}
            <section className="py-32 bg-secondary text-white px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div {...fadeUp} className="text-center mb-20 space-y-4">
                        <span className="text-primary font-black uppercase tracking-widest text-[10px]">The Premium Advantage</span>
                        <h2 className="text-4xl md:text-5xl font-black">Why Excellence Matters</h2>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                {...fadeUp}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 group hover:bg-primary transition-all duration-500"
                            >
                                <div className="w-14 h-14 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:text-primary transition-colors duration-500">
                                    <f.icon size={28} />
                                </div>
                                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                                <p className="text-white/50 text-sm leading-relaxed group-hover:text-white/80 transition-colors">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TEAM SECTION */}
            {team && team.length > 0 && (
                <section className="py-32 px-6 max-w-7xl mx-auto">
                    <motion.div {...fadeUp} className="text-center mb-20 space-y-4">
                        <span className="text-primary font-black uppercase tracking-widest text-[10px]">Behind the Platform</span>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900">Meet our Experts</h2>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {team.map((member, i) => (
                            <motion.div
                                key={member.id}
                                {...fadeUp}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 text-center group hover:translate-y-[-10px] transition-transform duration-500"
                            >
                                <div className="relative mx-auto mb-6 w-32 h-32">
                                    <div className="absolute inset-0 bg-primary rounded-full blur opacity-0 group-hover:opacity-20 transition-opacity" />
                                    {member.image ? (
                                        <img src={member.image} alt={member.name} className="w-full h-full rounded-full object-cover border-4 border-white shadow-xl relative z-10" />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-3xl font-black shadow-xl relative z-10">
                                            {member.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <h3 className="font-black text-xl text-gray-900 leading-tight">{member.name}</h3>
                                <p className="text-primary text-xs font-black uppercase tracking-widest mt-2">{member.role}</p>
                                {member.description && <p className="text-gray-400 text-xs mt-4 leading-relaxed font-medium">{member.description}</p>}

                                <div className="flex justify-center gap-3 mt-6">
                                    {Object.entries(member.social_links).map(([platform, url]) => (
                                        url && <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 hover:text-primary hover:bg-primary/10 transition-all text-[10px] font-black uppercase tracking-tighter">{platform.slice(0, 2)}</a>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            {/* FOOTER CTA */}
            <section className="py-24 px-10 bg-primary flex flex-col items-center justify-center text-center text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-10" />
                <motion.div {...fadeUp}>
                    <h2 className="text-4xl md:text-5xl font-black mb-6">Start Your Journey Today</h2>
                    <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">Join thousands of students who have already transformed their preparation strategy with qubook.in.</p>
                    <Link to="/login" className="px-12 py-5 bg-white text-primary rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3">
                        Start Learning Now <ArrowRight size={22} strokeWidth={3} />
                    </Link>
                </motion.div>
            </section>
        </div>
    );
}
