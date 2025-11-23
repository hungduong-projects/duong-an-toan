import React from 'react';
import { useTranslation } from 'react-i18next';

interface LocateMeButtonProps {
  onLocateMe: () => void;
}

const LocateMeButton: React.FC<LocateMeButtonProps> = ({ onLocateMe }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onLocateMe}
      className="fixed bottom-24 md:bottom-6 right-4 z-[999] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 min-w-[48px] min-h-[48px] flex items-center justify-center"
      aria-label={t('button.locateMe')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 sm:h-6 sm:w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </button>
  );
};

export default LocateMeButton;
