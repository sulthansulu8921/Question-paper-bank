import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X,
    FileSpreadsheet,
    Download,
    Upload,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    ArrowRight,
    Eye,
    Sparkles
} from 'lucide-react';
import api from '@/api/axios';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ImportErrorItem {
    row?: number;
    column?: string;
    message?: string;
}

interface ImportSkippedItem {
    row?: number;
    reason?: string;
}

interface ImportSummary {
    success: boolean;
    message: string;
    batch_id?: string;
    job_id?: string;
    total_questions?: number;
    tables_count?: number;
    isVerificationBatch?: boolean;
    created_count?: number;
    skipped_count?: number;
    error_count?: number;
    total_created?: number;
    mcq_count?: number;
    scenario_count?: number;
    scenario_sub_count?: number;
    problem_count?: number;
    problem_sub_count?: number;
    skipped_rows?: (string | ImportSkippedItem)[];
    error_rows?: (string | ImportErrorItem)[];
}

export default function ExcelImportModal({ isOpen, onClose, onSuccess }: ExcelImportModalProps) {
    const navigate = useNavigate();
    const [downloadingType, setDownloadingType] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [importMode, setImportMode] = useState<'verify' | 'direct' | null>(null);
    const [importResult, setImportResult] = useState<ImportSummary | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    // Handle downloading templates
    const handleDownloadTemplate = async (type: 'all' | 'mcq' | 'case_scenario' | 'descriptive') => {
        setDownloadingType(type);
        try {
            const resp = await api.get(`/materials/questions/download-template/?type=${type}`, {
                responseType: 'blob'
            });
            const filenameMap: Record<string, string> = {
                all: 'QBank_Import_Format.xlsx',
                mcq: 'QBank_MCQ_Template.xlsx',
                case_scenario: 'QBank_Case_Scenario_Template.xlsx',
                descriptive: 'QBank_Descriptive_Problem_Template.xlsx'
            };
            const filename = filenameMap[type] || 'QBank_Import_Format.xlsx';
            const url = URL.createObjectURL(new Blob([resp.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download template. Please check your network connection and try again.');
        } finally {
            setDownloadingType(null);
        }
    };

    // File selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setImportResult(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                setSelectedFile(file);
                setImportResult(null);
            } else {
                alert('Please upload a valid Excel (.xlsx or .xls) file.');
            }
        }
    };

    // Mode A: Import to Verification Workspace (Editable Review)
    const handleImportToVerification = async () => {
        if (!selectedFile) return;
        setImportMode('verify');
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const resp = await api.post('/materials/questions/import-excel-to-batch/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult({
                ...resp.data,
                isVerificationBatch: true
            });
        } catch (err: any) {
            const data = err?.response?.data;
            setImportResult({
                success: false,
                message: data?.error || data?.message || 'Excel import failed. Please check your file format.',
                error_rows: data?.error_rows || []
            });
        } finally {
            setImportMode(null);
        }
    };

    // Mode B: Direct Bulk Publish
    const handleDirectBulkImport = async () => {
        if (!selectedFile) return;
        setImportMode('direct');
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const resp = await api.post('/materials/questions/import-excel/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult({
                ...resp.data,
                isVerificationBatch: false
            });
            if (resp.data?.success) {
                onSuccess();
            }
        } catch (err: any) {
            const data = err?.response?.data;
            setImportResult({
                success: false,
                message: data?.error || data?.message || 'Excel import failed. Please check your file format.',
                error_rows: data?.error_rows || []
            });
        } finally {
            setImportMode(null);
        }
    };

    const resetForm = () => {
        setSelectedFile(null);
        setImportResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '1rem'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '1.25rem',
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 1.75rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    background: '#ffffff',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                        }}>
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                                Excel Question Import Working Model
                            </h2>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                Full working model supporting 3 question formats with pre-filled templates
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Step 1: Download Templates Hub */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1rem',
                        padding: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                }}>STEP 1</span>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                                    Download Sample Excel Templates (3 Models Included)
                                </h3>
                            </div>
                        </div>

                        {/* Master 3-in-1 Banner */}
                        <div style={{
                            background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)',
                            border: '1px solid #c7d2fe',
                            borderRadius: '0.85rem',
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4338ca' }}>
                                        ⭐ Master 3-in-1 Template Workbook
                                    </span>
                                    <span style={{
                                        background: '#dbeafe',
                                        color: '#1e40af',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}>RECOMMENDED</span>
                                </div>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6366f1' }}>
                                    Contains all 3 types in separate sheets: <b>1_MCQ_Questions</b>, <b>2_Case_Scenarios</b>, <b>3_Descriptive_Problems</b> + Instructions
                                </p>
                            </div>
                            <button
                                onClick={() => handleDownloadTemplate('all')}
                                disabled={downloadingType !== null}
                                style={{
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1.1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                {downloadingType === 'all' ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                                <span>Download Master 3-in-1 (.xlsx)</span>
                            </button>
                        </div>

                        {/* Individual 3 Templates */}
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Or download dedicated single templates for each question type:
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                            
                            {/* Template 1: MCQ */}
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.75rem',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e3a5f' }} />
                                        <strong style={{ fontSize: '0.85rem', color: '#1e3a5f' }}>1. MCQ Template</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                                        Objective questions with 4 options (A, B, C, D), correct answer, and explanation.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDownloadTemplate('mcq')}
                                    disabled={downloadingType !== null}
                                    style={{
                                        marginTop: '0.75rem',
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '0.45rem 0.75rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#1e293b',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    {downloadingType === 'mcq' ? <Loader2 size={14} className="spin" /> : <Download size={14} color="#1e3a5f" />}
                                    <span>Download MCQ Template</span>
                                </button>
                            </div>

                            {/* Template 2: Case Scenario */}
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.75rem',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#581c87' }} />
                                        <strong style={{ fontSize: '0.85rem', color: '#581c87' }}>2. Case Scenario Template</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                                        Comprehensive case study narrative with linked sub-questions grouped by Scenario ID.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDownloadTemplate('case_scenario')}
                                    disabled={downloadingType !== null}
                                    style={{
                                        marginTop: '0.75rem',
                                        background: '#f5f3ff',
                                        border: '1px solid #ddd6fe',
                                        borderRadius: '6px',
                                        padding: '0.45rem 0.75rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#581c87',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    {downloadingType === 'case_scenario' ? <Loader2 size={14} className="spin" /> : <Download size={14} color="#581c87" />}
                                    <span>Download Case Template</span>
                                </button>
                            </div>

                            {/* Template 3: Descriptive / Problem */}
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.75rem',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#065f46' }} />
                                        <strong style={{ fontSize: '0.85rem', color: '#065f46' }}>3. Problem / Descriptive</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                                        Main problem narrative with sub-parts (1(a), 1(b)), step-by-step solutions & working notes.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDownloadTemplate('descriptive')}
                                    disabled={downloadingType !== null}
                                    style={{
                                        marginTop: '0.75rem',
                                        background: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: '6px',
                                        padding: '0.45rem 0.75rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#065f46',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    {downloadingType === 'descriptive' ? <Loader2 size={14} className="spin" /> : <Download size={14} color="#065f46" />}
                                    <span>Download Problem Template</span>
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* Step 2: Upload Excel File */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1rem',
                        padding: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                            <span style={{
                                background: '#10b981',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px'
                            }}>STEP 2</span>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                                Upload Your Excel Workbook (.xlsx)
                            </h3>
                        </div>

                        {/* Dropzone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2px dashed ${isDragging ? '#6366f1' : (selectedFile ? '#10b981' : '#cbd5e1')}`,
                                borderRadius: '0.85rem',
                                padding: '1.75rem 1.25rem',
                                textAlign: 'center',
                                background: isDragging ? '#f5f3ff' : (selectedFile ? '#f0fdf4' : '#fafafa'),
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />

                            {selectedFile ? (
                                <>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        background: '#dcfce7',
                                        color: '#16a34a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <CheckCircle size={22} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#15803d' }}>
                                            {selectedFile.name}
                                        </p>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click or drop another file to change
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        background: '#e0e7ff',
                                        color: '#4f46e5',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Upload size={22} />
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
                                        Click to browse or drag and drop your Excel file here
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                        Supports .xlsx, .xls (Master 3-in-1 multi-sheet or single template)
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Action Buttons: Verification Model vs Direct Bulk Publish */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {selectedFile && (
                                <button
                                    onClick={resetForm}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '0.85rem',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        marginRight: 'auto'
                                    }}
                                >
                                    Clear File
                                </button>
                            )}

                            {/* Secondary: Direct Bulk Publish */}
                            <button
                                onClick={handleDirectBulkImport}
                                disabled={!selectedFile || importMode !== null}
                                title="Instantly insert questions into the live database without editable verification"
                                style={{
                                    background: '#ffffff',
                                    color: selectedFile && importMode === null ? '#334155' : '#94a3b8',
                                    border: `1px solid ${selectedFile && importMode === null ? '#cbd5e1' : '#e2e8f0'}`,
                                    borderRadius: '8px',
                                    padding: '0.65rem 1rem',
                                    fontSize: '0.825rem',
                                    fontWeight: 600,
                                    cursor: selectedFile && importMode === null ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {importMode === 'direct' ? (
                                    <>
                                        <Loader2 size={15} className="spin" />
                                        <span>Publishing Directly...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={15} color="#475569" />
                                        <span>Direct Bulk Publish</span>
                                    </>
                                )}
                            </button>

                            {/* Primary: Import to Verification Workspace */}
                            <button
                                onClick={handleImportToVerification}
                                disabled={!selectedFile || importMode !== null}
                                title="Open in editable review workspace to inspect questions, tables, test solutions, and verify before publishing"
                                style={{
                                    background: selectedFile && importMode === null ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#e2e8f0',
                                    color: selectedFile && importMode === null ? '#ffffff' : '#94a3b8',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.65rem 1.35rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    cursor: selectedFile && importMode === null ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: selectedFile && importMode === null ? '0 4px 12px rgba(79, 70, 229, 0.35)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {importMode === 'verify' ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        <span>Creating Verification Batch...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        <span>Import to Verification Workspace</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Step 3: Result Breakdown Card */}
                    {importResult && (
                        <div style={{
                            background: importResult.success ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${importResult.success ? '#86efac' : '#fca5a5'}`,
                            borderRadius: '1rem',
                            padding: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    {importResult.success ? (
                                        <CheckCircle size={22} color="#16a34a" />
                                    ) : (
                                        <XCircle size={22} color="#dc2626" />
                                    )}
                                    <strong style={{ fontSize: '1rem', color: importResult.success ? '#15803d' : '#b91c1c' }}>
                                        {importResult.success ? (importResult.isVerificationBatch ? 'Verification Batch Ready for Review!' : 'Questions Published to Live Question Bank!') : 'Import Failed'}
                                    </strong>
                                </div>

                                {importResult.success && importResult.isVerificationBatch && importResult.batch_id && (
                                    <button
                                        onClick={() => {
                                            navigate(`/admin/questions/import?batchId=${importResult.batch_id}`);
                                            onClose();
                                        }}
                                        style={{
                                            background: '#15803d',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.55rem 1.15rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.45rem',
                                            boxShadow: '0 2px 8px rgba(21, 128, 61, 0.3)'
                                        }}
                                    >
                                        <Eye size={16} />
                                        <span>Open Verification Workspace &rarr;</span>
                                    </button>
                                )}
                            </div>

                            <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.4 }}>
                                {importResult.message}
                            </p>

                            {/* Stat chips for successful import */}
                            {importResult.success && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                                            {importResult.total_questions || importResult.total_created || 0}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>TOTAL QUESTIONS</div>
                                    </div>

                                    {importResult.tables_count !== undefined && (
                                        <div style={{ background: '#ffffff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>
                                                {importResult.tables_count || 0}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>FINANCIAL TABLES</div>
                                        </div>
                                    )}

                                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a5f' }}>
                                            {importResult.mcq_count || 0}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>MCQ QUESTIONS</div>
                                    </div>

                                    <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6d28d9' }}>
                                            {importResult.scenario_count || 0}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                                            SCENARIOS {importResult.scenario_sub_count ? `(${importResult.scenario_sub_count} SUB)` : ''}
                                        </div>
                                    </div>

                                    <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
                                            {importResult.problem_count || 0}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                                            PROBLEMS {importResult.problem_sub_count ? `(${importResult.problem_sub_count} SUB)` : ''}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Skipped rows / duplicate reporting */}
                            {importResult.skipped_rows && importResult.skipped_rows.length > 0 && (
                                <div style={{ marginTop: '0.75rem', background: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#92400e', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                                        <AlertCircle size={16} />
                                        <span>Skipped Rows ({importResult.skipped_count || importResult.skipped_rows.length} duplicates / already exist):</span>
                                    </div>
                                    <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#78350f' }}>
                                            {importResult.skipped_rows.map((item, i) => {
                                                if (typeof item === 'string') return <li key={i}>{item}</li>;
                                                return <li key={i}>Row {item.row}: {item.reason}</li>;
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Warnings or errors */}
                            {importResult.error_rows && importResult.error_rows.length > 0 && (
                                <div style={{ marginTop: '0.75rem', background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                                        <AlertCircle size={16} />
                                        <span>Error Details ({importResult.error_count || importResult.error_rows.length} issues found):</span>
                                    </div>
                                    <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#7f1d1d' }}>
                                            {importResult.error_rows.map((err, i) => {
                                                if (typeof err === 'string') return <li key={i}>{err}</li>;
                                                return (
                                                    <li key={i}>
                                                        <strong>Row {err.row}</strong> [{err.column || 'General'}]: {err.message}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Action to view questions */}
                            {importResult.success && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            background: '#15803d',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.55rem 1.25rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <span>Done & View in Question Bank</span>
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.75rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    borderBottomLeftRadius: '1.25rem',
                    borderBottomRightRadius: '1.25rem'
                }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        All 290+ existing questions and database integrity remain completely safe and protected.
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
