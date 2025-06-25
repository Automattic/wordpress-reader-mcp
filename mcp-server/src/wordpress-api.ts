import fetch from 'node-fetch';

const WORDPRESS_API_BASE = 'https://public-api.wordpress.com/rest/v1.1';

export async function callWordPressAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  // Handle both v1.1 and v1.2 endpoints
  let url: string;
  if (endpoint.startsWith('/rest/v1.2/')) {
    url = `https://public-api.wordpress.com${endpoint}`;
  } else {
    url = `${WORDPRESS_API_BASE}${endpoint}`;
  }
  
  const options: any = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Cache for blog stickers to avoid repeated API calls
const blogStickersCache = new Map<string, { stickers: string[], timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

export async function checkBlogConfidentiality(
  siteIdOrDomain: string,
  token: string
): Promise<boolean> {
  // Check if confidentiality protection is disabled
  if (process.env.DISABLE_CONFIDENTIALITY_CHECK === 'true') {
    return true; // Allow access when protection is disabled
  }

  // Check cache first
  const cached = blogStickersCache.get(siteIdOrDomain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.stickers.includes('p2_confidentiality_disabled');
  }

  try {
    // Use v1 API endpoint for blog-stickers
    // siteIdOrDomain should be in format: subdomain.wordpress.com
    const url = `https://public-api.wordpress.com/rest/v1/sites/${siteIdOrDomain}/blog-stickers`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const response = await fetch(url, options);
    
    if (!response.ok) {
      // If we can't check the stickers, err on the side of caution
      return false;
    }

    const stickers = await response.json() as string[];
    
    // Cache the result
    blogStickersCache.set(siteIdOrDomain, {
      stickers: Array.isArray(stickers) ? stickers : [],
      timestamp: Date.now()
    });

    // Check if the blog has confidentiality disabled
    // If p2_confidentiality_disabled is present, the blog content CAN be used in AI
    // If the sticker is NOT present, the content should NOT be accessed by AI
    return stickers.includes('p2_confidentiality_disabled');
  } catch (error) {
    // If we can't check the stickers, err on the side of caution
    // and assume the content is confidential
    return false;
  }
}