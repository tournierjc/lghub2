import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import {
  setDeviceDpi, setDeviceRgb, setDeviceRgbEffect, refreshBattery,
  loadProfiles, createProfile, deleteProfile, setActiveProfile,
  exportProfile, importProfile, updateProfile,
} from '../store/slices/devices-slice';
import { DpiEditor } from '../components/devices/DpiEditor';
import { LightingEditor } from '../components/devices/LightingEditor';
import { ButtonEditor } from '../components/devices/ButtonEditor';
import { EqEditor } from '../components/devices/EqEditor';
import { DeviceImage } from '../components/devices/DeviceImage';
import { LightingEffect } from '../../shared/device-types';
import type { ButtonAssignment, Device, DeviceProfile, DpiConfig, LightingConfig } from '../../shared/device-types';

type DeviceTab = 'dpi' | 'lighting' | 'assignments' | 'equalizer' | 'apps';

function getAvailableTabs(device: Device): { id: DeviceTab; label: string }[] {
  const tabs: { id: DeviceTab; label: string }[] = [];
  if (device.hasDpi) tabs.push({ id: 'dpi', label: 'DPI' });
  if (device.lightingCapability !== 'NONE') tabs.push({ id: 'lighting', label: 'Lighting' });
  tabs.push({ id: 'assignments', label: 'Assignments' });
  if (device.hasEq) tabs.push({ id: 'equalizer', label: 'Equalizer' });
  tabs.push({ id: 'apps', label: 'Applications' });
  return tabs;
}

const EFFECT_ID_MAP: Partial<Record<LightingEffect, number>> = {
  [LightingEffect.SOLID]: 0x01,
  [LightingEffect.COLOR_CYCLE]: 0x03,
  [LightingEffect.WAVE]: 0x04,
  [LightingEffect.STARLIGHT]: 0x05,
  [LightingEffect.BREATHING]: 0x0a,
  [LightingEffect.RIPPLE]: 0x0b,
};

interface AppEntry {
  id?: string;
  name: string;
  applicationId?: string;
  poster?: string;
  detectionExecutables?: string[];
}

