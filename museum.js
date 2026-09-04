import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// === CONFIGURATION ===
const CONFIG = {
  ROOM_WIDTH: 50,
  ROOM_HEIGHT: 18,
  ROOM_DEPTH: 50,
  PICS_PER_ROOM: 6,
  MAX_ACTIVE_TEXTURES: 12,
  MOVE_SPEED: 80,
  LOOK_SPEED: 0.002,
  FOG_DENSITY: 0.02,
  AMBIENT_LIGHT_INTENSITY: 0.6,
  POINT_LIGHT_INTENSITY: 0.8
};

// === STATE ===
let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let imageQueue = [];
let activeTextures = [];
let currentRoomIndex = 0;
let isGenerating = false;
let artworkCount = 0;

// === DOM ELEMENTS ===
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const clickToStart = document.getElementById('click-to-start');
const artworkCountEl = document.getElementById('artwork-count');
const errorMessage = document.getElementById('error-message');

// === INITIALIZATION ===
init();
animate();

async function init() {
  try {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.FogExp2(0x1a1a1a, CONFIG.FOG_DENSITY);

    // Camera setup
    camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, CONFIG.ROOM_HEIGHT / 3, 5);

    // Lighting
    setupLighting();

    // Controls
    controls = new PointerLockControls(camera, document.body);
    setupControls();

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Event listeners
    window.addEventListener('resize', onWindowResize);

    // Load images and generate first room
    await loadImages();
    generateNextRoom();

    // Hide loading screen
    hideLoadingScreen();

  } catch (error) {
    showError('Failed to initialize: ' + error.message);
    console.error('Initialization error:', error);
  }
}

function setupLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT_LIGHT_INTENSITY);
  scene.add(ambientLight);

  // Hemisphere light for natural sky lighting
  const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.4);
  scene.add(hemiLight);
}

function setupControls() {
  // Click to start overlay
  clickToStart.addEventListener('click', () => {
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    clickToStart.classList.add('hidden');
  });

  controls.addEventListener('unlock', () => {
    clickToStart.classList.remove('hidden');
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
}

function hideLoadingScreen() {
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.add('visible');
    setTimeout(() => {
      errorMessage.classList.remove('visible');
    }, 5000);
  }
}

// === IMAGE LOADING ===
async function loadImages() {
  updateLoadingProgress('Loading artwork collection...');

  try {
    const response = await fetch('/.netlify/functions/get-images');
    const data = await response.json();

    if (data.images && data.images.length > 0) {
      // Convert direct URLs to proxy URLs to avoid CORS issues
      imageQueue = data.images.map(url => `/.netlify/functions/proxy-image?url=${encodeURIComponent(url)}`);
      console.log(`✅ Loaded ${imageQueue.length} images from server`);
    } else {
      throw new Error('No images returned from server');
    }
  } catch (error) {
    console.warn('Server fetch failed, using fallback images:', error.message);
    imageQueue = getFallbackImages();
  }

  updateLoadingProgress(`Gallery Ready: ${imageQueue.length} Artworks`);
}

function getFallbackImages() {
  const seeds = [
    'art1', 'art2', 'art3', 'art4', 'art5', 'art6',
    'art7', 'art8', 'art9', 'art10', 'art11', 'art12'
  ];
  // Use proxy for fallback images too to avoid CORS issues
  return seeds.map(seed => `/.netlify/functions/proxy-image?url=${encodeURIComponent(`https://picsum.photos/seed/${seed}/800/600`)}`);
}

function updateLoadingProgress(text) {
  if (loadingProgress) {
    loadingProgress.textContent = text;
  }
}

function updateArtworkCount() {
  artworkCount++;
  if (artworkCountEl) {
    artworkCountEl.textContent = artworkCount;
  }
}

// === ROOM GENERATION ===
async function generateNextRoom() {
  if (imageQueue.length === 0 || isGenerating) return;

  isGenerating = true;
  const roomZ = -currentRoomIndex * CONFIG.ROOM_DEPTH;

  createRoomStructure(roomZ);

  // Add pictures to the room - one unique image per position
  const picsToAdd = Math.min(CONFIG.PICS_PER_ROOM, imageQueue.length);
  for (let i = 0; i < picsToAdd; i++) {
    const imgUrl = imageQueue.shift();
    await addPictureToRoom(roomZ, i, imgUrl);
  }

  currentRoomIndex++;
  isGenerating = false;
  console.log(`Generated Room ${currentRoomIndex}`);
}

function createRoomStructure(zPos) {
  const materials = {
    floor: new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a, 
      roughness: 0.8,
      metalness: 0.2
    }),
    ceiling: new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,
      roughness: 0.9
    }),
    wall: new THREE.MeshStandardMaterial({ 
      color: 0xf5f5f5,
      roughness: 0.7
    })
  };

  // Floor
  const floorGeo = new THREE.PlaneGeometry(CONFIG.ROOM_WIDTH, CONFIG.ROOM_DEPTH);
  const floor = new THREE.Mesh(floorGeo, materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = zPos;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(CONFIG.ROOM_WIDTH, CONFIG.ROOM_DEPTH);
  const ceiling = new THREE.Mesh(ceilingGeo, materials.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CONFIG.ROOM_HEIGHT;
  ceiling.position.z = zPos;
  scene.add(ceiling);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.ROOM_DEPTH, CONFIG.ROOM_HEIGHT), 
    materials.wall
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-CONFIG.ROOM_WIDTH / 2, CONFIG.ROOM_HEIGHT / 2, zPos);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.ROOM_DEPTH, CONFIG.ROOM_HEIGHT), 
    materials.wall
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(CONFIG.ROOM_WIDTH / 2, CONFIG.ROOM_HEIGHT / 2, zPos);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Back wall (only for rooms after the first)
  if (currentRoomIndex > 0) {
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.ROOM_WIDTH, CONFIG.ROOM_HEIGHT), 
      materials.wall
    );
    backWall.position.set(0, CONFIG.ROOM_HEIGHT / 2, zPos - CONFIG.ROOM_DEPTH / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);
  }

  // Add spotlights for gallery lighting
  addGalleryLighting(zPos);
}

