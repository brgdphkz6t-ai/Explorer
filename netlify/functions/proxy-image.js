/**
 * Netlify Function: proxy-image
 * Proxies external images to bypass CORS restrictions
 * Converts images to base64 for seamless Three.js texture loading
 */
export async function handler(event, context) {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Get the image URL from query parameters
  const url = event.queryStringParameters?.url;
  
  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing "url" query parameter' })
    };
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid URL format' })
    };
  }
  
  try {
    // Fetch the image with proper headers to avoid bot detection
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.erome.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Get the content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Convert the image to ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Create data URL
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        dataUrl,
        contentType,
        originalUrl: url,
        size: arrayBuffer.byteLength
      })
    };
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to proxy image',
        message: error.message 
      })
    };
  }
}
