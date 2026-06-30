import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PDFPrintLayout from './PDFPrintLayout';
import { saveESSData, loadESSData } from '../utils/essData';
import { useLanguage } from '../utils/LanguageContext';
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
    jobName: project ? `${project.so} - ${project.name.split(':')[0].trim()}` : '',
    color: 'White Classic 300',
    rooms: 'Her Master',
    designer: project ? (project.designer || 'Russell') : '',
    engineer: project ? (project.eng || 'JS') : ''
  },
  drawerOptions: {
    fronts: materials?.thermofoil === 'Yes' ? 'THERMOFOIL' : 'SLAB',
    box: materials?.dovetail === 'Yes' ? 'DOVETAIL' : 'PRFV',
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
  // --- Multi-page State ---
  const [pages, setPages] = useState([createDefaultPage(project, materials)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // --- Load Initial Data ---
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      const data = await loadESSData(project.so);
      if (isMounted) {
        if (data && data.length > 0) {
          const updatedPages = data.map(page => ({
            ...page,
            drawerOptions: {
              ...page.drawerOptions,
              fronts: materials?.thermofoil === 'Yes' ? 'THERMOFOIL' : (page.drawerOptions?.fronts || 'SLAB'),
              box: materials?.dovetail === 'Yes' ? 'DOVETAIL' : (page.drawerOptions?.box || 'PRFV')
            }
          }));
          setPages(updatedPages);
        }
        setIsLoading(false);
      }
    };
    fetch();
    return () => { isMounted = false; };
  }, [project.so]);

  // --- Auto-Save ---
  // Debounce the save to prevent excessive Firebase writes
  useEffect(() => {
    if (isLoading) return; // Don't save on initial load
    
    const handler = setTimeout(() => {
      saveESSData(project.so, pages);
    }, 1000);
    
    return () => clearTimeout(handler);
  }, [pages, project.so, isLoading]);

  // --- Page Management ---
  const addPage = () => {
    setPages([...pages, createDefaultPage(project, materials)]);
    setCurrentPageIndex(pages.length);
  };

  const removePage = (indexToRemove) => {
    if (pages.length <= 1) return; // Must have at least one page
    const newPages = pages.filter((_, i) => i !== indexToRemove);
    setPages(newPages);
    if (currentPageIndex >= newPages.length) {
      setCurrentPageIndex(newPages.length - 1);
    }
  };

  // --- Helpers to update current page state ---
  const updateCurrentPage = (updater) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      newPages[currentPageIndex] = updater(newPages[currentPageIndex]);
      return newPages;
    });
  };

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
    documentTitle: () => `ESS_${project.name.split(':')[0].trim()}`,
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
            <button className="btn-icon danger" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab System for Multiple Pages */}
        <div className="pdf-tabs-container">
          <div className="pdf-tabs">
            {pages.map((p, index) => (
              <div 
                key={index} 
                className={`pdf-tab ${index === currentPageIndex ? 'active' : ''}`}
                onClick={() => setCurrentPageIndex(index)}
              >
                {t('myProjects.sheet')} {index + 1}
                {pages.length > 1 && (
                  <span 
                    className="tab-close" 
                    onClick={(e) => { e.stopPropagation(); removePage(index); }}
                    title={t('myProjects.deleteSheet')}
                  >
                    <X size={12} />
                  </span>
                )}
              </div>
            ))}
            <button className="btn-add-tab" onClick={addPage} title={t('myProjects.addNewSheet')}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="pdf-modal-body">
          <div className="form-section">
            <h3>{t('myProjects.headerSheet')} {currentPageIndex + 1}</h3>
            <div className="form-grid">
              <label>JOB NAME: <input type="text" name="jobName" value={headerData.jobName} onChange={handleHeaderChange} /></label>
              <label>COLOR: <input type="text" name="color" value={headerData.color} onChange={handleHeaderChange} /></label>
              <label>ROOM(S): <input type="text" name="rooms" value={headerData.rooms} onChange={handleHeaderChange} /></label>
              <label>DESIGNER: <input type="text" name="designer" value={headerData.designer} onChange={handleHeaderChange} /></label>
              <label>ENGINEER: <input type="text" name="engineer" value={headerData.engineer} onChange={handleHeaderChange} /></label>
            </div>
          </div>

          <div className="form-section">
            <h3>{t('myProjects.drawerOptions')}</h3>
            <div className="form-grid">
              <label>FRONTS: 
                <select name="fronts" value={drawerOptions.fronts} onChange={handleOptionsChange}>
                  <option value="SLAB">SLAB</option>
                  <option value="THERMOFOIL">THERMOFOIL</option>
                </select>
              </label>
              <label>BOX: 
                <select name="box" value={drawerOptions.box} onChange={handleOptionsChange}>
                  <option value="PRFV">PRFV</option>
                  <option value="DOVETAIL">DOVETAIL</option>
                </select>
              </label>
              <label>SLIDES: 
                <select name="slides" value={drawerOptions.slides} onChange={handleOptionsChange}>
                  <option value="SOFT CLOSE">SOFT CLOSE</option>
                  <option value="FULL EXTENSION">FULL EXTENSION</option>
                </select>
              </label>
              <label>HANDLES: 
                <select name="handles" value={drawerOptions.handles} onChange={handleOptionsChange}>
                  <option value="STD. B. NICKEL">STD. B. NICKEL</option>
                  <option value="STD. CHROME">STD. CHROME</option>
                  <option value="STD. M. BLACK">STD. M. BLACK</option>
                  <option value="NONE">NONE</option>
                  <option value="CUSTOMER OWN">CUSTOMER OWN</option>
                  <option value="SPECIAL">SPECIAL</option>
                </select>
              </label>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>FRONT (H x W)</th><th>QTY</th><th>OPEN.</th><th>BOX (W x D x H)</th><th>ROOM</th><th>SPECIAL HANDLES</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {drawers.map((d, i) => (
                    <tr key={i}>
                      <td><input value={d.front} onChange={e => updateDrawer(i, 'front', e.target.value)} /></td>
                      <td><input type="number" style={{width: '60px'}} value={d.qty} onChange={e => updateDrawer(i, 'qty', e.target.value)} /></td>
                      <td><input value={d.open} onChange={e => updateDrawer(i, 'open', e.target.value)} /></td>
                      <td><input value={d.box} onChange={e => updateDrawer(i, 'box', e.target.value)} /></td>
                      <td><input value={d.room} onChange={e => updateDrawer(i, 'room', e.target.value)} /></td>
                      <td><input value={d.handles} onChange={e => updateDrawer(i, 'handles', e.target.value)} /></td>
                      <td><button className="btn-icon danger" onClick={() => removeDrawer(i)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-secondary btn-sm" onClick={addDrawer} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addDrawerRow')}</button>
            </div>
          </div>

          <div className="form-section">
            <h3>{t('myProjects.rodsTitle')}</h3>
            <div className="table-container" style={{maxWidth: '500px'}}>
              <table>
                <thead>
                  <tr>
                    <th>ROOM</th><th>TYPE</th><th>QTY</th><th>SIZE</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rods.map((r, i) => (
                    <tr key={i}>
                      <td><input value={r.room} onChange={e => updateRod(i, 'room', e.target.value)} /></td>
                      <td><input value={r.type} onChange={e => updateRod(i, 'type', e.target.value)} /></td>
                      <td><input type="number" style={{width: '60px'}} value={r.qty} onChange={e => updateRod(i, 'qty', e.target.value)} /></td>
                      <td><input value={r.size} onChange={e => updateRod(i, 'size', e.target.value)} /></td>
                      <td><button className="btn-icon danger" onClick={() => removeRod(i)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-secondary btn-sm" onClick={addRod} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addRod')}</button>
            </div>
          </div>

          <div className="form-section">
            <h3>{t('myProjects.miscNotesTitle')}</h3>
            <div className="misc-columns">
              <div style={{flex: 1}}>
                <label>{t('myProjects.leftColumn')}</label>
                <textarea value={miscCol1} onChange={e => setMiscCol1(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
              </div>
              <div style={{flex: 1}}>
                <label>{t('myProjects.rightColumn')}</label>
                <textarea value={miscCol2} onChange={e => setMiscCol2(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
              </div>
            </div>
          </div>
        </div>
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