function addGalleryLighting(zPos) {
  const lightPositions = [
    { x: -CONFIG.ROOM_WIDTH / 4, y: CONFIG.ROOM_HEIGHT - 2, z: zPos },
    { x: CONFIG.ROOM_WIDTH / 4, y: CONFIG.ROOM_HEIGHT - 2, z: zPos }
  ];

  lightPositions.forEach((pos, index) => {
    const spotlight = new THREE.SpotLight(0xffffee, CONFIG.POINT_LIGHT_INTENSITY);
    spotlight.position.set(pos.x, pos.y, pos.z);
    spotlight.target.position.set(pos.x, 0, pos.z);
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.3;
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;
    scene.add(spotlight);
    scene.add(spotlight.target);
  });
}

// === PICTURE FRAMES ===
async function addPictureToRoom(zPos, indexInRoom, url) {
  const position = getPicturePosition(indexInRoom, zPos);
  await createPictureFrame(position.position, position.rotation, url);
}

function getPicturePosition(indexInRoom, roomZ) {
  const wallOffset = CONFIG.ROOM_WIDTH / 2 - 2;
  const picSpacing = CONFIG.ROOM_DEPTH / CONFIG.PICS_PER_ROOM;
  const startY = CONFIG.ROOM_HEIGHT / 2 + 3;
  
  const isLeft = indexInRoom % 2 === 0;
  const xPos = isLeft ? -wallOffset : wallOffset;
  const rotY = isLeft ? Math.PI / 2 : -Math.PI / 2;
  const zPos = (indexInRoom * picSpacing) - (CONFIG.ROOM_DEPTH / 2) + (picSpacing / 2);

  return {
    position: new THREE.Vector3(xPos, startY, zPos + roomZ),
    rotation: new THREE.Euler(0, rotY, 0)
  };
}

async function createPictureFrame(position, rotation, url) {
  const frameGroup = new THREE.Group();
  frameGroup.position.copy(position);
  frameGroup.rotation.copy(rotation);

  try {
    let texture;
    
    // Check if this is a proxy URL (returns JSON) or direct image URL
    if (url.includes('/.netlify/functions/proxy-image')) {
      // Fetch the JSON response from proxy
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }
      const data = await response.json();
      
      if (data.dataUrl) {
        // Load texture from base64 data URL
        texture = await loadTexture(data.dataUrl);
      } else {
        throw new Error('No dataUrl in proxy response');
      }
    } else {
      // Direct image URL - use CORS-enabled loader
      texture = await loadTextureWithCORS(url);
    }
    
    // Picture geometry
    const aspectRatio = 3 / 4;
    const picHeight = 7;
    const picWidth = picHeight * aspectRatio;
    
    const geometry = new THREE.PlaneGeometry(picWidth, picHeight);
    const material = new THREE.MeshStandardMaterial({ 
      map: texture, 
      side: THREE.DoubleSide,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Frame
    const frameDepth = 0.3;
    const frameWidth = picWidth + 0.8;
    const frameHeight = picHeight + 0.8;
    const frameGeo = createFrameGeometry(frameWidth, frameHeight, frameDepth);
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.5,
      metalness: 0.3
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -frameDepth / 2;
    frame.castShadow = true;

    frameGroup.add(mesh);
    frameGroup.add(frame);
    scene.add(frameGroup);

    // Track for disposal
    activeTextures.push({ texture, mesh, group: frameGroup });

    // Dispose oldest if over limit
    if (activeTextures.length > CONFIG.MAX_ACTIVE_TEXTURES) {
      disposeOldestTexture();
    }

    updateArtworkCount();

  } catch (err) {
    console.error('Failed to load picture:', url, err);
    console.error('Error details:', err.message || err);
    // Create placeholder artwork instead of failing silently
    createPlaceholderArtwork(frameGroup, position, rotation);
    scene.add(frameGroup);
  }
}

function createFrameGeometry(width, height, depth) {
  const shapes = [];
  
  // Create a rectangular frame shape
  const outerRect = new THREE.Shape();
  outerRect.moveTo(-width/2, -height/2);
  outerRect.lineTo(width/2, -height/2);
  outerRect.lineTo(width/2, height/2);
  outerRect.lineTo(-width/2, height/2);
  outerRect.closePath();

  // Inner hole
  const innerRect = new THREE.Path();
  innerRect.moveTo(-width/2 + depth, -height/2 + depth);
  innerRect.lineTo(width/2 - depth, -height/2 + depth);
  innerRect.lineTo(width/2 - depth, height/2 - depth);
  innerRect.lineTo(-width/2 + depth, height/2 - depth);
  innerRect.closePath();
  outerRect.holes.push(innerRect);

  shapes.push(outerRect);

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelSegments: 2
  });

  return geometry;
}

