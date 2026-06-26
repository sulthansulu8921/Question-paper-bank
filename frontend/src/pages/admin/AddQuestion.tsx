import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ICAICascadeSelector, { type ICAISelection } from '@/components/admin/ICAICascadeSelector';
import {
    Loader2, Upload, Star, FileText, Zap, Plus, Trash2,
    HelpCircle, CheckSquare, MessageSquare, Clipboard, X,
    Bold, Underline, AlignCenter
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
    { value: 'NONE', label: 'No Mention' },
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
        return { headers: ['Header 1', 'Header 2'], rows: [['', '']] };
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

    const handleCellChange = (rowIndex: number, colIndex: number, text: string) => {
        const newRows = table.rows.map((r, ri) =>
            ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? text : c)) : r
        );
        updateTable({ ...table, rows: newRows });
    };

    const handleHeaderChange = (colIndex: number, text: string) => {
        const newHeaders = table.headers.map((h, ci) => (ci === colIndex ? text : h));
        updateTable({ ...table, headers: newHeaders });
    };

    const addRow = () => {
        const newRow = Array(table.headers.length).fill('');
        updateTable({ ...table, rows: [...table.rows, newRow] });
    };

    const deleteRow = (rowIndex: number) => {
        if (table.rows.length <= 1) return;
        const newRows = table.rows.filter((_, ri) => ri !== rowIndex);
        updateTable({ ...table, rows: newRows });
    };

    const addColumn = () => {
        const newHeaders = [...table.headers, `Header ${table.headers.length + 1}`];
        const newRows = table.rows.map(r => [...r, '']);
        updateTable({ headers: newHeaders, rows: newRows });
    };

    const deleteColumn = (colIndex: number) => {
        if (table.headers.length <= 1) return;
        const newHeaders = table.headers.filter((_, ci) => ci !== colIndex);
        const newRows = table.rows.map(r => r.filter((_, ci) => ci !== colIndex));
        updateTable({ headers: newHeaders, rows: newRows });
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden my-3">
            <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
            </div>
            <div className="overflow-x-auto p-3">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-200">
                            {table.headers.map((h, ci) => (
                                <th key={ci} className="p-1 border border-slate-300 min-w-[120px] relative group">
                                    <input
                                        className="w-full bg-transparent font-bold border-none p-1 focus:ring-0 focus:bg-white text-slate-800 text-center text-xs"
                                        value={h}
                                        onChange={e => handleHeaderChange(ci, e.target.value)}
                                    />
                                    {table.headers.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => deleteColumn(ci)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                            title="Delete Column"
                                        >
                                            <X size={8} />
                                        </button>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-slate-100">
                                {row.map((cell, ci) => (
                                    <td key={ci} className="p-1 border border-slate-300 min-w-[120px]">
                                        <input
                                            className="w-full bg-transparent border-none p-1 focus:ring-0 focus:bg-white text-slate-700 text-xs"
                                            value={cell}
                                            onChange={e => handleCellChange(ri, ci, e.target.value)}
                                        />
                                    </td>
                                ))}
                                <td className="p-1 border-none min-w-[30px] text-center">
                                    <button
                                        type="button"
                                        onClick={() => deleteRow(ri)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-55 p-1 rounded-lg"
                                        title="Delete Row"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-2 border-t border-slate-200 flex gap-2">
                <button
                    type="button"
                    onClick={addRow}
                    className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold flex items-center gap-0.5"
                >
                    <Plus size={10} /> Add Row
                </button>
                <button
                    type="button"
                    onClick={addColumn}
                    className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold flex items-center gap-0.5"
                >
                    <Plus size={10} /> Add Column
                </button>
            </div>
        </div>
    );
};

// Helper to parse multiple tables or single table safely
const parseTablesHelper = (val: string): any[] => {
    if (!val) return [];
    try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.headers && parsed.rows) {
            return [{ ...parsed, type: parsed.type || 'normal' }];
        }
    } catch (e) {}
    return [];
};

// ─── Multi Table Manager Component ────────────────────────────────
const MultiTableManager = ({
    value,
    onChange,
    label,
    textareaId,
    insertTextAtCursor,
    onUpdateText
}: {
    value: string;
    onChange: (val: string) => void;
    label: string;
    textareaId?: string;
    insertTextAtCursor?: (elementId: string, textToInsert: string, onUpdate: (newVal: string) => void) => void;
    onUpdateText?: (newVal: string) => void;
}) => {
    const [tables, setTables] = useState<any[]>(() => parseTablesHelper(value));

    useEffect(() => {
        const parsed = parseTablesHelper(value);
        if (JSON.stringify(parsed) !== JSON.stringify(tables)) {
            setTables(parsed);
        }
    }, [value]);

    const updateTables = (newTables: any[]) => {
        setTables(newTables);
        onChange(newTables.length > 0 ? JSON.stringify(newTables) : '');
    };

    const addTable = () => {
        const newTable = {
            type: 'normal',
            headers: ['Header 1', 'Header 2'],
            rows: [['', '']]
        };
        updateTables([...tables, newTable]);
    };

    const deleteTable = (index: number) => {
        const newTables = tables.filter((_, i) => i !== index);
        updateTables(newTables);
    };

    const updateTableData = (index: number, tableDataStr: string) => {
        try {
            const parsed = JSON.parse(tableDataStr);
            const newTables = tables.map((t, i) => 
                i === index ? { ...t, headers: parsed.headers, rows: parsed.rows } : t
            );
            updateTables(newTables);
        } catch (e) {}
    };

    const toggleTableType = (index: number, type: 'normal' | 'cursor') => {
        const newTables = tables.map((t, i) => 
            i === index ? { ...t, type } : t
        );
        updateTables(newTables);
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-4 space-y-4">
            <div className="flex justify-between items-center bg-slate-100/80 p-3 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</span>
                <button
                    type="button"
                    onClick={addTable}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                    <Plus size={14} /> Add New Table
                </button>
            </div>

            {tables.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-medium bg-white border border-dashed border-slate-200 rounded-lg">
                    No tables added yet. Click "Add New Table" to start.
                </div>
            )}

            {tables.map((table, index) => {
                const cursorTables = tables.slice(0, index + 1).filter(t => t.type === 'cursor');
                const cursorIndex = cursorTables.length;
                const placeholder = `[TABLE_${cursorIndex}]`;

                return (
                    <div key={index} className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 relative shadow-sm">
                        <button
                            type="button"
                            onClick={() => deleteTable(index)}
                            className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition-colors"
                            title="Delete Table"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="flex flex-wrap items-center gap-3 pr-8">
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                                Table #{index + 1}
                            </span>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">Position Type:</span>
                                <select
                                    value={table.type || 'normal'}
                                    onChange={e => toggleTableType(index, e.target.value as 'normal' | 'cursor')}
                                    className="px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-700"
                                >
                                    <option value="normal">Normal Table (renders at bottom)</option>
                                    <option value="cursor">Cursor Table (renders inline)</option>
                                </select>
                            </div>

                            {table.type === 'cursor' && textareaId && insertTextAtCursor && onUpdateText && (
                                <button
                                    type="button"
                                    onClick={() => insertTextAtCursor(textareaId, ` ${placeholder} `, onUpdateText)}
                                    className="px-3 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                    [+ Insert {placeholder} @ Cursor]
                                </button>
                            )}
                        </div>

                        <TableBuilder
                            label={`Table #${index + 1} content`}
                            value={JSON.stringify({ headers: table.headers, rows: table.rows })}
                            onChange={val => updateTableData(index, val)}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default function AddQuestion() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const insertTextAtCursor = (
        elementId: string,
        textToInsert: string,
        onUpdate: (newVal: string) => void
    ) => {
        const textarea = document.getElementById(elementId) as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const newVal = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
        onUpdate(newVal);

        // Restore focus and cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
        }, 0);
    };

    const insertFormattedTextAtCursor = (
        elementId: string,
        tag: 'B' | 'U' | 'CENTER',
        onUpdate: (newVal: string) => void
    ) => {
        const textarea = document.getElementById(elementId) as HTMLTextAreaElement | HTMLInputElement;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const currentVal = textarea.value;
        const selectedText = currentVal.substring(start, end);
        
        const openTag = `[${tag}]`;
        const closeTag = `[/${tag}]`;
        const textToInsert = openTag + (selectedText || 'text') + closeTag;
        
        const newVal = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
        onUpdate(newVal);

        // Restore focus and select inner text
        setTimeout(() => {
            textarea.focus();
            if (selectedText) {
                textarea.selectionStart = start + openTag.length;
                textarea.selectionEnd = start + openTag.length + selectedText.length;
            } else {
                textarea.selectionStart = start + openTag.length;
                textarea.selectionEnd = start + openTag.length + 4; // Select "text"
            }
        }, 0);
    };

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
        case_scenario_passage: '',
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
                case_scenario_passage: existingQuestion.case_scenario_passage || '',
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
        onError: (err: any) => {
            console.error('Failed to save question:', err);
            const detail = err.response?.data
                ? typeof err.response.data === 'object'
                    ? JSON.stringify(err.response.data, null, 2)
                    : err.response.data
                : err.message;
            alert('Failed to save question:\n' + detail);
        }
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
            alert('Please select Course Level, Paper, Chapter, and Topic.');
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
            case_scenario_passage: form.question_type === 'CASE_SCENARIO' ? form.case_scenario_passage : '',
            parts: mergedParts,
        };

        saveMutation.mutate(payload);
    };

    const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

    // ─── Option Helpers ──────────────────────────────────────────────
    const setOptionCorrect = (idx: number) => {
        setOptions(prev => {
            const next = [...prev];
            while (next.length < 4) next.push({ text: '', is_correct: false, order: next.length });
            return next.map((opt, i) => ({ ...opt, is_correct: i === idx }));
        });
    };

    // ─── Sub-Question Helpers ────────────────────────────────────────
    const addSubQuestion = () => {
        const isCaseScenario = form.question_type === 'CASE_SCENARIO';
        setSubQuestions(prev => [...prev, {
            identifier: `(${String.fromCharCode(97 + prev.length)})`,
            question_text: '',
            question_type: isCaseScenario ? 'MCQ' : 'NORMAL',
            marks: 1,
            table_data: '',
            options: isCaseScenario ? [
                { text: '', is_correct: false, order: 0 },
                { text: '', is_correct: false, order: 1 },
                { text: '', is_correct: false, order: 2 },
                { text: '', is_correct: false, order: 3 },
            ] : [],
        }]);
        // Sync a matching sub-answer entry
        setSubAnswers(prev => [...prev, {
            identifier: `(${String.fromCharCode(97 + prev.length)})`,
            correct_answer: '',
            answer_table_data: '',
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
                // Pad options array to at least optIdx+1 entries for fixed A/B/C/D grid
                const opts = [...q.options];
                while (opts.length <= optIdx) {
                    opts.push({ text: '', is_correct: false, order: opts.length });
                }
                return {
                    ...q,
                    options: opts.map((o, oi) => oi === optIdx ? { ...o, text } : o)
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
                            <div className="form-group span-5">
                                <label className="text-xs font-bold text-slate-500">Question Format</label>
                                <div className="tabs-group mt-1">
                                    <div 
                                        className={`tab-item ${form.question_type === 'NORMAL' ? 'active' : ''}`}
                                        onClick={() => set('question_type', 'NORMAL')}
                                    >
                                        Normal
                                    </div>
                                    <div 
                                        className={`tab-item ${form.question_type === 'MCQ' ? 'active' : ''}`}
                                        onClick={() => {
                                            set('question_type', 'MCQ');
                                            if (options.length === 0) {
                                                setOptions([
                                                    { text: '', is_correct: false, order: 0 },
                                                    { text: '', is_correct: false, order: 1 },
                                                    { text: '', is_correct: false, order: 2 },
                                                    { text: '', is_correct: false, order: 3 },
                                                ]);
                                            }
                                        }}
                                    >
                                        MCQ
                                    </div>
                                    <div 
                                        className={`tab-item ${form.question_type === 'CASE_SCENARIO' ? 'active' : ''}`}
                                        onClick={() => {
                                            set('question_type', 'CASE_SCENARIO');
                                            setSubQuestions(prev => {
                                                if (prev.length === 0) {
                                                    return [{
                                                        identifier: '(a)',
                                                        question_text: '',
                                                        question_type: 'MCQ',
                                                        marks: 1,
                                                        table_data: '',
                                                        options: [
                                                            { text: '', is_correct: false, order: 0 },
                                                            { text: '', is_correct: false, order: 1 },
                                                            { text: '', is_correct: false, order: 2 },
                                                            { text: '', is_correct: false, order: 3 },
                                                        ],
                                                    }];
                                                }
                                                return prev.map(q => {
                                                    if (q.question_type !== 'MCQ') {
                                                        return {
                                                            ...q,
                                                            question_type: 'MCQ',
                                                            options: q.options && q.options.length > 0 ? q.options : [
                                                                { text: '', is_correct: false, order: 0 },
                                                                { text: '', is_correct: false, order: 1 },
                                                                { text: '', is_correct: false, order: 2 },
                                                                { text: '', is_correct: false, order: 3 },
                                                            ]
                                                        };
                                                    }
                                                    return q;
                                                });
                                            });
                                        }}
                                    >
                                        MCQ Case Scenario
                                    </div>
                                </div>
                            </div>
                            <div className="form-group span-2">
                                <label className="text-xs font-bold text-slate-500">Question Marks</label>
                                <input type="number" className="form-input mt-1 w-full" placeholder="e.g. 5" value={form.marks} onChange={e => set('marks', e.target.value)} />
                            </div>
                            <div className="form-group span-5">
                                <label className="text-xs font-bold text-slate-500">Metadata Source</label>
                                <select className="form-input mt-1 w-full" value={form.source} onChange={e => set('source', e.target.value)}>
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Year, Q No */}
                        <div className="settings-grid">
                            <div className="form-group span-5">
                                <label className="text-xs font-bold text-slate-500">Year</label>
                                <select className="form-input mt-1 w-full" value={form.year} onChange={e => set('year', e.target.value)}>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="form-group span-7">
                                <label className="text-xs font-bold text-slate-500">Question No.</label>
                                <input className="form-input mt-1 w-full" placeholder="e.g. 1a" value={form.q_no} onChange={e => set('q_no', e.target.value)} />
                            </div>
                        </div>

                        {/* Row 3: Attempt — full width for all tabs */}
                        <div className="form-group">
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

                        {/* Row 4: Difficulty + Tags */}
                        <div className="settings-grid">
                            <div className="form-group span-5">
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
                            <div className="form-group span-7">
                                <label className="text-xs font-bold text-slate-500">Tags</label>
                                <input className="form-input mt-1 w-full" placeholder="e.g. AS-15, Inventory, Depreciation" value={form.tags} onChange={e => set('tags', e.target.value)} />
                            </div>
                        </div>

                    </div>

                    {/* Case Scenario Passage Card (If CASE_SCENARIO is chosen) */}
                    {form.question_type === 'CASE_SCENARIO' && (
                        <div className="form-card space-y-4 border-l-4 border-amber-500 bg-amber-50/20">
                            <div className="flex justify-between items-center">
                                <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-amber-800 uppercase tracking-wider">
                                    <FileText size={16} className="text-amber-600" /> Case Scenario Passage / Context
                                </h2>
                            </div>
                            <textarea
                                id="case-scenario-passage-text"
                                className="w-full min-h-[220px] p-4 border border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 rounded-lg text-sm bg-white outline-none transition-all font-semibold text-slate-700"
                                placeholder="Type or paste the main Case Scenario/Passage here. Students will read this text before answering the sub-questions below."
                                value={form.case_scenario_passage}
                                onChange={e => set('case_scenario_passage', e.target.value)}
                            />

                            {/* Case Scenario Toolbar Options */}
                            <div className="flex gap-2.5 pb-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setShowQTable(!showQTable)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${showQTable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                >
                                    {showQTable ? '[-] Remove Table' : '[+] Add Table'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowQTable(true);
                                        const currentTables = parseTablesHelper(form.table_data);
                                        const cursorTablesCount = currentTables.filter((t: any) => t.type === 'cursor').length;
                                        const newTablePlaceholder = `[TABLE_${cursorTablesCount + 1}]`;
                                        const newTable = {
                                            type: 'cursor',
                                            headers: ['Header 1', 'Header 2'],
                                            rows: [['', '']]
                                        };
                                        set('table_data', JSON.stringify([...currentTables, newTable]));
                                        insertTextAtCursor('case-scenario-passage-text', ` ${newTablePlaceholder} `, val => set('case_scenario_passage', val));
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                >
                                    [+ Table @ Cursor]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        insertTextAtCursor(
                                            'case-scenario-passage-text',
                                            '\n(A) \n(B) \n(C) \n(D) ',
                                            val => set('case_scenario_passage', val)
                                        );
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                >
                                    [+ MCQ @ Cursor]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        insertTextAtCursor(
                                            'case-scenario-passage-text',
                                            '\n(a) \n(b) \n(c) ',
                                            val => set('case_scenario_passage', val)
                                        );
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                >
                                    [+ Sub-Q @ Cursor]
                                </button>
                                <span className="w-[1px] h-6 bg-slate-200 self-center mx-1" />
                                <button
                                    type="button"
                                    onClick={() => insertFormattedTextAtCursor('case-scenario-passage-text', 'B', val => set('case_scenario_passage', val))}
                                    className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                    title="Bold"
                                >
                                    <Bold size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertFormattedTextAtCursor('case-scenario-passage-text', 'U', val => set('case_scenario_passage', val))}
                                    className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                    title="Underline"
                                >
                                    <Underline size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertFormattedTextAtCursor('case-scenario-passage-text', 'CENTER', val => set('case_scenario_passage', val))}
                                    className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                    title="Center"
                                >
                                    <AlignCenter size={14} />
                                </button>
                                <span className="w-[1px] h-6 bg-slate-200 self-center mx-1" />
                                <button
                                    type="button"
                                    onClick={addSubQuestion}
                                    className="px-3.5 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                >
                                    <Plus size={13} /> Add MCQ Sub-Question
                                </button>
                            </div>

                            {/* Inline Case Scenario Table Builder */}
                            {showQTable && (
                                <MultiTableManager
                                    label="Case Scenario Tabular Data"
                                    value={form.table_data}
                                    onChange={val => set('table_data', val)}
                                    textareaId="case-scenario-passage-text"
                                    insertTextAtCursor={insertTextAtCursor}
                                    onUpdateText={val => set('case_scenario_passage', val)}
                                />
                            )}

                            <p className="text-[10px] text-amber-600 font-bold mt-1">This passage will serve as the shared context for all MCQ sub-questions below.</p>
                        </div>
                    )}

                    {/* Section 1: Question Card (with sub-questions relocated inside) */}
                    <div className="form-card space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="form-card-title flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                <Clipboard size={16} />
                                {form.question_type === 'CASE_SCENARIO' ? 'MCQ Sub-Questions' : 'Question Text Box'}
                            </h2>
                        </div>

                        {/* Main question textarea — hidden for Case Scenario since passage is the context */}
                        {form.question_type !== 'CASE_SCENARIO' && (
                            <textarea
                                id="main-question-text"
                                className="w-full min-h-[140px] p-4 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold text-slate-700"
                                placeholder="Type your primary question here..."
                                value={form.question_text}
                                onChange={e => set('question_text', e.target.value)}
                            />
                        )}

                        {/* Case Scenario hint */}
                        {form.question_type === 'CASE_SCENARIO' && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 font-medium">
                                📋 Add MCQ sub-questions below. Each will be answered using the passage entered above.
                            </p>
                        )}

                        {/* Question Action Bar */}
                        <div className="flex gap-2.5 pb-2 flex-wrap">
                            {form.question_type !== 'CASE_SCENARIO' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowQTable(!showQTable)}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${showQTable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                    >
                                        {showQTable ? '[-] Remove Table' : '[+] Add Table'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowQTable(true);
                                            const currentTables = parseTablesHelper(form.table_data);
                                            const cursorTablesCount = currentTables.filter((t: any) => t.type === 'cursor').length;
                                            const newTablePlaceholder = `[TABLE_${cursorTablesCount + 1}]`;
                                            const newTable = {
                                                type: 'cursor',
                                                headers: ['Header 1', 'Header 2'],
                                                rows: [['', '']]
                                            };
                                            set('table_data', JSON.stringify([...currentTables, newTable]));
                                            insertTextAtCursor('main-question-text', ` ${newTablePlaceholder} `, val => set('question_text', val));
                                        }}
                                        className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                    >
                                        [+ Table @ Cursor]
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            insertTextAtCursor(
                                                'main-question-text',
                                                '\n(A) \n(B) \n(C) \n(D) ',
                                                val => set('question_text', val)
                                            );
                                        }}
                                        className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                    >
                                        [+ MCQ @ Cursor]
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            insertTextAtCursor(
                                                'main-question-text',
                                                '\n(a) \n(b) \n(c) ',
                                                val => set('question_text', val)
                                            );
                                        }}
                                        className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                                    >
                                        [+ Sub-Q @ Cursor]
                                    </button>
                                    <span className="w-[1px] h-6 bg-slate-200 self-center mx-1" />
                                    <button
                                        type="button"
                                        onClick={() => insertFormattedTextAtCursor('main-question-text', 'B', val => set('question_text', val))}
                                        className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                        title="Bold"
                                    >
                                        <Bold size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertFormattedTextAtCursor('main-question-text', 'U', val => set('question_text', val))}
                                        className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                        title="Underline"
                                    >
                                        <Underline size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertFormattedTextAtCursor('main-question-text', 'CENTER', val => set('question_text', val))}
                                        className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                        title="Center"
                                    >
                                        <AlignCenter size={14} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={addSubQuestion}
                                className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${form.question_type === 'CASE_SCENARIO' ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                            >
                                <Plus size={13} /> {form.question_type === 'CASE_SCENARIO' ? 'Add MCQ Sub-Question' : 'Add Sub-Question'}
                            </button>
                        </div>

                        {/* Inline Question Table Builder */}
                        {showQTable && (
                            <MultiTableManager
                                label="Question Tabular Data"
                                value={form.table_data}
                                onChange={val => set('table_data', val)}
                                textareaId="main-question-text"
                                insertTextAtCursor={insertTextAtCursor}
                                onUpdateText={val => set('question_text', val)}
                            />
                        )}

                        {/* MCQ Options — Fixed A/B/C/D Grid (top-level MCQ) */}
                        {form.question_type === 'MCQ' && (
                            <div className="border-t border-slate-100 pt-4 space-y-3">
                                <div className="flex items-center gap-1.5">
                                    <CheckSquare size={14} className="text-indigo-500" />
                                    <h3 className="text-xs font-bold text-slate-700">MCQ Options</h3>
                                    <span className="ml-1 text-[10px] text-slate-400 font-semibold">— click letter badge to mark correct answer</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {['A', 'B', 'C', 'D'].map((letter, idx) => {
                                        const opt = options[idx] || { text: '', is_correct: false, order: idx };
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${opt.is_correct ? 'border-green-400 bg-green-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setOptionCorrect(idx)}
                                                    className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-black transition-all ${opt.is_correct ? 'bg-green-500 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700'}`}
                                                    title={`Mark ${letter} as correct`}
                                                >
                                                    {letter}
                                                </button>
                                                <input
                                                    id={`mcq-opt-input-${idx}`}
                                                    type="text"
                                                    className={`flex-1 text-sm border-none bg-transparent focus:ring-0 focus:outline-none font-medium placeholder:text-slate-350 ${opt.is_correct ? 'text-green-700' : 'text-slate-700'}`}
                                                    placeholder={`Option ${letter}...`}
                                                    value={opt.text}
                                                    onChange={e => {
                                                        // Ensure options array has 4 entries
                                                        setOptions(prev => {
                                                            const next = [...prev];
                                                            while (next.length <= idx) next.push({ text: '', is_correct: false, order: next.length });
                                                            next[idx] = { ...next[idx], text: e.target.value };
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`mcq-opt-input-${idx}`, 'B', val => {
                                                            setOptions(prev => {
                                                                const next = [...prev];
                                                                while (next.length <= idx) next.push({ text: '', is_correct: false, order: next.length });
                                                                next[idx] = { ...next[idx], text: val };
                                                                return next;
                                                            });
                                                        })}
                                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                        title="Bold"
                                                    >
                                                        <Bold size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`mcq-opt-input-${idx}`, 'U', val => {
                                                            setOptions(prev => {
                                                                const next = [...prev];
                                                                while (next.length <= idx) next.push({ text: '', is_correct: false, order: next.length });
                                                                next[idx] = { ...next[idx], text: val };
                                                                return next;
                                                            });
                                                        })}
                                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                        title="Underline"
                                                    >
                                                        <Underline size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`mcq-opt-input-${idx}`, 'CENTER', val => {
                                                            setOptions(prev => {
                                                                const next = [...prev];
                                                                while (next.length <= idx) next.push({ text: '', is_correct: false, order: next.length });
                                                                next[idx] = { ...next[idx], text: val };
                                                                return next;
                                                            });
                                                        })}
                                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                        title="Center"
                                                    >
                                                        <AlignCenter size={11} />
                                                    </button>
                                                </div>
                                                {opt.is_correct && (
                                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-wider flex-shrink-0">✓ Correct</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Inline relocated Sub-Question Parts list */}
                        {subQuestions.length > 0 && (
                            <div className="border-t border-slate-100 pt-4 space-y-6">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Sub-Question Configurator</h3>
                                <div className="space-y-4">
                                    {subQuestions.map((part, pIdx) => {
                                        const hasPartQTable = !!part.table_data;
                                        const isCaseScenario = form.question_type === 'CASE_SCENARIO';
                                        return (
                                            <div key={pIdx} className={`p-4 border rounded-xl relative space-y-3.5 ${isCaseScenario ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200/60 bg-white'}`}>
                                                <button type="button" onClick={() => removeSubQuestion(pIdx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700" title="Delete Part">
                                                    <Trash2 size={15} />
                                                </button>

                                                <div className="flex gap-2 items-center">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isCaseScenario ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                                        {isCaseScenario ? `MCQ Sub-question ${pIdx + 1}` : `Sub-question ${pIdx + 1}`}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`text-[10px] font-bold ${isCaseScenario ? 'text-amber-700' : 'text-slate-400'}`}>ID:</span>
                                                        <input
                                                            type="text"
                                                            placeholder="ID (e.g. (a))"
                                                            className="px-2 py-0.5 border border-slate-200 rounded text-xs w-16 bg-white"
                                                            value={part.identifier}
                                                            onChange={e => updateSubQuestion(pIdx, 'identifier', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`text-[10px] font-bold ${isCaseScenario ? 'text-amber-700' : 'text-slate-400'}`}>Marks:</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Marks"
                                                            className="px-2 py-0.5 border border-slate-200 rounded text-xs w-16 bg-white"
                                                            value={part.marks}
                                                            onChange={e => updateSubQuestion(pIdx, 'marks', e.target.value)}
                                                        />
                                                    </div>
                                                    {!isCaseScenario && (
                                                        <select
                                                            className="px-2 py-0.5 border border-slate-200 rounded text-xs"
                                                            value={part.question_type}
                                                            onChange={e => updateSubQuestion(pIdx, 'question_type', e.target.value)}
                                                        >
                                                            <option value="NORMAL">Theory</option>
                                                            <option value="MCQ">MCQ</option>
                                                        </select>
                                                    )}
                                                    {isCaseScenario && (
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded">MCQ</span>
                                                    )}
                                                </div>

                                                <textarea
                                                    id={`sub-q-textarea-${pIdx}`}
                                                    placeholder={isCaseScenario ? "MCQ question text (relating to the passage above)..." : "Sub-question text content..."}
                                                    className={`w-full min-h-[70px] p-2.5 border rounded text-xs ${isCaseScenario ? 'border-amber-200 bg-white focus:border-amber-400' : 'border-slate-200 bg-slate-50/50'}`}
                                                    value={part.question_text}
                                                    onChange={e => updateSubQuestion(pIdx, 'question_text', e.target.value)}
                                                />

                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSubQuestion(pIdx, 'table_data', hasPartQTable ? '' : JSON.stringify({ headers: ['Column 1'], rows: [['']] }))}
                                                        className={`px-2.5 py-1 rounded border text-[10px] font-bold transition-all ${hasPartQTable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                                    >
                                                        {hasPartQTable ? '[-] Remove Table' : '[+] Add Table'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentTables = parseTablesHelper(part.table_data);
                                                            const cursorTablesCount = currentTables.filter((t: any) => t.type === 'cursor').length;
                                                            const newTablePlaceholder = `[TABLE_${cursorTablesCount + 1}]`;
                                                            const newTable = {
                                                                type: 'cursor',
                                                                headers: ['Column 1', 'Column 2'],
                                                                rows: [['', '']]
                                                            };
                                                            updateSubQuestion(pIdx, 'table_data', JSON.stringify([...currentTables, newTable]));
                                                            insertTextAtCursor(`sub-q-textarea-${pIdx}`, ` ${newTablePlaceholder} `, val => updateSubQuestion(pIdx, 'question_text', val));
                                                        }}
                                                        className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-700 rounded text-[10px] font-bold transition-all hover:bg-slate-200"
                                                    >
                                                        [+ Table @ Cursor]
                                                    </button>
                                                    <span className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-textarea-${pIdx}`, 'B', val => updateSubQuestion(pIdx, 'question_text', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Bold"
                                                    >
                                                        <Bold size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-textarea-${pIdx}`, 'U', val => updateSubQuestion(pIdx, 'question_text', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Underline"
                                                    >
                                                        <Underline size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-textarea-${pIdx}`, 'CENTER', val => updateSubQuestion(pIdx, 'question_text', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Center"
                                                    >
                                                        <AlignCenter size={11} />
                                                    </button>
                                                    {part.question_type === 'MCQ' && !isCaseScenario && (
                                                        <button type="button" onClick={() => addSubQuestionOption(pIdx)} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[10px] font-bold hover:bg-indigo-100 transition-all">+ Add Choice</button>
                                                     )}
                                                </div>

                                                {hasPartQTable && (
                                                    <MultiTableManager
                                                        label={`Sub-question ${part.identifier} Question Table`}
                                                        value={part.table_data}
                                                        onChange={val => updateSubQuestion(pIdx, 'table_data', val)}
                                                        textareaId={`sub-q-textarea-${pIdx}`}
                                                        insertTextAtCursor={insertTextAtCursor}
                                                        onUpdateText={val => updateSubQuestion(pIdx, 'question_text', val)}
                                                    />
                                                )}

                                                {/* Fixed A/B/C/D MCQ Grid for Case Scenario sub-questions */}
                                                {part.question_type === 'MCQ' && isCaseScenario && (
                                                    <div className="pt-2 border-t border-amber-100 space-y-2">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">MCQ Options — click letter badge to mark correct</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => addSubQuestionOption(pIdx)}
                                                                className="flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-[10px] font-bold transition-all"
                                                            >
                                                                <Plus size={10} /> Add Answer
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {(part.options.length > 0 ? part.options : [
                                                                { text: '', is_correct: false, order: 0 },
                                                                { text: '', is_correct: false, order: 1 },
                                                                { text: '', is_correct: false, order: 2 },
                                                                { text: '', is_correct: false, order: 3 },
                                                            ]).map((pOpt, oIdx) => {
                                                                const letter = String.fromCharCode(65 + oIdx);
                                                                return (
                                                                    <div
                                                                        key={oIdx}
                                                                        className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${pOpt.is_correct ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white'}`}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSubQuestionOptionCorrect(pIdx, oIdx)}
                                                                            className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-black transition-all ${pOpt.is_correct ? 'bg-green-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600 hover:bg-amber-200 hover:text-amber-700'}`}
                                                                            title={`Mark ${letter} as correct`}
                                                                        >
                                                                            {letter}
                                                                        </button>
                                                                        <input
                                                                            id={`sub-q-${pIdx}-opt-input-${oIdx}`}
                                                                            type="text"
                                                                            className={`flex-1 text-xs border-none bg-transparent focus:ring-0 focus:outline-none font-medium ${pOpt.is_correct ? 'text-green-700' : 'text-slate-700'}`}
                                                                            placeholder={`Option ${letter}...`}
                                                                            value={pOpt.text}
                                                                            onChange={e => updateSubQuestionOptionText(e.target.value, pIdx, oIdx)}
                                                                        />
                                                                        <div className="flex gap-0.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => insertFormattedTextAtCursor(`sub-q-${pIdx}-opt-input-${oIdx}`, 'B', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                                title="Bold"
                                                                            >
                                                                                <Bold size={10} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => insertFormattedTextAtCursor(`sub-q-${pIdx}-opt-input-${oIdx}`, 'U', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                                title="Underline"
                                                                            >
                                                                                <Underline size={10} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => insertFormattedTextAtCursor(`sub-q-${pIdx}-opt-input-${oIdx}`, 'CENTER', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                                title="Center"
                                                                            >
                                                                                <AlignCenter size={10} />
                                                                            </button>
                                                                        </div>
                                                                        {pOpt.is_correct && (
                                                                            <span className="text-[9px] font-black text-green-600 flex-shrink-0">✓</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Dynamic options for non-case-scenario MCQ sub-questions */}
                                                {part.question_type === 'MCQ' && !isCaseScenario && (
                                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                                        {part.options.map((pOpt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-400 w-4">{String.fromCharCode(65 + oIdx)}.</span>
                                                                <input
                                                                    id={`sub-q-nocase-${pIdx}-opt-input-${oIdx}`}
                                                                    type="text"
                                                                    className="flex-1 px-2.5 py-1 border border-slate-200 rounded text-xs"
                                                                    placeholder="Choice text..."
                                                                    value={pOpt.text}
                                                                    onChange={e => updateSubQuestionOptionText(e.target.value, pIdx, oIdx)}
                                                                />
                                                                <div className="flex gap-0.5 flex-shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-nocase-${pIdx}-opt-input-${oIdx}`, 'B', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                        className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                        title="Bold"
                                                                    >
                                                                        <Bold size={10} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-nocase-${pIdx}-opt-input-${oIdx}`, 'U', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                        className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                        title="Underline"
                                                                    >
                                                                        <Underline size={10} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => insertFormattedTextAtCursor(`sub-q-nocase-${pIdx}-opt-input-${oIdx}`, 'CENTER', val => updateSubQuestionOptionText(val, pIdx, oIdx))}
                                                                        className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                                        title="Center"
                                                                    >
                                                                        <AlignCenter size={10} />
                                                                    </button>
                                                                </div>
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
                            id="main-correct-answer"
                            className="w-full min-h-[160px] p-4 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono text-slate-700"
                            placeholder="Type suggested solutions / calculations..."
                            value={form.correct_answer}
                            onChange={e => set('correct_answer', e.target.value)}
                        />

                        {/* Answer Action Bar: Add Table & Add Sub-Answer side-by-side */}
                        <div className="flex gap-2.5 pb-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setShowATable(!showATable)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${showATable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                            >
                                {showATable ? '[-] Remove Table' : '[+] Add Table'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowATable(true);
                                    const currentTables = parseTablesHelper(form.answer_table_data);
                                    const cursorTablesCount = currentTables.filter((t: any) => t.type === 'cursor').length;
                                    const newTablePlaceholder = `[TABLE_${cursorTablesCount + 1}]`;
                                    const newTable = {
                                        type: 'cursor',
                                        headers: ['Header 1', 'Header 2'],
                                        rows: [['', '']]
                                    };
                                    set('answer_table_data', JSON.stringify([...currentTables, newTable]));
                                    insertTextAtCursor('main-correct-answer', ` ${newTablePlaceholder} `, val => set('correct_answer', val));
                                }}
                                className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all hover:bg-slate-200"
                            >
                                [+ Table @ Cursor]
                            </button>
                            <button
                                type="button"
                                onClick={addSubAnswer}
                                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1"
                            >
                                <Plus size={13} /> Add Sub-Answer
                            </button>
                            <span className="w-[1px] h-6 bg-slate-200 self-center mx-1" />
                            <button
                                type="button"
                                onClick={() => insertFormattedTextAtCursor('main-correct-answer', 'B', val => set('correct_answer', val))}
                                className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                title="Bold"
                            >
                                <Bold size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormattedTextAtCursor('main-correct-answer', 'U', val => set('correct_answer', val))}
                                className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                title="Underline"
                            >
                                <Underline size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormattedTextAtCursor('main-correct-answer', 'CENTER', val => set('correct_answer', val))}
                                className="p-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition-all hover:bg-slate-200"
                                title="Center"
                              >
                                <AlignCenter size={14} />
                            </button>
                        </div>

                        {/* Inline Answer Table Builder */}
                        {showATable && (
                            <MultiTableManager
                                label="Answer Details Table"
                                value={form.answer_table_data}
                                onChange={val => set('answer_table_data', val)}
                                textareaId="main-correct-answer"
                                insertTextAtCursor={insertTextAtCursor}
                                onUpdateText={val => set('correct_answer', val)}
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
                                                    id={`sub-a-textarea-${pIdx}`}
                                                    placeholder="Sub-question correct answer/suggested solution..."
                                                    className="w-full min-h-[80px] p-2.5 border border-slate-200 rounded text-xs bg-slate-50/50 font-mono"
                                                    value={part.correct_answer || ''}
                                                    onChange={e => updateSubAnswer(pIdx, 'correct_answer', e.target.value)}
                                                />

                                                {/* Sub-answer Action Bar */}
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSubAnswer(pIdx, 'answer_table_data', hasPartATable ? '' : JSON.stringify({ headers: ['Column 1'], rows: [['']] }))}
                                                        className={`px-2.5 py-1 rounded border text-[10px] font-bold transition-all ${hasPartATable ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                                                    >
                                                        {hasPartATable ? '[-] Remove Table' : '[+] Add Table'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentTables = parseTablesHelper(part.answer_table_data);
                                                            const cursorTablesCount = currentTables.filter((t: any) => t.type === 'cursor').length;
                                                            const newTablePlaceholder = `[TABLE_${cursorTablesCount + 1}]`;
                                                            const newTable = {
                                                                type: 'cursor',
                                                                headers: ['Column 1', 'Column 2'],
                                                                rows: [['', '']]
                                                            };
                                                            updateSubAnswer(pIdx, 'answer_table_data', JSON.stringify([...currentTables, newTable]));
                                                            insertTextAtCursor(`sub-a-textarea-${pIdx}`, ` ${newTablePlaceholder} `, val => updateSubAnswer(pIdx, 'correct_answer', val));
                                                        }}
                                                        className="px-2.5 py-1 bg-slate-100 border border-slate-350 text-slate-700 rounded text-[10px] font-bold transition-all hover:bg-slate-200"
                                                    >
                                                        [+ Table @ Cursor]
                                                    </button>
                                                    <span className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-a-textarea-${pIdx}`, 'B', val => updateSubAnswer(pIdx, 'correct_answer', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Bold"
                                                    >
                                                        <Bold size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-a-textarea-${pIdx}`, 'U', val => updateSubAnswer(pIdx, 'correct_answer', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Underline"
                                                    >
                                                        <Underline size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertFormattedTextAtCursor(`sub-a-textarea-${pIdx}`, 'CENTER', val => updateSubAnswer(pIdx, 'correct_answer', val))}
                                                        className="p-1 bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all hover:bg-slate-200"
                                                        title="Center"
                                                    >
                                                        <AlignCenter size={11} />
                                                    </button>
                                                </div>

                                                {hasPartATable && (
                                                    <MultiTableManager
                                                        label={`Sub-answer ${part.identifier} Solution Table`}
                                                        value={part.answer_table_data}
                                                        onChange={val => updateSubAnswer(pIdx, 'answer_table_data', val)}
                                                        textareaId={`sub-a-textarea-${pIdx}`}
                                                        insertTextAtCursor={insertTextAtCursor}
                                                        onUpdateText={val => updateSubAnswer(pIdx, 'correct_answer', val)}
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
                            <Star size={16} /> Exam Master
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
