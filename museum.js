/**
 * 3D Virtual Museum - Main Application
 * 
 * Creates an interactive 3D gallery where users can walk around
 * in first-person view and view artwork on the walls.
 * 
 * Features:
 * - First-person navigation with PointerLockControls
 * - WASD/Arrow keys for movement
 * - Mouse look around
 * - Dynamic image loading from Netlify Functions
 * - Framed artwork display on gallery walls
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

let camera, scene, renderer, controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Gallery configuration
const GALLERY_WIDTH = 40;
const GALLERY_HEIGHT = 8;
const GALLERY_DEPTH = 40;
const WALL_THICKNESS = 1;
const IMAGES_PER_ROOM = 6; // Max images per room before creating a new one
const ROOM_GAP = 5; // Gap between rooms

// Image data
let loadedImages = [];
let artworks = [];
let rooms = []; // Array to store room objects for multi-room gallery

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const clickToStart = document.getElementById('click-to-start');
const errorMessage = document.getElementById('error-message');

// ============================================================================
// INITIALIZATION
// ============================================================================

init();
animate();

/**
 * Initialize the 3D scene, camera, renderer, and controls
 */
async function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.7, 5); // Eye level height

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // Setup controls
  setupControls();

  // Create gallery structure with multiple rooms based on image count
  await loadImages();
  createMultiRoomGallery();

  // Setup lighting
  createLighting();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Hide loading screen
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
  }, 500);
}

/**
 * Setup pointer lock controls and event listeners
 */
function setupControls() {
  controls = new PointerLockControls(camera, document.body);

  // Click to start
  clickToStart.addEventListener('click', () => {
    controls.lock();
  });

  // Lock state changes
  controls.addEventListener('lock', () => {
    clickToStart.classList.add('hidden');
  });

  controls.addEventListener('unlock', () => {
    clickToStart.classList.remove('hidden');
  });

  // Keyboard controls
  const onKeyDown = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
    }
  };

  const onKeyUp = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

// ============================================================================
// GALLERY CONSTRUCTION
// ============================================================================

/**
 * Create the gallery room structure (floor, ceiling, walls)
 */
function createGallery() {
  // Materials
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d2d44,
    roughness: 0.8,
    metalness: 0.2
  });
  
  const ceilingMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a2e,
    roughness: 0.9
  });
  
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xf5f5dc,
    roughness: 0.9
  });

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(GALLERY_WIDTH + 4, GALLERY_DEPTH + 4);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(GALLERY_WIDTH + 4, GALLERY_DEPTH + 4);
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = GALLERY_HEIGHT;
  scene.add(ceiling);

  // Walls
  // Back wall
  const backWallGeometry = new THREE.BoxGeometry(GALLERY_WIDTH + 2, GALLERY_HEIGHT, WALL_THICKNESS);
  const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
  backWall.position.set(0, GALLERY_HEIGHT / 2, -GALLERY_DEPTH / 2 - WALL_THICKNESS / 2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Front wall (with opening)
  const frontWallLeftGeometry = new THREE.BoxGeometry(10, GALLERY_HEIGHT, WALL_THICKNESS);
  const frontWallLeft = new THREE.Mesh(frontWallLeftGeometry, wallMaterial);
  frontWallLeft.position.set(-15, GALLERY_HEIGHT / 2, GALLERY_DEPTH / 2 + WALL_THICKNESS / 2);
  scene.add(frontWallLeft);

  const frontWallRightGeometry = new THREE.BoxGeometry(10, GALLERY_HEIGHT, WALL_THICKNESS);
  const frontWallRight = new THREE.Mesh(frontWallRightGeometry, wallMaterial);
  frontWallRight.position.set(15, GALLERY_HEIGHT / 2, GALLERY_DEPTH / 2 + WALL_THICKNESS / 2);
  scene.add(frontWallRight);

  // Left wall
  const leftWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, GALLERY_HEIGHT, GALLERY_DEPTH);
  const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
  leftWall.position.set(-GALLERY_WIDTH / 2 - WALL_THICKNESS / 2, GALLERY_HEIGHT / 2, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, GALLERY_HEIGHT, GALLERY_DEPTH);
  const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
  rightWall.position.set(GALLERY_WIDTH / 2 + WALL_THICKNESS / 2, GALLERY_HEIGHT / 2, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Add baseboards
  createBaseboards(wallMaterial);
}

/**
 * Add decorative baseboards along the walls
 */
