import React, { useEffect, useRef, useState } from 'react';

const MARKETPLACE_URL = 'https://marketplace.logi.com/plugins';

export function MarketplacePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [preloadPath, setPreloadPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    window.electron.getMarketplacePreloadPath().then(setPreloadPath);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !preloadPath) return;

    const webview = document.createElement('webview') as Electron.WebviewTag;
    webview.setAttribute('src', MARKETPLACE_URL);
    webview.setAttribute('preload', `file://${preloadPath}`);
    webview.setAttribute('partition', 'persist:marketplace');
    webview.setAttribute('allowpopups', '');
    webview.className = 'marketplace-page__webview';
    webviewRef.current = webview;

    const onDidStartLoading = () => {
      setLoading(true);
      setError('');
    };
    const onDidStopLoading = () => {
      setLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const onDidFailLoad = (e: Event & { errorDescription?: string; errorCode?: number }) => {
      if (e.errorCode === -3) return;
      setLoading(false);
      setError(e.errorDescription || 'Failed to load marketplace');
    };
    const onNavigate = () => {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    webview.addEventListener('did-start-loading', onDidStartLoading);
    webview.addEventListener('did-stop-loading', onDidStopLoading);
    webview.addEventListener('did-fail-load', onDidFailLoad as EventListener);
    webview.addEventListener('did-navigate', onNavigate);
    webview.addEventListener('did-navigate-in-page', onNavigate);

    containerRef.current.appendChild(webview);

    return () => {
      webview.removeEventListener('did-start-loading', onDidStartLoading);
      webview.removeEventListener('did-stop-loading', onDidStopLoading);
      webview.removeEventListener('did-fail-load', onDidFailLoad as EventListener);
      webview.removeEventListener('did-navigate', onNavigate);
      webview.removeEventListener('did-navigate-in-page', onNavigate);
      if (containerRef.current?.contains(webview)) {
        containerRef.current.removeChild(webview);
      }
      webviewRef.current = null;
    };
  }, [preloadPath]);

  const goBack = () => webviewRef.current?.goBack();
  const goForward = () => webviewRef.current?.goForward();
  const reload = () => webviewRef.current?.reload();
  const goHome = () => webviewRef.current?.loadURL(MARKETPLACE_URL);

  return (
    <div className="marketplace-page">
      <div className="marketplace-page__nav">
        <button className="marketplace-page__nav-btn" onClick={goBack} disabled={!canGoBack}>&#8592;</button>
        <button className="marketplace-page__nav-btn" onClick={goForward} disabled={!canGoForward}>&#8594;</button>
        <button className="marketplace-page__nav-btn" onClick={reload}>&#8635;</button>
        <button className="marketplace-page__nav-btn marketplace-page__nav-btn--home" onClick={goHome}>&#8962;</button>
      </div>
      {loading && (
        <div className="marketplace-page__loading">
          <div className="marketplace-page__spinner" />
          <span>Loading Marketplace…</span>
        </div>
      )}
      {error && (
        <div className="marketplace-page__error">
          <p className="marketplace-page__error-text">{error}</p>
          <button className="marketplace-page__retry-btn" onClick={reload}>Retry</button>
          <button className="marketplace-page__retry-btn" onClick={() => window.electron.openExternal(MARKETPLACE_URL)}>
            Open in Browser
          </button>
        </div>
      )}
      <div ref={containerRef} className="marketplace-page__container" />
    </div>
  );
}
