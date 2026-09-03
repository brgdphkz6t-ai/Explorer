// ============================================================================
// 3D VIRTUAL MUSEUM - Three.js Implementation with Lazy Loading
// Features: First-person controls, multi-room gallery, CORS-bypassing image proxy
// ============================================================================

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================================================
// CONFIGURATION
// ============================================================================
const IMAGES_PER_ROOM = 6;
const ROOM_DEPTH = 10;
const GALLERY_WIDTH = 12;
const GALLERY_HEIGHT = 5;
const MOVE_SPEED = 80.0;
const MAX_IMAGES = 60; // Cap to prevent browser crashes

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false;
let moveLeft = false, moveRight = false;
let prevTime = performance.now();
let allImages = [];
let roomsGenerated = 0;
let isGenerating = false;

// DOM Elements
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const loadingScreen = document.getElementById('loadingScreen');
const loadingProgress = document.getElementById('loadingProgress');

// ============================================================================
// INITIALIZATION
// ============================================================================
init();
animate();

async function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  scene.fog = new THREE.Fog(0x1a1a1a, 0, 40);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = 1.6;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Controls
  controls = new PointerLockControls(camera, document.body);

  // Click to start
  document.addEventListener('click', () => {
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    if (blocker) blocker.style.display = 'none';
    if (instructions) instructions.style.display = 'none';
  });

  controls.addEventListener('unlock', () => {
    if (blocker) blocker.style.display = 'flex';
    if (instructions) instructions.style.display = 'flex';
  });

  // Keyboard controls
  const onKeyDown = (event) => {
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': moveForward = true; break;
      case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
      case 'ArrowDown': case 'KeyS': moveBackward = true; break;
      case 'ArrowRight': case 'KeyD': moveRight = true; break;
    }
  };

  const onKeyUp = (event) => {
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': moveForward = false; break;
      case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
      case 'ArrowDown': case 'KeyS': moveBackward = false; break;
      case 'ArrowRight': case 'KeyD': moveRight = false; break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Initial room lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // Load images and start generating rooms
  await loadImages();
}

// ============================================================================
// IMAGE LOADING
// ============================================================================
async function loadImages() {
  if (loadingProgress) loadingProgress.textContent = 'Fetching image URLs...';
  
  try {
    const response = await fetch('/.netlify/functions/get-images');
    const data = await response.json();
    
    if (data.success && data.images.length > 0) {
      allImages = data.images.slice(0, MAX_IMAGES);
      console.log(`Loaded ${allImages.length} images`);
      
      // Start generating rooms
      generateNextRoom();
    } else {
      throw new Error('No images returned');
    }
  } catch (error) {
    console.warn('Scraping failed, using fallback images:', error);
    // Fallback placeholder images
    allImages = Array.from({ length: 12 }, (_, i) => 
      `https://picsum.photos/seed/${i}/800/600`
    );
    generateNextRoom();
  }
}

// ============================================================================
// ROOM GENERATION (Lazy Loading)
// ============================================================================
async function generateNextRoom() {
  if (isGenerating) return;
  isGenerating = true;

  const startIndex = roomsGenerated * IMAGES_PER_ROOM;
  const roomImages = allImages.slice(startIndex, startIndex + IMAGES_PER_ROOM);

  if (roomImages.length === 0) {
    if (loadingScreen) loadingScreen.style.display = 'none';
    isGenerating = false;
    return;
  }

  if (loadingProgress && roomsGenerated === 0) {
    loadingProgress.textContent = `Generating room ${roomsGenerated + 1}... Walk forward for more!`;
  }

  const zOffset = -roomsGenerated * ROOM_DEPTH;
  await createRoomSegment(roomImages, zOffset);

  roomsGenerated++;
  
  if (loadingScreen && roomsGenerated === 1) {
    loadingScreen.style.display = 'none';
  }

  const totalRooms = Math.ceil(allImages.length / IMAGES_PER_ROOM);
  console.log(`Generated ${roomsGenerated}/${totalRooms} rooms`);
  
  isGenerating = false;

  // Pre-generate next room if more images available
  if (startIndex + IMAGES_PER_ROOM < allImages.length) {
    setTimeout(() => generateNextRoom(), 500);
  }
}

async function createRoomSegment(images, zOffset) {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a2a, roughness: 0.8, metalness: 0.2 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = zOffset - ROOM_DEPTH / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const ceilingMat = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a, roughness: 0.9 
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = GALLERY_HEIGHT;
  ceiling.position.z = zOffset - ROOM_DEPTH / 2;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset - ROOM_DEPTH / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 })
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset - ROOM_DEPTH / 2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Place images on walls
  const imagesPerSide = Math.ceil(images.length / 2);
  
  // Left wall images
  for (let i = 0; i < Math.min(imagesPerSide, images.length); i++) {
    const imgUrl = images[i];
    const zPos = zOffset - (ROOM_DEPTH / 2) + 2 + (i * (ROOM_DEPTH - 4) / Math.max(1, imagesPerSide - 1));
    await createFramedPicture(imgUrl, -GALLERY_WIDTH / 2 + 0.1, GALLERY_HEIGHT / 2, zPos, Math.PI / 2);
  }

  // Right wall images
  for (let i = 0; i < images.length - imagesPerSide; i++) {
    const imgUrl = images[imagesPerSide + i];
    const zPos = zOffset - (ROOM_DEPTH / 2) + 2 + (i * (ROOM_DEPTH - 4) / Math.max(1, images.length - imagesPerSide - 1));
    await createFramedPicture(imgUrl, GALLERY_WIDTH / 2 - 0.1, GALLERY_HEIGHT / 2, zPos, -Math.PI / 2);
  }
}

/**
 * Create a single framed picture with spotlight (async to handle CORS via proxy)
 */
async function createFramedPicture(imageUrl, x, y, z, rotationY) {
  let texture;
  
  try {
    // Fetch image via Netlify Function proxy to bypass CORS
    const proxyUrl = `/.netlify/functions/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    const response = await fetch(proxyUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.base64) {
        texture = new THREE.TextureLoader().load(data.base64);
      }
    }
    
    // Fallback if proxy fails
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Art', 256, 256);
      texture = new THREE.TextureLoader().load(canvas.toDataURL());
    }
    
    texture.colorSpace = THREE.SRGBColorSpace;
    const aspect = texture.image?.width / texture.image?.height || 1;
    const height = 2.5;
    const width = height * aspect;

    // Picture Mesh
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);

    // Frame
    const frameGeo = new THREE.BoxGeometry(width + 0.15, height + 0.15, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.03;
    mesh.add(frame);

    // Positioning
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;

    // Spotlight
    const spotLight = new THREE.SpotLight(0xffaa00, 2);
    spotLight.position.set(x, y + 2, z + 1);
    spotLight.target = mesh;
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;

    scene.add(mesh);
    scene.add(spotLight);
    scene.add(spotLight.target);

    return mesh;
  } catch (err) {
    console.warn('Error creating picture:', err);
    return null;
  }
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (controls.isLocked) {
    // Movement logic
    const actualSpeed = MOVE_SPEED * delta;
    
    if (moveForward) controls.moveForward(actualSpeed);
    if (moveBackward) controls.moveForward(-actualSpeed);
    if (moveRight) controls.moveRight(actualSpeed);
    if (moveLeft) controls.moveRight(-actualSpeed);

    // Auto-generate next room when approaching end
    const playerZ = camera.position.z;
    const lastRoomEnd = -(roomsGenerated * ROOM_DEPTH) + 5;
    
    if (playerZ < lastRoomEnd && !isGenerating) {
      generateNextRoom();
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
