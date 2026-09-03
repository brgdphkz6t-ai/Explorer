# 3D Virtual Museum

An interactive 3D virtual museum where users can walk around in first-person view and view artwork on gallery walls. Built with Three.js and deployed on Netlify using serverless functions.

## 🏛️ Features

- **First-Person Navigation**: Walk around the gallery using WASD or arrow keys
- **Mouse Look**: Look around freely with mouse controls (Pointer Lock API)
- **Dynamic Image Loading**: Fetches images from external sources via serverless functions
- **Framed Artwork**: Images displayed as framed paintings with proper lighting
- **Responsive Design**: Adapts to different screen sizes
- **Fallback Gallery**: Uses placeholder images if scraping fails

## 📁 File Structure

```
/
├── index.html                 # Main HTML page with UI overlays
├── museum.js                  # Three.js 3D scene and controls
├── package.json               # Node.js dependencies
├── netlify.toml              # Netlify build configuration
└── netlify/
    └── functions/
        ├── get-images.js      # Scrapes images from external source
        └── proxy-image.js     # CORS proxy for external images
```

## 🚀 Deployment Instructions

### Option 1: Deploy via GitHub (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/3d-virtual-museum.git
   git push -u origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select your repository
   - Netlify will auto-detect the settings from `netlify.toml`

3. **Deploy**
   - Click "Deploy site"
   - Wait for the build to complete
   - Your site will be live at `https://your-site-name.netlify.app`

### Option 2: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Option 3: Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start local development server**
   ```bash
   npm run dev
   ```

3. **Open browser**
   Navigate to `http://localhost:8888`

## 🎮 Controls

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A / ← | Strafe left |
| D / → | Strafe right |
| Mouse | Look around |
| ESC | Release mouse cursor |

## ⚙️ Technical Details

### Frontend
- **Three.js r0.160** - 3D graphics library
- **PointerLockControls** - First-person camera controls
- **Import Maps** - CDN-based module loading (no bundler needed)

### Backend (Netlify Functions)
- **get-images.js** - Scrapes image URLs using Cheerio
  - Uses proper User-Agent headers to avoid bot detection
  - Returns fallback images if scraping fails
  - Handles CORS with appropriate headers
  
- **proxy-image.js** - Proxies external images
  - Converts images to base64 data URLs
  - Bypasses CORS restrictions for Three.js textures
  - Supports all common image formats

### CORS Handling
The application handles CORS in two ways:
1. Server-side scraping avoids browser CORS entirely
2. Image proxy converts external images to base64 data URLs

## ⚠️ Important Notes

### Potential Issues with External Sources

1. **Cloudflare Protection**: The target website (erome.com) uses Cloudflare which may block automated requests. If scraping fails, the site automatically falls back to placeholder images from Picsum Photos.

2. **Rate Limiting**: Be mindful of request rates when deploying publicly. Consider adding caching or rate limiting for production use.

3. **Copyright**: Ensure you have rights to display any scraped images. The fallback gallery uses public domain / Creative Commons images.

### Customization

- **Change Image Source**: Modify the URL in `netlify/functions/get-images.js`
- **Gallery Size**: Adjust `GALLERY_WIDTH`, `GALLERY_HEIGHT`, `GALLERY_DEPTH` in `museum.js`
- **Artwork Count**: Modify `getWallPositions()` function in `museum.js`
- **Frame Color**: Change `frameColor` in `createArtworks()` function

## 📝 License

This project is provided as-is for educational purposes.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!