import { useEffect } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { Trophy, Flame, Loader2, Sparkles } from 'lucide-react';

export default function LeaderboardPage() {
    const { leaderboard, fetchLeaderboard, loading } = useDashboardStore();

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    if (loading && leaderboard.length === 0) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    // Split leaderboard into top 3 and the rest
    const top3 = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);

    // Arrange top 3 for podium rendering: [2nd, 1st, 3rd]
    const podiumArrangement = [];
    if (top3[1]) podiumArrangement.push({ ...top3[1], placement: 2 });
    if (top3[0]) podiumArrangement.push({ ...top3[0], placement: 1 });
    if (top3[2]) podiumArrangement.push({ ...top3[2], placement: 3 });

    return (
        <div className="space-y-8 p-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="text-center max-w-xl mx-auto space-y-2">
                <div className="inline-flex p-3 bg-amber-500/10 rounded-full text-amber-500 mb-2">
                    <Trophy size={32} />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-text-primary">Qubook Study Arena</h1>
                <p className="text-text-muted font-bold text-sm">Compare weekly study XP points, level progress, and streaks with your study peers.</p>
            </div>

            {/* Podium for Top 3 */}
            {podiumArrangement.length > 0 && (
                <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 pt-8 pb-4">
                    {podiumArrangement.map((user) => {
                        const isFirst = user.placement === 1;
                        const isSecond = user.placement === 2;

                        return (
                            <div
                                key={user.id}
                                className={`flex flex-col items-center w-full max-w-[200px] order-${user.placement === 2 ? 1 : user.placement === 1 ? 2 : 3}`}
                            >
                                {/* Profile Avatar Card */}
                                <div className="relative mb-4">
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl text-white shadow-lg border-4 ${isFirst ? 'bg-gradient-to-tr from-amber-400 to-amber-600 border-amber-300 scale-110' :
                                            isSecond ? 'bg-gradient-to-tr from-slate-400 to-slate-600 border-slate-300' :
                                                'bg-gradient-to-tr from-amber-700 to-amber-900 border-amber-800'
                                        }`}>
                                        {user.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black text-white flex items-center gap-1 uppercase tracking-widest ${isFirst ? 'bg-amber-500' : isSecond ? 'bg-slate-500' : 'bg-amber-800'
                                        }`}>
                                        {isFirst && <Sparkles size={10} />}
                                        Rank {user.placement}
                                    </div>
                                </div>

                                {/* User Details Card */}
                                <div className={`w-full text-center p-5 rounded-3xl border border-border bg-sidebar ${isFirst ? 'shadow-lg shadow-amber-500/5 ring-2 ring-amber-500/20' : 'shadow-sm'}`}>
                                    <h4 className="font-black text-sm text-text-primary truncate">{user.name}</h4>

                                    <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-border">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-text-muted uppercase">Level</p>
                                            <p className="text-xs font-black text-text-primary mt-0.5">{user.level}</p>
                                        </div>
                                        <div className="w-[1px] h-6 bg-border" />
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-text-muted uppercase">XP</p>
                                            <p className="text-xs font-black text-text-primary mt-0.5">{user.xp_points}</p>
                                        </div>
                                        {user.current_streak > 0 && (
                                            <>
                                                <div className="w-[1px] h-6 bg-border" />
                                                <div className="text-center">
                                                    <p className="text-[9px] font-black text-text-muted uppercase">Streak</p>
                                                    <p className="text-xs font-black text-orange-500 flex items-center justify-center gap-0.5 mt-0.5">
                                                        <Flame size={10} fill="currentColor" />
                                                        {user.current_streak}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Main Area: Rankings Table */}
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-sidebar border border-border rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-black text-sm text-text-primary uppercase tracking-wider">All Students</h3>
                        <span className="text-[10px] font-black text-text-muted bg-bg px-3 py-1 rounded-full uppercase">Global Ranking</span>
                    </div>

                    <div className="divide-y divide-border">
                        {rest.length === 0 && top3.length <= 3 && (
                            <p className="text-center py-8 text-xs font-bold text-text-muted">No additional study peers logged yet.</p>
                        )}

                        {rest.map((user) => (
                            <div key={user.id} className="flex items-center justify-between px-6 py-4 hover:bg-bg/50 transition-colors">
                                {/* Left: Rank & User Profile */}
                                <div className="flex items-center gap-4">
                                    <span className="w-6 text-center font-black text-sm text-text-muted">#{user.rank}</span>
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-sm border border-primary/20">
                                        {user.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm text-text-primary">{user.name}</h4>
                                    </div>
                                </div>

                                {/* Right: Stats Details */}
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-text-muted uppercase">Level</p>
                                        <p className="text-xs font-black text-text-primary">{user.level}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-text-muted uppercase">XP Points</p>
                                        <p className="text-xs font-black text-text-primary">{user.xp_points}</p>
                                    </div>
                                    {user.current_streak > 0 && (
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-black text-text-muted uppercase">Streak</p>
                                            <p className="text-xs font-black text-orange-500 flex items-center justify-end gap-0.5">
                                                <Flame size={12} fill="currentColor" />
                                                {user.current_streak}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
