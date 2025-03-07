const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('memory-cache');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const BASE_URL = 'https://freek.to';

// Additional user agents to rotate through
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
];

// Function to get a random user agent
function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[randomIndex];
}

// Function to create browser-like headers with a random user agent
function getBrowserHeaders(referer = 'https://www.google.com/') {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer,
    'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'dnt': '1',
    'Pragma': 'no-cache'
  };
}

// Function to handle scraping with retries and delay
async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add a random delay between attempts
      if (attempt > 0) {
        const jitter = Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        delay *= 1.5; // Exponential backoff
      }
      
      // If not first attempt, get a new random user agent
      if (attempt > 0 && options.headers) {
        options.headers['User-Agent'] = getRandomUserAgent();
      }
      
      console.log(`Attempt ${attempt + 1}/${maxRetries} for URL: ${url}`);
      const response = await axios(url, options);
      return response.data;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // If we get a 403 or 429, it's likely we're being rate limited or blocked
      if (error.response && (error.response.status === 403 || error.response.status === 429)) {
        console.log('Rate limited or blocked. Increasing delay...');
        delay *= 2; // Further increase delay on rate limiting
      }
    }
  }
  
  // All retries failed
  throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${lastError.message}`);
}

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FreekTo TV API',
    endpoints: ["/trending", "/search?q=query", "/video/:id"]
  });
});

// Trending movies endpoint
app.get('/trending', async (req, res) => {
  try {
    // Check cache first
    const cachedData = cache.get('trending');
    if (cachedData) {
      console.log('Returning cached trending data');
      return res.json(cachedData);
    }
    
    console.log('Fetching trending movies from', BASE_URL);
    
    // Enhanced headers to better mimic a real browser
    const headers = getBrowserHeaders();
    
    // Multiple scraping approaches to bypass protection
    let html;
    let response;
    let scrapedMovies = [];
    
    // First attempt: Direct scraping with enhanced setup
    try {
      console.log('Attempting advanced direct scraping approach...');
      
      // Use a randomized delay to appear more human-like
      const randomDelay = Math.floor(Math.random() * 1000) + 500;
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Use a more complete browser fingerprint
      const cookieJar = {};
      const enhancedHeaders = {
        ...headers,
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua': '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"'
      };
      
      // Try to get the main page with a timeout
      response = await fetchWithRetry(BASE_URL, {
        headers: enhancedHeaders,
        timeout: 30000,
        withCredentials: true
      }, 5, 2000);
      
      html = response;
      console.log(`Successfully fetched HTML, length: ${html.length}`);
      
      // Parse with cheerio
      const $ = cheerio.load(html);
      
      // Multiple selectors to try different approaches
      const selectors = [
        '.movies-list .movie-item', // Common structure
        '.trending-movies .movie',   // Alternative structure
        '.movie-card',               // Another possibility
        '.content .movie',           // Generic approach
        'div[data-movie-id]',        // Data attribute approach
        '.movie-grid > div'          // Grid-based layout
      ];
      
      // Try each selector strategy
      for (const selector of selectors) {
        console.log(`Trying selector: ${selector}`);
        const elements = $(selector);
        
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector ${selector}`);
          
          elements.each((i, el) => {
            // Only take first 10 movies
            if (i >= 10) return false;
            
            const element = $(el);
            
            // Try multiple approaches to extract data
            const title = element.find('h3').text().trim() || 
                          element.find('.title').text().trim() || 
                          element.find('strong').text().trim() || 
                          element.attr('title') || 
                          element.find('img').attr('alt') || 
                          'Unknown';
                          
            // Try to find link - could be on the element itself or a child
            let link = element.attr('href') || 
                       element.find('a').attr('href') || 
                       element.parent('a').attr('href');
                       
            // Make sure link is absolute
            if (link && !link.startsWith('http')) {
              link = `${BASE_URL}${link.startsWith('/') ? '' : '/'}${link}`;
            } else if (!link) {
              link = `${BASE_URL}/movie/unknown-${i}`;
            }
            
            // Try to find image - check for both src and data-src (lazy loading)
            let image = element.find('img').attr('data-src') || 
                        element.find('img').attr('src') || 
                        element.find('.poster').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                        
            // Make sure image is absolute
            if (image && !image.startsWith('http')) {
              image = `${BASE_URL}${image.startsWith('/') ? '' : '/'}${image}`;
            } else if (!image) {
              image = 'https://via.placeholder.com/300x450/141414/e50914?text=FreekTo';
            }
            
            // Add the movie to our results if it's not a duplicate
            if (title !== 'Unknown' && !scrapedMovies.some(m => m.title === title)) {
              scrapedMovies.push({ title, link, image });
            }
          });
          
          if (scrapedMovies.length > 0) {
            console.log(`Successfully scraped ${scrapedMovies.length} movies using selector ${selector}`);
            break;
          }
        }
      }
      
      // Look for embedded JSON data in script tags (modern sites often use this)
      if (scrapedMovies.length === 0) {
        console.log('Trying to extract data from embedded JSON...');
        const scriptTags = $('script').toArray();
        
        for (const script of scriptTags) {
          const content = $(script).html();
          if (!content) continue;
          
          // Look for JSON data patterns
          try {
            // Try to find JSON objects that might contain movies data
            const jsonMatches = content.match(/(\{.*?\}\}|\[.*?\])/g);
            if (jsonMatches) {
              for (const jsonStr of jsonMatches) {
                try {
                  const data = JSON.parse(jsonStr);
                  
                  // Look for arrays that might contain movies
                  if (Array.isArray(data)) {
                    if (data.length > 0 && data[0] && (data[0].title || data[0].name)) {
                      console.log('Found movie array in script tag');
                      
                      data.slice(0, 10).forEach(item => {
                        const title = item.title || item.name || 'Unknown';
                        const link = item.url || item.link || `${BASE_URL}/movie/${title.toLowerCase().replace(/\s+/g, '-')}`;
                        const image = item.image || item.poster || item.thumbnail || 'https://via.placeholder.com/300x450/141414/e50914?text=FreekTo';
                        
                        if (title !== 'Unknown' && !scrapedMovies.some(m => m.title === title)) {
                          scrapedMovies.push({ title, link, image });
                        }
                      });
                      
                      if (scrapedMovies.length > 0) break;
                    }
                  } 
                  // Look for objects that might contain movie lists
                  else if (data && typeof data === 'object') {
                    // Common patterns for movie data
                    const possibleArrays = ['movies', 'items', 'results', 'data', 'trending', 'featured'];
                    
                    for (const key of possibleArrays) {
                      if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
                        console.log(`Found ${key} array in script tag JSON`);
                        
                        data[key].slice(0, 10).forEach(item => {
                          if (!item) return;
                          
                          const title = item.title || item.name || 'Unknown';
                          const link = item.url || item.link || `${BASE_URL}/movie/${title.toLowerCase().replace(/\s+/g, '-')}`;
                          const image = item.image || item.poster || item.thumbnail || 'https://via.placeholder.com/300x450/141414/e50914?text=FreekTo';
                          
                          if (title !== 'Unknown' && !scrapedMovies.some(m => m.title === title)) {
                            scrapedMovies.push({ title, link, image });
                          }
                        });
                        
                        if (scrapedMovies.length > 0) break;
                      }
                    }
                    
                    if (scrapedMovies.length > 0) break;
                  }
                } catch (e) {
                  // Ignore JSON parsing errors
                }
              }
            }
          } catch (e) {
            console.log('Error parsing script content:', e.message);
          }
        }
      }
    } catch (err) {
      console.error('Advanced direct scraping failed:', err.message);
    }
    
    // Second attempt: Try the /trending or /popular endpoint directly
    if (scrapedMovies.length === 0) {
      try {
        console.log('Trying direct access to trending/popular endpoint...');
        
        // Try common endpoints for trending content
        const possibleEndpoints = [
          `${BASE_URL}/trending`, 
          `${BASE_URL}/popular`,
          `${BASE_URL}/top`,
          `${BASE_URL}/movies/trending`,
          `${BASE_URL}/movies/popular`
        ];
        
        // Try each endpoint
        for (const endpoint of possibleEndpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);
            
            // Use different user agent for each attempt
            const newHeaders = getBrowserHeaders('https://www.google.com/search?q=best+movies+to+watch');
            
            response = await fetchWithRetry(endpoint, {
              headers: newHeaders,
              timeout: 20000
            }, 3, 1500);
            
            html = response;
            console.log(`Successfully fetched ${endpoint}, HTML length: ${html.length}`);
            
            // Parse with cheerio
            const $ = cheerio.load(html);
            
            // Look for movie items with multiple selectors
            const selectors = [
              '.movie-item', '.movie-card', '.movie', 'div[data-movie-id]',
              '.poster-container', '.film-poster', '.content > div'
            ];
            
            // Try each selector
            for (const selector of selectors) {
              const elements = $(selector);
              
              if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with selector ${selector} on ${endpoint}`);
                
                elements.each((i, el) => {
                  if (i >= 10) return false;
                  
                  const element = $(el);
                  
                  const title = element.find('h3').text().trim() || 
                                element.find('.title').text().trim() || 
                                element.find('strong').text().trim() || 
                                element.attr('title') || 
                                element.find('img').attr('alt') || 
                                'Unknown';
                                
                  let link = element.attr('href') || 
                             element.find('a').attr('href') || 
                             element.parent('a').attr('href');
                             
                  if (link && !link.startsWith('http')) {
                    link = `${BASE_URL}${link.startsWith('/') ? '' : '/'}${link}`;
                  } else if (!link) {
                    link = `${BASE_URL}/movie/unknown-${i}`;
                  }
                  
                  let image = element.find('img').attr('data-src') || 
                              element.find('img').attr('src') || 
                              element.find('.poster').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                              
                  if (image && !image.startsWith('http')) {
                    image = `${BASE_URL}${image.startsWith('/') ? '' : '/'}${image}`;
                  } else if (!image) {
                    image = 'https://via.placeholder.com/300x450/141414/e50914?text=FreekTo';
                  }
                  
                  if (title !== 'Unknown' && !scrapedMovies.some(m => m.title === title)) {
                    scrapedMovies.push({ title, link, image });
                  }
                });
                
                if (scrapedMovies.length > 0) {
                  console.log(`Successfully scraped ${scrapedMovies.length} movies from ${endpoint}`);
                  break;
                }
              }
            }
            
            if (scrapedMovies.length > 0) break;
          } catch (error) {
            console.log(`Failed to fetch ${endpoint}: ${error.message}`);
          }
        }
      } catch (err) {
        console.error('Trending/popular endpoint approach failed:', err.message);
      }
    }
    
    // If we have successfully scraped movies, return them
    if (scrapedMovies.length > 0) {
      console.log(`Successfully scraped ${scrapedMovies.length} trending movies`);
      
      // Store in cache
      const dataToCache = { movies: scrapedMovies };
      cache.put('trending', dataToCache, CACHE_DURATION);
      
      return res.json(dataToCache);
    }
    
    // If all scraping approaches failed, fall back to mock data
    console.warn('All scraping approaches failed, falling back to mock data');
    
    // Mock trending movies data
    const movies = [
      {
        title: "The Shawshank Redemption",
        link: "https://freek.to/movie/the-shawshank-redemption-1994",
        image: "https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_.jpg"
      },
      {
        title: "The Godfather",
        link: "https://freek.to/movie/the-godfather-1972",
        image: "https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
      },
      {
        title: "The Dark Knight",
        link: "https://freek.to/movie/the-dark-knight-2008",
        image: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg"
      },
      {
        title: "Pulp Fiction",
        link: "https://freek.to/movie/pulp-fiction-1994",
        image: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
      },
      {
        title: "Inception",
        link: "https://freek.to/movie/inception-2010",
        image: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg"
      }
    ];
    
    const mockData = { movies };
    
    // Cache the mock data too
    cache.put('trending', mockData, CACHE_DURATION);
    
    res.json(mockData);
  } catch (error) {
    console.error('Error in trending endpoint:', error);
    
    // Return a friendly error
    res.status(500).json({
      error: 'Failed to fetch trending movies',
      message: error.message
    });
  }
});

// Video URL extraction endpoint
app.get('/video/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    
    // Check if we have cached data
    const cachedData = cache.get(`video_${movieId}`);
    if (cachedData) {
      console.log(`Returning cached video URL for ${movieId}`);
      return res.json(cachedData);
    }
    
    console.log(`Fetching video URL for ${movieId} from ${BASE_URL}`);
    
    // Construct the movie URL
    let movieUrl;
    if (movieId.includes('http')) {
      // If the ID is already a full URL, use it directly
      movieUrl = movieId;
    } else {
      movieUrl = BASE_URL + (movieId.startsWith('/') ? movieId : '/' + movieId);
    }
    
    console.log(`Constructed movie URL: ${movieUrl}`);
    
    // Define headers to make the request look like it's coming from a browser
    const headers = getBrowserHeaders();
    
    // Fetch the HTML of the movie page
    const html = await fetchWithRetry(movieUrl, {
      headers: headers,
      timeout: 20000 // 20 second timeout
    });
    
    console.log(`Successfully fetched movie page HTML, length: ${html.length}`);
    
    // Log first 500 characters of HTML to see what we're dealing with
    console.log('HTML preview:', html.substring(0, 500));
    
    const $ = cheerio.load(html);
    
    // Log the structure to understand the DOM
    console.log('Analyzing movie page structure...');
    
    // Try different selectors to find the video URL
    const videoSelectors = [
      'video source', 
      'video[src]',
      'iframe[src*="player"]',
      'iframe[src*="embed"]',
      'iframe[src*="video"]',
      'iframe',
      'video'
    ];
    
    let videoUrl = null;
    
    // First try to find direct video sources
    for (const selector of videoSelectors) {
      console.log(`Trying video selector: ${selector}`);
      const elements = $(selector);
      
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector ${selector}`);
        
        elements.each((i, element) => {
          if (videoUrl) return; // Already found a URL
          
          const $el = $(element);
          
          if (selector.includes('source')) {
            videoUrl = $el.attr('src');
            console.log(`Found source with src: ${videoUrl}`);
          } else if (selector.includes('video[src]')) {
            videoUrl = $el.attr('src');
            console.log(`Found video with src: ${videoUrl}`);
          } else if (selector.includes('iframe')) {
            const src = $el.attr('src');
            console.log(`Found iframe with src: ${src}`);
            if (src && (src.includes('.mp4') || src.includes('.m3u8') || src.includes('player') || src.includes('embed'))) {
              videoUrl = src;
            }
          }
        });
        
        if (videoUrl) {
          console.log(`Found video URL via selector ${selector}: ${videoUrl}`);
          break;
        }
      }
    }
    
    // If no direct video source found, look for iframes that might contain players
    if (!videoUrl) {
      console.log('No direct video source found, checking for player iframes');
      
      const iframes = $('iframe');
      if (iframes.length > 0) {
        console.log(`Found ${iframes.length} iframes`);
        
        // Check each iframe for potential video sources
        for (let i = 0; i < iframes.length; i++) {
          const src = $(iframes[i]).attr('src');
          if (src) {
            console.log(`Checking iframe source: ${src}`);
            
            // If it looks like a video player, use it
            if (src.includes('player') || src.includes('embed') || src.includes('video')) {
              videoUrl = src;
              console.log(`Found likely player iframe: ${videoUrl}`);
              break;
            }
          }
        }
      }
    }
    
    // If still no video URL found, look for JavaScript variables that might contain the URL
    if (!videoUrl) {
      console.log('No iframe player found, checking for JavaScript variables');
      
      const scriptTags = $('script');
      let scriptContent = '';
      
      scriptTags.each((i, script) => {
        scriptContent += $(script).html() || '';
      });
      
      // Log script content length for debugging
      console.log(`Examining ${scriptTags.length} script tags with total length: ${scriptContent.length}`);
      
      // Look for common patterns in JavaScript that might contain video URLs
      const patterns = [
        /source\s*:\s*['"]([^'"]+\.mp4)['"]/i,
        /file\s*:\s*['"]([^'"]+\.mp4)['"]/i,
        /url\s*:\s*['"]([^'"]+\.mp4)['"]/i,
        /src\s*:\s*['"]([^'"]+\.mp4)['"]/i,
        /source\s*:\s*['"]([^'"]+\.m3u8)['"]/i,
        /file\s*:\s*['"]([^'"]+\.m3u8)['"]/i,
        /url\s*:\s*['"]([^'"]+\.m3u8)['"]/i,
        /src\s*:\s*['"]([^'"]+\.m3u8)['"]/i,
        /player\.src\(\s*{\s*src\s*:\s*['"]([^'"]+)['"]/i,
        /videoSrc\s*=\s*['"]([^'"]+)['"]/i,
        /videoUrl\s*=\s*['"]([^'"]+)['"]/i,
        /var\s+src\s*=\s*['"]([^'"]+\.mp4)['"]/i,
        /var\s+src\s*=\s*['"]([^'"]+\.m3u8)['"]/i,
        /const\s+src\s*=\s*['"]([^'"]+\.mp4)['"]/i,
        /const\s+src\s*=\s*['"]([^'"]+\.m3u8)['"]/i,
        /"file"\s*:\s*"([^"]+\.(mp4|m3u8))"/i,
        /'file'\s*:\s*'([^']+\.(mp4|m3u8))'/i
      ];
      
      for (const pattern of patterns) {
        const match = scriptContent.match(pattern);
        if (match && match[1]) {
          videoUrl = match[1];
          console.log(`Found video URL in script via pattern ${pattern}: ${videoUrl}`);
          break;
        }
      }
    }
    
    // If still no video URL found, try to find any links to mp4 or m3u8 files
    if (!videoUrl) {
      console.log('No JavaScript variables found, checking for direct links');
      
      $('a').each((i, element) => {
        if (videoUrl) return; // Already found a URL
        
        const href = $(element).attr('href');
        if (href && (href.includes('.mp4') || href.includes('.m3u8'))) {
          videoUrl = href;
          console.log(`Found direct video link: ${videoUrl}`);
        }
      });
    }
    
    // If we found a video URL, ensure it has a full URL
    if (videoUrl && !videoUrl.startsWith('http')) {
      const originalUrl = videoUrl;
      videoUrl = videoUrl.startsWith('//') 
        ? 'https:' + videoUrl
        : BASE_URL + (videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl);
      console.log(`Converted relative URL: ${originalUrl} -> ${videoUrl}`);
    }
    
    // If no video URL found, fall back to mock data
    if (!videoUrl) {
      console.log('No video URL found, using mock data');
      
      // Mock video URL for testing
      const mockData = {
        title: "Sample Movie",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        backdropUrl: "https://via.placeholder.com/1280x720?text=Sample+Movie+Backdrop"
      };
      
      // Cache the mock data
      cache.put(`video_${movieId}`, mockData, CACHE_DURATION);
      
      return res.json(mockData);
    }
    
    // Try to get the movie title for the response
    let title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                'Unknown Movie';
                
    // Get backdrop image if available
    let backdropUrl = $('meta[property="og:image"]').attr('content') || 
                     $('.backdrop img').attr('src') || 
                     $('img.backdrop').attr('src') || 
                     null;
                     
    if (backdropUrl && !backdropUrl.startsWith('http')) {
      backdropUrl = BASE_URL + (backdropUrl.startsWith('/') ? backdropUrl : '/' + backdropUrl);
    }
    
    // Prepare response data
    const responseData = {
      title: title,
      videoUrl: videoUrl,
      backdropUrl: backdropUrl
    };
    
    // Cache the result
    cache.put(`video_${movieId}`, responseData, CACHE_DURATION);
    
    console.log(`Successfully extracted video URL: ${videoUrl}`);
    res.json(responseData);
  } catch (error) {
    console.error('Error extracting video URL:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    // Fall back to mock data on error
    const mockData = {
      title: "Sample Movie",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      backdropUrl: "https://via.placeholder.com/1280x720?text=Sample+Movie+Backdrop"
    };
    
    // Cache the mock data
    cache.put(`video_${movieId}`, mockData, CACHE_DURATION);
    
    res.json(mockData);
  }
});

