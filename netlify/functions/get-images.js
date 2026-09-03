import cheerio from 'cheerio';

/**
 * Netlify Function: get-images
 * Scrapes art/gallery websites to extract image URLs
 * Returns a JSON array of image URLs or fallback demo images
 */
export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Fetch from art-focused sources
    const response = await fetch('https://www.wikiart.org/en/paintings/by-style/impressionism', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.wikiart.org/'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const images = [];

    // Look for painting thumbnails
    $('img[data-src], img[src]').each((i, elem) => {
      let src = $(elem).attr('data-src') || $(elem).attr('src');
      if (src && src.includes('wikiart')) {
        if (src.startsWith('//')) src = 'https:' + src;
        if (!images.includes(src) && src.match(/\.(jpg|jpeg|png|webp)/i)) {
          images.push(src);
        }
      }
    });

    // Fallback: regex scrape for wikiart images
    const regex = /https?:\/\/(?:\w+\.)?wikiart\.com[^\s"']+\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(regex);
    if (matches) {
      matches.forEach(img => {
        if (!images.includes(img)) images.push(img);
      });
    }

    const uniqueImages = [...new Set(images.filter(url => url && url.length > 10))];

    if (uniqueImages.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          images: getFallbackImages(),
          source: 'fallback',
          message: 'Using curated art placeholders'
        })
      };
    }

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

function getFallbackImages() {
  // Curated list of public domain art from various sources
  return [
    'https://picsum.photos/seed/vangogh1/800/600',
    'https://picsum.photos/seed/monet2/800/600',
    'https://picsum.photos/seed/picasso3/800/600',
    'https://picsum.photos/seed/dali4/800/600',
    'https://picsum.photos/seed/rembrandt5/800/600',
    'https://picsum.photos/seed/michelangelo6/800/600',
    'https://picsum.photos/seed/da Vinci7/800/600',
    'https://picsum.photos/seed/raphael8/800/600',
    'https://picsum.photos/seed/gauguin9/800/600',
    'https://picsum.photos/seed/cezanne10/800/600',
    'https://picsum.photos/seed/klimt11/800/600',
    'https://picsum.photos/seed/hopper12/800/600'
  ];
}
