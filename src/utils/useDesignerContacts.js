import { useState, useEffect } from 'react';
import { db, ref, onValue } from './firebase';
import { DESIGNER_CONTACTS, buildPhoneLookup } from './designerContacts';

// Reads the designer contact directory from Firebase (`designer_contacts`),
// falling back to the hardcoded DESIGNER_CONTACTS list if that node hasn't
// been populated yet (first deploy, or Firebase unconfigured/offline) — so
// this never regresses behavior for existing users while making the
// directory editable from Firebase (and eventually the Admin panel) instead
// of requiring a code change in three separate files.
export function useDesignerContacts() {
  const [contacts, setContacts] = useState(DESIGNER_CONTACTS);

  useEffect(() => {
    if (!db) return;
    const contactsRef = ref(db, 'designer_contacts');
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const dbVal = snapshot.val();
      if (dbVal && Array.isArray(dbVal) && dbVal.length > 0) {
        setContacts(dbVal.filter(Boolean));
      }
      // If the node is empty/missing, keep the fallback list already in state.
    });
    return () => unsubscribe();
  }, []);

  return { contacts, phoneLookup: buildPhoneLookup(contacts) };
}
