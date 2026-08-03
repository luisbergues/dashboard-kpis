import type { Phase1Outcome } from '../types';
import { formatDisplayDate } from '../../utils/dateFormat';

/* Redaccion automatica de la nota que lee el diseñador cuando su proyecto queda
   en Complete / Deficient / Deferred.

   Este modulo es la FUENTE DE VERDAD del contenido: arma el texto solo con
   datos del checklist, sin modelo de por medio. El endpoint de Gemini
   (api/reviewNote.js) solo reescribe esto en prosa mas cuidada; si falla, no
   esta configurado o tarda, se guarda este texto tal cual.

   El motivo es que la lista de documentos faltantes no puede inventarse ni
   omitirse: es lo que el diseñador va a usar para saber que corregir. */

export interface ReviewNoteFacts {
  outcome: Phase1Outcome;
  soNumber: string;
  projectName: string;
  designerName?: string;
  /** Etiquetas de los items del checklist que siguen sin tildar. */
  missingDocs: string[];
  deadline: number | null;
}

const bullets = (items: string[]): string => items.map(i => `  - ${i}`).join('\n');

const header = (f: ReviewNoteFacts): string => {
  const project = f.projectName ? `SO #${f.soNumber} - ${f.projectName}` : `SO #${f.soNumber}`;
  return project;
};

export const draftReviewNote = (f: ReviewNoteFacts): string => {
  const project = header(f);
  const greeting = f.designerName && f.designerName !== 'Unassigned' ? `Hi ${f.designerName},\n\n` : '';
  const due = f.deadline ? formatDisplayDate(new Date(f.deadline)) : null;

  if (f.outcome === 'Deficient') {
    const body = f.missingDocs.length > 0
      ? `The following items from the Strict Go / No-Go checklist are still missing or outstanding:\n\n${bullets(f.missingDocs)}\n\n`
      : 'Errors or inconsistencies were found during the manual quality review.\n\n';
    return greeting +
      `${project} has been marked Deficient in the Phase 1 engineering review, ` +
      `so it is being returned to you for corrections.\n\n` +
      body +
      (due ? `Please correct and resubmit by ${due}.` : 'Please correct and resubmit as soon as possible.');
  }

  if (f.outcome === 'Deferred') {
    const body = f.missingDocs.length > 0
      ? `The project is sold, but the following vital documents have not been received yet:\n\n${bullets(f.missingDocs)}\n\n`
      : 'The project is sold, but vital files are still missing, so it cannot enter engineering yet.\n\n';
    return greeting +
      `${project} has been placed on hold (Deferred) in the Phase 1 engineering review.\n\n` +
      body +
      (due ? `Please provide them by ${due}.` : 'Please provide them as soon as possible.');
  }

  // Complete. Puede llegar con documentacion faltante si lo aprobo el area
  // administrativa: en ese caso se deja constancia en vez de decir que estaba
  // todo, que seria falso.
  if (f.missingDocs.length > 0) {
    return greeting +
      `${project} has been marked Complete and released to engineering, ` +
      `even though the following items were still outstanding:\n\n${bullets(f.missingDocs)}\n\n` +
      `Please send them through as soon as possible.`;
  }
  return greeting +
    `${project} passed the Phase 1 engineering review and has been marked Complete. ` +
    `All required documentation was received, and the project is ready for engineering to begin work.`;
};
