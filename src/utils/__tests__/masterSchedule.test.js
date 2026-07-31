import { describe, it, expect } from 'vitest';
import { parseMasterSchedule } from '../masterSchedule';

// Recorte fiel de la pestaña real: encabezado en la fila 1, comillas, comas
// dentro de celdas y saltos de linea embebidos en Comments.
const CSV = [
  'SO,Client,# Of Closets / Spaces,Install Date,Completion Date,Comments',
  '12705,Patricia Milanes:[12705] Christian/Patricia,2,,,sin terminar',
  '9984,"Smith, John:[9984] Garage",1,14-Aug-2024,08/16/2024,ya cerrado',
  '12333,Melanie Raska:[12333] Melanie Raska Residence,4,,,"nota larga',
  'con salto de linea"',
  '0,[0] SHOWROOM,,,,fila basura',
  ',,,,,',
  '12598,Candice Morgenlander:[12598] Office,1,,,',
].join('\n');

describe('parseMasterSchedule', () => {
  const rows = parseMasterSchedule(CSV);

  it('devuelve solo las filas sin Completion Date', () => {
    expect(rows.map(r => r.so)).toEqual(['12705', '12333', '12598']);
  });

  it('excluye las filas ya completadas', () => {
    expect(rows.find(r => r.so === '9984')).toBeUndefined();
  });

  it('excluye la fila SHOWROOM (SO 0)', () => {
    expect(rows.find(r => r.so === '0')).toBeUndefined();
  });

  it('excluye filas vacias', () => {
    expect(rows.every(r => r.so)).toBe(true);
  });

  it('conserva el nombre del cliente como nombre de proyecto', () => {
    expect(rows[0].name).toBe('Patricia Milanes:[12705] Christian/Patricia');
  });

  it('sobrevive a celdas con saltos de linea embebidos', () => {
    const r = rows.find(x => x.so === '12333');
    expect(r).toBeDefined();
    expect(r.name).toBe('Melanie Raska:[12333] Melanie Raska Residence');
  });

  it('expone spaces como numero cuando esta disponible', () => {
    expect(rows.find(r => r.so === '12705').spaces).toBe(2);
    expect(rows.find(r => r.so === '12333').spaces).toBe(4);
  });

  it('tolera un CSV vacio', () => {
    expect(parseMasterSchedule('')).toEqual([]);
    expect(parseMasterSchedule('SO,Client,Completion Date')).toEqual([]);
  });

  it('no rompe si faltan columnas esperadas', () => {
    expect(parseMasterSchedule('Foo,Bar\n1,2')).toEqual([]);
  });
});

describe('parseMasterSchedule — SO duplicados', () => {
  it('conserva solo la primera aparicion: el modulo indexa por SO', () => {
    const dup = [
      'SO,Client,Completion Date',
      '7832,[7832] Frater Her Closet,',
      '7832,[7832] Frater His Closet,',
    ].join('\n');
    const rows = parseMasterSchedule(dup);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('[7832] Frater Her Closet');
  });
});
