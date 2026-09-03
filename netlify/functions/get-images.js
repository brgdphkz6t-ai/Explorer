import cheerio from 'cheerio';

/**
 * Netlify Function: get-images
 * Scrapes erome.com/explore/new to extract image URLs
 * Returns a JSON array of image URLs or fallback demo images
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
  
  try {
    // Fetch the explore/new page with proper headers to avoid bot detection
    const response = await fetch('https://www.erome.com/explore/new', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.erome.com/'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch erome.com: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const images = [];
    
    // Strategy 1: Look for album/video thumbnails in the explore grid
    $('.album-img img, .video-thumb img, .thumb img, .media-grid img').each((i, elem) => {
      let src = $(elem).attr('data-src') || $(elem).attr('src');
      if (src) {
        let fullUrl = normalizeUrl(src);
        
        // Filter for actual content images (exclude UI elements)
        if (isValidContentImage(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });
    
    // Strategy 2: Look for lazy-loaded images with data-src attribute anywhere on page
    $('img[data-src]').each((i, elem) => {
      let src = $(elem).attr('data-src');
      if (src) {
        let fullUrl = normalizeUrl(src);
        
        // Filter for actual content images
        if (isValidContentImage(fullUrl) && !images.includes(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });
    
    // Strategy 3: Look for regular img src attributes
    $('img[src]').each((i, elem) => {
      let src = $(elem).attr('src');
      if (src) {
        let fullUrl = normalizeUrl(src);
        
        // Filter for actual content images
        if (isValidContentImage(fullUrl) && !images.includes(fullUrl)) {
          images.push(fullUrl);
        }
      }
    });

    // Remove duplicates while preserving order
    const uniqueImages = [...new Set(images.filter(url => url && url.length > 10))];

    console.log(`Found ${uniqueImages.length} unique images`);

    // If no images found, return fallback demo gallery
    if (uniqueImages.length === 0) {
      console.log('No images scraped, returning fallback gallery');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          images: getFallbackImages(),
          source: 'fallback',
          message: 'Scraping returned no results, using placeholder images'
        })
      };
    }

    // Return up to 24 images (enough for gallery walls)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        images: uniqueImages.slice(0, 24),
        source: 'scraped',
        count: Math.min(uniqueImages.length, 24)
      })
    };

  } catch (error) {
    console.error('Scraping error:', error.message);
    
    // Return fallback images on error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        images: getFallbackImages(),
        source: 'fallback',
        error: error.message
      })
    };
  }
}

/**
 * Normalize URL to absolute HTTPS format
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  let fullUrl = url.trim();
  
  // Handle different URL formats
  if (fullUrl.startsWith('//')) {
    fullUrl = 'https:' + fullUrl;
  } else if (fullUrl.startsWith('/')) {
    fullUrl = 'https://www.erome.com' + fullUrl;
  } else if (fullUrl.startsWith('http://')) {
    fullUrl = fullUrl.replace('http://', 'https://');
  }
  
  return fullUrl;
}

/**
 * Validate if URL is a valid content image (not UI element)
 */
function isValidContentImage(url) {
  if (!url || !url.startsWith('https://')) return false;
  
  // Exclude UI elements
  const excludePatterns = [
    'logo', 'icon', 'avatar', 'default', 'placeholder',
    'blank', 'spacer', 'loading', 'spinner', 'ad-', 'banner',
    '/assets/', '/static/', '/js/', '/css/'
  ];
  
  for (const pattern of excludePatterns) {
    if (url.toLowerCase().includes(pattern)) return false;
  }
  
  // Be permissive for erome.com images - include all images from their CDN
  if (url.includes('erome.com') && !url.includes('/assets/')) return true;
  
  // Include only actual image files or known image hosts
  const includePatterns = [
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i,
    '/img/', '/media/', '/uploads/', '/content/',
    'i.imgur.com', 'cdn.', 'image.', 'pic.'
  ];
  
  for (const pattern of includePatterns) {
    if (typeof pattern === 'string' && url.includes(pattern)) return true;
    if (pattern instanceof RegExp && pattern.test(url)) return true;
  }
  
  return false;
}

/**
 * Returns a set of fallback demo images (public domain / placeholder art)
 * Used when scraping fails or is blocked
 */
function getFallbackImages() {
  return [
    'https://picsum.photos/seed/museum1/800/600',
    'https://picsum.photos/seed/museum2/800/600',
    'https://picsum.photos/seed/museum3/800/600',
    'https://picsum.photos/seed/museum4/800/600',
    'https://picsum.photos/seed/museum5/800/600',
    'https://picsum.photos/seed/museum6/800/600',
    'https://picsum.photos/seed/museum7/800/600',
    'https://picsum.photos/seed/museum8/800/600',
    'https://picsum.photos/seed/museum9/800/600',
    'https://picsum.photos/seed/museum10/800/600',
    'https://picsum.photos/seed/museum11/800/600',
    'https://picsum.photos/seed/museum12/800/600'
  ];
}
