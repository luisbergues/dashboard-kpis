import { describe, it, expect } from 'vitest';
import { getSharedProjectSo, buildSharedProjectLink } from '../projectDeepLink';

describe('leer el SO del link', () => {
  it('lo devuelve cuando esta', () => {
    expect(getSharedProjectSo('?so=12705')).toBe('12705');
  });

  it('funciona con otros parametros al lado', () => {
    expect(getSharedProjectSo('?utm=mail&so=9107&x=1')).toBe('9107');
  });

  it('devuelve null si no esta', () => {
    expect(getSharedProjectSo('')).toBeNull();
    expect(getSharedProjectSo('?other=1')).toBeNull();
  });

  it('rechaza cualquier cosa que no sean digitos', () => {
    // El valor entra por la barra de direcciones: no se confia en el.
    expect(getSharedProjectSo('?so=abc')).toBeNull();
    expect(getSharedProjectSo('?so=../../etc')).toBeNull();
    expect(getSharedProjectSo('?so=<script>')).toBeNull();
    expect(getSharedProjectSo('?so=')).toBeNull();
  });

  it('tolera espacios alrededor', () => {
    expect(getSharedProjectSo('?so=%2012705%20')).toBe('12705');
  });
});

describe('armar el link', () => {
  const loc = { origin: 'https://kpi.example.com', pathname: '/' };

  it('devuelve una URL absoluta al proyecto', () => {
    expect(buildSharedProjectLink('12705', loc)).toBe('https://kpi.example.com/?so=12705');
  });

  it('conserva la ruta cuando la app no esta en la raiz', () => {
    expect(buildSharedProjectLink('12705', { ...loc, pathname: '/app/' }))
      .toBe('https://kpi.example.com/app/?so=12705');
  });

  it('no arma nada con un SO invalido', () => {
    expect(buildSharedProjectLink('', loc)).toBe('');
    expect(buildSharedProjectLink('abc', loc)).toBe('');
    expect(buildSharedProjectLink(null, loc)).toBe('');
  });

  it('lo que arma se puede volver a leer', () => {
    const url = buildSharedProjectLink('9107', loc);
    expect(getSharedProjectSo(url.slice(url.indexOf('?')))).toBe('9107');
  });
});
