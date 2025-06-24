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