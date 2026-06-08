import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import '@/styles/admin/MasterDatabase.css';

export interface ICAISelection {
    levelId: string;
    paperId: string;
    chapterId: string;
    topicId: string;
}

interface Props {
    value: ICAISelection;
    onChange: (next: ICAISelection) => void;
    required?: boolean;
    compact?: boolean;
}

export default function ICAICascadeSelector({ value, onChange, required = true, compact = false }: Props) {
    const queryClient = useQueryClient();

    // Inline Chapter addition states
    const [isAddingChapter, setIsAddingChapter] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    const [creatingChapter, setCreatingChapter] = useState(false);

    // Inline Topic addition states
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [creatingTopic, setCreatingTopic] = useState(false);

    const { data: levels = [], isLoading: levelsLoading } = useQuery({
        queryKey: ['icai-levels'],
        queryFn: async () => (await api.get('/master/levels/')).data,
    });

    const { data: papers = [], isLoading: papersLoading } = useQuery({
        queryKey: ['icai-papers', value.levelId],
        queryFn: async () => (await api.get(`/master/papers/?level_id=${value.levelId}`)).data,
        enabled: !!value.levelId,
    });

    const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
        queryKey: ['icai-chapters', value.paperId],
        queryFn: async () => (await api.get(`/master/chapters/?paper_id=${value.paperId}`)).data,
        enabled: !!value.paperId,
    });

    const { data: topics = [], isLoading: topicsLoading } = useQuery({
        queryKey: ['icai-topics', value.chapterId],
        queryFn: async () => (await api.get(`/master/topics/?chapter_id=${value.chapterId}`)).data,
        enabled: !!value.chapterId,
    });

    const set = (patch: Partial<ICAISelection>) => {
        const next = { ...value, ...patch };
        if (patch.levelId !== undefined) {
            next.paperId = '';
            next.chapterId = '';
            next.topicId = '';
        }
        if (patch.paperId !== undefined) {
            next.chapterId = '';
            next.topicId = '';
        }
        if (patch.chapterId !== undefined) {
            next.topicId = '';
        }
        onChange(next);
    };

    // Auto-select Level if only 1 level exists
    useEffect(() => {
        if (!levelsLoading && levels?.length === 1 && !value.levelId) {
            set({ levelId: String(levels[0].id) });
        }
    }, [levels, levelsLoading, value.levelId]);

    // Auto-select Paper if only 1 paper exists
    useEffect(() => {
        if (value.levelId && !papersLoading && papers?.length === 1 && !value.paperId) {
            set({ paperId: String(papers[0].id) });
        }
    }, [papers, papersLoading, value.levelId, value.paperId]);

    // Auto-select Chapter if only 1 chapter exists
    useEffect(() => {
        if (value.paperId && !chaptersLoading && chapters?.length === 1 && !value.chapterId) {
            set({ chapterId: String(chapters[0].id) });
        }
    }, [chapters, chaptersLoading, value.paperId, value.chapterId]);

    // Auto-select Topic if only 1 topic exists
    useEffect(() => {
        if (value.chapterId && !topicsLoading && topics?.length === 1 && !value.topicId) {
            set({ topicId: String(topics[0].id) });
        }
    }, [topics, topicsLoading, value.chapterId, value.topicId]);

    const handleCreateChapter = async () => {
        if (!newChapterName.trim() || !value.paperId) return;
        setCreatingChapter(true);
        try {
            const nextOrder = chapters.length + 1;
            const res = await api.post('/master/chapters/', {
                name: newChapterName.trim(),
                order: nextOrder,
                paper: parseInt(value.paperId, 10),
            });
            await queryClient.invalidateQueries({ queryKey: ['icai-chapters', value.paperId] });
            await queryClient.invalidateQueries({ queryKey: ['master-tree'] });
            await queryClient.invalidateQueries({ queryKey: ['master-stats'] });
            
            set({ chapterId: String(res.data.id) });
            setIsAddingChapter(false);
            setNewChapterName('');
        } catch (err) {
            console.error(err);
            alert('Failed to add chapter. Please try again.');
        } finally {
            setCreatingChapter(false);
        }
    };

    const handleCreateTopic = async () => {
        if (!newTopicName.trim() || !value.chapterId) return;
        setCreatingTopic(true);
        try {
            const nextOrder = topics.length + 1;
            const res = await api.post('/master/topics/', {
                name: newTopicName.trim(),
                order: nextOrder,
                chapter: parseInt(value.chapterId, 10),
            });
            await queryClient.invalidateQueries({ queryKey: ['icai-topics', value.chapterId] });
            await queryClient.invalidateQueries({ queryKey: ['master-tree'] });
            await queryClient.invalidateQueries({ queryKey: ['master-stats'] });
            
            set({ topicId: String(res.data.id) });
            setIsAddingTopic(false);
            setNewTopicName('');
        } catch (err) {
            console.error(err);
            alert('Failed to add topic. Please try again.');
        } finally {
            setCreatingTopic(false);
        }
    };

    const gridClass = compact ? 'icai-cascade compact' : 'icai-cascade';

    return (
        <div className={gridClass}>
            <div className="admin-form-group">
                <label>CA Level {required && '*'}</label>
                <select
                    className="admin-form-input"
                    value={value.levelId}
                    onChange={(e) => set({ levelId: e.target.value })}
                    disabled={levelsLoading}
                >
                    <option value="">Select CA Level...</option>
                    {levels.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                </select>
            </div>
            <div className="admin-form-group">
                <label>Paper {required && '*'}</label>
                <select
                    className="admin-form-input"
                    value={value.paperId}
                    onChange={(e) => set({ paperId: e.target.value })}
                    disabled={!value.levelId || papersLoading}
                >
                    <option value="">Select Paper...</option>
                    {papers.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            <div className="admin-form-group">
                <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Chapter {required && '*'}</label>
                    {value.paperId && !isAddingChapter && (
                        <button
                            type="button"
                            onClick={() => setIsAddingChapter(true)}
                            className="text-[11px] text-blue-600 font-bold hover:underline"
                        >
                            + Quick Add
                        </button>
                    )}
                </div>
                {isAddingChapter ? (
                    <div className="flex gap-1 mt-0.5">
                        <input
                            type="text"
                            placeholder="Chapter name..."
                            value={newChapterName}
                            onChange={(e) => setNewChapterName(e.target.value)}
                            className="admin-form-input flex-1 py-1 px-2 text-xs"
                            style={{ height: '32px' }}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleCreateChapter}
                            disabled={creatingChapter || !newChapterName.trim()}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
                        >
                            {creatingChapter ? '...' : 'Add'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAddingChapter(false); setNewChapterName(''); }}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <select
                        className="admin-form-input"
                        value={value.chapterId}
                        onChange={(e) => set({ chapterId: e.target.value })}
                        disabled={!value.paperId || chaptersLoading}
                    >
                        <option value="">Select Chapter...</option>
                        {chapters.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>
            <div className="admin-form-group">
                <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Topic {required && '*'}</label>
                    {value.chapterId && !isAddingTopic && (
                        <button
                            type="button"
                            onClick={() => setIsAddingTopic(true)}
                            className="text-[11px] text-blue-600 font-bold hover:underline"
                        >
                            + Quick Add
                        </button>
                    )}
                </div>
                {isAddingTopic ? (
                    <div className="flex gap-1 mt-0.5">
                        <input
                            type="text"
                            placeholder="Topic name..."
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            className="admin-form-input flex-1 py-1 px-2 text-xs"
                            style={{ height: '32px' }}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleCreateTopic}
                            disabled={creatingTopic || !newTopicName.trim()}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
                        >
                            {creatingTopic ? '...' : 'Add'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAddingTopic(false); setNewTopicName(''); }}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <select
                        className="admin-form-input"
                        value={value.topicId}
                        onChange={(e) => set({ topicId: e.target.value })}
                        disabled={!value.chapterId || topicsLoading}
                    >
                        <option value="">Select Topic...</option>
                        {topics.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
}
