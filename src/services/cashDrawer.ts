import { supabase } from '../config/supabase';

export interface CurrentDrawer {
  id: string;
  opened_at: string;
  opening_float: number;
  cash_paid_out: number;
  expected_cash: number;
}

export interface DrawerSession {
  id: string;
  opened_at: string;
  opened_by: string | null;
  opening_float: number;
  closed_at: string | null;
  closed_by: string | null;
  cash_paid_out: number | null;
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
  note: string;
}

const num = (v: unknown): number => Number(v ?? 0);

// The open drawer with live (uncommitted) cash-paid-out + expected, or null.
export async function fetchCurrentDrawer(): Promise<CurrentDrawer | null> {
  const { data, error } = await supabase.rpc('current_cash_drawer');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    opened_at: String(row.opened_at),
    opening_float: num(row.opening_float),
    cash_paid_out: num(row.cash_paid_out),
    expected_cash: num(row.expected_cash),
  };
}

export async function openCashDrawer(
  openingFloat: number,
  workerId: string
): Promise<DrawerSession> {
  const { data, error } = await supabase.rpc('open_cash_drawer', {
    p_opening_float: openingFloat,
    p_worker_id: workerId,
  });
  if (error) throw error;
  return data as DrawerSession;
}

export async function closeCashDrawer(
  sessionId: string,
  countedCash: number,
  workerId: string,
  note = ''
): Promise<DrawerSession> {
  const { data, error } = await supabase.rpc('close_cash_drawer', {
    p_session_id: sessionId,
    p_counted_cash: countedCash,
    p_worker_id: workerId,
    p_note: note,
  });
  if (error) throw error;
  return data as DrawerSession;
}

export async function fetchDrawerHistory(limit = 30): Promise<DrawerSession[]> {
  const { data, error } = await supabase
    .from('cash_drawer_sessions')
    .select('*')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DrawerSession[];
}
