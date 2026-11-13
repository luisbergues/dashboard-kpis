// Canonical designer contact directory. Single source of truth — read by
// ProjectChatbot, IPGeneratorModal, and ProjectDetailView, which used to each
// carry their own hardcoded copy that had already drifted (ProjectDetailView
// had typo'd aliases for "Caryn Henslovitz" the other two lacked).
//
// This is the fallback/seed data used when Firebase's `designer_contacts`
// node hasn't been populated yet (see useDesignerContacts.js). Aliases map
// alternate spellings seen in the sheet to the canonical entry.
// Mismos diseñadores que la lista canonica (designers.js), reducida en
// noviembre de 2026. Los nombres completos ("Melissa Ann Barker"...) van como
// alias: asi figuran en el selector de diseñador de otros formularios.
export const DESIGNER_CONTACTS = [
  { name: 'Melissa Barker', phone: '561-587-0632', email: 'mbarker@jlclosets.com', city: 'DELRAY BEACH', aliases: ['Melissa Ann Barker'] },
  { name: 'Blerta Veseli', phone: '561-971-0525', email: 'bveseli@jlclosets.com', city: 'MIAMI' },
  { name: 'Russell Reiner', phone: '561-350-7999', email: 'rreiner@jlclosets.com', city: 'PALM BEACH', aliases: ['Russell C. Reiner'] },
  { name: 'Sarah Manev', phone: '561-306-6192', email: 'smanev@jlclosets.com', city: 'PARKLAND', aliases: ['Sarah Elizabeth Manev'] },
  {
    name: 'Caryn Henslovitz',
    phone: '945-290-7997',
    email: 'chenslovitz@jlclosets.com',
    city: 'PARKLAND',
    aliases: ['Caryn', 'Her Henslovitz', 'Caryn Heitlovitz', 'Her Heitlovitz'],
  },
  { name: 'Malanie Dalfrey', phone: '772-278-6949', email: 'mdalfrey@jlclosets.com', city: 'PORT ST. LUCIE' },
  // Sin ciudad cargada: el chatbot muestra N/A.
  { name: 'Delfina Breton', phone: '239-288-0050', email: 'dbreton@jlclosets.com' },
];

// Flat { name: phone } map, including aliases — used by callers that only
// need a phone lookup (IPGeneratorModal, ProjectDetailView).
export function buildPhoneLookup(contacts = DESIGNER_CONTACTS) {
  const lookup = {};
  contacts.forEach(d => {
    lookup[d.name] = d.phone;
    (d.aliases || []).forEach(alias => { lookup[alias] = d.phone; });
  });
  return lookup;
}
