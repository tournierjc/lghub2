import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import { scanDevices, setDiscoveredDevices, selectDevice } from '../store/slices/devices-slice';
import { navigateTo } from '../store/slices/app-slice';
import { DeviceImage } from '../components/devices/DeviceImage';

export function HomePage() {
  const dispatch = useAppDispatch();
  const connected = useAppSelector((state) => state.devices.connected);
  const loading = useAppSelector((state) => state.devices.loading);
  const [customImageByModel, setCustomImageByModel] = useState<Record<string, string | null>>({});

  const refreshCustomDeviceImages = useCallback(async () => {
    const modelIds = [...new Set(connected.map((d) => d.modelId))];
    const pairs = await Promise.all(
      modelIds.map(async (modelId) => [modelId, await window.device.getCustomDeviceImageUrl(modelId)] as const),
    );
    setCustomImageByModel(Object.fromEntries(pairs));
  }, [connected]);

  useEffect(() => {
    const init = async () => {
      dispatch(scanDevices());
      const devices = await window.hid.enumerate();
      dispatch(setDiscoveredDevices(devices));
    };
    init();
  }, [dispatch]);

  useEffect(() => {
    refreshCustomDeviceImages();
  }, [refreshCustomDeviceImages]);

  useEffect(() => {
    window.addEventListener('lghub2:device-image-updated', refreshCustomDeviceImages);
    return () => window.removeEventListener('lghub2:device-image-updated', refreshCustomDeviceImages);
  }, [refreshCustomDeviceImages]);

  return (
    <div className="home-page">
      <h1 className="home-page__title">My Devices</h1>

      {loading && <div className="home-page__loading">Scanning for devices...</div>}

      {connected.length === 0 && !loading && (
        <div className="home-page__empty">
          <p>No devices connected.</p>
          <p className="home-page__hint">
            Connect a Logitech G device via USB or Lightspeed receiver.
          </p>
        </div>
      )}

      <div className="home-page__device-grid">
        {connected.map((device) => (
          <div
            key={device.id}
            className="device-card"
            onClick={() => {
              dispatch(selectDevice(device.id));
              dispatch(navigateTo('device'));
            }}
          >
            <div className="device-card__image">
              <DeviceImage
                modelId={device.modelId}
                deviceType={device.type}
                customImageSrc={customImageByModel[device.modelId] ?? undefined}
                imageAlt={device.name}
              />
            </div>
            <div className="device-card__info">
              <h3 className="device-card__name">{device.name}</h3>
              <span className="device-card__type">{device.type}</span>
              {device.battery && (
                <div className="device-card__battery">
                  <div
                    className="device-card__battery-bar"
                    style={{ width: `${device.battery.percentage}%` }}
                  />
                  <span>{device.battery.percentage}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
