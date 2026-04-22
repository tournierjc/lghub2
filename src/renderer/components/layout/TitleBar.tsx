import React from 'react';

export function TitleBar() {
  const handleMinimize = () => window.electron.minimize();
  const handleMaximize = () => window.electron.maximize();
  const handleClose = () => window.electron.close();

  return (
    <div className="titlebar">
      <div className="titlebar__drag-region">
        <span className="titlebar__title">LGHUB2</span>
      </div>
      <div className="titlebar__controls">
        <button className="titlebar__btn titlebar__btn--minimize" onClick={handleMinimize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor"/></svg>
        </button>
        <button className="titlebar__btn titlebar__btn--maximize" onClick={handleMaximize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
        <button className="titlebar__btn titlebar__btn--close" onClick={handleClose}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
    </div>
  );
}
