import { useRef, useState } from 'react';
import { X, Printer, Flag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PDFPrintLayout from './PDFPrintLayout';
import EssFormFields from './EssFormFields';
import { saveEssAutoData, loadEssAutoData, saveEssCorrection } from '../utils/essAutoData';
import { usePagedModal } from '../utils/usePagedModal';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import './PDFGeneratorModal.css';

const createDefaultPage = (project) => ({
  headerData: {
    jobName: project ? `${project.so} - ${shortProjectName(project.name)}` : '',
    color: '',
    rooms: '',
    designer: project ? (project.designer || '') : '',
    engineer: project ? (project.eng || '') : ''
  },
  drawerOptions: { fronts: 'SLAB', box: 'PRFV', slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
  drawers: [],
  rods: [],
  miscCol1: '',
  miscCol2: ''
});

export default function EssAutoGeneratorModal({ project, onClose }) {
  const { t, language } = useLanguage();
  const [isReporting, setIsReporting] = useState(false);

  const {
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    isLoading,
    addPage,
    removePage,
    updateCurrentPage,
  } = usePagedModal({
    so: project.so,
    createDefaultPage: () => createDefaultPage(project),
    loadData: loadEssAutoData,
    saveData: saveEssAutoData,
  });

  const setHeaderData = (newData) => updateCurrentPage(p => ({ ...p, headerData: typeof newData === 'function' ? newData(p.headerData) : newData }));
  const setDrawerOptions = (newOpts) => updateCurrentPage(p => ({ ...p, drawerOptions: typeof newOpts === 'function' ? newOpts(p.drawerOptions) : newOpts }));
  const setDrawers = (newDrawers) => updateCurrentPage(p => ({ ...p, drawers: typeof newDrawers === 'function' ? newDrawers(p.drawers) : newDrawers }));
  const setRods = (newRods) => updateCurrentPage(p => ({ ...p, rods: typeof newRods === 'function' ? newRods(p.rods) : newRods }));
  const setMiscCol1 = (val) => updateCurrentPage(p => ({ ...p, miscCol1: val }));
  const setMiscCol2 = (val) => updateCurrentPage(p => ({ ...p, miscCol2: val }));

  const currentPage = pages[currentPageIndex] || pages[0];
  const { headerData, drawerOptions, drawers, rods, miscCol1, miscCol2 } = currentPage;

  const addDrawer = () => setDrawers([...drawers, { front: '', qty: 1, open: '', box: '', room: '', handles: '' }]);
  const removeDrawer = (index) => setDrawers(drawers.filter((_, i) => i !== index));
  const updateDrawer = (index, field, value) => {
    const newDrawers = [...drawers];
    newDrawers[index][field] = value;
    setDrawers(newDrawers);
  };

  const addRod = () => setRods([...rods, { room: '', type: 'Oval Chrome rod', qty: 1, size: '' }]);
  const removeRod = (index) => setRods(rods.filter((_, i) => i !== index));
  const updateRod = (index, field, value) => {
    const newRods = [...rods];
    newRods[index][field] = value;
    setRods(newRods);
  };

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  const handleOptionsChange = (e) => setDrawerOptions({ ...drawerOptions, [e.target.name]: e.target.value });

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: () => {
      const baseName = shortProjectName(project.name);
      const cleanName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      return `ESS_AUTO_${cleanName}`;
    },
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 8mm !important;
      }
    `
  });

  const handleReportError = async () => {
    const note = window.prompt(
      language === 'es'
        ? 'Describí qué está mal en esta ESS generada:'
        : "Describe what's wrong with this generated ESS:"
    );
    if (!note) return;
    setIsReporting(true);
    try {
      await saveEssCorrection(project.so, note);
      window.alert(language === 'es' ? 'Reporte guardado.' : 'Report saved.');
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pdf-modal-overlay animate-fade-in">
        <div className="pdf-modal-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <p style={{ color: 'var(--color-cyan)' }}>{t('myProjects.loadingSavedData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-modal-overlay animate-fade-in">
      <div className="pdf-modal-content">
        <div className="pdf-modal-header">
          <h2>{language === 'es' ? 'ESS Auto-generada' : 'Auto-generated ESS'} — {project.so}</h2>
          <div className="pdf-modal-actions">
            <span className="save-status text-muted" style={{ fontSize: '0.8rem', marginRight: '10px' }}>{t('myProjects.autoSaveActive')}</span>
            <button className="btn-secondary btn-sm" onClick={handleReportError} disabled={isReporting}>
              <Flag size={16} /> {language === 'es' ? 'Reportar error' : 'Report error'}
            </button>
            <button className="btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> {t('myProjects.printSavePDF')}
            </button>
            <button className="btn-icon danger" onClick={onClose} aria-label={t('common.close')}>
              <X size={20} />
            </button>
          </div>
        </div>

        <EssFormFields
          t={t}
          pages={pages}
          currentPageIndex={currentPageIndex}
          setCurrentPageIndex={setCurrentPageIndex}
          addPage={addPage}
          removePage={removePage}
          headerData={headerData}
          handleHeaderChange={handleHeaderChange}
          drawerOptions={drawerOptions}
          handleOptionsChange={handleOptionsChange}
          drawers={drawers}
          updateDrawer={updateDrawer}
          removeDrawer={removeDrawer}
          addDrawer={addDrawer}
          rods={rods}
          updateRod={updateRod}
          removeRod={removeRod}
          addRod={addRod}
          miscCol1={miscCol1}
          setMiscCol1={setMiscCol1}
          miscCol2={miscCol2}
          setMiscCol2={setMiscCol2}
        />
      </div>

      {/* Hidden print layout component. Render ALL pages */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          {pages.map((pData, idx) => (
            <div key={idx} className="print-page-wrapper">
              <PDFPrintLayout
                headerData={pData.headerData}
                drawerOptions={pData.drawerOptions}
                drawers={pData.drawers}
                rods={pData.rods}
                miscCol1={pData.miscCol1}
                miscCol2={pData.miscCol2}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
