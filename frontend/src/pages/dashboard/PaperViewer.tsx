import { ArrowLeft, Download, MessageCircle, Video, X, Lock, Play, Clock, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import QuestionTable from '@/components/dashboard/QuestionTable';
import { useAuthStore } from '@/store/useAuthStore';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';

const SUBJECT_LOOKUP: Record<string, { name: string, code: string }> = {
    '1': { name: 'Advanced Accounting', code: 'PAPER 1' },
    '2': { name: 'Corporate and Other Laws', code: 'PAPER 2' },
    '3': { name: 'Taxation', code: 'PAPER 3' },
    '4': { name: 'Cost and Management Accounting', code: 'PAPER 4' },
    '5': { name: 'Auditing and Ethics', code: 'PAPER 5' },
    '6': { name: 'Financial Management and Strategic Management', code: 'PAPER 6' },
};

const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = '';
            if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0];
            } else if (url.includes('v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('embed/')) {
                videoId = url.split('embed/')[1]?.split('?')[0];
            }
            return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
        }
        if (url.includes('vimeo.com')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : url;
        }
    } catch (e) {
        console.error(e);
    }
    return url;
};

export default function PaperViewer() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const user = useAuthStore((state) => state.user);

    const [showVideoModal, setShowVideoModal] = useState(false);
    const [activeVideo, setActiveVideo] = useState<any>(null);

    // Dynamic Subject Name Fetch
    const { data: subjectDetails } = useQuery({
        queryKey: ['subject-detail', id],
        queryFn: async () => (await api.get(`/courses/subjects/${id}/`)).data,
        enabled: !!id
    });

    // Dynamic Videos Fetch
    const { data: videos = [] } = useQuery({
        queryKey: ['subject-videos', id],
        queryFn: async () => (await api.get('/materials/videos/')).data,
        enabled: !!id
    });

    const subjectName = subjectDetails?.name || (id ? SUBJECT_LOOKUP[id]?.name : 'Subject');
    const subjectVideos = videos.filter((v: any) => String(v.subject) === String(id));

    const isSubscribed = user?.subscription_tier === 'premium' || user?.subscription_tier === 'pro';

    const handlePlayVideo = (video: any) => {
        if (video.is_premium && !isSubscribed) {
            // Locked
            setActiveVideo(video); // Set active so player renders lock screen
        } else {
            setActiveVideo(video);
        }
    };

    return (
        <div className="flex flex-col bg-bg min-h-screen font-sans -m-8 relative text-text-primary">
            {/* Topmost Utility Bar (My Plan / Help / Guest) */}
            <div className="bg-[var(--table-header)] px-10 py-3 flex items-center justify-between shrink-0 text-white text-[11px] font-black uppercase tracking-widest transition-colors duration-200">
                <div className="flex items-center gap-8">
                    <span>My Plan: {user?.subscription_tier || 'Free Account'}</span>
                    <span className="opacity-60 cursor-pointer hover:opacity-100 transition-opacity">Help</span>
                </div>
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    <span>Guest</span>
                </div>
            </div>

            {/* Subject Detail Bar (Deep Blue Bar) */}
            <div className="bg-bg-secondary border-b border-border px-10 py-3 flex items-center justify-between shrink-0 transition-colors duration-200">
                <h2 className="text-sm font-black text-text-primary tracking-wider uppercase">
                    Subject : {subjectName}
                </h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setShowVideoModal(true);
                            if (subjectVideos.length > 0 && !activeVideo) {
                                handlePlayVideo(subjectVideos[0]);
                            }
                        }}
                        className="p-1.5 px-4 bg-primary hover:bg-primary-dark rounded-xl text-white font-bold flex items-center gap-2 text-xs transition-all shadow-sm"
                    >
                        <Video size={16} />
                        <span>Video Lectures</span>
                        {subjectVideos.length > 0 && (
                            <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black">
                                {subjectVideos.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 p-8">
                <div className="max-w-full">
                    {/* The Table (Self-contained viewer & navigation) */}
                    <QuestionTable />
                </div>
            </main>

            {/* Footer for professional look */}
            <footer className="bg-card border-t border-border px-10 py-6 flex items-center justify-between shrink-0 transition-colors duration-200">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">QB</div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">qubook.in v3.0 Educational Portal</p>
                </div>
                <div className="flex items-center gap-8 text-[10px] font-black text-text-muted uppercase tracking-widest">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 hover:text-primary transition-colors">
                        <ArrowLeft size={14} /> Back to Hub
                    </button>
                    <div className="h-4 w-[1px] bg-border" />
                    <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <Download size={14} /> Download PDF
                    </button>
                    <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <MessageCircle size={14} /> Support
                    </button>
                </div>
            </footer>

            {/* Video Lectures Modal */}
            {showVideoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-bg-secondary border-b border-border flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Video size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-text-primary tracking-wide uppercase">Video Lectures</h3>
                                    <p className="text-xs text-text-muted">{subjectName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowVideoModal(false);
                                    setActiveVideo(null);
                                }}
                                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                            {/* Left: Player Area */}
                            <div className="flex-1 bg-black flex flex-col justify-center items-center relative min-w-0">
                                {activeVideo ? (
                                    activeVideo.is_premium && !isSubscribed ? (
                                        // Premium locked screen
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-8 z-10">
                                            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 animate-bounce">
                                                <Lock size={32} />
                                            </div>
                                            <h4 className="text-lg font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <Sparkles size={18} className="text-amber-500" />
                                                Premium Video Lecture
                                            </h4>
                                            <p className="text-sm text-slate-400 max-w-md mb-6 font-medium leading-relaxed">
                                                This lecture is reserved for Qubook Premium members. Subscribe to unlock all recorded video lectures, question banks, and notes.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setShowVideoModal(false);
                                                    navigate('/dashboard/subscription');
                                                }}
                                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20"
                                            >
                                                Subscribe to Premium
                                            </button>
                                        </div>
                                    ) : (
                                        // Active video iframe/video player
                                        <div className="w-full h-full">
                                            <iframe
                                                src={getEmbedUrl(activeVideo.file_url)}
                                                title={activeVideo.title}
                                                className="w-full h-full border-none"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                            />
                                        </div>
                                    )
                                ) : (
                                    // Empty state
                                    <div className="text-center p-8">
                                        <Video size={48} className="text-slate-800 mb-3 mx-auto" />
                                        <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Select a lecture from the list to start watching</p>
                                    </div>
                                )}
                            </div>

                            {/* Right: Lectures List */}
                            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border flex flex-col min-h-0 bg-bg-secondary shrink-0">
                                <div className="p-4 border-b border-border bg-card shrink-0">
                                    <span className="text-xs font-black text-text-primary uppercase tracking-widest">Lectures Index</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {subjectVideos.length === 0 ? (
                                        <div className="text-center py-12 px-4 text-xs text-text-muted italic">
                                            No recorded video lectures available for this subject yet.
                                        </div>
                                    ) : (
                                        subjectVideos.map((video: any, idx: number) => {
                                            const isActive = activeVideo?.id === video.id;
                                            return (
                                                <button
                                                    key={video.id}
                                                    onClick={() => handlePlayVideo(video)}
                                                    className={`w-full text-left p-3 rounded-2xl border transition-all flex gap-3 items-start ${
                                                        isActive
                                                            ? 'bg-primary/5 border-primary shadow-sm'
                                                            : 'bg-card border-border hover:border-text-muted'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
                                                        isActive ? 'bg-primary text-white' : 'bg-bg text-text-muted'
                                                    }`}>
                                                        {video.is_premium && !isSubscribed ? (
                                                            <Lock size={14} className="text-amber-500" />
                                                        ) : (
                                                            <Play size={14} fill={isActive ? "currentColor" : "none"} />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-black text-text-primary line-clamp-1">
                                                            {idx + 1}. {video.title}
                                                        </div>
                                                        {video.description && (
                                                            <div className="text-[10px] text-text-muted line-clamp-2 mt-0.5 font-medium leading-normal">
                                                                {video.description}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3 mt-2 text-[9px] font-black uppercase text-text-muted tracking-wider">
                                                            {video.duration_seconds ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={10} />
                                                                    {Math.round(video.duration_seconds / 60)} mins
                                                                </span>
                                                            ) : null}
                                                            {video.is_premium ? (
                                                                <span className="text-amber-500 font-extrabold flex items-center gap-0.5">
                                                                    <Sparkles size={10} /> Premium
                                                                </span>
                                                            ) : (
                                                                <span className="text-emerald-500">Free</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
