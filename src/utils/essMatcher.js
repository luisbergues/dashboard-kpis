import {
  translateColor,
  calcPrfvWidth,
  calcDovetailWidth,
  calcHangRodLength,
  calcBackingDepth,
  formatInches,
  BORING_PATTERN_MM,
} from './essRules';
import { shortProjectName } from './projectName';

const BORING_NOTE = `• Boring pattern: ${BORING_PATTERN_MM}mm`;

function normalizeAreaName(name) {
  return (name || '').trim().toUpperCase();
}

// The Quote is the only document that carries the commercial color — the
// project record built from the Google Sheet has no color field at all. An
// unknown color is kept verbatim rather than blanked, so the engineer sees
// what the Quote actually said and can have it added to COLOR_MAP.
function resolveColor(quote, project) {
  const raw = quote?.color || project?.color || '';
  if (!raw) return { color: '', warning: null };
  const shopCode = translateColor(raw);
  if (shopCode) return { color: shopCode, warning: null };
  return { color: raw, warning: `COLOR_NOT_IN_MAP: ${raw}` };
}

function headerFor(project, color, rooms) {
  return {
    // Same construction as createDefaultPage in EssAutoGeneratorModal.jsx —
    // otherwise the header changes depending on whether a page came from the
    // generator or was added by hand afterwards in the same modal.
    jobName: project ? `${project.so} - ${shortProjectName(project.name)}` : '',
    color,
    rooms,
    designer: project?.designer || '',
    engineer: project?.eng || '',
  };
}

// Combines the three parsed documents into pages[] in the exact shape
// PDFGeneratorModal/essData already use (see createDefaultPage in
// src/components/PDFGeneratorModal.jsx), so the generated draft can be
// edited and printed with the existing usePagedModal + PDFPrintLayout
// infrastructure unchanged.
//
// boxType/fronts come from the materials matrix by way of EssView — the same
// source the manual ESS modal reads them from — not from anything parsed out
// of the PDFs.
export function buildEssPages({ project, contract, quote, drawings, boxType = 'PRFV', fronts = 'SLAB' }) {
  const warnings = [...(contract?.warnings || []), ...(quote?.warnings || []), ...(drawings?.warnings || [])];
  const quoteAreas = quote?.areas || [];
  const drawingAreas = drawings?.areas || [];
  const unmatchedQuoteItems = [];
  const unmatchedDrawingOpenings = [];

  const { color, warning: colorWarning } = resolveColor(quote, project);
  if (colorWarning) warnings.push(colorWarning);

  const drawerOptions = { fronts, box: boxType, slides: 'SOFT CLOSE', handles: 'STD. CHROME' };

  const pages = quoteAreas.map(quoteArea => {
    const drawingArea = drawingAreas.find(d => normalizeAreaName(d.name) === normalizeAreaName(quoteArea.name));

    if (!drawingArea) {
      (quoteArea.items || []).forEach(item => unmatchedQuoteItems.push({ area: quoteArea.name, ...item }));
    }

    const openings = drawingArea ? drawingArea.openings : [];
    const sizedOpenings = openings.filter(o => o.width != null);

    const drawers = sizedOpenings.map(o => {
      const boxWidth = boxType === 'DOVETAIL' ? calcDovetailWidth(o.width) : calcPrfvWidth(o.width);
      // Depth is only stated on some drawing callouts; when it isn't, the
      // segment is left off entirely rather than filled with a guess.
      const depthSegment = o.depth != null ? ` x ${formatInches(calcBackingDepth(o.depth))} D` : '';
      return {
        front: '',
        qty: 1,
        open: formatInches(o.width),
        box: `${formatInches(boxWidth)} W${depthSegment}`,
        room: quoteArea.name,
        handles: '',
      };
    });

    // A rod spans the opening it hangs in. With exactly one opening on the
    // area that mapping is unambiguous; with several there is no way to tell
    // which rod goes where without reading the drawing, so the size is left
    // for the engineer and the ambiguity is surfaced.
    const rodItems = (quoteArea.items || []).filter(item => /rod/i.test(item.description));
    const rodSize = sizedOpenings.length === 1 ? formatInches(calcHangRodLength(sizedOpenings[0].width)) : '';
    if (rodItems.length > 0 && sizedOpenings.length > 1) {
      warnings.push(`ROD_SIZE_AMBIGUOUS_${quoteArea.name}`);
    }
    const rods = rodItems.map(item => ({
      room: quoteArea.name,
      type: item.description,
      qty: item.qty,
      size: rodSize,
    }));

    const miscCol1Lines = [];
    if (contract?.tearoutIncluded) miscCol1Lines.push(quoteArea.name, '• Tearout included');
    if (drawers.length > 0) miscCol1Lines.push(BORING_NOTE);

    return {
      headerData: headerFor(project, color, quoteArea.name),
      drawerOptions: { ...drawerOptions },
      drawers,
      rods,
      miscCol1: miscCol1Lines.join('\n'),
      miscCol2: contract?.baseboardsIncluded === false ? 'Baseboards NOT included — customer responsible' : '',
    };
  });

  drawingAreas.forEach(d => {
    if (!quoteAreas.find(q => normalizeAreaName(q.name) === normalizeAreaName(d.name))) {
      unmatchedDrawingOpenings.push({ area: d.name, openings: d.openings });
    }
  });

  const blankPage = {
    headerData: headerFor(project, color, ''),
    drawerOptions: { ...drawerOptions },
    drawers: [],
    rods: [],
    miscCol1: '',
    miscCol2: '',
  };

  return {
    pages: pages.length > 0 ? pages : [blankPage],
    unmatchedQuoteItems,
    unmatchedDrawingOpenings,
    warnings,
  };
}
