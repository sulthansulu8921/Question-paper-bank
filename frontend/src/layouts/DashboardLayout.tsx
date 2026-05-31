import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex bg-[#F8FAFC] min-h-screen text-dark font-sans relative overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 left-0 h-full w-72 bg-white z-[70] lg:hidden"
                        >
                            <div className="absolute top-6 right-6 lg:hidden">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <Sidebar />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Menu Trigger Bar */}
                <div className="lg:hidden h-16 bg-white border-b border-slate-100 flex items-center px-6 shrink-0 z-50">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                        <img src="/logo.png" alt="Qubook Logo" className="h-8 object-contain" />
                    </div>
                </div>

                <Topbar />

                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scrollbar-hide">
                    <div className="max-w-[1600px] mx-auto min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