function createBaseboards(material) {
  const baseboardHeight = 0.3;
  const baseboardDepth = 0.2;
  
  const positions = [
    { x: 0, z: -GALLERY_DEPTH / 2, rot: 0, size: [GALLERY_WIDTH + 2, baseboardHeight, baseboardDepth] },
    { x: 0, z: GALLERY_DEPTH / 2, rot: 0, size: [GALLERY_WIDTH + 2, baseboardHeight, baseboardDepth] },
    { x: -GALLERY_WIDTH / 2, z: 0, rot: Math.PI / 2, size: [baseboardDepth, baseboardHeight, GALLERY_DEPTH] },
    { x: GALLERY_WIDTH / 2, z: 0, rot: Math.PI / 2, size: [baseboardDepth, baseboardHeight, GALLERY_DEPTH] }
  ];

  positions.forEach(pos => {
    const geometry = new THREE.BoxGeometry(...pos.size);
    const baseboard = new THREE.Mesh(geometry, material);
    baseboard.position.set(pos.x, baseboardHeight / 2, pos.z);
    baseboard.rotation.y = pos.rot;
    scene.add(baseboard);
  });
}

/**
 * Create ambient and directional lighting for the gallery
 */
function createLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light (simulating ceiling lights)
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(0, GALLERY_HEIGHT - 1, 0);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -25;
  mainLight.shadow.camera.right = 25;
  mainLight.shadow.camera.top = 25;
  mainLight.shadow.camera.bottom = -25;
  scene.add(mainLight);

  // Additional point lights for atmosphere
  const pointLightPositions = [
    { x: -15, z: -15 },
    { x: 15, z: -15 },
    { x: -15, z: 15 },
    { x: 15, z: 15 }
  ];

  pointLightPositions.forEach(pos => {
    const pointLight = new THREE.PointLight(0xffaa77, 0.3, 20);
    pointLight.position.set(pos.x, GALLERY_HEIGHT - 1, pos.z);
    scene.add(pointLight);
  });
}

// ============================================================================
// IMAGE LOADING AND ARTWORK CREATION
// ============================================================================

/**
 * Load images from the Netlify Function
 */
async function loadImages() {
  try {
    loadingProgress.textContent = 'Fetching images from server...';
    
    // Fetch images from the get-images function
    const response = await fetch('/.netlify/functions/get-images');
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const data = await response.json();
    loadedImages = data.images || [];
    
    loadingProgress.textContent = `Loading ${loadedImages.length} artworks...`;
    
    if (loadedImages.length === 0) {
      throw new Error('No images available');
    }
    
    // Proxy images through our CORS proxy and create artworks
    await createArtworks();
    
  } catch (error) {
    console.error('Error loading images:', error);
    showError(`Failed to load images: ${error.message}. Using fallback gallery.`);
    
    // Use fallback images
    loadedImages = [
      'https://picsum.photos/seed/art1/800/600',
      'https://picsum.photos/seed/art2/800/600',
      'https://picsum.photos/seed/art3/800/600',
      'https://picsum.photos/seed/art4/800/600',
      'https://picsum.photos/seed/art5/800/600',
      'https://picsum.photos/seed/art6/800/600'
    ];
    
    await createArtworks();
  }
}

/**
 * Create framed artworks on the gallery walls
 */
async function createArtworks() {
  const frameColor = 0x4a3728; // Dark wood color
  
  // Define wall positions for artwork placement
  const wallPositions = getWallPositions();
  
  let imageIndex = 0;
  
  for (const position of wallPositions) {
    if (imageIndex >= loadedImages.length) break;
    
    const imageUrl = loadedImages[imageIndex];
    
    try {
      // Proxy the image to get base64 data
      const proxiedImage = await proxyImage(imageUrl);
      
      // Create texture from proxied image
      const texture = await createTexture(proxiedImage.dataUrl);
      
      // Create the artwork with frame
      createArtworkWithFrame(texture, position, frameColor);
      
      imageIndex++;
      
      // Update progress
      loadingProgress.textContent = `Loaded ${imageIndex}/${loadedImages.length} artworks`;
      
    } catch (error) {
      console.error(`Failed to load image ${imageUrl}:`, error);
    }
  }
}

/**
 * Get predefined positions for artwork on walls
 */
function getWallPositions() {
  const positions = [];
  const artworkY = GALLERY_HEIGHT / 2;
  const spacing = 8;
  
  // Back wall (3 pieces)
  for (let i = -1; i <= 1; i++) {
    positions.push({
      x: i * spacing,
      y: artworkY,
      z: -GALLERY_DEPTH / 2 + 0.6,
      rotationY: 0
    });
  }
  
  // Left wall (3 pieces)
  for (let i = -1; i <= 1; i++) {
    positions.push({
      x: -GALLERY_WIDTH / 2 + 0.6,
      y: artworkY,
      z: i * spacing,
      rotationY: Math.PI / 2
    });
  }
  
  // Right wall (3 pieces)
  for (let i = -1; i <= 1; i++) {
    positions.push({
      x: GALLERY_WIDTH / 2 - 0.6,
      y: artworkY,
      z: i * spacing,
      rotationY: -Math.PI / 2
    });
  }
  
  return positions;
}

