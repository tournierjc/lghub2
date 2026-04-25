import { useState, useCallback, useEffect, useMemo } from 'react';
import { LightingEffect } from '../../../shared/device-types';
import type { Device, LightingConfig, RGBColor } from '../../../shared/device-types';
import { getAvailableEffects, getEffectPrefab } from '../../../data/effect-prefabs';
import type { AvailableEffect } from '../../../data/effect-prefabs';

interface Props {
  device: Device;
  onLightingChange: (config: LightingConfig) => void;
}

export function LightingEditor({ device, onLightingChange }: Props) {
  const effects = useMemo<AvailableEffect[]>(() => {
    return getAvailableEffects(device.lightingCapability);
  }, [device.lightingCapability]);

  const [selectedEffect, setSelectedEffect] = useState<LightingEffect>(effects[0]?.id || LightingEffect.SOLID);
  const [color, setColor] = useState<RGBColor>({ r: 0, g: 212, b: 255 });
  const [speed, setSpeed] = useState(50);
  const [brightness, setBrightness] = useState(100);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const zones = device.lightingZones || [];
  const selectedPrefab = useMemo(() => getEffectPrefab(selectedEffect), [selectedEffect]);

  useEffect(() => {
    if (zones.length > 0 && selectedZones.length === 0) {
      setSelectedZones(zones.map((z) => z.id));
    }
  }, [zones, selectedZones.length]);

  const emitChange = useCallback(() => {
    onLightingChange({
      effect: selectedEffect,
      colors: [color],
      speed,
      brightness,
      zones: selectedZones.length > 0 ? selectedZones : undefined,
    });
  }, [selectedEffect, color, speed, brightness, selectedZones, onLightingChange]);

  const handleEffectChange = (effect: LightingEffect) => {
    setSelectedEffect(effect);
  };

  const handleColorInput = (channel: keyof RGBColor, value: number) => {
    const newColor = { ...color, [channel]: Math.max(0, Math.min(255, value)) };
    setColor(newColor);
  };

  const handleSpeedChange = (value: number) => {
    setSpeed(value);
  };

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((z) => z !== zoneId)
        : [...prev, zoneId]
    );
  };

  const rgbToCss = (c: RGBColor) => `rgb(${c.r}, ${c.g}, ${c.b})`;

  return (
    <div className="lighting-editor">
      <div className="lighting-editor__effects">
        <h3 className="lighting-editor__section-title">Effect</h3>
        <div className="lighting-editor__effect-grid">
          {effects.map((effect) => (
            <button
              type="button"
              key={effect.id}
              className={`lighting-editor__effect-btn ${selectedEffect === effect.id ? 'lighting-editor__effect-btn--active' : ''}`}
              onClick={() => handleEffectChange(effect.id)}
            >
              {effect.label}
            </button>
          ))}
        </div>
        {selectedPrefab?.description && (
          <p className="lighting-editor__hint">{selectedPrefab.description}</p>
        )}
      </div>

      {selectedPrefab?.hasColor !== false && (
        <div className="lighting-editor__color">
          <h3 className="lighting-editor__section-title">Color</h3>
          <div className="lighting-editor__color-preview" style={{ backgroundColor: rgbToCss(color) }} />
        <div className="lighting-editor__color-sliders">
          <div className="lighting-editor__color-channel">
              <label htmlFor="lighting-color-r">R</label>
              <input
                id="lighting-color-r"
                type="range"
                min={0}
                max={255}
                value={color.r}
                onChange={(e) => handleColorInput('r', parseInt(e.target.value, 10))}
                className="lighting-editor__slider lighting-editor__slider--red"
              />
              <span className="lighting-editor__channel-value">{color.r}</span>
            </div>
            <div className="lighting-editor__color-channel">
              <label htmlFor="lighting-color-g">G</label>
              <input
                id="lighting-color-g"
                type="range"
                min={0}
                max={255}
                value={color.g}
                onChange={(e) => handleColorInput('g', parseInt(e.target.value, 10))}
                className="lighting-editor__slider lighting-editor__slider--green"
              />
              <span className="lighting-editor__channel-value">{color.g}</span>
            </div>
            <div className="lighting-editor__color-channel">
              <label htmlFor="lighting-color-b">B</label>
              <input
                id="lighting-color-b"
                type="range"
                min={0}
                max={255}
                value={color.b}
                onChange={(e) => handleColorInput('b', parseInt(e.target.value, 10))}
                className="lighting-editor__slider lighting-editor__slider--blue"
              />
              <span className="lighting-editor__channel-value">{color.b}</span>
            </div>
          </div>
          <div className="lighting-editor__hex-input">
            <span>#</span>
            <input
              type="text"
              value={`${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`}
              onChange={(e) => {
                const hex = e.target.value.replace('#', '');
                if (hex.length === 6) {
                  const r = parseInt(hex.slice(0, 2), 16);
                  const g = parseInt(hex.slice(2, 4), 16);
                  const b = parseInt(hex.slice(4, 6), 16);
                  if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
                    setColor({ r, g, b });
                  }
                }
              }}
              maxLength={6}
            />
          </div>
        </div>
      )}

      {(selectedPrefab?.hasSpeed || selectedPrefab?.hasBrightness) && (
        <div className="lighting-editor__controls">
          <h3 className="lighting-editor__section-title">Parameters</h3>
          {selectedPrefab?.hasSpeed && (
            <div className="lighting-editor__control">
              <label htmlFor="lighting-speed">Speed</label>
              <input
                id="lighting-speed"
                type="range"
                min={0}
                max={100}
                value={speed}
                onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10))}
                className="lighting-editor__slider"
              />
              <span className="lighting-editor__control-value">{speed}%</span>
            </div>
          )}
          {selectedPrefab?.hasBrightness && (
            <div className="lighting-editor__control">
              <label htmlFor="lighting-brightness">Brightness</label>
              <input
                id="lighting-brightness"
                type="range"
                min={0}
                max={100}
                value={brightness}
                onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
                className="lighting-editor__slider"
              />
              <span className="lighting-editor__control-value">{brightness}%</span>
            </div>
          )}
        </div>
      )}

      {zones.length > 0 && (
        <div className="lighting-editor__zones">
          <h3 className="lighting-editor__section-title">Zones</h3>
          <div className="lighting-editor__zone-list">
            {zones.map((zone) => (
              <button
                type="button"
                key={zone.id}
                className={`lighting-editor__zone-btn ${selectedZones.includes(zone.id) ? 'lighting-editor__zone-btn--active' : ''}`}
                onClick={() => toggleZone(zone.id)}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="lighting-editor__apply" onClick={emitChange}>
        Apply
      </button>
    </div>
  );
}
