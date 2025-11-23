import React from 'react';
import { useTranslation } from 'react-i18next';
import SearchBar from './SearchBar';
import VehicleSelector from './VehicleSelector';
import Navigation from './Navigation';
import { VehicleType } from '../types';

interface LocationState {
  coords: { lat: number; lng: number };
  name: string;
}

interface HeaderProps {
  origin: LocationState | null;
  destination: LocationState | null;
  vehicleType: VehicleType;
  onOriginSelect: (lat: number, lng: number, name: string) => void;
  onDestinationSelect: (lat: number, lng: number, name: string) => void;
  onVehicleSelect: (vehicle: VehicleType) => void;
  onClearRoute: () => void;
  onFindRoute: () => void;
}

const Header: React.FC<HeaderProps> = ({
  origin,
  destination,
  vehicleType,
  onOriginSelect,
  onDestinationSelect,
  onVehicleSelect,
  onClearRoute,
  onFindRoute
}) => {
  const { t } = useTranslation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        {/* Top Row: Brand, Search, Navigation */}
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center md:justify-between">

          {/* Left: Brand */}
          <div className="flex items-center gap-1.5">
            <img
              src="/favicon.svg"
              alt={t('nav.brand')}
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
          </div>

          {/* Center: Search Container */}
          <div className="w-full md:max-w-sm lg:max-w-md flex flex-col gap-2">

            {/* If Destination is set, show Origin Input too (Route Mode) */}
            {destination && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                <SearchBar
                  placeholder={t('search.origin')}
                  initialValue={origin?.name || ""}
                  onSelectLocation={onOriginSelect}
                  className="shadow-sm"
                  icon={<div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>}
                />
              </div>
            )}

            <div className="flex gap-2 w-full">
              <SearchBar
                placeholder={destination ? t('search.destination') : t('search.placeholder')}
                initialValue={destination?.name || ""}
                onSelectLocation={onDestinationSelect}
                icon={destination ? <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div> : undefined}
              />

              {/* Reset/Cancel Button if Route Mode */}
              {destination && (
                <button
                  onClick={onClearRoute}
                  className="bg-white text-slate-500 px-3 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Vehicle Selector & Find Route Button - Show only when destination is selected */}
            {destination && (
              <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                <VehicleSelector selectedVehicle={vehicleType} onSelect={onVehicleSelect} />
                <button
                  onClick={onFindRoute}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                >
                  {t('button.findSafeRoute')}
                </button>
              </div>
            )}
          </div>

          {/* Right: Navigation */}
          <div>
            <Navigation />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
