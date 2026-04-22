import React, { useState } from 'react';
import { Device, DpiLevel, RGBColor } from '../../../shared/device-types';

interface Props {
  device: Device;
  onDpiChange: (dpi: number) => void;
}

export function DpiEditor({ device, onDpiChange }: Props) {
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
      onDpiChange(dpi);
    }
    setEditingIndex(null);
  };

  const rgbToCss = (color: RGBColor) => `rgb(${color.r}, ${color.g}, ${color.b})`;

  return (
    <div className="dpi-editor">
      <h3 className="dpi-editor__title">DPI Levels</h3>
      <div className="dpi-editor__levels">
        {dpiConfig.levels.map((level, index) => (
          <div
            key={index}
            className={`dpi-editor__level ${level.isActive ? 'dpi-editor__level--active' : ''}`}
            onClick={() => handleLevelClick(level, index)}
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
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="dpi-editor__level-value"
                  onDoubleClick={() => handleEditStart(index, level.dpi)}
                >
                  {level.dpi}
                </span>
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
          </div>
        ))}
      </div>
      <div className="dpi-editor__quick-actions">
        <button className="dpi-editor__preset" onClick={() => onDpiChange(400)}>400</button>
        <button className="dpi-editor__preset" onClick={() => onDpiChange(800)}>800</button>
        <button className="dpi-editor__preset" onClick={() => onDpiChange(1600)}>1600</button>
        <button className="dpi-editor__preset" onClick={() => onDpiChange(3200)}>3200</button>
      </div>
    </div>
  );
}
