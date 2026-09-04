# 3D Virtual Museum V2 🏛️

An enhanced interactive 3D virtual museum with improved graphics, lighting, and performance. Walk through an endless gallery in first-person view and view artwork on the walls. Built with Three.js and deployed on Netlify using serverless functions.

## ✨ V2 Improvements

- **Enhanced Graphics**: Better materials, shadows, and lighting
- **Improved Performance**: Optimized texture management and rendering
- **Better Room Design**: Larger galleries with proper spotlights
- **Artwork Counter**: Track how many pieces you've viewed
- **Smoother Controls**: Refined movement physics
- **Elegant Frames**: Beveled wooden frames for each artwork
- **Configurable Settings**: Easy-to-adjust configuration object

## 🎮 Features

- **First-Person Navigation**: WASD or arrow keys to walk around
- **Mouse Look**: Free look with Pointer Lock API
- **Dynamic Image Loading**: Fetches art images via serverless functions
- **Procedural Gallery Rooms**: Endless rooms generated as you explore
- **Realistic Lighting**: Spotlights and ambient lighting
- **Responsive Design**: Adapts to any screen size
- **Fallback Gallery**: Beautiful placeholder images if scraping fails

## 🚀 Quick Start

### Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:8888` in your browser.

### Deploy to Netlify

**Option 1: GitHub + Netlify (Recommended)**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/museum-v2.git
git push -u origin main
```

Then connect your repo on [netlify.com](https://netlify.com).

**Option 2: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## 📁 File Structure

```
/
├── index.html                 # Main page with UI overlays
├── museum.js                  # Three.js 3D scene and logic
├── package.json               # Dependencies
├── netlify.toml              # Netlify configuration
└── netlify/functions/
    ├── get-images.js         # Scrapes art image URLs
    └── proxy-image.js        # CORS proxy for textures
```

## 🎯 Controls

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A / ← | Strafe left |
| D / → | Strafe right |
| Mouse | Look around |
| ESC | Release cursor |

## ⚙️ Configuration

Edit the `CONFIG` object in `museum.js`:

```javascript
const CONFIG = {
  ROOM_WIDTH: 50,           // Gallery width
  ROOM_HEIGHT: 18,          // Ceiling height
  ROOM_DEPTH: 50,           // Room depth
  PICS_PER_ROOM: 6,         // Artworks per room
  MAX_ACTIVE_TEXTURES: 12,  // Memory limit
  MOVE_SPEED: 80,           // Walk speed
  FOG_DENSITY: 0.02         // Atmosphere density
};
```

## 🔧 Technical Stack

- **Three.js r0.160** - 3D WebGL rendering
- **PointerLockControls** - FPS camera controls
- **Netlify Functions** - Serverless backend
- **Cheerio** - HTML parsing for scraping
- **Import Maps** - CDN module loading (no bundler)

## 📝 Notes

- Images are fetched from art websites or fallback to curated placeholders
- The proxy function converts images to base64 to avoid CORS issues
- Old textures are automatically disposed to prevent memory leaks
- Works best in modern browsers (Chrome, Firefox, Edge)

## 📄 License

MIT License - Feel free to use and modify!
