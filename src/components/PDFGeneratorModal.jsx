import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PDFPrintLayout from './PDFPrintLayout';
import EssFormFields from './EssFormFields';
import { saveESSData, loadESSData } from '../utils/essData';
import { usePagedModal } from '../utils/usePagedModal';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import { essOptionsFromMaterials } from '../utils/essRules';
import './PDFGeneratorModal.css';

const DEFAULT_DRAWERS = [
  { front: '6 1/8" x 23 5/8"', qty: 2, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 4" H', room: 'Her Master', handles: '' },
  { front: '7 3/8" x 23 5/8"', qty: 6, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 6" H', room: 'Her Master', handles: '' },
  { front: '9 7/8" x 23 5/8"', qty: 2, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 8" H', room: 'Her Master', handles: '' },
];

const DEFAULT_RODS = [
  { room: 'Her Master', type: 'Oval Chrome rod', qty: 5, size: '29 3/8"' },
  { room: 'Her Master', type: 'Oval Chrome rod', qty: 1, size: '24"' }
];

const createDefaultPage = (project, materials) => ({
  headerData: {
    jobName: project ? `${project.so} - ${shortProjectName(project.name)}` : '',
    color: 'White Classic 300',
    rooms: 'Her Master',
    designer: project ? (project.designer || 'Russell') : '',
    engineer: project ? (project.eng || 'JS') : ''
  },
  drawerOptions: {
    fronts: essOptionsFromMaterials(materials).fronts,
    box: essOptionsFromMaterials(materials).boxType,
    slides: 'SOFT CLOSE',
    handles: 'STD. CHROME'
  },
  drawers: [...DEFAULT_DRAWERS],
  rods: [...DEFAULT_RODS],
  miscCol1: 'HER MASTER\n• Edge-band exposed top edges Right panel #4 + filler #5',
  miscCol2: ''
});

export default function PDFGeneratorModal({ project, materials, onClose }) {
  const { t } = useLanguage();

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
    createDefaultPage: () => createDefaultPage(project, materials),
    loadData: loadESSData,
    saveData: saveESSData,
    // The matrix only forces a value when it says Yes; a saved page that was
    // edited by hand otherwise keeps whatever it was set to.
    transformLoaded: (sanitized) => sanitized.map(page => ({
      ...page,
      drawerOptions: {
        ...page.drawerOptions,
        fronts: essOptionsFromMaterials(materials).fronts === 'THERMOFOIL' ? 'THERMOFOIL' : (page.drawerOptions?.fronts || 'SLAB'),
        box: essOptionsFromMaterials(materials).boxType === 'DOVETAIL' ? 'DOVETAIL' : (page.drawerOptions?.box || 'PRFV')
      }
    })),
  });

  const setHeaderData = (newData) => updateCurrentPage(p => ({ ...p, headerData: typeof newData === 'function' ? newData(p.headerData) : newData }));
  const setDrawerOptions = (newOpts) => updateCurrentPage(p => ({ ...p, drawerOptions: typeof newOpts === 'function' ? newOpts(p.drawerOptions) : newOpts }));
  const setDrawers = (newDrawers) => updateCurrentPage(p => ({ ...p, drawers: typeof newDrawers === 'function' ? newDrawers(p.drawers) : newDrawers }));
  const setRods = (newRods) => updateCurrentPage(p => ({ ...p, rods: typeof newRods === 'function' ? newRods(p.rods) : newRods }));
  const setMiscCol1 = (val) => updateCurrentPage(p => ({ ...p, miscCol1: val }));
  const setMiscCol2 = (val) => updateCurrentPage(p => ({ ...p, miscCol2: val }));

  // Extraction of current page data for render
  const currentPage = pages[currentPageIndex] || pages[0];
  const { headerData, drawerOptions, drawers, rods, miscCol1, miscCol2 } = currentPage;

  // --- Mutators ---
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

  const handleHeaderChange = (e) => {
    setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  };

  const handleOptionsChange = (e) => {
    setDrawerOptions({ ...drawerOptions, [e.target.name]: e.target.value });
  };

  // --- Print Logic ---
  const printRef = useRef(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: () => `ESS_${shortProjectName(project.name)}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 8mm !important;
      }
    `
  });

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
          <h2>{t('myProjects.completarESSTitle')} {project.so}</h2>
          <div className="pdf-modal-actions">
            <span className="save-status text-muted" style={{ fontSize: '0.8rem', marginRight: '10px' }}>{t('myProjects.autoSaveActive')}</span>
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