// Search endpoint
app.get('/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    // Check if we have cached data for this search query
    const cacheKey = `search_${query}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached search results for "${query}"`);
      return res.json({ results: cachedData });
    }

    console.log(`Performing search for "${query}" on ${BASE_URL}`);

    // Construct search URL
    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    // Define headers to make the request look like it's coming from a browser
    const headers = getBrowserHeaders();
    
    // Fetch search results
    const html = await fetchWithRetry(searchUrl, {
      headers: headers,
      timeout: 10000 // 10 second timeout
    });

    console.log(`Successfully fetched search results HTML, length: ${html.length}`);

    const $ = cheerio.load(html);

    // Log the structure to understand the DOM
    console.log('Analyzing search results page structure...');

    const searchResults = [];

    // Try multiple selectors to find search result items
    const selectors = [
      '.search-result', '.movie-item', '.result-item', '.item', 
      '.search-item', '.movie-box', '.movie-container', 
      '[class*="search"]', '[class*="result"]', '[class*="movie"]',
      'article', '.card', '.thumbnail'
    ];

    let foundElements = false;

    for (const selector of selectors) {
      console.log(`Trying selector: ${selector}`);
      const elements = $(selector);

      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector ${selector}`);
        foundElements = true;

        elements.each((i, element) => {
          const $el = $(element);

          // Try different selectors for title
          const titleSelectors = ['.title', 'h3', 'h2', '.name', '[class*="title"]', 'a[title]', '.movie-title'];
          let title = null;

          for (const titleSelector of titleSelectors) {
            const titleEl = $el.find(titleSelector).first();
            if (titleEl.length > 0) {
              title = titleEl.text().trim();
              if (title) break;
            }
          }

          // If no title found, try the element's own title attribute or text
          if (!title) {
            title = $el.attr('title') || $el.text().trim();
          }

          // Try different selectors for link
          let link = null;
          const linkEl = $el.find('a').first();
          if (linkEl.length > 0) {
            link = linkEl.attr('href');
          } else if ($el.is('a')) {
            link = $el.attr('href');
          }

          // Ensure link has full URL
          if (link && !link.startsWith('http')) {
            link = BASE_URL + (link.startsWith('/') ? link : '/' + link);
          }

          // Try different selectors for image
          let image = null;
          const imgSelectors = ['img', '.poster', '.thumbnail', '.cover', '[class*="poster"]', '[class*="image"]'];

          for (const imgSelector of imgSelectors) {
            const imgEl = $el.find(imgSelector).first();
            if (imgEl.length > 0) {
              image = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original');

              if (!image) {
                const style = imgEl.attr('style');
                if (style && style.includes('url(')) {
                  const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
                  if (match && match[1]) {
                    image = match[1];
                  }
                }
              }

              if (image) break;
            }
          }

          // If still no image, check for background image in style
          if (!image) {
            const style = $el.attr('style');
            if (style && style.includes('url(')) {
              const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
              if (match && match[1]) {
                image = match[1];
              }
            }
          }

          // Ensure image has full URL
          if (image && !image.startsWith('http')) {
            image = BASE_URL + (image.startsWith('/') ? image : '/' + image);
          }

          // Only add items that have all required data
          if (title && link) {
            // If no image found, use a placeholder
            if (!image) {
              image = 'https://via.placeholder.com/300x450?text=No+Image';
            }

            searchResults.push({
              title,
              link,
              image
            });
          }
        });

        // If we found enough results, break out of the selector loop
        if (searchResults.length >= 5) {
          break;
        }
      }
    }

    // If no results were found with specific selectors, try a more generic approach
    if (searchResults.length === 0) {
      console.log('No results found with primary selectors, trying alternative approach');

      // Try to find any movie-like elements
      $('a').each((i, element) => {
        const $el = $(element);
        const href = $el.attr('href');

        // Check if this link might be a movie
        if (href && (href.includes('/movie/') || href.includes('/watch/') || href.includes('/film/'))) {
          const title = $el.text().trim() || $el.attr('title') || 'Unknown Title';
          let link = href;
          if (!link.startsWith('http')) {
            link = BASE_URL + (link.startsWith('/') ? link : '/' + link);
          }

          // Look for an image near this link
          let image = $el.find('img').attr('src') || 
                     $el.parent().find('img').attr('src') ||
                     $el.closest('div').find('img').attr('src');

          // If no image found, use a placeholder
          if (!image) {
            image = 'https://via.placeholder.com/300x450?text=No+Image';
          } else if (!image.startsWith('http')) {
            image = BASE_URL + (image.startsWith('/') ? image : '/' + image);
          }

          searchResults.push({
            title,
            link,
            image
          });
        }
      });
    }

    // If still no results found, fall back to mock data
    if (searchResults.length === 0) {
      console.log('Scraping failed, falling back to mock data');

      // Generate mock results based on the search query
      const mockResults = [
        {
          title: `${query} - Movie 1`,
          link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-1`,
          image: "https://via.placeholder.com/300x450?text=Search+Result+1"
        },
        {
          title: `${query} - Movie 2`,
          link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-2`,
          image: "https://via.placeholder.com/300x450?text=Search+Result+2"
        },
        {
          title: `${query} - Movie 3`,
          link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-3`,
          image: "https://via.placeholder.com/300x450?text=Search+Result+3"
        }
      ];

      // Cache the mock results
      cache.put(cacheKey, mockResults, CACHE_DURATION);

      return res.json({ results: mockResults });
    }

    console.log(`Successfully scraped ${searchResults.length} search results`);

    // Cache the results
    cache.put(cacheKey, searchResults, CACHE_DURATION);

    res.json({ results: searchResults });
  } catch (error) {
    console.error('Error performing search:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }

    // Fall back to mock data on error
    const mockResults = [
      {
        title: `${query} - Movie 1`,
        link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-1`,
        image: "https://via.placeholder.com/300x450?text=Search+Result+1"
      },
      {
        title: `${query} - Movie 2`,
        link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-2`,
        image: "https://via.placeholder.com/300x450?text=Search+Result+2"
      },
      {
        title: `${query} - Movie 3`,
        link: `https://example.com/movies/${query.toLowerCase().replace(/\s+/g, '-')}-3`,
        image: "https://via.placeholder.com/300x450?text=Search+Result+3"
      }
    ];

    // Cache the mock results
    cache.put(cacheKey, mockResults, CACHE_DURATION);

    res.json({ results: mockResults });
  }
});

