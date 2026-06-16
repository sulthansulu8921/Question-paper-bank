import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { 
    Layers, Settings, Award, 
    ArrowRight, Loader2, Sparkles, AlertCircle
} from 'lucide-react';

export default function PracticeHub() {
    const navigate = useNavigate();

    // Query to load the complete academic master tree
    const { data: tree = [], isLoading: treeLoading } = useQuery<any[]>({
        queryKey: ['master-tree'],
        queryFn: async () => (await api.get('/master/tree/')).data,
    });

    // Step state or selection state
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [selectedLevelId, setSelectedLevelId] = useState<string>('');
    const [selectedPaperId, setSelectedPaperId] = useState<string>('all');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('all');

    // Practice Settings
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [customCount, setCustomCount] = useState<string>('');
    const [difficulty, setDifficulty] = useState<string>('MIXED');
    const [practiceMode, setPracticeMode] = useState<string>('LEARNING'); // LEARNING or CHALLENGE

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Extract unique streams (qualifications)
    const streams = useMemo(() => {
        const set = new Set<string>();
        tree.forEach((level: any) => {
            if (level.qualification) {
                set.add(level.qualification.toUpperCase());
            }
        });
        return Array.from(set).sort();
    }, [tree]);

    // Filter levels by stream
    const levels = useMemo(() => {
        if (!selectedStream) return [];
        return tree.filter((l: any) => l.qualification?.toUpperCase() === selectedStream.toUpperCase());
    }, [tree, selectedStream]);

    // Filter papers (subjects) by level
    const papers = useMemo(() => {
        if (!selectedLevelId) return [];
        const level = levels.find((l: any) => String(l.id) === String(selectedLevelId));
        return level?.papers || [];
    }, [levels, selectedLevelId]);

    // Filter chapters by paper
    const chapters = useMemo(() => {
        if (selectedPaperId === 'all' || !selectedPaperId) return [];
        const paper = papers.find((p: any) => String(p.id) === String(selectedPaperId));
        return paper?.chapters || [];
    }, [papers, selectedPaperId]);

    // Filter topics by chapter
    const topics = useMemo(() => {
        if (selectedChapterId === 'all' || !selectedChapterId) return [];
        const chapter = chapters.find((c: any) => String(c.id) === String(selectedChapterId));
        return chapter?.topics || [];
    }, [chapters, selectedChapterId]);

    // Start practice handler
    const handleStartPractice = async () => {
        if (!selectedStream || !selectedLevelId) {
            setErrorMsg('Please select both an Exam Category and Course Level.');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);

        const level = levels.find((l: any) => String(l.id) === String(selectedLevelId));
        const paper = papers.find((p: any) => String(p.id) === String(selectedPaperId));
        const chapter = chapters.find((c: any) => String(c.id) === String(selectedChapterId));
        const topic = topics.find((t: any) => String(t.id) === String(selectedTopicId));

        const count = customCount ? parseInt(customCount, 10) : questionCount;

        try {
            const payload = {
                session_type: 'PRACTICE',
                title: `${level?.name || selectedStream} Practice`,
                qualification: selectedStream,
                course_level: level?.name || '',
                subject: selectedPaperId === 'all' ? '' : (paper?.name || ''),
                chapter: selectedChapterId === 'all' ? '' : (chapter?.name || ''),
                topic: selectedTopicId === 'all' ? '' : (topic?.name || ''),
                total_questions: count,
                difficulty: difficulty,
                mode: practiceMode
            };

            const response = await api.post('/materials/assessment-sessions/', payload);
            const session = response.data;
            navigate(`/dashboard/practice/session/${session.id}`);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || 'Failed to start practice session. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 min-h-[85vh]">
            {/* Header section */}
            <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                    Step-by-Step Trainer
                </span>
                <h1 className="text-3xl font-black text-slate-900 mt-3">Universal MCQ Practice</h1>
                <p className="text-slate-500 font-semibold text-sm mt-1">
                    Select your syllabus, choose your difficulty, and sharpen your skills.
                </p>
            </div>

            {treeLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-border shadow-sm">
                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                    <p className="text-sm font-semibold text-slate-500">Loading syllabus configurations...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Selectors Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                            <h2 className="text-md font-black text-slate-900 flex items-center gap-2.5 pb-4 border-b border-border">
                                <Layers className="text-indigo-600" size={20} />
                                <span>1. Select Course & Syllabus</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Qualification Stream */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Exam Category</label>
                                    <select
                                        value={selectedStream}
                                        onChange={(e) => {
                                            setSelectedStream(e.target.value);
                                            setSelectedLevelId('');
                                            setSelectedPaperId('all');
                                            setSelectedChapterId('all');
                                            setSelectedTopicId('all');
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold"
                                    >
                                        <option value="">Choose Exam (e.g. NEET, CA, JEE)</option>
                                        {streams.map((stream) => (
                                            <option key={stream} value={stream}>{stream}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Course Level */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Course Level</label>
                                    <select
                                        value={selectedLevelId}
                                        onChange={(e) => {
                                            setSelectedLevelId(e.target.value);
                                            setSelectedPaperId('all');
                                            setSelectedChapterId('all');
                                            setSelectedTopicId('all');
                                        }}
                                        disabled={!selectedStream}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                    >
                                        <option value="">Select Level</option>
                                        {levels.map((l: any) => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Subject Paper */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Subject / Paper</label>
                                    <select
                                        value={selectedPaperId}
                                        onChange={(e) => {
                                            setSelectedPaperId(e.target.value);
                                            setSelectedChapterId('all');
                                            setSelectedTopicId('all');
                                        }}
                                        disabled={!selectedLevelId}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                    >
                                        <option value="all">All Subjects (Random Mixed Questions)</option>
                                        {papers.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Chapter */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Chapter</label>
                                    <select
                                        value={selectedChapterId}
                                        onChange={(e) => {
                                            setSelectedChapterId(e.target.value);
                                            setSelectedTopicId('all');
                                        }}
                                        disabled={selectedPaperId === 'all'}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                    >
                                        <option value="all">All Chapters</option>
                                        {chapters.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Topic */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Topic</label>
                                    <select
                                        value={selectedTopicId}
                                        onChange={(e) => {
                                            setSelectedTopicId(e.target.value);
                                        }}
                                        disabled={selectedChapterId === 'all'}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                    >
                                        <option value="all">All Topics</option>
                                        {topics.map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Settings & Trigger Column */}
                    <div className="space-y-6">
                        <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                            <h2 className="text-md font-black text-slate-900 flex items-center gap-2.5 pb-4 border-b border-border">
                                <Settings className="text-indigo-600" size={20} />
                                <span>2. Practice Settings</span>
                            </h2>

                            {/* Question Count selector */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Question Count</label>
                                <div className="flex gap-2">
                                    {[10, 25, 50].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => {
                                                setQuestionCount(num);
                                                setCustomCount('');
                                            }}
                                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                                                questionCount === num && !customCount
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                                    : 'bg-bg hover:bg-slate-100 text-text-secondary border border-border'
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    placeholder="Or custom count (e.g. 15)"
                                    value={customCount}
                                    onChange={(e) => setCustomCount(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-bg text-text-primary text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-50"
                                />
                            </div>

                            {/* Difficulty */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Difficulty Level</label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold"
                                >
                                    <option value="MIXED">Mixed Difficulty</option>
                                    <option value="EASY">Easy</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HARD">Hard</option>
                                </select>
                            </div>

                            {/* Training Mode */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Training Mode</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {/* Learning Mode */}
                                    <div
                                        onClick={() => setPracticeMode('LEARNING')}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                            practiceMode === 'LEARNING'
                                                ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10'
                                                : 'bg-bg hover:bg-slate-50 border-border'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 rounded-full p-1 ${
                                                practiceMode === 'LEARNING' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                                            }`}>
                                                <Sparkles size={12} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-900">Learning Mode</h4>
                                                <p className="text-[10px] text-slate-500 mt-0.5 font-semibold leading-normal">
                                                    Instant answers, complete answers keys, detailed explanations, and concept notes page-by-page.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Challenge Mode */}
                                    <div
                                        onClick={() => setPracticeMode('CHALLENGE')}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                            practiceMode === 'CHALLENGE'
                                                ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10'
                                                : 'bg-bg hover:bg-slate-50 border-border'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 rounded-full p-1 ${
                                                practiceMode === 'CHALLENGE' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                                            }`}>
                                                <Award size={12} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-900">Challenge Mode</h4>
                                                <p className="text-[10px] text-slate-500 mt-0.5 font-semibold leading-normal">
                                                    Real exam simulation. Answers are locked and graded at the end under a custom timer.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error notification */}
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <p className="text-xs font-semibold leading-normal">{errorMsg}</p>
                                </div>
                            )}

                            {/* Start Trigger */}
                            <button
                                onClick={handleStartPractice}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-colors"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        <span>Building Session...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Start Practice Session</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
