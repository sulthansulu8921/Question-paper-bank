import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { 
    Shield, Loader2, ArrowRight, AlertCircle,
    Sliders, Clock, BookOpen, Award
} from 'lucide-react';

export default function MockTestHub() {
    const navigate = useNavigate();

    // Query to load academic master tree
    const { data: tree = [], isLoading: treeLoading } = useQuery<any[]>({
        queryKey: ['master-tree'],
        queryFn: async () => (await api.get('/master/tree/')).data,
    });

    // Query to load published mock test templates
    const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
        queryKey: ['published-mock-templates'],
        queryFn: async () => {
            const res = await api.get('/materials/mock-templates/');
            return Array.isArray(res.data) ? res.data.filter((t: any) => t.is_published) : [];
        }
    });

    // Main Selection Type
    const [mockType, setMockType] = useState<'official' | 'standard' | 'custom'>('official');

    // Standard Mock Setup
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [selectedLevelId, setSelectedLevelId] = useState<string>('');

    // Custom Mock Setup
    const [customStream, setCustomStream] = useState<string>('');
    const [customLevelId, setCustomLevelId] = useState<string>('');
    const [selectedPaperId, setSelectedPaperId] = useState<string>('all');
    const [customQuestionCount, setCustomQuestionCount] = useState<number>(30);
    const [customDuration, setCustomDuration] = useState<number>(45); // in minutes
    const [difficulty, setDifficulty] = useState<string>('MIXED');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Extract unique streams
    const streams = useMemo(() => {
        const set = new Set<string>();
        tree.forEach((level: any) => {
            if (level.qualification) {
                set.add(level.qualification.toUpperCase());
            }
        });
        return Array.from(set).sort();
    }, [tree]);

    // Standard levels
    const standardLevels = useMemo(() => {
        if (!selectedStream) return [];
        return tree.filter((l: any) => l.qualification?.toUpperCase() === selectedStream.toUpperCase());
    }, [tree, selectedStream]);

    // Custom levels
    const customLevels = useMemo(() => {
        if (!customStream) return [];
        return tree.filter((l: any) => l.qualification?.toUpperCase() === customStream.toUpperCase());
    }, [tree, customStream]);

    // Custom papers
    const customPapers = useMemo(() => {
        if (!customLevelId) return [];
        const level = customLevels.find((l: any) => String(l.id) === String(customLevelId));
        return level?.papers || [];
    }, [customLevels, customLevelId]);

    // Start Template-based Official Mock Test
    const handleStartOfficialMock = async (template: any) => {
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            const payload = {
                mock_template_id: template.id,
            };

            const response = await api.post('/materials/assessment-sessions/', payload);
            const session = response.data;
            // Store target duration in localStorage
            localStorage.setItem(`mock_duration_${session.id}`, String(template.duration_minutes * 60));
            navigate(`/dashboard/mock/session/${session.id}`);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || 'Failed to start Official Mock session.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Start Standard Exam Mock
    const handleStartStandardMock = async () => {
        if (!selectedStream || !selectedLevelId) {
            setErrorMsg('Please select both an Exam Category and Level.');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);

        const level = standardLevels.find((l: any) => String(l.id) === String(selectedLevelId));

        try {
            const payload = {
                session_type: 'MOCK',
                title: `${level?.name || selectedStream} Full Syllabus Mock`,
                qualification: selectedStream,
                course_level: level?.name || '',
                subject: '', // Full syllabus
                chapter: '',
                topic: '',
                total_questions: 50, // Standard size
                difficulty: 'MIXED',
                mode: 'CHALLENGE',
                duration_minutes: 60 // 60 minutes
            };

            const response = await api.post('/materials/assessment-sessions/', payload);
            const session = response.data;
            // Store target duration in localStorage for the MockSession to read
            localStorage.setItem(`mock_duration_${session.id}`, String(60 * 60)); // 60 min in seconds
            navigate(`/dashboard/mock/session/${session.id}`);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || 'Failed to start Mock session.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Start Custom Mock
    const handleStartCustomMock = async () => {
        if (!customStream || !customLevelId) {
            setErrorMsg('Please select both an Exam Category and Level for custom mock.');
            return;
        }

        setErrorMsg('');
        setIsSubmitting(true);

        const level = customLevels.find((l: any) => String(l.id) === String(customLevelId));
        const paper = customPapers.find((p: any) => String(p.id) === String(selectedPaperId));

        try {
            const payload = {
                session_type: 'MOCK',
                title: `Custom Mock: ${level?.name || customStream}`,
                qualification: customStream,
                course_level: level?.name || '',
                subject: selectedPaperId === 'all' ? '' : (paper?.name || ''),
                chapter: '',
                topic: '',
                total_questions: customQuestionCount,
                difficulty: difficulty,
                mode: 'CHALLENGE',
                duration_minutes: customDuration
            };

            const response = await api.post('/materials/assessment-sessions/', payload);
            const session = response.data;
            // Store target duration in localStorage
            localStorage.setItem(`mock_duration_${session.id}`, String(customDuration * 60));
            navigate(`/dashboard/mock/session/${session.id}`);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || 'Failed to start Custom Mock.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 min-h-[85vh]">
            {/* Header */}
            <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                    Exam Simulator
                </span>
                <h1 className="text-3xl font-black text-slate-900 mt-3">Mock Test Hub</h1>
                <p className="text-slate-500 font-semibold text-sm mt-1">
                    Take official exam papers or build custom mock sessions to simulate test conditions.
                </p>
            </div>

            {/* Type selector tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => {
                        setMockType('official');
                        setErrorMsg('');
                    }}
                    className={`pb-4 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        mockType === 'official' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Official Mock Tests
                </button>
                <button
                    onClick={() => {
                        setMockType('standard');
                        setErrorMsg('');
                    }}
                    className={`pb-4 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        mockType === 'standard' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Syllabus-Wise Mocks
                </button>
                <button
                    onClick={() => {
                        setMockType('custom');
                        setErrorMsg('');
                    }}
                    className={`pb-4 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        mockType === 'custom' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Custom Mock Creator
                </button>
            </div>

            {treeLoading || templatesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-border shadow-sm">
                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                    <p className="text-sm font-semibold text-slate-500">Loading syllabus configurations...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left details/form pane */}
                    <div className="lg:col-span-2">
                        {mockType === 'official' && (
                            <div className="space-y-6">
                                {templates.length === 0 ? (
                                    <div className="bg-card rounded-3xl p-8 border border-border text-center space-y-3">
                                        <Award className="mx-auto text-slate-400" size={48} />
                                        <h3 className="text-sm font-bold text-slate-700">No official mock templates published yet.</h3>
                                        <p className="text-xs text-slate-500">Use "Syllabus-Wise Mocks" or "Custom Mock Creator" to generate exams dynamically.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {templates.map((template) => (
                                            <div key={template.id} className="bg-card rounded-3xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                                                <div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100">
                                                            {template.qualification}
                                                        </span>
                                                        {template.course_level && (
                                                            <span className="text-[9px] font-black bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full uppercase tracking-wider border border-slate-100">
                                                                {template.course_level}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-black text-slate-900 mt-3">{template.title}</h3>
                                                    {template.description && (
                                                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 border-t border-border pt-3">
                                                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-indigo-500" />{template.duration_minutes} Mins</span>
                                                        <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-indigo-500" />{template.total_questions} Questions</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleStartOfficialMock(template)}
                                                        disabled={isSubmitting}
                                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                                                    >
                                                        <span>Launch Exam</span>
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {mockType === 'standard' && (
                            <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                                <h2 className="text-md font-black text-slate-900 flex items-center gap-2.5 pb-4 border-b border-border">
                                    <Shield className="text-indigo-600" size={20} />
                                    <span>Select Mock Syllabus</span>
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Stream */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Exam Category</label>
                                        <select
                                            value={selectedStream}
                                            onChange={(e) => {
                                                setSelectedStream(e.target.value);
                                                setSelectedLevelId('');
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold"
                                        >
                                            <option value="">Choose Exam Category</option>
                                            {streams.map((stream) => (
                                                <option key={stream} value={stream}>{stream}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Level / Course</label>
                                        <select
                                            value={selectedLevelId}
                                            onChange={(e) => setSelectedLevelId(e.target.value)}
                                            disabled={!selectedStream}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                        >
                                            <option value="">Select Level</option>
                                            {standardLevels.map((l: any) => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-5 space-y-3">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Standard Mock Rules:</h4>
                                    <ul className="text-xs font-semibold text-indigo-950/80 space-y-2 list-disc pl-5">
                                        <li>Full syllabus coverage of the selected course level.</li>
                                        <li>50 Multiple Choice Questions (MCQ) dynamically chosen.</li>
                                        <li>Strict 60-minute duration. The test automatically submits when the timer runs out.</li>
                                        <li>Learning elements (explanations & corrections) are locked during testing.</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {mockType === 'custom' && (
                            <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                                <h2 className="text-md font-black text-slate-900 flex items-center gap-2.5 pb-4 border-b border-border">
                                    <Sliders className="text-indigo-600" size={20} />
                                    <span>Custom Mock Configuration</span>
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Stream */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Exam Category</label>
                                        <select
                                            value={customStream}
                                            onChange={(e) => {
                                                setCustomStream(e.target.value);
                                                setCustomLevelId('');
                                                setSelectedPaperId('all');
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold"
                                        >
                                            <option value="">Choose Exam Category</option>
                                            {streams.map((stream) => (
                                                <option key={stream} value={stream}>{stream}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Level / Course</label>
                                        <select
                                            value={customLevelId}
                                            onChange={(e) => {
                                                setCustomLevelId(e.target.value);
                                                setSelectedPaperId('all');
                                            }}
                                            disabled={!customStream}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                        >
                                            <option value="">Select Level</option>
                                            {customLevels.map((l: any) => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    {/* Subject Paper */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Subject / Paper</label>
                                        <select
                                            value={selectedPaperId}
                                            onChange={(e) => setSelectedPaperId(e.target.value)}
                                            disabled={!customLevelId}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 bg-slate-50/50 text-xs font-bold disabled:opacity-50"
                                        >
                                            <option value="all">All Subjects (Random Mixed)</option>
                                            {customPapers.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Question Count */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Question Count</label>
                                        <input
                                            type="number"
                                            value={customQuestionCount}
                                            onChange={(e) => setCustomQuestionCount(parseInt(e.target.value, 10) || 10)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-bg text-text-primary text-xs font-bold focus:outline-none"
                                        />
                                    </div>

                                    {/* Duration */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Duration (Mins)</label>
                                        <input
                                            type="number"
                                            value={customDuration}
                                            onChange={(e) => setCustomDuration(parseInt(e.target.value, 10) || 15)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-bg text-text-primary text-xs font-bold focus:outline-none"
                                        />
                                    </div>

                                    {/* Difficulty */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Difficulty</label>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-slate-50/50 text-xs font-bold"
                                        >
                                            <option value="MIXED">Mixed</option>
                                            <option value="EASY">Easy</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HARD">Hard</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Start Action Card Panel */}
                    <div className="space-y-6">
                        <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
                            <h2 className="text-md font-black text-slate-900 flex items-center gap-2.5 pb-4 border-b border-border">
                                <Clock className="text-indigo-600" size={20} />
                                <span>Session Preview</span>
                            </h2>

                            <div className="space-y-4 text-xs font-semibold text-text-secondary">
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span>Mode</span>
                                    <span className="font-black text-indigo-600">CHALLENGE</span>
                                </div>
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span>Questions</span>
                                    <span className="font-black text-slate-900">
                                        {mockType === 'official' ? 'As Configured' : (mockType === 'standard' ? 50 : customQuestionCount)}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span>Time Allowed</span>
                                    <span className="font-black text-slate-900">
                                        {mockType === 'official' ? 'As Configured' : (mockType === 'standard' ? '60 mins' : `${customDuration} mins`)}
                                    </span>
                                </div>
                                <div className="flex justify-between pb-2">
                                    <span>Immediate Review</span>
                                    <span className="font-black text-red-500">Disabled (Graded at End)</span>
                                </div>
                            </div>

                            {/* Error notification */}
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <p className="text-xs font-semibold leading-normal">{errorMsg}</p>
                                </div>
                            )}

                            {mockType !== 'official' && (
                                <button
                                    onClick={mockType === 'standard' ? handleStartStandardMock : handleStartCustomMock}
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-colors"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            <span>Starting Simulator...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Enter Exam Simulator</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            )}
                            {mockType === 'official' && (
                                <div className="text-center text-[10px] text-slate-400 font-bold">
                                    Select an Official Mock Test from the list on the left to start.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
