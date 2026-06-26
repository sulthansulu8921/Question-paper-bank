import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { Save, ArrowLeft, Plus, Trash2, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import ICAICascadeSelector, { type ICAISelection } from '@/components/admin/ICAICascadeSelector';

const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.87rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', color: '#1e293b' };
const lbl: React.CSSProperties = { fontWeight: 700, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.25rem' };

export default function AdminAddMCQ() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [icai, setIcai] = useState<ICAISelection>({
        levelId: '',
        paperId: '',
        chapterId: '',
        topicId: '',
    });

    const [form, setForm] = useState({ question_text: '', explanation: '', related_concept: '', difficulty: 'MEDIUM', marks: 1, status: 'ACTIVE', tags: '' });
    const [options, setOptions] = useState([{ text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }]);

    useEffect(() => {
        if (!icai.topicId) return;
        // Fetch topic details to populate parent dropdowns in edit mode
        if (!icai.levelId) {
            api.get(`/master/topics/${icai.topicId}/`).then(r => {
                const t = r.data;
                if (t) {
                    setIcai({
                        levelId: String(t.level_id || ''),
                        paperId: String(t.paper_id || ''),
                        chapterId: String(t.chapter_id || ''),
                        topicId: String(t.id || ''),
                    });
                }
            }).catch(e => console.error("Failed to fetch topic details", e));
        }
    }, [icai.topicId, icai.levelId]);

    useEffect(() => {
        if (!isEdit) return;
        api.get(`/materials/subjective-questions/${id}/`).then(r => {
            const q = r.data;
            setForm({ question_text: q.question_text || '', explanation: q.explanation || '', related_concept: q.related_concept || '', difficulty: q.difficulty || 'MEDIUM', marks: q.marks || 1, status: q.status || 'ACTIVE', tags: q.tags || '' });
            if (q.options?.length > 0) setOptions(q.options.map((o: any) => ({ text: o.text, is_correct: o.is_correct })));
            if (q.icai_topic) {
                const topicId = typeof q.icai_topic === 'object' ? q.icai_topic.id?.toString() : q.icai_topic?.toString();
                setIcai(prev => ({ ...prev, topicId: topicId || '' }));
            }
        });
    }, [id, isEdit]);

    const setCorrect = (idx: number) => setOptions(o => o.map((opt, i) => ({ ...opt, is_correct: i === idx })));
    const updateOption = (idx: number, text: string) => setOptions(o => o.map((opt, i) => i === idx ? { ...opt, text } : opt));
    const addOption = () => { if (options.length < 6) setOptions(o => [...o, { text: '', is_correct: false }]); };
    const removeOption = (idx: number) => { if (options.length > 2) setOptions(o => o.filter((_, i) => i !== idx)); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!form.question_text.trim()) { setError('Question text is required.'); return; }
        if (!options.some(o => o.is_correct)) { setError('Please mark at least one correct option.'); return; }
        if (options.some(o => !o.text.trim())) { setError('All options must have text.'); return; }
        if (!icai.topicId) { setError('Please select a topic from the master tree.'); return; }
        setSaving(true);
        try {
            const payload = { ...form, question_type: 'MCQ', icai_topic: parseInt(icai.topicId), options: options.map((o, i) => ({ text: o.text, is_correct: o.is_correct, order: i })) };
            if (isEdit) { await api.patch(`/materials/subjective-questions/${id}/`, payload); setSuccess('MCQ updated!'); }
            else { await api.post('/materials/subjective-questions/', payload); setSuccess('MCQ created!'); setTimeout(() => navigate('/admin/mcq-bank'), 1500); }
        } catch (err: any) { setError(JSON.stringify(err?.response?.data) || 'Failed to save.'); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' }}>
                <button onClick={() => navigate('/admin/mcq-bank')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                    <ArrowLeft size={16} /> Back
                </button>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{isEdit ? 'Edit MCQ Question' : 'Add New MCQ Question'}</h1>
                    <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '0.85rem' }}>Fill in the master tree location, question text, and answer options</p>
                </div>
            </div>

            {error && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}><AlertCircle size={16} /> {error}</div>}
            {success && <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#065f46', fontSize: '0.85rem', fontWeight: 600 }}><CheckCircle size={16} /> {success}</div>}

            <form onSubmit={handleSubmit}>
                <div style={card}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '1rem' }}>📍 Question Location (Master Tree)</h2>
                    <ICAICascadeSelector value={icai} onChange={setIcai} compact />
                </div>

                <div style={card}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '1rem' }}>📝 Question Details</h2>
                    <div style={{ marginBottom: 16 }}>
                        <label style={lbl}>Question Text *</label>
                        <textarea value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))} rows={4} placeholder="Enter the MCQ question text..." style={{ ...inp, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
                        <div><label style={lbl}>Difficulty</label>
                            <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} style={{ ...inp, appearance: 'none' as any }}>
                                <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option><option value="NONE">No Mention</option>
                            </select>
                        </div>
                        <div><label style={lbl}>Marks</label>
                            <input type="number" min={1} value={form.marks} onChange={e => setForm(f => ({ ...f, marks: parseInt(e.target.value) || 1 }))} style={inp} />
                        </div>
                        <div><label style={lbl}>Status</label>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, appearance: 'none' as any }}>
                                <option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
                            </select>
                        </div>
                        <div><label style={lbl}>Tags</label>
                            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="important, exam" style={inp} />
                        </div>
                    </div>
                </div>

                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>✅ Answer Options</h2>
                        <button type="button" onClick={addOption} disabled={options.length >= 6}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid #4f46e5', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                            <Plus size={14} /> Add Option
                        </button>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#94a3b8' }}>Click the circle to mark an option as correct.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `2px solid ${opt.is_correct ? '#4f46e5' : '#e2e8f0'}`, background: opt.is_correct ? '#eef2ff' : '#f8fafc', transition: 'all 0.15s' }}>
                                <button type="button" onClick={() => setCorrect(i)}
                                    style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${opt.is_correct ? '#4f46e5' : '#cbd5e1'}`, background: opt.is_correct ? '#4f46e5' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                                    {opt.is_correct && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                                </button>
                                <span style={{ fontWeight: 700, color: opt.is_correct ? '#4f46e5' : '#94a3b8', width: 20 }}>{String.fromCharCode(65 + i)}.</span>
                                <input value={opt.text} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.87rem', outline: 'none', color: '#1e293b', fontFamily: 'inherit' }} />
                                {options.length > 2 && (
                                    <button type="button" onClick={() => removeOption(i)}
                                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #fee2e2', background: '#fff1f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={card}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: 0, marginBottom: '1rem' }}>📚 Learning Mode Content</h2>
                    <div style={{ marginBottom: 16 }}>
                        <label style={lbl}>📖 Explanation (shown after answering)</label>
                        <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={3} placeholder="Explain why the correct answer is right..." style={{ ...inp, resize: 'vertical' }} />
                    </div>
                    <div>
                        <label style={lbl}>📚 Related Concept</label>
                        <textarea value={form.related_concept} onChange={e => setForm(f => ({ ...f, related_concept: e.target.value }))} rows={2} placeholder="Link to a related concept..." style={{ ...inp, resize: 'vertical' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => navigate('/admin/mcq-bank')}
                        style={{ padding: '11px 24px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> {isEdit ? 'Update Question' : 'Create Question'}</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
