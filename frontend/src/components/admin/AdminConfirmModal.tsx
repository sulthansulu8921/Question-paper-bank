import AdminModal from './AdminModal';
import { AlertTriangle } from 'lucide-react';

interface AdminConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    isLoading?: boolean;
}

export default function AdminConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    isDanger = true,
    isLoading = false,
}: AdminConfirmModalProps) {
    return (
        <AdminModal
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <button
                        type="button"
                        className="secondary-btn text-xs font-bold"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center min-w-[80px] ${
                            isDanger 
                            ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-700'
                        }`}
                    >
                        {isLoading ? '...' : confirmText}
                    </button>
                </div>
            }
        >
            <div className="flex gap-4 items-start py-2">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-full border border-red-100 flex-shrink-0">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-semibold leading-relaxed mt-1">
                        {message}
                    </p>
                </div>
            </div>
        </AdminModal>
    );
}
