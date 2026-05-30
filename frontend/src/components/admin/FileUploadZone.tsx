import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadZoneProps {
    onFileUploaded: (url: string) => void;
    accept?: string;
    label?: string;
    maxSizeMB?: number;
    existingUrl?: string;
}

export default function FileUploadZone({
    onFileUploaded,
    accept = "application/pdf,image/*",
    label = "Upload File",
    maxSizeMB = 10,
    existingUrl = ""
}: FileUploadZoneProps) {
    const [fileUrl, setFileUrl] = useState<string>(existingUrl);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];

        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File is too large. Max size is ${maxSizeMB}MB`);
            return;
        }

        setError(null);
        setIsUploading(true);

        // Mocking Upload logic - In production replace with AWS S3 / Cloudinary SDK
        setTimeout(() => {
            const fakeUrl = URL.createObjectURL(file);
            setFileUrl(fakeUrl);
            onFileUploaded(fakeUrl); // Replace this with actual S3 URL after upload
            setIsUploading(false);
        }, 1500);

    }, [maxSizeMB, onFileUploaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: accept.split(',').reduce((acc, curr) => ({ ...acc, [curr.trim()]: [] }), {}),
        multiple: false
    });

    return (
        <div className="w-full">
            <AnimatePresence>
                {!fileUrl && !isUploading && (
                    <div
                        {...(getRootProps() as any)}
                        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-colors flex flex-col items-center justify-center text-center
                            ${isDragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                    >
                        <input {...getInputProps()} />
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragActive ? 'bg-primary/20 text-primary' : 'bg-white text-slate-400 shadow-sm'}`}>
                            <UploadCloud size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700">{label}</h4>
                        <p className="text-xs font-medium text-slate-400 mt-1">
                            {isDragActive ? "Drop the file here..." : "Drag & drop or browse"}
                        </p>
                        <p className="text-[10px] font-bold text-slate-300 mt-3 uppercase tracking-wider">
                            Max {maxSizeMB}MB • {accept}
                        </p>
                        {error && <p className="text-xs font-bold text-danger mt-3">{error}</p>}
                    </div>
                )}

                {isUploading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8 flex flex-col items-center justify-center text-center"
                    >
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <h4 className="text-sm font-bold text-primary">Uploading Securely...</h4>
                        <p className="text-xs font-medium text-primary/60 mt-1">Encrypting and transferring asset</p>
                    </motion.div>
                )}

                {fileUrl && !isUploading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-2xl border-2 border-success/30 bg-success/5 p-6 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4 border-2">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-success border border-success/10">
                                <CheckCircle size={24} />
                            </div>
                            <div className="text-left">
                                <h4 className="text-sm font-bold text-success/90">Upload Complete</h4>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 hover:text-success hover:underline truncate max-w-[200px] block">
                                    View File Asset
                                </a>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setFileUrl(''); setError(null); onFileUploaded(''); }}
                            className="w-10 h-10 rounded-full hover:bg-danger/10 text-slate-400 hover:text-danger flex items-center justify-center transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
