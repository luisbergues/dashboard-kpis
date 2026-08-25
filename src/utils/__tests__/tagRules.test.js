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

  it('cualquier aprobado puede borrar un tag, igual que la nota que lo contiene', () => {
    const write = node().$so.$tagId['.write'];
    // JSON no admite comentarios, asi que el razonamiento vive aca.
    //
    // La regla exigia antes `auth.uid === data.child('taggedByUid').val()` para
    // borrar, apoyada en el supuesto de que quien taggea es quien borra la nota.
    // Es falso: el boton de borrar nota lo ve CUALQUIER no-admin
    // (MyProjectsView.jsx, `{!isAdmin && ...}`) y engineer_nester ve todos los
    // proyectos. Y como el borrado en cascada es un update() multi-path
    // todo-o-nada (noteTags.deleteNoteWithTags), un tercero borrando una nota
    // tageada se llevaba rechazada TAMBIEN la nota, con un console.error como
    // unico rastro.
    //
    // Se alinea entonces con como project_notes ya gatea el borrado: aprobado
    // alcanza. No se cede poder real — quien puede borrar el tag ya podia
    // borrar la nota que lo contiene.
    expect(write).not.toContain('taggedByUid');
    expect(write).toContain("'approved'");
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
    expect(rules.engineer_directory.$uid['.write']).toContain('auth.uid === $uid');
  });

  it('solo un usuario aprobado puede escribir su entrada', () => {
    // Antes bastaba con `auth.uid === $uid`, sin la clausula de status que
    // llevan todos los demas nodos. Como el alta de cuenta es auto-servicio,
    // alguien parado en "pending" podia escribir contenido arbitrario en un
    // nodo que TODOS los clientes aprobados se bajan entero.
    expect(rules.engineer_directory.$uid['.write']).toContain("'approved'");
  });

  it('valida la forma de la entrada: name y updatedAt, con name string de hasta 40 chars', () => {
    const validate = rules.engineer_directory.$uid['.validate'];
    expect(validate).toBeDefined();
    expect(validate).toContain("hasChildren(['name', 'updatedAt'])");
    expect(validate).toContain("newData.child('name').isString()");
    expect(validate).toContain('length <= 40');
  });

  it('el nodo raiz del directorio no es escribible', () => {
    expect(rules.engineer_directory['.write']).toBeUndefined();
  });
});
