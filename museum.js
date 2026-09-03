/**
 * 3D Virtual Museum - Main Application with Lazy Loading
 * 
 * Creates an interactive 3D gallery where users can walk around
 * in first-person view and view artwork on the walls.
 * 
 * Features:
 * - First-person navigation with PointerLockControls
 * - WASD/Arrow keys for movement
 * - Mouse look around
 * - Dynamic image loading from Netlify Functions
 * - LAZY LOADING: Rooms generated as you walk
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
const GALLERY_WIDTH = 12;
const GALLERY_HEIGHT = 5;
const ROOM_DEPTH = 10;
const IMAGES_PER_ROOM = 6;

// Lazy loading state
let allImages = [];
let roomsCreated = 0;
let isGenerating = false;
let isLoadingComplete = false;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const clickToStart = document.getElementById('click-to-start');

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
  scene.background = new THREE.Color(0x1a1a1a);
  scene.fog = new THREE.Fog(0x1a1a1a, 0, 40);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.7, 5);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Setup controls
  setupControls();

  // Setup lighting
  createLighting();

  // Load images and start lazy generation
  await loadImages();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

/**
 * Setup pointer lock controls and event listeners
 */
function setupControls() {
  controls = new PointerLockControls(camera, document.body);

  // Click to start overlay
  if (clickToStart) {
    clickToStart.addEventListener('click', () => {
      controls.lock();
    });
  } else {
    document.addEventListener('click', () => {
      controls.lock();
    });
  }

  // Lock state changes
  controls.addEventListener('lock', () => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (clickToStart) clickToStart.classList.add('hidden');
  });

  controls.addEventListener('unlock', () => {
    // Optionally show a pause menu here
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
// LIGHTING
// ============================================================================

/**
 * Create ambient and directional lighting for the gallery
 */
function createLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(0, GALLERY_HEIGHT - 1, 0);
  mainLight.castShadow = true;
  scene.add(mainLight);
}

// ============================================================================
// IMAGE LOADING AND LAZY ROOM GENERATION
// ============================================================================

/**
 * Load images from the Netlify Function
 */
async function loadImages() {
  try {
    if (loadingProgress) loadingProgress.textContent = 'Fetching images from server...';
    
    const response = await fetch('/.netlify/functions/get-images');
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const data = await response.json();
    allImages = data.images || [];
    
    // Cap at 100 images for performance
    if (allImages.length > 100) {
      allImages = allImages.slice(0, 100);
    }
    
    if (loadingProgress) loadingProgress.textContent = `Found ${allImages.length} images. Generating gallery...`;
    
    if (allImages.length === 0) {
      throw new Error('No images available');
    }
    
    // Start lazy loading - generate first 2 rooms immediately
    await generateNextRoom();
    await generateNextRoom();
    
    // Update UI
    setTimeout(() => {
      if (loadingScreen) loadingScreen.style.opacity = '0.5';
      if (loadingProgress) loadingProgress.textContent = 'Walk forward to generate more rooms';
    }, 1000);
    
    isLoadingComplete = true;
    
  } catch (error) {
    console.error('Error loading images:', error);
    if (loadingProgress) loadingProgress.textContent = 'Failed to load images. Using demo gallery...';
    
    // Use fallback images
    allImages = [
      'https://picsum.photos/seed/art1/800/600',
      'https://picsum.photos/seed/art2/800/600',
      'https://picsum.photos/seed/art3/800/600',
      'https://picsum.photos/seed/art4/800/600',
      'https://picsum.photos/seed/art5/800/600',
      'https://picsum.photos/seed/art6/800/600'
    ];
    
    await generateNextRoom();
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (clickToStart) clickToStart.classList.add('hidden');
    isLoadingComplete = true;
  }
}

/**
 * Generate the next room segment (lazy loading)
 */
async function generateNextRoom() {
  if (isGenerating || roomsCreated * IMAGES_PER_ROOM >= allImages.length) {
    return;
  }

  isGenerating = true;
  
  const startIdx = roomsCreated * IMAGES_PER_ROOM;
  const roomImages = allImages.slice(startIdx, startIdx + IMAGES_PER_ROOM);
  
  if (roomImages.length === 0) {
    isGenerating = false;
    return;
  }

  const zPosition = -(roomsCreated * ROOM_DEPTH);
  
  await createRoomSegment(zPosition, roomImages);
  
  roomsCreated++;
  isGenerating = false;

  // Update loading text
  const totalRooms = Math.ceil(allImages.length / IMAGES_PER_ROOM);
  if (roomsCreated >= totalRooms) {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (clickToStart) clickToStart.classList.add('hidden');
  } else {
    if (loadingProgress) loadingProgress.textContent = `Generated ${roomsCreated}/${totalRooms} rooms. Walk forward for more.`;
  }
}

/**
 * Create a single room segment with artworks
 */
async function createRoomSegment(zOffset, images) {
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xeeeeee, 
    roughness: 0.5 
  });

  // Floor
  const floorGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zOffset);
  scene.add(floor);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(GALLERY_WIDTH, ROOM_DEPTH);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, GALLERY_HEIGHT, zOffset);
  scene.add(ceiling);

  // Left Wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT), wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset);
  scene.add(leftWall);

  // Right Wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, GALLERY_HEIGHT), wallMaterial);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(GALLERY_WIDTH / 2, GALLERY_HEIGHT / 2, zOffset);
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
 * Create a single framed picture with spotlight
 */
function createFramedPicture(imageUrl, x, y, z, rotationY) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        const aspect = texture.image.width / texture.image.height;
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
        
        resolve(mesh);
      },
      undefined,
      () => resolve(null)
    );
  });
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (controls.isLocked) {
    // Movement Logic
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // Lazy Loading Trigger: If user walks near the end of generated rooms
    if (isLoadingComplete) {
      const triggerZ = -(roomsCreated * ROOM_DEPTH) + 15;
      if (camera.position.z < triggerZ) {
        generateNextRoom();
      }
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