// Add a proxy endpoint to forward requests to freek.to
app.get('/proxy/*', async (req, res) => {
  try {
    const originalUrl = req.originalUrl.replace('/proxy/', '');
    const targetUrl = `${BASE_URL}/${originalUrl}`;
    
    console.log(`Proxying request to: ${targetUrl}`);
    
    // Enhanced headers to better mimic a real browser
    const headers = getBrowserHeaders(BASE_URL);
    
    // Make the proxied request
    const response = await fetchWithRetry(targetUrl, {
      headers: headers,
      timeout: 30000
    }, 3, 1000);
    
    // Return the proxied response
    res.send(response);
  } catch (error) {
    console.error('Error in proxy endpoint:', error);
    res.status(500).json({
      error: 'Failed to proxy request',
      message: error.message
    });
  }
});

// Video embed endpoint to handle direct embedding
app.get('/embed/:id', (req, res) => {
  const videoId = req.params.id;
  
  // Send a simple HTML page that will load the video from our /video/:id endpoint
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FreekTo TV Player</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background-color: #000;
          overflow: hidden;
        }
        #video-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        video {
          max-width: 100%;
          max-height: 100%;
          width: 100%;
          height: 100%;
        }
        .loading {
          color: white;
          font-family: Arial, sans-serif;
          text-align: center;
        }
        .error {
          color: red;
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <div id="video-container">
        <div class="loading">Loading video...</div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', async () => {
          const videoContainer = document.getElementById('video-container');
          const videoId = '${videoId}';
          
          try {
            // Fetch the video URL from our API
            const response = await fetch('/video/' + videoId);
            const data = await response.json();
            
            if (data.videoUrl) {
              // Create video element
              const video = document.createElement('video');
              video.controls = true;
              video.autoplay = true;
              video.src = data.videoUrl;
              
              // Replace loading with video
              videoContainer.innerHTML = '';
              videoContainer.appendChild(video);
            } else {
              videoContainer.innerHTML = '<div class="error">Video not available</div>';
            }
          } catch (error) {
            videoContainer.innerHTML = '<div class="error">Error loading video: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
