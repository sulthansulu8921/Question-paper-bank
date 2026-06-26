import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import api from '@/api/axios';
import { 
  Play, Pause, X, Settings, Clock, Award, Zap, Flame, 
  Volume2, VolumeX, BarChart3, Sparkles, BrainCircuit, CheckCircle, 
  ArrowRight, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Motivational quotes rotation
const MOTIVATIONAL_QUOTES = [
  "Focus is a muscle, and you are building it right now.",
  "Small daily improvements over time lead to stunning results.",
  "Your future self will thank you for the effort you put in today.",
  "Deep work isn't about working harder; it's about eliminating distractions.",
  "The secret of getting ahead is getting started.",
  "Consistency is what transforms average into excellence.",
  "Only those who dare to fail greatly can ever achieve greatly.",
  "Energy and persistence conquer all things."
];

export default function LearningTimerPage() {
  const {
    activeSession,
    timerSettings,
    timerAnalytics,
    timerAIInsights,
    secondsElapsed,
    setSecondsElapsed,
    fetchActiveSession,
    startStudySession,
    pauseStudySession,
    resumeStudySession,
    endStudySession,
    cancelStudySession,
    fetchTimerSettings,
    updateTimerSettings,
    fetchTimerAnalytics,
    fetchTimerAIInsights,
    streak
  } = useDashboardStore();

  // Page level tabs: 'timer' or 'analytics'
  const [activeTab, setActiveTab] = useState<'timer' | 'analytics'>('timer');

  // Setup form states
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedTopicId, setSelectedTopicId] = useState<number | ''>('');
  const [studyGoal, setStudyGoal] = useState('');
  const [sessionType, setSessionType] = useState('STOPWATCH');
  const [customTargetDuration, setCustomTargetDuration] = useState(25); // minutes
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active Timer states
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [endResult, setEndResult] = useState<any>(null);

  // Load subjects
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await api.get('/courses/subjects/');
        setSubjects(res.data);
      } catch (err) {
        console.error("Failed to load subjects", err);
      }
    };
    loadSubjects();
    fetchActiveSession();
    fetchTimerSettings();
  }, [fetchActiveSession, fetchTimerSettings]);

  // Load topics when subject changes
  useEffect(() => {
    if (selectedSubjectId) {
      const loadTopics = async () => {
        try {
          const res = await api.get(`/courses/topics/?subject_id=${selectedSubjectId}`);
          setTopics(res.data);
        } catch (err) {
          console.error("Failed to load topics", err);
        }
      };
      loadTopics();
    } else {
      setTopics([]);
      setSelectedTopicId('');
    }
  }, [selectedSubjectId]);

  // Handle active session loading on mount/refresh
  useEffect(() => {
    if (activeSession) {
      setSecondsElapsed(activeSession.duration);
      setIsTimerRunning(activeSession.status === 'ACTIVE');
      setStudyGoal(activeSession.study_goal || '');
      setSessionType(activeSession.session_type);
      if (activeSession.subject) setSelectedSubjectId(activeSession.subject);
      if (activeSession.topic) setSelectedTopicId(activeSession.topic);
    } else {
      setIsTimerRunning(false);
    }
  }, [activeSession]);

  // Before unload confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = 'You have a study timer running. Leaving the page might pause or disrupt the tracking.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeSession]);

  // Rotate quotes
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
      setCurrentQuote(MOTIVATIONAL_QUOTES[index]);
    }, 45000);
    return () => clearInterval(quoteInterval);
  }, []);

  // Audio cues trigger for targets completion
  useEffect(() => {
    if (activeSession && isTimerRunning) {
      let targetSec = 0;
      if (sessionType === 'POMODORO') {
        targetSec = timerSettings?.pomodoro_work_duration || 1500;
      } else if (sessionType === 'CUSTOM') {
        targetSec = customTargetDuration * 60;
      } else if (sessionType === 'COUNTDOWN') {
        targetSec = activeSession.target_duration || 0;
      }

      if (targetSec > 0 && secondsElapsed === targetSec) {
        triggerSound('success');
      }
    }
  }, [secondsElapsed, activeSession, isTimerRunning, sessionType, timerSettings, customTargetDuration]);

  // Play synthetic tones
  const triggerSound = (type: 'bell' | 'beep' | 'success') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'bell') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 1.2);
      } else if (type === 'beep') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'success') {
        const now = audioCtx.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, now);
        oscillator.frequency.setValueAtTime(659.25, now + 0.12);
        oscillator.frequency.setValueAtTime(783.99, now + 0.24);
        oscillator.frequency.setValueAtTime(1046.5, now + 0.36);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        oscillator.start();
        oscillator.stop(now + 0.7);
      }
    } catch (e) {
      console.error("Audio synthesis blocked/failed", e);
    }
  };

  // Actions
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSetupLoading(true);
    try {
      let targetSec = 0;
      if (sessionType === 'POMODORO') {
        targetSec = timerSettings?.pomodoro_work_duration || 1500;
      } else if (sessionType === 'DEEP_FOCUS') {
        targetSec = 3600; // 1 hour default deep focus
      } else if (sessionType === 'CUSTOM') {
        targetSec = customTargetDuration * 60;
      }

      await startStudySession({
        subject_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        topic_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        study_goal: studyGoal,
        session_type: sessionType,
        target_duration: targetSec
      });
      triggerSound('bell');
    } catch (err) {
      console.error("Failed to start session", err);
    } finally {
      setIsSetupLoading(false);
    }
  };

  const handlePause = async () => {
    if (!activeSession) return;
    try {
      await pauseStudySession(activeSession.id);
      setIsTimerRunning(false);
      triggerSound('beep');
    } catch (err) {
      console.error("Failed to pause", err);
    }
  };

  const handleResume = async () => {
    if (!activeSession) return;
    try {
      await resumeStudySession(activeSession.id);
      setIsTimerRunning(true);
      triggerSound('bell');
    } catch (err) {
      console.error("Failed to resume", err);
    }
  };

  const handleOpenEndModal = () => {
    setShowEndModal(true);
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      const summary = await endStudySession(activeSession.id, { notes: sessionNotes });
      setEndResult(summary);
      setShowEndModal(false);
      triggerSound('success');
    } catch (err) {
      console.error("Failed to end session", err);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (confirm("Are you sure you want to cancel? No study duration or rewards will be logged.")) {
      try {
        await cancelStudySession(activeSession.id);
        setSecondsElapsed(0);
        setIsTimerRunning(false);
        triggerSound('beep');
      } catch (err) {
        console.error("Failed to cancel", err);
      }
    }
  };

  // Target values computations
  const getTargetDuration = () => {
    if (sessionType === 'POMODORO') return timerSettings?.pomodoro_work_duration || 1500;
    if (sessionType === 'DEEP_FOCUS') return 3600;
    if (sessionType === 'CUSTOM') return customTargetDuration * 60;
    return 0; // Stopwatch has no target
  };

  const targetSec = getTargetDuration();
  const progressRatio = targetSec > 0 ? Math.min(secondsElapsed / targetSec, 1) : 0;
  const isTargetCompleted = targetSec > 0 && secondsElapsed >= targetSec;

  // Time formatters
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [
      h > 0 ? String(h).padStart(2, '0') : null,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // Live rewards calculation
  const liveXp = Math.max(Math.floor(secondsElapsed / 60), 0) + (isTargetCompleted ? Math.floor(targetSec / 300) : 0);
  const liveCoins = Math.max(Math.floor(secondsElapsed / 300), 0) + (isTargetCompleted ? 1 : 0);

  // Settings modification
  const [pomWorkMin, setPomWorkMin] = useState(25);
  const [pomBreakMin, setPomBreakMin] = useState(5);

  const openSettings = () => {
    if (timerSettings) {
      setPomWorkMin(timerSettings.pomodoro_work_duration / 60);
      setPomBreakMin(timerSettings.pomodoro_break_duration / 60);
    }
    setShowSettingsModal(true);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateTimerSettings({
        pomodoro_work_duration: pomWorkMin * 60,
        pomodoro_break_duration: pomBreakMin * 60
      });
      setShowSettingsModal(false);
      triggerSound('success');
    } catch (err) {
      console.error(err);
    }
  };

  // Load analytics when analytics tab is clicked
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchTimerAnalytics();
      fetchTimerAIInsights();
    }
  }, [activeTab, fetchTimerAnalytics, fetchTimerAIInsights]);

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24 space-y-6">
      {/* Header and Toggle Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary flex items-center gap-2 tracking-tight">
            <Clock className="text-primary animate-pulse" size={32} />
            Learning Timer
          </h1>
          <p className="text-text-muted text-sm font-bold mt-1">Focus deep, track time, and earn academic progression rewards.</p>
        </div>

        <div className="flex bg-sidebar border border-border p-1 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('timer')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'timer' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Clock size={14} />
            Timer Setup
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-primary'}`}
          >
            <BarChart3 size={14} />
            Analytics & Coach
          </button>
        </div>
      </div>

      {activeTab === 'timer' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Workspace (Timer or Setup form) */}
          <div className="lg:col-span-8 bg-sidebar border border-border rounded-3xl p-8 shadow-sm relative overflow-hidden min-h-[500px] flex flex-col justify-between">
            {/* Header controls inside workspace */}
            <div className="flex items-center justify-between w-full mb-6 border-b border-border/50 pb-4">
              <span className="text-[10px] font-black tracking-widest text-text-muted uppercase flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeSession ? 'bg-emerald-500 animate-ping' : 'bg-text-muted'}`} />
                {activeSession ? `${sessionType.replace('_', ' ')} Mode` : 'Setup Session'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2.5 rounded-xl border border-border transition-colors ${soundEnabled ? 'text-primary hover:bg-primary/5' : 'text-text-muted hover:bg-bg'}`}
                  title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  disabled={!!activeSession}
                  className="p-2.5 rounded-xl border border-border text-text-muted hover:text-text-primary hover:bg-bg disabled:opacity-50"
                  title="Timer Configuration"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            {!activeSession && !endResult ? (
              /* Setup View Form */
              <form onSubmit={handleStart} className="space-y-6 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-text-primary uppercase tracking-wider">Select Subject</label>
                  <select
                    required
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-bg border border-border px-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-text-primary uppercase tracking-wider">Select Topic</label>
                  <select
                    required
                    disabled={!selectedSubjectId}
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-bg border border-border px-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:bg-bg/40"
                  >
                    <option value="">-- Choose Topic --</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-text-primary uppercase tracking-wider">Study Goal / Focus Task</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ReadInd AS 16 Notes / Complete Practice Set"
                    value={studyGoal}
                    onChange={(e) => setStudyGoal(e.target.value)}
                    className="w-full bg-bg border border-border px-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-text-primary uppercase tracking-wider block">Session Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { type: 'STOPWATCH', label: 'Stopwatch' },
                      { type: 'POMODORO', label: 'Pomodoro' },
                      { type: 'DEEP_FOCUS', label: 'Deep Focus' },
                      { type: 'CUSTOM', label: 'Custom Timer' }
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setSessionType(item.type)}
                        className={`py-3.5 px-3 rounded-2xl border text-xs font-black transition-all ${sessionType === item.type ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-bg/50 border-border text-text-muted hover:text-text-primary hover:bg-bg'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sessionType === 'CUSTOM' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-text-primary uppercase tracking-wider block">Target Duration (Minutes)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={480}
                        value={customTargetDuration}
                        onChange={(e) => setCustomTargetDuration(Math.max(1, Number(e.target.value)))}
                        className="w-24 bg-bg border border-border px-4 py-3 rounded-2xl text-sm font-black text-center"
                      />
                      <span className="text-xs font-bold text-text-muted">minutes focus block</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSetupLoading}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-4 px-6 rounded-2xl text-sm font-black shadow-[0_0_24px_rgba(var(--primary-rgb),0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isSetupLoading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      Start Learning Block
                    </>
                  )}
                </button>
              </form>
            ) : endResult ? (
              /* Session Completion Dialog */
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto py-8 space-y-6">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-2 animate-bounce">
                  <CheckCircle size={44} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-text-primary tracking-tight">Focus Block Completed!</h3>
                  <p className="text-text-muted text-xs font-bold mt-1">Excellent consistency. You successfully logged your learning session.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full bg-bg border border-border p-5 rounded-3xl">
                  <div className="text-center p-3 border-r border-border/60">
                    <p className="text-[10px] font-black text-text-muted uppercase">Duration</p>
                    <p className="text-xl font-black text-text-primary mt-1">{formatTime(endResult.duration)}</p>
                  </div>
                  <div className="text-center p-3">
                    <p className="text-[10px] font-black text-text-muted uppercase">Focus Accuracy</p>
                    <p className="text-xl font-black text-primary mt-1">{endResult.focus_score}%</p>
                  </div>
                  <div className="text-center p-3 border-t border-border/60 border-r border-border/60 pt-4">
                    <p className="text-[10px] font-black text-text-muted uppercase">XP Earned</p>
                    <p className="text-xl font-black text-amber-500 flex items-center justify-center gap-1 mt-1">
                      <Zap size={16} fill="currentColor" />
                      +{endResult.xp_earned}
                    </p>
                  </div>
                  <div className="text-center p-3 border-t border-border/60 pt-4">
                    <p className="text-[10px] font-black text-text-muted uppercase">Coins Earned</p>
                    <p className="text-xl font-black text-amber-500 flex items-center justify-center gap-1 mt-1">
                      <Award size={16} />
                      +{endResult.coins_earned}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEndResult(null);
                    setStudyGoal('');
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 px-6 rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2"
                >
                  Setup New Session
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              /* Active Timer Focus View */
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                {/* SVG Progress Ring */}
                <div className="relative w-72 h-72 mb-8 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Background Circle */}
                    <circle
                      cx="144"
                      cy="144"
                      r="120"
                      className="stroke-bg fill-none"
                      strokeWidth="10"
                    />
                    {/* Foreground Circle */}
                    <motion.circle
                      cx="144"
                      cy="144"
                      r="120"
                      className="stroke-primary fill-none"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 120}
                      strokeDashoffset={2 * Math.PI * 120 * (1 - (targetSec > 0 ? progressRatio : 0))}
                      strokeLinecap="round"
                      transition={{ duration: 0.5, ease: "linear" }}
                    />
                  </svg>

                  {/* Text Centered inside Ring */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      {isTimerRunning ? 'Studying' : 'Paused'}
                    </p>
                    <h2 className="text-4xl font-black tracking-tight text-text-primary my-1 select-none font-mono">
                      {formatTime(secondsElapsed)}
                    </h2>
                    {targetSec > 0 && (
                      <p className="text-[10px] font-bold text-text-muted mt-0.5">
                        Target: {formatTime(targetSec)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subject / Goal Metadata Panel */}
                <div className="max-w-md bg-bg border border-border p-4.5 rounded-3xl w-full mb-8 space-y-2">
                  <p className="text-xs font-black text-text-primary">
                    {activeSession.subject_name} <span className="text-text-muted">/</span> {activeSession.topic_name}
                  </p>
                  {studyGoal && (
                    <p className="text-xs text-text-muted italic font-bold">
                      Goal: &ldquo;{studyGoal}&rdquo;
                    </p>
                  )}
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-4">
                  {/* Pause / Resume */}
                  {isTimerRunning ? (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Pause size={14} fill="currentColor" />
                      Pause Session
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="bg-primary hover:bg-primary-hover text-white font-black px-8 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Play size={14} fill="currentColor" />
                      Resume Session
                    </button>
                  )}

                  {/* Stop / End */}
                  <button
                    type="button"
                    onClick={handleOpenEndModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <CheckCircle size={14} />
                    Complete
                  </button>

                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={handleCancelSession}
                    className="bg-danger/10 text-danger hover:bg-danger/20 font-black p-3.5 rounded-2xl text-xs transition-colors"
                    title="Cancel block"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Motivational Quote Banner */}
            <div className="border-t border-border/50 pt-4 text-center mt-6">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Coach Whisper</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentQuote}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs text-text-muted font-bold italic"
                >
                  &ldquo;{currentQuote}&rdquo;
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar Widget Panels (Streak & Live Progression details) */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Streak status widget */}
            <div className="bg-sidebar border border-border rounded-3xl p-6 shadow-sm">
              <h4 className="text-xs font-black text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Flame className="text-orange-500" size={16} fill="currentColor" />
                Streak Status
              </h4>
              <div className="flex items-center gap-4 bg-bg border border-border p-4 rounded-2xl">
                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                  <Flame size={24} fill="currentColor" />
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary">{streak?.current_streak || 0} Days</p>
                  <p className="text-[10px] font-bold text-text-muted">Longest streak: {streak?.longest_streak || 0} days</p>
                </div>
              </div>
            </div>

            {/* Live Session rewards statistics panel */}
            <div className="bg-sidebar border border-border rounded-3xl p-6 shadow-sm">
              <h4 className="text-xs font-black text-text-primary uppercase tracking-wider mb-4">Live XP & Coins Progress</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Zap className="text-amber-500" size={16} fill="currentColor" />
                    <span className="text-xs font-bold text-text-muted">Estimated XP</span>
                  </div>
                  <span className="text-sm font-black text-text-primary">+{liveXp} XP</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Award className="text-amber-500" size={16} />
                    <span className="text-xs font-bold text-text-muted">Estimated Coins</span>
                  </div>
                  <span className="text-sm font-black text-text-primary">+{liveCoins} Coins</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <Clock className="text-primary" size={16} />
                    <span className="text-xs font-bold text-text-muted">Today Study Time</span>
                  </div>
                  <span className="text-sm font-black text-text-primary">
                    {formatTime(secondsElapsed)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Stats & AI Coach Insights View */
        <div className="space-y-8">
          {/* General study timer metrics */}
          {timerAnalytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-sidebar border border-border p-5 rounded-3xl">
                <p className="text-[9px] font-black text-text-muted uppercase">Today study time</p>
                <p className="text-2xl font-black text-text-primary mt-1.5">{timerAnalytics.today_minutes}m</p>
              </div>
              <div className="bg-sidebar border border-border p-5 rounded-3xl">
                <p className="text-[9px] font-black text-text-muted uppercase">Weekly hours</p>
                <p className="text-2xl font-black text-text-primary mt-1.5">{timerAnalytics.weekly_hours} hrs</p>
              </div>
              <div className="bg-sidebar border border-border p-5 rounded-3xl">
                <p className="text-[9px] font-black text-text-muted uppercase">Total sessions</p>
                <p className="text-2xl font-black text-text-primary mt-1.5">{timerAnalytics.session_count}</p>
              </div>
              <div className="bg-sidebar border border-border p-5 rounded-3xl">
                <p className="text-[9px] font-black text-text-muted uppercase">Productivity Score</p>
                <p className="text-2xl font-black text-primary mt-1.5">{timerAnalytics.productivity_score}%</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-6">
              <RefreshCw className="animate-spin text-primary" size={24} />
            </div>
          )}

          {/* Subject hour breakdown and AI Coach insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Subject breakdown column */}
            <div className="lg:col-span-5 bg-sidebar border border-border p-6 rounded-3xl">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                Subject Distribution
              </h3>
              {timerAnalytics?.subject_hours && timerAnalytics.subject_hours.length > 0 ? (
                <div className="space-y-4">
                  {timerAnalytics.subject_hours.map((sh: any) => (
                    <div key={sh.subject} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-text-primary">
                        <span>{sh.subject}</span>
                        <span>{sh.hours} hrs</span>
                      </div>
                      <div className="w-full bg-bg h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(sh.hours * 20, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs font-bold text-text-muted py-8">No subjects tracked yet.</p>
              )}
            </div>

            {/* AI coach insights card */}
            <div className="lg:col-span-7 bg-sidebar border border-border p-6 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 animate-pulse" />
                AI Study Coach Insights
              </h3>
              
              {timerAIInsights ? (
                <div className="space-y-5">
                  <div className="bg-bg border border-border p-4.5 rounded-2xl">
                    <h5 className="text-[10px] font-black text-primary uppercase">Best study window</h5>
                    <p className="text-xs font-black text-text-primary mt-1">{timerAIInsights.best_study_time}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg border border-border p-4.5 rounded-2xl">
                      <h5 className="text-[10px] font-black text-orange-500 uppercase">Attention Required</h5>
                      <p className="text-xs font-black text-text-primary mt-1 truncate">{timerAIInsights.weak_subjects}</p>
                    </div>
                    <div className="bg-bg border border-border p-4.5 rounded-2xl">
                      <h5 className="text-[10px] font-black text-emerald-500 uppercase">Suggested break style</h5>
                      <p className="text-xs font-black text-text-primary mt-1 truncate">{timerAIInsights.suggested_break_time}</p>
                    </div>
                  </div>

                  <div className="bg-bg border border-border p-4.5 rounded-2xl">
                    <h5 className="text-[10px] font-black text-amber-500 uppercase">Actionable Daily Recommendation</h5>
                    <p className="text-xs font-bold text-text-primary mt-1.5 leading-relaxed">{timerAIInsights.daily_recommendation}</p>
                  </div>

                  <div className="bg-bg border border-border p-4.5 rounded-2xl">
                    <h5 className="text-[10px] font-black text-primary uppercase">Revision focus alert</h5>
                    <p className="text-xs font-bold text-text-primary mt-1.5 leading-relaxed">{timerAIInsights.revision_reminder}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <BrainCircuit className="animate-pulse text-amber-500" size={32} />
                  <p className="text-xs font-bold text-text-muted">Coach is formulating insights based on history...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal Dialog */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-sidebar border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h3 className="font-black text-sm text-text-primary uppercase tracking-wider">Timer settings</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveSettings} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-text-primary uppercase tracking-wider block">Pomodoro work blocks (min)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={pomWorkMin}
                  onChange={(e) => setPomWorkMin(Number(e.target.value))}
                  className="w-full bg-bg border border-border px-4 py-3 rounded-2xl text-sm font-black focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-text-primary uppercase tracking-wider block">Pomodoro break duration (min)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={pomBreakMin}
                  onChange={(e) => setPomBreakMin(Number(e.target.value))}
                  className="w-full bg-bg border border-border px-4 py-3 rounded-2xl text-sm font-black focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 bg-bg hover:bg-border text-text-primary font-black py-3 rounded-2xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-black py-3 rounded-2xl text-xs shadow-md transition-colors"
                >
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Session Details Modal Dialog */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-sidebar border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h3 className="font-black text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={16} />
                Complete study session
              </h3>
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs font-bold text-text-muted leading-relaxed">
                Log any specific achievements, topics read, or reflections about this study session to review later.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-text-primary uppercase tracking-wider block">Session notes</label>
                <textarea
                  placeholder="e.g. Cleared 15 adjustments and formulas on asset retirement."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-bg border border-border p-4 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 bg-bg hover:bg-border text-text-primary font-black py-3 rounded-2xl text-xs transition-colors"
                >
                  Back to timer
                </button>
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs shadow-md transition-colors"
                >
                  Log session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
