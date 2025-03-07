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

// Sample movie data (replace with actual scraping logic for production)
const sampleMovies = [
  {
    title: "The Shawshank Redemption",
    link: "https://example.com/movies/shawshank-redemption",
    image: "https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_.jpg"
  },
  {
    title: "The Godfather",
    link: "https://example.com/movies/godfather",
    image: "https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
  },
  {
    title: "The Dark Knight",
    link: "https://example.com/movies/dark-knight",
    image: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg"
  },
  {
    title: "Pulp Fiction",
    link: "https://example.com/movies/pulp-fiction",
    image: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_.jpg"
  },
  {
    title: "The Lord of the Rings",
    link: "https://example.com/movies/lord-of-the-rings",
    image: "https://m.media-amazon.com/images/M/MV5BN2EyZjM3NzUtNWUzMi00MTgxLWI0NTctMzY4M2VlOTdjZWRiXkEyXkFqcGdeQXVyNDUzOTQ5MjY@._V1_.jpg"
  },
  {
    title: "Inception",
    link: "https://example.com/movies/inception",
    image: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg"
  }
];

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FreekTo TV API',
    endpoints: [
      '/trending',
      '/search?q=query'
    ]
  });
});

// Trending movies endpoint
app.get('/trending', (req, res) => {
  // Check if we have cached data
  const cachedData = cache.get('trending');
  if (cachedData) {
    console.log('Returning cached trending data');
    return res.json({ trending: cachedData });
  }

  // In a real implementation, you would scrape freek.to here
  // For now, we'll use sample data
  
  // Cache the results
  cache.put('trending', sampleMovies, CACHE_DURATION);
  
  res.json({ trending: sampleMovies });
});

// Search endpoint
app.get('/search', (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  // In a real implementation, you would search freek.to here
  // For now, we'll filter our sample data
  const results = sampleMovies.filter(movie => 
    movie.title.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json({ results });
});

// Video URL endpoint - in a real implementation, this would extract the actual video URL
app.get('/video/:id', (req, res) => {
  // This would normally extract the video URL from the movie page
  // For now, return a sample video URL
  res.json({
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
