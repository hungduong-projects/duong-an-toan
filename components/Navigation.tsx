import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from './LanguageToggle';

const Navigation: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      <a
        href="https://thongtincuuho.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 backdrop-blur rounded-full shadow-lg border border-red-700 hover:bg-red-700 transition-colors"
      >
        Cứu Hộ
      </a>

      <Link
        to="/about"
        className="px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        {t('nav.about')}
      </Link>

      <Link
        to="/donate"
        className="px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        {t('nav.donate')}
      </Link>

      <LanguageToggle />
    </nav>
  );
};

export default Navigation;
