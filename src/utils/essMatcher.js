import { translateColor, calcPrfvWidth, calcDovetailWidth } from './essRules';

function normalizeAreaName(name) {
  return (name || '').trim().toUpperCase();
}

function blankPage(project) {
  return {
    headerData: {
      jobName: project ? `${project.so} - ${project.name || ''}`.trim() : '',
      color: '',
      rooms: '',
      designer: project?.designer || '',
      engineer: project?.eng || '',
    },
    drawerOptions: { fronts: 'SLAB', box: 'PRFV', slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
    drawers: [],
    rods: [],
    miscCol1: '',
    miscCol2: '',
  };
}

// Combines the three parsed documents into pages[] in the exact shape
// PDFGeneratorModal/essData already use (see createDefaultPage in
// src/components/PDFGeneratorModal.jsx), so the generated draft can be
// edited and printed with the existing usePagedModal + PDFPrintLayout
// infrastructure unchanged.
export function buildEssPages({ project, contract, quote, drawings, boxType = 'PRFV' }) {
  const warnings = [...(contract?.warnings || []), ...(quote?.warnings || []), ...(drawings?.warnings || [])];
  const quoteAreas = quote?.areas || [];
  const drawingAreas = drawings?.areas || [];
  const unmatchedQuoteItems = [];
  const unmatchedDrawingOpenings = [];

  const pages = quoteAreas.map(quoteArea => {
    const drawingArea = drawingAreas.find(d => normalizeAreaName(d.name) === normalizeAreaName(quoteArea.name));

    if (!drawingArea) {
      quoteArea.items.forEach(item => unmatchedQuoteItems.push({ area: quoteArea.name, ...item }));
    }

    const openings = drawingArea ? drawingArea.openings : [];
    const drawers = openings
      .filter(o => o.width != null)
      .map(o => ({
        front: '',
        qty: 1,
        open: `${o.width}"`,
        box: `${boxType === 'DOVETAIL' ? calcDovetailWidth(o.width) : calcPrfvWidth(o.width)}" W`,
        room: quoteArea.name,
        handles: '',
      }));

    const rods = quoteArea.items
      .filter(item => /rod/i.test(item.description))
      .map(item => ({ room: quoteArea.name, type: item.description, qty: item.qty, size: '' }));

    return {
      headerData: {
        jobName: project ? `${project.so} - ${project.name || ''}`.trim() : '',
        color: translateColor(project?.color) || project?.color || '',
        rooms: quoteArea.name,
        designer: project?.designer || '',
        engineer: project?.eng || '',
      },
      drawerOptions: { fronts: 'SLAB', box: boxType, slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
      drawers,
      rods,
      miscCol1: contract?.tearoutIncluded ? `${quoteArea.name}\n• Tearout included` : '',
      miscCol2: contract?.baseboardsIncluded === false ? 'Baseboards NOT included — customer responsible' : '',
    };
  });

  drawingAreas.forEach(d => {
    if (!quoteAreas.find(q => normalizeAreaName(q.name) === normalizeAreaName(d.name))) {
      unmatchedDrawingOpenings.push({ area: d.name, openings: d.openings });
    }
  });

  return {
    pages: pages.length > 0 ? pages : [blankPage(project)],
    unmatchedQuoteItems,
    unmatchedDrawingOpenings,
    warnings,
  };
}
