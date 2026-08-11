import { describe, it, expect } from 'vitest';
import { buildEssPages } from '../essMatcher';

const project = { so: '12485', name: 'Ashley Frankel', designer: 'Russell', eng: 'JS', color: 'Snow White' };

describe('buildEssPages', () => {
  it('builds one page per quote area, matched to its drawing area by name', () => {
    const contract = { tearoutIncluded: true, baseboardsIncluded: false, warnings: [] };
    const quote = {
      areas: [{ name: 'MASTER WIC', items: [{ description: 'Valet Rod', productCode: 'VR-100', qty: 2 }] }],
      warnings: [],
    };
    const drawings = {
      areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: 30, depth: null }], unclassified: [] }],
      warnings: [],
    };

    const result = buildEssPages({ project, contract, quote, drawings });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].headerData.rooms).toBe('MASTER WIC');
    expect(result.pages[0].headerData.color).toBe('White Classic 300');
    expect(result.pages[0].headerData.designer).toBe('Russell');
    expect(result.pages[0].drawers[0].open).toBe('24"');
    expect(result.pages[0].drawers[0].box).toBe('23" W');
    expect(result.pages[0].rods[0].type).toBe('Valet Rod');
    expect(result.pages[0].miscCol1).toContain('Tearout included');
    expect(result.pages[0].miscCol2).toContain('NOT included');
    expect(result.unmatchedQuoteItems).toHaveLength(0);
    expect(result.unmatchedDrawingOpenings).toHaveLength(0);
  });

  it('flags a quote area with no matching drawing area', () => {
    const quote = { areas: [{ name: 'GUEST CLOSET', items: [{ description: 'Shoe Fence', productCode: 'SF-1', qty: 1 }] }], warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.unmatchedQuoteItems).toEqual([{ area: 'GUEST CLOSET', description: 'Shoe Fence', productCode: 'SF-1', qty: 1 }]);
  });

  it('flags a drawing area with no matching quote area', () => {
    const quote = { areas: [], warnings: [] };
    const drawings = { areas: [{ name: 'PANTRY', openings: [{ width: 12, height: 20, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.unmatchedDrawingOpenings).toEqual([{ area: 'PANTRY', openings: [{ width: 12, height: 20, depth: null }] }]);
  });

  it('falls back to a single blank page when there are no quote areas at all', () => {
    const result = buildEssPages({ project, contract: {}, quote: { areas: [], warnings: [] }, drawings: { areas: [], warnings: [] } });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].drawers).toEqual([]);
    expect(result.pages[0].rods).toEqual([]);
  });

  it('builds jobName exactly like the manual ESS modal does, stripping the sheet-name suffix', () => {
    // Sheet Name cells arrive as "Cliente:[SO#] Nombre". EssAutoGeneratorModal's
    // createDefaultPage runs them through shortProjectName, so pages added by
    // hand and pages produced here must not disagree on the header.
    const sheetProject = { so: '12485', name: 'Ashley Frankel:[12485] Ashley Frankel' };
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [], warnings: [] };

    const generated = buildEssPages({ project: sheetProject, contract: {}, quote, drawings });
    expect(generated.pages[0].headerData.jobName).toBe('12485 - Ashley Frankel');

    const blank = buildEssPages({ project: sheetProject, contract: {}, quote: { areas: [], warnings: [] }, drawings });
    expect(blank.pages[0].headerData.jobName).toBe('12485 - Ashley Frankel');
  });

  it('tolerates a quote area with no items array at all', () => {
    const quote = { areas: [{ name: 'MASTER WIC' }], warnings: [] };
    const drawings = { areas: [], warnings: [] };
    expect(() => buildEssPages({ project, contract: {}, quote, drawings })).not.toThrow();
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].rods).toEqual([]);
    expect(result.unmatchedQuoteItems).toEqual([]);
  });

  it('uses the Dovetail formula when boxType is DOVETAIL', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings, boxType: 'DOVETAIL' });
    expect(result.pages[0].drawers[0].box).toBe('23 5/8" W');
    expect(result.pages[0].drawerOptions.box).toBe('DOVETAIL');
  });

  it('writes dimensions as fractions, not decimals, like the hand-entered sheet', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 23.625, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].drawers[0].open).toBe('23 5/8"');
    expect(result.pages[0].drawers[0].box).toBe('22 5/8" W');
  });

  it('applies the backing-depth rule when the drawing gave a depth', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: 14 }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].drawers[0].box).toBe('23" W x 13 1/4" D');
  });

  it('omits the depth segment when the drawing had no depth callout', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].drawers[0].box).toBe('23" W');
  });

  it('sizes a hang rod from the opening it hangs in', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [{ description: 'Oval Chrome rod', productCode: 'OR-10', qty: 1 }] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 30, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].rods[0].size).toBe('29 3/4"');
  });

  it('leaves rod size blank and warns when the area has several openings to choose from', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [{ description: 'Oval Chrome rod', productCode: 'OR-10', qty: 1 }] }], warnings: [] };
    const drawings = {
      areas: [{ name: 'MASTER WIC', openings: [{ width: 30, height: null, depth: null }, { width: 24, height: null, depth: null }], unclassified: [] }],
      warnings: [],
    };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].rods[0].size).toBe('');
    expect(result.warnings).toContain('ROD_SIZE_AMBIGUOUS_MASTER WIC');
  });

  it('notes the 32mm boring pattern on any page that has drawers', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].miscCol1).toContain('32mm');
  });

  it('does not note a boring pattern on a page with no drawers', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.pages[0].miscCol1).not.toContain('32mm');
  });

  it('takes the color from the Quote, which is the only document that carries it', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], color: 'Bleached Linen', warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project: { so: '1', name: 'X' }, contract: {}, quote, drawings });
    expect(result.pages[0].headerData.color).toBe('Linen Classic 210');
  });

  it('keeps an unrecognised Quote color visible and warns instead of blanking it', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], color: 'Coastal Oak', warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project: { so: '1', name: 'X' }, contract: {}, quote, drawings });
    expect(result.pages[0].headerData.color).toBe('Coastal Oak');
    expect(result.warnings).toContain('COLOR_NOT_IN_MAP: Coastal Oak');
  });

  it('passes the fronts option through from the materials matrix', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings, fronts: 'THERMOFOIL' });
    expect(result.pages[0].drawerOptions.fronts).toBe('THERMOFOIL');
  });

  it('gives the fallback blank page the same box type and color as a real page', () => {
    const result = buildEssPages({
      project,
      contract: {},
      quote: { areas: [], color: 'Bleached Linen', warnings: [] },
      drawings: { areas: [], warnings: [] },
      boxType: 'DOVETAIL',
      fronts: 'THERMOFOIL',
    });
    expect(result.pages[0].drawerOptions.box).toBe('DOVETAIL');
    expect(result.pages[0].drawerOptions.fronts).toBe('THERMOFOIL');
    expect(result.pages[0].headerData.color).toBe('Linen Classic 210');
  });
});