export function DevicePage() {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((state) => state.devices.selectedDeviceId);
  const device = useAppSelector((state) =>
    state.devices.connected.find((d) => d.id === selectedId)
  );
  const profiles = useAppSelector((state) =>
    device ? state.devices.profiles[device.modelId] || [] : []
  );
  const lastSwitchedApp = useAppSelector((state) => state.devices.lastSwitchedApp);

  const [activeTab, setActiveTab] = useState<DeviceTab>('dpi');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [appSearch, setAppSearch] = useState('');
  const [appResults, setAppResults] = useState<AppEntry[]>([]);
  const [appSearching, setAppSearching] = useState(false);
  const [customBinaryName, setCustomBinaryName] = useState('');
  const [appImportStatus, setAppImportStatus] = useState<string>('');

  const tabs = device ? getAvailableTabs(device) : [];
  const activeProfile = profiles.find((p) => p.id === device?.activeProfile?.id) || device?.activeProfile;
  const assignedBinaryName = activeProfile?.executableName || activeProfile?.detectionExecutables?.[0] || '';
  const allDetectionExecutables = activeProfile?.detectionExecutables || [];

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (device?.hasBattery) {
      dispatch(refreshBattery(device.hidPath));
    }
  }, [device?.hasBattery, device?.hidPath, dispatch]);

  useEffect(() => {
    if (device) {
      dispatch(loadProfiles(device.modelId));
    }
  }, [device, dispatch]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileMenuOpen]);

  useEffect(() => {
    setCustomBinaryName(activeProfile?.executableName || '');
  }, [activeProfile?.executableName]);

  const handleDpiChange = useCallback((dpi: number) => {
    if (!device) return;
    dispatch(setDeviceDpi({ hidPath: device.hidPath, dpi }));
  }, [device, dispatch]);

  const handleDpiConfigChange = useCallback((dpi: DpiConfig) => {
    if (!device || !activeProfile?.dpi) return;

    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: { dpi },
    }));
    const activeLevel = dpi.levels[dpi.activeLevelIndex] ?? dpi.levels.find((level) => level.isActive) ?? dpi.levels[0];
    if (activeLevel) {
      dispatch(setDeviceDpi({ hidPath: device.hidPath, dpi: activeLevel.dpi }));
    }
  }, [device, activeProfile, dispatch]);

  const handleLightingChange = useCallback((config: LightingConfig) => {
    if (!device || !activeProfile) return;
    const zoneIds = config.zones && config.zones.length > 0 ? config.zones : ['zone-0'];
    const nextLighting = [...(activeProfile.lighting || [])];

    zoneIds.forEach((zoneId) => {
      const zoneIndex = device.lightingZones?.findIndex((zone) => zone.id === zoneId) ?? 0;
      const targetZoneIndex = zoneIndex >= 0 ? zoneIndex : 0;
      nextLighting[targetZoneIndex] = {
        ...config,
        zones: [zoneId],
      };

      if (config.effect === LightingEffect.SOLID) {
        const c = config.colors[0] || { r: 0, g: 212, b: 255 };
        dispatch(setDeviceRgb({ hidPath: device.hidPath, zoneIndex: targetZoneIndex, r: c.r, g: c.g, b: c.b }));
      } else {
        const c = config.colors[0] || { r: 0, g: 212, b: 255 };
        const effectId = EFFECT_ID_MAP[config.effect] ?? EFFECT_ID_MAP[LightingEffect.SOLID] ?? 0x01;
        dispatch(setDeviceRgbEffect({
          hidPath: device.hidPath,
          zoneIndex: targetZoneIndex,
          effectId,
          r: c.r, g: c.g, b: c.b,
          speed: config.speed,
          brightness: config.brightness,
        }));
      }
    });

    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: { lighting: nextLighting },
    }));
  }, [device, activeProfile, dispatch]);

  const handleButtonApply = useCallback(async (assignments: Record<string, ButtonAssignment>) => {
    if (!device || !activeProfile) return;
    for (const [hexKey, assignment] of Object.entries(assignments)) {
      const controlId = parseInt(hexKey, 16);
      const action = assignment.action;
      if (action.type === 'system' || action.type === 'dpi' || action.type === 'media') {
        await window.device.remapButton(device.hidPath, controlId, action.value as number);
      } else if (action.type === 'disabled') {
        await window.device.remapButton(device.hidPath, controlId, 0);
      }
    }
    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: { assignments },
    }));
  }, [device, activeProfile, dispatch]);

  const handleEqChange = useCallback((_bands: number[]) => {}, []);

  const handleProfileSwitch = useCallback((profileId: string) => {
    if (!device) return;
    dispatch(setActiveProfile({ modelId: device.modelId, profileId }));
    setProfileMenuOpen(false);
  }, [device, dispatch]);

  const handleCreateProfile = useCallback(() => {
    if (!device || !createName.trim()) return;
    dispatch(createProfile({ modelId: device.modelId, name: createName.trim(), baseProfile: activeProfile as DeviceProfile }));
    setCreateName('');
    setCreating(false);
  }, [device, createName, activeProfile, dispatch]);

  const handleRenameProfile = useCallback((profileId: string) => {
    if (!device || !renameValue.trim()) return;
    dispatch(updateProfile({ modelId: device.modelId, profileId, updates: { name: renameValue.trim() } }));
    setRenaming(null);
    setRenameValue('');
  }, [device, renameValue, dispatch]);

  const handleDeleteProfile = useCallback((profileId: string) => {
    if (!device) return;
    dispatch(deleteProfile({ modelId: device.modelId, profileId }));
  }, [device, dispatch]);

  const handleExportProfile = useCallback((profileId: string) => {
    if (!device) return;
    dispatch(exportProfile({ modelId: device.modelId, profileId }));
  }, [device, dispatch]);

  const handleImportProfile = useCallback(() => {
    if (!device) return;
    dispatch(importProfile(device.modelId));
  }, [device, dispatch]);

  const handleAppSearch = useCallback(async (query: string) => {
    setAppSearch(query);
    if (query.length < 2) { setAppResults([]); return; }
    setAppSearching(true);
    const results = await window.appData.search(query);
    setAppResults(results);
    setAppSearching(false);
  }, []);

  const handleImportAppCatalog = useCallback(async () => {
    setAppImportStatus('');
    const result = await window.electron.openDialog({
      title: 'Select G HUB data folder (contains applications.json)',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return;

    setAppImportStatus('Importing…');
    const folderPath = result.filePaths[0];
    const importResult = await window.appData.importFromFolder(folderPath);
    if (!importResult.ok) {
      setAppImportStatus(importResult.error || 'Import failed');
      return;
    }
    setAppImportStatus(`Imported ${importResult.importedCount ?? 0} applications`);
  }, []);

  const handleAssignApp = useCallback((app: AppEntry) => {
    if (!device || !activeProfile) return;

    const applicationPath = app.applicationId || app.id || app.name;
    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: {
        applicationPath,
        applicationName: app.name,
        executableName: '',
        detectionExecutables: app.detectionExecutables || [],
      },
    }));
    setAppSearch('');
    setAppResults([]);
    setCustomBinaryName('');
  }, [device, activeProfile, dispatch]);

  const handleAssignBinary = useCallback(() => {
    const executableName = customBinaryName.trim();
    if (!device || !activeProfile || !executableName) return;

    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: {
        applicationPath: activeProfile.applicationPath || executableName,
        applicationName: activeProfile.applicationName || executableName,
        executableName,
      },
    }));
    setCustomBinaryName(executableName);
  }, [device, activeProfile, customBinaryName, dispatch]);

  const handleUnassignApp = useCallback(() => {
    if (!device || !activeProfile) return;
    dispatch(updateProfile({
      modelId: device.modelId,
      profileId: activeProfile.id,
      updates: { applicationPath: '', applicationName: '', executableName: '', detectionExecutables: [] },
    }));
    setCustomBinaryName('');
  }, [device, activeProfile, dispatch]);

  if (!device) {
    return (
      <div className="device-page device-page--empty">
        <p>Select a device from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="device-page">
      <header className="device-page__header">
        <DeviceImage modelId={device.modelId} deviceType={device.type} className="device-page__image" />
        <div className="device-page__header-info">
          <h1>{device.name}</h1>
          <div className="device-page__header-meta">
            <span className="device-page__connection">{device.connectionType}</span>
            {device.battery && (
              <span className={`device-page__battery ${device.battery.charging ? 'device-page__battery--charging' : ''}`}>
                {device.battery.percentage}%{device.battery.charging ? ' ⚡' : ''}
              </span>
            )}
            {device.firmware && (
              <span className="device-page__firmware">FW {device.firmware}</span>
            )}
          </div>
        </div>
      </header>

      <div className="profile-bar">
        <div className="profile-bar__selector" ref={profileMenuRef}>
          <button
            type="button"
            className="profile-bar__active"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            <span className="profile-bar__active-name">{activeProfile?.name || 'Default'}</span>
            <span className="profile-bar__chevron">{profileMenuOpen ? '▴' : '▾'}</span>
          </button>

          {profileMenuOpen && (
            <div className="profile-bar__dropdown">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={`profile-bar__item ${p.id === activeProfile?.id ? 'profile-bar__item--active' : ''}`}
                >
                  {renaming === p.id ? (
                    <input
                      className="profile-bar__rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameProfile(p.id);
                        if (e.key === 'Escape') { setRenaming(null); setRenameValue(''); }
                      }}
                      onBlur={() => handleRenameProfile(p.id)}
                    />
                  ) : (
                    <button type="button" className="profile-bar__item-name" onClick={() => handleProfileSwitch(p.id)}>
                      {p.name}
                    </button>
                  )}
                  <div className="profile-bar__item-actions">
                    <button
                      type="button"
                      className="profile-bar__item-btn"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); setRenaming(p.id); setRenameValue(p.name); }}
                    >✎</button>
                    <button
                      type="button"
                      className="profile-bar__item-btn"
                      title="Export"
                      onClick={(e) => { e.stopPropagation(); handleExportProfile(p.id); }}
                    >↗</button>
                    {!p.isDefault && (
                       <button
                         type="button"
                         className="profile-bar__item-btn profile-bar__item-btn--danger"
                         title="Delete"
                         onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}

              <div className="profile-bar__footer">
                {creating ? (
                  <div className="profile-bar__create-row">
                    <input
                      className="profile-bar__create-input"
                      placeholder="Profile name..."
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateProfile();
                        if (e.key === 'Escape') { setCreating(false); setCreateName(''); }
                      }}
                    />
                    <button type="button" className="profile-bar__create-confirm" onClick={handleCreateProfile}>✓</button>
                  </div>
                ) : (
                  <div className="profile-bar__actions-row">
                    <button type="button" className="profile-bar__add-btn" onClick={() => setCreating(true)}>+ New Profile</button>
                    <button type="button" className="profile-bar__import-btn" onClick={handleImportProfile}>Import</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="device-page__tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`device-page__tab ${activeTab === tab.id ? 'device-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="device-page__content">
        {activeTab === 'dpi' && (
          <DpiEditor device={device} onDpiChange={handleDpiChange} onDpiConfigChange={handleDpiConfigChange} />
        )}
        {activeTab === 'lighting' && (
          <LightingEditor device={device} onLightingChange={handleLightingChange} />
        )}
        {activeTab === 'assignments' && activeProfile && (
          <ButtonEditor
            device={device}
            activeProfile={activeProfile}
            onApply={handleButtonApply}
            selectedButtonId={selectedButtonId}
            onSelectButton={setSelectedButtonId}
          />
        )}
        {activeTab === 'equalizer' && (
          <EqEditor device={device} onEqChange={handleEqChange} />
        )}
        {activeTab === 'apps' && (
          <div className="app-profiles">
            {lastSwitchedApp && (
              <div className="app-profiles__last-switched">
                <span className="app-profiles__last-switched-label">Last detected:</span>
                <span className="app-profiles__last-switched-app">{lastSwitchedApp}</span>
              </div>
            )}
            <div className="app-profiles__current">
              <h3 className="app-profiles__label">Auto-switch for profile: {activeProfile?.name}</h3>
              {activeProfile?.applicationPath ? (
                <div className="app-profiles__assigned">
                  <div className="app-profiles__assigned-meta">
                    <span className="app-profiles__app-name">{activeProfile.applicationName || activeProfile.applicationPath}</span>
                    {allDetectionExecutables.length > 0 && (
                      <span className="app-profiles__app-name">
                        Binary{allDetectionExecutables.length > 1 ? 'ies' : ''}: {allDetectionExecutables.join(', ')}
                      </span>
                    )}
                    {assignedBinaryName && !allDetectionExecutables.includes(assignedBinaryName) && (
                      <span className="app-profiles__app-name">Custom binary: {assignedBinaryName}</span>
                    )}
                  </div>
                  <button type="button" className="app-profiles__remove-btn" onClick={handleUnassignApp}>Remove</button>
                </div>
              ) : (
                <p className="app-profiles__hint">
                  This profile will activate automatically when the linked application is in focus.
                  Search for a game or application below.
                </p>
              )}
            </div>
            <div className="app-profiles__search">
              <div className="app-profiles__catalog">
                <button type="button" className="app-profiles__result" onClick={handleImportAppCatalog}>
                  Import G HUB applications catalog…
                </button>
                {appImportStatus && <div className="app-profiles__searching">{appImportStatus}</div>}
              </div>
              <input
                className="app-profiles__search-input"
                placeholder="Search for a game or application..."
                value={appSearch}
                onChange={(e) => handleAppSearch(e.target.value)}
              />
               {appSearching && <div className="app-profiles__searching">Searching…</div>}
               {appResults.length > 0 && (
                 <div className="app-profiles__results">
                   {appResults.map((app) => (
                     <button
                       type="button"
                       key={app.applicationId || app.id || app.name}
                       className="app-profiles__result"
                       onClick={() => handleAssignApp(app)}
                     >
                       <span className="app-profiles__result-name">{app.name}</span>
                       {app.detectionExecutables && app.detectionExecutables.length > 0 && (
                         <span className="app-profiles__app-name">
                           Binary{app.detectionExecutables.length > 1 ? 'ies' : ''}: {app.detectionExecutables.join(', ')}
                         </span>
                       )}
                     </button>
                   ))}
                 </div>
               )}
               <div className="app-profiles__searching">
                 <input
                   className="app-profiles__search-input"
                   placeholder="Binary name for auto-switch (e.g. firefox, cs2)"
                   value={customBinaryName}
                   onChange={(e) => setCustomBinaryName(e.target.value)}
                 />
                  <button type="button" className="app-profiles__result" onClick={handleAssignBinary}>Save Binary Name</button>
                </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
