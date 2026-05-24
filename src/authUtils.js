import { supabase } from './supabase';

/**
 * Handle JWT expired / 401 auth errors consistently across all pages.
 * Call this from every catch block that handles Supabase API errors.
 * 
 * @param {Error|Object} error - The error object from a Supabase call or fetch
 * @returns {boolean} - true if the error was an auth error and was handled
 */
export async function handleAuthError(error) {
  if (!error) return false;

  const msg = (error?.message || String(error)).toLowerCase();
  const isJwtExpired =
    msg.includes('jwt expired') ||
    msg.includes('jwt_expired') ||
    (error?.status === 401) ||
    (error?.code === 401);

  if (!isJwtExpired) return false;

  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort sign out
  }

  window.location.replace('/login');
  return true;
}
