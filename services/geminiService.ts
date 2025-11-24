import { GoogleGenAI } from "@google/genai";
import { LocationData, RiskLevel, RouteInfo, DangerousSegment, Coordinates, VehicleType, ConfidenceLevel, NCHMFStation } from "../types";

// Environment detection
const IS_DEV = import.meta.env.DEV;
const DEV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini client for development only
const devAI = IS_DEV && DEV_API_KEY ? new GoogleGenAI({ apiKey: DEV_API_KEY }) : null;

// Get vehicle-specific context for AI prompts
const getVehicleContext = (vehicleType?: VehicleType): string => {
  switch (vehicleType) {
    case VehicleType.CAR:
      return "Người dùng đi bằng Ô TÔ. An toàn khi nước cao <25-30cm, nguy hiểm khi >30cm (có thể hỏng động cơ).";
    case VehicleType.MOTORCYCLE:
      return "Người dùng đi bằng XE MÁY. Rất nguy hiểm khi nước cao >12-15cm (xe có thể chết máy, người dễ té).";
    case VehicleType.PEDESTRIAN:
      return "Người dùng ĐI BỘ. Nguy hiểm khi nước cao >15cm (dòng chảy mạnh có thể cuốn trôi).";
    default:
      return "Người dùng di chuyển (chưa rõ phương tiện).";
  }
};

