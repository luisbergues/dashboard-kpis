// Super admin access is granted by this exact `role` value on users/{uid}.
// It is intentionally NOT part of the ROLES list in AdminUsersView or the signup
// dropdown in LoginView, so nobody can grant themselves (or anyone else) super
// admin access through the app UI — it can only be set by editing the database
// directly from the Firebase Console.
export const SUPER_ADMIN_ROLE = 'engineer-admin';

export const isSuperAdminRole = (role) => role === SUPER_ADMIN_ROLE;
