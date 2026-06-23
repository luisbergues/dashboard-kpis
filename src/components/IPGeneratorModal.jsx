import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import IPPrintLayout from './IPPrintLayout';
import { saveIPData, loadIPData } from '../utils/ipData';
import { useLanguage } from '../utils/LanguageContext';
import './PDFGeneratorModal.css'; // Re-use the modal styles for consistency

const getClientName = (projectName) => {
  if (!projectName) return '';
  const parts = projectName.split('-');
  if (parts.length > 1) {
    // If format is "12485 - Ashley Frankel", extract "Ashley Frankel"
    return parts[1].trim();
  }
  return projectName.trim();
};

const createDefaultPage = (project) => ({
  clientName: project ? getClientName(project.name) : '',
  clientAddress: '',
  clientPhone: '',
  designerPhone: project ? (project.designer || '') : '',
  collectPayment: '',
  observations: ''
});

export default function IPGeneratorModal({ project, onClose }) {
  const { t } = useLanguage();
  // --- Multi-page State ---
  const [pages, setPages] = useState([createDefaultPage(project)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // --- Load Initial Data ---
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      const data = await loadIPData(project.so);
      if (isMounted) {
        if (data) {
          // Normalize and filter out nulls or empty properties
          const parsed = Array.isArray(data) ? data : Object.values(data);
          const sanitized = parsed.filter(Boolean);
          if (sanitized.length > 0) {
            setPages(sanitized);
          }
        }
        setIsLoading(false);
      }
    };
    fetch();
    return () => { isMounted = false; };
  }, [project.so]);

  // --- Auto-Save ---
  useEffect(() => {
    if (isLoading) return; // Don't save on initial load
    
    const handler = setTimeout(() => {
      saveIPData(project.so, pages);
    }, 1000);
    
    return () => clearTimeout(handler);
  }, [pages, project.so, isLoading]);

  // --- Page Management ---
  const addPage = () => {
    setPages([...pages, createDefaultPage(project)]);
    setCurrentPageIndex(pages.length);
  };

  const removePage = (indexToRemove) => {
    if (pages.length <= 1) return;
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    updateCurrentPage(p => ({ ...p, [name]: value }));
  };

  const currentPage = pages[currentPageIndex] || pages[0] || {};
  const {
    clientName = '',
    clientAddress = '',
    clientPhone = '',
    designerPhone = '',
    collectPayment = '',
    observations = ''
  } = currentPage;

  // --- Print Logic ---
  const printRef = useRef(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: () => {
      const baseName = project.name.split(':')[0];
      const cleanName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      return `IP_${cleanName}`;
    },
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
          <h2>{t('myProjects.completarIPTitle')} {project.so}</h2>
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
            <h3>{t('myProjects.installerPacketData')} {currentPageIndex + 1}</h3>
            <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <label>CLIENT'S NAME: 
                <input type="text" name="clientName" value={clientName} onChange={handleChange} />
              </label>
              <label>CLIENT'S ADDRESS: 
                <textarea name="clientAddress" value={clientAddress} onChange={handleChange} rows={3} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.95rem', resize: 'vertical' }} />
              </label>
              <label>CLIENT'S PHONE NUMBER: 
                <input type="text" name="clientPhone" value={clientPhone} onChange={handleChange} />
              </label>
              <label>DESIGNER'S PHONE NUMB. 
                <input type="text" name="designerPhone" value={designerPhone} onChange={handleChange} />
              </label>
              <label>COLLECT PAYMENT: 
                <input type="text" name="collectPayment" value={collectPayment} onChange={handleChange} />
              </label>
              <label>OBSERVATIONS: 
                <textarea name="observations" value={observations} onChange={handleChange} rows={6} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.95rem', resize: 'vertical' }} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden print layout component. Render ALL pages */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          {pages.map((pData, idx) => (
            <div key={idx} className="print-page-wrapper">
              <IPPrintLayout data={pData} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
