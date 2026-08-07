import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { saveEssFile, loadEssFile, validateFileSize, base64ToArrayBuffer } from '../utils/essFiles';
import { extractPdfPages, pagesToPlainText } from '../utils/essPdfExtract';
import { parseContractText, looksLikeContract } from '../utils/essParsers/parseContract';
import { parseQuoteText, looksLikeQuote } from '../utils/essParsers/parseQuote';
import { parseDrawingPages, looksLikeDrawing } from '../utils/essParsers/parseDrawings';
import { buildEssPages } from '../utils/essMatcher';
import { saveEssAutoData, hasEssAutoData } from '../utils/essAutoData';
import EssAutoGeneratorModal from '../components/EssAutoGeneratorModal';

const DOC_TYPES = ['contract', 'quote', 'drawings'];

export default function EssProjectDetail({ project, onBack }) {
  const { language } = useLanguage();
  const t = (es, en) => (language === 'es' ? es : en);

  const [uploadedNames, setUploadedNames] = useState({});
  const [slotWarnings, setSlotWarnings] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [isUploading, setIsUploading] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [essExists, setEssExists] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(DOC_TYPES.map(async docType => {
          const file = await loadEssFile(project.so, docType);
          return [docType, file?.name || null];
        }));
        if (!cancelled) setUploadedNames(Object.fromEntries(entries));
        const exists = await hasEssAutoData(project.so);
        if (!cancelled) setEssExists(exists);
      } catch (error) {
        // Don't let a transient RTDB read failure leave essExists stuck at
        // false — that would silently defeat the regenerate-confirm guard
        // in handleGenerate. Just log; state is left as-is (matching the
        // catch-and-log resilience pattern used elsewhere, e.g. essAutoData.js).
        console.error('Failed to load ESS upload/generation state:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [project.so]);

  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    setUploadErrors(prev => ({ ...prev, [docType]: null }));
    setSlotWarnings(prev => ({ ...prev, [docType]: null }));

    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      setUploadErrors(prev => ({ ...prev, [docType]: t('Este archivo es demasiado grande (máx 8MB).', 'This file is too large (max 8MB).') }));
      return;
    }

    setIsUploading(prev => ({ ...prev, [docType]: true }));

    // Save first. If this fails, nothing was persisted — report a real
    // upload failure and stop; don't run the sanity check on a file that
    // was never saved.
    try {
      await saveEssFile(project.so, docType, file);
      setUploadedNames(prev => ({ ...prev, [docType]: file.name }));
    } catch (error) {
      console.error(`Failed to upload ${docType}:`, error);
      setUploadErrors(prev => ({ ...prev, [docType]: t('No se pudo subir este archivo.', 'Failed to upload this file.') }));
      setIsUploading(prev => ({ ...prev, [docType]: false }));
      return;
    }

    // The upload already succeeded at this point — this is just a
    // best-effort "does this look like the right doc type" check, so its
    // own failure (e.g. the PDF can't be parsed) must never be reported as
    // an upload error. It gets a warning instead, distinct from a failed
    // upload.
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pages = await extractPdfPages(arrayBuffer);
      const text = pagesToPlainText(pages);
      const looksRight = docType === 'contract' ? looksLikeContract(text)
        : docType === 'quote' ? looksLikeQuote(text)
        : looksLikeDrawing(pages);
      if (!looksRight) {
        setSlotWarnings(prev => ({
          ...prev,
          [docType]: t(`Esto no parece un ${docType === 'contract' ? 'Contract' : docType === 'quote' ? 'Quote' : 'Drawings'} — ¿seguro que es el correcto?`, `This doesn't look like a ${docType === 'contract' ? 'Contract' : docType === 'quote' ? 'Quote' : 'Drawings'} file — are you sure it's the right one?`),
        }));
      }
    } catch (error) {
      console.error(`Sanity check failed for ${docType} (file was still uploaded):`, error);
      setSlotWarnings(prev => ({
        ...prev,
        [docType]: t('No pudimos verificar este archivo, pero se subió correctamente.', "We couldn't verify this file, but it uploaded successfully."),
      }));
    } finally {
      setIsUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const allUploaded = DOC_TYPES.every(docType => uploadedNames[docType]);

  const handleGenerate = async () => {
    if (essExists) {
      const confirmed = window.confirm(t(
        'Ya existe un borrador de ESS generado para este proyecto. Generar uno nuevo lo va a reemplazar. ¿Continuar?',
        'This project already has a generated ESS draft. Generating a new one will replace it. Continue?'
      ));
      if (!confirmed) return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setSummary(null);

    try {
      const [contractFile, quoteFile, drawingsFile] = await Promise.all(
        DOC_TYPES.map(docType => loadEssFile(project.so, docType))
      );
      if (!contractFile || !quoteFile || !drawingsFile) {
        throw new Error('MISSING_FILES');
      }

      const [contractPages, quotePages, drawingPages] = await Promise.all([
        extractPdfPages(base64ToArrayBuffer(contractFile.data)),
        extractPdfPages(base64ToArrayBuffer(quoteFile.data)),
        extractPdfPages(base64ToArrayBuffer(drawingsFile.data)),
      ]);

      const contractText = pagesToPlainText(contractPages);
      const quoteText = pagesToPlainText(quotePages);
      const drawingsHaveText = drawingPages.some(p => p.items.length > 0);

      if (!contractText.trim() || !quoteText.trim() || !drawingsHaveText) {
        throw new Error('EMPTY_TEXT');
      }

      const contract = parseContractText(contractText);
      const quote = parseQuoteText(quoteText);
      const drawings = parseDrawingPages(drawingPages);

      const { pages, unmatchedQuoteItems, unmatchedDrawingOpenings, warnings } = buildEssPages({ project, contract, quote, drawings });

      await saveEssAutoData(project.so, pages);
      setEssExists(true);
      setSummary({ unmatchedQuoteItems, unmatchedDrawingOpenings, warnings });
    } catch (error) {
      console.error('ESS generation failed:', error);
      if (error.message === 'MISSING_FILES') {
        setGenerationError(t('Subí los 3 PDFs (Contract, Quote, Drawings) antes de generar.', 'Upload all 3 PDFs (Contract, Quote, Drawings) before generating.'));
      } else if (error.message === 'EMPTY_TEXT') {
        setGenerationError(t('No pudimos leer texto de uno de estos PDFs. ¿Es un escaneo?', "We couldn't read text from one of these PDFs. Is it a scan?"));
      } else {
        setGenerationError(t('Algo salió mal leyendo estos PDFs. Revisá los archivos e intentá de nuevo.', 'Something went wrong reading these PDFs. Check the files and try again.'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const slotLabel = (docType) => ({ contract: 'Contract', quote: 'Quote', drawings: 'Drawings' }[docType]);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={14} /> {t('Volver', 'Back')}
      </button>
      <h2>SO #{project.so} — {project.name}</h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '16px 0' }}>
        {DOC_TYPES.map(docType => (
          <div key={docType} className="glass-card" style={{ padding: '12px', minWidth: '220px' }}>
            <strong>{slotLabel(docType)}</strong>
            <div style={{ margin: '8px 0' }}>
              <label className="btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isUploading[docType] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadedNames[docType] ? t('Reemplazar', 'Replace') : t('Elegir PDF...', 'Choose PDF...')}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(docType, e.target.files?.[0])}
                  disabled={isUploading[docType]}
                />
              </label>
            </div>
            {uploadedNames[docType] && (
              <div style={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} color="var(--color-cyan)" /> {uploadedNames[docType]}
              </div>
            )}
            {slotWarnings[docType] && (
              <div style={{ fontSize: '0.85em', color: 'var(--color-warning, orange)', marginTop: '4px' }}>
                <AlertTriangle size={14} /> {slotWarnings[docType]}
              </div>
            )}
            {uploadErrors[docType] && (
              <div style={{ fontSize: '0.85em', color: 'var(--color-danger, red)', marginTop: '4px' }}>
                {uploadErrors[docType]}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="btn-primary" disabled={!allUploaded || isGenerating} onClick={handleGenerate}>
        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : null}
        {' '}{t('Generar ESS', 'Generate ESS')}
      </button>

      {generationError && (
        <div style={{ color: 'var(--color-danger, red)', marginTop: '12px' }}>{generationError}</div>
      )}

      {summary && (
        <div className="glass-card" style={{ padding: '12px', marginTop: '16px' }}>
          <h3>{t('Resumen de extracción', 'Extraction summary')}</h3>
          {summary.unmatchedQuoteItems.length === 0 && summary.unmatchedDrawingOpenings.length === 0 ? (
            <p>{t('Todo matcheó correctamente.', 'Everything matched cleanly.')}</p>
          ) : (
            <>
              {summary.unmatchedQuoteItems.length > 0 && (
                <div>
                  <strong>{t('Ítems del Quote sin área en el plano:', 'Quote items with no matching drawing area:')}</strong>
                  <ul>
                    {summary.unmatchedQuoteItems.map((item, i) => (
                      <li key={i}>{item.area} — {item.description} ({item.productCode})</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.unmatchedDrawingOpenings.length > 0 && (
                <div>
                  <strong>{t('Áreas del plano sin ítem en el Quote:', 'Drawing areas with no matching quote item:')}</strong>
                  <ul>
                    {summary.unmatchedDrawingOpenings.map((d, i) => (
                      <li key={i}>{d.area} ({d.openings.length} openings)</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <button className="btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: '12px' }}>
            {t('Abrir ESS generada', 'Open generated ESS')}
          </button>
        </div>
      )}

      {essExists && !summary && (
        <button className="btn-secondary btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: '16px' }}>
          {t('Abrir ESS generada', 'Open generated ESS')}
        </button>
      )}

      {showModal && (
        <EssAutoGeneratorModal project={project} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
