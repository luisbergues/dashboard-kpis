// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const state = vi.hoisted(() => ({ isLoading: false }));

vi.mock('react-to-print', () => ({ useReactToPrint: () => () => {} }));
vi.mock('../PDFPrintLayout', () => ({ default: () => null }));
vi.mock('../EssFormFields', () => ({ default: () => null }));
vi.mock('../../utils/essAutoData', () => ({
  saveEssAutoData: vi.fn(),
  loadEssAutoData: vi.fn(),
  saveEssCorrection: vi.fn(),
}));
vi.mock('../../utils/usePagedModal', () => ({
  usePagedModal: () => ({
    pages: [{ headerData: {}, drawerOptions: {}, drawers: [], rods: [], miscCol1: '', miscCol2: '' }],
    currentPageIndex: 0,
    setCurrentPageIndex: vi.fn(),
    isLoading: state.isLoading,
    addPage: vi.fn(),
    removePage: vi.fn(),
    updateCurrentPage: vi.fn(),
  }),
}));

import { LanguageProvider } from '../../utils/LanguageContext';
import EssAutoGeneratorModal from '../EssAutoGeneratorModal';

const project = { so: '100', name: 'Jane Doe:[100] Jane Doe' };

// The overlay is position:fixed, which only means "relative to the viewport"
// while no ancestor has a transform/filter. .glass-card:hover sets
// transform: translateY(-2px), so an overlay mounted inside a card silently
// becomes absolutely positioned within that card and lands off-screen.
const renderInsideACard = () =>
  render(
    <LanguageProvider>
      <div className="glass-card">
        <EssAutoGeneratorModal project={project} materials={null} onClose={() => {}} />
      </div>
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  state.isLoading = false;
});

describe('EssAutoGeneratorModal placement', () => {
  it('escapes the card it was mounted in', () => {
    const { container } = renderInsideACard();
    expect(container.querySelector('.pdf-modal-overlay')).toBeNull();
    expect(document.body.querySelector('.pdf-modal-overlay')).toBeTruthy();
  });

  it('escapes it while still loading too', () => {
    state.isLoading = true;
    const { container } = renderInsideACard();
    expect(container.querySelector('.pdf-modal-overlay')).toBeNull();
    expect(document.body.querySelector('.pdf-modal-overlay')).toBeTruthy();
  });
});
