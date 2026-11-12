import { useState, useEffect, useRef } from 'react';
import {
    FileText, Upload, Copy, Check, ChevronLeft, ChevronRight,
    Search, Sparkles, X, ArrowDownRight,
    Maximize2, Minimize2, Eye, RefreshCw, Layers, CheckSquare,
    Key, CheckCircle2, AlertCircle, Bot, ExternalLink, Trash2, Zap, BookOpen
} from 'lucide-react';
import { extractAllTextFromPdf, renderPdfPageToCanvas, type ExtractedPageText } from '@/utils/pdfExtractor';
import api from '@/api/axios';

interface PdfDocState {
    file: File | null;
    url: string | null;
    numPages: number;
    currentPage: number;
    pages: ExtractedPageText[];
    fullText: string;
    loading: boolean;
    error: string | null;
}

interface Props {
    questionFile: File | null;
    answerFile: File | null;
    onQuestionFileChange: (file: File | null) => void;
    onAnswerFileChange: (file: File | null) => void;
    onInsertToQuestion: (text: string) => void;
    onInsertToAnswer: (text: string) => void;
    onInsertToPassage?: (text: string) => void;
    onSelectQuestion?: (question: any, idx?: number) => void;
    onRemoveQuestion?: (idx: number) => void;
    onStartScan: () => void;
    isScanning?: boolean;
    extractedData?: any;
    showToast: (msg: string) => void;
    onClose?: () => void;
    aiProvider?: 'gemini' | 'openai';
    onAiProviderChange?: (provider: 'gemini' | 'openai') => void;
}