/**
 * Proxy an image through the Netlify Function to bypass CORS
 */
async function proxyImage(url) {
  const proxyUrl = `/.netlify/functions/proxy-image?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Proxy failed: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Create a Three.js texture from a data URL
 */
function createTexture(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    };
    
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Create a framed artwork at the specified position
 */
function createArtworkWithFrame(texture, position, frameColor) {
  // Calculate aspect ratio
  const imageWidth = 3;
  const imageHeight = (imageWidth * texture.image.height) / texture.image.width;
  
  // Frame dimensions
  const frameDepth = 0.1;
  const frameBorder = 0.15;
  
  // Create group to hold artwork
  const artworkGroup = new THREE.Group();
  
  // Canvas/Artwork
  const canvasGeometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
  const canvasMaterial = new THREE.MeshStandardMaterial({ 
    map: texture,
    roughness: 0.3,
    metalness: 0.1
  });
  const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
  canvas.position.z = frameDepth / 2;
  canvas.castShadow = true;
  artworkGroup.add(canvas);
  
  // Frame
  const frameGeometry = new THREE.BoxGeometry(
    imageWidth + frameBorder * 2,
    imageHeight + frameBorder * 2,
    frameDepth
  );
  
  // Create frame material with wood-like color
  const frameMaterial = new THREE.MeshStandardMaterial({ 
    color: frameColor,
    roughness: 0.7,
    metalness: 0.1
  });
  
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  
  // Use CSG-like approach: create frame by combining borders
  artworkGroup.remove(frame); // Remove solid box
  
  // Create frame borders
  const borderThickness = frameBorder;
  const borderDepth = frameDepth;
  
  // Top border
  const topBorder = new THREE.Mesh(
    new THREE.BoxGeometry(imageWidth + frameBorder, borderThickness, borderDepth),
    frameMaterial
  );
  topBorder.position.y = imageHeight / 2 + borderThickness / 2;
  topBorder.position.z = 0;
  artworkGroup.add(topBorder);
  
  // Bottom border
  const bottomBorder = new THREE.Mesh(
    new THREE.BoxGeometry(imageWidth + frameBorder, borderThickness, borderDepth),
    frameMaterial
  );
  bottomBorder.position.y = -imageHeight / 2 - borderThickness / 2;
  bottomBorder.position.z = 0;
  artworkGroup.add(bottomBorder);
  
  // Left border
  const leftBorder = new THREE.Mesh(
    new THREE.BoxGeometry(borderThickness, imageHeight, borderDepth),
    frameMaterial
  );
  leftBorder.position.x = -imageWidth / 2 - borderThickness / 2;
  leftBorder.position.z = 0;
  artworkGroup.add(leftBorder);
  
  // Right border
  const rightBorder = new THREE.Mesh(
    new THREE.BoxGeometry(borderThickness, imageHeight, borderDepth),
    frameMaterial
  );
  rightBorder.position.x = imageWidth / 2 + borderThickness / 2;
  rightBorder.position.z = 0;
  artworkGroup.add(rightBorder);
  
  // Position the artwork
  artworkGroup.position.set(position.x, position.y, position.z);
  artworkGroup.rotation.y = position.rotationY;
  
  // Add spotlight for the artwork
  const spotlight = new THREE.SpotLight(0xffffff, 0.5);
  spotlight.position.set(position.x, GALLERY_HEIGHT - 1, position.z + 2);
  spotlight.target = canvas;
  spotlight.angle = Math.PI / 6;
  spotlight.penumbra = 0.3;
  spotlight.castShadow = true;
  scene.add(spotlight);
  scene.add(spotlight.target);
  
  scene.add(artworkGroup);
  artworks.push(artworkGroup);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Show an error message to the user
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorMessage.classList.remove('visible');
  }, 5000);
}

/**
 * Handle window resize events
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

/**
 * Main animation loop
 */
function animate() {
  requestAnimationFrame(animate);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  if (controls.isLocked) {
    // Apply friction
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    
    // Calculate movement direction
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();
    
    // Apply movement
    if (moveForward || moveBackward) {
      velocity.z -= direction.z * 100.0 * delta;
    }
    if (moveLeft || moveRight) {
      velocity.x -= direction.x * 100.0 * delta;
    }
    
    // Move controls
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    
    // Boundary checking - keep player inside the gallery
    const boundaryX = GALLERY_WIDTH / 2 - 1;
    const boundaryZ = GALLERY_DEPTH / 2 - 1;
    
    if (camera.position.x < -boundaryX) camera.position.x = -boundaryX;
    if (camera.position.x > boundaryX) camera.position.x = boundaryX;
    if (camera.position.z < -boundaryZ) camera.position.z = -boundaryZ;
    if (camera.position.z > boundaryZ) camera.position.z = boundaryZ;
  }
  
  prevTime = time;
  renderer.render(scene, camera);
}
