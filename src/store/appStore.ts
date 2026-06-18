import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  // Whether the device can currently reach Supabase. Detected by a lightweight
  // health probe (services/connectivity) — drives the offline banner and the
  // read-cache / write-outbox fallbacks.
  isOnline: boolean;
  // Number of buys/sales queued locally while offline, awaiting replay.
  pendingOutbox: number;
}

const initialState: AppState = {
  isSyncing: false,
  lastSyncedAt: null,
  isOnline: true,
  pendingOutbox: 0,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setLastSynced(state, action: PayloadAction<number>) {
      state.lastSyncedAt = action.payload;
    },
    setOnline(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setPendingOutbox(state, action: PayloadAction<number>) {
      state.pendingOutbox = action.payload;
    },
  },
});

export const { setSyncing, setLastSynced, setOnline, setPendingOutbox } =
  appSlice.actions;
export default appSlice.reducer;
