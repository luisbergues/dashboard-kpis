import { useState, useEffect } from 'react';
import { db, ref, onValue } from './firebase';
import { isSuperAdminRole } from './adminConfig';

// Live count of signups awaiting approval (users/{uid} with status 'pending'
// or no status yet), so the Navbar can badge the Admin tab. Only super admins
// can act on these, so the listener is skipped entirely for everyone else.
export function usePendingUsersCount(role) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!db || !isSuperAdminRole(role)) {
      // Reset asynchronously (not directly in the effect body) in case a
      // role change mid-session drops super-admin access.
      const id = setTimeout(() => setCount(0), 0);
      return () => clearTimeout(id);
    }
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() || {};
      const pending = Object.values(users).filter(u => u.status === 'pending' || !u.status);
      setCount(pending.length);
    });
    return () => unsubscribe();
  }, [role]);

  return count;
}
