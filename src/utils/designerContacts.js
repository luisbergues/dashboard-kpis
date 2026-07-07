// Canonical designer contact directory. Single source of truth — read by
// ProjectChatbot, IPGeneratorModal, and ProjectDetailView, which used to each
// carry their own hardcoded copy that had already drifted (ProjectDetailView
// had typo'd aliases for "Caryn Henslovitz" the other two lacked).
//
// This is the fallback/seed data used when Firebase's `designer_contacts`
// node hasn't been populated yet (see useDesignerContacts.js). Aliases map
// alternate spellings seen in the sheet to the canonical entry.
export const DESIGNER_CONTACTS = [
  { name: 'Monica Gabriel', phone: '954-678-8432', email: 'mgabriel@jlclosets.com', city: 'BOCA RATON' },
  { name: 'Natalie Ball', phone: '954-899-7307', email: 'nball@jlclosets.com', city: 'CORAL SPRINGS' },
  { name: 'Marsha Diquez', phone: '754-779-0502', email: 'mdiquez@jlclosets.com', city: 'COCONUT CK' },
  { name: 'Iris Lopes', phone: '786-280-4004', email: 'ilopes@jlclosets.com', city: 'DEERFIELD BCH' },
  { name: 'Kat Baumgartner', phone: '270-991-1002', email: 'kbaumgartner@jlclosets.com', city: 'DANIA BEACH' },
  { name: 'Melissa Barker', phone: '561-587-0632', email: 'mbarker@jlclosets.com', city: 'DELRAY BEACH' },
  { name: 'Nicole Dugan', phone: '239-788-4114', email: 'ndugan@jlclosets.com', city: 'FORT MYERS' },
  { name: 'Tricia Hatton', phone: '561-324-0033', email: 'thatton@jlclosets.com', city: 'LAKE WORTH' },
  { name: 'Blerta Veseli', phone: '561-971-0525', email: 'bveseli@jlclosets.com', city: 'MIAMI' },
  { name: 'Lana Kravtchenko', phone: '646-309-5301', email: 'lkravtchenko@jlclosets.com', city: 'MIAMI' },
  { name: 'Krisztina Vizi', phone: '561-537-6787', email: 'kvizi@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Luana Tamagnone', phone: '561-816-1779', email: 'ltamagnone@jlclosets.com', city: 'W. PALM BEACH' },
  { name: 'Russell Reiner', phone: '561-350-7999', email: 'rreiner@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Mauricio Dasso', phone: '203-561-9581', email: 'mdasso@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Sarah Manev', phone: '561-306-6192', email: 'smanev@jlclosets.com', city: 'PARKLAND' },
  {
    name: 'Caryn Henslovitz',
    phone: '945-290-7997',
    email: 'chenslovitz@jlclosets.com',
    city: 'PARKLAND',
    aliases: ['Caryn', 'Her Henslovitz', 'Caryn Heitlovitz', 'Her Heitlovitz'],
  },
  { name: 'Michael Kaboskey', phone: '954-257-5087', email: 'mkaboskey@jlclosets.com', city: 'PORT ST. LUCIE' },
  { name: 'Malanie Dalfrey', phone: '772-278-6949', email: 'mdalfrey@jlclosets.com', city: 'PORT ST. LUCIE' },
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
