import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import {
    Upload, FileText, CheckCircle2, AlertCircle, Loader2,
    X, Save, Eye, Sparkles, Plus, Minimize2, Maximize2
} from 'lucide-react';

interface Props {
    open: boolean;
    onClose: () => void;
    icaiTopicId?: number | string | null;
    chapterId?: number | string | null;
    subjectId?: number | string | null;
    onUploaded?: () => void;
    onSelectQuestion?: (question: any) => void;
}

const SOURCES = ['MTP-01', 'MTP-02', 'RTP', 'Suggested Answers', 'Model Test Paper 1', 'Model Test Paper 2', 'Model Test Paper 3', 'Other'];
const YEARS = ['2025', '2024', '2023', '2022'];
const ATTEMPTS = ['MAY', 'NOV', 'JAN', 'SEP'];

export default function PDFUploadModal({ open, onClose, icaiTopicId, chapterId: _chapterId, subjectId: propSubjectId, onUploaded, onSelectQuestion }: Props) {
    const queryClient = useQueryClient();
    
    // Mode: 'DUAL' (Question PDF + Answer PDF) | 'SINGLE' (Combined PDF)
    const [uploadMode, setUploadMode] = useState<'DUAL' | 'SINGLE'>('DUAL');

    const questionFileInputRef = useRef<HTMLInputElement>(null);
    const answerFileInputRef = useRef<HTMLInputElement>(null);

    const [questionFile, setQuestionFile] = useState<File | null>(null);
    const [answerFile, setAnswerFile] = useState<File | null>(null);

    const [form, setForm] = useState({
        title: '',
        subject_id: propSubjectId ? String(propSubjectId) : '',
        icai_topic_id: icaiTopicId ? String(icaiTopicId) : '',
        year: '2025',
        attempt: 'MAY',
        source: 'MTP-01',
        auto_save: true,
    });

    const [statusStep, setStatusStep] = useState<'IDLE' | 'EXTRACTING' | 'REVIEW' | 'SAVING' | 'DONE' | 'ERROR'>('IDLE');
    const [statusMsg, setStatusMsg] = useState('');
    const [extractedData, setExtractedData] = useState<any>(null);
    const [previewQuestion, setPreviewQuestion] = useState<any>(null);
    const [editableQuestions, setEditableQuestions] = useState<any[]>([]);
    const [isTextPanelMinimized, setIsTextPanelMinimized] = useState(false);

    // Fetch subjects for dropdown
    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects-list'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
        enabled: open,
    });

    const handleExtract = async () => {
        if (!questionFile && !answerFile) {
            alert('Please select at least one PDF file (Question PDF or Answer PDF).');
            return;
        }

        setStatusStep('EXTRACTING');
        setStatusMsg('Extracting text, tables, sub-questions (a,b,c) and matching answers...');

        const fd = new FormData();
        if (questionFile) fd.append('question_pdf', questionFile);
        if (questionFile) fd.append('pdf', questionFile);
        if (answerFile) fd.append('answer_pdf', answerFile);

        fd.append('title', form.title || questionFile?.name || answerFile?.name || '');
        if (form.subject_id) fd.append('subject_id', form.subject_id);
        if (form.icai_topic_id || icaiTopicId) fd.append('icai_topic_id', form.icai_topic_id || String(icaiTopicId));
        fd.append('year', form.year);
        fd.append('attempt', form.attempt);
        fd.append('source', form.source);

        try {
            const res = await api.post('/materials/questions/extract-from-pdf/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setExtractedData(res.data);
            const rawQs = res.data.questions || [];
            setEditableQuestions(rawQs);

            if (form.auto_save && res.data.auto_saved) {
                setStatusStep('DONE');
                setStatusMsg(`Successfully extracted & saved ${res.data.saved_count || rawQs.length} questions to database!`);
                queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
                queryClient.invalidateQueries({ queryKey: ['master-tree'] });
                if (onUploaded) onUploaded();
            } else {
                setStatusStep('REVIEW');
                setStatusMsg(`Extracted ${rawQs.length} questions! Review/edit below and confirm insertion.`);
            }
        } catch (err: any) {
            setStatusStep('ERROR');
            setStatusMsg(err.response?.data?.error || err.message || 'Failed to extract PDF content.');
        }
    };

    const handleSaveExtracted = async () => {
        if (editableQuestions.length === 0) return;

        setStatusStep('SAVING');
        setStatusMsg('Saving questions to database...');

        try {
            const payload = {
                questions: editableQuestions,
                source: form.source,
                attempt: form.attempt,
                year: form.year,
                subject_id: form.subject_id || null,
                icai_topic_id: form.icai_topic_id || icaiTopicId || null,
                pdf_url: extractedData?.file_url || null
            };

            const res = await api.post('/materials/questions/bulk-save/', payload);
            setStatusStep('DONE');
            setStatusMsg(`Successfully saved ${res.data.saved_count} questions to Question Bank!`);
            queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
            queryClient.invalidateQueries({ queryKey: ['master-tree'] });
            if (onUploaded) onUploaded();
        } catch (err: any) {
            setStatusStep('ERROR');
            setStatusMsg(err.response?.data?.error || 'Failed to bulk save questions.');
        }
    };

    const handleAddManualQuestionRow = () => {
        const newQ = {
            q_no: String(editableQuestions.length + 1),
            section: 'A',
            question_text: 'Enter question content here...',
            correct_answer: 'Enter answer key or solution...',
            marks: 5,
            question_type: 'NORMAL',
            sub_questions: []
        };
        setEditableQuestions([...editableQuestions, newQ]);
    };

    const handleUpdateQuestionField = (idx: number, field: string, value: any) => {
        const updated = [...editableQuestions];
        updated[idx] = { ...updated[idx], [field]: value };
        setEditableQuestions(updated);
    };

    const resetModal = () => {
        setQuestionFile(null);
        setAnswerFile(null);
        setExtractedData(null);
        setEditableQuestions([]);
        setStatusStep('IDLE');
        setStatusMsg('');
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900">
                                PDF Question & Answer Multi-Extractor
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Upload Question PDF + Answer PDF → Auto-separate questions, sub-parts (a,b,c), tables & solutions
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Mode Selector */}
                    {statusStep === 'IDLE' && (
                        <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl max-w-md">
                            <button
                                onClick={() => setUploadMode('DUAL')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${uploadMode === 'DUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
                            >
                                📄📄 Separate Question PDF + Answer PDF
                            </button>
                            <button
                                onClick={() => setUploadMode('SINGLE')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${uploadMode === 'SINGLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
                            >
                                📄 Single Combined PDF
                            </button>
                        </div>
                    )}

                    {/* Dropzones */}
                    {statusStep === 'IDLE' && (
                        <div className={`grid gap-4 ${uploadMode === 'DUAL' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {/* Question PDF */}
                            <div
                                onClick={() => questionFileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${questionFile ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/20'}`}
                            >
                                <input
                                    ref={questionFileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={e => e.target.files?.[0] && setQuestionFile(e.target.files[0])}
                                />
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                    <Upload size={22} />
                                </div>
                                <h3 className="font-bold text-sm text-slate-800">
                                    {questionFile ? questionFile.name : (uploadMode === 'DUAL' ? '1. Upload Question Paper PDF' : 'Upload Combined Question & Answer PDF')}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {questionFile ? `${(questionFile.size / (1024 * 1024)).toFixed(2)} MB · Click to change` : 'Contains main questions, sub-questions (a,b,c) & tables'}
                                </p>
                            </div>

                            {/* Answer PDF (Optional in DUAL mode) */}
                            {uploadMode === 'DUAL' && (
                                <div
                                    onClick={() => answerFileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${answerFile ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/20'}`}
                                >
                                    <input
                                        ref={answerFileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={e => e.target.files?.[0] && setAnswerFile(e.target.files[0])}
                                    />
                                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                        <FileText size={22} />
                                    </div>
                                    <h3 className="font-bold text-sm text-slate-800">
                                        {answerFile ? answerFile.name : '2. Upload Suggested Answer PDF (Optional)'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {answerFile ? `${(answerFile.size / (1024 * 1024)).toFixed(2)} MB · Click to change` : 'Matches solutions & answer keys automatically with questions'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metadata Controls */}
                    {statusStep === 'IDLE' && (
                        <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Source / Test Series</label>
                                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white">
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Exam Cycle</label>
                                <select value={form.attempt} onChange={e => setForm({ ...form, attempt: e.target.value })} className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white">
                                    {ATTEMPTS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Year</label>
                                <select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white">
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Target Subject</label>
                                <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white">
                                    <option value="">Auto-Detect / Select Subject...</option>
                                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Progress / Status banner */}
                    {statusStep !== 'IDLE' && (
                        <div className={`p-4 rounded-xl border flex items-center gap-3 ${statusStep === 'ERROR' ? 'bg-red-50 border-red-200 text-red-700' : (statusStep === 'DONE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700')}`}>
                            {['EXTRACTING', 'SAVING'].includes(statusStep) && <Loader2 className="animate-spin" size={20} />}
                            {statusStep === 'DONE' && <CheckCircle2 size={20} />}
                            {statusStep === 'ERROR' && <AlertCircle size={20} />}
                            <div className="flex-1 font-bold text-xs">{statusMsg}</div>
                        </div>
                    )}

                    {/* Interactive Text & Question Review Table */}
                    {['REVIEW', 'DONE'].includes(statusStep) && editableQuestions.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Extracted Question & Answer Review Sheet ({editableQuestions.length})
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Review, edit text, copy/paste, or add manual columns before database confirmation
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsTextPanelMinimized(!isTextPanelMinimized)}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-indigo-200"
                                    >
                                        {isTextPanelMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                        <span>{isTextPanelMinimized ? 'Expand Text Panel' : 'Minimize Text Panel'}</span>
                                    </button>
                                    <button onClick={handleAddManualQuestionRow} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                        <Plus size={14} /> Add Question Row
                                    </button>
                                    <button onClick={handleSaveExtracted} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-emerald-700">
                                        <Save size={14} /> Confirm & Save All
                                    </button>
                                </div>
                            </div>

                            <div className={`border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ${isTextPanelMinimized ? 'max-h-[140px] shadow-inner bg-slate-50' : 'max-h-[45vh]'}`}>
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 sticky top-0 font-bold text-slate-700">
                                        <tr>
                                            <th className="p-3 border-b w-16">Q.NO</th>
                                            <th className="p-3 border-b w-16">SEC</th>
                                            <th className="p-3 border-b">QUESTION CONTENT & SUB-PARTS</th>
                                            <th className="p-3 border-b">SOLUTION / ANSWER KEY</th>
                                            <th className="p-3 border-b w-20 text-center">MARKS</th>
                                            <th className="p-3 border-b w-24 text-center">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {editableQuestions.map((q, idx) => {
                                            const subCount = (q.sub_questions || q.parts || []).length;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="p-3 font-bold text-blue-700">
                                                        <input
                                                            value={q.q_no}
                                                            onChange={e => handleUpdateQuestionField(idx, 'q_no', e.target.value)}
                                                            className="w-12 font-bold p-1 border rounded text-center"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            value={q.section || 'A'}
                                                            onChange={e => handleUpdateQuestionField(idx, 'section', e.target.value)}
                                                            className="w-12 p-1 border rounded text-center"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <textarea
                                                            rows={2}
                                                            value={q.question_text}
                                                            onChange={e => handleUpdateQuestionField(idx, 'question_text', e.target.value)}
                                                            className="w-full p-2 border rounded text-xs font-medium focus:border-blue-500"
                                                        />
                                                        {subCount > 0 && (
                                                            <div className="mt-1 flex gap-1">
                                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
                                                                    +{subCount} Sub-parts (a,b,c)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <textarea
                                                            rows={2}
                                                            value={q.correct_answer || ''}
                                                            onChange={e => handleUpdateQuestionField(idx, 'correct_answer', e.target.value)}
                                                            placeholder="Solution or answer key text..."
                                                            className="w-full p-2 border rounded text-xs font-medium text-emerald-800 bg-emerald-50/30 focus:border-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            value={q.marks}
                                                            onChange={e => handleUpdateQuestionField(idx, 'marks', e.target.value)}
                                                            className="w-12 p-1 border rounded text-center font-bold text-blue-700"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center space-y-1">
                                                        {onSelectQuestion && (
                                                            <button
                                                                onClick={() => {
                                                                    onSelectQuestion(q);
                                                                    handleClose();
                                                                }}
                                                                className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded font-bold text-[11px] hover:opacity-90 inline-flex items-center gap-1 shadow-sm w-full justify-center"
                                                                title="Auto-fill form with this question"
                                                            >
                                                                <Sparkles size={11} /> Fill Form
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setPreviewQuestion(q)}
                                                            className="px-2 py-1 bg-blue-50 text-blue-600 rounded font-bold text-[11px] hover:bg-blue-100 inline-flex items-center gap-1 w-full justify-center"
                                                        >
                                                            <Eye size={12} /> Preview
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <button onClick={handleClose} className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100">
                        Close
                    </button>
                    {statusStep === 'IDLE' && (
                        <button
                            onClick={handleExtract}
                            disabled={!questionFile && !answerFile}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 shadow-md"
                        >
                            <Sparkles size={16} /> Upload & Extract Questions/Answers
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-question & Details Preview Modal */}
            {previewQuestion && (
                <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-base text-slate-900">Q{previewQuestion.q_no} - Full Structured View</h3>
                            <div className="flex items-center gap-2">
                                {onSelectQuestion && (
                                    <button
                                        onClick={() => {
                                            onSelectQuestion(previewQuestion);
                                            setPreviewQuestion(null);
                                            handleClose();
                                        }}
                                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Sparkles size={13} /> Auto-Fill into Form
                                    </button>
                                )}
                                <button onClick={() => setPreviewQuestion(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-800">{previewQuestion.question_text}</div>
                        {previewQuestion.correct_answer && (
                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-800 text-xs">
                                <strong>Solution Key:</strong> {previewQuestion.correct_answer}
                            </div>
                        )}
                        {(previewQuestion.sub_questions || previewQuestion.parts || []).map((sq: any, sIdx: number) => (
                            <div key={sIdx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                                <div className="font-bold text-purple-700">Part ({sq.identifier}): {sq.question_text}</div>
                                {sq.correct_answer && <div className="text-emerald-700"><strong>Ans:</strong> {sq.correct_answer}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
