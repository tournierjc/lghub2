import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AppPage = 'home' | 'device' | 'marketplace' | 'settings';

export interface AppState {
  currentPage: AppPage;
  sidebarCollapsed: boolean;
  backendConnected: boolean;
  theme: 'dark';
}

const initialState: AppState = {
  currentPage: 'home',
  sidebarCollapsed: false,
  backendConnected: false,
  theme: 'dark',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    navigateTo(state, action: PayloadAction<AppPage>) {
      state.currentPage = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setBackendConnected(state, action: PayloadAction<boolean>) {
      state.backendConnected = action.payload;
    },
  },
});

export const { navigateTo, toggleSidebar, setBackendConnected } = appSlice.actions;

export default appSlice.reducer;
