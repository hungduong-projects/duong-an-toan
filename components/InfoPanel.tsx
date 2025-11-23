import React from 'react';
import { LocationData, AnalysisResult, RiskLevel, RouteInfo } from '../types';

interface InfoPanelProps {
  locationData: LocationData;
  analysis: AnalysisResult;
  routeInfo?: RouteInfo | null;
  onClose: () => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ locationData, analysis, routeInfo, onClose }) => {
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
      case RiskLevel.HIGH: return 'CAO';
      case RiskLevel.MEDIUM: return 'TRUNG BÌNH';
      case RiskLevel.LOW: return 'THẤP';
      default: return 'CHƯA RÕ';
    }
  };

  const isRouteMode = analysis.type === 'route' && routeInfo;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:top-20 md:bottom-auto md:w-96 z-[1000] bg-white/95 backdrop-blur-md dark:bg-slate-800/95 rounded-2xl shadow-xl p-5 border border-slate-200 dark:border-slate-700 transition-all animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isRouteMode ? 'Phân tích Tuyến đường' : 'Báo cáo Tại điểm'}
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

      {isRouteMode && routeInfo ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
           <div className="bg-blue-50 dark:bg-slate-700/50 p-3 rounded-xl text-center">
             <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Khoảng cách</div>
             <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
               {(routeInfo.distance / 1000).toFixed(1)} km
             </div>
           </div>
           <div className="bg-blue-50 dark:bg-slate-700/50 p-3 rounded-xl text-center">
             <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Thời gian</div>
             <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
               {Math.ceil(routeInfo.duration / 60)} phút
             </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Độ cao</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {locationData.elevation !== null ? `${locationData.elevation}m` : '--'}
            </div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Lượng mưa</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {locationData.precipitation} <span className="text-sm font-normal">mm</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
         <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isRouteMode ? 'Đánh giá An toàn:' : 'Nguy cơ Lũ lụt:'}
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
           <div>
             <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Lời khuyên AI</h3>
             <p className="text-sm text-blue-700 dark:text-blue-300 leading-snug">
               {analysis.isLoading ? (
                 <span className="animate-pulse">
                   {isRouteMode ? 'Đang phân tích lộ trình di chuyển...' : 'Đang phân tích địa hình và thời tiết...'}
                 </span>
               ) : (
                 analysis.advice
               )}
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;