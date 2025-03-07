const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('memory-cache');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Cache duration in milliseconds (30 minutes)
const CACHE_DURATION = 30 * 60 * 1000;

// Base URL for freek.to
const BASE_URL = 'https://freek.to';

// Main welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FreekTo TV API',
    endpoints: ["/trending", "/search?q=query", "/video/:id"]
  });
});

// Trending movies endpoint
app.get('/trending', async (req, res) => {
  try {
    // Check if we have cached data
    const cachedData = cache.get('trending');
    if (cachedData) {
      console.log('Returning cached trending data');
      return res.json({ movies: cachedData });
    }
    
    console.log('Fetching trending movies from', BASE_URL);
    
    // Define headers to make the request look like it's coming from a browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
    
    // Fetch the HTML of the homepage
    const response = await axios.get(BASE_URL, {
      headers: headers,
      timeout: 15000, // 15 second timeout
      responseType: 'document'
    });
    
    const html = response.data;
    console.log('Successfully fetched homepage HTML, length:', html.length);
    
    // Log first 500 characters of HTML to see what we're dealing with
    console.log('HTML preview:', html.substring(0, 500));
    
    const $ = cheerio.load(html);
    
    const trendingMovies = [];
    
    // Log the structure to understand the DOM
    console.log('Analyzing page structure...');
    
    // Extract trending movies from the homepage
    // Try multiple selectors to find movie items
    const selectors = [
      '.movies-list .movie-item', '.grid-items .movie', '.movies-grid .movie', 
      '.movie-container', '[class*="movie"]', '[class*="film"]',
      'article', '.card', '.thumbnail', '.movie-card', '.item'
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
          const titleSelectors = ['.title', 'h3', 'h2', '.name', '[class*="title"]', 'a[title]', '.movie-title', 'a'];
          let title = null;
          
          for (const titleSelector of titleSelectors) {
            const titleEl = $el.find(titleSelector).first();
            if (titleEl.length > 0) {
              title = titleEl.attr('title') || titleEl.text().trim();
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
          const imgSelectors = ['img', '.poster', '.thumbnail', '.cover', '[class*="poster"]', '[class*="image"]', '.img'];
          
          for (const imgSelector of imgSelectors) {
            const imgEl = $el.find(imgSelector).first();
            if (imgEl.length > 0) {
              image = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original');
              
              if (!image) {
                const style = imgEl.attr('style');
                if (style && style.includes('url(')) {
                  const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
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
              const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
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
            
            // Limit title length to avoid unnecessarily long titles
            if (title.length > 100) {
              title = title.substring(0, 97) + '...';
            }
            
            // Clean the title (remove excessive whitespace)
            title = title.replace(/\s+/g, ' ').trim();
            
            trendingMovies.push({
              title,
              link,
              image
            });
            
            console.log(`Found movie: ${title}`);
          }
        });
        
        // If we found enough movies, break out of the selector loop
        if (trendingMovies.length >= 5) {
          break;
        }
      }
    }
    
    // If no movies were found with specific selectors, try a more generic approach
    if (trendingMovies.length === 0) {
      console.log('No movies found with primary selectors, trying alternative approach');
      
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
                     $el.prev().find('img').attr('src');
          
          // If no image found, use a placeholder
          if (!image) {
            image = 'https://via.placeholder.com/300x450?text=No+Image';
          } else if (!image.startsWith('http')) {
            image = BASE_URL + (image.startsWith('/') ? image : '/' + image);
          }
          
          trendingMovies.push({
            title,
            link,
            image
          });
          
          console.log(`Found movie with alternative method: ${title}`);
        }
      });
    }
    
    // If still no movies found, fall back to mock data
    if (trendingMovies.length === 0) {
      console.log('Scraping failed, falling back to mock data');
      const mockMovies = [
        {
          title: "Inception",
          link: `${BASE_URL}/movie/inception-2010`,
          image: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg"
        },
        {
          title: "The Dark Knight",
          link: `${BASE_URL}/movie/the-dark-knight-2008`,
          image: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg"
        },
        {
          title: "Pulp Fiction",
          link: `${BASE_URL}/movie/pulp-fiction-1994`,
          image: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
        },
        {
          title: "The Godfather",
          link: `${BASE_URL}/movie/the-godfather-1972`,
          image: "https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
        },
        {
          title: "Fight Club",
          link: `${BASE_URL}/movie/fight-club-1999`,
          image: "https://m.media-amazon.com/images/M/MV5BMmEzNTkxYjQtZTc0MC00YTVjLTg5ZTEtZWMwOWVlYzY0NWIwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
        }
      ];
      
      // Cache the mock data
      cache.put('trending', mockMovies, CACHE_DURATION);
      
      return res.json({ movies: mockMovies });
    }
    
    // Limit to 20 movies
    const limitedMovies = trendingMovies.slice(0, 20);
    
    console.log(`Successfully scraped ${limitedMovies.length} movies`);
    
    // Log details of first movie for debugging
    if (limitedMovies.length > 0) {
      console.log('First movie details:', JSON.stringify(limitedMovies[0], null, 2));
    }
    
    // Cache the results
    cache.put('trending', limitedMovies, CACHE_DURATION);
    
    res.json({ movies: limitedMovies });
  } catch (error) {
    console.error('Error fetching trending movies:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    // Fall back to mock data on error
    const mockMovies = [
      {
        title: "Inception",
        link: `${BASE_URL}/movie/inception-2010`,
        image: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg"
      },
      {
        title: "The Dark Knight",
        link: `${BASE_URL}/movie/the-dark-knight-2008`,
        image: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg"
      },
      {
        title: "Pulp Fiction",
        link: `${BASE_URL}/movie/pulp-fiction-1994`,
        image: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
      },
      {
        title: "The Godfather",
        link: `${BASE_URL}/movie/the-godfather-1972`,
        image: "https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
      },
      {
        title: "Fight Club",
        link: `${BASE_URL}/movie/fight-club-1999`,
        image: "https://m.media-amazon.com/images/M/MV5BMmEzNTkxYjQtZTc0MC00YTVjLTg5ZTEtZWMwOWVlYzY0NWIwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
      }
    ];
    
    // Cache the mock data
    cache.put('trending', mockMovies, CACHE_DURATION);
    
    res.json({ movies: mockMovies });
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Referer': BASE_URL
    };
    
    // Fetch the HTML of the movie page
    const response = await axios.get(movieUrl, {
      headers: headers,
      timeout: 20000 // 20 second timeout
    });
    
    const html = response.data;
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Referer': BASE_URL
    };

    // Fetch search results
    const response = await axios.get(searchUrl, {
      headers: headers,
      timeout: 10000 // 10 second timeout
    });

    const html = response.data;
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
