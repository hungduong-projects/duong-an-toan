import React from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleType } from '../types';

interface VehicleSelectorProps {
  selectedVehicle: VehicleType;
  onSelect: (vehicle: VehicleType) => void;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ selectedVehicle, onSelect }) => {
  const { t } = useTranslation();

  const vehicles = [
    { type: VehicleType.CAR, icon: '🚗', label: t('vehicle.car') },
    { type: VehicleType.MOTORCYCLE, icon: '🏍️', label: t('vehicle.motorcycle') },
    { type: VehicleType.PEDESTRIAN, icon: '🚶', label: t('vehicle.pedestrian') }
  ];

  return (
    <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 p-1">
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.type}
          onClick={() => onSelect(vehicle.type)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all font-medium text-sm
            ${selectedVehicle === vehicle.type
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }
          `}
          title={vehicle.label}
        >
          <span className="text-lg">{vehicle.icon}</span>
          <span className="whitespace-nowrap">{vehicle.label}</span>
        </button>
      ))}
    </div>
  );
};

export default VehicleSelector;
