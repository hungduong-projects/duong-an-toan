import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting storage (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

// Request validation schema - maximally permissive with type coercion
const DangerousSegmentSchema = z.object({
  coordinates: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180)
  }).passthrough(),
  segmentIndex: z.coerce.number().catch(0),
  riskLevel: z.enum(['Low', 'Medium', 'High']).catch('Medium'),
  reason: z.string().catch(''),
  distanceFromStart: z.coerce.number().catch(0)
}).passthrough();

const LocationDataSchema = z.object({
  elevation: z.coerce.number().nullable().catch(null),
  precipitation: z.coerce.number().default(0),
  precipForecast6h: z.coerce.number().optional().nullable().catch(null),
  precip72h: z.coerce.number().optional().nullable().catch(null),
}).passthrough();

const RouteInfoSchema = z.object({
  distance: z.coerce.number().catch(0),
  duration: z.coerce.number().catch(0),
  dangerousSegments: z.array(DangerousSegmentSchema).optional().catch(undefined)
}).passthrough();

const RequestSchema = z.object({
  start: LocationDataSchema,
  end: LocationDataSchema,
  routeInfo: RouteInfoSchema,
  vehicleType: z.enum(['CAR', 'MOTORCYCLE', 'PEDESTRIAN']).optional().catch(undefined),
  language: z.enum(['vi', 'en']).optional().catch('vi'),
  nearbyStations: z.array(z.object({
    commune_name: z.string().catch(''),
    district_name: z.string().catch(''),
    provinceName: z.string().catch(''),
    nguycoluquet: z.enum(['Thấp', 'Trung bình', 'Cao']).catch('Thấp'),
    nguycosatlo: z.enum(['Thấp', 'Trung bình', 'Cao']).catch('Thấp'),
    luongmuatd: z.coerce.number().nullable().catch(null),
    luongmuadb: z.coerce.number().catch(0),
    distance: z.coerce.number().catch(0)
  }).passthrough()).optional().catch(undefined)
}).passthrough();

// Get client IP for rate limiting
function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress || 'unknown';
  return ip;
}

// Rate limiting check
function checkRateLimit(ip: string): { allowed: boolean; remainingRequests: number } {
  const now = Date.now();
  const clientData = requestCounts.get(ip);

  if (!clientData || now > clientData.resetTime) {
    // New window
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remainingRequests: RATE_LIMIT - 1 };
  }

  if (clientData.count >= RATE_LIMIT) {
    return { allowed: false, remainingRequests: 0 };
  }

  clientData.count++;
  return { allowed: true, remainingRequests: RATE_LIMIT - clientData.count };
}

