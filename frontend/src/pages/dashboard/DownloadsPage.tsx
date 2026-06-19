import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Trash2, FileText, CheckCircle2, Search, ArrowRight, ShieldCheck, Lock, ShieldOff, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

interface DownloadedItem {
    id: string;
    title: string;
    category: string;
    fileSize: string;
    downloadedAt: string;
    type: 'PAPER' | 'NOTE' | 'GUIDE';
}

const initialDownloads: DownloadedItem[] = [
    {
        id: '1',
        title: 'CA Intermediate Accounting - May 2024 PYP Solution',
        category: 'Question Papers',
        fileSize: '4.2 MB',
        downloadedAt: '2026-06-18',
        type: 'PAPER'
    },
    {
        id: '2',
        title: 'Corporate and Other Laws Quick Revision Notes',
        category: 'Revision Notes',
        fileSize: '1.8 MB',
        downloadedAt: '2026-06-17',
        type: 'NOTE'
    },
    {
        id: '3',
        title: 'ICAI Exam Guideline Sheet - Nov 2026',
        category: 'Syllabus Guides',
        fileSize: '850 KB',
        downloadedAt: '2026-06-15',
        type: 'GUIDE'
    }
];

const availableResources = [
    {
        id: 'a1',
        title: 'Taxation - Complete Formula Cheat Sheet',
        category: 'Revision Notes',
        fileSize: '2.1 MB',
        downloads: '1.2k'
    },
    {
        id: 'a2',
        title: 'Cost and Management Accounting - PYP Compilation (2020-2025)',
        category: 'Question Papers',
        fileSize: '8.4 MB',
        downloads: '3.4k'
    },
    {
        id: 'a3',
        title: 'Advanced Accounting Mock Test Series 1 - Solved',
        category: 'Mock Test Materials',
        fileSize: '3.2 MB',
        downloads: '850'
    }
];

export default function DownloadsPage() {
    const [downloads, setDownloads] = useState<DownloadedItem[]>(initialDownloads);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { hasDownloadAccess, isLoading: subLoading } = useSubscriptionAccess();

    const handleDelete = (id: string) => {
        setDownloads(prev => prev.filter(item => item.id !== id));
    };

    const handleDownloadResource = (res: any) => {
        // Add to offline downloads simulation
        const newItem: DownloadedItem = {
            id: String(Date.now()),
            title: res.title,
            category: res.category,
            fileSize: res.fileSize,
            downloadedAt: new Date().toISOString().split('T')[0],
            type: res.category.includes('Paper') ? 'PAPER' : 'NOTE'
        };
        setDownloads(prev => [newItem, ...prev]);
    };

    const filteredDownloads = downloads.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── Subscription Gate ─────────────────────────────────────────────────────
    if (!subLoading && !hasDownloadAccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-[75vh] flex flex-col items-center justify-center text-center px-8 bg-bg"
            >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
                    <Lock size={36} className="text-emerald-600" />
                </div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-700 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest mb-4">
                    <ShieldOff size={12} /> Downloads Locked
                </div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight mb-3">Downloads Locked</h2>
                <p className="text-sm text-text-secondary font-medium leading-relaxed max-w-sm mb-8">
                    Offline downloads are a premium feature. Subscribe to a plan with download access to save question papers, notes, and study guides for offline use.
                </p>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all"
                >
                    <CreditCard size={18} /> Upgrade to Premium
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 min-h-[85vh]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/20 inline-block">
                        Offline Mode
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight mt-3">Study Downloads</h1>
                    <p className="text-text-muted font-bold text-sm mt-1 uppercase tracking-wider">
                        Access your watermarked study materials offline anytime
                    </p>
                </div>

                <div className="relative shrink-0 w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="Search downloaded files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-border bg-card text-text-primary text-xs font-bold focus:outline-none focus:border-primary/40 shadow-sm"
                    />
                </div>
            </div>

            {/* Offline Shield Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-[2rem] p-6 flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-text-primary">Watermarked & Secure Downloads</h3>
                    <p className="text-text-muted text-xs font-semibold mt-1 leading-relaxed">
                        All downloaded PDFs are automatically watermarked with your username and timestamp. You can access these documents through your browser storage without an active internet connection.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Downloads List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xs font-black text-text-muted uppercase tracking-wider">
                        Your Offline Files ({filteredDownloads.length})
                    </h2>

                    {filteredDownloads.length === 0 ? (
                        <div className="bg-card rounded-[2rem] p-10 border border-border border-dashed text-center flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-bg border border-border flex items-center justify-center text-text-muted">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-text-primary">No Downloaded Files Found</h3>
                                <p className="text-[10px] text-text-muted font-bold mt-1">
                                    Search for available resources to save them offline.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredDownloads.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className="bg-card p-5 rounded-2xl border border-border hover:border-primary/20 hover:shadow-sm transition-all flex items-center justify-between gap-4 group"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-text-primary truncate">{item.title}</h4>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap text-[9px] font-bold text-text-muted">
                                                <span className="uppercase bg-bg px-2 py-0.5 rounded border border-border text-primary">{item.category}</span>
                                                <span>•</span>
                                                <span>Size: {item.fileSize}</span>
                                                <span>•</span>
                                                <span>Saved: {item.downloadedAt}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => window.open('#', '_blank')}
                                            className="px-3.5 py-1.5 bg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-primary border border-border rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                        >
                                            <CheckCircle2 size={11} className="text-emerald-500" />
                                            Open
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-all"
                                            title="Delete Offline Copy"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available for Download Section */}
                <div className="space-y-4">
                    <h2 className="text-xs font-black text-text-muted uppercase tracking-wider">
                        Recommended for You
                    </h2>

                    <div className="bg-card rounded-[2rem] border border-border p-6 space-y-4 shadow-sm">
                        {availableResources.map((res) => (
                            <div key={res.id} className="pb-4 border-b border-border/60 last:border-b-0 last:pb-0 space-y-2">
                                <div className="space-y-0.5">
                                    <h4 className="text-[11px] font-black text-text-primary leading-snug line-clamp-2">
                                        {res.title}
                                    </h4>
                                    <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                                        {res.category} ({res.fileSize})
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDownloadResource(res)}
                                    className="w-full py-2 bg-bg hover:bg-primary/5 hover:text-primary border border-border hover:border-primary/20 text-text-secondary rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <Download size={11} />
                                    Download ({res.downloads})
                                </button>
                            </div>
                        ))}

                        <button className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm">
                            Explore All Notes <ArrowRight size={11} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
