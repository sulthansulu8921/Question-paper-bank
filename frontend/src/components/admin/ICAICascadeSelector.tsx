import { useQuery } from '@tanstack/react-query';
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
                <label>Chapter {required && '*'}</label>
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
            </div>
            <div className="admin-form-group">
                <label>Topic {required && '*'}</label>
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
            </div>
        </div>
    );
}
