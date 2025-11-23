import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting storage (in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per window
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

interface WeatherWarning {
  title: string;
  url: string;
  date: string;
  severity: 'emergency' | 'high' | 'medium';
}

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
    const response = await fetch('https://www.nchmf.gov.vn', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DuongAnToan/1.0)'
      }
    });

    if (!response.ok) {
      console.error('NCHMF fetch failed:', response.status);
      return res.status(200).json([]); // Return empty array on failure
    }

    const html = await response.text();
    const warnings: WeatherWarning[] = [];

    // Parse warnings from the HTML
    // Look for patterns like: <a href="..." alt="TIN ...">TIN ...<label>(...)</label>
    const warningRegex = /<a[^>]+href="([^"]+)"[^>]+alt="([^"]+)"[^>]*>([^<]+)<label>\(([^)]+)\)<\/label>/gi;
    let match;

    while ((match = warningRegex.exec(html)) && warnings.length < 5) {
      // Sanitize extracted HTML content to prevent XSS
      const rawTitle = match[2] || match[3];
      const title = rawTitle
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      const url = match[1].startsWith('http') ? match[1] : `https://www.nchmf.gov.vn${match[1]}`;
      const date = match[4].trim();

      // Determine severity based on keywords
      let severity: 'emergency' | 'high' | 'medium' = 'medium';
      const upperTitle = title.toUpperCase();
      if (upperTitle.includes('KHẨN CẤP') || upperTitle.includes('ĐẶC BIỆT')) {
        severity = 'emergency';
      } else if (upperTitle.includes('QUAN TRỌNG') || upperTitle.includes('CẢNH BÁO')) {
        severity = 'high';
      }

      warnings.push({ title, url, date, severity });
    }

    // Cache for 10 minutes
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json(warnings);
  } catch (error) {
    console.error('Error proxying NCHMF warnings:', error);
    return res.status(200).json([]); // Return empty array on error
  }
}
