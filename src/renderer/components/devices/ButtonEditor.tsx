import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Device, ButtonAssignment, DeviceProfile } from '../../../shared/device-types';
import { getButtonDefsForDevice, ButtonDef, TASK_LABELS } from '../../../shared/device-buttons';

interface Props {
  device: Device;
  activeProfile: DeviceProfile;
  onApply: (assignments: Record<string, ButtonAssignment>) => void;
}

type ActionTab = 'mouse' | 'keyboard' | 'dpi' | 'media' | 'disabled';

interface KeyCapture {
  key: string;
  code: string;
  modifiers: string[];
}

const MOUSE_ACTIONS = [
  { taskId: 0x0050, label: 'Left Click' },
  { taskId: 0x0051, label: 'Right Click' },
  { taskId: 0x0052, label: 'Middle Click' },
  { taskId: 0x00c3, label: 'Back' },
  { taskId: 0x00c4, label: 'Forward' },
  { taskId: 0x00b5, label: 'Scroll Up' },
  { taskId: 0x00b6, label: 'Scroll Down' },
];

const DPI_ACTIONS = [
  { taskId: 0x00d7, label: 'DPI Up' },
  { taskId: 0x00d8, label: 'DPI Down' },
  { taskId: 0x00c2, label: 'DPI Cycle' },
  { taskId: 0x00d6, label: 'DPI Shift' },
  { taskId: 0x00d9, label: 'G-Shift' },
];

const MEDIA_ACTIONS = [
  { taskId: 0x00e0, label: 'Play / Pause' },
  { taskId: 0x00e1, label: 'Stop' },
  { taskId: 0x00e2, label: 'Previous Track' },
  { taskId: 0x00e3, label: 'Next Track' },
  { taskId: 0x00e4, label: 'Mute' },
  { taskId: 0x00e5, label: 'Volume Up' },
  { taskId: 0x00e6, label: 'Volume Down' },
];

function assignmentLabel(assignment: ButtonAssignment | undefined, def: ButtonDef, activeProfile: DeviceProfile): string {
  if (!assignment) return TASK_LABELS[def.defaultTaskId] || def.name;
  const a = assignment.action;
  if (a.type === 'disabled') return 'Disabled';
  if (a.type === 'key') {
    const { key, modifiers } = (a.value as unknown) as { key: string; modifiers: string[] };
    const mods = modifiers.length > 0 ? modifiers.join('+') + '+' : '';
    return mods + key;
  }
  if (a.type === 'media' || a.type === 'dpi' || a.type === 'system') {
    if (a.type === 'dpi' && a.value === 0x00d6) return 'DPI Shift';
    return TASK_LABELS[a.value as number] || String(a.value);
  }
  return String(a.value);
}

function buildAssignmentsFromDefs(defs: ButtonDef[], existing: Record<string, ButtonAssignment> | undefined): Record<string, ButtonAssignment> {
  const result: Record<string, ButtonAssignment> = {};
  for (const def of defs) {
    const hexKey = def.controlId.toString(16).padStart(4, '0');
    if (existing?.[hexKey]) {
      result[hexKey] = existing[hexKey];
    } else {
      result[hexKey] = {
        buttonId: hexKey,
        action: { type: 'system', value: def.defaultTaskId },
      };
    }
  }
  return result;
}

