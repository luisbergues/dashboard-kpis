// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const markForPurge = vi.fn();
const clearPurgeMark = vi.fn();
const purgeEssFiles = vi.fn();
vi.mock('../../utils/essFiles', () => ({
  markForPurge: (...a) => markForPurge(...a),
  clearPurgeMark: (...a) => clearPurgeMark(...a),
  purgeEssFiles: (...a) => purgeEssFiles(...a),
}));

// onValue fires its callback synchronously with whichever snapshot the test
// set up, dispatching on the node path EssView subscribed to.
let indexSnapshot = {};
let autoDataSnapshot = {};
vi.mock('../../utils/firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  onValue: (refArg, cb) => {
    cb({ val: () => (refArg.path === 'ess_file_index' ? indexSnapshot : autoDataSnapshot) });
    return () => {};
  },
}));

// The detail screen drags in the whole pdfjs stack; this suite is about the list.
vi.mock('../EssProjectDetail', () => ({ default: () => null }));

import { LanguageProvider } from '../../utils/LanguageContext';
import EssView from '../EssView';

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const withFile = (extra = {}) => ({
  contract: { name: 'c.pdf', uploadedAt: ago(90 * DAY) },
  ...extra,
});

const renderView = (projects) =>
  render(
    <LanguageProvider>
      <EssView data={{ priorityAnalysis: projects }} />
    </LanguageProvider>,
  );

beforeEach(() => {
  markForPurge.mockReset();
  clearPurgeMark.mockReset();
  purgeEssFiles.mockReset();
  indexSnapshot = {};
  autoDataSnapshot = {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('EssView retention sweep', () => {
  it('marks a project that reached nesting', async () => {
    indexSnapshot = { 100: withFile() };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(markForPurge).toHaveBeenCalledWith('100', expect.any(String)));
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });

  it('purges a marked project once the grace window elapsed', async () => {
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(purgeEssFiles).toHaveBeenCalledWith('100'));
  });

  it('clears the mark instead of purging when the project fell back', async () => {
    // The sheet-flicker guard, end to end.
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'PAPERWORK' }]);
    await waitFor(() => expect(clearPurgeMark).toHaveBeenCalledWith('100'));
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });

  it('shows the countdown on a marked row', async () => {
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(3 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(screen.getByText('Deletes in 4 days')).toBeTruthy());
  });

  it('leaves a project absent from the sheet alone and reports it', async () => {
    indexSnapshot = { 999: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'ENGINEERING' }]);
    await waitFor(() => expect(screen.getByText(/absent from the sheet/)).toBeTruthy());
    expect(purgeEssFiles).not.toHaveBeenCalled();
    expect(markForPurge).not.toHaveBeenCalled();
  });

  it('does not sweep before both sides of the data have landed', async () => {
    indexSnapshot = {};
    renderView([]);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(markForPurge).not.toHaveBeenCalled();
    expect(clearPurgeMark).not.toHaveBeenCalled();
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });
});
