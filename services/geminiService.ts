import { GoogleGenAI } from "@google/genai";
import { LocationData, RiskLevel, RouteInfo } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSafetyAdvice = async (
  data: LocationData
): Promise<{ risk: RiskLevel; advice: string }> => {
  const { elevation, precipitation, riverDischarge } = data;

  const prompt = `
    Phân tích dữ liệu rủi ro lũ lụt sau đây cho một địa điểm tại Việt Nam:
    - Độ cao: ${elevation !== null ? elevation + ' mét' : 'Không xác định'}
    - Lượng mưa hiện tại: ${precipitation} mm
    - Lưu lượng sông dự báo: ${riverDischarge} m3/s

    Bối cảnh: Người dùng đang kiểm tra thông tin này trong cơn bão tại Việt Nam. 
    - Độ cao thấp (<3m) rất nguy hiểm (ví dụ: Đồng bằng sông Cửu Long, sông Hồng, ven biển miền Trung).
    - Mưa lớn (>10mm) gây nguy cơ lũ quét ở vùng núi hoặc ngập lụt đô thị (Hà Nội, TP.HCM).

    Trả về phản hồi dạng JSON với:
    1. "risk": Một trong ["Low", "Medium", "High"] (giữ nguyên tiếng Anh cho mã máy).
    2. "advice": Một câu hướng dẫn an toàn ngắn gọn, trực tiếp bằng Tiếng Việt.

    Chỉ trả về JSON thô.
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
    return {
      risk: result.risk as RiskLevel || RiskLevel.UNKNOWN,
      advice: result.advice || "Hãy cảnh giác và theo dõi tin tức địa phương."
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback logic
    let fallbackRisk = RiskLevel.LOW;
    if (elevation !== null && elevation < 5) fallbackRisk = RiskLevel.MEDIUM;
    if (precipitation > 10 || riverDischarge > 50) fallbackRisk = RiskLevel.HIGH;
    
    return {
      risk: fallbackRisk,
      advice: "Không thể kết nối với AI. Vui lòng di chuyển lên vùng cao hơn nếu mưa lớn."
    };
  }
};

export const evaluateRouteSafety = async (
  start: LocationData,
  end: LocationData,
  routeInfo: RouteInfo
): Promise<{ risk: RiskLevel; advice: string }> => {
  const distanceKm = (routeInfo.distance / 1000).toFixed(1);
  const durationMin = Math.round(routeInfo.duration / 60);

  const prompt = `
    Người dùng muốn di chuyển từ A đến B tại Việt Nam trong điều kiện mưa bão.
    
    Thông tin hành trình:
    - Khoảng cách: ${distanceKm} km
    - Thời gian dự kiến: ${durationMin} phút
    
    Điểm xuất phát (A):
    - Độ cao: ${start.elevation ?? '?'}m, Mưa: ${start.precipitation}mm
    
    Điểm đến (B):
    - Độ cao: ${end.elevation ?? '?'}m, Mưa: ${end.precipitation}mm

    Hãy phân tích sự an toàn của việc di chuyển này. Nếu mưa lớn ở cả hai đầu hoặc một đầu có độ cao thấp, hãy cảnh báo.
    
    Trả về JSON:
    1. "risk": ["Low", "Medium", "High"]
    2. "advice": Lời khuyên ngắn gọn (tối đa 2 câu) về việc có nên đi hay không và cần chú ý gì (ví dụ: tránh vùng trũng, đi chậm).

    Chỉ trả về JSON thô.
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
    return {
      risk: result.risk as RiskLevel || RiskLevel.UNKNOWN,
      advice: result.advice || "Hãy lái xe cẩn thận và quan sát mực nước."
    };

  } catch (error) {
    return {
      risk: RiskLevel.MEDIUM,
      advice: "Hệ thống AI bận. Hãy lái xe cẩn thận và tránh các vùng trũng thấp ngập nước."
    };
  }
};