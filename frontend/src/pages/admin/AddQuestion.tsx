import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ICAICascadeSelector, { type ICAISelection } from '@/components/admin/ICAICascadeSelector';
import {
    Loader2, Upload, Star, FileText, Zap, Plus, Trash2, ArrowUp, ArrowDown,
    HelpCircle, CheckSquare, MessageSquare, Clipboard
} from 'lucide-react';
import '@/styles/admin/AddQuestion.css';

// ─── Constants ────────────────────────────────────────────────────
const SOURCES = [
    'MTP-01', 'MTP-02', 'RTP', 'Suggested Answers',
    'Model Test Paper 1', 'Model Test Paper 2', 'Model Test Paper 3', 'Model Test Paper 4',
    'Model Test Paper 5', 'Model Test Paper 6', 'Model Test Paper 7', 'Model Test Paper 8', 'Other'
];
const ATTEMPTS = ['JAN', 'MAY', 'SEP', 'NOV'];
const YEARS = ['2022', '2023', '2024', '2025'];
const DIFFICULTIES = [
    { value: 'EASY', label: 'Easy' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HARD', label: 'Hard' },
];

// ─── Table Builder Component ──────────────────────────────────────
interface TableStructure {
    headers: string[];
    rows: string[][];
}

const TableBuilder = ({
    value,
    onChange,
    label
}: {
    value: string;
    onChange: (val: string) => void;
    label: string;
}) => {
    const [table, setTable] = useState<TableStructure>(() => {
        try {
            if (value) {
                const parsed = JSON.parse(value);
                if (parsed.headers && parsed.rows) return parsed;
            }
        } catch (e) { }
        return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    });

    useEffect(() => {
        try {
            if (value) {
                const parsed = JSON.parse(value);
                if (parsed.headers && parsed.rows) {
                    if (JSON.stringify(parsed) !== JSON.stringify(table)) {
                        setTable(parsed);
                    }
                }
            }
        } catch (e) { }
    }, [value]);

    const updateTable = (newTable: TableStructure) => {
        setTable(newTable);
        onChange(JSON.stringify(newTable));
    };

    const addColumn = () => {
        const newHeaders = [...table.headers, `Column ${table.headers.length + 1}`];
        const newRows = table.rows.map(row => [...row, '']);
        updateTable({ headers: newHeaders, rows: newRows });
    };

    const removeColumn = (colIdx: number) => {
        if (table.headers.length <= 1) return;
        const newHeaders = table.headers.filter((_, idx) => idx !== colIdx);
        const newRows = table.rows.map(row => row.filter((_, idx) => idx !== colIdx));
        updateTable({ headers: newHeaders, rows: newRows });
    };

    const addRow = () => {
        const newRows = [...table.rows, Array(table.headers.length).fill('')];
        updateTable({ ...table, rows: newRows });
    };

    const removeRow = (rowIdx: number) => {
        if (table.rows.length <= 1) return;
        const newRows = table.rows.filter((_, idx) => idx !== rowIdx);
        updateTable({ ...table, rows: newRows });
    };

    const handleHeaderChange = (text: string, colIdx: number) => {
        const newHeaders = [...table.headers];
        newHeaders[colIdx] = text;
        updateTable({ ...table, headers: newHeaders });
    };

    const handleCellChange = (text: string, rowIdx: number, colIdx: number) => {
        const newRows = table.rows.map((row, rIdx) =>
            row.map((cell, cIdx) => (rIdx === rowIdx && cIdx === colIdx ? text : cell))
        );
        updateTable({ ...table, rows: newRows });
    };

    return (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4 my-2">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</span>
                <div className="flex gap-2">
                    <button type="button" onClick={addColumn} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-50">+ Column</button>
                    <button type="button" onClick={addRow} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-50">+ Row</button>
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                            {table.headers.map((h, colIdx) => (
                                <th key={colIdx} className="p-2.5 border-r border-slate-200 min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/20 text-xs font-bold text-slate-800"
                                            value={h}
                                            onChange={e => handleHeaderChange(e.target.value, colIdx)}
                                        />
                                        <button type="button" onClick={() => removeColumn(colIdx)} className="text-red-500 hover:text-red-700" title="Delete Column">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-slate-100 last:border-none">
                                {row.map((cell, colIdx) => (
                                    <td key={colIdx} className="p-2.5 border-r border-slate-200">
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-primary/20 text-xs text-slate-600 font-semibold"
                                            value={cell}
                                            onChange={e => handleCellChange(e.target.value, rowIdx, colIdx)}
                                        />
                                    </td>
                                ))}
                                <td className="p-2 text-center w-10">
                                    <button type="button" onClick={() => removeRow(rowIdx)} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default function AddQuestion() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    // Table builders visibility states
    const [showQTable, setShowQTable] = useState(false);
    const [showATable, setShowATable] = useState(false);

    const [icai, setIcai] = useState<ICAISelection>({
        levelId: '',
        paperId: '',
        chapterId: searchParams.get('chapter') || '',
        topicId: searchParams.get('topic') || '',
    });

    const [form, setForm] = useState({
        subject: '',
        topic: '',
        sub_topic: '',
        icai_topic: '',
        source: 'MTP-01',
        attempt: 'MAY',
        year: '2024',
        section: '',
        q_no: '',
        question_type: 'NORMAL',
        marks: '',
        difficulty: 'MEDIUM',
        status: 'ACTIVE',
        is_important: false,
        question_text: '',
        correct_answer: '',
        table_data: '',
        answer_table_data: '',
        tags: '',
        pdf_url: '',
    });

    // Options for top-level MCQ
    const [options, setOptions] = useState<Array<{ text: string, is_correct: boolean, order: number }>>([]);

    // Decoupled Lists for sub-questions and sub-answers
    const [subQuestions, setSubQuestions] = useState<Array<{
        identifier: string;
        question_text: string;
        question_type: 'NORMAL' | 'MCQ';
        marks: number;
        table_data: string;
        options: Array<{ text: string, is_correct: boolean, order: number }>;
    }>>([]);

    const [subAnswers, setSubAnswers] = useState<Array<{
        identifier: string;
        correct_answer: string;
        answer_table_data: string;
    }>>([]);

    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Fetch existing question
    const { data: existingQuestion, isLoading: isQuestionLoading } = useQuery({
        queryKey: ['question-detail', id],
        queryFn: async () => (await api.get(`/materials/subjective-questions/${id}/`)).data,
        enabled: isEdit,
    });

    // Load existing question data
    useEffect(() => {
        if (existingQuestion) {
            setForm({
                subject: existingQuestion.subject || '',
                topic: existingQuestion.topic || '',
                sub_topic: existingQuestion.sub_topic || '',
                icai_topic: String(existingQuestion.icai_topic || ''),
                source: existingQuestion.source || 'MTP-01',
                attempt: existingQuestion.attempt || 'MAY',
                year: existingQuestion.year || '2024',
                section: existingQuestion.section || '',
                q_no: existingQuestion.q_no || '',
                question_type: existingQuestion.question_type || 'NORMAL',
                marks: String(existingQuestion.marks || ''),
                difficulty: existingQuestion.difficulty || 'MEDIUM',
                status: existingQuestion.status || 'ACTIVE',
                is_important: existingQuestion.is_important || false,
                question_text: existingQuestion.question_text || '',
                correct_answer: existingQuestion.correct_answer || '',
                table_data: existingQuestion.table_data || '',
                answer_table_data: existingQuestion.answer_table_data || '',
                tags: existingQuestion.tags || '',
                pdf_url: existingQuestion.pdf_url || '',
            });
            setOptions(existingQuestion.options || []);

            const loadedParts = existingQuestion.parts || [];

            // Map into independent states
            setSubQuestions(loadedParts.map((p: any) => ({
                identifier: p.identifier,
                question_text: p.question_text || '',
                question_type: p.question_type || 'NORMAL',
                marks: p.marks || 1,
                table_data: p.table_data || '',
                options: p.options || [],
            })));

            setSubAnswers(loadedParts.map((p: any) => ({
                identifier: p.identifier,
                correct_answer: p.correct_answer || '',
                answer_table_data: p.answer_table_data || '',
            })));

            setShowQTable(!!existingQuestion.table_data);
            setShowATable(!!existingQuestion.answer_table_data);
            setIcai({
                levelId: existingQuestion.icai_level_id || '',
                paperId: existingQuestion.icai_paper_id || '',
                chapterId: existingQuestion.icai_chapter_id || '',
                topicId: String(existingQuestion.icai_topic || ''),
            });
        }
    }, [existingQuestion]);

    const { data: topicDetail } = useQuery({
        queryKey: ['icai-topic-detail', icai.topicId],
        queryFn: async () => (await api.get(`/master/topics/${icai.topicId}/`)).data,
        enabled: !!icai.topicId,
    });

    useEffect(() => {
        if (topicDetail?.level_id && !icai.levelId) {
            setIcai({
                levelId: String(topicDetail.level_id),
                paperId: String(topicDetail.paper_id),
                chapterId: String(topicDetail.chapter_id),
                topicId: String(topicDetail.id),
            });
        }
    }, [topicDetail, icai.levelId]);

    useEffect(() => {
        if (icai.topicId) {
            setForm(prev => ({ ...prev, icai_topic: icai.topicId }));
        }
    }, [icai.topicId]);

    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (isEdit) {
                return await api.put(`/materials/subjective-questions/${id}/`, payload);
            } else {
                return await api.post('/materials/subjective-questions/', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
            navigate('/admin/questions');
        },
    });

    const handlePdfUpload = async (file: File) => {
        setUploading(true);
        const fd = new FormData();
        fd.append('pdf_file', file);
        try {
            const res = await api.post('/materials/upload-pdf/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setForm(prev => ({ ...prev, pdf_url: res.data.url || '' }));
        } catch {
            setForm(prev => ({ ...prev, pdf_url: URL.createObjectURL(file) }));
        }
        setUploading(false);
    };

    const handleSave = (saveStatus?: string) => {
        if (!icai.topicId) {
            alert('Please select CA Level, Paper, Chapter, and Topic.');
            return;
        }
        if (!form.q_no) {
            alert('Please enter Question Number.');
            return;
        }

        // Merge subQuestions and subAnswers lists index-by-index
        const maxLength = Math.max(subQuestions.length, subAnswers.length);
        const mergedParts = Array.from({ length: maxLength }).map((_, idx) => {
            const q = subQuestions[idx] || {
                identifier: `(${String.fromCharCode(97 + idx)})`,
                question_text: '',
                question_type: 'NORMAL',
                marks: 1,
                table_data: '',
                options: []
            };
            const a = subAnswers[idx] || {
                identifier: q.identifier,
                correct_answer: '',
                answer_table_data: ''
            };
            return {
                identifier: q.identifier || a.identifier,
                question_text: q.question_text,
                question_type: q.question_type,
                marks: parseInt(q.marks.toString(), 10) || 1,
                table_data: q.table_data,
                correct_answer: a.correct_answer,
                answer_table_data: a.answer_table_data,
                options: q.question_type === 'MCQ' ? q.options : [],
            };
        });

        const payload = {
            ...form,
            icai_topic: parseInt(icai.topicId, 10),
            subject: form.subject || null,
            topic: form.topic || null,
            marks: form.marks ? parseInt(form.marks.toString(), 10) : 1,
            status: saveStatus || form.status,
            table_data: showQTable ? form.table_data : '',
            answer_table_data: showATable ? form.answer_table_data : '',
            options: form.question_type === 'MCQ' ? options : [],
            parts: mergedParts,
        };

        saveMutation.mutate(payload);
    };

    const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

    // ─── Option Helpers ──────────────────────────────────────────────
    const addOption = () => {
        setOptions(prev => [...prev, { text: '', is_correct: false, order: prev.length }]);
    };

    const removeOption = (idx: number) => {
        setOptions(prev => prev.filter((_, i) => i !== idx).map((opt, i) => ({ ...opt, order: i })));
    };

    const updateOptionText = (text: string, idx: number) => {
        setOptions(prev => prev.map((opt, i) => i === idx ? { ...opt, text } : opt));
    };

    const setOptionCorrect = (idx: number) => {
        setOptions(prev => prev.map((opt, i) => ({ ...opt, is_correct: i === idx })));
    };

    const moveOption = (idx: number, direction: 'up' | 'down') => {
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= options.length) return;
        const newOptions = [...options];
        const temp = newOptions[idx];
        newOptions[idx] = newOptions[targetIdx];
        newOptions[targetIdx] = temp;
        setOptions(newOptions.map((opt, i) => ({ ...opt, order: i })));
    };

    // ─── Sub-Question Helpers ────────────────────────────────────────
    const addSubQuestion = () => {
        setSubQuestions(prev => [...prev, {
            identifier: `(${String.fromCharCode(97 + prev.length)})`,
            question_text: '',
            question_type: 'NORMAL',
            marks: 1,
            table_data: '',
            options: [],
        }]);
    };

    const removeSubQuestion = (idx: number) => {
        setSubQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const updateSubQuestion = (idx: number, field: string, val: any) => {
        setSubQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
    };

    const addSubQuestionOption = (qIdx: number) => {
        setSubQuestions(prev => prev.map((q, i) => {
            if (i === qIdx) {
                return {
                    ...q,
                    options: [...q.options, { text: '', is_correct: false, order: q.options.length }]
                };
            }
            return q;
        }));
    };

    const removeSubQuestionOption = (qIdx: number, optIdx: number) => {
        setSubQuestions(prev => prev.map((q, i) => {
            if (i === qIdx) {
                return {
                    ...q,
                    options: q.options.filter((_, oi) => oi !== optIdx).map((o, oi) => ({ ...o, order: oi }))
                };
            }
            return q;
        }));
    };

    const updateSubQuestionOptionText = (text: string, qIdx: number, optIdx: number) => {
        setSubQuestions(prev => prev.map((q, i) => {
            if (i === qIdx) {
                return {
                    ...q,
                    options: q.options.map((o, oi) => oi === optIdx ? { ...o, text } : o)
                };
            }
            return q;
        }));
    };

    const setSubQuestionOptionCorrect = (qIdx: number, optIdx: number) => {
        setSubQuestions(prev => prev.map((q, i) => {
            if (i === qIdx) {
                return {
                    ...q,
                    options: q.options.map((o, oi) => ({ ...o, is_correct: oi === optIdx }))
                };
            }
            return q;
        }));
    };

    // ─── Sub-Answer Helpers ──────────────────────────────────────────
    const addSubAnswer = () => {
        setSubAnswers(prev => [...prev, {
            identifier: `(${String.fromCharCode(97 + prev.length)})`,
            correct_answer: '',
            answer_table_data: '',
        }]);
    };

    const removeSubAnswer = (idx: number) => {
        setSubAnswers(prev => prev.filter((_, i) => i !== idx));
    };

    const updateSubAnswer = (idx: number, field: string, val: any) => {
        setSubAnswers(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
    };

    if (isEdit && isQuestionLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 size={40} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="add-q-container px-6 py-6 max-w-5xl mx-auto space-y-6">

            {/* Unified Top Header Bar */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {isEdit ? `Edit Question #${id}` : 'Add New Question'}
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">Define metadata, question parameters, options, suggested solutions, and dynamic tables on a single page.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 bg-white font-semibold text-sm hover:bg-slate-50" onClick={() => navigate('/admin/questions')}>
                        Cancel
                    </button>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2" onClick={() => handleSave('PUBLISHED')} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                        <span>{isEdit ? 'Save Changes' : 'Publish Question'}</span>
                    </button>
                </div>
            </div>

            {/* Single-Page Layout */}
            <div className="form-grid">

                {/* Main Content Workspace (Left Side) */}
                <div className="form-main space-y-6">

                    {/* Section 0: Question Layout & Formats */}
                    <div className="form-card space-y-4">
                        <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
                            <HelpCircle size={16} /> Question Layout & Formats
                        </h2>

                        <div className="settings-grid">
                            <div className="form-group span-3">
                                <label className="text-xs font-bold text-slate-500">Question Format</label>
                                <select className="form-input mt-1 w-full" value={form.question_type} onChange={e => set('question_type', e.target.value)}>
                                    <option value="NORMAL">Normal / Theory</option>
                                    <option value="MCQ">MCQ</option>
                                </select>
                            </div>
                            <div className="form-group span-2">
                                <label className="text-xs font-bold text-slate-500">Question Marks</label>
                                <input type="number" className="form-input mt-1 w-full" placeholder="e.g. 5" value={form.marks} onChange={e => set('marks', e.target.value)} />
                            </div>
                            <div className="form-group span-3">
                                <label className="text-xs font-bold text-slate-500">Metadata Source</label>
                                <select className="form-input mt-1 w-full" value={form.source} onChange={e => set('source', e.target.value)}>
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group span-4">
                                <label className="text-xs font-bold text-slate-500">Attempt</label>
                                <div className="tabs-group mt-1">
                                    {ATTEMPTS.map(a => (
                                        <div key={a}
                                            className={`tab-item ${form.attempt === a ? 'active' : ''}`}
                                            onClick={() => set('attempt', a)}>
                                            {a}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="settings-grid">
                            <div className="form-group span-2">
                                <label className="text-xs font-bold text-slate-500">Year</label>
                                <select className="form-input mt-1 w-full" value={form.year} onChange={e => set('year', e.target.value)}>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="form-group span-2">
                                <label className="text-xs font-bold text-slate-500">Sec & No</label>
                                <div className="flex gap-1 mt-1">
                                    <input className="form-input w-1/2" placeholder="Sec" value={form.section} onChange={e => set('section', e.target.value)} />
                                    <input className="form-input w-1/2" placeholder="QNo" value={form.q_no} onChange={e => set('q_no', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group span-4">
                                <label className="text-xs font-bold text-slate-500">Difficulty</label>
                                <div className="diff-pills mt-1">
                                    {DIFFICULTIES.map(d => (
                                        <div key={d.value}
                                            className={`diff-pill ${form.difficulty === d.value ? 'active' : ''}`}
                                            onClick={() => set('difficulty', d.value)}>
                                            {d.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group span-4">
                                <label className="text-xs font-bold text-slate-500">Tags</label>
                                <input className="form-input mt-1 w-full" placeholder="e.g. AS-15, Inventory" value={form.tags} onChange={e => set('tags', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Question Card (with sub-questions relocated inside) */}
                    <div className="form-card space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                <Clipboard size={16} /> Question Text Box
                            </h2>
                        </div>

                        <textarea
                            className="w-full min-h-[140px] p-4 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold text-slate-700"
                            placeholder="Type your primary question here..."
                            value={form.question_text}
                            onChange={e => set('question_text', e.target.value)}
                        />

                        {/* Question Action Bar: Add Table & Add Sub-Question side-by-side */}
                        <div className="flex gap-2.5 pb-2">
                            <button
                                type="button"
                                onClick={() => setShowQTable(!showQTable)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${showQTable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                            >
                                {showQTable ? '[-] Remove Table' : '[+] Add Table'}
                            </button>
                            <button
                                type="button"
                                onClick={addSubQuestion}
                                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1"
                            >
                                <Plus size={13} /> Add Sub-Question
                            </button>
                        </div>

                        {/* Inline Question Table Builder */}
                        {showQTable && (
                            <TableBuilder
                                label="Question Tabular Data"
                                value={form.table_data}
                                onChange={val => set('table_data', val)}
                            />
                        )}

                        {/* MCQ Options Creator (If top-level MCQ is chosen) */}
                        {form.question_type === 'MCQ' && (
                            <div className="border-t border-slate-100 pt-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><CheckSquare size={14} /> Option Sequence Builder</h3>
                                    <button type="button" onClick={addOption} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded text-xs font-semibold hover:bg-blue-100">+ Add Choice</button>
                                </div>

                                {options.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                        <p className="text-xs font-bold text-slate-400">No option choices created yet. Click 'Add Choice'.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {options.map((opt, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50">
                                                <span className="w-6 h-6 flex items-center justify-center bg-slate-200 rounded-full text-xs font-black text-slate-600">
                                                    {String.fromCharCode(65 + idx)}
                                                </span>
                                                <input
                                                    type="text"
                                                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                                                    placeholder="Option Text..."
                                                    value={opt.text}
                                                    onChange={e => updateOptionText(e.target.value, idx)}
                                                />
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="top-level-mcq"
                                                        checked={opt.is_correct}
                                                        onChange={() => setOptionCorrect(idx)}
                                                        className="w-3.5 h-3.5"
                                                    />
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${opt.is_correct ? 'text-green-600' : 'text-slate-400'}`}>Correct</span>
                                                </label>
                                                <div className="flex gap-0.5">
                                                    <button type="button" onClick={() => moveOption(idx, 'up')} disabled={idx === 0} className="text-slate-400 disabled:opacity-30"><ArrowUp size={14} /></button>
                                                    <button type="button" onClick={() => moveOption(idx, 'down')} disabled={idx === options.length - 1} className="text-slate-400 disabled:opacity-30"><ArrowDown size={14} /></button>
                                                </div>
                                                <button type="button" onClick={() => removeOption(idx)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Inline relocated Sub-Question Parts list */}
                        {subQuestions.length > 0 && (
                            <div className="border-t border-slate-100 pt-4 space-y-6">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Sub-Question Configurator</h3>
                                <div className="space-y-4">
                                    {subQuestions.map((part, pIdx) => {
                                        const hasPartQTable = !!part.table_data;
                                        return (
                                            <div key={pIdx} className="p-4 border border-slate-200/60 bg-white rounded-xl relative space-y-3.5">
                                                <button type="button" onClick={() => removeSubQuestion(pIdx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700" title="Delete Part">
                                                    <Trash2 size={15} />
                                                </button>

                                                <div className="flex gap-2 items-center">
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">Sub-question {pIdx + 1}</span>
                                                    <input
                                                        type="text"
                                                        placeholder="ID (e.g. (a))"
                                                        className="px-2 py-0.5 border border-slate-200 rounded text-xs w-16"
                                                        value={part.identifier}
                                                        onChange={e => updateSubQuestion(pIdx, 'identifier', e.target.value)}
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Marks"
                                                        className="px-2 py-0.5 border border-slate-200 rounded text-xs w-16"
                                                        value={part.marks}
                                                        onChange={e => updateSubQuestion(pIdx, 'marks', e.target.value)}
                                                    />
                                                    <select
                                                        className="px-2 py-0.5 border border-slate-200 rounded text-xs"
                                                        value={part.question_type}
                                                        onChange={e => updateSubQuestion(pIdx, 'question_type', e.target.value)}
                                                    >
                                                        <option value="NORMAL">Theory</option>
                                                        <option value="MCQ">MCQ</option>
                                                    </select>
                                                </div>

                                                <textarea
                                                    placeholder="Sub-question text content..."
                                                    className="w-full min-h-[70px] p-2.5 border border-slate-200 rounded text-xs bg-slate-50/50"
                                                    value={part.question_text}
                                                    onChange={e => updateSubQuestion(pIdx, 'question_text', e.target.value)}
                                                />

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSubQuestion(pIdx, 'table_data', hasPartQTable ? '' : JSON.stringify({ headers: ['Column 1'], rows: [['']] }))}
                                                        className={`px-2.5 py-1 rounded border text-[10px] font-bold transition-all ${hasPartQTable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                                    >
                                                        {hasPartQTable ? '[-] Remove Table' : '[+] Add Table'}
                                                    </button>
                                                    {part.question_type === 'MCQ' && (
                                                        <button type="button" onClick={() => addSubQuestionOption(pIdx)} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[10px] font-bold hover:bg-indigo-100 transition-all">+ Add Choice</button>
                                                    )}
                                                </div>

                                                {hasPartQTable && (
                                                    <TableBuilder
                                                        label={`Sub-question ${part.identifier} Question Table`}
                                                        value={part.table_data}
                                                        onChange={val => updateSubQuestion(pIdx, 'table_data', val)}
                                                    />
                                                )}

                                                {part.question_type === 'MCQ' && (
                                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                                        {part.options.map((pOpt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-400 w-4">{String.fromCharCode(65 + oIdx)}.</span>
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 px-2.5 py-1 border border-slate-200 rounded text-xs"
                                                                    placeholder="Choice text..."
                                                                    value={pOpt.text}
                                                                    onChange={e => updateSubQuestionOptionText(e.target.value, pIdx, oIdx)}
                                                                />
                                                                <label className="flex items-center gap-1 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`part-${pIdx}-radio`}
                                                                        checked={pOpt.is_correct}
                                                                        onChange={() => setSubQuestionOptionCorrect(pIdx, oIdx)}
                                                                        className="w-3.5 h-3.5"
                                                                    />
                                                                    <span className="text-[10px] font-semibold text-slate-500">Correct</span>
                                                                </label>
                                                                <button type="button" onClick={() => removeSubQuestionOption(pIdx, oIdx)} className="text-red-500"><Trash2 size={12} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Suggested Answer Card (with sub-answers relocated inside) */}
                    <div className="form-card space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                <MessageSquare size={16} /> Suggested Answer Box
                            </h2>
                        </div>

                        <textarea
                            className="w-full min-h-[160px] p-4 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono text-slate-700"
                            placeholder="Type suggested solutions / calculations..."
                            value={form.correct_answer}
                            onChange={e => set('correct_answer', e.target.value)}
                        />

                        {/* Answer Action Bar: Add Table & Add Sub-Answer side-by-side */}
                        <div className="flex gap-2.5 pb-2">
                            <button
                                type="button"
                                onClick={() => setShowATable(!showATable)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${showATable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                            >
                                {showATable ? '[-] Remove Table' : '[+] Add Table'}
                            </button>
                            <button
                                type="button"
                                onClick={addSubAnswer}
                                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1"
                            >
                                <Plus size={13} /> Add Sub-Answer
                            </button>
                        </div>

                        {/* Inline Answer Table Builder */}
                        {showATable && (
                            <TableBuilder
                                label="Answer Details Table"
                                value={form.answer_table_data}
                                onChange={val => set('answer_table_data', val)}
                            />
                        )}

                        {/* Inline relocated Sub-Answer Parts list */}
                        {subAnswers.length > 0 && (
                            <div className="border-t border-slate-100 pt-4 space-y-6">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Sub-Answer Solutions</h3>
                                <div className="space-y-4">
                                    {subAnswers.map((part, pIdx) => {
                                        const hasPartATable = !!part.answer_table_data;
                                        return (
                                            <div key={pIdx} className="p-4 border border-slate-200/60 bg-white rounded-xl relative space-y-3.5">
                                                <button type="button" onClick={() => removeSubAnswer(pIdx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700" title="Delete Answer Part">
                                                    <Trash2 size={15} />
                                                </button>

                                                <div className="flex justify-between items-center">
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded">
                                                        Sub-answer for Part {part.identifier || `${pIdx + 1}`}
                                                    </span>
                                                </div>

                                                <textarea
                                                    placeholder="Sub-question correct answer/suggested solution..."
                                                    className="w-full min-h-[80px] p-2.5 border border-slate-200 rounded text-xs bg-slate-50/50 font-mono"
                                                    value={part.correct_answer || ''}
                                                    onChange={e => updateSubAnswer(pIdx, 'correct_answer', e.target.value)}
                                                />

                                                {/* Sub-answer Action Bar */}
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSubAnswer(pIdx, 'answer_table_data', hasPartATable ? '' : JSON.stringify({ headers: ['Column 1'], rows: [['']] }))}
                                                        className={`px-2.5 py-1 rounded border text-[10px] font-bold transition-all ${hasPartATable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                                    >
                                                        {hasPartATable ? '[-] Remove Table' : '[+] Add Table'}
                                                    </button>
                                                </div>

                                                {hasPartATable && (
                                                    <TableBuilder
                                                        label={`Sub-answer ${part.identifier} Solution Table`}
                                                        value={part.answer_table_data}
                                                        onChange={val => updateSubAnswer(pIdx, 'answer_table_data', val)}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (Right Side) */}
                <div className="form-sidebar">
                    <div className="form-card">
                        <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                            <Star size={16} /> ICAI Master
                        </h2>
                        <ICAICascadeSelector value={icai} onChange={setIcai} compact />
                        {topicDetail?.full_path && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
                                {topicDetail.full_path}
                            </p>
                        )}
                    </div>



                    <div className="sidebar-buttons space-y-3">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '0.5rem' }}>
                            <input type="checkbox" checked={form.is_important} onChange={e => set('is_important', e.target.checked)} />
                            <Star size={18} style={{ color: form.is_important ? '#f59e0b' : '#94a3b8' }} />
                            <span style={{ fontWeight: 700, color: form.is_important ? '#f59e0b' : '#64748b', fontSize: '0.85rem' }}>Mark Important</span>
                        </label>

                        {/* PDF / Image Attachment */}
                        <div className="drop-zone py-4" onClick={() => fileRef.current?.click()}>
                            <div className="drop-icon-box">
                                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            </div>
                            <p className="text-[10px] font-bold text-slate-600 mt-2">
                                {uploading ? 'Uploading...' : 'Drop or browse PDF / images'}
                            </p>
                            {form.pdf_url && (
                                <p className="text-[9px] text-green-600 font-bold truncate max-w-full px-2 mt-1">
                                    {form.pdf_url.substring(form.pdf_url.lastIndexOf('/') + 1)}
                                </p>
                            )}
                            <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handlePdfUpload(f);
                            }} />
                        </div>

                        <button className="secondary-btn w-full" onClick={() => handleSave('DRAFT')}>
                            Save as Draft
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
