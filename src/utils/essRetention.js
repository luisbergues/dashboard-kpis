import { STATUS_INDEX_MAP } from './stageUtils';

// The PDFs exist to produce the ESS. Once the project is checked and nesting
// starts, the sheet has been generated, reviewed and taken to the floor, so the
// source documents are dead weight — see the design doc for the full rationale.
const NESTING_INDEX = STATUS_INDEX_MAP.NESTING;

export function hasReachedNesting(project) {
  const status = (project?.status || '').toUpperCase().trim();
  const index = STATUS_INDEX_MAP[status];
  return index !== undefined && index >= NESTING_INDEX;
}
