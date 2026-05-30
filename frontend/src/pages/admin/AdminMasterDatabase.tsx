import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/axios';
import {
    Database, Layers, BookOpen, FileText, ListTree,
    Loader2, Plus, ChevronRight, Search
} from 'lucide-react';
import '@/styles/admin/MasterDatabase.css';
import '@/styles/admin/QuestionManagement.css';

const AdminMasterDatabase = () => {
    const [search, setSearch] = useState('');
    const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
    const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['master-stats'],
        queryFn: async () => (await api.get('/master/stats/')).data,
    });

    const { data: tree = [], isLoading: treeLoading } = useQuery({
        queryKey: ['master-tree'],
        queryFn: async () => (await api.get('/master/tree/')).data,
    });

    const filteredTree = useMemo(() => {
        if (!search.trim()) return tree;
        const q = search.toLowerCase();
        return tree
            .map((level: any) => ({
                ...level,
                papers: level.papers
                    .map((paper: any) => ({
                        ...paper,
                        chapters: paper.chapters.filter(
                            (ch: any) =>
                                ch.name.toLowerCase().includes(q) ||
                                paper.name.toLowerCase().includes(q) ||
                                ch.topics.some((t: any) => t.name.toLowerCase().includes(q))
                        ),
                    }))
                    .filter(
                        (paper: any) =>
                            paper.chapters.length > 0 || paper.name.toLowerCase().includes(q)
                    ),
            }))
            .filter(
                (level: any) =>
                    level.papers.length > 0 || level.name.toLowerCase().includes(q)
            );
    }, [tree, search]);

    useEffect(() => {
        if (filteredTree.length && selectedLevelId === null) {
            const first = filteredTree[0];
            setSelectedLevelId(first.id);
            setSelectedPaperId(first.papers?.[0]?.id ?? null);
        }
    }, [filteredTree, selectedLevelId]);

    const levelId = selectedLevelId ?? filteredTree[0]?.id ?? null;
    const displayLevel = filteredTree.find((l: any) => l.id === levelId);
    const paperId = selectedPaperId ?? displayLevel?.papers?.[0]?.id ?? null;
    const displayPaper = displayLevel?.papers?.find((p: any) => p.id === paperId);

    const statCards = [
        { label: 'CA Levels', value: stats?.levels, icon: Layers, color: 'var(--color-primary-light)' },
        { label: 'Papers', value: stats?.papers, icon: BookOpen, color: 'var(--color-accent)' },
        { label: 'Chapters', value: stats?.chapters, icon: ListTree, color: '#8b5cf6' },
        { label: 'Topics', value: stats?.topics, icon: FileText, color: '#f59e0b' },
        { label: 'Questions', value: stats?.questions, icon: Database, color: 'var(--color-danger)' },
    ];

    return (
        <div className="master-db-container">
            <div className="qm-header">
                <div>
                    <div className="flex items-center gap-2 mb-1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Database size={18} style={{ color: 'var(--color-accent)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)' }}>
                            ICAI Enterprise Master DB
                        </span>
                    </div>
                    <h1 className="page-title">Master Database</h1>
                    <p className="page-subtitle">
                        Complete ICAI structure: CA Level → Paper → Chapter → Topic → Questions
                    </p>
                </div>
                <div className="header-actions">
                    <Link to="/admin/questions/new" className="primary-btn flex-center gap-sm">
                        <Plus size={18} />
                        <span>Add Question</span>
                    </Link>
                </div>
            </div>

            <div className="master-stats-grid">
                {statCards.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className="master-stat-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="stat-label">{s.label}</span>
                                <Icon size={18} style={{ color: s.color, opacity: 0.7 }} />
                            </div>
                            <div className="stat-value">
                                {statsLoading ? '...' : (s.value ?? 0).toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="master-tree-layout">
                <div className="master-tree-panel">
                    <div className="master-tree-toolbar">
                        <div className="search-box" style={{ width: '100%' }}>
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search papers, chapters, topics..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="master-tree-scroll">
                        {treeLoading && (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary-light)' }} />
                            </div>
                        )}
                        {filteredTree.map((level: any) => (
                            <div key={level.id} className="tree-level">
                                <button
                                    type="button"
                                    className={`tree-level-btn ${levelId === level.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedLevelId(level.id);
                                        setSelectedPaperId(level.papers[0]?.id ?? null);
                                    }}
                                >
                                    <span>{level.name}</span>
                                    <span className="tree-paper-meta">{level.paper_count} papers</span>
                                </button>
                                {levelId === level.id &&
                                    level.papers.map((paper: any) => (
                                        <button
                                            key={paper.id}
                                            type="button"
                                            className={`tree-paper-btn ${paperId === paper.id ? 'active' : ''}`}
                                            onClick={() => setSelectedPaperId(paper.id)}
                                        >
                                            <div>{paper.name}</div>
                                            <div className="tree-paper-meta">{paper.chapter_count} chapters</div>
                                        </button>
                                    ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="master-detail-panel">
                    {displayPaper ? (
                        <>
                            <div className="master-detail-header">
                                <h2>{displayPaper.name}</h2>
                                <p>{displayLevel?.name}</p>
                                <div className="breadcrumb-path">
                                    <span>{displayLevel?.name}</span>
                                    <span className="sep">›</span>
                                    <span>{displayPaper.name}</span>
                                    <span className="sep">›</span>
                                    <span>{displayPaper.chapters?.length ?? 0} Chapters</span>
                                </div>
                            </div>
                            <div className="chapter-grid">
                                {displayPaper.chapters?.map((chapter: any) => (
                                    <div key={chapter.id} className="chapter-card">
                                        <h4>{chapter.name}</h4>
                                        <div className="topic-pills">
                                            {chapter.topics?.map((t: any) => (
                                                <span key={t.id} className="topic-pill">{t.name}</span>
                                            ))}
                                        </div>
                                        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                {chapter.question_count ?? 0} questions
                                            </span>
                                            <Link
                                                to={`/admin/questions/new?chapter=${chapter.id}&topic=${chapter.topics?.[0]?.id ?? ''}`}
                                                style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: 4 }}
                                            >
                                                Add Q <ChevronRight size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <ListTree size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>Select a CA level and paper to browse chapters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminMasterDatabase;
