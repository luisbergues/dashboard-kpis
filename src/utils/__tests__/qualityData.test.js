import { describe, it, expect } from 'vitest';
import { parseQualityCsv } from '../sheetParser';

// Recorte fiel de la pestaña "Personal KPI" (gid 1762634268). Conserva las
// trampas reales que tiene el tab: la tabla vieja de totales, el encabezado de
// la tabla de proyectos (que tambien dice "Eng. Engineering" + "Own Points"),
// las secciones de 61-90 / 91-120 dias y las tres tablas "... Performance"
// cuyo encabezado tambien arranca con "Engineer".
const CSV = [
  'No Holes Multiplier,125%,% Strip Lights,0.1',
  '% Revision,5%,% Multicolor,0.1',
  '% Nesting,$0.30',
  ',,,,',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Projects that Added',
  'Joaquín,"$9,771.24",$0.00,"$274,981.19","$284,752.43","12265, 11393"',
  'Delfina,"$80,523.64",$0.00,$0.00,"$80,523.64","11393, 12097"',
  'SO.TEAM',
  ',,,,',
  'SO#,Project Name,Eng. Review,Eng. Engineering,Eng. Check Eng,Eng. Paperwork,Eng. Check,Status,Amount,No Holes?,Strip Lights?,Multicolor ?,Reviewer 1,Reviewer 2,Reviewer 3,Nesting,Calculated Weight,Own Points,Revision Value,Nesting Value',
  '12265,Sharon Johnson:[12265] Sharon Johnson,Julieta,Julieta,Julieta,Julieta,Julieta,✓,"$7,600.00",No,No,No,,,,Joaquín,"$7,600.00","$5,320.00",$0.00,"$2,280.00"',
  ',,,,,,,,,,,,,,,,,,,$0.00',
  ',,,,',
  'Engineer,% of Total',
  'Joaquín,23.5%',
  'Santiago,15.6%',
  'Delfina,6.6%',
  ',,,,',
  '📊 DASHBOARD USER GUIDE & INSTRUCTIONS',
  '🔍 PROJECT DEEP DIVE ANALYSIS',
  ',,,,',
  'KPI Last 30 Days (07/20 - 08/19)',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Projects that Added,Dynamic Explanation',
  'Joaquín,$0.00,$0.00,"$33,942.99","$33,942.99","12390, 12655","In the last 30 days, Joaquín accumulated a total of 33,942.99 points."',
  'Santiago,"$41,817.63","$4,004.59","$48,724.11","$94,546.32","12028, 12580","In the last 30 days, Santiago accumulated a total of 94,546.32 points."',
  ',,,,',
  'KPI 31-60 Days (06/20 - 07/19)',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Projects that Added,Dynamic Explanation',
  'Joaquín,$0.00,$0.00,"$71,267.91","$71,267.91","12443, 12461","In the 31-60 days period, Joaquín accumulated a total of 71,267.91 points."',
  'Santiago,"$2,792.30","$5,257.33","$29,641.02","$37,690.65","12480, 12670","In the 31-60 days period, Santiago accumulated a total of 37,690.65 points."',
  ',,,,',
  'KPI 61-90 Days (05/21 - 06/19)',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Projects that Added,Dynamic Explanation',
  'Joaquín,"$9,771.24",$0.00,"$167,312.10","$177,083.34","12313, 12119","In the 61-90 days period."',
  'Santiago,"$95,862.47","$6,843.53","$56,717.25","$159,423.24","12485, 12308","In the 61-90 days period."',
  ',,,,',
  'KPI 91-120 Days (04/21 - 05/20)',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Projects that Added,Dynamic Explanation',
  'Joaquín,"$9,771.24",$0.00,"$146,270.57","$156,041.81","12265, 11393","In the 91-120 days period."',
  'Jose,$0.00,$0.00,$0.00,$0.00,,"In the 91-120 days period, Jose accumulated a total of 0.00 points."',
  ',,,,',
  'KPI Last 30 Days (07/20 - 08/19) Performance',
  'Engineer,Working Days,Labor Hours,Value Produced,$/Hour,$/Hr Score (50),Mistakes,Final Score',
  'Joaquín,23,184,"$33,942.99",$184.47,17.95,0.00,"33,942.99"',
  'Santiago,23,184,"$94,546.32",$513.84,50.00,"6,142.00","88,404.32"',
].join('\n');

