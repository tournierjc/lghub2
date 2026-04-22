import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { navigateTo } from '../../store/slices/app-slice';
import { selectDevice } from '../../store/slices/devices-slice';

const NAV_ITEMS = [
  { id: 'home' as const, label: 'Home', icon: '⌂' },
  { id: 'marketplace' as const, label: 'Marketplace', icon: '◈' },
  { id: 'settings' as const, label: 'Settings', icon: '⚙' },
] as const;

export function Sidebar() {
  const dispatch = useDispatch();
  const currentPage = useSelector((state: RootState) => state.app.currentPage);
  const connectedDevices = useSelector((state: RootState) => state.devices.connected);
  const selectedDeviceId = useSelector((state: RootState) => state.devices.selectedDeviceId);

  return (
    <nav className="sidebar">
      <div className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar__item ${currentPage === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => dispatch(navigateTo(item.id))}
          >
            <span className="sidebar__icon">{item.icon}</span>
            <span className="sidebar__label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar__devices">
        <div className="sidebar__section-title">Devices</div>
        {connectedDevices.map((device) => (
          <button
            key={device.id}
            className={`sidebar__device ${currentPage === 'device' && selectedDeviceId === device.id ? 'sidebar__device--active' : ''}`}
            onClick={() => {
              dispatch(selectDevice(device.id));
              dispatch(navigateTo('device'));
            }}
          >
            <span className="sidebar__device-name">{device.name}</span>
            {device.battery && (
              <span className="sidebar__device-battery">{device.battery.percentage}%</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
