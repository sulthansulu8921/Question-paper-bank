import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import {
    Upload, FileText, CheckCircle2, AlertCircle, Loader2,
    X, ExternalLink, BookOpen
} from 'lucide-react';

interface UploadResult {
    message: string;
    file_url: string;
    file_path: string;
    record_id: number | null;
    title: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onUploaded?: (result: UploadResult) => void;
}

const SOURCES = ['MTP-01', 'MTP-02', 'RTP', 'Suggested Answers', 'Model Test Paper', 'Other'];
const YEARS   = ['2022', '2023', '2024', '2025'];

export default function PDFUploadModal({ open, onClose, onUploaded }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver]   = useState(false);
    const [file, setFile]           = useState<File | null>(null);
    const [form, setForm]           = useState({
        title:      '',
        subject_id: '',
        year:       '2024',
        source:     'RTP',
        paper_type: 'question_paper',
        is_premium: true,
    });
    const [uploaded, setUploaded]   = useState<UploadResult | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');

    // Fetch subjects for dropdown
    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects-list'],
        queryFn:  async () => (await api.get('/courses/subjects/')).data,
        enabled:  open,
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['subjects-categories-list'],
        queryFn: async () => {
            const res = await api.get('/courses/categories/');
            return res.data.results || res.data || [];
        },
        enabled: open,
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['subjects-courses-list'],
        queryFn: async () => {
            const res = await api.get('/courses/courses/');
            return res.data.results || res.data || [];
        },
        enabled: open,
    });

    const uploadMutation = useMutation({
        mutationFn: async (pdfFile: File) => {
            const fd = new FormData();
            fd.append('pdf',        pdfFile);
            fd.append('title',      form.title || pdfFile.name.replace('.pdf', ''));
            fd.append('subject_id', form.subject_id);
            fd.append('year',       form.year);
            fd.append('source',     form.source);
            fd.append('paper_type', form.paper_type);
            fd.append('is_premium', form.is_premium ? 'true' : 'false');
            const res = await api.post('/materials/upload-pdf/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data as UploadResult;
        },
        onSuccess: (data) => {
            setUploaded(data);
            onUploaded?.(data);
        },
    });

    const handleFile = useCallback((f: File) => {
        if (!f.name.toLowerCase().endsWith('.pdf')) return;
        setFile(f);
        if (!form.title) setForm(p => ({ ...p, title: f.name.replace('.pdf', '') }));
    }, [form.title]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }, [handleFile]);

    const reset = () => {
        setFile(null);
        setUploaded(null);
        setForm({ title: '', subject_id: '', year: '2024', source: 'RTP', paper_type: 'question_paper', is_premium: true });
        setSelectedCategoryId('');
        setSelectedCourseId('');
    };

    const handleCategoryChange = (catId: string) => {
        setSelectedCategoryId(catId);
        const filteredCourses = courses.filter((c: any) => c.category?.toString() === catId);
        const firstCourse = filteredCourses[0]?.id?.toString() || '';
        setSelectedCourseId(firstCourse);
        const filteredSubjects = subjects.filter((s: any) => s.course?.toString() === firstCourse);
        const firstSubject = filteredSubjects[0]?.id?.toString() || '';
        setForm(prev => ({ ...prev, subject_id: firstSubject }));
    };

    const handleCourseChange = (courseId: string) => {
        setSelectedCourseId(courseId);
        const filteredSubjects = subjects.filter((s: any) => s.course?.toString() === courseId);
        const firstSubject = filteredSubjects[0]?.id?.toString() || '';
        setForm(prev => ({ ...prev, subject_id: firstSubject }));
    };

    const handleClose = () => { reset(); onClose(); };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Upload size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Upload Question Paper PDF</h2>
                            <p className="text-[11px] text-slate-400">Store PDF directly — no AI required</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">

                    {/* Success State */}
                    {uploaded ? (
                        <div className="flex flex-col items-center py-6 text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 size={32} className="text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800">PDF Uploaded!</h3>
                                <p className="text-sm text-slate-500 mt-1">{uploaded.title}</p>
                            </div>
                            <a href={uploaded.file_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                                <ExternalLink size={14} /> View PDF
                            </a>
                            {uploaded.record_id && (
                                <p className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                                    ✅ Question Paper record #{uploaded.record_id} created in database
                                </p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button onClick={reset} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                                    Upload Another
                                </button>
                                <button onClick={handleClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50">
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Drop Zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                    ${dragOver  ? 'border-emerald-400 bg-emerald-50'
                                    : file      ? 'border-green-400 bg-green-50'
                                    :             'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                                {file ? (
                                    <>
                                        <FileText size={32} className="mx-auto mb-2 text-green-500" />
                                        <p className="font-bold text-slate-700 text-sm">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={32} className="mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-500 text-sm">Drop PDF here or click to browse</p>
                                        <p className="text-xs text-slate-400 mt-1">Max file size: 50 MB</p>
                                    </>
                                )}
                            </div>

                            {/* Metadata form */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Title</label>
                                    <input
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400"
                                        placeholder="e.g. CA Inter Advanced Accounting Nov 2024"
                                        value={form.title}
                                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Qualification Stream</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={selectedCategoryId}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                    >
                                        <option value="">Select Stream...</option>
                                        {categories.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Course Level</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={selectedCourseId}
                                        onChange={e => handleCourseChange(e.target.value)}
                                        disabled={!selectedCategoryId}
                                    >
                                        <option value="">Select Level...</option>
                                        {courses
                                            .filter((c: any) => c.category?.toString() === selectedCategoryId?.toString())
                                            .map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Subject</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={form.subject_id}
                                        onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}
                                        disabled={!selectedCourseId}
                                    >
                                        <option value="">Select Subject...</option>
                                        {subjects
                                            .filter((s: any) => s.course?.toString() === selectedCourseId?.toString())
                                            .map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Year</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={form.year}
                                        onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Source</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={form.source}
                                        onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                                    >
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Type</label>
                                    <select
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
                                        value={form.paper_type}
                                        onChange={e => setForm(p => ({ ...p, paper_type: e.target.value }))}
                                    >
                                        <option value="question_paper">Question Paper</option>
                                        <option value="answer_paper">Answer Paper</option>
                                        <option value="notes">Notes</option>
                                    </select>
                                </div>

                                <div className="col-span-2 flex items-center gap-2 pt-1">
                                    <input type="checkbox" id="premium-check" checked={form.is_premium}
                                        onChange={e => setForm(p => ({ ...p, is_premium: e.target.checked }))}
                                        className="w-4 h-4 accent-emerald-600" />
                                    <label htmlFor="premium-check" className="text-xs font-semibold text-slate-600 cursor-pointer">
                                        Premium content (requires active subscription)
                                    </label>
                                </div>
                            </div>

                            {/* Error */}
                            {uploadMutation.isError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-xs text-red-700">
                                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                    {(uploadMutation.error as any)?.response?.data?.error ?? 'Upload failed. Please try again.'}
                                </div>
                            )}

                            {/* Info box */}
                            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                                <p className="text-xs text-teal-700 font-bold mb-1 flex items-center gap-1.5">
                                    <BookOpen size={11} /> What happens after upload?
                                </p>
                                <ul className="text-[11px] text-teal-600 space-y-0.5 list-disc list-inside">
                                    <li>PDF is saved to the server's media storage</li>
                                    <li>A Question Paper record is created in the database</li>
                                    <li>Students can view/download it from the Question Papers page</li>
                                    <li>No AI processing — instant upload</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!uploaded && (
                    <div className="px-5 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <button onClick={handleClose} className="text-sm text-slate-500 font-semibold hover:text-slate-700">Cancel</button>
                        <button
                            onClick={() => file && uploadMutation.mutate(file)}
                            disabled={!file || uploadMutation.isPending}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
                        >
                            {uploadMutation.isPending
                                ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                                : <><Upload size={14} /> Upload PDF</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
