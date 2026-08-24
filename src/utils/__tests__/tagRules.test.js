import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules;

describe('reglas de project_tags', () => {
  const node = () => rules.project_tags;

  it('existe y es legible por cualquier usuario aprobado', () => {
    expect(node()).toBeDefined();
    expect(node()['.read']).toContain("'approved'");
  });

  it('solo el destinatario puede escribir readAt', () => {
    const readAtRule = node().$so.$tagId.readAt['.write'];
    expect(readAtRule).toContain('taggedUid');
    expect(readAtRule).toContain('auth.uid');
  });

  it('un tag creado no se puede modificar: el padre solo admite crear y borrar', () => {
    const write = node().$so.$tagId['.write'];
    expect(write).toContain('!data.exists()');
    expect(write).toContain('!newData.exists()');
  });

  it('solo quien tageo puede borrar el tag', () => {
    expect(node().$so.$tagId['.write']).toContain('taggedByUid');
  });

  it('nadie puede taggear en nombre de otro', () => {
    const validate = node().$so.$tagId['.validate'];
    // Guarded by data.exists() so it cannot block updates to existing tags (like readAt writes).
    // When creating a new tag, data.exists() is false, so the second clause enforces
    // that taggedByUid must equal auth.uid — preventing impersonation.
    expect(validate).toContain('data.exists()');
    expect(validate).toContain('taggedByUid');
    expect(validate).toContain('auth.uid');
  });
});

describe('reglas de engineer_directory', () => {
  it('es legible por cualquier aprobado', () => {
    expect(rules.engineer_directory['.read']).toContain("'approved'");
  });

  it('cada uno solo puede escribir su propia entrada', () => {
    expect(rules.engineer_directory.$uid['.write']).toBe('auth.uid === $uid');
  });

  it('el nodo raiz del directorio no es escribible', () => {
    expect(rules.engineer_directory['.write']).toBeUndefined();
  });
});
