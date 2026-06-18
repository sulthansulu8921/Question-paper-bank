import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Video, Calendar, Clock, ExternalLink, Loader2, Lock, Sparkles } from 'lucide-react';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { Link } from 'react-router-dom';


interface LiveClass {
    id: number;
    title: string;
    description: string;
    course: number;
    course_name?: string;
    level?: number;
    level_name?: string;
    subject: number;
    subject_name?: string;
    scheduled_time: string;
    duration_minutes: number;
    meeting_link: string;
    is_active: boolean;
}

export default function LiveClasses() {
    const user = useAuthStore((state) => state.user);
    const [selectedCourse, setSelectedCourse] = useState<string>(user?.selected_course?.toString() || '');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const { hasLiveClassAccess, isLoading: subLoading } = useSubscriptionAccess();

    // Prepopulate selectedCourse when user changes
    useEffect(() => {
        if (user?.selected_course) {
            setSelectedCourse(user.selected_course.toString());
        }
    }, [user?.selected_course]);

    // Fetch live classes
    const { data: liveClasses = [], isLoading: isLoadingClasses } = useQuery<LiveClass[]>({
        queryKey: ['student-live-classes'],
        queryFn: async () => (await api.get('/materials/live-classes/')).data,
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

    // Filter live classes
    const filteredClasses = liveClasses.filter((item: any) => {
        if (!item.is_active) return false;
        
        // Locked course constraint:
        if (user?.selected_course) {
            if (item.course && item.course !== Number(user.selected_course)) {
                return false;
            }
        } else {
            if (selectedCourse && item.course !== Number(selectedCourse)) {
                return false;
            }
        }
        
        if (selectedLevel && item.level !== Number(selectedLevel)) return false;
        return true;
    });

    const upcomingClasses = filteredClasses
        .filter((item) => new Date(item.scheduled_time) > new Date())
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

    const pastClasses = filteredClasses
        .filter((item) => new Date(item.scheduled_time) <= new Date())
        .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

    // Next upcoming class for the countdown banner
    const nextClass = upcomingClasses[0];

    // Countdown state for next class
    const [timeLeft, setTimeLeft] = useState<string>('');
    useEffect(() => {
        if (!nextClass) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const target = new Date(nextClass.scheduled_time).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft('Class has started!');
                return;
            }

            const hrs = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${hrs}h ${mins}m ${secs}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [nextClass]);

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoadingClasses || isLoadingCourses || subLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Loading Live Classroom...</p>
            </div>
        );
    }

    if (!hasLiveClassAccess) {
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
                    <h2 className="text-2xl font-black text-text-primary mb-3 tracking-tight">Live Classes Locked</h2>
                    <p className="text-sm text-text-secondary font-semibold leading-relaxed mb-8 max-w-sm mx-auto">
                        Attend live online mentorship sessions, interactive webinars, and real-time doubt clearing. Subscribe to a premium plan to unlock.
                    </p>
                    <div className="space-y-3">
                        <Link
                            to="/dashboard/subscription"
                            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95"
                        >
                            <Sparkles size={16} />
                            <span>Unlock Live Classes</span>
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
                <span className="text-primary font-black uppercase tracking-widest text-[10px] mb-2 block">Interactive Webinars</span>
                <h1 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">Live Classes</h1>
                <p className="text-text-secondary text-sm font-semibold mt-1">Attend live mentoring, clarify doubts in real time, and view schedule updates.</p>
            </div>

            {/* Next Class Countdown Widget */}
            {nextClass && (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#5B4BFF] via-[#7C6EFF] to-[#A49CFF] p-6 sm:p-8 md:p-12 text-white shadow-2xl"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-center">
                        <div className="lg:col-span-8 space-y-4">
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" /> Next Session Starting
                            </span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">{nextClass.title}</h2>
                            <p className="text-white/80 text-xs sm:text-sm font-semibold max-w-xl leading-relaxed">{nextClass.description || 'Join our interactive study track. Grab your study materials and click join to connect.'}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-white/90 pt-2">
                                <span className="flex items-center gap-1.5 bg-black/15 px-3 py-1.5 rounded-xl"><Calendar size={14} /> {formatDateTime(nextClass.scheduled_time)}</span>
                                <span className="flex items-center gap-1.5 bg-black/15 px-3 py-1.5 rounded-xl"><Clock size={14} /> {nextClass.duration_minutes} Minutes</span>
                            </div>
                        </div>

                        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-black/10 border border-white/15 p-5 sm:p-6 rounded-2xl backdrop-blur-lg space-y-4">
                            <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">Countdown Timer</span>
                            <div className="text-2xl sm:text-3xl md:text-4xl font-mono font-black tracking-tight text-white">{timeLeft || '00:00:00'}</div>
                            <a
                                href={nextClass.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 sm:py-3 bg-white hover:bg-slate-50 text-indigo-700 rounded-xl text-center text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
                            >
                                <span>Join Now</span>
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Filter Section */}
            <div className="bg-card border border-border p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    {/* Course Filter */}
                    {user?.selected_course ? (
                        <div className="flex flex-col gap-1 w-full md:w-64">
                            <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Active Course</label>
                            <div className="bg-bg/50 border border-border/80 rounded-xl px-4 py-2.5 text-xs font-black text-primary uppercase tracking-wide flex items-center h-[38px] select-none">
                                {user.selected_course_name || 'Active Program'}
                            </div>
                        </div>
                    ) : (
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
                    )}

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
                    {filteredClasses.length} Available Classes
                </div>
            </div>

            {/* Sessions Lists */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Upcoming classes */}
                <div className="xl:col-span-8 space-y-6">
                    <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" /> Upcoming Classes
                    </h3>

                    {upcomingClasses.length === 0 ? (
                        <div className="bg-card border border-border rounded-[2rem] p-12 text-center text-text-muted space-y-4">
                            <Video className="mx-auto text-text-muted opacity-40" size={48} />
                            <p className="text-sm font-bold uppercase tracking-wider">No Upcoming Sessions Scheduled</p>
                            <p className="text-xs text-text-secondary">Please check back later or modify your filter settings.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingClasses.map((item) => (
                                <div key={item.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 px-2 py-0.5 rounded">
                                                {item.course_name || 'Global'}
                                            </span>
                                            {item.level_name && (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-0.5 rounded font-bold">
                                                    {item.level_name}
                                                </span>
                                            )}
                                            {item.subject_name && (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 text-amber-600 px-2 py-0.5 rounded font-bold">
                                                    {item.subject_name}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-black text-text-primary leading-snug">{item.title}</h4>
                                        <p className="text-text-secondary text-xs font-medium line-clamp-2 leading-relaxed">{item.description}</p>
                                        <div className="flex items-center gap-4 text-xs font-bold text-text-muted pt-1">
                                            <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDateTime(item.scheduled_time)}</span>
                                            <span className="flex items-center gap-1.5"><Clock size={13} /> {item.duration_minutes} Mins</span>
                                        </div>
                                    </div>
                                    <a
                                        href={item.meeting_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full md:w-auto py-2.5 px-6 bg-primary hover:bg-primary-hover text-white rounded-xl text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 self-stretch md:self-center transition-colors shrink-0"
                                    >
                                        <span>Join Class</span>
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Past classes */}
                <div className="xl:col-span-4 space-y-6">
                    <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400" /> Past Sessions
                    </h3>

                    {pastClasses.length === 0 ? (
                        <div className="bg-card border border-border rounded-[2rem] p-8 text-center text-text-muted">
                            <p className="text-xs font-bold uppercase tracking-wider">No Past Sessions Recorded</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pastClasses.slice(0, 5).map((item) => (
                                <div key={item.id} className="bg-card/60 border border-border rounded-2xl p-5 space-y-2 opacity-75">
                                    <span className="text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded">Ended</span>
                                    <h4 className="text-sm font-black text-text-primary leading-tight">{item.title}</h4>
                                    <div className="text-[10px] text-text-muted font-semibold">
                                        Ended on: {new Date(item.scheduled_time).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
