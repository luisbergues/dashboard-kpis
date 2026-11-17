import { describe, it, expect, vi, afterEach } from 'vitest';
import Papa from 'papaparse';
import { fetchAndParseData } from '../sheetParser';

// Los datos de planilla ya no se bajan con fetch: pasan por /api/sheet, que
// exige sesion iniciada y devuelve filas ya parseadas (ver fetchSheet.js).
// Estos tests ejercitan el PARSEO, asi que se mockea esa frontera y se le da
// el mismo CSV de antes convertido a filas, que es exactamente lo que el
// endpoint real entrega.
const sheet = vi.hoisted(() => ({ csv: '' }));
vi.mock('../fetchSheet', () => ({
  fetchSheetRows: vi.fn(async () => Papa.parse(sheet.csv, { skipEmptyLines: false }).data),
}));

// Recorte del tab principal a noviembre de 2026: la tabla de notas ON HOLD
// perdio su fila de titulo ("ON HOLD Projects - Detailed Notes") y arranca
// directo en el encabezado "Designer & Email".
const MAIN_CSV = [
  ',Priority Analysis (Action Required),,,,,,,,,',
  ',SO#,NAME,INSTALL,ENG,STATUS,FINALS SCHEDULED,FINAL TAKEN,Material Notes,,',
  ',12921,Liz Spector:[12921] Liz Spector In-Laws,11/23/2026,Luis,ON HOLD,2026-11-09,2026-11-09,,,',
  ',12977,Carol Balet:[12977] 2600 Fairway Island Dr.,11/30/2026,Luis,Check,2026-10-21,2026-10-21,,,',
  ',,,,,,,,,,',
  ',Designer & Email,Project Details,Notes / Comments,,,,,,,',
  ',"Kristoffer Nino\ndesigner@jlclosets.com",Liz Spector:[12921] Liz Spector In-Laws,DIFERENCES IN MEASUREMENTS,,,,,,,',
  ',,,,,,,,,,',
].join('\n');

afterEach(() => vi.unstubAllGlobals());

describe('fetchAndParseData — tabla de notas sin fila de titulo', () => {
  it('no mete las filas de "Designer & Email" en priorityAnalysis', async () => {
    sheet.csv = MAIN_CSV;
    const data = await fetchAndParseData();
    expect(data.priorityAnalysis.map(p => p.so)).toEqual(['12921', '12977']);
  });

  it('las lee como notas de ON HOLD', async () => {
    sheet.csv = MAIN_CSV;
    const data = await fetchAndParseData();
    expect(data.onHoldNotes).toHaveLength(1);
    expect(data.onHoldNotes[0].notes).toBe('DIFERENCES IN MEASUREMENTS');
  });
});

// Recorte del tab principal a noviembre de 2026: la tabla de materiales va
// seguida directo por la descripcion del impacto financiero, sin la fila de
// titulo "Financial Impact Analysis".
const MATERIALS_CSV = [
  ',Active Projects Material Requirements,,,,,,,,,',
  ',SO#,Project Name,Thermofoil,No Holes,Dovetail,Element,Installation Date,,,',
  ',12937,Michael George:[12937] Michael George,No,No,No,No,2027-02-22,,,',
  `,"Projects currently 'ON HOLD' represent a significant financial risk.",,,,,,,,,`,
  ',Status,Value,,,,,,,,',
  ',ON HOLD,"$76,641.00",,,,,,,,',
  ',Total,"$598,853.00",,,,,,,,',
  ',Performance Improvement Recommendations,,,,,,,,,',
  ',"To accelerate our workflow...",,,,,,,,,',
].join('\n');

describe('fetchAndParseData — impacto financiero sin fila de titulo', () => {
  it('la tabla de materiales termina en el ultimo SO', async () => {
    sheet.csv = MATERIALS_CSV;
    const data = await fetchAndParseData();
    expect(data.materialRequirements.map(m => m.so)).toEqual(['12937']);
  });

  it('reconoce la tabla Status/Value como impacto financiero', async () => {
    sheet.csv = MATERIALS_CSV;
    const data = await fetchAndParseData();
    expect(data.financialImpact.rows).toEqual([
      { status: 'ON HOLD', value: '$76,641.00' },
      { status: 'Total', value: '$598,853.00' },
    ]);
    expect(data.financialImpact.description).toMatch(/significant financial risk/);
  });
});
