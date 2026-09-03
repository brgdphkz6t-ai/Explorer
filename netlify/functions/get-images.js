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
    'Access-Control-Allow-Headers': 'Content-Type',
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.erome.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const images = [];
    
    // Extract image URLs from the page using multiple strategies
    // Strategy 1: Look for album thumbnails and content images
    $('img[data-src], img[src]').each((i, elem) => {
      const src = $(elem).attr('data-src') || $(elem).attr('src');
      if (src) {
        let fullUrl = src;
        
        // Handle different URL formats
        if (src.startsWith('//')) {
          fullUrl = 'https:' + src;
        } else if (src.startsWith('/')) {
          fullUrl = 'https://www.erome.com' + src;
        }
        
        // Filter for actual content images
        if (fullUrl.startsWith('https://') && 
            !fullUrl.includes('logo') && 
            !fullUrl.includes('icon') && 
            !fullUrl.includes('avatar') &&
            !fullUrl.includes('default') &&
            (fullUrl.includes('/img/') || 
             fullUrl.includes('/media/') ||
             fullUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i))) {
          images.push(fullUrl);
        }
      }
    });
    
    // Strategy 2: Look for video/image links in anchor tags
    $('a[href*="/a/"], a[href*="/album/"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && !href.startsWith('#')) {
        const fullUrl = href.startsWith('/') ? 'https://www.erome.com' + href : href;
        // Try to get preview images from these albums
        const imgSrc = $(elem).find('img[data-src], img[src]').first().attr('data-src') || $(elem).find('img').first().attr('src');
        if (imgSrc) {
          let imgUrl = imgSrc;
          if (imgSrc.startsWith('//')) {
            imgUrl = 'https:' + imgSrc;
          } else if (imgSrc.startsWith('/')) {
            imgUrl = 'https://www.erome.com' + imgSrc;
          }
          if (imgUrl.startsWith('https://') && !images.includes(imgUrl)) {
            images.push(imgUrl);
          }
        }
      }
    });

    // Remove duplicates
    const uniqueImages = [...new Set(images)];

    // If no images found, return fallback demo gallery
    if (uniqueImages.length === 0) {
      console.log('No images scraped, returning fallback gallery');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          images: getFallbackImages(),
          source: 'fallback'
        })
      };
    }

    // Return up to 20 images
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        images: uniqueImages.slice(0, 20),
        source: 'scraped'
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
