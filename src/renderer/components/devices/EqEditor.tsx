import React, { useState, useMemo } from 'react';
import { Device, DeviceType } from '../../../shared/device-types';
import { getPresetsForDevice, EqPresetData } from '../../../data/eq-presets';

interface Props {
  device: Device;
  onEqChange: (bands: number[]) => void;
}

const EQ_FREQUENCIES = ['32', '64', '128', '256', '512', '1K', '2K', '4K', '8K', '16K'];

export function EqEditor({ device, onEqChange }: Props) {
  const presets = useMemo(() => {
    const deviceType = device.type === DeviceType.SPEAKER ? 'SPEAKER' : 'HEADSET';
    return getPresetsForDevice(deviceType);
  }, [device.type]);

  const [bands, setBands] = useState<number[]>(presets[0]?.bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [activePresetId, setActivePresetId] = useState<string>(presets[0]?.id || '');

  const handleBandChange = (index: number, value: number) => {
    const newBands = [...bands];
    newBands[index] = value;
    setBands(newBands);
    setActivePresetId('');
    onEqChange(newBands);
  };

  const handlePreset = (preset: EqPresetData) => {
    setBands([...preset.bands]);
    setActivePresetId(preset.id);
    onEqChange(preset.bands);
  };

  const maxDb = 12;
  const minDb = -12;

  return (
    <div className="eq-editor">
      <div className="eq-editor__presets">
        <h3 className="eq-editor__title">Presets</h3>
        <div className="eq-editor__preset-list">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className={`eq-editor__preset-btn ${activePresetId === preset.id ? 'eq-editor__preset-btn--active' : ''}`}
              onClick={() => handlePreset(preset)}
            >
              {preset.displayName}
            </button>
          ))}
        </div>
      </div>

      <div className="eq-editor__bands">
        <div className="eq-editor__db-labels">
          <span>+{maxDb}dB</span>
          <span>0dB</span>
          <span>{minDb}dB</span>
        </div>
        <div className="eq-editor__sliders">
          {bands.map((value, index) => (
            <div key={index} className="eq-editor__band">
              <input
                type="range"
                className="eq-editor__band-slider"
                min={minDb}
                max={maxDb}
                step={1}
                value={value}
                onChange={(e) => handleBandChange(index, parseInt(e.target.value))}
              />
              <span className="eq-editor__band-value">{value > 0 ? `+${value}` : value}</span>
              <span className="eq-editor__band-freq">{EQ_FREQUENCIES[index]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="eq-editor__curve">
        <svg viewBox="0 0 400 100" className="eq-editor__curve-svg">
          <line x1="0" y1="50" x2="400" y2="50" stroke="var(--border-color)" strokeWidth="1" />
          <polyline
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            points={bands.map((v, i) => `${(i / (bands.length - 1)) * 400},${50 - (v / maxDb) * 40}`).join(' ')}
          />
          {bands.map((v, i) => (
            <circle
              key={i}
              cx={(i / (bands.length - 1)) * 400}
              cy={50 - (v / maxDb) * 40}
              r="4"
              fill="var(--accent-primary)"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
