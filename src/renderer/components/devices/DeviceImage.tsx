import React from 'react';
import { DeviceType } from '../../../shared/device-types';
import { ButtonDef } from '../../../shared/device-buttons';

interface Props {
  modelId: string;
  deviceType: DeviceType;
  className?: string;
  buttons?: ButtonDef[];
  selectedButtonId?: string | null;
  onButtonSelect?: (buttonId: string) => void;
}

function G502Svg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>G502 device image</title>
      <path d="M60 30 C45 30 30 50 28 80 L20 180 C18 220 40 250 70 250 L130 250 C160 250 182 220 180 180 L172 80 C170 50 155 30 140 30 Z" fill="#1a1a2e" stroke="#333" strokeWidth="2"/>
      <path d="M60 30 L100 30 L100 110 L60 115 Z" fill="#0f0f1e" stroke="#444" strokeWidth="1"/>
      <path d="M140 30 L100 30 L100 110 L140 115 Z" fill="#0f0f1e" stroke="#444" strokeWidth="1"/>
      <ellipse cx="100" cy="95" rx="12" ry="25" fill="#222" stroke="#555" strokeWidth="1"/>
      <circle cx="100" cy="70" r="4" fill="#1196ff" opacity="0.8"/>
      <rect x="55" y="120" width="18" height="8" rx="2" fill="#1196ff" opacity="0.6"/>
      <rect x="55" y="132" width="18" height="8" rx="2" fill="#333"/>
      <rect x="75" y="120" width="14" height="8" rx="2" fill="#333"/>
      <rect x="128" y="125" width="14" height="8" rx="2" fill="#333"/>
      <rect x="128" y="137" width="14" height="8" rx="2" fill="#333"/>
      <path d="M70 200 Q100 195 130 200" stroke="#1196ff" strokeWidth="1.5" opacity="0.4" fill="none"/>
    </svg>
  );
}

function G513Svg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 380 140" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>G513 device image</title>
      <rect x="8" y="8" width="364" height="124" rx="8" fill="#1a1a2e" stroke="#333" strokeWidth="2"/>
      <rect x="8" y="8" width="32" height="124" rx="6" fill="#111" stroke="#2a2a3e" strokeWidth="1"/>
      {Array.from({ length: 5 }, (_, index) => index).map((index) => (
        <rect key={`gkey-row-${index}`} x="14" y={20 + index * 22} width="20" height="14" rx="2" fill="#1196ff" opacity="0.5"/>
      ))}
      {Array.from({ length: 14 }, (_, col) => col).map((col) => (
        Array.from({ length: 4 }, (_, row) => row).map((row) => (
          <rect key={`gkey-${col}-${row}`} x={50 + col * 22} y={20 + row * 26} width="18" height="20" rx="3" fill="#181825" stroke="#2a2a3e" strokeWidth="0.5"/>
        ))
      ))}
      <path d="M50 110 Q215 106 360 110" stroke="#1196ff" strokeWidth="1" opacity="0.25" fill="none"/>
    </svg>
  );
}

function GenericMouseSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 240" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Generic mouse image</title>
      <path d="M50 30 C35 30 22 55 20 85 L15 175 C12 215 38 240 65 240 L115 240 C142 240 168 215 165 175 L160 85 C158 55 145 30 130 30 Z" fill="#1a1a2e" stroke="#333" strokeWidth="2"/>
      <path d="M50 30 L90 30 L90 100 L50 105 Z" fill="#0f0f1e" stroke="#444" strokeWidth="1"/>
      <path d="M130 30 L90 30 L90 100 L130 105 Z" fill="#0f0f1e" stroke="#444" strokeWidth="1"/>
      <ellipse cx="90" cy="85" rx="10" ry="22" fill="#222" stroke="#555" strokeWidth="1"/>
    </svg>
  );
}

function GenericKeyboardSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 120" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Generic keyboard image</title>
      <rect x="6" y="6" width="328" height="108" rx="8" fill="#1a1a2e" stroke="#333" strokeWidth="2"/>
      {Array.from({ length: 12 }, (_, col) => col).map((col) => (
        Array.from({ length: 4 }, (_, row) => row).map((row) => (
          <rect key={`gkey-${col}-${row}`} x={18 + col * 26} y={18 + row * 22} width="22" height="16" rx="3" fill="#181825" stroke="#2a2a3e" strokeWidth="0.5"/>
        ))
      ))}
    </svg>
  );
}

export function DeviceImage({ modelId, deviceType, className, buttons, selectedButtonId, onButtonSelect }: Props) {
  const model = modelId.toLowerCase();
  const overlayButtons = buttons?.filter((button) => button.layoutPos) ?? [];
  const selectedId = selectedButtonId?.toLowerCase() ?? null;

  if (model === 'c332' || model === 'c547' || model === 'c090' || model === 'c091' || model === 'c08b') {
    return (
      <div className={`device-image ${className || ''}`.trim()}>
        <G502Svg className="device-image__svg" />
        {!!overlayButtons.length && (
          <div className="device-image__overlay">
            {overlayButtons.map((button) => {
              const buttonId = button.controlId.toString(16).padStart(4, '0');
              const [x, y] = button.layoutPos as [number, number];
              const isSelected = selectedId === buttonId;
              return (
                <button
                  key={buttonId}
                  type="button"
                  className={`device-image__button ${isSelected ? 'device-image__button--selected' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={button.name}
                  aria-pressed={isSelected}
                  onClick={() => onButtonSelect?.(buttonId)}
                  disabled={!onButtonSelect}
                >
                  <span className="device-image__button-dot" />
                  <span className="device-image__button-label">{button.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  if (model === 'c33c' || model === 'c33f' || model === 'c343' || model === 'c339') {
    return (
      <div className={`device-image ${className || ''}`.trim()}>
        <G513Svg className="device-image__svg" />
        {!!overlayButtons.length && (
          <div className="device-image__overlay">
            {overlayButtons.map((button) => {
              const buttonId = button.controlId.toString(16).padStart(4, '0');
              const [x, y] = button.layoutPos as [number, number];
              const isSelected = selectedId === buttonId;
              return (
                <button
                  key={buttonId}
                  type="button"
                  className={`device-image__button ${isSelected ? 'device-image__button--selected' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={button.name}
                  aria-pressed={isSelected}
                  onClick={() => onButtonSelect?.(buttonId)}
                  disabled={!onButtonSelect}
                >
                  <span className="device-image__button-dot" />
                  <span className="device-image__button-label">{button.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  const fallbackSvg = deviceType === DeviceType.KEYBOARD ? <G513Svg className="device-image__svg" /> : <GenericMouseSvg className="device-image__svg" />;
  return <div className={`device-image ${className || ''}`.trim()}>{fallbackSvg}</div>;
}
