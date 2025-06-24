import fetch from 'node-fetch';

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3000';

export async function validateToken(token: string): Promise<{
  valid: boolean;
  wordpress_token?: string;
  user_info?: any;
}> {
  try {
    const response = await fetch(`${AUTH_SERVER_URL}/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json() as any;
    return data;
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false };
  }
}