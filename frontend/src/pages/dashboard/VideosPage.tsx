import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Play, Calendar, Clock, Lock, Loader2, X, AlertCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/api/axios';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

interface Video {
    id: number;
    title: string;
    description: string;
    course: number;
    course_name?: string;
    subject: number;
    subject_name?: string;
    file_url?: string;
    duration_seconds: number;
    is_premium: boolean;
    is_locked?: boolean;
    created_at: string;
}

export default function VideosPage() {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [activeVideo, setActiveVideo] = useState<Video | null>(null);
    const { hasVideoAccess, isLoading: subLoading } = useSubscriptionAccess();

    // Fetch videos
    const { data: videos = [], isLoading: isLoadingVideos } = useQuery<Video[]>({
        queryKey: ['student-videos'],
        queryFn: async () => (await api.get('/materials/videos/')).data,
    });

    // Fetch courses list
    const { data: courses = [], isLoading: isLoadingCourses } = useQuery<any[]>({
        queryKey: ['student-courses'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    // Fetch levels list
    const { data: allLevels = [] } = useQuery<any[]>({
        queryKey: ['student-levels'],
        queryFn: async () => (await api.get('/courses/levels/')).data,
    });

    // Reset level when course changes
    useEffect(() => {
        setSelectedLevel('');
    }, [selectedCourse]);

    const activeCourseLevels = allLevels.filter((l: any) => l.course === Number(selectedCourse));

    // Filter videos
    const filteredVideos = videos.filter((item: Video) => {
        if (selectedCourse && item.course !== Number(selectedCourse)) return false;
        if (selectedLevel) {
            const levelSubjects = allLevels.find(l => l.id === Number(selectedLevel))?.subjects || [];
            const isSubjectInLevel = levelSubjects.some((s: any) => s.id === item.subject);
            if (!isSubjectInLevel) return false;
        }
        return true;
    });

    const formatDuration = (seconds: number) => {
        const mins = Math.round(seconds / 60);
        if (mins < 60) return `${mins} Mins`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs} hrs`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Helper to get YouTube Embed URL
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        try {
            // YouTube
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                let videoId = '';
                if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
                } else if (url.includes('v=')) {
                    videoId = url.split('v=')[1]?.split('&')[0];
                } else if (url.includes('embed/')) {
                    videoId = url.split('embed/')[1]?.split(/[?#]/)[0];
                }
                return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
            }
            // Vimeo
            if (url.includes('vimeo.com')) {
                const parts = url.split('/');
                const videoId = parts[parts.length - 1]?.split(/[?#]/)[0];
                return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : url;
            }
        } catch (e) {
            console.error(e);
        }
        return url;
    };

    const isYoutubeOrVimeo = (url?: string) => {
        if (!url) return false;
        return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
    };

    if (isLoadingVideos || isLoadingCourses || subLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Loading Recorded Classes...</p>
            </div>
        );
    }

    // Premium lock gate
    if (!hasVideoAccess) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 min-h-[70vh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg w-full bg-card rounded-[2.5rem] p-10 text-center shadow-xl border border-border relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
                    <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-amber-500">
                        <Lock size={36} />
                    </div>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 inline-block mb-4">
                        Premium Access Required
                    </span>
                    <h2 className="text-2xl font-black text-text-primary mb-3 tracking-tight">Recorded Classes Locked</h2>
                    <p className="text-sm text-text-secondary font-semibold leading-relaxed mb-8 max-w-sm mx-auto">
                        Access our complete library of recorded lectures, doubt-clearing sessions, and expert explanations by subscribing to a premium plan.
                    </p>
                    <div className="space-y-3">
                        <Link
                            to="/dashboard/subscription"
                            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95"
                        >
                            <Sparkles size={16} />
                            <span>Unlock All Classes</span>
                        </Link>
                        <p className="text-[10px] text-text-muted font-semibold">
                            Already subscribed? Your subscription may have expired.{' '}
                            <Link to="/dashboard/subscription" className="text-primary underline">Check status</Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }


    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div>
                <span className="text-primary font-black uppercase tracking-widest text-[10px] mb-2 block">Recorded Lectures</span>
                <h1 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">Recorded Classes</h1>
                <p className="text-text-secondary text-sm font-semibold mt-1">Access previous webinars, classes, and doubt-clearing archives anytime.</p>
            </div>

            {/* Filter Section */}
            <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    {/* Course Filter */}
                    <div className="flex flex-col gap-1 w-full md:w-64">
                        <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Focus Course</label>
                        <select
                            className="bg-bg border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary w-full"
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                        >
                            <option value="">All Courses</option>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Level Filter */}
                    <div className="flex flex-col gap-1 w-full md:w-64">
                        <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Study Level</label>
                        <select
                            className="bg-bg border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary w-full"
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            disabled={!selectedCourse}
                        >
                            <option value="">Choose Level...</option>
                            {activeCourseLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="text-right text-text-muted text-[10px] font-black uppercase tracking-wider self-end md:self-center">
                    {filteredVideos.length} Available Recordings
                </div>
            </div>

            {/* Video List Grid */}
            {filteredVideos.length === 0 ? (
                <div className="bg-card border border-border rounded-[2.5rem] p-16 text-center text-text-muted space-y-4 shadow-sm">
                    <Play className="mx-auto text-text-muted opacity-30" size={54} />
                    <p className="text-sm font-bold uppercase tracking-wider">No Recorded Classes Found</p>
                    <p className="text-xs text-text-secondary">Try adjusting your filters or check back later for newly added recordings.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredVideos.map((item) => {
                        const isLocked = item.is_locked;
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.01] transition-all flex flex-col group relative"
                            >
                                {/* Thumbnail/Icon area */}
                                <div className="h-48 bg-slate-950/90 relative flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/15 opacity-60" />
                                    <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-primary transition-all">
                                        <Play size={24} fill="currentColor" className="ml-1" />
                                    </div>

                                    {/* Lock overlay for premium items */}
                                    {isLocked && (
                                        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4">
                                            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mb-2">
                                                <Lock size={20} />
                                            </div>
                                            <span className="text-xs font-black uppercase text-amber-500 tracking-wider">Premium Class</span>
                                            <span className="text-[10px] text-slate-300 mt-1">Unlocked with Premium Subscription</span>
                                        </div>
                                    )}

                                    {/* Duration Badge */}
                                    <span className="absolute bottom-4 right-4 px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                                        <Clock size={11} /> {formatDuration(item.duration_seconds)}
                                    </span>

                                    {/* Premium Tag if free but subscriber only */}
                                    {!isLocked && item.is_premium && (
                                        <span className="absolute top-4 left-4 px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase tracking-wider">
                                            Premium
                                        </span>
                                    )}
                                </div>

                                {/* Content area */}
                                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded w-fit block">
                                            {item.course_name || 'General Course'}
                                        </span>
                                        <h4 className="text-lg font-black text-text-primary group-hover:text-primary transition-colors line-clamp-1 leading-snug">{item.title}</h4>
                                        <p className="text-text-secondary text-xs font-medium line-clamp-2 leading-relaxed">{item.description || 'No description provided.'}</p>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-border pt-4">
                                        <span className="text-[10px] text-text-muted font-bold flex items-center gap-1"><Calendar size={12} /> {formatDate(item.created_at)}</span>
                                        {isLocked ? (
                                            <Link
                                                to="/dashboard/subscription"
                                                className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-600 flex items-center gap-1"
                                            >
                                                <span>Unlock Class</span>
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => setActiveVideo(item)}
                                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-hover flex items-center gap-1"
                                            >
                                                <span>Watch Now</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Video Player Modal */}
            <AnimatePresence>
                {activeVideo && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-[2.5rem] overflow-hidden max-w-4xl w-full shadow-2xl relative"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-border flex items-center justify-between bg-bg/50">
                                <div>
                                    <span className="text-[9px] font-black uppercase text-primary tracking-widest">{activeVideo.subject_name || 'Lecture Recording'}</span>
                                    <h3 className="text-lg font-black text-text-primary tracking-tight">{activeVideo.title}</h3>
                                </div>
                                <button
                                    onClick={() => setActiveVideo(null)}
                                    className="p-2 text-text-muted hover:text-text-primary hover:bg-bg rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Player viewport */}
                            <div className="bg-black aspect-video relative flex items-center justify-center">
                                {activeVideo.file_url ? (
                                    isYoutubeOrVimeo(activeVideo.file_url) ? (
                                        <iframe
                                            src={getEmbedUrl(activeVideo.file_url)}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            title={activeVideo.title}
                                        />
                                    ) : (
                                        <video
                                            src={activeVideo.file_url}
                                            controls
                                            autoPlay
                                            className="w-full h-full max-h-[60vh] object-contain"
                                        />
                                    )
                                ) : (
                                    <div className="p-10 text-center text-white/60 space-y-2">
                                        <AlertCircle className="mx-auto" size={32} />
                                        <p className="text-sm font-bold">Video Link Not Available</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Description */}
                            {activeVideo.description && (
                                <div className="p-6 bg-slate-50 border-t border-border">
                                    <h5 className="text-[10px] font-black uppercase text-text-muted tracking-wider mb-1">Lecture Overview</h5>
                                    <p className="text-xs text-text-secondary leading-relaxed font-semibold">{activeVideo.description}</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