export default function PdfLiveWorkspace({
    questionFile,
    answerFile,
    onQuestionFileChange,
    onAnswerFileChange,
    onInsertToQuestion,
    onInsertToAnswer,
    onInsertToPassage,
    
    onSelectQuestion,
    onRemoveQuestion,
    onStartScan,
    isScanning = false,
    extractedData = null,
    showToast,
    onClose,
    aiProvider = 'gemini',
    onAiProviderChange
}: Props) {
    // Mode: 'BOTH' | 'QP' | 'AP' | 'TREE'
    const [activeTab, setActiveTab] = useState<'QP' | 'AP' | 'BOTH' | 'TREE'>('BOTH');
    const [viewType, setViewType] = useState<'PAGE_TEXT' | 'NATIVE_PDF'>('PAGE_TEXT');

    // AI Provider & Key config state
    const [localProvider, setLocalProvider] = useState<'gemini' | 'openai'>(aiProvider);
    const activeProvider = onAiProviderChange ? aiProvider : localProvider;

    const handleSelectProvider = (prov: 'gemini' | 'openai') => {
        setLocalProvider(prov);
        if (onAiProviderChange) onAiProviderChange(prov);
    };

    const [showKeyModal, setShowKeyModal] = useState(false);
    const [activeKeyTab, setActiveKeyTab] = useState<'gemini' | 'openai'>('gemini');

    // Gemini API Key state
    const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [keyTestStatus, setKeyTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

    // OpenAI API Key state
    const [openaiKeyInput, setOpenaiKeyInput] = useState(() => localStorage.getItem('OPENAI_API_KEY') || '');
    const [isTestingOpenaiKey, setIsTestingOpenaiKey] = useState(false);
    const [openaiKeyTestStatus, setOpenaiKeyTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

    useEffect(() => {
        api.get('/materials/questions/ai-status/').then(res => {
            if (res.data?.active_provider) {
                if (!localStorage.getItem('AI_PROVIDER_CHOICE')) {
                    handleSelectProvider(res.data.active_provider);
                }
            }
        }).catch(() => {});
    }, []);

    const handleTestAndSaveKey = async (saveToDb = true) => {
        if (!apiKeyInput.trim()) {
            alert('Please enter a Gemini API Key');
            return;
        }
        setIsTestingKey(true);
        setKeyTestStatus(null);
        try {
            const res = await api.post('/materials/questions/test-gemini-key/', {
                gemini_api_key: apiKeyInput.trim(),
                save: saveToDb
            });
            if (res.data?.valid) {
                localStorage.setItem('GEMINI_API_KEY', apiKeyInput.trim());
                setKeyTestStatus({ success: true, message: res.data.message || 'Gemini AI connected and saved successfully!' });
                showToast('✓ Gemini API Key verified & saved!');
            } else {
                setKeyTestStatus({ success: false, message: res.data?.error || 'Invalid API Key' });
            }
        } catch (err: any) {
            setKeyTestStatus({ success: false, message: err.response?.data?.error || 'Failed to connect with Gemini API' });
        } finally {
            setIsTestingKey(false);
        }
    };

    const handleTestAndSaveOpenaiKey = async (saveToDb = true) => {
        if (!openaiKeyInput.trim()) {
            alert('Please enter an OpenAI API Key');
            return;
        }
        setIsTestingOpenaiKey(true);
        setOpenaiKeyTestStatus(null);
        try {
            const res = await api.post('/materials/questions/test-openai-key/', {
                openai_api_key: openaiKeyInput.trim(),
                save: saveToDb
            });
            if (res.data?.valid) {
                localStorage.setItem('OPENAI_API_KEY', openaiKeyInput.trim());
                setOpenaiKeyTestStatus({ success: true, message: res.data.message || 'OpenAI API connected and saved successfully!' });
                showToast('✓ OpenAI API Key verified & saved!');
            } else {
                setOpenaiKeyTestStatus({ success: false, message: res.data?.error || 'Invalid API Key' });
            }
        } catch (err: any) {
            setOpenaiKeyTestStatus({ success: false, message: err.response?.data?.error || 'Failed to connect with OpenAI API' });
        } finally {
            setIsTestingOpenaiKey(false);
        }
    };

    const [localQuestions, setLocalQuestions] = useState<any[]>([]);

    useEffect(() => {
        if (extractedData?.questions && Array.isArray(extractedData.questions)) {
            setLocalQuestions(extractedData.questions);
            if (extractedData.questions.length > 0) {
                setActiveTab('TREE');
            }
        } else {
            setLocalQuestions([]);
        }
    }, [extractedData]);

    const handleRemoveQuestion = (idxToRemove: number) => {
        const qToRemove = localQuestions[idxToRemove];
        const nextList = localQuestions.filter((_, i) => i !== idxToRemove);
        setLocalQuestions(nextList);
        if (onRemoveQuestion) {
            onRemoveQuestion(idxToRemove);
        }
        showToast(`✓ Removed Q.${qToRemove?.q_no || idxToRemove + 1} from workspace`);
    };

    const handleRemoveAllInstructions = () => {
        const instructionTriggers = [
            "question paper comprises",
            "part i comprises",
            "part ii comprises",
            "part iii comprises",
            "case scenario based multiple choice",
            "questions which require descriptive",
            "all questions are compulsory",
            "working notes should form part",
            "candidates are permitted",
            "candidates are allowed",
            "reading time",
            "omr answer sheet",
            "instructions to candidates",
            "general instructions"
        ];
        const filtered = localQuestions.filter(q => {
            const txt = (q.question_text || '').toLowerCase();
            return !instructionTriggers.some(trig => txt.includes(trig));
        });
        const removedCount = localQuestions.length - filtered.length;
        setLocalQuestions(filtered);
        if (removedCount > 0) {
            showToast(`🧹 Removed ${removedCount} general instruction card(s)!`);
        } else {
            showToast(`No general instruction cards found.`);
        }
    };

    const handleClearAllQuestions = () => {
        if (window.confirm('Are you sure you want to remove all extracted questions from this list?')) {
            setLocalQuestions([]);
            showToast(`All questions removed from workspace.`);
        }
    };

    const renderTablePreview = (tableRaw: any) => {
        if (!tableRaw) return null;
        let table = tableRaw;
        if (typeof table === 'string') {
            try {
                table = JSON.parse(table);
            } catch {
                return null;
            }
        }
        if (!table || !Array.isArray(table.headers) || table.headers.length === 0) return null;
        return (
            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white my-2.5">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        {table.title || '📊 Accounting / Financial Table'}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                        {(table.rows || []).length} rows × {table.headers.length} cols
                    </span>
                </div>
                <table className="min-w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-300 text-slate-800 font-bold">
                        <tr>
                            {table.headers.map((h: string, hi: number) => {
                                const isAmount = /amount|₹|rs|debit|credit|dr|cr|balance|total|cost|nominal|value/i.test(h || '');
                                return (
                                    <th key={hi} className={`px-3 py-2 border-r last:border-r-0 border-slate-200 text-slate-800 font-bold whitespace-nowrap ${isAmount ? 'text-right' : ''}`}>
                                        {h}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                        {(table.rows || []).map((row: string[], ri: number) => (
                            <tr key={ri} className="hover:bg-indigo-50/30 transition-colors">
                                {row.map((cell: string, ci: number) => {
                                    const isAmountCol = /amount|₹|rs|debit|credit|dr|cr|balance|total|cost|nominal|value/i.test(table.headers[ci] || '');
                                    return (
                                        <td key={ci} className={`px-3 py-1.5 border-r last:border-r-0 border-slate-200 text-slate-700 ${isAmountCol ? 'text-right font-mono font-medium' : ''}`}>
                                            {cell}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Question PDF State
    const [qpState, setQpState] = useState<PdfDocState>({
        file: null,
        url: null,
        numPages: 0,
        currentPage: 1,
        pages: [],
        fullText: '',
        loading: false,
        error: null
    });

    // Answer PDF State
    const [apState, setApState] = useState<PdfDocState>({
        file: null,
        url: null,
        numPages: 0,
        currentPage: 1,
        pages: [],
        fullText: '',
        loading: false,
        error: null
    });

    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [scale] = useState(1.2);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedHighlightedText, setSelectedHighlightedText] = useState('');

    const qpCanvasRef = useRef<HTMLCanvasElement>(null);
    const apCanvasRef = useRef<HTMLCanvasElement>(null);
    const qpFileInputRef = useRef<HTMLInputElement>(null);
    const apFileInputRef = useRef<HTMLInputElement>(null);

    // Load and parse Question PDF on change
    useEffect(() => {
        if (!questionFile) {
            setQpState({
                file: null,
                url: null,
                numPages: 0,
                currentPage: 1,
                pages: [],
                fullText: '',
                loading: false,
                error: null
            });
            return;
        }

        const url = URL.createObjectURL(questionFile);
        setQpState(prev => ({ ...prev, file: questionFile, url, loading: true, error: null, currentPage: 1 }));

        extractAllTextFromPdf(questionFile)
            .then(res => {
                setQpState(prev => ({
                    ...prev,
                    numPages: res.numPages,
                    pages: res.pages,
                    fullText: res.fullText,
                    loading: false
                }));
                showToast(`✓ Question PDF loaded (${res.numPages} pages ready to view & copy)`);
            })
            .catch(err => {
                console.error('Failed to parse QP PDF:', err);
                setQpState(prev => ({ ...prev, loading: false, error: 'Could not extract text from this PDF.' }));
            });

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [questionFile]);

    // Load and parse Answer PDF on change
    useEffect(() => {
        if (!answerFile) {
            setApState({
                file: null,
                url: null,
                numPages: 0,
                currentPage: 1,
                pages: [],
                fullText: '',
                loading: false,
                error: null
            });
            return;
        }

        const url = URL.createObjectURL(answerFile);
        setApState(prev => ({ ...prev, file: answerFile, url, loading: true, error: null, currentPage: 1 }));

        extractAllTextFromPdf(answerFile)
            .then(res => {
                setApState(prev => ({
                    ...prev,
                    numPages: res.numPages,
                    pages: res.pages,
                    fullText: res.fullText,
                    loading: false
                }));
                showToast(`✓ Answer PDF loaded (${res.numPages} pages ready to view & copy)`);
            })
            .catch(err => {
                console.error('Failed to parse AP PDF:', err);
                setApState(prev => ({ ...prev, loading: false, error: 'Could not extract text from this PDF.' }));
            });

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [answerFile]);

    // Render Canvas Page for QP
    useEffect(() => {
        if (viewType === 'PAGE_TEXT' && qpState.file && qpCanvasRef.current && qpState.currentPage <= qpState.numPages) {
            renderPdfPageToCanvas(qpState.file, qpState.currentPage, qpCanvasRef.current, scale).catch(e => {
                console.warn('Canvas render QP error:', e);
            });
        }
    }, [qpState.file, qpState.currentPage, scale, viewType, activeTab]);

    // Render Canvas Page for AP
    useEffect(() => {
        if (viewType === 'PAGE_TEXT' && apState.file && apCanvasRef.current && apState.currentPage <= apState.numPages) {
            renderPdfPageToCanvas(apState.file, apState.currentPage, apCanvasRef.current, scale).catch(e => {
                console.warn('Canvas render AP error:', e);
            });
        }
    }, [apState.file, apState.currentPage, scale, viewType, activeTab]);

    const handleCopy = (text: string, key: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        showToast(`✓ Copied: ${label}`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Listen for text selection in window/workspace
    const handleMouseUpCaptureText = () => {
        const sel = window.getSelection()?.toString().trim();
        if (sel && sel.length > 2) {
            setSelectedHighlightedText(sel);
        }
    };

    const hasAnyFile = !!qpState.file || !!apState.file;
    const currentQpPageData = qpState.pages.find(p => p.pageNumber === qpState.currentPage);
    const currentApPageData = apState.pages.find(p => p.pageNumber === apState.currentPage);

    return (
        <div
            onMouseUp={handleMouseUpCaptureText}
            className={`bg-white border-2 border-indigo-200 rounded-2xl shadow-xl transition-all duration-300 flex flex-col ${
                isFullScreen ? 'fixed inset-4 z-50 overflow-hidden' : 'relative my-4'
            }`}
        >
            {/* Top Workspace Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold shadow-md text-white">
                        <FileText size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black tracking-wider uppercase text-white">
                                Live PDF Workspace & Text Extractor
                            </h2>
                            <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-[10px] font-bold rounded-full border border-blue-400/30">
                                Instant Page Copy
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">
                            View uploaded PDF pages side-by-side, highlight & copy text, or insert directly into question fields.
                        </p>
                    </div>
                </div>

                {/* Top Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: Page Text vs Native PDF */}
                    <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewType('PAGE_TEXT')}
                            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                                viewType === 'PAGE_TEXT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <Layers size={13} />
                            <span>Visual + Text Extractor</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewType('NATIVE_PDF')}
                            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                                viewType === 'NATIVE_PDF' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            <Eye size={13} />
                            <span>Native PDF Viewer</span>
                        </button>
                    </div>

                    {/* Full Screen Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all"
                        title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                    >
                        {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 rounded-xl border border-slate-700 transition-all"
                            title="Close Workspace"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Upload Boxes Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Question PDF Upload Card */}
                    <div className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                        qpState.file ? 'bg-blue-50/60 border-blue-300' : 'bg-white border-dashed border-slate-300 hover:border-blue-400'
                    }`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                                qpState.file ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                QP
                            </div>
                            <div className="truncate">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                        Question Paper PDF
                                    </span>
                                    {qpState.numPages > 0 && (
                                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                                            {qpState.numPages} Pages
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {qpState.file ? qpState.file.name : 'Click to select Question Paper PDF'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {qpState.file ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => qpFileInputRef.current?.click()}
                                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onQuestionFileChange(null)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Remove Question PDF"
                                    >
                                        <X size={15} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => qpFileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <Upload size={13} />
                                    <span>Upload QP</span>
                                </button>
                            )}
                        </div>
                        <input
                            ref={qpFileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && onQuestionFileChange(e.target.files[0])}
                        />
                    </div>

                    {/* Answer PDF Upload Card */}
                    <div className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                        apState.file ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-dashed border-slate-300 hover:border-emerald-400'
                    }`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                                apState.file ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                AP
                            </div>
                            <div className="truncate">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                        Suggested Answer PDF
                                    </span>
                                    {apState.numPages > 0 && (
                                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                            {apState.numPages} Pages
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {apState.file ? apState.file.name : 'Click to select Answer Paper PDF'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {apState.file ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => apFileInputRef.current?.click()}
                                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onAnswerFileChange(null)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Remove Answer PDF"
                                    >
                                        <X size={15} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => apFileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <Upload size={13} />
                                    <span>Upload AP</span>
                                </button>
                            )}
                        </div>
                        <input
                            ref={apFileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && onAnswerFileChange(e.target.files[0])}
                        />
                    </div>
                </div>

                {/* Scan & Fast Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Tab Switchers */}
                        <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                            {qpState.file && apState.file && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('BOTH')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'BOTH' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Side-by-Side (QP + AP)
                                </button>
                            )}
                            {qpState.file && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('QP')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'QP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Question Paper
                                </button>
                            )}
                            {apState.file && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('AP')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'AP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Answer Paper
                                </button>
                            )}
                            {localQuestions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('TREE')}
                                    className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                                        activeTab === 'TREE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-700 hover:bg-indigo-100 font-extrabold'
                                    }`}
                                >
                                    <Sparkles size={12} className="text-yellow-300" />
                                    <span>AI Questions ({localQuestions.length})</span>
                                </button>
                            )}
                        </div>

                        {/* Search in PDF */}
                        <div className="relative flex items-center">
                            <Search size={13} className="absolute left-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search in pages..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-7 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 w-36"
                            />
                        </div>
                    </div>

                    {/* Multi-AI Provider Selector & Global Scan Button */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Interactive Provider Toggle */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-300 text-[11px] font-bold">
                            <button
                                type="button"
                                onClick={() => handleSelectProvider('gemini')}
                                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                                    activeProvider === 'gemini'
                                        ? 'bg-white text-indigo-700 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Use Google Gemini AI"
                            >
                                <Bot size={12} className="text-indigo-600" />
                                <span>Gemini</span>
                                {activeProvider === 'gemini' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectProvider('openai')}
                                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                                    activeProvider === 'openai'
                                        ? 'bg-white text-emerald-700 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Use OpenAI (GPT-4o / GPT-4o-mini)"
                            >
                                <Zap size={12} className="text-emerald-600" />
                                <span>OpenAI</span>
                                {activeProvider === 'openai' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowKeyModal(true)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all"
                            title="Configure or test Gemini and OpenAI API Keys"
                        >
                            <Key size={12} className="text-amber-500" />
                            <span>API Keys</span>
                        </button>

                        <button
                            type="button"
                            onClick={onStartScan}
                            disabled={(!qpState.file && !apState.file) || isScanning}
                            className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-40 ${
                                activeProvider === 'openai'
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800'
                                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                            }`}
                        >
                            {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-yellow-300" />}
                            <span>
                                {isScanning
                                    ? `${activeProvider === 'openai' ? 'OpenAI' : 'Gemini'} Extracting & Solving...`
                                    : `⚡ Auto Scan & Fill with ${activeProvider === 'openai' ? 'OpenAI' : 'Gemini AI'}`
                                }
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Selected Highlight Floating Transfer Bar */}
            {selectedHighlightedText && (
                <div className="bg-indigo-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-inner text-xs animate-in fade-in">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black rounded text-[10px] uppercase">
                            Selected Text ({selectedHighlightedText.length} chars)
                        </span>
                        <p className="truncate max-w-md font-mono text-[11px] text-indigo-100">
                            "{selectedHighlightedText}"
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleCopy(selectedHighlightedText, 'highlight', 'Selected Text')}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs flex items-center gap-1"
                        >
                            <Copy size={12} /> Copy
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onInsertToQuestion(selectedHighlightedText);
                                showToast('✓ Inserted selection into Question Text');
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1 shadow-sm"
                        >
                            <ArrowDownRight size={12} /> Into Question
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onInsertToAnswer(selectedHighlightedText);
                                showToast('✓ Inserted selection into Answer Text');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center gap-1 shadow-sm"
                        >
                            <CheckSquare size={12} /> Into Answer
                        </button>
                        {onInsertToPassage && (
                            <button
                                type="button"
                                onClick={() => {
                                    onInsertToPassage(selectedHighlightedText);
                                    showToast('✓ Inserted selection into Case Passage');
                                }}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1"
                            >
                                Into Passage
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSelectedHighlightedText('')}
                            className="p-1 hover:bg-indigo-800 rounded text-indigo-300"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* EXTRACTED QUESTIONS TREE VIEW */}
            {activeTab === 'TREE' && localQuestions.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[700px] bg-slate-50">
                    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-yellow-300">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <span>{localQuestions.length} Questions Auto-Extracted & Solved</span>
                                    {extractedData?.ai_powered && (
                                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono">
                                            Gemini AI Powered
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-indigo-200">
                                    Question numbers, types, MCQ options, and suggested answers are automatically populated. Click any question below to load into the editor form.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleRemoveAllInstructions}
                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                title="Remove general exam instructions (e.g. 'The question paper comprises two parts...')"
                            >
                                <Trash2 size={12} />
                                <span>Remove Instructions</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllQuestions}
                                className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Clear all questions from workspace"
                            >
                                <X size={12} />
                                <span>Clear All</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {localQuestions.map((q: any, idx: number) => {
                            const isMcq = q.question_type === 'MCQ';
                            return (
                                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-all space-y-3">
                                    {/* Card Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2.5 py-1 bg-blue-600 text-white font-black text-xs rounded-lg shadow-sm">
                                                Q. {q.q_no || idx + 1}
                                            </span>
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[11px] rounded-md">
                                                {q.question_type || 'NORMAL'}
                                            </span>
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px] rounded-md">
                                                {q.marks || 10} Marks
                                            </span>
                                            {q.correct_answer && (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-md flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> Solution Auto-Filled
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(q.question_text || '', `q-${idx}`, `Q.${q.q_no} Text`)}
                                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
                                            >
                                                <Copy size={11} /> Copy Q
                                            </button>
                                            {q.correct_answer && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(q.correct_answer || '', `a-${idx}`, `Q.${q.q_no} Answer`)}
                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1"
                                                >
                                                    <Copy size={11} /> Copy Ans
                                                </button>
                                            )}
                                            {onSelectQuestion && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectQuestion(q, idx);
                                                        showToast(`✓ Question Q.${q.q_no || idx + 1} and solution loaded into form!`);
                                                    }}
                                                    className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                                >
                                                    <ArrowDownRight size={13} />
                                                    <span>Auto-Fill This Question</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuestion(idx)}
                                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                                                title="Remove this question/instruction card"
                                            >
                                                <Trash2 size={11} />
                                                <span>Remove</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Question Text */}
                                    <div className="text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                                        {q.question_text}
                                    </div>

                                    {/* Question Accounting / Financial Table */}
                                    {renderTablePreview(q.table_data || q.structured_table)}

                                    {/* Case Scenario Narrative Passage / Context */}
                                    {q.case_scenario_passage && (
                                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                                    <BookOpen size={13} /> Case Scenario Passage / Context
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(q.case_scenario_passage || '', `p-${idx}`, `Case Scenario Passage`)}
                                                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-bold flex items-center gap-1"
                                                >
                                                    <Copy size={10} /> Copy Story
                                                </button>
                                            </div>
                                            <p className="text-xs text-amber-950 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto pr-1">
                                                {q.case_scenario_passage}
                                            </p>
                                        </div>
                                    )}

                                    {/* Nested Sub-Questions for Case Scenario or Multi-part */}
                                    {q.sub_questions && q.sub_questions.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <CheckSquare size={13} className="text-indigo-600" />
                                                    Nested Sub-Questions ({q.sub_questions.length})
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {q.sub_questions.reduce((acc: number, sq: any) => acc + (sq.marks || 2), 0)} Total Marks
                                                </span>
                                            </div>
                                            <div className="space-y-2.5">
                                                {q.sub_questions.map((sq: any, sqIdx: number) => {
                                                    const isSqMcq = sq.question_type === 'MCQ' || (sq.options && sq.options.length > 0);
                                                    return (
                                                        <div key={sqIdx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-5 h-5 rounded bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                                                                        {sq.identifier || sqIdx + 1}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-500">
                                                                        ({sq.marks || 2} Marks)
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(sq.question_text || '', `sq-${idx}-${sqIdx}`, `Sub-Q ${sq.identifier}`)}
                                                                    className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                                                                >
                                                                    <Copy size={10} /> Copy
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
                                                                {sq.question_text}
                                                            </p>
                                                            {renderTablePreview(sq.table_data)}
                                                            {isSqMcq && sq.options && sq.options.length > 0 && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pt-1">
                                                                    {sq.options.map((opt: any, oIdx: number) => {
                                                                        const optLabel = String.fromCharCode(65 + oIdx);
                                                                        const optText = typeof opt === 'string' ? opt : (opt.text || '');
                                                                        const isCorr = typeof opt === 'object' && opt.is_correct;
                                                                        return (
                                                                            <div
                                                                                key={oIdx}
                                                                                className={`p-1.5 rounded-md text-[11px] border flex items-center gap-2 ${
                                                                                    isCorr ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' : 'bg-white border-slate-200 text-slate-700'
                                                                                }`}
                                                                            >
                                                                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${isCorr ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                                                    {optLabel}
                                                                                </span>
                                                                                <span className="truncate">{optText}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {sq.correct_answer && (
                                                                <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2 text-[11px] text-emerald-950 font-sans">
                                                                    <span className="font-bold text-emerald-800">Ans: </span>
                                                                    {sq.correct_answer}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* MCQ Options */}
                                    {isMcq && q.options && q.options.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                            {q.options.map((opt: any, oIdx: number) => {
                                                const optLabel = String.fromCharCode(65 + oIdx);
                                                const optText = typeof opt === 'string' ? opt : (opt.text || '');
                                                const isCorr = typeof opt === 'object' && opt.is_correct;
                                                return (
                                                    <div
                                                        key={oIdx}
                                                        className={`p-2 rounded-lg text-xs border flex items-center gap-2 ${
                                                            isCorr ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                                                        }`}
                                                    >
                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isCorr ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                            {optLabel}
                                                        </span>
                                                        <span className="truncate">{optText}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Solution / Correct Answer */}
                                    {q.correct_answer && (
                                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2">
                                            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                                                ✓ Suggested Solution / Model Answer
                                            </span>
                                            <p className="text-xs text-emerald-950 whitespace-pre-wrap font-sans leading-relaxed">
                                                {q.correct_answer}
                                            </p>

                                            {/* Solution Accounting Table */}
                                            {renderTablePreview(q.answer_table_data || q.solution_table || q.matched_answer?.structured_table || q.structured_table_solution)}

                                            {q.working_notes && (
                                                <div className="mt-2 pt-2 border-t border-emerald-200/60">
                                                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Working Notes:</span>
                                                    <p className="text-xs text-emerald-900 whitespace-pre-wrap font-mono mt-0.5">{q.working_notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : !hasAnyFile ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                        <Upload size={32} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                        Upload Question PDF or Answer PDF Above
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md">
                        Once uploaded, the PDF will open right here instantly. You can view all pages, highlight any text or tables, copy with one click, or transfer directly into your question form.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[550px] max-h-[700px]">
                    {/* LEFT PANEL: QUESTION PAPER */}
                    {qpState.file && (activeTab === 'BOTH' || activeTab === 'QP' || !apState.file) && (
                        <div className={`flex flex-col h-full bg-slate-50 ${activeTab === 'QP' || !apState.file ? 'col-span-full' : ''}`}>
                            {/* Panel Header & Page Nav */}
                            <div className="p-3 bg-blue-50/80 border-b border-blue-200 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-xs rounded-md">
                                        QP
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                                        {qpState.file.name}
                                    </span>
                                </div>

                                {/* Page Navigation */}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={qpState.currentPage <= 1}
                                        onClick={() => setQpState(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                                        className="p-1 bg-white hover:bg-blue-100 disabled:opacity-30 border border-slate-200 rounded text-slate-700"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-black text-slate-700 px-2 py-0.5 bg-white border border-slate-200 rounded">
                                        Page {qpState.currentPage} / {qpState.numPages || 1}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={qpState.currentPage >= qpState.numPages}
                                        onClick={() => setQpState(prev => ({ ...prev, currentPage: Math.min(prev.numPages, prev.currentPage + 1) }))}
                                        className="p-1 bg-white hover:bg-blue-100 disabled:opacity-30 border border-slate-200 rounded text-slate-700"
                                        title="Next Page"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                {/* One-Click Copy & Transfer Page */}
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const txt = currentQpPageData?.text || '';
                                            handleCopy(txt, `qp-page-${qpState.currentPage}`, `Page ${qpState.currentPage} Text`);
                                        }}
                                        className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                    >
                                        {copiedKey === `qp-page-${qpState.currentPage}` ? <Check size={12} /> : <Copy size={12} />}
                                        <span>Copy Page</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const txt = currentQpPageData?.text || '';
                                            if (txt) {
                                                onInsertToQuestion(txt);
                                                showToast(`✓ Inserted Page ${qpState.currentPage} into Question Text`);
                                            }
                                        }}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                        title="Insert all text from this page into question text box"
                                    >
                                        <ArrowDownRight size={12} />
                                        <span>Use as Question</span>
                                    </button>
                                </div>
                            </div>

                            {/* Viewer Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {viewType === 'NATIVE_PDF' ? (
                                    <iframe
                                        src={qpState.url || ''}
                                        className="w-full h-full min-h-[500px] border-none rounded-xl shadow-inner bg-white"
                                        title="Question Paper Native PDF"
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {/* Crisp Canvas Rendering */}
                                        <div className="flex justify-center bg-slate-200/60 p-3 rounded-xl border border-slate-300 overflow-x-auto shadow-sm">
                                            <canvas
                                                ref={qpCanvasRef}
                                                className="shadow-md rounded-lg max-w-full bg-white"
                                            />
                                        </div>

                                        {/* Selectable & Copyable Extracted Page Text Box */}
                                        <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm space-y-2">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1">
                                                    📄 Page {qpState.currentPage} Extracted Text (Select & Copy)
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(currentQpPageData?.text || '', 'qp-raw', 'Page Raw Text')}
                                                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <Copy size={11} /> Copy All
                                                </button>
                                            </div>

                                            <div className="text-xs text-slate-800 leading-relaxed font-sans select-text whitespace-pre-wrap max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                {currentQpPageData?.text || (qpState.loading ? 'Extracting text...' : 'No selectable text on this page.')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* RIGHT PANEL: ANSWER PAPER */}
                    {apState.file && (activeTab === 'BOTH' || activeTab === 'AP' || !qpState.file) && (
                        <div className={`flex flex-col h-full bg-slate-50 ${activeTab === 'AP' || !qpState.file ? 'col-span-full' : ''}`}>
                            {/* Panel Header & Page Nav */}
                            <div className="p-3 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-xs rounded-md">
                                        AP
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                                        {apState.file.name}
                                    </span>
                                </div>

                                {/* Page Navigation */}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={apState.currentPage <= 1}
                                        onClick={() => setApState(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                                        className="p-1 bg-white hover:bg-emerald-100 disabled:opacity-30 border border-slate-200 rounded text-slate-700"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-black text-slate-700 px-2 py-0.5 bg-white border border-slate-200 rounded">
                                        Page {apState.currentPage} / {apState.numPages || 1}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={apState.currentPage >= apState.numPages}
                                        onClick={() => setApState(prev => ({ ...prev, currentPage: Math.min(prev.numPages, prev.currentPage + 1) }))}
                                        className="p-1 bg-white hover:bg-emerald-100 disabled:opacity-30 border border-slate-200 rounded text-slate-700"
                                        title="Next Page"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                {/* One-Click Copy & Transfer Page */}
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const txt = currentApPageData?.text || '';
                                            handleCopy(txt, `ap-page-${apState.currentPage}`, `Page ${apState.currentPage} Solution`);
                                        }}
                                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                    >
                                        {copiedKey === `ap-page-${apState.currentPage}` ? <Check size={12} /> : <Copy size={12} />}
                                        <span>Copy Solution</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const txt = currentApPageData?.text || '';
                                            if (txt) {
                                                onInsertToAnswer(txt);
                                                showToast(`✓ Inserted Page ${apState.currentPage} into Answer / Solution`);
                                            }
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                        title="Insert all text from this page into answer text box"
                                    >
                                        <CheckSquare size={12} />
                                        <span>Use as Answer</span>
                                    </button>
                                </div>
                            </div>

                            {/* Viewer Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {viewType === 'NATIVE_PDF' ? (
                                    <iframe
                                        src={apState.url || ''}
                                        className="w-full h-full min-h-[500px] border-none rounded-xl shadow-inner bg-white"
                                        title="Answer Paper Native PDF"
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {/* Crisp Canvas Rendering */}
                                        <div className="flex justify-center bg-slate-200/60 p-3 rounded-xl border border-slate-300 overflow-x-auto shadow-sm">
                                            <canvas
                                                ref={apCanvasRef}
                                                className="shadow-md rounded-lg max-w-full bg-white"
                                            />
                                        </div>

                                        {/* Selectable & Copyable Extracted Page Text Box */}
                                        <div className="bg-white border-2 border-emerald-200 rounded-xl p-4 shadow-sm space-y-2">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                                                    📘 Page {apState.currentPage} Solution Text (Select & Copy)
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(currentApPageData?.text || '', 'ap-raw', 'Page Raw Solution')}
                                                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <Copy size={11} /> Copy All
                                                </button>
                                            </div>

                                            <div className="text-xs text-slate-800 leading-relaxed font-sans select-text whitespace-pre-wrap max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                {currentApPageData?.text || (apState.loading ? 'Extracting text...' : 'No selectable text on this page.')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MULTI-PROVIDER AI KEY CONFIG MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <Bot size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900">AI Provider Configuration</h3>
                                    <p className="text-[11px] text-slate-500">Auto-detects question numbers & fills solutions</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowKeyModal(false)}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Provider Selection Tabs */}
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setActiveKeyTab('gemini')}
                                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                    activeKeyTab === 'gemini'
                                        ? 'bg-white text-indigo-700 shadow-sm font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Bot size={14} className="text-indigo-600" />
                                <span>Google Gemini</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveKeyTab('openai')}
                                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                    activeKeyTab === 'openai'
                                        ? 'bg-white text-emerald-700 shadow-sm font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Zap size={14} className="text-emerald-600" />
                                <span>OpenAI (ChatGPT)</span>
                            </button>
                        </div>

                        {/* GEMINI TAB CONTENT */}
                        {activeKeyTab === 'gemini' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Gemini API Key
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="AIzaSy..."
                                        value={apiKeyInput}
                                        onChange={e => {
                                            setApiKeyInput(e.target.value);
                                            setKeyTestStatus(null);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                        <span>Supports Gemini 2.0 Flash & Gemini 1.5 Flash</span>
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold"
                                        >
                                            Get API Key <ExternalLink size={10} />
                                        </a>
                                    </p>
                                </div>

                                {keyTestStatus && (
                                    <div
                                        className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                                            keyTestStatus.success
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                : 'bg-red-50 text-red-800 border border-red-200'
                                        }`}
                                    >
                                        {keyTestStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                        <span>{keyTestStatus.message}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTestAndSaveKey(false)}
                                        disabled={isTestingKey || !apiKeyInput.trim()}
                                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {isTestingKey ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTestAndSaveKey(true)}
                                        disabled={isTestingKey || !apiKeyInput.trim()}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        Save & Connect
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* OPENAI TAB CONTENT */}
                        {activeKeyTab === 'openai' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        OpenAI API Key
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="sk-proj-..."
                                        value={openaiKeyInput}
                                        onChange={e => {
                                            setOpenaiKeyInput(e.target.value);
                                            setOpenaiKeyTestStatus(null);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                        <span>Supports GPT-4o, GPT-4o-mini & GPT-4.1</span>
                                        <a
                                            href="https://platform.openai.com/api-keys"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold"
                                        >
                                            Get API Key <ExternalLink size={10} />
                                        </a>
                                    </p>
                                </div>

                                {openaiKeyTestStatus && (
                                    <div
                                        className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                                            openaiKeyTestStatus.success
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                : 'bg-red-50 text-red-800 border border-red-200'
                                        }`}
                                    >
                                        {openaiKeyTestStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                        <span>{openaiKeyTestStatus.message}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTestAndSaveOpenaiKey(false)}
                                        disabled={isTestingOpenaiKey || !openaiKeyInput.trim()}
                                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {isTestingOpenaiKey ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTestAndSaveOpenaiKey(true)}
                                        disabled={isTestingOpenaiKey || !openaiKeyInput.trim()}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        Save & Connect
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                            💡 API keys are securely validated on the server and saved in database settings (<code className="text-slate-700">PlatformSetting</code>). Keys are never exposed to browser clients.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
