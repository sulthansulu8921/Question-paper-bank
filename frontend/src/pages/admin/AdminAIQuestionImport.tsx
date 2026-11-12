import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Upload, FileText, Sparkles, CheckCircle2, AlertTriangle,
    RefreshCw, ChevronLeft, ChevronRight, Eye, Trash2, Check,
    Save, Layers, Clock, DollarSign, Database,
    FileSpreadsheet, ShieldCheck, Minimize2, Maximize2,
    BookOpen, ListChecks, Plus, Scissors, CheckCheck, AlertCircle,
    ArrowUp, ArrowDown, FolderPlus, History, Files, X, ExternalLink,
    ChevronUp, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { extractAllTextFromPdf, renderPdfPageToCanvas, type ExtractedPageText } from '@/utils/pdfExtractor';
import ICAICascadeSelector, { type ICAISelection } from '@/components/admin/ICAICascadeSelector';
import '@/styles/admin/AIQuestionImport.css';

interface QuestionImportJob {
    id: string;
    status: string;
    stage_label: string;
    progress_percent: number;
    error_message?: string;
    ca_level: string;
    exam_session: string;
    exam_year: number;
    source: string;
    maximum_marks?: number;
    duration_minutes?: number;
    question_pdf_filename: string;
    answer_pdf_filename?: string;
    question_pdf_url?: string;
    answer_pdf_url?: string;
    ai_provider: string;
    model_used: string;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
    processing_time_seconds: number;
    extracted_payload?: any;
    published_question_count: number;
    created_at: string;
}

interface AccountingTable {
    title?: string;
    model_type?: string;
    headers: string[];
    rows: string[][];
    columns_count?: number;
    rows_count?: number;
}

const TABLE_TEMPLATES: { label: string; model_type: string; table: AccountingTable }[] = [
    {
        label: '4-Col Balance Sheet / Trial Balance',
        model_type: 'BALANCE_SHEET_4_COL',
        table: {
            title: 'Balance Sheet / Trial Balance',
            model_type: 'BALANCE_SHEET_4_COL',
            headers: ['Particulars', 'Amount (₹)', 'Particulars', 'Amount (₹)'],
            rows: [
                ['Term Loans (Secured)', '40,00,000', 'Investments (Non-current)', '9,00,000'],
                ['Trade payables', '45,80,000', 'Profit for the year', '32,00,000'],
                ['Cash and Bank Balances', '38,40,000', 'Trade receivables', '49,00,000'],
                ['Staff Advances', '2,20,000', 'Miscellaneous Expenses', '2,32,000'],
                ['Other advances (given by Co.)', '14,88,000', 'Loan from other parties', '8,00,000'],
                ['Provision for Taxation', '10,20,000', 'Provision for Doubtful Debts', '80,000'],
                ['Securities Premium', '19,00,000', 'Stores', '16,00,000'],
                ['Loose Tools', '2,00,000', 'Finished Goods', '30,00,000'],
                ['General Reserve', '62,00,000', 'Plant and Machinery (WDV)', '2,14,00,000']
            ]
        }
    },
    {
        label: 'General Journal Entries',
        model_type: 'JOURNAL_ENTRY',
        table: {
            title: 'Journal Entries',
            model_type: 'JOURNAL_ENTRY',
            headers: ['Date', 'Particulars', 'L.F.', 'Debit (₹)', 'Credit (₹)'],
            rows: [
                ['2026-04-01', 'Bank A/c Dr.', '', '10,00,000', ''],
                ['', '  To Equity Share Capital A/c', '', '', '10,00,000'],
                ['', '(Being share application money received)', '', '', '']
            ]
        }
    },
    {
        label: 'T-Account / Ledger (Dr. & Cr.)',
        model_type: 'LEDGER_ACCOUNT',
        table: {
            title: 'Ledger Account',
            model_type: 'LEDGER_ACCOUNT',
            headers: ['Date (Dr.)', 'Particulars', 'Amount (₹)', 'Date (Cr.)', 'Particulars', 'Amount (₹)'],
            rows: [
                ['01/04/2026', 'To Balance b/d', '5,00,000', '31/03/2027', 'By Purchases A/c', '2,00,000'],
                ['15/06/2026', 'To Sales A/c', '3,50,000', '31/03/2027', 'By Balance c/d', '6,50,000']
            ]
        }
    },
    {
        label: 'Schedule III Balance Sheet / P&L',
        model_type: 'SCHEDULE_III',
        table: {
            title: 'Schedule III Format',
            model_type: 'SCHEDULE_III',
            headers: ['Particulars', 'Note No.', 'Current Period (₹)', 'Previous Period (₹)'],
            rows: [
                ['I. EQUITY AND LIABILITIES', '', '', ''],
                ['(1) Shareholders\' funds', '', '', ''],
                ['  (a) Share capital', '1', '50,00,000', '50,00,000'],
                ['  (b) Reserves and surplus', '2', '24,50,000', '18,20,000'],
                ['II. ASSETS', '', '', ''],
                ['(1) Non-current assets', '', '', ''],
                ['  (a) Property, Plant and Equipment', '3', '65,00,000', '58,00,000']
            ]
        }
    },
    {
        label: 'Multi-Column Investment Account',
        model_type: 'INVESTMENT_ACCOUNT',
        table: {
            title: 'Investment Account (Debentures/Bonds)',
            model_type: 'INVESTMENT_ACCOUNT',
            headers: ['Date', 'Particulars', 'Nominal', 'Interest', 'Cost (₹)', 'Date', 'Particulars', 'Nominal', 'Interest', 'Cost (₹)'],
            rows: [
                ['01/04/26', 'To Bal b/d', '1,00,000', '2,000', '98,000', '30/09/26', 'By Bank (Int.)', '', '6,000', ''],
                ['15/07/26', 'To Bank A/c', '50,000', '1,250', '52,000', '31/03/27', 'By Bal c/d', '1,50,000', '3,000', '1,50,000']
            ]
        }
    },
    {
        label: 'Partnership / Multi-Partner Table',
        model_type: 'PARTNERSHIP_TABLE',
        table: {
            title: 'Partners Capital Account',
            model_type: 'PARTNERSHIP_TABLE',
            headers: ['Particulars', 'Partner A (₹)', 'Partner B (₹)', 'Partner C (₹)'],
            rows: [
                ['Balance b/d', '5,00,000', '3,00,000', '2,00,000'],
                ['Interest on Capital @ 6%', '30,00,000', '18,00,000', '12,00,000'],
                ['Share of Profit', '1,20,000', '80,000', '40,000'],
                ['Less: Drawings', '(50,000)', '(30,000)', '(20,000)']
            ]
        }
    }
];

