import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const ROOM_WIDTH = 40;
const ROOM_HEIGHT = 15;
const ROOM_DEPTH = 40;
const PICS_PER_ROOM = 4;
const MAX_ACTIVE_TEXTURES = 8; // Strict limit to prevent GPU crash

// --- STATE ---
let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let imageQueue = []; // Queue of image URLs to load
let activeTextures = []; // Track active textures to dispose them
let currentRoomIndex = 0;
let isGenerating = false;

// --- DOM ELEMENTS ---
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

init();
animate();

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 0, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 5;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);

    controls = new PointerLockControls(camera, document.body);

    if (blocker && instructions) {
        blocker.addEventListener('click', () => controls.lock());
        controls.addEventListener('lock', () => {
            instructions.style.display = 'none';
            blocker.style.display = 'none';
        });
        controls.addEventListener('unlock', () => {
            blocker.style.display = 'flex';
            instructions.style.display = 'flex';
        });
    }

    scene.add(controls.getObject());

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

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    await loadImages();
    generateNextRoom();
    
    if(loadingScreen) loadingScreen.style.display = 'none';
}

async function loadImages() {
    if(loadingText) loadingText.innerText = "Contacting Server...";
    
    try {
        const response = await fetch('/.netlify/functions/get-images');
        const data = await response.json();
        
        if (data.success && data.images.length > 0) {
            imageQueue = data.images;
            console.log(`✅ Loaded ${imageQueue.length} images from server`);
        } else {
            throw new Error("No images returned");
        }
    } catch (error) {
        console.warn("Scraping failed, using fallback:", error);
        imageQueue = [
            "https://picsum.photos/seed/museum1/800/600",
            "https://picsum.photos/seed/museum2/800/600",
            "https://picsum.photos/seed/museum3/800/600",
            "https://picsum.photos/seed/museum4/800/600",
            "https://picsum.photos/seed/museum5/800/600",
            "https://picsum.photos/seed/museum6/800/600"
        ];
    }

    if(loadingText) loadingText.innerText = `Gallery Ready: ${imageQueue.length} Artworks`;
}

function generateNextRoom() {
    if (imageQueue.length === 0 || isGenerating) return;
    
    isGenerating = true;
    const roomZ = -currentRoomIndex * ROOM_DEPTH;
    
    createRoomStructure(roomZ);
    
    for (let i = 0; i < PICS_PER_ROOM; i++) {
        if (imageQueue.length === 0) break;
        const imgUrl = imageQueue.shift();
        addPictureToRoom(roomZ, i, imgUrl);
    }

    currentRoomIndex++;
    isGenerating = false;
    console.log(`Generated Room ${currentRoomIndex}`);
}

function createRoomStructure(zPos) {
    const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = zPos;
    scene.add(floor);

    const ceilingGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM_HEIGHT;
    ceiling.position.z = zPos;
    scene.add(ceiling);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, zPos);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, zPos);
    scene.add(rightWall);

    if (currentRoomIndex > 0) {
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMat);
        backWall.position.set(0, ROOM_HEIGHT / 2, zPos - ROOM_DEPTH / 2);
        scene.add(backWall);
    }
}

async function addPictureToRoom(zPos, indexInRoom, url) {
    const isLeft = indexInRoom % 2 === 0;
    const xPos = isLeft ? -ROOM_WIDTH / 2 + 2 : ROOM_WIDTH / 2 - 2;
    const rotY = isLeft ? Math.PI / 2 : -Math.PI / 2;
    
    const frameGroup = new THREE.Group();
    frameGroup.position.set(xPos, ROOM_HEIGHT / 2 + 2, zPos + (indexInRoom * 10) - 10);
    frameGroup.rotation.y = rotY;
    
    const textureLoader = new THREE.TextureLoader();
    const proxyUrl = `/.netlify/functions/proxy-image?url=${encodeURIComponent(url)}`;
    
    try {
        const texture = await new Promise((resolve, reject) => {
            textureLoader.load(proxyUrl, resolve, undefined, reject);
        });

        texture.image.width = 512; 
        texture.image.height = 512;
        texture.needsUpdate = true;

        const geometry = new THREE.PlaneGeometry(6, 8);
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        
        const frameGeo = new THREE.BoxGeometry(6.4, 8.4, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.z = -0.15;
        
        frameGroup.add(mesh);
        frameGroup.add(frame);
        scene.add(frameGroup);

        activeTextures.push({ texture, mesh, group: frameGroup });

        if (activeTextures.length > MAX_ACTIVE_TEXTURES) {
            disposeOldestTexture();
        }

    } catch (err) {
        console.error("Failed to load texture:", err);
    }
}

function disposeOldestTexture() {
    const old = activeTextures.shift();
    if (old) {
        if (old.texture) { old.texture.dispose(); old.texture = null; }
        if (old.mesh) {
            old.mesh.geometry.dispose();
            old.mesh.material.dispose();
            scene.remove(old.group);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        const playerZ = controls.getObject().position.z;
        const lastRoomZ = -(currentRoomIndex - 1) * ROOM_DEPTH;
        
        if (playerZ < lastRoomZ - 20) {
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
