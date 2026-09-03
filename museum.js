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
const MAX_IMAGES = 60;
const MAX_ACTIVE_TEXTURES = 10;

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

// Texture management to prevent GPU crashes
const activeTextures = new Set();
const textureLoadQueue = [];
let isProcessingQueue = false;

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
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  scene.fog = new THREE.Fog(0x1a1a1a, 0, 40);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = 1.6;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);

  document.addEventListener('click', () => controls.lock());

  controls.addEventListener('lock', () => {
    if (blocker) blocker.style.display = 'none';
    if (instructions) instructions.style.display = 'none';
  });

  controls.addEventListener('unlock', () => {
    if (blocker) blocker.style.display = 'flex';
    if (instructions) instructions.style.display = 'flex';
  });

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

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

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
    const images = data.images || [];

    if (images.length > 0) {
      allImages = images.slice(0, MAX_IMAGES);
      console.log(`Fetched ${allImages.length} image URLs`);
      generateNextRoom();
    } else {
      throw new Error('No images returned');
    }
  } catch (error) {
    console.warn('Scraping failed, using fallback:', error.message);
    allImages = Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/museum${i}/800/600`);
    generateNextRoom();
  }
}

// ============================================================================
// TEXTURE QUEUE SYSTEM (Prevents GPU crashes)
// ============================================================================
async function loadTextureWithQueue(imageUrl) {
  return new Promise((resolve) => {
    textureLoadQueue.push({ url: imageUrl, resolve });
    processTextureQueue();
  });
}

async function processTextureQueue() {
  if (isProcessingQueue || textureLoadQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (textureLoadQueue.length > 0 && activeTextures.size < MAX_ACTIVE_TEXTURES) {
    const { url, resolve } = textureLoadQueue.shift();
    
    try {
      const proxyUrl = `/.netlify/functions/proxy-image?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      let texture = null;
      
      if (response.ok) {
        const data = await response.json();
        if (data.base64) {
          const loader = new THREE.TextureLoader();
          texture = loader.load(data.base64);
          texture.colorSpace = THREE.SRGBColorSpace;
          activeTextures.add(texture);
        }
      }
      
      resolve(texture);
    } catch (err) {
      console.warn('Texture load failed:', url);
      resolve(null);
    }
  }
  
  isProcessingQueue = false;
}

function disposeOldTextures(count) {
  const toDispose = Array.from(activeTextures).slice(0, count);
  toDispose.forEach(tex => {
    tex.dispose();
    activeTextures.delete(tex);
  });
}

// ============================================================================
// ROOM GENERATION
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
    loadingProgress.textContent = `Generating room ${roomsGenerated + 1}...`;
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

  if (startIndex + IMAGES_PER_ROOM < allImages.length) {
    setTimeout(() => generateNextRoom(), 500);
  }
}

async function createRoomSegment(images, zOffset) {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = zOffset - ROOM_DEPTH / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const ceiling = new THREE.Mesh(ceilingGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = GALLERY_HEIGHT;
  ceiling.position.z = zOffset - ROOM_DEPTH / 2;
  scene.add(ceiling);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset - ROOM_DEPTH / 2);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset - ROOM_DEPTH / 2);
  scene.add(rightWall);

  // Dispose old textures if we have too many
  if (activeTextures.size > MAX_ACTIVE_TEXTURES + 5) {
    disposeOldTextures(6);
  }

  // Place images
  const halfLen = Math.ceil(images.length / 2);
  for (let i = 0; i < Math.min(halfLen, images.length); i++) {
    const zPos = zOffset - (ROOM_DEPTH / 2) + 2 + (i * (ROOM_DEPTH - 4) / Math.max(1, halfLen - 1));
    await createFramedPicture(images[i], -GALLERY_WIDTH / 2 + 0.1, GALLERY_HEIGHT / 2, zPos, Math.PI / 2);
  }
  for (let i = 0; i < images.length - halfLen; i++) {
    const zPos = zOffset - (ROOM_DEPTH / 2) + 2 + (i * (ROOM_DEPTH - 4) / Math.max(1, images.length - halfLen - 1));
    await createFramedPicture(images[halfLen + i], GALLERY_WIDTH / 2 - 0.1, GALLERY_HEIGHT / 2, zPos, -Math.PI / 2);
  }
}

async function createFramedPicture(imageUrl, x, y, z, rotationY) {
  let texture = await loadTextureWithQueue(imageUrl);

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
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const aspect = texture.image?.width / texture.image?.height || 1;
  const height = 2.5;
  const width = height * aspect;

  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);

  const frameGeo = new THREE.BoxGeometry(width + 0.15, height + 0.15, 0.05);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.z = -0.03;
  mesh.add(frame);

  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;

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
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (controls.isLocked) {
    const actualSpeed = MOVE_SPEED * delta;

    if (moveForward) controls.moveForward(actualSpeed);
    if (moveBackward) controls.moveForward(-actualSpeed);
    if (moveRight) controls.moveRight(actualSpeed);
    if (moveLeft) controls.moveRight(-actualSpeed);

    const playerZ = camera.position.z;
    const lastRoomEnd = -(roomsGenerated * ROOM_DEPTH) + 5;

    if (playerZ < lastRoomEnd && !isGenerating) {
      generateNextRoom();
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