export const getSafetyAdvice = async (
  data: LocationData,
  vehicleType?: VehicleType,
  language: string = 'vi',
  nearbyStations?: Array<NCHMFStation & { distance: number }>
): Promise<{ risk: RiskLevel; advice: string; confidence: ConfidenceLevel }> => {
  try {
    // Call the secure backend API endpoint
    const response = await fetch('/api/gemini-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        vehicleType,
        language,
        nearbyStations
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        const errorData = await response.json();
        throw new Error(errorData.errorVi || errorData.error || 'Rate limit exceeded');
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();

    return {
      risk: result.risk as RiskLevel || RiskLevel.UNKNOWN,
      advice: result.advice || (language === 'en' ? "Stay alert and monitor local news." : "Hãy cảnh giác và theo dõi tin tức địa phương."),
      confidence: result.confidence as ConfidenceLevel || ConfidenceLevel.MEDIUM
    };

  } catch (error) {
    console.error("API Error:", error);

    // Client-side fallback logic
    const { elevation, precip72h } = data;
    const precip72hValue = precip72h || 0;
    const isEnglish = language === 'en';

    // Prioritize NCHMF station data in fallback if available
    let precipitation = data.precipitation;
    let precipForecast6h = data.precipForecast6h;
    let confidence = ConfidenceLevel.MEDIUM;

    if (nearbyStations && nearbyStations.length > 0) {
      // Use average of nearby NCHMF stations (ground-truth observations)
      const stationsWithin15km = nearbyStations.filter(s => s.distance! <= 15);
      if (stationsWithin15km.length > 0) {
        precipitation = stationsWithin15km.reduce((sum, s) => sum + (s.luongmuatd || 0), 0) / stationsWithin15km.length;
        precipForecast6h = stationsWithin15km.reduce((sum, s) => sum + s.luongmuadb, 0) / stationsWithin15km.length;
        confidence = ConfidenceLevel.HIGH; // High confidence with official NCHMF data
      } else {
        confidence = ConfidenceLevel.HIGH; // Still high confidence if stations nearby
      }
    } else if (elevation === null) {
      confidence = ConfidenceLevel.LOW;
    }

    let fallbackRisk = RiskLevel.LOW;
    let fallbackAdvice = isEnglish
      ? "Stay alert and monitor local news."
      : "Hãy cảnh giác và theo dõi tin tức địa phương.";

    // PRIORITY 1: Check 72h accumulated rainfall
    if (precip72hValue > 100 && elevation !== null && elevation < 10) {
      fallbackRisk = RiskLevel.HIGH;
      fallbackAdvice = isEnglish
        ? "Ground saturated from heavy rain (past 3 days). High flooding risk from overflowing rivers. Avoid travel."
        : "Đất bão hòa do mưa lớn (3 ngày qua). Nguy cơ ngập cao do sông tràn bờ. Tránh di chuyển.";
    } else if (precip72hValue > 100) {
      fallbackRisk = RiskLevel.MEDIUM;
      fallbackAdvice = isEnglish
        ? "Heavy rainfall over past 3 days. Ground saturated, flooding possible in low areas."
        : "Mưa lớn trong 3 ngày qua. Đất bão hòa, có thể ngập ở vùng trũng.";
    } else if (precip72hValue > 50 && elevation !== null && elevation < 5) {
      fallbackRisk = RiskLevel.MEDIUM;
      fallbackAdvice = isEnglish
        ? "Moderate rain accumulation + low elevation. Watch for rising water levels."
        : "Mưa tích lũy vừa + độ cao thấp. Theo dõi mực nước dâng.";
    }

    // PRIORITY 2: Elevation risk
    if (elevation !== null && elevation < 3) {
      if (fallbackRisk === RiskLevel.LOW) fallbackRisk = RiskLevel.HIGH;
      fallbackAdvice = isEnglish
        ? "Low-lying area, high flood risk. Move to higher ground immediately."
        : "Khu vực thấp trũng, nguy cơ ngập cao. Di chuyển lên vùng cao hơn ngay.";
    } else if (elevation !== null && elevation < 10 && fallbackRisk === RiskLevel.LOW) {
      fallbackRisk = RiskLevel.MEDIUM;
      fallbackAdvice = isEnglish
        ? "Medium elevation area. Monitor water levels and prepare to evacuate if needed."
        : "Khu vực có độ cao trung bình. Theo dõi mực nước và chuẩn bị sơ tán nếu cần.";
    }

    // PRIORITY 3: Current precipitation risk
    if (precipitation > 20) {
      fallbackRisk = RiskLevel.HIGH;
      fallbackAdvice = isEnglish
        ? "Very heavy rain, high risk of flash floods or severe flooding. Avoid travel."
        : "Mưa rất lớn, nguy cơ lũ quét hoặc ngập lụt cao. Tránh di chuyển.";
    } else if (precipitation > 10 && fallbackRisk === RiskLevel.LOW) {
      fallbackRisk = RiskLevel.MEDIUM;
      fallbackAdvice = isEnglish
        ? "Heavy rain, limit travel. Avoid low-lying areas."
        : "Mưa lớn, hạn chế di chuyển. Tránh các vùng trũng thấp.";
    }

    const errorPrefix = isEnglish ? "Offline mode. " : "Chế độ ngoại tuyến. ";
    return {
      risk: fallbackRisk,
      advice: errorPrefix + fallbackAdvice,
      confidence
    };
  }
};

export const evaluateRouteSafety = async (
  start: LocationData,
  end: LocationData,
  routeInfo: RouteInfo,
  vehicleType?: VehicleType,
  language: string = 'vi',
  nearbyStations?: Array<NCHMFStation & { distance: number }>
): Promise<{ risk: RiskLevel; advice: string }> => {
  try {
    // Call the secure backend API endpoint
    const response = await fetch('/api/gemini-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start,
        end,
        routeInfo,
        vehicleType,
        language,
        nearbyStations
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        const errorData = await response.json();
        throw new Error(errorData.errorVi || errorData.error || 'Rate limit exceeded');
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();

    return {
      risk: result.risk as RiskLevel || RiskLevel.UNKNOWN,
      advice: result.advice || (language === 'en' ? "Drive carefully and monitor water levels." : "Hãy lái xe cẩn thận và quan sát mực nước.")
    };

  } catch (error) {
    console.error("API Error (route):", error);

    const isEnglish = language === 'en';
    const fallbackAdvice = isEnglish
      ? "Offline mode. Drive carefully and avoid low-lying flooded areas."
      : "Chế độ ngoại tuyến. Hãy lái xe cẩn thận và tránh các vùng trũng thấp ngập nước.";

    return {
      risk: RiskLevel.MEDIUM,
      advice: fallbackAdvice
    };
  }
};

// Identify dangerous segments along a route based on location data
export const identifyDangerousSegments = (
  segmentDataWithCoords: Array<{ data: LocationData; coords: Coordinates; index: number }>,
  totalDistance: number,
  vehicleType?: VehicleType
): DangerousSegment[] => {
  const dangerousSegments: DangerousSegment[] = [];

  segmentDataWithCoords.forEach((segment, arrayIndex) => {
    const { data, coords, index } = segment;
    const { elevation, precipitation, riverDischarge } = data;

    let riskLevel: RiskLevel = RiskLevel.LOW;
    const reasons: string[] = [];

    // Check elevation risk
    if (elevation !== null && elevation < 3) {
      riskLevel = RiskLevel.HIGH;
      reasons.push(`độ cao rất thấp (${elevation.toFixed(1)}m)`);
    } else if (elevation !== null && elevation < 10) {
      if (riskLevel === RiskLevel.LOW) riskLevel = RiskLevel.MEDIUM;
      reasons.push(`độ cao thấp (${elevation.toFixed(1)}m)`);
    }

    // Check precipitation risk (current + forecast)
    const totalRain = precipitation + (data.precipForecast6h || 0);
    if (totalRain > 30) {
      riskLevel = RiskLevel.HIGH;
      reasons.push(`mưa lớn kéo dài (${totalRain.toFixed(0)}mm)`);
    } else if (precipitation > 20) {
      riskLevel = RiskLevel.HIGH;
      reasons.push(`mưa rất lớn (${precipitation}mm)`);
    } else if (precipitation > 10 || totalRain > 20) {
      if (riskLevel === RiskLevel.LOW) riskLevel = RiskLevel.MEDIUM;
      reasons.push(`mưa lớn (${precipitation}mm)`);
    }

    // Only add if there's actual risk
    if (riskLevel !== RiskLevel.LOW && reasons.length > 0) {
      // Calculate approximate distance from start
      const distanceFromStart = totalDistance > 0
        ? (index / segmentDataWithCoords.length) * (totalDistance / 1000)
        : 0;

      dangerousSegments.push({
        coordinates: coords,
        segmentIndex: index,
        riskLevel,
        reason: reasons.join(', '),
        distanceFromStart: parseFloat(distanceFromStart.toFixed(1))
      });
    }
  });

  return dangerousSegments;
};