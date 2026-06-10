import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { 
    Lock, Sparkles, ArrowLeft, 
    ExternalLink, Search, Loader2, BookOpenCheck,
    Eye, ShieldAlert, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
    id: number;
    title: string;
    description?: string;
    subject: number;
    subject_name?: string;
    topic?: number;
    topic_name?: string;
    file_url: string;
    is_premium: boolean;
    created_at: string;
}

interface Subject {
    id: number;
    name: string;
    code?: string;
    description?: string;
}

interface Topic {
    id: number;
    subject: number;
    name: string;
}

export default function NotesPage() {
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
    const [activeNote, setActiveNote] = useState<Note | null>(null);

    // Queries
    const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
        queryKey: ['notes-list'],
        queryFn: async () => (await api.get('/materials/notes/')).data,
    });

    const { data: subjects = [] } = useQuery<Subject[]>({
        queryKey: ['subjects-list-small'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
    });

    const { data: topics = [] } = useQuery<Topic[]>({
        queryKey: ['topics-list-small'],
        queryFn: async () => (await api.get('/courses/topics/')).data,
    });

    // Check user subscription tier
    const isPremiumUser = user?.is_staff || (user?.subscription_tier && user.subscription_tier !== 'Free Account');

    // Filter topics by subject
    const filteredTopics = topics.filter(t => 
        selectedSubjectId === 'all' || String(t.subject) === String(selectedSubjectId)
    );

    // Filter notes
    const filteredNotes = notes.filter((note) => {
        const matchesSearch = 
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (note.description && note.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesSubject = 
            selectedSubjectId === 'all' || String(note.subject) === String(selectedSubjectId);
        
        const matchesTopic = 
            selectedTopicId === 'all' || String(note.topic) === String(selectedTopicId);

        return matchesSearch && matchesSubject && matchesTopic;
    });

    const handleSelectNote = (note: Note) => {
        if (note.is_premium && !isPremiumUser) {
            // Locked note for free users
            return;
        }
        setActiveNote(note);
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 min-h-[80vh]">
            <AnimatePresence mode="wait">
                {!activeNote ? (
                    // DIRECTORY VIEW
                    <motion.div
                        key="directory"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                                    Learning Hub
                                </span>
                                <h1 className="text-3xl font-black text-slate-900 mt-3">Study Notes & Materials</h1>
                                <p className="text-slate-500 font-semibold text-sm mt-1">
                                    Access top-quality chapter-wise summaries, key definitions, and revisions.
                                </p>
                            </div>

                            {/* Plan Status Widget */}
                            <div className="bg-card px-6 py-4 rounded-2xl border border-border shadow-sm flex items-center gap-4 shrink-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    isPremiumUser ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-bg text-text-muted border border-border'
                                }`}>
                                    <Sparkles size={22} className={isPremiumUser ? 'animate-pulse' : ''} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Access Status</p>
                                    <p className="text-xs font-black text-text-primary mt-0.5 max-w-[200px] truncate">
                                        {isPremiumUser ? 'Premium Content Unlocked' : 'Free Tier (Unlock Premium)'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters Toolbar */}
                        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Search bar */}
                            <div className="relative md:col-span-2">
                                <input
                                    type="text"
                                    placeholder="Search notes by title or keywords..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border focus:outline-none bg-bg text-text-primary text-xs font-semibold"
                                />
                                <Search className="absolute left-4 top-3.5 text-text-muted" size={16} />
                            </div>

                            {/* Subject filter */}
                            <div>
                                <select
                                    value={selectedSubjectId}
                                    onChange={(e) => {
                                        setSelectedSubjectId(e.target.value);
                                        setSelectedTopicId('all');
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold"
                                >
                                    <option value="all">All Subjects</option>
                                    {subjects.map((sub) => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Chapter/Topic filter */}
                            <div>
                                <select
                                    value={selectedTopicId}
                                    onChange={(e) => setSelectedTopicId(e.target.value)}
                                    disabled={selectedSubjectId === 'all'}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                >
                                    <option value="all">All Chapters</option>
                                    {filteredTopics.map((topic) => (
                                        <option key={topic.id} value={topic.id}>{topic.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Notes Grid */}
                        {notesLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="animate-spin text-indigo-600 mb-4" size={36} />
                                <p className="text-sm font-semibold text-slate-500">Loading resources...</p>
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="bg-card rounded-3xl border border-border p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
                                <div className="w-16 h-16 bg-bg rounded-2xl flex items-center justify-center text-text-muted mx-auto border border-border">
                                    <BookOpenCheck size={28} />
                                </div>
                                <h3 className="text-lg font-black text-text-primary">No study notes found</h3>
                                <p className="text-xs text-text-muted font-semibold leading-relaxed">
                                    Try checking another subject or refining your search. More study materials will be added soon.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredNotes.map((note) => {
                                    const isLocked = note.is_premium && !isPremiumUser;
                                    return (
                                        <motion.div
                                            key={note.id}
                                            whileHover={{ y: -4, scale: 1.01 }}
                                            className={`bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${
                                                isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                            }`}
                                            onClick={() => handleSelectNote(note)}
                                        >
                                            {/* Top indicators */}
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-bg text-text-secondary px-2 py-1 rounded">
                                                    {note.subject_name || 'General'}
                                                </span>
                                                
                                                {note.is_premium ? (
                                                    <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded ${
                                                        isLocked ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'
                                                    }`}>
                                                        {isLocked ? (
                                                            <>
                                                                <Lock size={10} />
                                                                <span>Premium</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={10} />
                                                                <span>Unlocked</span>
                                                            </>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase tracking-wider bg-green-50 text-green-700 px-2 py-1 rounded">
                                                        Free Notes
                                                    </span>
                                                )}
                                            </div>

                                            {/* Note content */}
                                            <div className="my-5 space-y-2">
                                                <h3 className="text-sm font-black text-text-primary leading-snug">
                                                    {note.title}
                                                </h3>
                                                {note.topic_name && (
                                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                                                        Chapter: {note.topic_name}
                                                    </p>
                                                )}
                                                <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed font-medium">
                                                    {note.description || 'Quick revision notes covering critical syllabus points and exam guidelines.'}
                                                </p>
                                            </div>

                                            {/* Footer action button */}
                                            <div className="border-t border-border pt-4 mt-2">
                                                {isLocked ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate('/dashboard/subscription');
                                                        }}
                                                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 tracking-wider shadow-md shadow-amber-600/10 transition-colors"
                                                    >
                                                        <Sparkles size={14} />
                                                        <span>Subscribe to Access</span>
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center justify-between text-indigo-600 font-bold text-xs">
                                                        <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                                                            <Eye size={14} />
                                                            <span>Read notes</span>
                                                        </span>
                                                        <ChevronRight size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    // READER VIEW
                    <motion.div
                        key="reader"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-3xl border border-border shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveNote(null)}
                                    className="p-2.5 hover:bg-bg rounded-2xl border border-border text-text-secondary transition-colors"
                                    title="Back to Directory"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded">
                                        {activeNote.subject_name || 'General'}
                                    </span>
                                    <h2 className="text-sm md:text-md font-black text-text-primary mt-1 max-w-[400px] md:max-w-[600px] truncate">
                                        {activeNote.title}
                                    </h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={activeNote.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    <span>New Tab</span>
                                </a>
                            </div>
                        </div>

                        {/* PDF Viewer Container */}
                        <div className="bg-slate-800 rounded-3xl border border-slate-900 shadow-2xl overflow-hidden min-h-[70vh] flex flex-col relative">
                            {activeNote.file_url ? (
                                <iframe
                                    src={`${activeNote.file_url}#toolbar=0`}
                                    className="w-full flex-1 border-none min-h-[70vh]"
                                    title={activeNote.title}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                    <ShieldAlert size={40} className="mb-4 text-red-400" />
                                    <h4 className="font-bold text-slate-200">Invalid PDF File</h4>
                                    <p className="text-xs text-slate-500 mt-1">This study resource does not have a valid document URL.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
