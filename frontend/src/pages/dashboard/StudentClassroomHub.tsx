import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Video, Tv } from 'lucide-react';
import CourseSelection from './CourseSelection';
import LiveClasses from './LiveClasses';
import VideosPage from './VideosPage';

type TabId = 'courses' | 'live' | 'recorded';

export default function StudentClassroomHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'courses';

    const handleTabChange = (tabId: TabId) => {
        setSearchParams({ tab: tabId });
    };

    const tabs = [
        { id: 'courses', label: 'My Courses', icon: BookOpen },
        { id: 'live', label: 'Live Classroom', icon: Video },
        { id: 'recorded', label: 'Recorded Lectures', icon: Tv }
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight">Classroom Hub</h1>
                    <p className="text-text-secondary text-xs font-semibold mt-0.5">Explore your syllabus courses, attend live webinars, and study recorded lectures.</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 self-start md:self-center">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                    isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
                                }`}
                                type="button"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="student-active-tab-indicator"
                                        className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Icon size={16} />
                                    <span>{tab.label}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Display */}
            <div className="w-full">
                {activeTab === 'courses' && <CourseSelection />}
                {activeTab === 'live' && <LiveClasses />}
                {activeTab === 'recorded' && <VideosPage />}
            </div>
        </div>
    );
}
