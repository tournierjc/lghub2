import { useMemo, useState } from 'react';
import type { Device, DpiConfig, DpiLevel } from '../../../shared/device-types';
import { getDpiLevelColor, getSupportedDpiValues, normalizeDpiConfig } from '../../../shared/profile-utils';

interface Props {
  device: Device;
  onDpiChange: (dpi: number) => void;
  onDpiConfigChange: (dpi: DpiConfig) => void;
}

type DragSource = 'supported' | 'cycle';

export function DpiEditor({ device, onDpiChange, onDpiConfigChange }: Props) {
  const dpiConfig = device.activeProfile.dpi;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggedValue, setDraggedValue] = useState<number | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);

  if (!dpiConfig) {
    return <div className="dpi-editor dpi-editor--unsupported">DPI not supported on this device.</div>;
  }

  const supportedValues = useMemo(() => getSupportedDpiValues(dpiConfig), [dpiConfig]);
  const cycleValues = dpiConfig.levels.map((level) => level.dpi);
  const availableSupportedValues = supportedValues.filter((value) => !cycleValues.includes(value));

  const handleLevelClick = (level: DpiLevel, _index: number) => {
    onDpiChange(level.dpi);
  };

  const handleEditStart = (index: number, currentDpi: number) => {
    setEditingIndex(index);
    setEditValue(String(currentDpi));
  };

  const handleEditConfirm = () => {
    if (editingIndex === null) return;
    const dpi = parseInt(editValue, 10);
    if (!Number.isNaN(dpi) && dpi >= 100 && dpi <= 25600) {
      const currentLevel = dpiConfig.levels[editingIndex];
      const nextLevels = dpiConfig.levels.map((level, index) => (
        index === editingIndex ? { ...level, dpi } : level
      ));
      onDpiConfigChange(normalizeDpiConfig({
        ...dpiConfig,
        levels: nextLevels,
        defaultDpi: currentLevel?.dpi === dpiConfig.defaultDpi ? dpi : dpiConfig.defaultDpi,
      }, currentLevel?.isActive ? dpi : dpiConfig.levels[dpiConfig.activeLevelIndex]?.dpi));
    }
    setEditingIndex(null);
  };

  const handleDragStart = (value: number, source: DragSource) => {
    setDraggedValue(value);
    setDragSource(source);
  };

  const clearDrag = () => {
    setDraggedValue(null);
    setDragSource(null);
  };

  const commitCycle = (nextLevels: DpiLevel[], preferredActiveDpi?: number) => {
    onDpiConfigChange(normalizeDpiConfig({
      ...dpiConfig,
      levels: nextLevels,
      defaultDpi: nextLevels.some((level) => level.dpi === dpiConfig.defaultDpi)
        ? dpiConfig.defaultDpi
        : nextLevels[0]?.dpi ?? dpiConfig.defaultDpi,
    }, preferredActiveDpi));
  };

  const insertValue = (targetIndex: number, value: number) => {
    if (dpiConfig.levels.some((level) => level.dpi === value)) return;
    const nextLevels = [...dpiConfig.levels];
    nextLevels.splice(targetIndex, 0, { dpi: value, color: getDpiLevelColor(targetIndex), isActive: false });
    commitCycle(nextLevels, dpiConfig.levels[dpiConfig.activeLevelIndex]?.dpi);
  };

  const reorderValue = (fromIndex: number, targetIndex: number) => {
    if (fromIndex === targetIndex) return;
    const nextLevels = [...dpiConfig.levels];
    const [moved] = nextLevels.splice(fromIndex, 1);
    const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextLevels.splice(insertIndex, 0, moved);
    commitCycle(nextLevels, dpiConfig.levels[dpiConfig.activeLevelIndex]?.dpi);
  };

  const removeValue = (index: number) => {
    if (dpiConfig.levels.length <= 1) return;
    const nextLevels = dpiConfig.levels.filter((_, levelIndex) => levelIndex !== index);
    commitCycle(nextLevels, dpiConfig.levels[index]?.isActive ? nextLevels[0]?.dpi : dpiConfig.levels[dpiConfig.activeLevelIndex]?.dpi);
  };

  const handleDropOnCycle = (targetIndex: number) => {
    if (draggedValue === null || dragSource === null) return;
    if (dragSource === 'supported') {
      insertValue(targetIndex, draggedValue);
    } else {
      const fromIndex = dpiConfig.levels.findIndex((level) => level.dpi === draggedValue);
      if (fromIndex >= 0) reorderValue(fromIndex, targetIndex);
    }
    clearDrag();
  };

  return (
    <div className="dpi-editor">
      <h3 className="dpi-editor__title">DPI Levels</h3>
      <ul
        className="dpi-editor__levels"
        aria-label="DPI cycle list"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnCycle(dpiConfig.levels.length)}
      >
        {dpiConfig.levels.map((level, index) => (
          <li key={`${level.dpi}-${index}`} className="dpi-editor__level-item">
            <div
              className={`dpi-editor__level ${level.isActive ? 'dpi-editor__level--active' : ''}`}
              draggable
              onDragStart={() => handleDragStart(level.dpi, 'cycle')}
              onDragEnd={clearDrag}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnCycle(index)}
            >
              <div
                className="dpi-editor__level-indicator"
                style={{ backgroundColor: `rgb(${level.color.r}, ${level.color.g}, ${level.color.b})` }}
              />
              <div className="dpi-editor__level-info">
                {editingIndex === index ? (
                  <input
                    className="dpi-editor__level-input"
                    type="number"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleEditConfirm}
                    onKeyDown={(e) => e.key === 'Enter' && handleEditConfirm()}
                    min={100}
                    max={25600}
                    step={50}
                  />
                ) : (
                  <button
                    type="button"
                    className="dpi-editor__level-value"
                    onClick={() => handleLevelClick(level, index)}
                    onDoubleClick={() => handleEditStart(index, level.dpi)}
                  >
                    {level.dpi}
                  </button>
                )}
                <span className="dpi-editor__level-label">DPI</span>
              </div>
              <button
                type="button"
                className="dpi-editor__preset"
                onClick={() => removeValue(index)}
                disabled={dpiConfig.levels.length <= 1}
              >
                ×
              </button>
              <div
                className="dpi-editor__level-bar"
                style={{
                  width: `${(level.dpi / 25600) * 100}%`,
                  backgroundColor: `rgb(${level.color.r}, ${level.color.g}, ${level.color.b})`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <h3 className="dpi-editor__title">Supported Values</h3>
      <div className="dpi-editor__quick-actions">
        {availableSupportedValues.map((value, index) => {
          const color = getDpiLevelColor(index + dpiConfig.levels.length);
          return (
            <button
              type="button"
              key={value}
              className="dpi-editor__preset"
              draggable
              onDragStart={() => handleDragStart(value, 'supported')}
              onDragEnd={clearDrag}
              onClick={() => insertValue(dpiConfig.levels.length, value)}
              style={{ borderColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
            >
              {value}
            </button>
          );
        })}
      </div>
      {supportedValues.length === 0 && (
        <div className="dpi-editor__empty-state">No vendor-supported DPI values were detected for drag and drop.</div>
      )}
    </div>
  );
}
