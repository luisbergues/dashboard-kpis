import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldOff } from 'lucide-react';
import { db, ref, onValue, update } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import { isSuperAdminRole } from '../utils/adminConfig';
import OrphanedProjectsPanel from '../components/OrphanedProjectsPanel';

const ROLES = ['engineer', 'engineer_nester', 'administrative', 'designer'];

export default function AdminUsersView({ userProfile, data }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState({});
  const [pendingRoleChoice, setPendingRoleChoice] = useState({});

  useEffect(() => {
    if (!db || !isSuperAdminRole(userProfile?.role)) return;
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      setUsers(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [userProfile?.role]);

  const roleLabel = (role) => {
    switch (role) {
      case 'administrative': return t('admin.roleAdministrative');
      case 'engineer_nester': return t('admin.roleEngineerNester');
      case 'designer': return t('admin.roleDesigner');
      default: return t('admin.roleEngineer');
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'approved': return t('admin.statusApproved');
      case 'rejected': return t('admin.statusRejected');
      default: return t('admin.statusPending');
    }
  };

  const handleApprove = async (uid, requestedRole) => {
    const role = pendingRoleChoice[uid] || requestedRole || 'engineer';
    await update(ref(db, `users/${uid}`), { role, status: 'approved' });
  };

  const handleRevoke = async (uid) => {
    if (!window.confirm(t('admin.revokeConfirm'))) return;
    await update(ref(db, `users/${uid}`), { status: 'rejected' });
  };

  const handleRoleChange = async (uid, role) => {
    await update(ref(db, `users/${uid}`), { role });
  };

  if (!isSuperAdminRole(userProfile?.role)) return null;

  const entries = Object.entries(users);
  const pending = entries.filter(([, u]) => u.status === 'pending' || !u.status);
  const others = entries.filter(([, u]) => u.status === 'approved' || u.status === 'rejected');

  return (
    <div className="admin-users-view animate-fade-in">
      <header className="view-header">
        <h1 className="page-title">{t('admin.title')}</h1>
        <p className="text-muted">{t('admin.subtitle')}</p>
      </header>

      <div className="table-container glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ padding: '16px 16px 0' }}>{t('admin.pendingSection')}</h3>
        {pending.length === 0 ? (
          <p className="text-muted" style={{ padding: '16px' }}>{t('admin.noPending')}</p>
        ) : (
          <table className="materials-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th>
                <th>{t('admin.email')}</th>
                <th>{t('admin.requestedRole')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map(([uid, u]) => (
                <tr key={uid}>
                  <td>{u.designerName || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="form-input form-select"
                      value={pendingRoleChoice[uid] || u.requestedRole || 'engineer'}
                      onChange={(e) => setPendingRoleChoice(prev => ({ ...prev, [uid]: e.target.value }))}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn-sm btn-primary" onClick={() => handleApprove(uid, u.requestedRole)}>
                      <CheckCircle2 size={14} /> {t('admin.approve')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="table-container glass-card">
        <h3 style={{ padding: '16px 16px 0' }}>{t('admin.activeSection')}</h3>
        <table className="materials-table">
          <thead>
            <tr>
              <th>{t('admin.name')}</th>
              <th>{t('admin.email')}</th>
              <th>{t('admin.role')}</th>
              <th>{t('admin.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {others.map(([uid, u]) => (
              <tr key={uid}>
                <td>{u.designerName || '—'}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="form-input form-select"
                    value={u.role || 'engineer'}
                    onChange={(e) => handleRoleChange(uid, e.target.value)}
                    disabled={u.status === 'rejected'}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </td>
                <td>{statusLabel(u.status)}</td>
                <td>
                  {u.status !== 'rejected' && (
                    <button className="btn-sm btn-secondary" onClick={() => handleRevoke(uid)}>
                      <ShieldOff size={14} /> {t('admin.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OrphanedProjectsPanel data={data} />
    </div>
  );
}