describe('parseQualityCsv — tabla "% of Total" (A139:B146 del tab real)', () => {
  const { kpiData } = parseQualityCsv(CSV);

  it('lee solo la tabla de porcentajes, no la de totales', () => {
    expect(kpiData).toEqual([
      { engineer: 'Joaquín', percent: 23.5 },
      { engineer: 'Santiago', percent: 15.6 },
      { engineer: 'Delfina', percent: 6.6 },
    ]);
  });

  // El parser viejo activaba la tabla con cualquier fila que dijera "engineer"
  // + "own points", asi que el encabezado de la tabla de proyectos y las cuatro
  // tablas por periodo la re-abrian: 55 filas en vez de 7, con "ingenieros"
  // llamados "KPI 31-60 Days (06/20 - 07/19)".
  it('no deja entrar titulos de seccion como si fueran ingenieros', () => {
    const names = kpiData.map(r => r.engineer);
    expect(names.some(n => n.toLowerCase().startsWith('kpi'))).toBe(false);
    expect(names).not.toContain('SO.TEAM');
    expect(names).not.toContain('Engineer');
  });

  it('no duplica ingenieros', () => {
    const names = kpiData.map(r => r.engineer);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('parseQualityCsv — tablas por periodo', () => {
  const { last30Days, days31to60 } = parseQualityCsv(CSV);

  it('toma el titulo tal cual figura en la hoja', () => {
    expect(last30Days.title).toBe('KPI Last 30 Days (07/20 - 08/19)');
    expect(days31to60.title).toBe('KPI 31-60 Days (06/20 - 07/19)');
  });

  it('lee las cuatro columnas de puntos de Last 30 Days', () => {
    expect(last30Days.rows[0]).toMatchObject({
      engineer: 'Joaquín',
      ownPoints: 0,
      revisionPoints: 0,
      nestingPoints: 33942.99,
      totalKPI: 33942.99,
    });
    expect(last30Days.rows[1]).toMatchObject({
      engineer: 'Santiago',
      ownPoints: 41817.63,
      revisionPoints: 4004.59,
      nestingPoints: 48724.11,
      totalKPI: 94546.32,
    });
  });

  it('lee las cuatro columnas de puntos de 31-60 Days', () => {
    expect(days31to60.rows.map(r => r.engineer)).toEqual(['Joaquín', 'Santiago']);
    expect(days31to60.rows[1]).toMatchObject({
      ownPoints: 2792.30,
      revisionPoints: 5257.33,
      nestingPoints: 29641.02,
      totalKPI: 37690.65,
    });
  });

  // Total KPI sale de la columna E de la hoja, no de sumar los componentes:
  // la hoja redondea con precision completa y en varias filas la suma de lo
  // que se muestra da un centavo mas (41,817.63 + 4,004.59 + 48,724.11 =
  // 94,546.33 contra los 94,546.32 de la hoja). Manda la hoja.
  it('respeta el Total KPI de la hoja aunque no cierre con la suma', () => {
    const row = last30Days.rows[1];
    expect(row.ownPoints + row.revisionPoints + row.nestingPoints).toBeCloseTo(94546.33, 2);
    expect(row.totalKPI).toBe(94546.32);
  });

  it('arrastra proyectos y explicacion (columnas F y G)', () => {
    expect(last30Days.rows[0].projects).toBe('12390, 12655');
    expect(last30Days.rows[0].explanation).toContain('accumulated a total of 33,942.99 points');
  });

  it('corta cada tabla en la fila vacia, sin comerse la seccion siguiente', () => {
    expect(last30Days.rows).toHaveLength(2);
    expect(days31to60.rows).toHaveLength(2);
  });

  // La trampa que rompio al parser viejo: "KPI Last 30 Days (...) Performance"
  // empieza igual que la seccion buena pero sus columnas son Working Days /
  // Labor Hours, que entraban como Own Points / Revision Points.
  it('ignora la seccion "... Performance" homonima', () => {
    expect(last30Days.rows.some(r => r.ownPoints === 23 && r.revisionPoints === 184)).toBe(false);
  });
});

describe('parseQualityCsv — periodos 61-90 y 91-120', () => {
  const { days61to90, days91to120 } = parseQualityCsv(CSV);

  it('toma el titulo tal cual figura en la hoja', () => {
    expect(days61to90.title).toBe('KPI 61-90 Days (05/21 - 06/19)');
    expect(days91to120.title).toBe('KPI 91-120 Days (04/21 - 05/20)');
  });

  it('lee las cuatro columnas de puntos de 61-90 Days', () => {
    expect(days61to90.rows.map(r => r.engineer)).toEqual(['Joaquín', 'Santiago']);
    expect(days61to90.rows[1]).toMatchObject({
      ownPoints: 95862.47,
      revisionPoints: 6843.53,
      nestingPoints: 56717.25,
      totalKPI: 159423.24,
    });
  });

  it('lee las cuatro columnas de puntos de 91-120 Days', () => {
    expect(days91to120.rows[0]).toMatchObject({
      engineer: 'Joaquín',
      ownPoints: 9771.24,
      revisionPoints: 0,
      nestingPoints: 146270.57,
      totalKPI: 156041.81,
    });
  });

  // En 91-120 la hoja trae ingenieros en cero con "Projects that Added" vacio.
  // Son filas validas: tienen que aparecer, no filtrarse por sumar cero.
  it('conserva las filas en cero con lista de proyectos vacia', () => {
    const jose = days91to120.rows.find(r => r.engineer === 'Jose');
    expect(jose).toBeDefined();
    expect(jose.totalKPI).toBe(0);
    expect(jose.projects).toBe('');
  });

  // "KPI 61-90 Days (05/21 - 06/19) Performance" existe en el tab real; el
  // bloque de 91-120 no tiene homonimo, pero el corte tiene que valer igual.
  it('no se come la seccion "... Performance" que viene despues', () => {
    expect(days61to90.rows).toHaveLength(2);
    expect(days91to120.rows).toHaveLength(2);
    expect(days61to90.rows.some(r => r.revisionPoints === 184)).toBe(false);
  });
});

describe('parseQualityCsv — hoja sin las secciones esperadas', () => {
  it('devuelve estructura vacia en vez de explotar', () => {
    const result = parseQualityCsv('foo,bar\n1,2');
    expect(result.kpiData).toEqual([]);
    expect(result.last30Days).toBeNull();
    expect(result.days31to60).toBeNull();
    expect(result.days61to90).toBeNull();
    expect(result.days91to120).toBeNull();
  });
});
