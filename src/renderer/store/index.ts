import { configureStore } from '@reduxjs/toolkit';
import devicesReducer from './slices/devices-slice';
import appReducer from './slices/app-slice';

export const store = configureStore({
  reducer: {
    devices: devicesReducer,
    app: appReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
