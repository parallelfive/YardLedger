import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { Company, UserProfile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  company: null,
  loading: true,
  error: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileAndCompany(row: any): {
  profile: UserProfile;
  company: Company | null;
} {
  const profile: UserProfile = {
    id: row.id,
    supabaseId: row.supabase_id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.is_active,
    companyId: row.company_id,
  };
  const company: Company | null = row.companies
    ? {
        id: row.companies.id,
        name: row.companies.name,
        prefix: row.companies.prefix,
      }
    : null;
  return { profile, company };
}

export const initializeAuth = createAsyncThunk('auth/initialize', async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let profile: UserProfile | null = null;
  let company: Company | null = null;
  if (session?.user) {
    const { data } = await supabase
      .from('users')
      .select('*, companies(id, name, prefix)')
      .eq('supabase_id', session.user.id)
      .single();

    if (data) {
      ({ profile, company } = mapProfileAndCompany(data));
    }
  }

  return { session, profile, company };
});

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (supabaseUserId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, companies(id, name, prefix)')
      .eq('supabase_id', supabaseUserId)
      .single();

    if (error) throw error;
    return mapProfileAndCompany(data);
  }
);

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    let profile: UserProfile | null = null;
    let company: Company | null = null;
    if (data.user) {
      const { data: row } = await supabase
        .from('users')
        .select('*, companies(id, name, prefix)')
        .eq('supabase_id', data.user.id)
        .single();

      if (row) {
        ({ profile, company } = mapProfileAndCompany(row));
      }
    }

    return { session: data.session, profile, company };
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({
    email,
    password,
    inviteCode,
  }: {
    email: string;
    password: string;
    inviteCode: string;
  }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { invite_code: inviteCode },
        emailRedirectTo: 'yardledger://auth/callback',
      },
    });
    if (error) throw error;
  }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.user = action.payload?.user ?? null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.session?.user ?? null;
        state.profile = action.payload.profile;
        state.company = action.payload.company;
        state.loading = false;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profile = action.payload.profile;
        state.company = action.payload.company;
      })
      .addCase(signIn.pending, (state) => {
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.session?.user ?? null;
        state.profile = action.payload.profile;
        state.company = action.payload.company;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.error = action.error.message ?? 'Sign in failed';
      })
      .addCase(signOut.fulfilled, (state) => {
        state.session = null;
        state.user = null;
        state.profile = null;
        state.company = null;
      });
  },
});

export const { setSession, clearError } = authSlice.actions;
export default authSlice.reducer;
