import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting storage (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

// Request validation schema
const RequestSchema = z.object({
  data: z.object({
    elevation: z.number().nullable(),
    precipitation: z.number(),
    precipForecast6h: z.number().optional().nullable(),
    precip72h: z.number().optional().nullable(),
    riverDischarge: z.number().optional().nullable(),
    locationName: z.string().optional(),
  }),
  vehicleType: z.enum(['CAR', 'MOTORCYCLE', 'PEDESTRIAN']).optional(),
  language: z.enum(['vi', 'en']).optional(),
  nearbyStations: z.array(z.object({
    commune_name: z.string(),
    district_name: z.string(),
    provinceName: z.string(),
    nguycoluquet: z.enum(['Thấp', 'Trung bình', 'Cao']),
    nguycosatlo: z.enum(['Thấp', 'Trung bình', 'Cao']),
    luongmuatd: z.number().nullable(),
    luongmuadb: z.number(),
    distance: z.number()
  })).optional()
});

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

  const { data, vehicleType, language = 'vi', nearbyStations } = validatedData;
  const { elevation, precipitation, precipForecast6h, precip72h } = data;

  // Initialize Gemini with server-side API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ai = new GoogleGenAI({ apiKey });

  // Calculate confidence based on data availability
  let confidence = 'HIGH';
  if (nearbyStations && nearbyStations.length > 0) {
    confidence = 'HIGH';
  } else if (elevation === null) {
    confidence = 'MEDIUM';
  }
  if (elevation === null && precipitation === 0 && (precipForecast6h || 0) === 0 &&
      (precip72h || 0) === 0 && (!nearbyStations || nearbyStations.length === 0)) {
    confidence = 'LOW';
  }

  const vehicleContext = getVehicleContext(vehicleType);
  const totalRain = precipitation + (precipForecast6h || 0);
  const precip72hValue = precip72h || 0;
  const isEnglish = language === 'en';

  // Format nearby NCHMF station data for AI prompt
  const stationsContext = nearbyStations && nearbyStations.length > 0 ? (isEnglish ?
    `\n\n**OFFICIAL NCHMF MONITORING STATIONS (Vietnam Government Data):**\n${nearbyStations.map(station =>
      `• ${station.commune_name}, ${station.district_name}, ${station.provinceName} (${station.distance.toFixed(1)}km away):
   - Flash Flood Risk: ${station.nguycoluquet} ${station.nguycoluquet === 'Cao' ? '(HIGH)' : station.nguycoluquet === 'Trung bình' ? '(MEDIUM)' : '(LOW)'}
   - Landslide Risk: ${station.nguycosatlo} ${station.nguycosatlo === 'Cao' ? '(HIGH)' : station.nguycosatlo === 'Trung bình' ? '(MEDIUM)' : '(LOW)'}
   - Current Rainfall: ${station.luongmuatd !== null ? station.luongmuatd.toFixed(1) : 'N/A'}mm
   - 6h Forecast: ${station.luongmuadb.toFixed(1)}mm`
    ).join('\n')}\n\n**IMPORTANT: These are official assessments from Vietnamese meteorological experts. Give significant weight to these in your analysis.**\n` :
    `\n\n**DỮ LIỆU TRẠM QUAN TRẮC NCHMF (Dữ liệu chính thức từ Chính phủ Việt Nam):**\n${nearbyStations.map(station =>
      `• ${station.commune_name}, ${station.district_name}, ${station.provinceName} (cách ${station.distance.toFixed(1)}km):
   - Nguy cơ lũ quét: ${station.nguycoluquet}
   - Nguy cơ sạt lở: ${station.nguycosatlo}
   - Mưa hiện tại: ${station.luongmuatd !== null ? station.luongmuatd.toFixed(1) : 'N/A'}mm
   - Dự báo 6h: ${station.luongmuadb.toFixed(1)}mm`
    ).join('\n')}\n\n**QUAN TRỌNG: Đây là đánh giá chính thức từ các chuyên gia khí tượng Việt Nam. Hãy ưu tiên dữ liệu này trong phân tích của bạn.**\n`
  ) : '';

  const prompt = isEnglish ? `
    Analyze flood risk data for a location in Vietnam:
    - Elevation: ${elevation !== null ? elevation + ' meters' : 'Unknown'}
    - Current rainfall: ${precipitation} mm/hour
    - 6h forecast: ${precipForecast6h || 0} mm
    - Total upcoming rain: ${totalRain} mm
    - **72-hour accumulated rainfall: ${precip72hValue} mm** (CRITICAL INDICATOR)
${stationsContext}
    VEHICLE: ${vehicleContext}

    VIETNAM CONTEXT:
    • Elevation <3m: HIGH DANGER (Mekong Delta, Red River Delta, Central Coast, urban low-lying areas)
    • Elevation 3-10m: MEDIUM RISK (urban areas, riverside plains)
    • Elevation >10m: Safer unless very heavy rain (mountainous areas have flash flood risk)

    **GROUND SATURATION (72h accumulated rain - KEY INDICATOR):**
    • >100mm in 72h: CRITICAL - Ground SATURATED, rivers overflowing, landslide risk HIGH
    • 50-100mm in 72h: WARNING - Soil waterlogged, flooding likely in low areas
    • <50mm in 72h: Normal - Soil can still absorb water

    **CURRENT RAIN INTENSITY:**
    • >30mm/h: FLASH FLOOD - Extremely dangerous, immediate threat
    • >20mm/h: VERY HEAVY - Severe flooding risk
    • 10-20mm/h: Heavy - Localized flooding, watch low-lying areas
    • <10mm/h: Light - Low immediate risk

    **COMBINED RISK ASSESSMENT:**
    If 72h rain >100mm + elevation <10m → HIGH risk (existing flooding likely)
    If 72h rain >50mm + current rain >10mm → MEDIUM-HIGH risk
    Even if current rain = 0mm, check 72h accumulation for ongoing floods!

    TASK:
    Prioritize 72h accumulated rainfall as THE PRIMARY indicator of existing floods.
    Current rain = future risk. 72h rain = current flooding status.

    Return JSON with:
    1. "risk": "Low" | "Medium" | "High" (in English)
    2. "advice": Specific advice (1-2 sentences) in English, mention if flooding is from past rain

    Return ONLY raw JSON, no explanation.
  ` : `
    Phân tích dữ liệu rủi ro lũ lụt cho địa điểm tại Việt Nam:
    - Độ cao: ${elevation !== null ? elevation + ' mét' : 'Không xác định'}
    - Lượng mưa hiện tại: ${precipitation} mm/giờ
    - Dự báo 6h tới: ${precipForecast6h || 0} mm
    - Tổng mưa sắp tới: ${totalRain} mm
    - **Mưa tích lũy 72 giờ qua: ${precip72hValue} mm** (CHỈ SỐ QUAN TRỌNG NHẤT)
${stationsContext}
    PHƯƠNG TIỆN: ${vehicleContext}

    BỐI CẢNH VIỆT NAM:
    • Độ cao <3m: NGUY HIỂM CAO (Đồng bằng sông Cửu Long, Đồng bằng sông Hồng, ven biển miền Trung, vùng trũng đô thị)
    • Độ cao 3-10m: RỦI RO TRUNG BÌNH (vùng nội thành, đồng bằng ven sông)
    • Độ cao >10m: An toàn hơn trừ khi mưa rất lớn (vùng núi có nguy cơ lũ quét)

    **ĐỘ BÃO HÒA ĐẤT (mưa tích lũy 72h - CHỈ SỐ CHÍNH):**
    • >100mm trong 72h: NGUY CẤP - Đất BÃO HÒA, sông tràn bờ, nguy cơ SẠT LỞ cao
    • 50-100mm trong 72h: CẢNH BÁO - Đất ngấm nước, ngập lụt có thể xảy ra ở vùng trũng
    • <50mm trong 72h: Bình thường - Đất còn khả năng hấp thụ nước

    **CƯỜNG ĐỘ MƯA HIỆN TẠI:**
    • >30mm/giờ: LŨ QUÉT - Cực kỳ nguy hiểm, mối đe dọa tức thời
    • >20mm/giờ: MƯA RẤT LỚN - Nguy cơ ngập nghiêm trọng
    • 10-20mm/giờ: Mưa lớn - Ngập cục bộ, chú ý vùng trũng
    • <10mm/giờ: Mưa nhẹ - Rủi ro thấp

    **ĐÁNH GIÁ RỦI RO TỔNG HỢP:**
    Nếu mưa 72h >100mm + độ cao <10m → Rủi ro CAO (đã có ngập lụt)
    Nếu mưa 72h >50mm + mưa hiện tại >10mm → Rủi ro TRUNG BÌNH-CAO
    Ngay cả khi mưa hiện tại = 0mm, kiểm tra mưa tích lũy 72h để biết ngập lụt đang diễn ra!

    NHIỆM VỤ:
    Ưu tiên mưa tích lũy 72h là CHỈ SỐ CHÍNH để phát hiện lũ lụt hiện tại.
    Mưa hiện tại = rủi ro tương lai. Mưa 72h = tình trạng ngập hiện tại.

    Trả về JSON với:
    1. "risk": "Low" | "Medium" | "High" (giữ nguyên tiếng Anh)
    2. "advice": Lời khuyên cụ thể (1-2 câu) bằng Tiếng Việt, đề cập nếu ngập do mưa trước đó

    CHỈ trả về JSON thô, không giải thích thêm.
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
      ? "Stay alert and monitor local news."
      : "Hãy cảnh giác và theo dõi tin tức địa phương.";

    return res.status(200).json({
      risk: result.risk || 'UNKNOWN',
      advice: result.advice || defaultAdvice,
      confidence,
      remainingRequests: rateLimit.remainingRequests
    });

  } catch (error) {
    console.error("Gemini API Error:", error);

    // Fallback logic with Vietnam-specific thresholds
    let fallbackRisk = 'Low';
    let fallbackAdvice = isEnglish
      ? "Stay alert and monitor local news."
      : "Hãy cảnh giác và theo dõi tin tức địa phương.";

    // PRIORITY 1: Check 72h accumulated rainfall
    if (precip72hValue > 100 && elevation !== null && elevation < 10) {
      fallbackRisk = 'High';
      fallbackAdvice = isEnglish
        ? "Ground saturated from heavy rain (past 3 days). High flooding risk from overflowing rivers. Avoid travel."
        : "Đất bão hòa do mưa lớn (3 ngày qua). Nguy cơ ngập cao do sông tràn bờ. Tránh di chuyển.";
    } else if (precip72hValue > 100) {
      fallbackRisk = 'Medium';
      fallbackAdvice = isEnglish
        ? "Heavy rainfall over past 3 days. Ground saturated, flooding possible in low areas."
        : "Mưa lớn trong 3 ngày qua. Đất bão hòa, có thể ngập ở vùng trũng.";
    } else if (precip72hValue > 50 && elevation !== null && elevation < 5) {
      fallbackRisk = 'Medium';
      fallbackAdvice = isEnglish
        ? "Moderate rain accumulation + low elevation. Watch for rising water levels."
        : "Mưa tích lũy vừa + độ cao thấp. Theo dõi mực nước dâng.";
    }

    // PRIORITY 2: Elevation risk
    if (elevation !== null && elevation < 3) {
      if (fallbackRisk === 'Low') fallbackRisk = 'High';
      fallbackAdvice = isEnglish
        ? "Low-lying area, high flood risk. Move to higher ground immediately."
        : "Khu vực thấp trũng, nguy cơ ngập cao. Di chuyển lên vùng cao hơn ngay.";
    } else if (elevation !== null && elevation < 10 && fallbackRisk === 'Low') {
      fallbackRisk = 'Medium';
      fallbackAdvice = isEnglish
        ? "Medium elevation area. Monitor water levels and prepare to evacuate if needed."
        : "Khu vực có độ cao trung bình. Theo dõi mực nước và chuẩn bị sơ tán nếu cần.";
    }

    // PRIORITY 3: Current precipitation risk
    if (precipitation > 20) {
      fallbackRisk = 'High';
      fallbackAdvice = isEnglish
        ? "Very heavy rain, high risk of flash floods or severe flooding. Avoid travel."
        : "Mưa rất lớn, nguy cơ lũ quét hoặc ngập lụt cao. Tránh di chuyển.";
    } else if (precipitation > 10 && fallbackRisk === 'Low') {
      fallbackRisk = 'Medium';
      fallbackAdvice = isEnglish
        ? "Heavy rain, limit travel. Avoid low-lying areas."
        : "Mưa lớn, hạn chế di chuyển. Tránh các vùng trũng thấp.";
    }

    const aiErrorPrefix = isEnglish ? "Unable to connect to AI. " : "Không thể kết nối với AI. ";

    return res.status(200).json({
      risk: fallbackRisk,
      advice: aiErrorPrefix + fallbackAdvice,
      confidence,
      remainingRequests: rateLimit.remainingRequests
    });
  }
}
