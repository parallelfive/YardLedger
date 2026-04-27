import { supabase } from '../config/supabase';
import type { UserRole } from '../types';

export async function fetchCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_id', user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ isAdmin: boolean; userId: string | null }> {
  // Sign in with the admin's credentials
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    return { isAdmin: false, userId: null };
  }

  // Check role in users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('supabase_id', authData.user.id)
    .single();

  if (userError || (userData?.role !== 'admin' && userData?.role !== 'owner')) {
    return { isAdmin: false, userId: null };
  }

  return { isAdmin: true, userId: userData.id };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function approveUser(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', userId);
  if (error) throw error;
}

export async function deactivateUser(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', userId);
  if (error) throw error;
}

export async function promoteToAdmin(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .eq('id', userId);
  if (error) throw error;
}