async function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      (err) => {
        console.error('Texture load error:', url, err);
        reject(err);
      }
    );
  });
}

async function loadTextureWithCORS(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      (err) => {
        console.error('Texture CORS load error:', url, err);
        reject(err);
      }
    );
  });
}

function createPlaceholderArtwork(frameGroup, position, rotation) {
  // Create a colorful procedural artwork as placeholder
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  
  // Generate abstract art with random colors
  const hue1 = Math.random() * 360;
  const hue2 = (hue1 + 180) % 360;
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `hsl(${hue1}, 70%, 50%)`);
  gradient.addColorStop(0.5, `hsl(${hue2}, 60%, 40%)`);
  gradient.addColorStop(1, `hsl(${hue1}, 80%, 60%)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add some abstract shapes
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 100 + 20,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `hsla(${Math.random() * 360}, 60%, 50%, 0.3)`;
    ctx.fill();
  }
  
  // Add title text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Abstract Art', canvas.width / 2, canvas.height / 2);
  ctx.font = '24px Arial';
  ctx.fillText(`#${Math.floor(Math.random() * 10000)}`, canvas.width / 2, canvas.height / 2 + 40);
  
  // Convert canvas to data URL and load as texture
  const dataUrl = canvas.toDataURL('image/png');
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  
  frameGroup.position.copy(position);
  frameGroup.rotation.copy(rotation);
  
  // Picture geometry
  const aspectRatio = 3 / 4;
  const picHeight = 7;
  const picWidth = picHeight * aspectRatio;
  
  const geometry = new THREE.PlaneGeometry(picWidth, picHeight);
  const material = new THREE.MeshStandardMaterial({ 
    map: texture, 
    side: THREE.DoubleSide,
    roughness: 0.3
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Frame
  const frameDepth = 0.3;
  const frameWidth = picWidth + 0.8;
  const frameHeight = picHeight + 0.8;
  const frameGeo = createFrameGeometry(frameWidth, frameHeight, frameDepth);
  const frameMat = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.5,
    metalness: 0.3
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.z = -frameDepth / 2;
  frame.castShadow = true;

  frameGroup.add(mesh);
  frameGroup.add(frame);
  scene.add(frameGroup);

  activeTextures.push({ texture, mesh, group: frameGroup });

  if (activeTextures.length > CONFIG.MAX_ACTIVE_TEXTURES) {
    disposeOldestTexture();
  }

  updateArtworkCount();
}

function disposeOldestTexture() {
  const old = activeTextures.shift();
  if (old) {
    if (old.texture) {
      old.texture.dispose();
      old.texture = null;
    }
    if (old.mesh) {
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
    if (old.group) {
      scene.remove(old.group);
    }
  }
}

// === ANIMATION LOOP ===
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

    // Apply acceleration
    if (moveForward || moveBackward) {
      velocity.z -= direction.z * CONFIG.MOVE_SPEED * delta;
    }
    if (moveLeft || moveRight) {
      velocity.x -= direction.x * CONFIG.MOVE_SPEED * delta;
    }

    // Move controls
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // Generate next room if approaching end
    const playerZ = controls.getObject().position.z;
    const lastRoomZ = -(currentRoomIndex - 1) * CONFIG.ROOM_DEPTH;

    if (playerZ < lastRoomZ - CONFIG.ROOM_DEPTH / 2) {
      generateNextRoom();
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

// === WINDOW RESIZE ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