function AccountingTableEditor({
    table,
    onChange,
    label = 'Financial / Accounting Table',
}: {
    table: AccountingTable | null | undefined;
    onChange: (t: AccountingTable | null) => void;
    label?: string;
}) {
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    if (!table || !Array.isArray(table.headers) || table.headers.length === 0) {
        return (
            <div style={{ marginTop: '0.6rem', padding: '0.85rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#475569', fontWeight: 600 }}>
                        <FileSpreadsheet size={16} color="#64748b" />
                        <span>No table attached to {label.toLowerCase()}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                            style={{
                                background: '#eef2ff',
                                color: '#4f46e5',
                                border: '1px solid #c7d2fe',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.785rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <span>+ Insert Accounting Table</span>
                        </button>

                        {showTemplatePicker && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                                zIndex: 50,
                                width: '280px',
                                padding: '0.4rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Select CA Accounting Model:
                                </div>
                                {TABLE_TEMPLATES.map((tmpl, tIdx) => (
                                    <button
                                        key={tIdx}
                                        type="button"
                                        onClick={() => {
                                            onChange(JSON.parse(JSON.stringify(tmpl.table)));
                                            setShowTemplatePicker(false);
                                        }}
                                        style={{
                                            textAlign: 'left',
                                            padding: '0.45rem 0.6rem',
                                            background: 'none',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            color: '#1e293b',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'background 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                    >
                                        <span>{tmpl.label}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
                                            {tmpl.table.headers.join(' | ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Determine model type badge text
    const modelBadge = table.headers.length === 4 && /particulars/i.test(table.headers[0] || '') && /particulars/i.test(table.headers[2] || '')
        ? '4-Col Balance Sheet / Trial Balance'
        : table.headers.some(h => /debit/i.test(h)) && table.headers.some(h => /credit/i.test(h))
            ? 'Journal Entry'
            : table.headers.some(h => /dr/i.test(h)) && table.headers.some(h => /cr/i.test(h))
                ? 'T-Account Ledger'
                : table.headers.some(h => /note no/i.test(h))
                    ? 'Schedule III Financial Statement'
                    : `${table.headers.length}-Column Table`;

    const handleHeaderChange = (colIdx: number, val: string) => {
        const updated = { ...table };
        updated.headers = [...updated.headers];
        updated.headers[colIdx] = val;
        onChange(updated);
    };

    const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
        const updated = { ...table };
        updated.rows = updated.rows.map((r, ri) => (ri === rowIdx ? [...r] : r));
        updated.rows[rowIdx][colIdx] = val;
        onChange(updated);
    };

    const handleAddRow = () => {
        const updated = { ...table };
        const newRow = new Array(updated.headers.length).fill('');
        updated.rows = [...(updated.rows || []), newRow];
        onChange(updated);
    };

    const handleDeleteRow = (rowIdx: number) => {
        const updated = { ...table };
        updated.rows = updated.rows.filter((_, ri) => ri !== rowIdx);
        onChange(updated);
    };

    const handleMoveRowUp = (rowIdx: number) => {
        if (rowIdx <= 0) return;
        const updated = { ...table };
        const rows = [...(updated.rows || [])];
        const temp = rows[rowIdx - 1];
        rows[rowIdx - 1] = rows[rowIdx];
        rows[rowIdx] = temp;
        updated.rows = rows;
        onChange(updated);
    };

    const handleMoveRowDown = (rowIdx: number) => {
        if (!table.rows || rowIdx >= table.rows.length - 1) return;
        const updated = { ...table };
        const rows = [...(updated.rows || [])];
        const temp = rows[rowIdx + 1];
        rows[rowIdx + 1] = rows[rowIdx];
        rows[rowIdx] = temp;
        updated.rows = rows;
        onChange(updated);
    };

    const handleAddColumn = () => {
        const updated = { ...table };
        const newColNum = updated.headers.length + 1;
        updated.headers = [...updated.headers, `Column ${newColNum}`];
        updated.rows = (updated.rows || []).map(r => [...r, '']);
        onChange(updated);
    };

    const handleDeleteColumn = (colIdx: number) => {
        if (table.headers.length <= 1) return;
        const updated = { ...table };
        updated.headers = updated.headers.filter((_, ci) => ci !== colIdx);
        updated.rows = (updated.rows || []).map(r => r.filter((_, ci) => ci !== colIdx));
        onChange(updated);
    };

    const isCellUncertain = (cellVal: string, colHeader: string, row: string[]) => {
        if (!cellVal || !cellVal.trim()) {
            const hasOtherData = row.some(c => (c || '').trim().length > 0);
            return hasOtherData && /amount|₹|rs|particulars|debit|credit/i.test(colHeader || '');
        }
        const trimmed = cellVal.trim();
        if (trimmed.includes('?') || trimmed.toLowerCase().includes('uncertain') || trimmed === '[?]') {
            return true;
        }
        const isAmountCol = /amount|₹|rs|debit|credit|dr|cr|balance|total|cost|nominal|value/i.test(colHeader || '');
        if (isAmountCol && /[^0-9,\.\(\)\s\-\/₹]/.test(trimmed)) {
            return true;
        }
        return false;
    };

    const handleApplyTemplate = (tmpl: typeof TABLE_TEMPLATES[0]) => {
        onChange(JSON.parse(JSON.stringify(tmpl.table)));
        setShowTemplatePicker(false);
    };

    return (
        <div style={{ marginTop: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '10px', background: '#ffffff', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Table Control Header */}
            <div style={{
                background: '#f8fafc',
                padding: '0.5rem 0.8rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#1e293b' }}>
                        📊 {label}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        {modelBadge}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        ({(table.rows || []).length} rows × {table.headers.length} cols)
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                    <button
                        type="button"
                        onClick={handleAddRow}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.25rem 0.6rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                        + Add Row
                    </button>
                    <button
                        type="button"
                        onClick={handleAddColumn}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.25rem 0.6rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                        + Add Col
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.25rem 0.6rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#4f46e5', cursor: 'pointer' }}
                    >
                        Template ▾
                    </button>

                    {showTemplatePicker && (
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                            zIndex: 50,
                            width: '280px',
                            padding: '0.4rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }}>
                            <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                                Replace with CA Model:
                            </div>
                            {TABLE_TEMPLATES.map((tmpl, tIdx) => (
                                <button
                                    key={tIdx}
                                    type="button"
                                    onClick={() => handleApplyTemplate(tmpl)}
                                    style={{
                                        textAlign: 'left',
                                        padding: '0.45rem 0.6rem',
                                        background: 'none',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        color: '#1e293b',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                >
                                    <span>{tmpl.label}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
                                        {tmpl.table.headers.join(' | ')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm('Delete this table entirely?')) {
                                onChange(null);
                            }
                        }}
                        style={{ background: '#fee2e2', border: '1px solid #fecaca', padding: '0.25rem 0.5rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', cursor: 'pointer' }}
                        title="Delete Table"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Editable Table Matrix */}
            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                <table className="ai-financial-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '36px', textAlign: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '0.7rem' }}>
                                #
                            </th>
                            {table.headers.map((h: string, hi: number) => {
                                const isAmount = /amount|₹|rs|debit|credit|dr|cr|balance|total|cost|nominal|value/i.test(h || '');
                                return (
                                    <th key={hi} style={{ padding: '0.35rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <input
                                                type="text"
                                                value={h}
                                                onChange={(e) => handleHeaderChange(hi, e.target.value)}
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    color: '#0f172a',
                                                    border: '1px solid transparent',
                                                    background: 'transparent',
                                                    width: '100%',
                                                    textAlign: isAmount ? 'right' : 'left'
                                                }}
                                            />
                                            {table.headers.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteColumn(hi)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}
                                                    title="Delete this column"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                            <th style={{ width: '80px', background: '#f1f5f9', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(table.rows || []).map((row: string[], ri: number) => (
                            <tr key={ri}>
                                <td style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', background: '#f8fafc', border: '1px solid #cbd5e1', userSelect: 'none' }}>
                                    {ri + 1}
                                </td>
                                {table.headers.map((_, ci: number) => {
                                    const cell = (row && row[ci]) !== undefined ? row[ci] : '';
                                    const isAmountCol = /amount|₹|rs|debit|credit|dr|cr|balance|total|cost|nominal|value/i.test(table.headers[ci] || '');
                                    const uncertain = isCellUncertain(cell, table.headers[ci], row);
                                    return (
                                        <td key={ci} className={uncertain ? 'ai-table-cell-uncertain' : ''} style={{ padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={cell}
                                                onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                                                style={{
                                                    textAlign: isAmountCol ? 'right' : 'left',
                                                    fontFamily: isAmountCol ? 'monospace, ui-monospace' : 'inherit',
                                                    fontSize: '0.825rem',
                                                    width: '100%',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none'
                                                }}
                                            />
                                            {uncertain && (
                                                <span className="ai-uncertain-badge" title="Flagged for human review: check original PDF value">?</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td style={{ textAlign: 'center', padding: '0.2rem', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                                    <div className="ai-table-row-actions">
                                        <button
                                            type="button"
                                            className="ai-table-row-btn"
                                            onClick={() => handleMoveRowUp(ri)}
                                            disabled={ri === 0}
                                            title="Move row up"
                                        >
                                            <ArrowUp size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            className="ai-table-row-btn"
                                            onClick={() => handleMoveRowDown(ri)}
                                            disabled={ri === (table.rows || []).length - 1}
                                            title="Move row down"
                                        >
                                            <ArrowDown size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            className="ai-table-row-btn"
                                            onClick={() => handleDeleteRow(ri)}
                                            title="Delete row"
                                            style={{ color: '#ef4444' }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

interface ImportBatchItem {
    id: string;
    name: string;
    status: string;
    stage_label: string;
    progress_percent: number;
    error_message?: string;
    ca_level: string;
    exam_session: string;
    exam_year: number;
    source: string;
    total_documents: number;
    documents_count?: number;
    total_questions_detected: number;
    matched_answers_count: number;
    missing_answers_count: number;
    tables_count: number;
    mcqs_count: number;
    duplicate_candidates_count: number;
    low_confidence_count: number;
    published_questions_count: number;
    created_at: string;
    documents?: {
        id: string;
        filename: string;
        file_url: string;
        file_type: string;
        inferred_type: string;
        page_count: number;
        status: string;
    }[];
    jobs?: any[];
    active_job?: any;
    extracted_payload?: any;
    total_input_tokens?: number;
    total_output_tokens?: number;
    estimated_cost_usd?: number;
    processing_time_seconds?: number;
    model_used?: string;
}

export default function AdminAIQuestionImport() {
    const navigate = useNavigate();

    // View mode: 'upload' | 'processing' | 'workspace' | 'history'
    const [viewMode, setViewMode] = useState<'upload' | 'processing' | 'workspace' | 'history'>('upload');

    // Upload mode: 'batch' (multi-pdf) | 'single' (dual dropzones)
    const [uploadMode, setUploadMode] = useState<'batch' | 'single'>('batch');
    const [batchName, setBatchName] = useState('CA Inter Advanced Accounting - Sep 2026 MTP Batch');
    const [batchFiles, setBatchFiles] = useState<{
        file: File;
        id: string;
        name: string;
        size: number;
        docType: 'QUESTION_PAPER' | 'SUGGESTED_ANSWER' | 'COMBINED';
    }[]>([]);
    const [isDraggingBatch, setIsDraggingBatch] = useState(false);
    const [activeBatch, setActiveBatch] = useState<ImportBatchItem | null>(null);
    const [selectedDocId, setSelectedDocId] = useState<string>('');
    const [historyBatches, setHistoryBatches] = useState<ImportBatchItem[]>([]);
    const [historyTab, setHistoryTab] = useState<'batches' | 'jobs'>('batches');
    const [batchAuditLogs, setBatchAuditLogs] = useState<any[]>([]);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

    // Files state (single mode)
    const [qpFile, setQpFile] = useState<File | null>(null);
    const [ansFile, setAnsFile] = useState<File | null>(null);
    const [isDraggingQp, setIsDraggingQp] = useState(false);
    const [isDraggingAns, setIsDraggingAns] = useState(false);

    // Metadata state
    const [caLevel, setCaLevel] = useState('CA Intermediate');
    const [examSession, setExamSession] = useState('September 2026');
    const [examYear, setExamYear] = useState('2026');
    const [source, setSource] = useState('Mock Test Paper – Series I');
    const [icaiFilter, setIcaiFilter] = useState<ICAISelection>({
        levelId: '',
        paperId: '',
        chapterId: '',
        topicId: '',
    });
    const [targetQuestionType, setTargetQuestionType] = useState<'ALL' | 'MCQ' | 'DESCRIPTIVE' | 'CASE_SCENARIO'>('ALL');

    // Active Job
    const [activeJob, setActiveJob] = useState<QuestionImportJob | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [historyJobs, setHistoryJobs] = useState<QuestionImportJob[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Workspace state
    const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
    const [qTypeFilter, setQTypeFilter] = useState<'ALL' | 'MCQ' | 'SCENARIO' | 'DESCRIPTIVE'>('ALL');
    const [leftMinimized, setLeftMinimized] = useState(false);
    const [rightMinimized, setRightMinimized] = useState(false);
    const [solutionTab, setSolutionTab] = useState<'OFFICIAL' | 'WORKING_NOTES' | 'AI_EXPLANATION'>('OFFICIAL');
    const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // PDF viewer state
    const [qpNumPages, setQpNumPages] = useState(1);
    const [qpCurrentPage, setQpCurrentPage] = useState(1);
    const [qpPagesText, setQpPagesText] = useState<ExtractedPageText[]>([]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Load past import jobs and batches on history view
    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const [jobsResp, batchesResp] = await Promise.all([
                api.get('/materials/import-jobs/').catch(() => ({ data: [] })),
                api.get('/materials/import-batches/').catch(() => ({ data: [] }))
            ]);
            const jobs = Array.isArray(jobsResp.data) ? jobsResp.data : (jobsResp.data.results || []);
            const batches = Array.isArray(batchesResp.data) ? batchesResp.data : (batchesResp.data.results || []);
            setHistoryJobs(jobs);
            setHistoryBatches(batches);
        } catch (err) {
            console.error('Failed to load import history', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Polling job status
    useEffect(() => {
        let interval: any = null;
        if (activeJob && (viewMode === 'processing' || activeJob.status === 'extracting' || activeJob.status === 'parsing_questions' || activeJob.status === 'parsing_answers' || activeJob.status === 'matching')) {
            interval = setInterval(async () => {
                try {
                    const resp = await api.get(`/materials/import-jobs/${activeJob.id}/`);
                    const updated = resp.data;
                    setActiveJob(updated);

                    if (updated.status === 'review_required' || updated.status === 'approved' || updated.status === 'published') {
                        setViewMode('workspace');
                        const targetType = updated.extracted_metadata?.target_question_type || targetQuestionType;
                        if (targetType === 'MCQ') setQTypeFilter('MCQ');
                        else if (targetType === 'DESCRIPTIVE') setQTypeFilter('DESCRIPTIVE');
                        else if (targetType === 'CASE_SCENARIO') setQTypeFilter('SCENARIO');

                        // Auto-select first question
                        const firstSec = updated.extracted_payload?.sections?.[0];
                        const firstQ = firstSec?.questions?.[0];
                        if (firstQ) {
                            setSelectedQuestionId(firstQ.question_id);
                        }
                    } else if (updated.status === 'failed') {
                        setViewMode('upload');
                        showToast(`Import Failed: ${updated.error_message || 'Unknown pipeline error'}`);
                    }
                } catch (err) {
                    console.error('Error polling import job status', err);
                }
            }, 2500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeJob?.id, activeJob?.status, viewMode]);

    // Polling activeBatch status
    useEffect(() => {
        let interval: any = null;
        if (activeBatch && (viewMode === 'processing' || activeBatch.status === 'uploaded' || activeBatch.status === 'processing')) {
            interval = setInterval(async () => {
                try {
                    const resp = await api.get(`/materials/import-batches/${activeBatch.id}/status/`);
                    const updated = resp.data;
                    setActiveBatch(prev => prev ? { ...prev, ...updated } : updated);
                    setActiveJob(prev => prev ? {
                        ...prev,
                        status: updated.status,
                        stage_label: updated.stage_label || prev.stage_label,
                        progress_percent: updated.progress_percent ?? prev.progress_percent
                    } : null);

                    if (updated.status === 'review_required' || updated.status === 'needs_review' || updated.status === 'approved' || updated.status === 'published' || updated.status === 'completed') {
                        // Fetch detailed batch and combined payload
                        const [detailResp, payloadResp] = await Promise.all([
                            api.get(`/materials/import-batches/${activeBatch.id}/`),
                            api.get(`/materials/import-batches/${activeBatch.id}/payload/`).catch(() => ({ data: {} }))
                        ]);
                        const fullBatch = detailResp.data;
                        let payload = payloadResp.data?.payload || payloadResp.data || {};
                        if (!payload.sections && fullBatch.jobs && fullBatch.jobs.length > 0) {
                            try {
                                const jobDetail = (await api.get(`/materials/import-jobs/${fullBatch.jobs[0].id}/`)).data;
                                if (jobDetail?.extracted_payload?.sections) {
                                    payload = jobDetail.extracted_payload;
                                }
                            } catch {}
                        }
                        fullBatch.extracted_payload = payload;
                        setActiveBatch(fullBatch);

                        // Also adapt to activeJob so editor controls work seamlessly
                        setActiveJob({
                            id: fullBatch.id,
                            status: fullBatch.status,
                            stage_label: fullBatch.stage_label,
                            progress_percent: fullBatch.progress_percent,
                            ca_level: fullBatch.ca_level,
                            exam_session: fullBatch.exam_session,
                            exam_year: fullBatch.exam_year,
                            source: fullBatch.source,
                            question_pdf_filename: fullBatch.documents?.[0]?.filename || 'Batch Documents',
                            question_pdf_url: fullBatch.documents?.[0]?.file_url,
                            ai_provider: 'Google Gemini',
                            model_used: fullBatch.model_used || 'Gemini 3.5 Flash',
                            total_input_tokens: fullBatch.total_input_tokens || 0,
                            total_output_tokens: fullBatch.total_output_tokens || 0,
                            estimated_cost_usd: fullBatch.estimated_cost_usd || 0,
                            processing_time_seconds: fullBatch.processing_time_seconds || 0,
                            extracted_payload: payload,
                            published_question_count: fullBatch.published_questions_count || 0,
                            created_at: fullBatch.created_at
                        });

                        setViewMode('workspace');
                        const batchTargetType = fullBatch.batch_payload?.target_question_type || targetQuestionType;
                        if (batchTargetType === 'MCQ') setQTypeFilter('MCQ');
                        else if (batchTargetType === 'DESCRIPTIVE') setQTypeFilter('DESCRIPTIVE');
                        else if (batchTargetType === 'CASE_SCENARIO') setQTypeFilter('SCENARIO');

                        const firstSec = payload?.sections?.[0];
                        const firstQ = firstSec?.questions?.[0];
                        if (firstQ) {
                            setSelectedQuestionId(firstQ.question_id);
                        }
                        if (fullBatch.documents && fullBatch.documents.length > 0) {
                            setSelectedDocId(fullBatch.documents[0].id);
                        }
                    } else if (updated.status === 'failed') {
                        setViewMode('upload');
                        showToast(`Batch Import Failed: ${updated.error_message || 'Unknown batch error'}`);
                    }
                } catch (err) {
                    console.error('Error polling batch status', err);
                }
            }, 2500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeBatch?.id, activeBatch?.status, viewMode]);

    // Handle initial client-side PDF extraction for quick local preview
    useEffect(() => {
        if (!qpFile) {
            setQpPagesText([]);
            return;
        }
        let cancelled = false;
        setLoadingPdf(true);
        extractAllTextFromPdf(qpFile)
            .then(res => {
                if (!cancelled) {
                    setQpNumPages(res.numPages);
                    setQpPagesText(res.pages);
                    setQpCurrentPage(1);
                }
            })
            .catch(err => console.error("Error reading PDF text client-side", err))
            .finally(() => {
                if (!cancelled) setLoadingPdf(false);
            });

        return () => { cancelled = true; };
    }, [qpFile]);

    // Render current PDF page to canvas
    useEffect(() => {
        if (!qpFile || !pdfCanvasRef.current || qpPagesText.length === 0) return;
        renderPdfPageToCanvas(qpFile, qpCurrentPage, pdfCanvasRef.current, 1.2).catch(e => {
            console.warn("Could not render page canvas", e);
        });
    }, [qpFile, qpCurrentPage, qpPagesText.length, leftMinimized]);

    // Submit Job
    const handleStartImport = async () => {
        if (!qpFile) {
            showToast('Please upload a Question Paper PDF to begin.');
            return;
        }
        setIsStarting(true);
        try {
            const formData = new FormData();
            formData.append('question_pdf', qpFile);
            if (ansFile) {
                formData.append('answer_pdf', ansFile);
            }
            formData.append('ca_level', caLevel);
            formData.append('exam_session', examSession);
            formData.append('exam_year', examYear);
            formData.append('source', source);
            if (icaiFilter.levelId) formData.append('level_id', icaiFilter.levelId);
            if (icaiFilter.paperId) formData.append('paper_id', icaiFilter.paperId);
            if (icaiFilter.chapterId) formData.append('chapter_id', icaiFilter.chapterId);
            if (icaiFilter.topicId) formData.append('topic_id', icaiFilter.topicId);
            formData.append('target_question_type', targetQuestionType);
            formData.append('auto_process', 'true');

            const resp = await api.post('/materials/import-jobs/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setActiveJob(resp.data);
            setViewMode('processing');
            showToast('AI Pipeline started! Analyzing Question Paper and Answer Sheet with Gemini...');
        } catch (err: any) {
            console.error('Failed to start import job', err);
            showToast(err.response?.data?.error || 'Failed to initialize AI import job.');
        } finally {
            setIsStarting(false);
        }
    };

    // Submit Batch Import (Multiple PDFs)
    const handleStartBatchImport = async () => {
        if (batchFiles.length === 0) {
            showToast('Please add at least one PDF document to the batch.');
            return;
        }
        setIsStarting(true);
        try {
            const formData = new FormData();
            batchFiles.forEach(bf => {
                formData.append('files', bf.file);
            });
            const typeMap: Record<string, string> = {};
            batchFiles.forEach(bf => {
                typeMap[bf.file.name] = bf.docType;
            });
            formData.append('file_types', JSON.stringify(typeMap));
            formData.append('name', batchName || `Batch ${source} - ${caLevel}`);
            formData.append('ca_level', caLevel);
            formData.append('exam_session', examSession);
            formData.append('exam_year', examYear);
            formData.append('source', source);
            if (icaiFilter.levelId) formData.append('level_id', icaiFilter.levelId);
            if (icaiFilter.paperId) formData.append('paper_id', icaiFilter.paperId);
            if (icaiFilter.chapterId) formData.append('chapter_id', icaiFilter.chapterId);
            if (icaiFilter.topicId) formData.append('topic_id', icaiFilter.topicId);
            formData.append('target_question_type', targetQuestionType);
            formData.append('auto_process', 'true');

            const resp = await api.post('/materials/import-batches/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newBatch = resp.data;
            setActiveBatch(newBatch);
            const firstJob = (newBatch.jobs && newBatch.jobs.length > 0) ? newBatch.jobs[0] : null;
            setActiveJob(firstJob || {
                id: newBatch.id,
                status: newBatch.status || 'processing',
                stage_label: newBatch.stage_label || 'Extracting questions, options, tables, and matching solutions...',
                progress_percent: newBatch.progress_percent || 10,
                ca_level: newBatch.ca_level,
                exam_session: newBatch.exam_session,
                exam_year: newBatch.exam_year,
                source: newBatch.source,
                question_pdf_filename: newBatch.documents?.[0]?.filename || newBatch.name,
                question_pdf_url: newBatch.documents?.[0]?.file_url,
                ai_provider: 'Google Gemini',
                model_used: 'Gemini 3.5 Flash',
                created_at: newBatch.created_at
            });
            if (newBatch.documents && newBatch.documents.length > 0) {
                setSelectedDocId(newBatch.documents[0].id);
            }
            setViewMode('processing');
            showToast('🚀 Batch created! Gemini AI pipeline started processing all documents in parallel...');
        } catch (err: any) {
            console.error('Failed to create import batch', err);
            const msg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to initialize import batch.';
            showToast(msg);
        } finally {
            setIsStarting(false);
        }
    };

    // Quick add chapter to ICAI master data table
    const handleQuickAddChapter = async (proposedName: string) => {
        if (!proposedName) return;
        try {
            const paperId = currentQuestion?.suggested_paper_id || icaiFilter.paperId || 19;
            const code = proposedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
            const resp = await api.post('/master/chapters/', {
                name: proposedName,
                paper: paperId,
                code: code || 'CHP',
                order: 99
            });
            const newChapter = resp.data;
            updateQuestionField('suggested_chapter_id', newChapter.id);
            updateQuestionField('suggested_chapter_name', newChapter.name);
            updateQuestionField('is_new_proposed_chapter', false);
            showToast(`✓ Added "${newChapter.name}" to ICAI Master Data Chapters!`);
        } catch (err: any) {
            console.error('Failed to quick add chapter', err);
            showToast(err.response?.data?.name?.[0] || 'Failed to create chapter in master data.');
        }
    };

    // Open audit logs modal
    const handleOpenAuditLogs = async (batchId?: string, jobId?: string) => {
        const targetBatchId = batchId || activeBatch?.id;
        const targetJobId = jobId || activeJob?.id;
        if (!targetBatchId && !targetJobId) return;
        setLoadingAuditLogs(true);
        setShowAuditModal(true);
        try {
            const endpoint = targetBatchId
                ? `/materials/import-batches/${targetBatchId}/audit-logs/`
                : `/materials/import-jobs/${targetJobId}/audit-logs/`;
            const resp = await api.get(endpoint).catch(() => ({ data: [] }));
            setBatchAuditLogs(Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            console.error('Failed to fetch audit logs', err);
        } finally {
            setLoadingAuditLogs(false);
        }
    };

    // Flatten all questions across sections
    const allQuestions = useMemo(() => {
        if (!activeJob?.extracted_payload?.sections) return [];
        const list: any[] = [];
        activeJob.extracted_payload.sections.forEach((sec: any) => {
            (sec.questions || []).forEach((q: any) => {
                let tableObj = q.structured_table || q.table_data || null;
                if (typeof tableObj === 'string') {
                    try { tableObj = JSON.parse(tableObj); } catch { tableObj = null; }
                }

                const ans = q.matched_answer || q.official_answer || {};
                let ansTableObj = ans.structured_table || ans.answer_table_data || ans.solution_table || null;
                if (typeof ansTableObj === 'string') {
                    try { ansTableObj = JSON.parse(ansTableObj); } catch { ansTableObj = null; }
                }

                const rawSubqs = q.subquestions || q.sub_questions || [];
                const subqs = rawSubqs.map((sq: any, sIdx: number) => {
                    let sqTable = sq.structured_table || sq.table_data || null;
                    if (typeof sqTable === 'string') {
                        try { sqTable = JSON.parse(sqTable); } catch { sqTable = null; }
                    }
                    const sqAns = sq.matched_answer || sq.official_answer || {};
                    let sqAnsTable = sqAns.structured_table || sqAns.answer_table_data || null;
                    if (typeof sqAnsTable === 'string') {
                        try { sqAnsTable = JSON.parse(sqAnsTable); } catch { sqAnsTable = null; }
                    }
                    const sqOpts = (sq.options || []).map((opt: any, oIdx: number) => {
                        const label = opt.label || opt.option_key || String.fromCharCode(65 + oIdx);
                        const optText = opt.text ?? opt.option_text ?? '';
                        return {
                            ...opt,
                            label,
                            option_key: label,
                            text: optText,
                            option_text: optText,
                            is_correct: !!opt.is_correct,
                            order: opt.order ?? oIdx
                        };
                    });
                    const sqStatus = sq.matching_status || (sqAns.solution_text || sqAns.answer_text ? 'matched' : 'needs_review');
                    const letterCode = String.fromCharCode(97 + sIdx);
                    const defaultId = `${q.question_number}(${letterCode})`;
                    return {
                        ...sq,
                        identifier: sq.identifier || defaultId,
                        original_question_number: sq.original_question_number || sq.identifier || defaultId,
                        sub_question_number: sq.sub_question_number || sq.identifier || defaultId,
                        structured_table: sqTable,
                        table_data: sqTable,
                        options: sqOpts,
                        is_approved: sq.is_approved !== undefined ? !!sq.is_approved : (sqStatus === 'matched'),
                        matching_status: sqStatus,
                        matched_answer: {
                            ...sqAns,
                            answer_text: sqAns.answer_text || sq.correct_answer || '',
                            solution_text: sqAns.solution_text || sqAns.answer_text || sq.correct_answer || '',
                            working_notes: sqAns.working_notes || '',
                            structured_table: sqAnsTable,
                            answer_table_data: sqAnsTable,
                            confidence_score: sqAns.confidence_score ?? (sqStatus === 'matched' ? 0.95 : 0.0),
                            matching_status: sqStatus
                        }
                    };
                });

                // Normalize options to support both 'text' and 'option_text'
                const normalizedOpts = (q.options || []).map((opt: any, oIdx: number) => {
                    const label = opt.label || opt.option_key || String.fromCharCode(65 + oIdx);
                    const optText = opt.text ?? opt.option_text ?? '';
                    return {
                        ...opt,
                        label,
                        option_key: label,
                        text: optText,
                        option_text: optText,
                        is_correct: !!opt.is_correct,
                        order: opt.order ?? oIdx
                    };
                });

                list.push({
                    ...q,
                    section_name: sec.section_name,
                    case_scenario_passage: q.case_scenario_passage || '',
                    options: normalizedOpts,
                    structured_table: tableObj,
                    table_data: tableObj,
                    subquestions: subqs,
                    matched_answer: {
                        ...ans,
                        structured_table: ansTableObj,
                        answer_table_data: ansTableObj
                    }
                });
            });
        });
        return list;
    }, [activeJob?.extracted_payload, activeBatch?.extracted_payload]);

    // Format analysis metrics and filter helpers
    const mcqCount = useMemo(() => {
        return allQuestions.filter(q => q.question_type === 'MCQ' || (q.options && q.options.length > 0)).length;
    }, [allQuestions]);

    const scenarioCount = useMemo(() => {
        return allQuestions.filter(q => (q.question_type === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0)) && q.question_type !== 'MCQ').length;
    }, [allQuestions]);

    const descriptiveCount = useMemo(() => {
        return allQuestions.filter(q => q.question_type !== 'MCQ' && !(q.options && q.options.length > 0) && q.question_type !== 'CASE_SCENARIO' && !(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0)).length;
    }, [allQuestions]);

    const filteredQuestions = useMemo(() => {
        if (qTypeFilter === 'MCQ') {
            return allQuestions.filter(q => q.question_type === 'MCQ' || (q.options && q.options.length > 0));
        }
        if (qTypeFilter === 'SCENARIO') {
            return allQuestions.filter(q => (q.question_type === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0)) && q.question_type !== 'MCQ');
        }
        if (qTypeFilter === 'DESCRIPTIVE') {
            return allQuestions.filter(q => q.question_type !== 'MCQ' && !(q.options && q.options.length > 0) && q.question_type !== 'CASE_SCENARIO' && !(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0));
        }
        return allQuestions;
    }, [allQuestions, qTypeFilter]);

    const handleSetQTypeFilter = (filter: 'ALL' | 'MCQ' | 'SCENARIO' | 'DESCRIPTIVE') => {
        setQTypeFilter(filter);
        if (filter === 'ALL') return;
        const matches = allQuestions.filter(q => {
            const isM = q.question_type === 'MCQ' || (q.options && q.options.length > 0);
            const isS = !isM && (q.question_type === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0));
            if (filter === 'MCQ') return isM;
            if (filter === 'SCENARIO') return isS;
            if (filter === 'DESCRIPTIVE') return !isM && !isS;
            return true;
        });
        if (matches.length > 0) {
            if (!matches.some(m => m.question_id === currentQuestion?.question_id)) {
                setSelectedQuestionId(matches[0].question_id);
            }
        }
    };

    // Current active question
    const currentQuestion = useMemo(() => {
        if (!allQuestions.length) return null;
        return allQuestions.find(q => q.question_id === selectedQuestionId) || allQuestions[0];
    }, [allQuestions, selectedQuestionId]);

    // Update question in activeJob payload
    const updateQuestionField = (field: string, value: any) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    q[field] = value;
                    if (field === 'options') {
                        q.options = (value || []).map((o: any, idx: number) => {
                            const lbl = o.label || o.option_key || String.fromCharCode(65 + idx);
                            const txt = o.text ?? o.option_text ?? '';
                            return {
                                ...o,
                                label: lbl,
                                option_key: lbl,
                                text: txt,
                                option_text: txt,
                                is_correct: !!o.is_correct,
                                order: o.order ?? idx
                            };
                        });
                    }
                    if (field === 'structured_table') {
                        q.table_data = value;
                    }
                    if (field === 'table_data') {
                        q.structured_table = value;
                    }
                    if (field === 'matched_answer') {
                        q.official_answer = value;
                    }
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Update a field on a specific subquestion
    const updateSubQuestionField = (sqIdx: number, field: string, value: any) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    if (subList[sqIdx]) {
                        subList[sqIdx][field] = value;
                        if (field === 'structured_table') {
                            subList[sqIdx].table_data = value;
                        }
                        if (field === 'table_data') {
                            subList[sqIdx].structured_table = value;
                        }
                    }
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Update an option on a specific subquestion
    const updateSubQuestionOption = (sqIdx: number, oIdx: number, arg3: string, arg4?: any) => {
        if (!activeJob || !currentQuestion) return;
        const field = arg4 !== undefined ? arg3 : 'text';
        const value = arg4 !== undefined ? arg4 : arg3;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    if (subList[sqIdx] && subList[sqIdx].options && subList[sqIdx].options[oIdx]) {
                        subList[sqIdx].options[oIdx][field] = value;
                        if (field === 'text' || field === 'option_text') {
                            subList[sqIdx].options[oIdx].text = value;
                            subList[sqIdx].options[oIdx].option_text = value;
                        }
                    }
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Set correct option on a specific subquestion
    const updateSubQuestionCorrectOption = (sqIdx: number, oIdx: number) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    if (subList[sqIdx] && subList[sqIdx].options) {
                        subList[sqIdx].options = subList[sqIdx].options.map((opt: any, idx: number) => ({
                            ...opt,
                            is_correct: idx === oIdx
                        }));
                        const corrOpt = subList[sqIdx].options[oIdx];
                        const corrKey = corrOpt.label || corrOpt.option_key || String.fromCharCode(65 + oIdx);
                        if (!subList[sqIdx].matched_answer) subList[sqIdx].matched_answer = {};
                        subList[sqIdx].matched_answer.correct_option = corrKey;
                        subList[sqIdx].matching_status = 'matched';
                    }
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Update answer field on a specific subquestion
    const updateSubQuestionAnswerField = (sqIdx: number, field: string, value: any) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    if (subList[sqIdx]) {
                        if (!subList[sqIdx].matched_answer) subList[sqIdx].matched_answer = {};
                        if (!subList[sqIdx].official_answer) subList[sqIdx].official_answer = {};
                        subList[sqIdx].matched_answer[field] = value;
                        subList[sqIdx].official_answer[field] = value;
                        if (field === 'solution_text') {
                            subList[sqIdx].matched_answer.answer_text = value;
                            subList[sqIdx].official_answer.answer_text = value;
                            subList[sqIdx].correct_answer = value;
                        }
                        if (field === 'structured_table') {
                            subList[sqIdx].matched_answer.answer_table_data = value;
                            subList[sqIdx].official_answer.answer_table_data = value;
                        }
                    }
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Toggle approval for a subquestion
    const handleToggleApproveSubQuestion = (sqIdx: number) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    if (subList[sqIdx]) {
                        subList[sqIdx].is_approved = !subList[sqIdx].is_approved;
                        q.is_approved = subList.every((s: any) => s.is_approved);
                    }
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Delete a subquestion
    const handleDeleteSubQuestion = (sqIdx: number) => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = (q.subquestions || q.sub_questions || []).filter((_: any, idx: number) => idx !== sqIdx);
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Add a new subquestion
    const handleAddSubQuestion = () => {
        if (!activeJob || !currentQuestion) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            for (const q of sec.questions || []) {
                if (q.question_id === currentQuestion.question_id) {
                    const subList = q.subquestions || q.sub_questions || [];
                    const letterCode = String.fromCharCode(97 + subList.length);
                    const newId = `${q.question_number}(${letterCode})`;
                    const newSub: any = {
                        identifier: newId,
                        original_question_number: q.question_number,
                        sub_question_number: newId,
                        question_type: currentQuestion.question_type === 'MCQ' ? 'MCQ' : 'NORMAL',
                        question_text: '',
                        marks: 2,
                        options: currentQuestion.question_type === 'MCQ' ? [
                            { label: 'A', option_key: 'A', text: '', is_correct: true, order: 0 },
                            { label: 'B', option_key: 'B', text: '', is_correct: false, order: 1 },
                            { label: 'C', option_key: 'C', text: '', is_correct: false, order: 2 },
                            { label: 'D', option_key: 'D', text: '', is_correct: false, order: 3 },
                        ] : [],
                        is_approved: false,
                        matching_status: 'needs_review',
                        matched_answer: {
                            answer_text: '',
                            solution_text: '',
                            working_notes: '',
                            confidence_score: 0.0,
                            matching_status: 'needs_review'
                        }
                    };
                    subList.push(newSub);
                    q.subquestions = subList;
                    q.sub_questions = subList;
                    break;
                }
            }
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
    };

    // Format check helper for the 3 distinct question types
    const checkQuestionFormat = (q: any) => {
        if (!q) return { status: 'error', label: 'No Question', message: 'No question selected' };

        const qType = q.question_type || 'NORMAL';
        const isScenario = qType === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim());
        const isMCQ = qType === 'MCQ';

        if (isScenario) {
            const hasPassage = !!(q.case_scenario_passage && q.case_scenario_passage.trim());
            const words = hasPassage ? q.case_scenario_passage.trim().split(/\s+/).length : 0;
            const subCount = (q.subquestions || []).length;
            if (!hasPassage) {
                return {
                    status: 'warning',
                    label: 'Format Notice: Empty Scenario Passage',
                    message: 'Case Scenario passage is empty. Enter or paste the narrative scenario above.'
                };
            }
            if (subCount > 0) {
                return {
                    status: 'valid',
                    label: 'Hierarchical Scenario Ready',
                    message: `Scenario passage is ready (${words} words) with ${subCount} linked sub-questions.`
                };
            }
            if (!q.question_text || !q.question_text.trim()) {
                return {
                    status: 'error',
                    label: 'Format Error: Missing Question Text',
                    message: 'Please provide the question prompt or add sub-questions to this scenario.'
                };
            }
            return {
                status: 'valid',
                label: 'Scenario Format Valid',
                message: `Scenario passage is ready (${words} words) with question stem.`
            };
        }

        if (isMCQ) {
            const opts = q.options || [];
            if (opts.length === 0) {
                return {
                    status: 'error',
                    label: 'Format Error: No MCQ Options',
                    message: 'No options found. Add options A, B, C, D or use "Split Options" button.'
                };
            }
            if (opts.length < 2) {
                return {
                    status: 'warning',
                    label: 'Format Notice: Fewer than 2 Options',
                    message: `Only ${opts.length} option present. CA MCQs require 4 options (A, B, C, D).`
                };
            }
            const emptyOpt = opts.find((o: any) => !(o.text || o.option_text || '').trim());
            if (emptyOpt) {
                return {
                    status: 'warning',
                    label: 'Format Notice: Blank Option Text',
                    message: `Option ${emptyOpt.label || emptyOpt.option_key} text is empty. Enter option text.`
                };
            }
            const correctCount = opts.filter((o: any) => !!o.is_correct).length;
            if (correctCount === 0) {
                return {
                    status: 'warning',
                    label: 'Format Notice: No Correct Option Marked',
                    message: 'Select the official correct option using the radio button.'
                };
            }
            const correctOpt = opts.find((o: any) => !!o.is_correct);
            return {
                status: 'valid',
                label: 'MCQ Format Valid',
                message: `${opts.length} Options filled • Option ${correctOpt?.label || correctOpt?.option_key} marked as official answer.`
            };
        }

        // Normal Theory / Practical Problem
        if (!q.question_text || !q.question_text.trim()) {
            return {
                status: 'error',
                label: 'Format Error: Empty Question Text',
                message: 'Question statement cannot be empty.'
            };
        }
        const subCount = (q.subquestions || []).length;
        const hasTable = !!(q.structured_table || q.table_data);
        return {
            status: 'valid',
            label: 'Theory Format Valid',
            message: `Descriptive Question • ${q.marks || 0} Marks${subCount > 0 ? ` • ${subCount} Subparts` : ''}${hasTable ? ' • Accounting Table attached' : ''}.`
        };
    };

    // Helper: Split MCQ Options from question_text if bunched together
    const splitOptionsFromQuestionText = () => {
        if (!currentQuestion) return;
        const text = currentQuestion.question_text || '';
        if (!text.trim()) return;

        // Regex for (A) / (a) / A. / A) patterns
        const regex = /(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])[\.\)])\s*([\s\S]+?)(?=(?:\s*\([A-Da-d]\)|\s*[A-Da-d][\.\)]|$))/g;
        const matches: any[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            const label = (match[1] || match[2] || '').toUpperCase();
            const optContent = (match[3] || '').trim();
            if (label && optContent) {
                matches.push({ label, text: optContent });
            }
        }

        if (matches.length >= 2) {
            const firstIndex = text.search(/(?:\([A-Da-d]\)|[A-Da-d][\.\)])/);
            const cleanStem = firstIndex > 0 ? text.slice(0, firstIndex).trim() : text;

            const existingCorrect = (currentQuestion.options || []).find((o: any) => o.is_correct)?.label;

            const newOptions = matches.map((m, idx) => ({
                label: m.label,
                option_key: m.label,
                text: m.text,
                option_text: m.text,
                is_correct: existingCorrect === m.label,
                order: idx
            }));

            updateQuestionField('question_text', cleanStem);
            updateQuestionField('options', newOptions);
            showToast(`✓ Extracted ${matches.length} MCQ options from question statement!`);
        } else {
            showToast('No (A), (B), (C), (D) options detected in question text.');
        }
    };

    // Helper: Add Option to current MCQ
    const handleAddOption = () => {
        if (!currentQuestion) return;
        const opts = [...(currentQuestion.options || [])];
        const nextChar = String.fromCharCode(65 + opts.length);
        opts.push({
            label: nextChar,
            option_key: nextChar,
            text: '',
            option_text: '',
            is_correct: false,
            order: opts.length
        });
        updateQuestionField('options', opts);
    };

    // Helper: Remove Option from current MCQ
    const handleRemoveOption = (indexToRemove: number) => {
        if (!currentQuestion) return;
        let opts = [...(currentQuestion.options || [])];
        opts.splice(indexToRemove, 1);
        // Re-label
        opts = opts.map((o, idx) => {
            const lbl = String.fromCharCode(65 + idx);
            return {
                ...o,
                label: lbl,
                option_key: lbl,
                order: idx
            };
        });
        updateQuestionField('options', opts);
    };


    // Toggle Approval for Current Question
    const toggleApproveQuestion = () => {
        if (!currentQuestion) return;
        const nextApproved = !currentQuestion.is_approved;
        updateQuestionField('is_approved', nextApproved);
        showToast(nextApproved ? `Approved Question ${currentQuestion.question_number}` : `Marked Question ${currentQuestion.question_number} as Pending`);
    };

    // Approve All
    const handleApproveAll = async () => {
        if (!activeJob) return;
        try {
            const resp = await api.post(`/materials/import-jobs/${activeJob.id}/approve/`, { approve_all: true });
            // update local state
            const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
            for (const sec of payload.sections || []) {
                for (const q of sec.questions || []) {
                    q.is_approved = true;
                }
            }
            setActiveJob({ ...activeJob, extracted_payload: payload });
            showToast(resp.data.message || 'All questions approved for publishing!');
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Failed to approve questions.');
        }
    };

    // Save Draft Payload
    const handleSaveDraft = async () => {
        if (!activeJob) return;
        setIsSavingDraft(true);
        try {
            await api.put(`/materials/import-jobs/${activeJob.id}/payload/`, {
                payload: activeJob.extracted_payload
            });
            showToast('Draft changes saved successfully to server.');
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Failed to save draft changes.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Publish to Live Database
    const handlePublish = async () => {
        if (!activeBatch && !activeJob) return;
        const approvedQuestions = allQuestions.filter(q => q.is_approved);
        const approvedCount = approvedQuestions.length;
        if (approvedCount === 0) {
            showToast('Please approve at least one question before publishing.');
            return;
        }

        // Validate approved questions structure and relationships
        for (const q of approvedQuestions) {
            const isScenario = q.question_type === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim());
            if (isScenario) {
                if (!q.case_scenario_passage || !q.case_scenario_passage.trim()) {
                    showToast(`Validation Warning: Question ${q.question_number} is a Case Scenario but has an empty scenario passage.`);
                    return;
                }
                const subqs = q.subquestions || [];
                for (const sq of subqs) {
                    if (!sq.question_text || !sq.question_text.trim()) {
                        showToast(`Validation Error: Sub-question ${sq.identifier} under Question ${q.question_number} has empty question text.`);
                        return;
                    }
                    if (sq.question_type === 'MCQ' && (!sq.options || sq.options.length < 2)) {
                        showToast(`Validation Error: MCQ Sub-question ${sq.identifier} requires at least 2 options.`);
                        return;
                    }
                }
            } else {
                if (!q.question_text || !q.question_text.trim()) {
                    showToast(`Validation Error: Question ${q.question_number} has empty question text.`);
                    return;
                }
            }
        }

        if (!confirm(`Are you sure you want to publish ${approvedCount} verified questions to the live question bank?`)) {
            return;
        }

        setIsPublishing(true);
        try {
            if (activeBatch) {
                const resp = await api.post(`/materials/import-batches/${activeBatch.id}/publish/`, {
                    approved_only: true
                });
                showToast(`🎉 ${resp.data.published_count || approvedCount} questions successfully published to Question Bank!`);
                const updated = (await api.get(`/materials/import-batches/${activeBatch.id}/`)).data;
                setActiveBatch(updated);
            } else if (activeJob) {
                const resp = await api.post(`/materials/import-jobs/${activeJob.id}/publish/`, {
                    approved_only: true
                });
                showToast(`🎉 ${resp.data.published_count || approvedCount} questions successfully published!`);
                const updated = (await api.get(`/materials/import-jobs/${activeJob.id}/`)).data;
                setActiveJob(updated);
            }
            setTimeout(() => navigate('/admin/questions'), 2000);
        } catch (err: any) {
            console.error('Publish error:', err);
            showToast(err.response?.data?.error || 'Publishing failed. Please check validation errors.');
        } finally {
            setIsPublishing(false);
        }
    };

    // Delete question from draft
    const handleDeleteQuestion = (qId: string) => {
        if (!activeJob || !confirm("Remove this question from the draft?")) return;
        const payload = JSON.parse(JSON.stringify(activeJob.extracted_payload));
        for (const sec of payload.sections || []) {
            sec.questions = (sec.questions || []).filter((q: any) => q.question_id !== qId);
        }
        setActiveJob({ ...activeJob, extracted_payload: payload });
        const remaining = payload.sections?.flatMap((s: any) => s.questions || []) || [];
        if (remaining.length > 0) {
            setSelectedQuestionId(remaining[0].question_id);
        }
        showToast('Question removed.');
    };

    // Handle Manual Match Overrides
    const handleOverrideMatch = (answerQNum: string) => {
        if (!currentQuestion || !activeJob) return;
        const answersList = activeJob.extracted_payload?.validation?.answers_list || [];
        const found = answersList.find((a: any) => a.question_number === answerQNum);

        updateQuestionField('matched_answer', {
            answer_id: found ? found.answer_id : '',
            answer_question_number: answerQNum,
            confidence_score: 1.0,
            review_flag: found ? 'MANUAL_MATCH' : 'UNMATCHED',
            solution_text: found ? found.solution_text : '',
            working_notes: found ? (found.working_notes || []).join('\n') : '',
            structured_table: found ? found.structured_table : null,
            ai_explanation: currentQuestion.matched_answer?.ai_explanation || ''
        });
        showToast(`Matched to Answer ${answerQNum}`);
    };

    return (
        <div className="ai-import-container">
            {/* Toast notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 99999,
                    background: '#0f172a', color: '#ffffff', border: '1px solid #334155',
                    borderRadius: '12px', padding: '1rem 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '420px',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <Sparkles size={20} color="#818cf8" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{toastMessage}</span>
                    <button onClick={() => setToastMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Top Navigation Header */}
            <div className="ai-import-header">
                <div className="ai-header-left">
                    <div className="ai-title-badge">
                        <Sparkles size={14} />
                        <span>Google Gemini Multimodal AI Pipeline</span>
                    </div>
                    <h1 className="ai-title">AI Question Paper & Answer Sheet Importer</h1>
                    <p className="ai-subtitle">
                        End-to-end automated parsing, financial ledger table extraction, and multi-signal solution matching for CA Foundation, Inter & Final.
                    </p>
                </div>

                <div className="ai-header-actions">
                    <div className="ai-model-pill" title="Configured via GEMINI_MODEL and GEMINI_FALLBACK_MODEL environment variables">
                        <div className="ai-pill-dot" />
                        <span>Gemini 3.5 Flash (Fallback: 3.8 Flash)</span>
                    </div>

                    {viewMode !== 'upload' && (
                        <button
                            className="ai-btn-secondary"
                            onClick={() => setViewMode('upload')}
                        >
                            <Upload size={16} />
                            <span>Upload New PDF</span>
                        </button>
                    )}

                    {activeJob && viewMode !== 'workspace' && (
                        <button
                            className="ai-btn-secondary"
                            onClick={() => setViewMode('workspace')}
                        >
                            <Eye size={16} />
                            <span>Review Workspace</span>
                        </button>
                    )}

                    <button
                        className="ai-btn-secondary"
                        onClick={() => {
                            setViewMode('history');
                            loadHistory();
                        }}
                    >
                        <Clock size={16} />
                        <span>Past Imports</span>
                    </button>
                </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* VIEW MODE: UPLOAD & CONFIGURATION */}
            {/* ───────────────────────────────────────────────────────────── */}
            {viewMode === 'upload' && (
                <div className="ai-upload-grid">
                    {/* Left: Uploader Card */}
                    <div className="ai-dropzone-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <h2 className="ai-card-title" style={{ margin: 0 }}>
                                <Upload size={20} color="#4f46e5" />
                                <span>Upload Examination Documents</span>
                            </h2>

                            <div className="ai-upload-tab-switcher" style={{ margin: 0 }}>
                                <button
                                    type="button"
                                    className={`ai-upload-tab-btn ${uploadMode === 'batch' ? 'active' : ''}`}
                                    onClick={() => setUploadMode('batch')}
                                >
                                    <Layers size={14} />
                                    <span>Multi-PDF Batch (Recommended)</span>
                                </button>
                                <button
                                    type="button"
                                    className={`ai-upload-tab-btn ${uploadMode === 'single' ? 'active' : ''}`}
                                    onClick={() => setUploadMode('single')}
                                >
                                    <FileText size={14} />
                                    <span>Single Q&A Pair</span>
                                </button>
                            </div>
                        </div>

                        {/* MODE 1: MULTI-PDF BATCH UPLOAD */}
                        {uploadMode === 'batch' ? (
                            <div>
                                <div className="ai-form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="ai-form-label">Batch Name / Description</label>
                                    <input
                                        type="text"
                                        className="ai-form-input"
                                        value={batchName}
                                        onChange={(e) => setBatchName(e.target.value)}
                                        placeholder="e.g. CA Inter Advanced Accounting - Sep 2026 MTP Batch"
                                    />
                                </div>

                                <div
                                    className={`ai-dropzone ${isDraggingBatch ? 'dragging' : ''} ${batchFiles.length > 0 ? 'has-file' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingBatch(true); }}
                                    onDragLeave={() => setIsDraggingBatch(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDraggingBatch(false);
                                        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type === 'application/pdf');
                                        if (files.length === 0) {
                                            showToast('Please drop valid PDF files.');
                                            return;
                                        }
                                        const newItems = files.map(f => {
                                            const lower = f.name.toLowerCase();
                                            const isAns = lower.includes('ans') || lower.includes('sol') || lower.includes('suggested');
                                            return {
                                                file: f,
                                                id: Math.random().toString(36).slice(2, 9),
                                                name: f.name,
                                                size: f.size,
                                                docType: (isAns ? 'SUGGESTED_ANSWER' : 'QUESTION_PAPER') as 'QUESTION_PAPER' | 'SUGGESTED_ANSWER' | 'COMBINED'
                                            };
                                        });
                                        setBatchFiles(prev => [...prev, ...newItems]);
                                    }}
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = '.pdf';
                                        input.multiple = true;
                                        input.onchange = (e: any) => {
                                            const files = Array.from(e.target.files || []) as File[];
                                            const newItems = files.map(f => {
                                                const lower = f.name.toLowerCase();
                                                const isAns = lower.includes('ans') || lower.includes('sol') || lower.includes('suggested');
                                                return {
                                                    file: f,
                                                    id: Math.random().toString(36).slice(2, 9),
                                                    name: f.name,
                                                    size: f.size,
                                                    docType: (isAns ? 'SUGGESTED_ANSWER' : 'QUESTION_PAPER') as 'QUESTION_PAPER' | 'SUGGESTED_ANSWER' | 'COMBINED'
                                                };
                                            });
                                            setBatchFiles(prev => [...prev, ...newItems]);
                                        };
                                        input.click();
                                    }}
                                >
                                    <div className="ai-dropzone-icon">
                                        <FolderPlus size={32} />
                                    </div>
                                    <div className="ai-dropzone-label">Drop Multiple Question & Answer PDFs</div>
                                    <div className="ai-dropzone-sub">
                                        Drag and drop multiple question papers and answer sheets simultaneously. Gemini automatically classifies and pairs them.
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600, marginTop: '0.5rem' }}>
                                        Click to browse or drag PDF files here (Multiple allowed)
                                    </span>
                                </div>

                                {batchFiles.length > 0 && (
                                    <div className="ai-batch-file-list">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#334155' }}>
                                                Batch Documents ({batchFiles.length}):
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setBatchFiles([])}
                                                style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        {batchFiles.map((bf, idx) => (
                                            <div key={bf.id} className="ai-batch-file-item">
                                                <div className="ai-batch-file-info">
                                                    <div className="ai-batch-file-icon">
                                                        <FileText size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="ai-batch-file-name">{bf.name}</div>
                                                        <div className="ai-batch-file-size">{(bf.size / 1024 / 1024).toFixed(2)} MB</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <select
                                                        className={`ai-doctype-select ${bf.docType === 'QUESTION_PAPER' ? 'qp' : bf.docType === 'SUGGESTED_ANSWER' ? 'ans' : 'comb'}`}
                                                        value={bf.docType}
                                                        onChange={(e) => {
                                                            const updated = [...batchFiles];
                                                            updated[idx].docType = e.target.value as any;
                                                            setBatchFiles(updated);
                                                        }}
                                                    >
                                                        <option value="QUESTION_PAPER">Question Paper</option>
                                                        <option value="SUGGESTED_ANSWER">Suggested Answer</option>
                                                        <option value="COMBINED">Combined Q&A</option>
                                                    </select>

                                                    <button
                                                        type="button"
                                                        onClick={() => setBatchFiles(prev => prev.filter((_, i) => i !== idx))}
                                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                                                        title="Remove file"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* MODE 2: SINGLE Q&A PAIR DROPZONES */
                            <div>
                                <div className="ai-dropzones-wrapper">
                                    {/* Question Paper Dropzone */}
                                    <div
                                        className={`ai-dropzone ${isDraggingQp ? 'dragging' : ''} ${qpFile ? 'has-file' : ''}`}
                                        onDragOver={(e) => { e.preventDefault(); setIsDraggingQp(true); }}
                                        onDragLeave={() => setIsDraggingQp(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDraggingQp(false);
                                            const file = e.dataTransfer.files?.[0];
                                            if (file && file.type === 'application/pdf') setQpFile(file);
                                            else showToast('Please drop a valid PDF file.');
                                        }}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = '.pdf';
                                            input.onchange = (e: any) => {
                                                const file = e.target.files?.[0];
                                                if (file) setQpFile(file);
                                            };
                                            input.click();
                                        }}
                                    >
                                        <div className="ai-dropzone-icon">
                                            <FileText size={26} />
                                        </div>
                                        <div className="ai-dropzone-label">PDF 1: Question Paper</div>
                                        <div className="ai-dropzone-sub">ICAI Question Paper with MCQs & Problems</div>
                                        {qpFile ? (
                                            <div className="ai-file-preview-badge">
                                                <CheckCircle2 size={16} />
                                                <span>{qpFile.name} ({(qpFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>Click to browse or drag PDF here</span>
                                        )}
                                    </div>

                                    {/* Answer Sheet Dropzone */}
                                    <div
                                        className={`ai-dropzone ${isDraggingAns ? 'dragging' : ''} ${ansFile ? 'has-file' : ''}`}
                                        onDragOver={(e) => { e.preventDefault(); setIsDraggingAns(true); }}
                                        onDragLeave={() => setIsDraggingAns(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDraggingAns(false);
                                            const file = e.dataTransfer.files?.[0];
                                            if (file && file.type === 'application/pdf') setAnsFile(file);
                                            else showToast('Please drop a valid PDF file.');
                                        }}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = '.pdf';
                                            input.onchange = (e: any) => {
                                                const file = e.target.files?.[0];
                                                if (file) setAnsFile(file);
                                            };
                                            input.click();
                                        }}
                                    >
                                        <div className="ai-dropzone-icon">
                                            <FileSpreadsheet size={26} />
                                        </div>
                                        <div className="ai-dropzone-label">PDF 2: Official Answer Sheet</div>
                                        <div className="ai-dropzone-sub">Suggested answers & working notes (Optional)</div>
                                        {ansFile ? (
                                            <div className="ai-file-preview-badge">
                                                <CheckCircle2 size={16} />
                                                <span>{ansFile.name} ({(ansFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>Click to browse or drag PDF here</span>
                                        )}
                                    </div>
                                </div>

                                {qpFile && (
                                    <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>📄 Detected <strong>{qpNumPages} pages</strong> in Question Paper</span>
                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Ready for Gemini Extraction</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Academic Context & Launch */}
                    <div className="ai-config-card">
                        <h2 className="ai-card-title">
                            <Layers size={20} color="#4f46e5" />
                            <span>Exam Classification & Target</span>
                        </h2>

                        <div className="ai-form-group">
                            <label className="ai-form-label">CA Course Level</label>
                            <select
                                className="ai-form-select"
                                value={caLevel}
                                onChange={(e) => setCaLevel(e.target.value)}
                            >
                                <option value="CA Foundation">CA Foundation</option>
                                <option value="CA Intermediate">CA Intermediate</option>
                                <option value="CA Final">CA Final</option>
                            </select>
                        </div>

                        <div className="ai-form-group">
                            <label className="ai-form-label">Exam Session & Year</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.5rem' }}>
                                <select
                                    className="ai-form-select"
                                    value={examSession}
                                    onChange={(e) => setExamSession(e.target.value)}
                                >
                                    <option value="January 2026">January 2026</option>
                                    <option value="May 2026">May 2026</option>
                                    <option value="July 2026">July 2026</option>
                                    <option value="September 2026">September 2026</option>
                                    <option value="November 2025">November 2025</option>
                                    <option value="May 2025">May 2025</option>
                                </select>
                                <input
                                    type="number"
                                    className="ai-form-input"
                                    value={examYear}
                                    onChange={(e) => setExamYear(e.target.value)}
                                    placeholder="2026"
                                />
                            </div>
                        </div>

                        <div className="ai-form-group">
                            <label className="ai-form-label">Question Paper Source</label>
                            <select
                                className="ai-form-select"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                            >
                                <option value="Mock Test Paper – Series I">Mock Test Paper – Series I</option>
                                <option value="Mock Test Paper – Series II">Mock Test Paper – Series II</option>
                                <option value="Revision Test Paper (RTP)">Revision Test Paper (RTP)</option>
                                <option value="Suggested Answers / Past Exam">Suggested Answers / Past Exam</option>
                                <option value="Study Material Practice Question">Study Material Practice Question</option>
                            </select>
                        </div>

                        {/* Question Format Selector (MCQ Only / Which Type Selected) */}
                        <div className="ai-form-group">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                <label className="ai-form-label" style={{ margin: 0 }}>Target Question Type</label>
                                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>Extract Type Only</span>
                            </div>
                            <select
                                className="ai-form-select"
                                value={targetQuestionType}
                                onChange={(e) => setTargetQuestionType(e.target.value as any)}
                            >
                                <option value="ALL">All Question Types (MCQs & Descriptive)</option>
                                <option value="MCQ">🎯 MCQs Only (Extract & Import MCQs Only)</option>
                                <option value="DESCRIPTIVE">📝 Descriptive / Practical Problems Only</option>
                                <option value="CASE_SCENARIO">📖 Case Scenarios Only</option>
                            </select>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', marginTop: '0.4rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setTargetQuestionType('ALL')}
                                    style={{
                                        padding: '0.4rem 0.3rem',
                                        fontSize: '0.75rem',
                                        fontWeight: targetQuestionType === 'ALL' ? 700 : 500,
                                        borderRadius: '6px',
                                        border: targetQuestionType === 'ALL' ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                                        background: targetQuestionType === 'ALL' ? '#eef2ff' : '#ffffff',
                                        color: targetQuestionType === 'ALL' ? '#4f46e5' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    All Types
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetQuestionType('MCQ')}
                                    style={{
                                        padding: '0.4rem 0.3rem',
                                        fontSize: '0.75rem',
                                        fontWeight: targetQuestionType === 'MCQ' ? 700 : 500,
                                        borderRadius: '6px',
                                        border: targetQuestionType === 'MCQ' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                                        background: targetQuestionType === 'MCQ' ? '#ecfdf5' : '#ffffff',
                                        color: targetQuestionType === 'MCQ' ? '#059669' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🎯 MCQ Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetQuestionType('DESCRIPTIVE')}
                                    style={{
                                        padding: '0.4rem 0.3rem',
                                        fontSize: '0.75rem',
                                        fontWeight: targetQuestionType === 'DESCRIPTIVE' ? 700 : 500,
                                        borderRadius: '6px',
                                        border: targetQuestionType === 'DESCRIPTIVE' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                        background: targetQuestionType === 'DESCRIPTIVE' ? '#eff6ff' : '#ffffff',
                                        color: targetQuestionType === 'DESCRIPTIVE' ? '#2563eb' : '#64748b',
                                        cursor: 'pointer'
                                    }}
                                >
                                    📝 Descriptive
                                </button>
                            </div>
                        </div>

                        {/* ICAI Cascade (Level, Paper, Chapter - Topic Removed) */}
                        <div style={{ marginTop: '0.25rem' }}>
                            <label className="ai-form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Map to ICAI Syllabus (Optional)</label>
                            <ICAICascadeSelector
                                value={icaiFilter}
                                onChange={setIcaiFilter}
                                required={false}
                                compact={true}
                                hideTopic={true}
                            />
                        </div>

                        {uploadMode === 'batch' ? (
                            <button
                                className="ai-process-btn"
                                onClick={handleStartBatchImport}
                                disabled={batchFiles.length === 0 || isStarting}
                            >
                                {isStarting ? (
                                    <>
                                        <RefreshCw size={20} className="spin" />
                                        <span>Initializing Batch Pipeline...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        <span>Process Batch ({batchFiles.length} Docs) with Gemini</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                className="ai-process-btn"
                                onClick={handleStartImport}
                                disabled={!qpFile || isStarting}
                            >
                                {isStarting ? (
                                    <>
                                        <RefreshCw size={20} className="spin" />
                                        <span>Initializing Pipeline...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        <span>Process & Import Questions</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* VIEW MODE: ANIMATED PROCESSING PIPELINE */}
            {/* ───────────────────────────────────────────────────────────── */}
            {viewMode === 'processing' && (activeJob || activeBatch) && (() => {
                const currentStageLabel = activeJob?.stage_label || activeBatch?.stage_label || 'Extracting questions, options, ledger tables, and matching solutions...';
                const currentProgress = activeJob?.progress_percent || activeBatch?.progress_percent || 15;
                const currentStatus = activeJob?.status || activeBatch?.status || 'processing';
                const displayName = activeBatch ? activeBatch.name : 'Examination Papers';

                return (
                    <div className="ai-processing-card">
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#4f46e5' }}>
                            <RefreshCw size={32} className="spin" />
                        </div>

                        <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#0f172a' }}>
                            Processing {displayName}
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                            {currentStageLabel}
                        </p>

                        <div className="ai-progress-track">
                            <div className="ai-progress-bar" style={{ width: `${currentProgress}%` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                            <span>Stage: {currentStatus}</span>
                            <span>{currentProgress}% Complete</span>
                        </div>

                        {/* Timeline Steps */}
                        <div className="ai-timeline-steps">
                            <div className={`ai-timeline-step ${currentProgress >= 20 ? 'completed' : 'active'}`}>
                                <div className="ai-timeline-dot">1</div>
                                <span>PDF Extraction</span>
                            </div>
                            <div className={`ai-timeline-step ${currentProgress >= 35 ? 'completed' : currentProgress >= 20 ? 'active' : ''}`}>
                                <div className="ai-timeline-dot">2</div>
                                <span>Metadata</span>
                            </div>
                            <div className={`ai-timeline-step ${currentProgress >= 60 ? 'completed' : currentProgress >= 35 ? 'active' : ''}`}>
                                <div className="ai-timeline-dot">3</div>
                                <span>Question AI</span>
                            </div>
                            <div className={`ai-timeline-step ${currentProgress >= 80 ? 'completed' : currentProgress >= 60 ? 'active' : ''}`}>
                                <div className="ai-timeline-dot">4</div>
                                <span>Answer AI</span>
                            </div>
                            <div className={`ai-timeline-step ${currentProgress >= 95 ? 'completed' : currentProgress >= 80 ? 'active' : ''}`}>
                                <div className="ai-timeline-dot">5</div>
                                <span>Matching</span>
                            </div>
                            <div className={`ai-timeline-step ${currentProgress >= 100 ? 'completed' : ''}`}>
                                <div className="ai-timeline-dot">6</div>
                                <span>Review</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                            <button
                                className="ai-btn-secondary"
                                onClick={() => setViewMode('upload')}
                            >
                                Cancel & Return
                            </button>
                            {(activeJob?.extracted_payload || activeBatch?.extracted_payload) && (
                                <button
                                    className="ai-btn-publish"
                                    onClick={() => setViewMode('workspace')}
                                >
                                    <Eye size={16} />
                                    <span>Open Review Workspace</span>
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* VIEW MODE: 3-PANEL REVIEW WORKSPACE */}
            {/* ───────────────────────────────────────────────────────────── */}
            {viewMode === 'workspace' && activeJob && (
                <div className="ai-workspace-container">
                    {/* Top Workspace Stats Bar */}
                    <div className="ai-workspace-topbar">
                        <div className="ai-metrics-group">
                            {activeBatch && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#ede9fe', color: '#6d28d9', fontSize: '0.785rem', fontWeight: 800, padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                                    <Layers size={14} />
                                    <span>Batch: {activeBatch.name}</span>
                                </div>
                            )}
                            <div className="ai-metric-item">
                                <Database size={16} color="#6366f1" />
                                <span>Total: <strong>{allQuestions.length}</strong></span>
                            </div>
                            <div className="ai-metric-item">
                                <CheckCircle2 size={16} color="#10b981" />
                                <span>Approved: <strong>{allQuestions.filter(q => q.is_approved).length}</strong></span>
                            </div>
                            <div className="ai-metric-item" style={{ cursor: 'pointer' }} onClick={() => handleSetQTypeFilter('MCQ')}>
                                <span style={{ fontSize: '0.85rem' }}>🎯</span>
                                <span>MCQs: <strong>{mcqCount}</strong></span>
                            </div>
                            <div className="ai-metric-item" style={{ cursor: 'pointer' }} onClick={() => handleSetQTypeFilter('SCENARIO')}>
                                <span style={{ fontSize: '0.85rem' }}>📖</span>
                                <span>Scenarios: <strong>{scenarioCount}</strong></span>
                            </div>
                            <div className="ai-metric-item" style={{ cursor: 'pointer' }} onClick={() => handleSetQTypeFilter('DESCRIPTIVE')}>
                                <span style={{ fontSize: '0.85rem' }}>📝</span>
                                <span>Problems: <strong>{descriptiveCount}</strong></span>
                            </div>
                            <div className="ai-metric-item">
                                <Clock size={16} color="#64748b" />
                                <span>Time: <strong>{activeJob.processing_time_seconds || 0}s</strong></span>
                            </div>
                            <div className="ai-metric-item">
                                <DollarSign size={16} color="#10b981" />
                                <span>Est. Cost: <strong>${(activeJob.estimated_cost_usd || 0).toFixed(4)}</strong></span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                                className="ai-btn-secondary"
                                onClick={() => handleOpenAuditLogs()}
                                title="View batch audit history and publish events"
                            >
                                <History size={15} />
                                <span>Audit Logs</span>
                            </button>

                            <button
                                className="ai-btn-secondary"
                                onClick={handleSaveDraft}
                                disabled={isSavingDraft}
                            >
                                <Save size={15} />
                                <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                            </button>

                            <button
                                className="ai-btn-secondary"
                                onClick={handleApproveAll}
                                style={{ borderColor: '#10b981', color: '#10b981' }}
                            >
                                <Check size={15} />
                                <span>Approve All</span>
                            </button>

                            <button
                                className="ai-btn-publish"
                                onClick={handlePublish}
                                disabled={isPublishing}
                            >
                                <ShieldCheck size={16} />
                                <span>{isPublishing ? 'Publishing...' : activeBatch ? 'Publish Batch to Question Bank' : 'Publish to Question Bank'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Model Format Filter Bar */}
                    <div className="ai-type-filter-bar">
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Filter Model Format:
                        </span>
                        <button
                            type="button"
                            className={`ai-type-filter-chip ${qTypeFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => handleSetQTypeFilter('ALL')}
                        >
                            <span>All Questions</span>
                            <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>({allQuestions.length})</span>
                        </button>
                        <button
                            type="button"
                            className={`ai-type-filter-chip ${qTypeFilter === 'MCQ' ? 'active mcq' : ''}`}
                            onClick={() => handleSetQTypeFilter('MCQ')}
                        >
                            <span>🎯 MCQ Model</span>
                            <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>({mcqCount})</span>
                        </button>
                        <button
                            type="button"
                            className={`ai-type-filter-chip ${qTypeFilter === 'SCENARIO' ? 'active scenario' : ''}`}
                            onClick={() => handleSetQTypeFilter('SCENARIO')}
                        >
                            <span>📖 Case Scenarios</span>
                            <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>({scenarioCount})</span>
                        </button>
                        <button
                            type="button"
                            className={`ai-type-filter-chip ${qTypeFilter === 'DESCRIPTIVE' ? 'active descriptive' : ''}`}
                            onClick={() => handleSetQTypeFilter('DESCRIPTIVE')}
                        >
                            <span>📝 Normal / Descriptive</span>
                            <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>({descriptiveCount})</span>
                        </button>
                    </div>

                    {/* Question Selector Strip */}
                    <div className="ai-q-selector-strip">
                        {filteredQuestions.length === 0 ? (
                            <div style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>No questions match this format filter.</span>
                                <button
                                    type="button"
                                    onClick={() => handleSetQTypeFilter('ALL')}
                                    style={{ border: 'none', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                    Show All ({allQuestions.length})
                                </button>
                            </div>
                        ) : (
                            filteredQuestions.map((q) => {
                                const isSelected = q.question_id === currentQuestion?.question_id;
                                const isApproved = q.is_approved;
                                const isFlagged = q.matched_answer?.review_flag && q.matched_answer.review_flag !== 'MATCHED';
                                const isMcq = q.question_type === 'MCQ' || (q.options && q.options.length > 0);
                                const isScenario = !isMcq && (q.question_type === 'CASE_SCENARIO' || !!(q.case_scenario_passage && q.case_scenario_passage.trim().length > 0));

                                return (
                                    <button
                                        key={q.question_id}
                                        className={`ai-q-pill-btn ${isSelected ? 'active' : ''} ${isApproved ? 'approved' : ''} ${isFlagged ? 'flagged' : ''}`}
                                        onClick={() => setSelectedQuestionId(q.question_id)}
                                    >
                                        {isApproved ? <Check size={13} /> : isFlagged ? <AlertTriangle size={13} /> : null}
                                        <span className={`ai-pill-type-tag ${isMcq ? 'mcq' : isScenario ? 'scenario' : 'descriptive'}`}>
                                            {isMcq ? 'MCQ' : isScenario ? 'SCENARIO' : 'PROBLEM'}
                                        </span>
                                        <span>Q{q.question_number}</span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({q.marks}M)</span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* 3-Panel Main Layout */}
                    <div className={`ai-workspace-panels ${leftMinimized && rightMinimized ? 'both-minimized' : leftMinimized ? 'left-minimized' : rightMinimized ? 'right-minimized' : ''}`}>

                        {/* PANEL 1: ORIGINAL PDF VIEWER (WITH MULTI-DOC SWITCHER) */}
                        <div className={`ai-panel ${leftMinimized ? 'minimized' : ''}`}>
                            <div className="ai-panel-header">
                                {!leftMinimized && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                        <FileText size={17} color="#4f46e5" />
                                        {activeBatch?.documents && activeBatch.documents.length > 1 ? (
                                            <select
                                                value={selectedDocId || activeBatch.documents[0].id}
                                                onChange={(e) => {
                                                    setSelectedDocId(e.target.value);
                                                    setQpCurrentPage(1);
                                                }}
                                                style={{ fontSize: '0.785rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', maxWidth: '240px' }}
                                            >
                                                {activeBatch.documents.map((d: any) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.filename} ({d.file_type || d.inferred_type})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Original Examination PDF</span>
                                        )}
                                    </div>
                                )}
                                <button
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                    onClick={() => setLeftMinimized(!leftMinimized)}
                                    title={leftMinimized ? 'Expand PDF Panel' : 'Minimize PDF Panel'}
                                >
                                    {leftMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                                </button>
                            </div>

                            {!leftMinimized && (
                                <div className="ai-panel-body" style={{ padding: '0.75rem' }}>
                                    {/* Page controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                            disabled={qpCurrentPage <= 1}
                                            onClick={() => setQpCurrentPage(p => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span>{loadingPdf ? 'Loading PDF pages...' : <>Page <strong>{qpCurrentPage}</strong> of {qpNumPages || 1}</>}</span>
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                            disabled={qpCurrentPage >= qpNumPages}
                                            onClick={() => setQpCurrentPage(p => Math.min(qpNumPages, p + 1))}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>

                                    {/* Canvas viewer or Text fallback */}
                                    <div style={{ flex: 1, overflowY: 'auto', background: '#e2e8f0', borderRadius: '8px', padding: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                        {(() => {
                                            const activeDoc = activeBatch?.documents?.find((d: any) => d.id === selectedDocId) || activeBatch?.documents?.[0];
                                            const docFile = batchFiles.find(bf => bf.name === activeDoc?.filename)?.file || qpFile;
                                            const docUrl = activeDoc?.file_url || activeJob.question_pdf_url;

                                            if (docFile) {
                                                return <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '4px' }} />;
                                            } else if (docUrl) {
                                                return (
                                                    <iframe
                                                        src={`${docUrl}#page=${qpCurrentPage}`}
                                                        style={{ width: '100%', height: '100%', border: 'none', minHeight: '600px' }}
                                                        title="Examination PDF"
                                                    />
                                                );
                                            } else {
                                                return (
                                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                                        PDF preview ready in viewer.
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PANEL 2: EXTRACTED QUESTION EDITOR */}
                        <div className="ai-panel">
                            <div className="ai-panel-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Sparkles size={17} color="#4f46e5" />
                                    <span>Extracted Question {currentQuestion ? `Q${currentQuestion.question_number}` : ''}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {currentQuestion && (
                                        <button
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                border: currentQuestion.is_approved ? '1px solid #10b981' : '1px solid #cbd5e1',
                                                background: currentQuestion.is_approved ? '#10b981' : '#ffffff',
                                                color: currentQuestion.is_approved ? '#ffffff' : '#475569',
                                                display: 'flex', alignItems: 'center', gap: '0.35rem'
                                            }}
                                            onClick={toggleApproveQuestion}
                                        >
                                            <Check size={14} />
                                            <span>{currentQuestion.is_approved ? 'Approved' : 'Approve Question'}</span>
                                        </button>
                                    )}
                                    {currentQuestion && (
                                        <button
                                            type="button"
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                border: '1px solid #6366f1',
                                                background: '#eef2ff',
                                                color: '#4f46e5',
                                                display: 'flex', alignItems: 'center', gap: '0.35rem'
                                            }}
                                            onClick={() => {
                                                navigate('/admin/questions/new', {
                                                    state: {
                                                        prefillQuestion: {
                                                            ...currentQuestion,
                                                            source: activeJob?.source || activeBatch?.source || 'Mock Test Paper',
                                                            year: activeJob?.exam_year || activeBatch?.exam_year || 2026,
                                                            attempt: activeJob?.exam_session || activeBatch?.exam_session || 'MAY',
                                                            paper_id: (activeJob as any)?.paper || (activeBatch as any)?.paper || (activeJob as any)?.paper_id || (activeBatch as any)?.paper_id,
                                                            suggested_chapter_id: currentQuestion.suggested_chapter_id,
                                                            suggested_topic_id: currentQuestion.suggested_topic_id,
                                                        }
                                                    }
                                                });
                                            }}
                                            title="Open and edit this question in the comprehensive manual question form"
                                        >
                                            <ExternalLink size={14} />
                                            <span>Edit in Manual Form</span>
                                        </button>
                                    )}
                                    {currentQuestion && (
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                            onClick={() => handleDeleteQuestion(currentQuestion.question_id)}
                                            title="Delete this question"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="ai-panel-body">
                                {currentQuestion ? (
                                    <div className="ai-question-card">
                                        {/* Duplicate Warning Alert if flagged */}
                                        {currentQuestion.is_duplicate && (
                                            <div className="ai-duplicate-alert">
                                                <div className="ai-duplicate-alert-content">
                                                    <AlertTriangle size={18} color="#dc2626" />
                                                    <div>
                                                        <strong>Potential Duplicate Detected:</strong> Matches existing live question #{currentQuestion.duplicate_match_id} ({currentQuestion.duplicate_reason || 'Similar text and marks'}).
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        className="ai-tool-btn"
                                                        onClick={() => updateQuestionField('is_duplicate', false)}
                                                        title="Ignore duplicate alert and keep question"
                                                    >
                                                        Keep Anyway
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ai-tool-btn"
                                                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                                                        onClick={() => handleDeleteQuestion(currentQuestion.question_id)}
                                                        title="Discard duplicate question"
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Discard</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Question Format Analysis & Perfection Banner */}
                                        {(() => {
                                            const isCurMcq = currentQuestion.question_type === 'MCQ' || (currentQuestion.options && currentQuestion.options.length > 0);
                                            const isCurScenario = !isCurMcq && (currentQuestion.question_type === 'CASE_SCENARIO' || !!(currentQuestion.case_scenario_passage && currentQuestion.case_scenario_passage.trim().length > 0));
                                            const curFormat = isCurMcq ? 'mcq' : isCurScenario ? 'scenario' : 'descriptive';

                                            return (
                                                <div className={`ai-format-analysis-banner ${curFormat}`}>
                                                    <div className="ai-format-header-row">
                                                        <div className="ai-format-title-group">
                                                            <div className={`ai-format-icon-circle ${curFormat}`}>
                                                                {isCurMcq ? '🎯' : isCurScenario ? '📖' : '📝'}
                                                            </div>
                                                            <div>
                                                                <div className="ai-format-name">
                                                                    {isCurMcq
                                                                        ? 'AI Analysis: MCQ Model (Multiple Choice Question)'
                                                                        : isCurScenario
                                                                        ? 'AI Analysis: Integrated Case Scenario Model'
                                                                        : 'AI Analysis: Normal / Descriptive Problem Model'}
                                                                    <span className={`ai-pill-type-tag ${curFormat}`} style={{ marginLeft: '0.4rem' }}>
                                                                        {isCurMcq ? 'OBJECTIVE (A/B/C/D)' : isCurScenario ? 'CASE PASSAGE' : 'DESCRIPTIVE / PRACTICAL'}
                                                                    </span>
                                                                </div>
                                                                <p className="ai-format-subtitle">
                                                                    {isCurMcq
                                                                        ? `AI analyzed this question as an objective MCQ with ${currentQuestion.options?.length || 4} answer options and automated answer key matching.`
                                                                        : isCurScenario
                                                                        ? `AI analyzed this question as an integrated scenario with a shared case narrative premise.`
                                                                        : `AI analyzed this question as an examination accounting problem with financial statements, tables, and step-by-step marking scheme.`}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Quick Model Format Switcher */}
                                                        <div className="ai-format-switch-controls">
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>MODEL TYPE:</span>
                                                            <button
                                                                type="button"
                                                                className={`ai-format-switch-btn ${isCurMcq ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    updateQuestionField('question_type', 'MCQ');
                                                                    if (!currentQuestion.options || currentQuestion.options.length === 0) {
                                                                        updateQuestionField('options', [
                                                                            { label: 'A', option_key: 'A', text: '', option_text: '', is_correct: true, order: 0 },
                                                                            { label: 'B', option_key: 'B', text: '', option_text: '', is_correct: false, order: 1 },
                                                                            { label: 'C', option_key: 'C', text: '', option_text: '', is_correct: false, order: 2 },
                                                                            { label: 'D', option_key: 'D', text: '', option_text: '', is_correct: false, order: 3 }
                                                                        ]);
                                                                    }
                                                                }}
                                                            >
                                                                🎯 MCQ Model
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`ai-format-switch-btn ${isCurScenario ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    updateQuestionField('question_type', 'CASE_SCENARIO');
                                                                    if (!currentQuestion.case_scenario_passage) {
                                                                        updateQuestionField('case_scenario_passage', 'Case Scenario Background:\n');
                                                                    }
                                                                }}
                                                            >
                                                                📖 Case Scenario
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`ai-format-switch-btn ${!isCurMcq && !isCurScenario ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    updateQuestionField('question_type', currentQuestion.structured_table || currentQuestion.table_data ? 'ACCOUNTING_PROBLEM' : 'NORMAL');
                                                                }}
                                                            >
                                                                📝 Normal / Problem
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* AI Auto-Classification & Taxonomy Match Card */}
                                        <div className="ai-taxonomy-card">
                                            <div className="ai-taxonomy-row">
                                                <div className="ai-taxonomy-badges">
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>ICAI Classification:</span>
                                                    <span className="ai-taxonomy-badge">
                                                        <Layers size={13} />
                                                        <span>{currentQuestion.suggested_paper_name || caLevel}</span>
                                                    </span>
                                                    <span className="ai-taxonomy-badge">
                                                        <BookOpen size={13} />
                                                        <span>Chapter: <strong>{currentQuestion.suggested_chapter_name || 'General / Unclassified'}</strong></span>
                                                    </span>
                                                    {currentQuestion.suggested_topic_name && (
                                                        <span className="ai-taxonomy-badge" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                                                            <span>Topic: {currentQuestion.suggested_topic_name}</span>
                                                        </span>
                                                    )}
                                                    {currentQuestion.classification_confidence && (
                                                        <span className="ai-taxonomy-confidence">
                                                            🎯 {Math.round(currentQuestion.classification_confidence * 100)}% Match
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Quick Add if proposed chapter is new */}
                                                {currentQuestion.is_new_proposed_chapter && currentQuestion.suggested_chapter_name && (
                                                    <button
                                                        type="button"
                                                        className="ai-tool-btn primary"
                                                        onClick={() => handleQuickAddChapter(currentQuestion.suggested_chapter_name)}
                                                        title="Add this AI-proposed chapter to the official ICAI database table"
                                                    >
                                                        <Plus size={13} />
                                                        <span>Quick Add Chapter to Master Data</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* 1. Meta row: Number, Type fine-selector, Marks */}
                                        <div className="ai-card-meta-row" style={{ marginTop: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Q No:</label>
                                                <input
                                                    type="text"
                                                    value={currentQuestion.question_number || ''}
                                                    onChange={(e) => updateQuestionField('question_number', e.target.value)}
                                                    style={{ width: '60px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Category:</label>
                                                <select
                                                    value={currentQuestion.question_type || 'NORMAL'}
                                                    onChange={(e) => updateQuestionField('question_type', e.target.value)}
                                                    style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    <option value="ACCOUNTING_PROBLEM">Accounting Problem</option>
                                                    <option value="MCQ">MCQ (Multiple Choice)</option>
                                                    <option value="NORMAL">Descriptive / Practical</option>
                                                    <option value="THEORY">Theory</option>
                                                    <option value="CASE_SCENARIO">Case Scenario</option>
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Marks:</label>
                                                <input
                                                    type="number"
                                                    value={currentQuestion.marks || 0}
                                                    onChange={(e) => updateQuestionField('marks', parseFloat(e.target.value) || 0)}
                                                    style={{ width: '60px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                                                />
                                            </div>
                                        </div>

                                        {/* 2. Three Distinct Question Types Switcher */}
                                        <div className="ai-type-segmented-control">
                                            <button
                                                type="button"
                                                className={`ai-type-pill-btn ${currentQuestion.question_type === 'CASE_SCENARIO' || !!(currentQuestion.case_scenario_passage && currentQuestion.case_scenario_passage.trim()) ? 'active scenario' : ''}`}
                                                onClick={() => {
                                                    updateQuestionField('question_type', 'CASE_SCENARIO');
                                                    if (!currentQuestion.case_scenario_passage) {
                                                        updateQuestionField('case_scenario_passage', ' ');
                                                    }
                                                }}
                                            >
                                                <BookOpen size={15} />
                                                <span>1. Case Scenario</span>
                                                {currentQuestion.case_scenario_passage?.trim() && (
                                                    <span className="ai-badge-count">{currentQuestion.case_scenario_passage.trim().split(/\s+/).length}w</span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className={`ai-type-pill-btn ${currentQuestion.question_type === 'MCQ' ? 'active mcq' : ''}`}
                                                onClick={() => {
                                                    updateQuestionField('question_type', 'MCQ');
                                                    if (!(currentQuestion.options && currentQuestion.options.length)) {
                                                        updateQuestionField('options', [
                                                            { label: 'A', option_key: 'A', text: '', option_text: '', is_correct: true, order: 0 },
                                                            { label: 'B', option_key: 'B', text: '', option_text: '', is_correct: false, order: 1 },
                                                            { label: 'C', option_key: 'C', text: '', option_text: '', is_correct: false, order: 2 },
                                                            { label: 'D', option_key: 'D', text: '', option_text: '', is_correct: false, order: 3 },
                                                        ]);
                                                    }
                                                }}
                                            >
                                                <ListChecks size={15} />
                                                <span>2. MCQ Question</span>
                                                {(currentQuestion.options || []).length > 0 && (
                                                    <span className="ai-badge-count">{(currentQuestion.options || []).length} Opts</span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className={`ai-type-pill-btn ${['NORMAL', 'THEORY', 'ACCOUNTING_PROBLEM'].includes(currentQuestion.question_type) && !currentQuestion.case_scenario_passage?.trim() ? 'active theory' : ''}`}
                                                onClick={() => {
                                                    updateQuestionField('question_type', currentQuestion.structured_table || currentQuestion.table_data ? 'ACCOUNTING_PROBLEM' : 'NORMAL');
                                                }}
                                            >
                                                <FileSpreadsheet size={15} />
                                                <span>3. Normal Theory / Problem</span>
                                            </button>
                                        </div>

                                        {/* 3. Real-Time Format Check Status Banner */}
                                        {(() => {
                                            const check = checkQuestionFormat(currentQuestion);
                                            return (
                                                <div className={`ai-format-check-banner ${check.status}`}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                                        {check.status === 'valid' ? (
                                                            <CheckCheck size={16} color="#16a34a" />
                                                        ) : check.status === 'warning' ? (
                                                            <AlertTriangle size={16} color="#d97706" />
                                                        ) : (
                                                            <AlertCircle size={16} color="#dc2626" />
                                                        )}
                                                        <div>
                                                            <strong style={{ fontSize: '0.8rem', display: 'block' }}>{check.label}</strong>
                                                            <span style={{ fontSize: '0.76rem', opacity: 0.9 }}>{check.message}</span>
                                                        </div>
                                                    </div>
                                                    {currentQuestion.question_type === 'MCQ' && (currentQuestion.question_text || '').search(/(?:\([A-Da-d]\)|[A-Da-d][\.\)])/) !== -1 && (
                                                        <button
                                                            type="button"
                                                            className="ai-tool-btn primary"
                                                            onClick={splitOptionsFromQuestionText}
                                                            title="Automatically extract (A), (B), (C), (D) options from question text into option boxes"
                                                        >
                                                            <Scissors size={13} />
                                                            <span>Auto-Extract Options</span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* 4. CASE SCENARIO / MAIN PASSAGE (Extracted ONCE at the top of parent question) */}
                                        {(currentQuestion.question_type === 'CASE_SCENARIO' || !!(currentQuestion.case_scenario_passage && currentQuestion.case_scenario_passage.trim())) ? (
                                            <div className="ai-scenario-box">
                                                <div className="ai-scenario-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                        <BookOpen size={16} color="#7c3aed" />
                                                        <strong style={{ fontSize: '0.875rem', color: '#5b21b6' }}>
                                                            Case Scenario / Main Passage
                                                        </strong>
                                                        <span style={{ fontSize: '0.725rem', background: '#ede9fe', color: '#6d28d9', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                                            {(currentQuestion.case_scenario_passage || '').trim().split(/\s+/).filter(Boolean).length} words
                                                        </span>
                                                        {currentQuestion.original_question_number && (
                                                            <span style={{ fontSize: '0.7rem', background: '#f3e8ff', color: '#7e22ce', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                Source Q: {currentQuestion.original_question_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <button
                                                            type="button"
                                                            className="ai-tool-btn"
                                                            onClick={() => setIsScenarioCollapsed(!isScenarioCollapsed)}
                                                            title={isScenarioCollapsed ? 'Expand Case Scenario' : 'Collapse Case Scenario'}
                                                        >
                                                            {isScenarioCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                            <span>{isScenarioCollapsed ? 'Expand Scenario' : 'Collapse Scenario'}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ai-tool-btn"
                                                            onClick={() => updateQuestionField('case_scenario_passage', '')}
                                                            title="Clear scenario passage"
                                                            style={{ color: '#ef4444' }}
                                                        >
                                                            <Trash2 size={12} />
                                                            <span>Remove Passage</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {!isScenarioCollapsed ? (
                                                    <>
                                                        <textarea
                                                            className="ai-scenario-textarea"
                                                            rows={6}
                                                            value={currentQuestion.case_scenario_passage || ''}
                                                            onChange={(e) => updateQuestionField('case_scenario_passage', e.target.value)}
                                                            placeholder="Complete original scenario paragraph extracted from the PDF. Preserves all relevant sentences, facts, names, dates, figures, and numerical data."
                                                        />
                                                        {/* Preserved Scenario Table / Figures */}
                                                        {(currentQuestion.scenario_table_data || currentQuestion.structured_table || currentQuestion.table_data) && (
                                                            <div style={{ marginTop: '0.65rem' }}>
                                                                <AccountingTableEditor
                                                                    table={currentQuestion.scenario_table_data || currentQuestion.structured_table || currentQuestion.table_data}
                                                                    onChange={(t) => {
                                                                        updateQuestionField('scenario_table_data', t);
                                                                        updateQuestionField('structured_table', t);
                                                                        updateQuestionField('table_data', t);
                                                                    }}
                                                                    label="Scenario Tables & Numerical Figures"
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div
                                                        style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#6b21a8', fontStyle: 'italic', background: '#f5f3ff', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                                        onClick={() => setIsScenarioCollapsed(false)}
                                                        title="Click to expand full scenario"
                                                    >
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                                            {currentQuestion.case_scenario_passage?.trim()}
                                                        </span>
                                                        <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#7c3aed' }}>[Click to Expand]</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Button to attach scenario if question needs one */
                                            <button
                                                type="button"
                                                className="ai-tool-btn"
                                                style={{ alignSelf: 'flex-start', padding: '0.35rem 0.75rem', color: '#7c3aed', borderColor: '#ddd6fe', background: '#faf5ff' }}
                                                onClick={() => updateQuestionField('case_scenario_passage', ' ')}
                                            >
                                                <Plus size={14} />
                                                <span>+ Attach Case Scenario Passage to Question {currentQuestion.question_number}</span>
                                            </button>
                                        )}

                                        {/* 5. LINKED SUB-QUESTIONS SECTION */}
                                        {(currentQuestion.subquestions || []).length > 0 ? (
                                            <div className="ai-subquestions-section">
                                                <div className="ai-subquestions-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <ListChecks size={18} color="#4f46e5" />
                                                        <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                                            Linked Sub-Questions ({(currentQuestion.subquestions || []).length})
                                                        </strong>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                            (Scenario extracted once at parent top; sub-questions displayed below with individual suggested answers)
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="ai-tool-btn primary"
                                                        onClick={handleAddSubQuestion}
                                                        title="Add a new sub-question under this parent question"
                                                    >
                                                        <Plus size={13} />
                                                        <span>Add Sub-Question</span>
                                                    </button>
                                                </div>

                                                {(currentQuestion.subquestions || []).map((sq: any, sqIdx: number) => {
                                                    const sqIdentifier = sq.identifier || sq.sub_question_number || sq.sub_number || `${currentQuestion.question_number}(${String.fromCharCode(97 + sqIdx)})`;
                                                    const isMcq = (sq.question_type === 'MCQ') || ((sq.options || []).length > 0);
                                                    const matchStatus = (sq.matching_status || (sq.matched_answer ? 'matched' : 'needs_review')).toLowerCase();
                                                    const isMatched = matchStatus === 'matched';
                                                    const isApproved = !!sq.is_approved;

                                                    return (
                                                        <div key={sqIdx} className="ai-subquestion-card">
                                                            {/* Sub-Question Header */}
                                                            <div className="ai-subq-card-header">
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                    <span className="ai-subq-badge">
                                                                        Sub-Question {sqIdentifier}
                                                                    </span>
                                                                    {sq.original_question_number && sq.original_question_number !== sqIdentifier && (
                                                                        <span className="ai-subq-orig-pill" title="Original Question Number in Source PDF">
                                                                            Orig: {sq.original_question_number}
                                                                        </span>
                                                                    )}
                                                                    <span className={`ai-subq-type-pill ${isMcq ? 'mcq' : 'descriptive'}`}>
                                                                        {isMcq ? 'MCQ' : 'Descriptive'}
                                                                    </span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Marks:</span>
                                                                        <input
                                                                            type="number"
                                                                            className="ai-subq-marks-pill"
                                                                            style={{ width: '50px', padding: '0.1rem 0.35rem' }}
                                                                            value={sq.marks || 0}
                                                                            onChange={(e) => updateSubQuestionField(sqIdx, 'marks', parseFloat(e.target.value) || 0)}
                                                                        />
                                                                    </div>
                                                                    <span className={`ai-match-status-badge ${isMatched ? 'matched' : 'needs-review'}`}>
                                                                        {isMatched ? '✓ MATCHED' : '⚠ NEEDS REVIEW'}
                                                                    </span>
                                                                </div>

                                                                <div className="ai-subq-actions">
                                                                    <button
                                                                        type="button"
                                                                        className={`ai-subq-approve-btn ${isApproved ? 'approved' : ''}`}
                                                                        onClick={() => handleToggleApproveSubQuestion(sqIdx)}
                                                                        title={isApproved ? 'Sub-question approved for publishing' : 'Click to approve sub-question'}
                                                                    >
                                                                        <CheckCircle2 size={13} />
                                                                        <span>{isApproved ? 'Approved' : 'Approve'}</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="ai-subq-delete-btn"
                                                                        onClick={() => handleDeleteSubQuestion(sqIdx)}
                                                                        title="Delete this sub-question"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Sub-Question Statement */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                                                    Sub-Question {sqIdentifier} Statement
                                                                </label>
                                                                <textarea
                                                                    className="ai-subq-textarea"
                                                                    rows={3}
                                                                    value={sq.question_text || sq.sub_text || ''}
                                                                    onChange={(e) => updateSubQuestionField(sqIdx, 'question_text', e.target.value)}
                                                                    placeholder={`Enter actual sub-question statement for ${sqIdentifier} (do not repeat scenario text here)...`}
                                                                />
                                                            </div>

                                                            {/* Sub-Question MCQ Options (if MCQ) */}
                                                            {isMcq && (
                                                                <div className="ai-subq-mcq-box">
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' }}>
                                                                            MCQ Options (Select the official correct option)
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="ai-tool-btn"
                                                                            style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                                                                            onClick={() => {
                                                                                const opts = sq.options || [];
                                                                                const nextLabel = String.fromCharCode(65 + opts.length);
                                                                                const newOpts = [...opts, { label: nextLabel, option_key: nextLabel, text: '', is_correct: false }];
                                                                                updateSubQuestionField(sqIdx, 'options', newOpts);
                                                                            }}
                                                                        >
                                                                            <Plus size={11} />
                                                                            <span>Add Option</span>
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                        {(sq.options || []).map((opt: any, oIdx: number) => {
                                                                            const optLabel = opt.label || opt.option_key || String.fromCharCode(65 + oIdx);
                                                                            const optText = opt.text ?? opt.option_text ?? '';
                                                                            const isCorrect = !!opt.is_correct;
                                                                            return (
                                                                                <div key={oIdx} className={`ai-option-item-enhanced ${isCorrect ? 'correct' : ''}`} style={{ padding: '0.35rem 0.5rem' }}>
                                                                                    <input
                                                                                        type="radio"
                                                                                        className="ai-option-radio-btn"
                                                                                        name={`subq_opt_${sqIdx}_${currentQuestion.question_id}`}
                                                                                        checked={isCorrect}
                                                                                        onChange={() => updateSubQuestionCorrectOption(sqIdx, oIdx)}
                                                                                        title={`Mark Option ${optLabel} as official correct answer`}
                                                                                    />
                                                                                    <div className="ai-option-badge-label" style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}>
                                                                                        {optLabel}
                                                                                    </div>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="ai-option-text-input"
                                                                                        value={optText}
                                                                                        onChange={(e) => updateSubQuestionOption(sqIdx, oIdx, e.target.value)}
                                                                                        placeholder={`Option ${optLabel} statement text`}
                                                                                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.45rem' }}
                                                                                    />
                                                                                    {isCorrect && (
                                                                                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#10b981', color: '#fff', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                                                                            Correct ✓
                                                                                        </span>
                                                                                    )}
                                                                                    {(sq.options || []).length > 2 && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="ai-option-delete-btn"
                                                                                            onClick={() => {
                                                                                                const newOpts = sq.options.filter((_: any, idx: number) => idx !== oIdx);
                                                                                                updateSubQuestionField(sqIdx, 'options', newOpts);
                                                                                            }}
                                                                                            title={`Delete option ${optLabel}`}
                                                                                        >
                                                                                            <Trash2 size={12} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Sub-Question Accounting Table (if present) */}
                                                            {(sq.structured_table || sq.table_data) && (
                                                                <AccountingTableEditor
                                                                    table={sq.structured_table || sq.table_data}
                                                                    onChange={(t) => {
                                                                        updateSubQuestionField(sqIdx, 'structured_table', t);
                                                                        updateSubQuestionField(sqIdx, 'table_data', t);
                                                                    }}
                                                                    label={`Sub-Question ${sqIdentifier} Financial / Ledger Table`}
                                                                />
                                                            )}

                                                            {/* Suggested Answer directly below each Sub-Question */}
                                                            <div className="ai-subq-answer-card">
                                                                <div className="ai-subq-answer-header">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                                        <CheckCircle2 size={15} color="#15803d" />
                                                                        <strong style={{ fontSize: '0.82rem', color: '#166534' }}>
                                                                            Suggested Answer {sqIdentifier}
                                                                        </strong>
                                                                        {sq.matched_answer?.confidence_score !== undefined && (
                                                                            <span className={`ai-confidence-pill ${(sq.matched_answer?.confidence_score || 0) >= 0.8 ? 'ai-confidence-high' : 'ai-confidence-low'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                                                                                {Math.round((sq.matched_answer?.confidence_score || 0) * 100)}% Match
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {sq.matched_answer?.answer_source_document && (
                                                                        <span style={{ fontSize: '0.7rem', color: '#166534', opacity: 0.85 }}>
                                                                            Source: {sq.matched_answer.answer_source_document}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534' }}>
                                                                        {isMcq ? 'Official Option & Solution' : 'Suggested Answer Content'}
                                                                    </label>
                                                                    <textarea
                                                                        className="ai-subq-ans-textarea"
                                                                        rows={isMcq ? 2 : 4}
                                                                        value={sq.matched_answer?.solution_text || sq.matched_answer?.answer_text || ''}
                                                                        onChange={(e) => updateSubQuestionAnswerField(sqIdx, 'solution_text', e.target.value)}
                                                                        placeholder={`Suggested official answer for Sub-Question ${sqIdentifier}...`}
                                                                    />
                                                                </div>
                                                                {!isMcq && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534' }}>Working Notes & Step Calculations</label>
                                                                        <textarea
                                                                            className="ai-subq-ans-textarea"
                                                                            rows={2}
                                                                            value={sq.matched_answer?.working_notes || ''}
                                                                            onChange={(e) => updateSubQuestionAnswerField(sqIdx, 'working_notes', e.target.value)}
                                                                            placeholder="ICAI step-marking notes, statutory references, or workings..."
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* STANDALONE QUESTION (NO SUB-QUESTIONS) */
                                            <>
                                                {/* Main Question Text */}
                                                <div className="ai-form-group">
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <label className="ai-form-label">Question Text</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <button
                                                                type="button"
                                                                className="ai-tool-btn"
                                                                style={{ fontSize: '0.725rem', padding: '0.15rem 0.45rem' }}
                                                                onClick={handleAddSubQuestion}
                                                                title="Add sub-questions (e.g. 1(a), 1(b)) under this question"
                                                            >
                                                                <Plus size={11} />
                                                                <span>Add Sub-Question</span>
                                                            </button>
                                                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                                                                {(currentQuestion.question_text || '').length} characters
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        rows={4}
                                                        value={currentQuestion.question_text || ''}
                                                        onChange={(e) => updateQuestionField('question_text', e.target.value)}
                                                        placeholder="Enter question statement..."
                                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', lineHeight: '1.4', outline: 'none' }}
                                                    />
                                                </div>

                                                {/* MCQ Options Suite */}
                                                {currentQuestion.question_type === 'MCQ' && (
                                                    <div className="ai-mcq-container">
                                                        <div className="ai-mcq-header">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <ListChecks size={16} color="#0284c7" />
                                                                <strong style={{ fontSize: '0.875rem', color: '#0369a1' }}>
                                                                    MCQ Options (Select the official correct option)
                                                                </strong>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <button
                                                                    type="button"
                                                                    className="ai-tool-btn"
                                                                    onClick={splitOptionsFromQuestionText}
                                                                    title="Extract options if text contains (A)... (B)... (C)... (D)..."
                                                                >
                                                                    <Scissors size={13} />
                                                                    <span>Split Options from Text</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ai-tool-btn primary"
                                                                    onClick={handleAddOption}
                                                                    title="Add another option (e.g. Option E)"
                                                                >
                                                                    <Plus size={13} />
                                                                    <span>Add Option</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {(currentQuestion.options || []).map((opt: any, oIdx: number) => {
                                                                const optText = opt.text ?? opt.option_text ?? '';
                                                                const optLabel = opt.label || opt.option_key || String.fromCharCode(65 + oIdx);
                                                                const isSelected = !!opt.is_correct;
                                                                return (
                                                                    <div key={oIdx} className={`ai-option-item-enhanced ${isSelected ? 'correct' : ''}`}>
                                                                        <input
                                                                            type="radio"
                                                                            className="ai-option-radio-btn"
                                                                            name={`opt_correct_${currentQuestion.question_id}`}
                                                                            checked={isSelected}
                                                                            onChange={() => {
                                                                                const optList = (currentQuestion.options || []).map((o: any, idx: number) => ({
                                                                                    ...o,
                                                                                    is_correct: idx === oIdx
                                                                                }));
                                                                                updateQuestionField('options', optList);
                                                                            }}
                                                                            title={`Select Option ${optLabel} as official correct answer`}
                                                                        />
                                                                        <div className="ai-option-badge-label">{optLabel}</div>
                                                                        <input
                                                                            type="text"
                                                                            className="ai-option-text-input"
                                                                            value={optText}
                                                                            onChange={(e) => {
                                                                                const optList = [...currentQuestion.options];
                                                                                optList[oIdx] = {
                                                                                    ...optList[oIdx],
                                                                                    text: e.target.value,
                                                                                    option_text: e.target.value
                                                                                };
                                                                                updateQuestionField('options', optList);
                                                                            }}
                                                                            placeholder={`Option ${optLabel} statement text`}
                                                                        />
                                                                        {isSelected && (
                                                                            <span style={{ fontSize: '0.725rem', fontWeight: 800, background: '#10b981', color: '#ffffff', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                                                                Correct Answer ✓
                                                                            </span>
                                                                        )}
                                                                        {(currentQuestion.options || []).length > 2 && (
                                                                            <button
                                                                                type="button"
                                                                                className="ai-option-delete-btn"
                                                                                onClick={() => handleRemoveOption(oIdx)}
                                                                                title={`Delete option ${optLabel}`}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Financial / Accounting Table */}
                                                <AccountingTableEditor
                                                    table={currentQuestion.structured_table || currentQuestion.table_data}
                                                    onChange={(t) => {
                                                        updateQuestionField('structured_table', t);
                                                        updateQuestionField('table_data', t);
                                                    }}
                                                    label="Question Accounting Table"
                                                />
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        No question selected.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PANEL 3: MATCHED SOLUTION & WORKING NOTES */}
                        <div className={`ai-panel ${rightMinimized ? 'minimized' : ''}`}>
                            <div className="ai-panel-header">
                                {!rightMinimized && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle2 size={17} color="#10b981" />
                                        <span>Matched Solution</span>
                                    </div>
                                )}
                                <button
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                    onClick={() => setRightMinimized(!rightMinimized)}
                                    title={rightMinimized ? 'Expand Solution Panel' : 'Minimize Solution Panel'}
                                >
                                    {rightMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                                </button>
                            </div>

                            {!rightMinimized && currentQuestion && (
                                <>
                                    {/* Match Confidence & Manual Override */}
                                    <div style={{ padding: '0.85rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span className={`ai-confidence-pill ${(currentQuestion.matched_answer?.confidence_score || 0) >= 0.8
                                                    ? 'ai-confidence-high'
                                                    : (currentQuestion.matched_answer?.confidence_score || 0) >= 0.5
                                                        ? 'ai-confidence-medium'
                                                        : 'ai-confidence-low'
                                                }`}>
                                                {Math.round((currentQuestion.matched_answer?.confidence_score || 0) * 100)}% Match
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                                {currentQuestion.matched_answer?.answer_question_number
                                                    ? `Answer to Q${currentQuestion.matched_answer.answer_question_number}`
                                                    : 'Unmatched'}
                                            </span>
                                        </div>

                                        {/* Re-match selector */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Remap:</label>
                                            <select
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                value={currentQuestion.matched_answer?.answer_question_number || ''}
                                                onChange={(e) => handleOverrideMatch(e.target.value)}
                                            >
                                                <option value="">(None)</option>
                                                {(activeJob.extracted_payload?.validation?.answers_list || []).map((ans: any) => (
                                                    <option key={ans.answer_id} value={ans.question_number}>
                                                        Answer Q{ans.question_number}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Solution Tabs */}
                                    <div className="ai-solution-tabs">
                                        <button
                                            className={`ai-solution-tab ${solutionTab === 'OFFICIAL' ? 'active' : ''}`}
                                            onClick={() => setSolutionTab('OFFICIAL')}
                                        >
                                            Official Answer
                                        </button>
                                        <button
                                            className={`ai-solution-tab ${solutionTab === 'WORKING_NOTES' ? 'active' : ''}`}
                                            onClick={() => setSolutionTab('WORKING_NOTES')}
                                        >
                                            Working Notes
                                        </button>
                                        <button
                                            className={`ai-solution-tab ${solutionTab === 'AI_EXPLANATION' ? 'active' : ''}`}
                                            onClick={() => setSolutionTab('AI_EXPLANATION')}
                                        >
                                            AI Explanation
                                        </button>
                                    </div>

                                    <div className="ai-panel-body">
                                        {/* Tab 1: Official Solution */}
                                        {solutionTab === 'OFFICIAL' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                <div className="ai-form-group">
                                                    <label className="ai-form-label">Solution Text & Journal Entries</label>
                                                    <textarea
                                                        rows={10}
                                                        value={currentQuestion.matched_answer?.solution_text || ''}
                                                        onChange={(e) => {
                                                            const ma = { ...currentQuestion.matched_answer, solution_text: e.target.value };
                                                            updateQuestionField('matched_answer', ma);
                                                        }}
                                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', lineHeight: '1.45', outline: 'none' }}
                                                    />
                                                </div>

                                                {/* Official Solution Financial / Ledger Table */}
                                                <AccountingTableEditor
                                                    table={currentQuestion.matched_answer?.structured_table || currentQuestion.matched_answer?.answer_table_data}
                                                    onChange={(t) => {
                                                        const ma = {
                                                            ...currentQuestion.matched_answer,
                                                            structured_table: t,
                                                            answer_table_data: t
                                                        };
                                                        updateQuestionField('matched_answer', ma);
                                                    }}
                                                    label="Official Solution Accounting Table"
                                                />
                                            </div>
                                        )}

                                        {/* Tab 2: Working Notes */}
                                        {solutionTab === 'WORKING_NOTES' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                <div className="ai-working-notes-box">
                                                    <strong>💡 ICAI Working Notes & Calculations:</strong>
                                                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
                                                        Preserved exactly from official answer key to ensure step-marking parity.
                                                    </p>
                                                </div>
                                                <textarea
                                                    rows={10}
                                                    value={currentQuestion.matched_answer?.working_notes || ''}
                                                    onChange={(e) => {
                                                        const ma = { ...currentQuestion.matched_answer, working_notes: e.target.value };
                                                        updateQuestionField('matched_answer', ma);
                                                    }}
                                                    placeholder="Enter working notes, reference formulas, or schedules..."
                                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', lineHeight: '1.45' }}
                                                />
                                            </div>
                                        )}

                                        {/* Tab 3: AI Explanation */}
                                        {solutionTab === 'AI_EXPLANATION' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                <div style={{ background: '#eef2ff', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#4338ca' }}>
                                                    <strong>🤖 AI Pedagogical Breakdown:</strong> Kept strictly separate from the student's official answer key.
                                                </div>
                                                <textarea
                                                    rows={8}
                                                    value={currentQuestion.matched_answer?.ai_explanation || ''}
                                                    onChange={(e) => {
                                                        const ma = { ...currentQuestion.matched_answer, ai_explanation: e.target.value };
                                                        updateQuestionField('matched_answer', ma);
                                                    }}
                                                    placeholder="Optional conceptual explanation for students who miss this question..."
                                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action / Publishing Floating Bar */}
                    <div className="ai-action-bar">
                        <div className="ai-action-bar-left">
                            <span>
                                📄 <strong>{allQuestions.filter(q => q.is_approved).length}</strong> of <strong>{allQuestions.length}</strong> Questions Approved
                            </span>
                            <span>•</span>
                            <span>
                                🎯 Total Marks: <strong>{allQuestions.reduce((acc, q) => acc + (q.marks || 0), 0)}</strong>
                            </span>
                        </div>

                        <div className="ai-action-bar-right">
                            <button className="ai-btn-secondary" onClick={handleSaveDraft} disabled={isSavingDraft}>
                                <Save size={15} />
                                <span>Save Draft</span>
                            </button>
                            <button className="ai-btn-publish" onClick={handlePublish} disabled={isPublishing}>
                                <ShieldCheck size={18} />
                                <span>Publish Approved to Live Question Bank</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* VIEW MODE: PAST IMPORTS HISTORY */}
            {/* ───────────────────────────────────────────────────────────── */}
            {viewMode === 'history' && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Past AI Import Records</h2>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Review previously processed batches, question papers, and audit history</p>
                        </div>
                        <button className="ai-btn-secondary" onClick={loadHistory} disabled={loadingHistory}>
                            <RefreshCw size={15} className={loadingHistory ? 'spin' : ''} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* History Tabs */}
                    <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                        <button
                            type="button"
                            className={`ai-solution-tab ${historyTab === 'batches' ? 'active' : ''}`}
                            onClick={() => setHistoryTab('batches')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Files size={15} />
                            <span>Import Batches ({historyBatches.length})</span>
                        </button>
                        <button
                            type="button"
                            className={`ai-solution-tab ${historyTab === 'jobs' ? 'active' : ''}`}
                            onClick={() => setHistoryTab('jobs')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <FileText size={15} />
                            <span>Single Paper Jobs ({historyJobs.length})</span>
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                            <span>Loading import records...</span>
                        </div>
                    ) : historyTab === 'batches' ? (
                        historyBatches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                No import batches found. Create your first Multi-PDF Batch upload to process QPs and Answers together!
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                            <th style={{ padding: '0.75rem 1rem' }}>Batch Name / Date</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Documents</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Level / Paper</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Questions</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Published</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyBatches.map((b) => (
                                            <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {new Date(b.created_at).toLocaleDateString()} {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        {b.total_documents || b.documents_count || 0} PDFs
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div>{b.ca_level}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.exam_session} {b.exam_year}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                                                    {b.total_questions_detected || 0} detected
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        background: b.status === 'published' ? '#dcfce7' : b.status === 'review_required' ? '#fef3c7' : b.status === 'failed' ? '#fee2e2' : '#f1f5f9',
                                                        color: b.status === 'published' ? '#15803d' : b.status === 'review_required' ? '#b45309' : b.status === 'failed' ? '#b91c1c' : '#475569',
                                                    }}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>
                                                    {b.published_questions_count || 0} Live
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button
                                                            className="ai-btn-secondary"
                                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem' }}
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.get(`/materials/import-batches/${b.id}/`);
                                                                    const fullBatch = res.data;
                                                                    let payload = fullBatch.batch_payload || fullBatch.extracted_payload || {};
                                                                    let targetJob = fullBatch.active_job || (fullBatch.jobs && fullBatch.jobs.length > 0 ? fullBatch.jobs[0] : null);
                                                                    if (targetJob && (!payload.sections || payload.sections.length === 0)) {
                                                                        try {
                                                                            const jFull = (await api.get(`/materials/import-jobs/${targetJob.id}/`)).data;
                                                                            if (jFull?.extracted_payload?.sections) {
                                                                                payload = jFull.extracted_payload;
                                                                                targetJob = jFull;
                                                                            }
                                                                        } catch {}
                                                                    }
                                                                    fullBatch.extracted_payload = payload;
                                                                    setActiveBatch(fullBatch);
                                                                    if (targetJob) {
                                                                        setActiveJob({ ...targetJob, extracted_payload: payload });
                                                                    }
                                                                    if (fullBatch.documents && fullBatch.documents.length > 0) {
                                                                        setSelectedDocId(fullBatch.documents[0].id);
                                                                    }
                                                                    const firstQ = payload?.sections?.[0]?.questions?.[0];
                                                                    if (firstQ) {
                                                                        setSelectedQuestionId(firstQ.question_id);
                                                                    }
                                                                    setViewMode('workspace');
                                                                } catch (err: any) {
                                                                    alert('Could not open batch: ' + (err.response?.data?.error || err.message));
                                                                }
                                                            }}
                                                        >
                                                            <Eye size={13} />
                                                            <span>Open</span>
                                                        </button>
                                                        <button
                                                            className="ai-btn-secondary"
                                                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.775rem' }}
                                                            onClick={() => handleOpenAuditLogs(b.id, b.active_job?.id)}
                                                            title="View Audit Logs"
                                                        >
                                                            <History size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        historyJobs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                No past single import jobs found.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                            <th style={{ padding: '0.75rem 1rem' }}>ID / Date</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Question Paper</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Course / Level</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Session</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Published</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyJobs.map((j) => (
                                            <tr key={j.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>#{j.id.slice(0, 8)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(j.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{j.question_pdf_filename}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>{j.ca_level}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>{j.exam_session} {j.exam_year}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        background: j.status === 'published' ? '#dcfce7' : j.status === 'review_required' ? '#fef3c7' : '#f1f5f9',
                                                        color: j.status === 'published' ? '#15803d' : j.status === 'review_required' ? '#b45309' : '#475569',
                                                    }}>
                                                        {j.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                                                    {j.published_question_count || 0} Questions
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button
                                                            className="ai-btn-secondary"
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                            onClick={async () => {
                                                                const full = (await api.get(`/materials/import-jobs/${j.id}/`)).data;
                                                                setActiveJob(full);
                                                                setViewMode('workspace');
                                                            }}
                                                        >
                                                            <Eye size={14} />
                                                            <span>Open</span>
                                                        </button>
                                                        <button
                                                            className="ai-btn-secondary"
                                                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }}
                                                            onClick={() => handleOpenAuditLogs(undefined, j.id)}
                                                            title="View Audit Logs"
                                                        >
                                                            <History size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* AUDIT LOG MODAL */}
            {/* ───────────────────────────────────────────────────────────── */}
            {showAuditModal && (
                <div className="ai-modal-overlay" onClick={() => setShowAuditModal(false)}>
                    <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ai-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <History size={18} color="#2563eb" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                    Import & Publishing Audit Log
                                </h3>
                            </div>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                onClick={() => setShowAuditModal(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="ai-modal-body">
                            {loadingAuditLogs ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                                    <span>Fetching audit log history...</span>
                                </div>
                            ) : batchAuditLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                    No audit entries recorded yet.
                                </div>
                            ) : (
                                <table className="ai-audit-table">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Action</th>
                                            <th>Performed By</th>
                                            <th>Details / Questions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchAuditLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748b' }}>
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span className={`ai-audit-action ${log.action}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                                                    {log.user_email || 'System Worker'}
                                                </td>
                                                <td style={{ fontSize: '0.825rem' }}>
                                                    {log.details ? (
                                                        <div>
                                                            {log.details.published_count && (
                                                                <span style={{ fontWeight: 700, color: '#16a34a' }}>
                                                                    Published {log.details.published_count} questions.
                                                                </span>
                                                            )}
                                                            {log.details.message && <span> {log.details.message}</span>}
                                                            {log.details.total_detected && (
                                                                <span> Detected {log.details.total_detected} questions.</span>
                                                            )}
                                                            {log.details.question_number && (
                                                                <span> Q{log.details.question_number} approved.</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="ai-modal-footer">
                            <button className="ai-btn-secondary" onClick={() => setShowAuditModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
