import { ArrowLeft, Download, MessageCircle, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import QuestionTable from '@/components/dashboard/QuestionTable';

const SUBJECT_LOOKUP: Record<string, { name: string, code: string }> = {
    '1': { name: 'Advanced Accounting', code: 'PAPER 1' },
    '2': { name: 'Corporate and Other Laws', code: 'PAPER 2' },
    '3': { name: 'Taxation', code: 'PAPER 3' },
    '4': { name: 'Cost and Management Accounting', code: 'PAPER 4' },
    '5': { name: 'Auditing and Ethics', code: 'PAPER 5' },
    '6': { name: 'Financial Management & Strategic Management', code: 'PAPER 6' },
};

export default function PaperViewer() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    
    const subjectInfo = id ? SUBJECT_LOOKUP[id] : null;
    const subjectName = subjectInfo ? subjectInfo.name : 'Unknown Subject';

    return (
        <div className="flex flex-col bg-[#F8FAFC] min-h-screen font-sans -m-8 relative">
            {/* Topmost Utility Bar (My Plan / Help / Guest) */}
            <div className="bg-[#7986CB] px-10 py-3 flex items-center justify-between shrink-0 text-white text-[11px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-8">
                    <span>My Plan: Free</span>
                    <span className="opacity-60 cursor-pointer hover:opacity-100 transition-opacity">Help</span>
                </div>
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    <span>Guest</span>
                </div>
            </div>

            {/* Subject Detail Bar (Deep Blue Bar) */}
            <div className="bg-[#1E2B63] px-10 py-3 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-black text-white tracking-wider uppercase">
                    Subject : {subjectName}
                </h2>
                <div className="flex items-center gap-4">
                    <button className="p-1 px-3 bg-white/10 hover:bg-white/20 rounded text-white transition-all">
                        <Video size={18} />
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
            <footer className="bg-white border-t border-slate-100 px-10 py-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">SP</div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Study Partner v3.0 Educational Portal</p>
                </div>
                <div className="flex items-center gap-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 hover:text-primary transition-colors">
                        <ArrowLeft size={14} /> Back to Hub
                    </button>
                    <div className="h-4 w-[1px] bg-slate-100" />
                    <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <Download size={14} /> Download PDF
                    </button>
                    <button className="flex items-center gap-2 hover:text-primary transition-colors">
                        <MessageCircle size={14} /> Support
                    </button>
                </div>
            </footer>
        </div>
    );
}
