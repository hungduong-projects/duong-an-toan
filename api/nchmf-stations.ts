import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

// Rate limiting storage (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

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

  clientData.count += 1;
  return { allowed: true, remainingRequests: RATE_LIMIT - clientData.count };
}

// NCHMF Station validation schema
const NCHMFStationSchema = z.object({
  id: z.number(),
  commune_name: z.string(),
  district_name: z.string(),
  provinceName: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  luongmuatd: z.number().nullable(),
  luongmuadb: z.number(),
  nguycoluquet: z.enum(['Thấp', 'Trung bình', 'Cao']),
  nguycosatlo: z.enum(['Thấp', 'Trung bình', 'Cao'])
}).passthrough(); // Allow extra fields

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const { allowed, remainingRequests } = checkRateLimit(clientIP);
  res.setHeader('X-RateLimit-Remaining', remainingRequests.toString());

  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    // Use current date rounded to nearest hour
    const queryDate = new Date();
    queryDate.setMinutes(0, 0, 0);

    // Format date as YYYY-MM-DD HH:mm:ss (required by API)
    const dateStr = queryDate.toISOString().slice(0, 19).replace('T', ' ');

    // Prepare form data
    const formData = new URLSearchParams({
      sogiodubao: '6', // 6-hour forecast
      date: dateStr
    });

    const response = await fetch('https://luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (compatible; DuongAnToan/1.0)'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error('NCHMF stations fetch failed:', response.status);
      return res.status(200).json([]); // Return empty array on failure
    }

    const data = await response.json();

    // Validate each station against schema
    try {
      const validatedStations = z.array(NCHMFStationSchema).parse(data);
      // Cache for 5 minutes
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      return res.status(200).json(validatedStations);
    } catch (validationError) {
      console.error('NCHMF stations validation failed:', validationError);
      // Try to salvage valid stations
      if (Array.isArray(data)) {
        const validStations = data.filter((station: any) => {
          try {
            NCHMFStationSchema.parse(station);
            return true;
          } catch {
            return false;
          }
        });
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(validStations);
      }
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error('Error proxying NCHMF stations:', error);
    return res.status(200).json([]); // Return empty array on error
  }
}
