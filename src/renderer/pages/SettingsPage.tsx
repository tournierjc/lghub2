import React, { useEffect, useState } from 'react';

interface OsInfo {
  platform: string;
  arch: string;
  version: string;
  hostname: string;
}

export function SettingsPage() {
  const [osInfo, setOsInfo] = useState<OsInfo | null>(null);

  useEffect(() => {
    window.electron.getOsInfo().then(setOsInfo);
  }, []);

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">Settings</h1>

      <section className="settings-page__section">
        <h2>General</h2>
        <div className="settings-page__option">
          <label>Start on system boot</label>
          <input type="checkbox" />
        </div>
        <div className="settings-page__option">
          <label>Minimize to tray on close</label>
          <input type="checkbox" defaultChecked />
        </div>
      </section>

      <section className="settings-page__section">
        <h2>About</h2>
        <div className="settings-page__info">
          <p>LGHUB2 v0.1.0</p>
          {osInfo && (
            <p>
              {osInfo.platform} {osInfo.arch} — {osInfo.version}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
