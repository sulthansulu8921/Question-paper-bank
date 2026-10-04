import { useState, useEffect, useRef } from 'react';
import {
    FileText, Upload, Copy, Check, ChevronLeft, ChevronRight,
    Search, Sparkles, X, ArrowDownRight,
    Maximize2, Minimize2, Eye, RefreshCw, Layers, CheckSquare
} from 'lucide-react';
import { extractAllTextFromPdf, renderPdfPageToCanvas, type ExtractedPageText } from '@/utils/pdfExtractor';

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
    onStartScan: () => void;
    isScanning?: boolean;
    extractedData?: any;
    showToast: (msg: string) => void;
    onClose?: () => void;
}

export default function PdfLiveWorkspace({
    questionFile,
    answerFile,
    onQuestionFileChange,
    onAnswerFileChange,
    onInsertToQuestion,
    onInsertToAnswer,
    onInsertToPassage,
    onStartScan,
    isScanning = false,
    extractedData: _extractedData = null,
    showToast,
    onClose
}: Props) {
    // Mode: 'SPLIT' (dual if both present) | 'QP_ONLY' | 'AP_ONLY' | 'EXTRACTED_TREE'
    const [activeTab, setActiveTab] = useState<'QP' | 'AP' | 'BOTH' | 'TREE'>('BOTH');
    const [viewType, setViewType] = useState<'PAGE_TEXT' | 'NATIVE_PDF'>('PAGE_TEXT');
    
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
                    <div className="flex items-center gap-2">
                        {/* Tab Switchers */}
                        {qpState.file && apState.file && (
                            <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('BOTH')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'BOTH' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Side-by-Side (QP + AP)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('QP')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'QP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Question Paper Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('AP')}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        activeTab === 'AP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Answer Paper Only
                                </button>
                            </div>
                        )}

                        {/* Search in PDF */}
                        <div className="relative flex items-center">
                            <Search size={13} className="absolute left-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search text in PDF pages..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-7 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 w-48"
                            />
                        </div>
                    </div>

                    {/* Global Scan Button */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onStartScan}
                            disabled={(!qpState.file && !apState.file) || isScanning}
                            className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                        >
                            {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            <span>{isScanning ? 'Auto Scanning...' : '[ ⚡ Auto Scan & Parse Questions ]'}</span>
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

            {/* MAIN PDF VIEW AREA */}
            {!hasAnyFile ? (
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
        </div>
    );
}
