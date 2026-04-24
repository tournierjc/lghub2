import React, { useState } from 'react';
import { Device, DpiLevel, RGBColor } from '../../../shared/device-types';

interface Props {
  device: Device;
  onDpiChange: (dpi: number) => void;
  onDpiLevelChange: (levelIndex: number, dpi: number) => void;
}

export function DpiEditor({ device, onDpiChange, onDpiLevelChange }: Props) {
  const dpiConfig = device.activeProfile.dpi;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!dpiConfig) {
    return <div className="dpi-editor dpi-editor--unsupported">DPI not supported on this device.</div>;
  }

  const handleLevelClick = (level: DpiLevel, index: number) => {
    onDpiChange(level.dpi);
  };

  const handleEditStart = (index: number, currentDpi: number) => {
    setEditingIndex(index);
    setEditValue(String(currentDpi));
  };

  const handleEditConfirm = () => {
    if (editingIndex === null) return;
    const dpi = parseInt(editValue, 10);
    if (!isNaN(dpi) && dpi >= 100 && dpi <= 25600) {
      onDpiLevelChange(editingIndex, dpi);
    }
    setEditingIndex(null);
  };

  const rgbToCss = (color: RGBColor) => `rgb(${color.r}, ${color.g}, ${color.b})`;

  return (
    <div className="dpi-editor">
      <h3 className="dpi-editor__title">DPI Levels</h3>
      <div className="dpi-editor__levels">
        {dpiConfig.levels.map((level, index) => (
          <button
            type="button"
            key={`${level.dpi}-${level.color.r}-${level.color.g}-${level.color.b}`}
            className={`dpi-editor__level ${level.isActive ? 'dpi-editor__level--active' : ''}`}
            onClick={() => handleLevelClick(level, index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLevelClick(level, index);
              }
            }}
          >
            <div
              className="dpi-editor__level-indicator"
              style={{ backgroundColor: rgbToCss(level.color) }}
            />
            <div className="dpi-editor__level-info">
              {editingIndex === index ? (
                <input
                  className="dpi-editor__level-input"
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleEditConfirm}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditConfirm()}
                  min={100}
                  max={25600}
                  step={50}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  className="dpi-editor__level-value"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={() => handleEditStart(index, level.dpi)}
                >
                  {level.dpi}
                </button>
              )}
              <span className="dpi-editor__level-label">DPI</span>
            </div>
            <div
              className="dpi-editor__level-bar"
              style={{
                width: `${(level.dpi / 25600) * 100}%`,
                backgroundColor: rgbToCss(level.color),
              }}
            />
          </button>
        ))}
      </div>
      <div className="dpi-editor__quick-actions">
        <button type="button" className="dpi-editor__preset" onClick={() => onDpiChange(400)}>400</button>
        <button type="button" className="dpi-editor__preset" onClick={() => onDpiChange(800)}>800</button>
        <button type="button" className="dpi-editor__preset" onClick={() => onDpiChange(1600)}>1600</button>
        <button type="button" className="dpi-editor__preset" onClick={() => onDpiChange(3200)}>3200</button>
      </div>
    </div>
  );
}