// Get vehicle-specific context for AI prompts
function getVehicleContext(vehicleType?: string): string {
  switch (vehicleType) {
    case 'CAR':
      return "Người dùng đi bằng Ô TÔ. An toàn khi nước cao <25-30cm, nguy hiểm khi >30cm (có thể hỏng động cơ).";
    case 'MOTORCYCLE':
      return "Người dùng đi bằng XE MÁY. Rất nguy hiểm khi nước cao >12-15cm (xe có thể chết máy, người dễ té).";
    case 'PEDESTRIAN':
      return "Người dùng ĐI BỘ. Nguy hiểm khi nước cao >15cm (dòng chảy mạnh có thể cuốn trôi).";
    default:
      return "Người dùng di chuyển (chưa rõ phương tiện).";
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check rate limit
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      errorVi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'
    });
  }

  // Validate request body
  let validatedData;
  try {
    validatedData = RequestSchema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error instanceof z.ZodError ? error.issues : 'Validation failed'
    });
  }

  const { start, end, routeInfo, vehicleType, language = 'vi', nearbyStations } = validatedData;

  // Initialize Gemini with server-side API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const distanceKm = (routeInfo.distance / 1000).toFixed(1);
  const durationMin = Math.round(routeInfo.duration / 60);
  const vehicleContext = getVehicleContext(vehicleType);
  const isEnglish = language === 'en';

  // Format nearby NCHMF station data for route analysis
  const stationsContext = nearbyStations && nearbyStations.length > 0 ? (isEnglish ?
    `\n\n**OFFICIAL NCHMF MONITORING STATIONS ALONG ROUTE:**\n${nearbyStations.map(station =>
      `• ${station.commune_name}, ${station.provinceName} (${station.distance.toFixed(1)}km from route):
   - Flash Flood Risk: ${station.nguycoluquet === 'Cao' ? 'HIGH' : station.nguycoluquet === 'Trung bình' ? 'MEDIUM' : 'LOW'}
   - Landslide Risk: ${station.nguycosatlo === 'Cao' ? 'HIGH' : station.nguycosatlo === 'Trung bình' ? 'MEDIUM' : 'LOW'}
   - Rainfall: ${station.luongmuatd !== null ? station.luongmuatd.toFixed(1) : 'N/A'}mm + ${station.luongmuadb.toFixed(1)}mm forecast`
    ).join('\n')}\n\n**These are official government assessments. Use them to validate your route safety evaluation.**\n` :
    `\n\n**TRẠM QUAN TRẮC NCHMF DỌC TUYẾN ĐƯỜNG:**\n${nearbyStations.map(station =>
      `• ${station.commune_name}, ${station.provinceName} (cách tuyến đường ${station.distance.toFixed(1)}km):
   - Nguy cơ lũ quét: ${station.nguycoluquet}
   - Nguy cơ sạt lở: ${station.nguycosatlo}
   - Lượng mưa: ${station.luongmuatd !== null ? station.luongmuatd.toFixed(1) : 'N/A'}mm + ${station.luongmuadb.toFixed(1)}mm dự báo`
    ).join('\n')}\n\n**Đây là đánh giá chính thức từ chính phủ. Sử dụng để xác thực đánh giá an toàn tuyến đường.**\n`
  ) : '';

  // Build dangerous segments summary
  const dangerousInfo = routeInfo.dangerousSegments && routeInfo.dangerousSegments.length > 0
    ? (isEnglish
        ? `\n\n⚠️ WARNING: Detected ${routeInfo.dangerousSegments.length} dangerous segments on route:\n` +
          routeInfo.dangerousSegments.map(seg =>
            `• Km ${seg.distanceFromStart}: ${seg.riskLevel} - ${seg.reason}`
          ).join('\n')
        : `\n\n⚠️ CẢNH BÁO: Phát hiện ${routeInfo.dangerousSegments.length} đoạn nguy hiểm trên tuyến đường:\n` +
          routeInfo.dangerousSegments.map(seg =>
            `• Km ${seg.distanceFromStart}: ${seg.riskLevel} - ${seg.reason}`
          ).join('\n'))
    : (isEnglish
        ? '\n\n✓ No dangerous segments detected on route.'
        : '\n\n✓ Không phát hiện đoạn nguy hiểm trên tuyến đường.');

  const prompt = isEnglish ? `
    Evaluate travel safety for a journey in Vietnam during adverse weather conditions:

    VEHICLE: ${vehicleContext}

    ROUTE INFORMATION:
    • Distance: ${distanceKm} km
    • Estimated time: ${durationMin} minutes
    ${dangerousInfo}
${stationsContext}

    STARTING POINT (A):
    • Elevation: ${start.elevation ?? 'unknown'}m
    • Current rainfall: ${start.precipitation}mm
    • 6h forecast: ${start.precipForecast6h ?? 0}mm

    DESTINATION (B):
    • Elevation: ${end.elevation ?? 'unknown'}m
    • Current rainfall: ${end.precipitation}mm
    • 6h forecast: ${end.precipForecast6h ?? 0}mm

    EVALUATION PRINCIPLES:
    • Elevation <3m at ANY point: High flood risk
    • Rain >20mm: Serious risk, roads may be flooded
    • Rain 10-20mm: Warning, limit travel
    • Long journey (>20km) in heavy rain: Increased exposure to danger
    • If HIGH risk segments exist: Prioritize overall risk as HIGH or MEDIUM
    • If multiple MEDIUM segments exist: Consider increasing overall risk

    TASK:
    Comprehensively analyze ALL information (including detected dangerous segments) and provide safety assessment.

    Return JSON:
    1. "risk": "Low" | "Medium" | "High"
    2. "advice": Specific advice (max 2 sentences) in English: whether to travel, what to watch out for

    Return ONLY raw JSON.
  ` : `
    Đánh giá an toàn hành trình di chuyển tại Việt Nam trong điều kiện thời tiết xấu:

    PHƯƠNG TIỆN: ${vehicleContext}

    THÔNG TIN HÀNH TRÌNH:
    • Khoảng cách: ${distanceKm} km
    • Thời gian dự kiến: ${durationMin} phút
    ${dangerousInfo}
${stationsContext}

    ĐIỂM XUẤT PHÁT (A):
    • Độ cao: ${start.elevation ?? 'không xác định'}m
    • Lượng mưa hiện tại: ${start.precipitation}mm
    • Dự báo 6h tới: ${start.precipForecast6h ?? 0}mm

    ĐIỂM ĐẾN (B):
    • Độ cao: ${end.elevation ?? 'không xác định'}m
    • Lượng mưa hiện tại: ${end.precipitation}mm
    • Dự báo 6h tới: ${end.precipForecast6h ?? 0}mm

    NGUYÊN TẮC ĐÁNH GIÁ:
    • Độ cao <3m ở BẤT KỲ điểm nào: Nguy cơ ngập cao
    • Mưa >20mm: Rủi ro nghiêm trọng, đường có thể ngập
    • Mưa 10-20mm: Cảnh báo, hạn chế di chuyển
    • Hành trình dài (>20km) trong mưa lớn: Tăng thời gian tiếp xúc nguy hiểm
    • Nếu có đoạn nguy hiểm HIGH: Ưu tiên đánh giá risk là HIGH hoặc MEDIUM
    • Nếu có nhiều đoạn MEDIUM: Cân nhắc tăng risk tổng thể

    NHIỆM VỤ:
    Phân tích tổng hợp TẤT CẢ thông tin (bao gồm các đoạn nguy hiểm đã phát hiện) và đưa ra đánh giá an toàn.

    Trả về JSON:
    1. "risk": "Low" | "Medium" | "High"
    2. "advice": Lời khuyên cụ thể (tối đa 2 câu): có nên đi không, cần chú ý gì

    CHỈ trả về JSON thô.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    const defaultAdvice = isEnglish
      ? "Drive carefully and monitor water levels."
      : "Hãy lái xe cẩn thận và quan sát mực nước.";

    return res.status(200).json({
      risk: result.risk || 'UNKNOWN',
      advice: result.advice || defaultAdvice,
      remainingRequests: rateLimit.remainingRequests
    });

  } catch (error) {
    console.error("Gemini API Error (route):", error);

    const fallbackAdvice = isEnglish
      ? "AI system busy. Drive carefully and avoid low-lying flooded areas."
      : "Hệ thống AI bận. Hãy lái xe cẩn thận và tránh các vùng trũng thấp ngập nước.";

    return res.status(200).json({
      risk: 'Medium',
      advice: fallbackAdvice,
      remainingRequests: rateLimit.remainingRequests
    });
  }
}