export function ButtonEditor({ device, activeProfile, onApply }: Props) {
  const defs = getButtonDefsForDevice(device.modelId, device.type);
  const [assignments, setAssignments] = useState<Record<string, ButtonAssignment>>(() =>
    buildAssignmentsFromDefs(defs, activeProfile.assignments)
  );
  const [selected, setSelected] = useState<ButtonDef | null>(null);
  const [tab, setTab] = useState<ActionTab>('mouse');
  const [capturing, setCapturing] = useState(false);
  const [pendingKey, setPendingKey] = useState<KeyCapture | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAssignments(buildAssignmentsFromDefs(defs, activeProfile.assignments));
    setDirty(false);
    setSelected(null);
  }, [defs, activeProfile.assignments]);

  const applyAction = useCallback((def: ButtonDef, assignment: ButtonAssignment) => {
    const hexKey = def.controlId.toString(16).padStart(4, '0');
    setAssignments((prev) => ({ ...prev, [hexKey]: assignment }));
    setSelected(null);
    setDirty(true);
  }, []);

  const handleMouseAction = (def: ButtonDef, taskId: number) => {
    applyAction(def, { buttonId: def.controlId.toString(16).padStart(4, '0'), action: { type: 'system', value: taskId } });
  };

  const handleDpiAction = (def: ButtonDef, taskId: number) => {
    applyAction(def, { buttonId: def.controlId.toString(16).padStart(4, '0'), action: { type: 'dpi', value: taskId } });
  };

  const handleMediaAction = (def: ButtonDef, taskId: number) => {
    applyAction(def, { buttonId: def.controlId.toString(16).padStart(4, '0'), action: { type: 'media', value: taskId } });
  };

  const handleDisable = (def: ButtonDef) => {
    applyAction(def, { buttonId: def.controlId.toString(16).padStart(4, '0'), action: { type: 'disabled', value: '' } });
  };

  const handleApplyKey = (def: ButtonDef) => {
    if (!pendingKey) return;
    applyAction(def, {
      buttonId: def.controlId.toString(16).padStart(4, '0'),
      action: { type: 'key', value: { key: pendingKey.key, modifiers: pendingKey.modifiers } as unknown as string },
    });
    setPendingKey(null);
    setCapturing(false);
  };

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const mods: string[] = [];
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.altKey) mods.push('Alt');
      if (e.shiftKey) mods.push('Shift');
      if (e.metaKey) mods.push('Meta');
      const key = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta' ? '' : e.key;
      if (key) setPendingKey({ key, code: e.code, modifiers: mods });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing]);

  const handleSave = () => {
    onApply(assignments);
    setDirty(false);
  };

  return (
    <div className="button-editor">
      <div className="button-editor__list">
        <div className="button-editor__list-header">
          <span>Button</span>
          <span>Action</span>
        </div>
        {defs.map((def) => {
          const hexKey = def.controlId.toString(16).padStart(4, '0');
          const assignment = assignments[hexKey];
          const isSelected = selected?.controlId === def.controlId;
          return (
            <button
              type="button"
              key={def.controlId}
              className={`button-editor__item ${isSelected ? 'button-editor__item--selected' : ''} ${!def.remappable ? 'button-editor__item--locked' : ''}`}
              onClick={() => def.remappable && setSelected(isSelected ? null : def)}
              onKeyDown={(e) => {
                if (!def.remappable) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(isSelected ? null : def);
                }
              }}
              disabled={!def.remappable}
            >
              <span className="button-editor__item-name">{def.name}</span>
              <span className="button-editor__item-action">{assignmentLabel(assignment, def, activeProfile)}</span>
              {!def.remappable && <span className="button-editor__item-lock">🔒</span>}
            </button>
          );
        })}
      </div>

      <div className="button-editor__panel">
        {selected ? (
          <>
            <div className="button-editor__panel-title">Assign: {selected.name}</div>
            <div className="button-editor__tabs">
              {(['mouse', 'keyboard', 'dpi', 'media', 'disabled'] as ActionTab[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`button-editor__tab ${tab === t ? 'button-editor__tab--active' : ''}`}
                  onClick={() => { setTab(t); setCapturing(false); setPendingKey(null); }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="button-editor__tab-content" ref={captureRef}>
              {tab === 'mouse' && (
                <div className="button-editor__action-grid">
                  {MOUSE_ACTIONS.map((a) => (
                    <button type="button" key={a.taskId} className="button-editor__action-btn" onClick={() => handleMouseAction(selected, a.taskId)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'keyboard' && (
                <div className="button-editor__key-capture">
                  {!capturing ? (
                    <button type="button" className="button-editor__capture-btn" onClick={() => { setCapturing(true); setPendingKey(null); }}>
                      Click here, then press a key
                    </button>
                  ) : (
                    <div className="button-editor__capturing">
                      <span className="button-editor__capture-hint">Listening for keypress…</span>
                      {pendingKey && (
                        <div className="button-editor__key-preview">
                          <span className="button-editor__key-label">
                            {[...pendingKey.modifiers, pendingKey.key].join(' + ')}
                          </span>
                          <div className="button-editor__key-actions">
                            <button type="button" className="button-editor__action-btn button-editor__action-btn--confirm" onClick={() => handleApplyKey(selected)}>
                              Assign
                            </button>
                            <button type="button" className="button-editor__action-btn" onClick={() => { setCapturing(false); setPendingKey(null); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'dpi' && (
                <div className="button-editor__action-grid">
                  {DPI_ACTIONS.map((a) => (
                    <button type="button" key={a.taskId} className="button-editor__action-btn" onClick={() => handleDpiAction(selected, a.taskId)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'media' && (
                <div className="button-editor__action-grid">
                  {MEDIA_ACTIONS.map((a) => (
                    <button type="button" key={a.taskId} className="button-editor__action-btn" onClick={() => handleMediaAction(selected, a.taskId)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'disabled' && (
                <div className="button-editor__action-grid">
                  <button type="button" className="button-editor__action-btn button-editor__action-btn--danger" onClick={() => handleDisable(selected)}>
                    Disable this button
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="button-editor__panel-empty">
            Select a remappable button to assign an action.
          </div>
        )}

        {dirty && (
          <div className="button-editor__apply-bar">
            <span className="button-editor__unsaved">Unsaved changes</span>
            <button type="button" className="button-editor__apply-btn" onClick={handleSave}>
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
