import { describe, it, expect } from 'vitest';
import { buildLLMContext } from './llmChat';

const contacts = [
  { name: 'Natalie Ball', phone: '954-899-7307', email: 'nball@jlclosets.com', city: 'CORAL SPRINGS' },
  { name: 'Monica Gabriel', phone: '954-678-8432', email: 'mgabriel@jlclosets.com', city: 'BOCA RATON' },
];

describe('buildLLMContext — contact anchoring (BUG #2 fix)', () => {
  it('injects the anchored contact when a follow-up query does not name them', () => {
    // User asked "natalie contact" (answered locally, not via Gemini), then
    // asks "y su telefono?" — the query itself names no contact.
    const ctx = buildLLMContext({
      query: 'y su telefono?',
      designerContacts: contacts,
      isES: true,
      anchoredContactName: 'Natalie Ball',
    });

    expect(ctx).toContain('Contacto en Foco');
    expect(ctx).toContain('Natalie Ball');
    expect(ctx).toContain('954-899-7307');
    // The non-anchored contact must not leak in on an unrelated follow-up.
    expect(ctx).not.toContain('Monica');
  });

  it('produces empty context for the same follow-up when nothing is anchored', () => {
    const ctx = buildLLMContext({
      query: 'y su telefono?',
      designerContacts: contacts,
      isES: true,
    });
    expect(ctx.trim()).toBe('');
  });

  it('still matches a contact by name directly (no anchor needed)', () => {
    const ctx = buildLLMContext({
      query: 'natalie',
      designerContacts: contacts,
      isES: true,
    });
    expect(ctx).toContain('Natalie Ball');
    expect(ctx).toContain('Contactos de Diseñadores');
  });

  it('English anchored section is emitted when isES is false', () => {
    const ctx = buildLLMContext({
      query: 'and her phone?',
      designerContacts: contacts,
      isES: false,
      anchoredContactName: 'Natalie Ball',
    });
    expect(ctx).toContain('Contact in Focus');
    expect(ctx).toContain('Natalie Ball');
  });
});
