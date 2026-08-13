// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const addEssQuote = vi.fn();
const removeEssQuote = vi.fn();
const loadEssQuoteIndex = vi.fn();
vi.mock('../../utils/essFiles', () => ({
  saveEssFile: vi.fn().mockResolvedValue(undefined),
  loadEssFile: vi.fn().mockResolvedValue(null),
  loadEssFileIndexEntry: vi.fn().mockResolvedValue(null),
  validateFileSize: () => ({ valid: true }),
  base64ToArrayBuffer: () => new ArrayBuffer(0),
  addEssQuote: (...a) => addEssQuote(...a),
  removeEssQuote: (...a) => removeEssQuote(...a),
  loadEssQuoteIndex: (...a) => loadEssQuoteIndex(...a),
}));
vi.mock('../../utils/essPdfExtract', () => ({
  extractPdfPages: vi.fn().mockResolvedValue([{ pageNumber: 1, items: [] }]),
  pagesToPlainText: () => 'Area:\nGarage',
}));
vi.mock('../../utils/essAutoData', () => ({
  saveEssAutoData: vi.fn(),
  hasEssAutoData: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../components/EssAutoGeneratorModal', () => ({ default: () => null }));

import { LanguageProvider } from '../../utils/LanguageContext';
import EssProjectDetail from '../EssProjectDetail';

const project = { so: '12116', name: 'James Aiello:[12116] James Aiello' };
const renderView = () =>
  render(
    <LanguageProvider>
      <EssProjectDetail project={project} materials={null} onBack={() => {}} />
    </LanguageProvider>,
  );

beforeEach(() => {
  addEssQuote.mockReset().mockResolvedValue('q_1');
  removeEssQuote.mockReset().mockResolvedValue(undefined);
  loadEssQuoteIndex.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('EssProjectDetail quote collection', () => {
  it('shows how many rooms the job has', async () => {
    loadEssQuoteIndex.mockResolvedValue({
      q_1: { name: 'a.pdf', area: 'Garage' },
      q_2: { name: 'b.pdf', area: 'MWIC' },
    });
    renderView();
    await waitFor(() => expect(screen.getByText(/2 rooms/i)).toBeTruthy());
    expect(screen.getByText('Garage')).toBeTruthy();
    expect(screen.getByText('MWIC')).toBeTruthy();
  });

  it('says there are no rooms yet when nothing is uploaded', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(/no rooms yet/i)).toBeTruthy());
  });

  // Un ambiente sin detectar no rechaza el archivo ni inventa un nombre.
  it('flags a quote whose area could not be detected', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: null } });
    renderView();
    await waitFor(() => expect(screen.getByText(/room not detected/i)).toBeTruthy());
  });

  it('marks two quotes claiming the same room as duplicates', async () => {
    loadEssQuoteIndex.mockResolvedValue({
      q_1: { name: 'a.pdf', area: 'Garage' },
      q_2: { name: 'b.pdf', area: 'Garage' },
    });
    renderView();
    await waitFor(() => expect(screen.getAllByText(/duplicate/i)).toHaveLength(2));
  });

  it('removes a quote from the list', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: 'Garage' } });
    renderView();
    await waitFor(() => expect(screen.getByText('Garage')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /remove Garage/i }));
    await waitFor(() => expect(removeEssQuote).toHaveBeenCalledWith('12116', 'q_1'));
  });

  // El input de archivo tiene que ser enfocable: con display:none no hay forma
  // de subir un PDF con teclado.
  it('gives every file input a reachable, distinguishable label', async () => {
    renderView();
    await waitFor(() => expect(screen.getByLabelText(/contract/i)).toBeTruthy());
    expect(screen.getByLabelText(/summary/i)).toBeTruthy();
    expect(screen.getByLabelText(/drawings/i)).toBeTruthy();
    expect(screen.getByLabelText(/contract/i).style.display).not.toBe('none');
  });

  it('keeps generation disabled until all four requirements are met', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: 'Garage' } });
    renderView();
    await waitFor(() => expect(screen.getByText('Garage')).toBeTruthy());
    // Contract, Summary y Drawings siguen vacíos.
    expect(screen.getByRole('button', { name: /generate ess/i }).disabled).toBe(true);
  });
});
