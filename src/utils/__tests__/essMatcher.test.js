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

  it('uses the Dovetail formula when boxType is DOVETAIL', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings, boxType: 'DOVETAIL' });
    expect(result.pages[0].drawers[0].box).toBe('23.625" W');
    expect(result.pages[0].drawerOptions.box).toBe('DOVETAIL');
  });
});
