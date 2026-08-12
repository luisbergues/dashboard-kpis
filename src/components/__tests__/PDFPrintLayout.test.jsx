// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PDFPrintLayout from '../PDFPrintLayout';

afterEach(cleanup);

/* Este era el crash reportado: "TypeError: Cannot read properties of undefined
   (reading 'map')" dentro de PDFPrintLayout, disparado al abrir una ESS
   generada. Firebase borra la clave al guardar un array vacio, asi que la
   pagina volvia sin `drawers`/`rods`. Como App.jsx envuelve todo renderView()
   en un solo ErrorBoundary, se caia la vista ESS entera. */

const headerData = { jobName: '12116 - James Aiello', color: '', rooms: '', designer: '', engineer: '' };
const drawerOptions = { fronts: 'SLAB', box: 'PRFV', slides: 'SOFT CLOSE', handles: 'STD. CHROME' };

describe('PDFPrintLayout — no puede caerse por una lista ausente', () => {
  it('renderiza sin drawers ni rods', () => {
    expect(() =>
      render(<PDFPrintLayout headerData={headerData} drawerOptions={drawerOptions} miscCol1="" miscCol2="" />),
    ).not.toThrow();
  });

  it('renderiza con drawers ausente pero rods presente', () => {
    expect(() =>
      render(
        <PDFPrintLayout
          headerData={headerData}
          drawerOptions={drawerOptions}
          rods={[{ room: 'MWIC', type: 'Oval Chrome rod', qty: 1, size: '29 3/8"' }]}
          miscCol1=""
          miscCol2=""
        />,
      ),
    ).not.toThrow();
  });

  it('sigue pintando el contenido cuando las listas si vienen', () => {
    const { container } = render(
      <PDFPrintLayout
        headerData={headerData}
        drawerOptions={drawerOptions}
        drawers={[{ front: '6 1/8"', qty: 2, open: '23 1/8"', box: '22 1/8" W', room: 'MWIC', handles: '' }]}
        rods={[{ room: 'MWIC', type: 'Oval Chrome rod', qty: 1, size: '29 3/8"' }]}
        miscCol1="nota"
        miscCol2=""
      />,
    );
    expect(container.textContent).toContain('MWIC');
    expect(container.textContent).toContain('12116 - James Aiello');
  });
});
