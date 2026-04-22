import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { useAppDispatch } from './hooks/use-store';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { HomePage } from './pages/HomePage';
import { DevicePage } from './pages/DevicePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { SettingsPage } from './pages/SettingsPage';
import { profileAutoSwitched } from './store/slices/devices-slice';

export function App() {
  const dispatch = useAppDispatch();
  const currentPage = useSelector((state: RootState) => state.app.currentPage);

  useEffect(() => {
    const unsub = window.profile.onProfileSwitched((modelId, profileId) => {
      dispatch(profileAutoSwitched({ modelId, profileId }));
    });
    return () => { unsub(); };
  }, [dispatch]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'device': return <DevicePage />;
      case 'marketplace': return <MarketplacePage />;
      case 'settings': return <SettingsPage />;
    }
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="app__content">
        <Sidebar />
        <main className="app__main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
