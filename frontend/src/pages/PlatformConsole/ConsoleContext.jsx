/**
 * ConsoleContext — Platform Console React Context
 *
 * Manages:
 *  - platformUser (the real logged-in platform_owner)
 *  - impersonationSession (in-memory only, never localStorage)
 *  - readOnly flag derived from session mode
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../api';

const ConsoleContext = createContext(null);

export function ConsoleProvider({ children }) {
  const [platformUser, setPlatformUser]         = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [authError, setAuthError]               = useState(null);
  // In-memory only — never persisted
  const [impSession, setImpSession]             = useState(null); // { session_id, token, expires_at, mode, tenant }

  useEffect(() => {
    const token = localStorage.getItem('icss_token');
    if (!token) { setLoading(false); return; }

    api.me()
      .then(({ user }) => {
        if (user.role !== 'platform_owner') {
          setAuthError('This console requires a Platform Owner account.');
          localStorage.removeItem('icss_token');
        } else {
          setPlatformUser(user);
        }
      })
      .catch(() => setAuthError('Session expired. Please log in again.'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login({ email, password });
    if (user.role !== 'platform_owner') throw new Error('This console is restricted to Platform Owners.');
    localStorage.setItem('icss_token', token);
    setPlatformUser(user);
    setAuthError(null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('icss_token');
    setPlatformUser(null);
    setImpSession(null);
  }, []);

  const startImpersonation = useCallback(async (tenantId, mode = 'read_only', reason = '') => {
    const result = await api.platform.startImpersonation(tenantId, mode, reason);
    setImpSession(result); // { session_id, token, mode, expires_at, tenant }
    return result;
  }, []);

  const endImpersonation = useCallback(async () => {
    if (!impSession) return;
    await api.platform.endImpersonation(impSession.session_id).catch(() => {});
    setImpSession(null);
  }, [impSession]);

  const elevateImpersonation = useCallback(async (reason) => {
    if (!impSession) return;
    const result = await api.platform.elevateImpersonation(impSession.session_id, reason);
    setImpSession(prev => ({ ...prev, mode: 'edit', token: result.token, expires_at: result.expires_at }));
  }, [impSession]);

  const isImpersonating = !!impSession;
  const isReadOnly      = !impSession || impSession.mode === 'read_only';

  return (
    <ConsoleContext.Provider value={{
      platformUser, loading, authError,
      login, logout,
      impSession, isImpersonating, isReadOnly,
      startImpersonation, endImpersonation, elevateImpersonation,
    }}>
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider');
  return ctx;
}
