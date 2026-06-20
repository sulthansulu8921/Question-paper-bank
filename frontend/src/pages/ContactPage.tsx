import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Clock, MessageCircle, Loader2, CheckCircle, ArrowRight, Menu, X } from 'lucide-react';
import api from '@/api/axios';

interface SiteSettings {
    contact_email: string;
    contact_phone: string;
    whatsapp_number: string;
    office_address: string;
    support_hours: string;
    google_maps_embed_url: string;
}

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 },
};

import Logo from '@/components/Logo';
import SEO from '@/components/SEO';

export default function ContactPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { data: settings } = useQuery<SiteSettings>({
        queryKey: ['site-settings'],
        queryFn: async () => (await api.get('/about/settings/')).data,
    });

    const [form, setForm] = useState({ full_name: '', email: '', mobile: '', subject: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        
        const whatsappNumber = settings?.whatsapp_number?.replace(/\D/g, '') || '918086390965';
        const text = `Hello Qubook Support,

I would like to contact you. Here are my details:
*Name:* ${form.full_name}
*Mobile:* ${form.mobile || 'N/A'}
*Email:* ${form.email}
*Subject:* ${form.subject}
*Message:* ${form.message}`;

        const encodedText = encodeURIComponent(text);
        
        try {
            await api.post('/about/contact/', form);
        } catch (err) {
            console.error('Failed to log message to DB', err);
        }
        
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedText}`, '_blank');
        
        setSuccess(true);
        setForm({ full_name: '', email: '', mobile: '', subject: '', message: '' });
        setLoading(false);
    };

    const contactInfo = [
        { icon: Mail, label: 'Email', value: settings?.contact_email || 'qubook.helpline@gmail.com', href: `mailto:${settings?.contact_email || 'qubook.helpline@gmail.com'}` },
        { icon: Phone, label: 'Phone', value: settings?.contact_phone || '+91 8086390965', href: settings?.contact_phone ? `tel:${settings.contact_phone}` : 'tel:+918086390965' },
        { icon: Clock, label: 'Support Hours', value: settings?.support_hours || 'Mon–Sat, 9am–6pm IST', href: undefined },
    ];

    return (
        <div className="min-h-screen bg-light font-sans text-dark overflow-x-hidden">
            <SEO 
                title="Contact Us | Support & Helpline" 
                description="Have any questions or need support? Contact StudyQue's academic helpline via email, phone, or instant WhatsApp support."
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
                    <Link to="/about" className="text-sm font-semibold hover:text-primary transition-colors">About Us</Link>
                    <Link to="/contact" className="text-sm font-bold text-primary">Contact Us</Link>
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
                            className="text-sm font-bold text-slate-500 hover:text-primary py-2 border-b border-slate-100/10 transition-colors"
                        >
                            About Us
                        </Link>
                        <Link
                            to="/contact"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-sm font-bold text-primary py-2 border-b border-slate-100/10 transition-colors"
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

            {/* HERO */}
            <section className="pt-40 pb-20 px-6 text-center bg-gradient-to-b from-primary/5 to-transparent relative overflow-hidden">
                <div className="absolute top-20 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-[120px] -z-10" />
                <motion.div {...fadeUp} className="max-w-3xl mx-auto">
                    <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] uppercase tracking-widest mb-6 border border-primary/20">
                        Get in Touch
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight mb-6">Let's solve your <br /> <span className="gradient-text">Queries together</span></h1>
                    <p className="text-gray-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">Our support team is dedicated to help you at every step of your professional exam journey.</p>
                </motion.div>
            </section>

            {/* CONTACT INFO CARDS */}
            <section className="py-12 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {contactInfo.map((item, i) => (
                        <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }}>
                            {item.href && item.href !== '#map' ? (
                                <a href={item.href} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 block hover:translate-y-[-5px] transition-transform group">
                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                                        <item.icon size={22} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.label}</p>
                                    <p className="font-bold text-gray-900 text-sm mt-2 leading-snug">{item.value}</p>
                                </a>
                            ) : (
                                <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50">
                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                                        <item.icon size={22} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.label}</p>
                                    <p className="font-bold text-gray-900 text-sm mt-2 leading-snug">{item.value}</p>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* FORM + MAP */}
            <section className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* form */}
                <motion.div {...fadeUp} className="bg-white p-10 md:p-16 rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/50">
                    <h2 className="text-3xl font-black text-gray-900 mb-8">Send Us a Message</h2>

                    {success ? (
                        <div className="text-center py-20 bg-success/5 rounded-[2rem] border border-success/10">
                            <CheckCircle className="mx-auto text-success mb-6" size={64} />
                            <h3 className="text-2xl font-black text-gray-900">Message Delivered!</h3>
                            <p className="text-gray-500 font-medium mt-3">Expect a response from our team <br /> within 24 business hours.</p>
                            <button onClick={() => setSuccess(false)} className="mt-8 text-primary font-black hover:underline uppercase tracking-widest text-[10px]">Send another message</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && <div className="p-5 bg-danger/10 text-danger rounded-2xl text-sm font-bold border border-danger/20">{error}</div>}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                                    <input name="full_name" required value={form.full_name} onChange={handleChange} placeholder="John Doe" className="w-full px-6 py-4 rounded-2xl border border-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-gray-50/50 text-sm font-medium transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mobile</label>
                                    <input name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91 000 000 0000" className="w-full px-6 py-4 rounded-2xl border border-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-gray-50/50 text-sm font-medium transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email ID</label>
                                <input type="email" name="email" required value={form.email} onChange={handleChange} placeholder="john@example.com" className="w-full px-6 py-4 rounded-2xl border border-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-gray-50/50 text-sm font-medium transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Subject</label>
                                <input name="subject" required value={form.subject} onChange={handleChange} placeholder="Issue with Subscription" className="w-full px-6 py-4 rounded-2xl border border-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-gray-50/50 text-sm font-medium transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Your Message</label>
                                <textarea name="message" required rows={4} value={form.message} onChange={handleChange} placeholder="Tell us how we can help..." className="w-full px-6 py-4 rounded-2xl border border-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-gray-50/50 text-sm font-medium resize-none transition-all" />
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg hover:translate-y-[-2px] flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/30 transition-all disabled:opacity-70">
                                {loading ? <Loader2 size={24} className="animate-spin" /> : <><MessageCircle size={20} className="fill-white" /> Send on WhatsApp</>}
                            </button>
                        </form>
                    )}
                </motion.div>

                {/* whatsapp support */}
                <div className="flex flex-col gap-6 w-full lg:sticky lg:top-28">

                    {(settings?.whatsapp_number || true) && (
                        <motion.a
                            {...fadeUp}
                            href={`https://wa.me/${settings?.whatsapp_number?.replace(/\D/g, '') || '918086390965'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white p-8 rounded-[2.5rem] flex items-center gap-6 border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-10px] transition-transform group"
                        >
                            <div className="w-16 h-16 bg-green-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform flex-shrink-0 animate-bounce-slow">
                                <MessageCircle size={32} />
                            </div>
                            <div>
                                <p className="font-black text-xl text-gray-900 leading-tight">Instant Support</p>
                                <p className="text-sm text-gray-400 font-bold mt-1">Click to chat on WhatsApp <ArrowRight size={14} className="inline ml-1" /></p>
                            </div>
                        </motion.a>
                    )}
                </div>
            </section>
        </div>
    );
}
