import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { Company, UserProfile } from '../types';
import type { PinIdentity } from '../services/pin';
import { validateInviteCode } from '../services/inviteCodes';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  // The staff member attributed for the current shift. The device holds the
  // Supabase session (company scope); this is whoever last signed in / PIN'd in.
  // Null = the terminal is locked → show the passcode pad.
  activeIdentity: PinIdentity | null;
  // How the identity was set. Auto-lock only engages once someone has PIN'd in,
  // so a freshly email-signed-in user (no PIN yet) is never locked out.
  activeIdentitySource: 'session' | 'pin' | null;
  // Admin-elevation window (epoch ms) opened by a verified admin/owner PIN.
  // Privileged DB writes are gated on has_admin_elevation() server-side; this is
  // the client cache so we don't re-prompt within the window. isOwner tracks
  // whether the window is owner-grade.
  elevationExpiresAt: number | null;
  elevationIsOwner: boolean;
  loading: boolean;
  error: string | null;
  // True when there's a session but the profile row couldn't be fetched (a real
  // error, not "no row"). Lets the UI show "couldn't load your account, retry"
  // instead of misrouting an approved user to Pending Approval.
  profileLoadFailed: boolean;
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  company: null,
  activeIdentity: null,
  activeIdentitySource: null,
  elevationExpiresAt: null,
  elevationIsOwner: false,
  loading: true,
  error: null,
  profileLoadFailed: false,
};

const identityFromProfile = (
  profile: UserProfile | null
): PinIdentity | null =>
  profile
    ? { user_id: profile.id, name: profile.name, role: profile.role }
    : null;

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
  // A real fetch error (not PGRST116 = "no row") means the profile couldn't be
  // loaded — distinct from a genuinely-unapproved user with no row, so the UI
  // can offer "retry" instead of stranding an approved user on Pending Approval.
  let profileLoadFailed = false;
  if (session?.user) {
    const { data, error } = await supabase
      .from('users')
      .select('*, companies(id, name, prefix)')
      .eq('supabase_id', session.user.id)
      .single();

    if (data) {
      ({ profile, company } = mapProfileAndCompany(data));
    } else if (error && error.code !== 'PGRST116') {
      profileLoadFailed = true;
    }
  }

  return { session, profile, company, profileLoadFailed };
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
    let profileLoadFailed = false;
    if (data.user) {
      const { data: row, error: rowError } = await supabase
        .from('users')
        .select('*, companies(id, name, prefix)')
        .eq('supabase_id', data.user.id)
        .single();

      if (row) {
        ({ profile, company } = mapProfileAndCompany(row));
      } else if (rowError && rowError.code !== 'PGRST116') {
        profileLoadFailed = true;
      }
    }

    return { session: data.session, profile, company, profileLoadFailed };
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
    // Pre-check the invite so a bad/used code shows a clear message instead of
    // the opaque "Database error saving new user" the auth path returns when
    // handle_new_user rejects it. The trigger stays the authoritative gate.
    const status = await validateInviteCode(inviteCode);
    if (status === 'used') {
      throw new Error(
        'That invite code has already been used. Ask an owner or admin for a new one.'
      );
    }
    if (status !== 'valid') {
      throw new Error('Invalid invite code — double-check it and try again.');
    }

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
    // A staff member PIN'd in — attribute the shift to them (enables auto-lock).
    // Switching identity must drop any admin elevation so it can't be inherited
    // by whoever takes over the terminal (the server window is cleared too via
    // AdminElevationProvider's identity-change effect).
    setActiveIdentity(state, action: PayloadAction<PinIdentity>) {
      state.activeIdentity = action.payload;
      state.activeIdentitySource = 'pin';
      state.elevationExpiresAt = null;
      state.elevationIsOwner = false;
    },
    // Lock the terminal back to the passcode pad (manual or auto-lock idle).
    lockTerminal(state) {
      state.activeIdentity = null;
      state.activeIdentitySource = null;
      // A locked terminal must drop any admin elevation.
      state.elevationExpiresAt = null;
      state.elevationIsOwner = false;
    },
    // An admin/owner proved their PIN — cache the elevation window.
    setElevation(
      state,
      action: PayloadAction<{ expiresAt: number; isOwner: boolean }>
    ) {
      state.elevationExpiresAt = action.payload.expiresAt;
      state.elevationIsOwner = action.payload.isOwner;
    },
    clearElevation(state) {
      state.elevationExpiresAt = null;
      state.elevationIsOwner = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.session?.user ?? null;
        state.profile = action.payload.profile;
        state.company = action.payload.company;
        state.activeIdentity = identityFromProfile(action.payload.profile);
        state.activeIdentitySource = state.activeIdentity ? 'session' : null;
        state.profileLoadFailed = action.payload.profileLoadFailed;
        state.loading = false;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profile = action.payload.profile;
        state.company = action.payload.company;
        state.profileLoadFailed = false;
        if (!state.activeIdentity) {
          state.activeIdentity = identityFromProfile(action.payload.profile);
          state.activeIdentitySource = state.activeIdentity ? 'session' : null;
        }
      })
      .addCase(signIn.pending, (state) => {
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.session?.user ?? null;
        state.profile = action.payload.profile;
        state.company = action.payload.company;
        state.activeIdentity = identityFromProfile(action.payload.profile);
        state.activeIdentitySource = state.activeIdentity ? 'session' : null;
        state.profileLoadFailed = action.payload.profileLoadFailed;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.error = action.error.message ?? 'Sign in failed';
      })
      .addCase(signOut.fulfilled, (state) => {
        clearAuthState(state);
      })
      .addCase(signOut.rejected, (state, action) => {
        // A local sign-out shouldn't require network. If the remote call failed
        // (offline / flaky), still clear local session state so the terminal
        // isn't stuck signed-in with a dead button, and surface what happened.
        clearAuthState(state);
        state.error =
          action.error.message ??
          'Signed out on this device; the server sign-out did not complete.';
      });
  },
});

// Clear all per-session auth state — used by both sign-out outcomes so an
// offline sign-out still logs the operator out locally.
function clearAuthState(state: AuthState) {
  state.session = null;
  state.user = null;
  state.profile = null;
  state.company = null;
  state.activeIdentity = null;
  state.activeIdentitySource = null;
  state.elevationExpiresAt = null;
  state.elevationIsOwner = false;
}

export const {
  setSession,
  clearError,
  setActiveIdentity,
  lockTerminal,
  setElevation,
  clearElevation,
} = authSlice.actions;
export default authSlice.reducer;
