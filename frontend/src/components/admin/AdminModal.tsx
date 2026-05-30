import { X } from 'lucide-react';
import '@/styles/admin/Modal.css';

interface AdminModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export default function AdminModal({
    open,
    onClose,
    title,
    children,
    footer,
    size = 'md',
}: AdminModalProps) {
    if (!open) return null;

    return (
        <div className="admin-modal-overlay" onClick={onClose} role="presentation">
            <div
                className={`admin-modal admin-modal-${size}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-modal-title"
            >
                <div className="admin-modal-header">
                    <h2 id="admin-modal-title">{title}</h2>
                    <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
                        <X size={22} />
                    </button>
                </div>
                <div className="admin-modal-body">{children}</div>
                {footer && <div className="admin-modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
