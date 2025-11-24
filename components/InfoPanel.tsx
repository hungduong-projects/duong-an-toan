import React from 'react';
import { useTranslation } from 'react-i18next';
import { LocationData, AnalysisResult, RiskLevel, RouteInfo, WeatherWarning, ConfidenceLevel } from '../types';

interface InfoPanelProps {
  locationData: LocationData;
  analysis: AnalysisResult;
  routeInfo?: RouteInfo | null;
  activeWarnings?: WeatherWarning[];
  onClose: () => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ locationData, analysis, routeInfo, activeWarnings = [], onClose }) => {
  const { t } = useTranslation();

  const getConfidenceLabel = (confidence?: ConfidenceLevel) => {
    if (!confidence) return null;
    switch (confidence) {
      case ConfidenceLevel.HIGH: return t('confidence.high');
      case ConfidenceLevel.MEDIUM: return t('confidence.medium');
      case ConfidenceLevel.LOW: return t('confidence.low');
      default: return null;
    }
  };

  const getConfidenceColor = (confidence?: ConfidenceLevel) => {
    if (!confidence) return '';
    switch (confidence) {
      case ConfidenceLevel.HIGH: return 'text-green-600 dark:text-green-400';
      case ConfidenceLevel.MEDIUM: return 'text-orange-600 dark:text-orange-400';
      case ConfidenceLevel.LOW: return 'text-red-600 dark:text-red-400';
      default: return '';
    }
  };

  const getWarningSeverityIcon = (severity: WeatherWarning['severity']) => {
    switch (severity) {
      case 'emergency': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      default: return '🔔';
    }
  };

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case RiskLevel.HIGH: return 'bg-red-500';
      case RiskLevel.MEDIUM: return 'bg-orange-500';
      case RiskLevel.LOW: return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  const getRiskLabel = (risk: RiskLevel) => {
    switch (risk) {
      case RiskLevel.HIGH: return t('risk.high');
      case RiskLevel.MEDIUM: return t('risk.medium');
      case RiskLevel.LOW: return t('risk.low');
      default: return t('risk.unknown');
    }
  };

  const isRouteMode = analysis.type === 'route' && routeInfo;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:top-20 md:bottom-auto md:w-96 z-[1000] bg-white/95 backdrop-blur-md dark:bg-slate-800/95 rounded-2xl shadow-xl p-5 border border-slate-200 dark:border-slate-700 transition-all animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isRouteMode ? t('infoPanel.routeAnalysis') : t('infoPanel.pointAnalysis')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
             {locationData.locationName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Weather Warnings Section */}
      {activeWarnings.length > 0 && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r-lg max-h-48 overflow-y-auto">
          <h3 className="text-xs font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
            {t('warnings.officialWarnings')} ({activeWarnings.length})
          </h3>
          <div className="space-y-1.5">
            {activeWarnings.map((warning, index) => (
              <div key={index} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1">
                <span className="shrink-0">{getWarningSeverityIcon(warning.severity)}</span>
                <span>{warning.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isRouteMode && routeInfo ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
           <div className="bg-blue-50 dark:bg-slate-700/50 p-3 rounded-xl text-center">
             <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('infoPanel.distance')}</div>
             <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
               {(routeInfo.distance / 1000).toFixed(1)} km
             </div>
           </div>
           <div className="bg-blue-50 dark:bg-slate-700/50 p-3 rounded-xl text-center">
             <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('infoPanel.duration')}</div>
             <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
               {Math.ceil(routeInfo.duration / 60)} {t('infoPanel.minutes')}
             </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('infoPanel.elevation')}</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {locationData.elevation !== null ? `${locationData.elevation}m` : '--'}
            </div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('infoPanel.precipitation')}</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {locationData.precipitation} <span className="text-sm font-normal">mm/h</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {locationData.precipForecast6h && locationData.precipForecast6h > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  +{locationData.precipForecast6h.toFixed(0)}mm (6h)
                </div>
              )}
              {locationData.precip72h && locationData.precip72h > 0 && (
                <div className={`text-xs font-semibold ${
                  locationData.precip72h > 100 ? 'text-red-600 dark:text-red-400' :
                  locationData.precip72h > 50 ? 'text-orange-600 dark:text-orange-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {locationData.precip72h.toFixed(0)}mm (72h)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
         <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isRouteMode ? t('infoPanel.safetyAssessment') : t('infoPanel.floodRisk')}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${getRiskColor(analysis.riskLevel)}`}>
              {getRiskLabel(analysis.riskLevel)}
            </span>
         </div>
         <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${getRiskColor(analysis.riskLevel)} transition-all duration-500`}
              style={{ width: analysis.riskLevel === RiskLevel.HIGH ? '90%' : analysis.riskLevel === RiskLevel.MEDIUM ? '50%' : '20%' }}
            ></div>
         </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
           <div className="mt-1">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
             </svg>
           </div>
           <div className="flex-1">
             <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">{t('infoPanel.aiAdvice')}</h3>
             <p className="text-sm text-blue-700 dark:text-blue-300 leading-snug">
               {analysis.isLoading ? (
                 <span className="animate-pulse">
                   {isRouteMode ? t('loading.analyzingRoute') : t('loading.analyzingTerrain')}
                 </span>
               ) : (
                 analysis.advice
               )}
             </p>
             {!analysis.isLoading && analysis.confidence && (
               <p className={`text-xs mt-2 font-medium ${getConfidenceColor(analysis.confidence)}`}>
                 {getConfidenceLabel(analysis.confidence)}
               </p>
             )}
           </div>
        </div>
      </div>

      {/* Dangerous Segments Section */}
      {isRouteMode && routeInfo?.dangerousSegments && routeInfo.dangerousSegments.length > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <h3 className="text-sm font-bold text-red-800 dark:text-red-200">
              {t('infoPanel.dangerousSegments')} ({routeInfo.dangerousSegments.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {routeInfo.dangerousSegments.map((segment, index) => (
              <div
                key={index}
                className="bg-white/50 dark:bg-slate-800/50 p-2 rounded text-xs"
              >
                <div className="flex items-start gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ${getRiskColor(segment.riskLevel)}`}>
                    {getRiskLabel(segment.riskLevel)}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      Km {segment.distanceFromStart?.toFixed(1) || '?'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 capitalize">
                      {segment.reason}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoPanel;