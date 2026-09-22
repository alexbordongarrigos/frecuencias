import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Icon from './Icon';

interface ParticipantAvatar {
  id: string;
  name: string;
  avatarUrl?: string;
  color?: string;
  position?: [number, number, number];
}

interface VirtualVRRoomProps {
  participants?: ParticipantAvatar[];
  currentUserId?: string;
  analyser?: AnalyserNode | null;
  frequencies?: number[];
  onClose?: () => void;
}

const VirtualVRRoom: React.FC<VirtualVRRoomProps> = ({
  participants = [],
  currentUserId = 'me',
  analyser,
  frequencies = [432, 528],
  onClose
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [inVR, setInVR] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#22d3ee');

  // Input states
  const keysPressed = useRef<Record<string, boolean>>({});
  const touchMove = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchLook = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const isDraggingMouse = useRef(false);
  const previousMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Detection of touch screen
  useEffect(() => {
    const checkTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(checkTouch);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.FogExp2(0x050814, 0.015);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 2, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // 2. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x22d3ee, 2, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2, 50);
    purpleLight.position.set(-10, 5, -5);
    scene.add(purpleLight);

    // 3. SANCTUARY ENVIRONMENT & GRID FLOOR
    const gridHelper = new THREE.GridHelper(60, 60, 0x22d3ee, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Cosmic Sanctuary Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.7, 12, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.2
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(Math.cos(angle) * 15, 6, Math.sin(angle) * 15);
      scene.add(pillar);
    }

    // 4. PROJECTION SCREENS (3 Giant Hologram Screens)
    // Canvas textures for live visuals
    const createScreenCanvas = (title: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 288;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, 512, 288);
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(title, 20, 40);
      }
      return { canvas, texture: new THREE.CanvasTexture(canvas) };
    };

    const screen2D = createScreenCanvas('Ondas 2D Resonantes');
    const screen3D = createScreenCanvas('Cimática 3D Geometría');
    const screenSpiral = createScreenCanvas('Espiral Cuántica');

    const screenGeo = new THREE.PlaneGeometry(8, 4.5);

    // Left Screen (Ondas)
    const mat2D = new THREE.MeshBasicMaterial({ map: screen2D.texture, side: THREE.DoubleSide });
    const mesh2D = new THREE.Mesh(screenGeo, mat2D);
    mesh2D.position.set(-8, 4, -8);
    mesh2D.rotation.y = Math.PI / 6;
    scene.add(mesh2D);

    // Center Screen (Cimática)
    const mat3D = new THREE.MeshBasicMaterial({ map: screen3D.texture, side: THREE.DoubleSide });
    const mesh3D = new THREE.Mesh(screenGeo, mat3D);
    mesh3D.position.set(0, 4, -10);
    scene.add(mesh3D);

    // Right Screen (Espiral)
    const matSpiral = new THREE.MeshBasicMaterial({ map: screenSpiral.texture, side: THREE.DoubleSide });
    const meshSpiral = new THREE.Mesh(screenGeo, matSpiral);
    meshSpiral.position.set(8, 4, -8);
    meshSpiral.rotation.y = -Math.PI / 6;
    scene.add(meshSpiral);

    // 5. ORGANIC HUMANOID AVATAR GENERATOR (Cuerpo orgánico redondeado futurista)
    const createOrganicAvatar = (name: string, colorHex: string = '#22d3ee') => {
      const group = new THREE.Group();

      // Torso (Sphere/Capsule)
      const torsoGeo = new THREE.SphereGeometry(0.6, 16, 16);
      torsoGeo.scale(1, 1.4, 0.8);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.3,
        metalness: 0.7,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: 0.3
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.y = 1.2;
      group.add(torso);

      // Head (Rounded Ovoid)
      const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: 0.6
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 2.2;
      group.add(head);

      // Energy Ring (Aura)
      const ringGeo = new THREE.TorusGeometry(0.7, 0.04, 16, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.5;
      group.add(ring);

      // Floating Name Tag (Canvas Sprite)
      const nameCanvas = document.createElement('canvas');
      nameCanvas.width = 256;
      nameCanvas.height = 64;
      const nCtx = nameCanvas.getContext('2d');
      if (nCtx) {
        nCtx.fillStyle = 'rgba(0,0,0,0.7)';
        nCtx.fillRect(0, 0, 256, 64);
        nCtx.strokeStyle = colorHex;
        nCtx.lineWidth = 4;
        nCtx.strokeRect(0, 0, 256, 64);
        nCtx.fillStyle = '#ffffff';
        nCtx.font = 'bold 20px sans-serif';
        nCtx.textAlign = 'center';
        nCtx.fillText(name, 128, 40);
      }
      const nameTexture = new THREE.CanvasTexture(nameCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: nameTexture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 2.8, 0);
      sprite.scale.set(2, 0.5, 1);
      group.add(sprite);

      return group;
    };

    // Render Participant Avatars
    const avatarGroups: THREE.Group[] = [];
    const activeList = participants.length > 0 ? participants : [
      { id: '1', name: 'Explorador Alfa', color: '#22d3ee', position: [-2, 0, 0] },
      { id: '2', name: 'Guía Estelar', color: '#a855f7', position: [2, 0, -1] }
    ];

    activeList.forEach((p, idx) => {
      const avatar = createOrganicAvatar(p.name, p.color || (idx % 2 === 0 ? '#22d3ee' : '#a855f7'));
      const posX = p.position ? p.position[0] : (idx - 1) * 3;
      const posZ = p.position ? p.position[2] : -2;
      avatar.position.set(posX, 0, posZ);
      scene.add(avatar);
      avatarGroups.push(avatar);
    });

    // 6. ANIMATION LOOP & FREQUENCY VISUAL SPECTRUM UPDATES
    let animationFrameId: number;
    let time = 0;

    const audioArray = new Uint8Array(64);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      time += 0.02;

      // Update Audio Spectrum Data
      if (analyser) {
        analyser.getByteFrequencyData(audioArray);
      }

      // Animate Projection Screens
      // 1. Screen 2D (Waves)
      const ctx2 = screen2D.canvas.getContext('2d');
      if (ctx2) {
        ctx2.fillStyle = 'rgba(3, 7, 18, 0.2)';
        ctx2.fillRect(0, 0, 512, 288);
        ctx2.beginPath();
        ctx2.strokeStyle = avatarColor;
        ctx2.lineWidth = 3;
        for (let i = 0; i < 512; i += 8) {
          const val = (audioArray[i % 64] / 255) * 80;
          const y = 144 + Math.sin(i * 0.02 + time * 3) * (val + 20);
          if (i === 0) ctx2.moveTo(i, y);
          else ctx2.lineTo(i, y);
        }
        ctx2.stroke();
        screen2D.texture.needsUpdate = true;
      }

      // 2. Screen 3D (Cymatics Ring)
      const ctx3 = screen3D.canvas.getContext('2d');
      if (ctx3) {
        ctx3.fillStyle = 'rgba(3, 7, 18, 0.2)';
        ctx3.fillRect(0, 0, 512, 288);
        ctx3.save();
        ctx3.translate(256, 144);
        ctx3.strokeStyle = '#a855f7';
        ctx3.lineWidth = 2;
        ctx3.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const r = 60 + Math.cos(a * 6 + time * 2) * 25 + (audioArray[2] / 255) * 30;
          const rx = Math.cos(a) * r;
          const ry = Math.sin(a) * r;
          if (a === 0) ctx3.moveTo(rx, ry);
          else ctx3.lineTo(rx, ry);
        }
        ctx3.closePath();
        ctx3.stroke();
        ctx3.restore();
        screen3D.texture.needsUpdate = true;
      }

      // 3. Screen Spiral
      const ctxS = screenSpiral.canvas.getContext('2d');
      if (ctxS) {
        ctxS.fillStyle = 'rgba(3, 7, 18, 0.2)';
        ctxS.fillRect(0, 0, 512, 288);
        ctxS.save();
        ctxS.translate(256, 144);
        ctxS.strokeStyle = '#f43f5e';
        ctxS.lineWidth = 2.5;
        ctxS.beginPath();
        for (let i = 0; i < 150; i++) {
          const angle = i * 0.15 + time;
          const radius = i * 0.8;
          const sx = Math.cos(angle) * radius;
          const sy = Math.sin(angle) * radius;
          if (i === 0) ctxS.moveTo(sx, sy);
          else ctxS.lineTo(sx, sy);
        }
        ctxS.stroke();
        ctxS.restore();
        screenSpiral.texture.needsUpdate = true;
      }

      // Floating Avatars Hover Animation
      avatarGroups.forEach((group, idx) => {
        group.position.y = Math.sin(time * 2 + idx) * 0.1;
      });

      // CAMERA MOVEMENT & INPUT HANDLING
      const moveSpeed = 0.15;
      const dir = new THREE.Vector3();

      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || touchMove.current.y < 0) {
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        camera.position.addScaledVector(dir, moveSpeed);
      }
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] || touchMove.current.y > 0) {
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        camera.position.addScaledVector(dir, -moveSpeed);
      }
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] || touchMove.current.x < 0) {
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, moveSpeed);
      }
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] || touchMove.current.x > 0) {
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, -moveSpeed);
      }
      if (keysPressed.current['Space']) {
        camera.position.y += 0.08; // Levitación
      }
      if (keysPressed.current['ShiftLeft'] || keysPressed.current['KeyC']) {
        camera.position.y = Math.max(1, camera.position.y - 0.08);
      }

      renderer.render(scene, camera);
    };

    animate();

    // KEYBOARD EVENT LISTENERS
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };

    // MOUSE DRAG LOOK LISTENERS
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingMouse.current = true;
      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingMouse.current) return;
      const deltaX = e.clientX - previousMouse.current.x;
      const deltaY = e.clientY - previousMouse.current.y;

      camera.rotation.y -= deltaX * 0.003;
      camera.rotation.x -= deltaY * 0.003;
      camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camera.rotation.x));

      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDraggingMouse.current = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const domEl = mountRef.current;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // RESIZE
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      if (domEl) domEl.removeEventListener('mousedown', handleMouseDown);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [analyser, avatarColor, participants]);

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col animate-fade-in overflow-hidden">
      
      {/* 3D Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing" />

      {/* Top Header Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 bg-black/70 backdrop-blur-xl p-3 rounded-2xl border border-cyan-500/30 pointer-events-auto shadow-2xl">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Santuario Holofónico Virtual VR/3D
            </h3>
            <p className="text-[10px] text-cyan-300 font-mono">
              Entonación Frecuencial: {frequencies.join(', ')} Hz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Tutorial Toggle */}
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="p-2.5 bg-black/70 backdrop-blur-xl hover:bg-white/10 text-cyan-300 border border-cyan-500/30 rounded-2xl transition-all shadow-lg"
            title="Guía de Controles VR"
          >
            <Icon name="HelpCircle" size={18} />
          </button>

          {/* Avatar Color Picker */}
          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10">
            {['#22d3ee', '#a855f7', '#f43f5e', '#10b981', '#f59e0b'].map((c) => (
              <button
                key={c}
                onClick={() => setAvatarColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full border transition-transform ${avatarColor === c ? 'scale-125 border-white shadow-[0_0_10px_currentColor]' : 'border-transparent'}`}
                title="Color del Aura del Avatar"
              />
            ))}
          </div>

          {/* Close Virtual VR Room */}
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-red-500/80 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all border border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-2"
          >
            <Icon name="X" size={16} />
            <span>Salir de VR</span>
          </button>
        </div>
      </div>

      {/* INITIAL TUTORIAL / INSTRUCTIVO OVERLAY */}
      {showTutorial && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-cyan-500/50 p-6 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(34,211,238,0.2)] flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <Icon name="Compass" size={20} /> Guía de Navegación VR / 3D
              </h3>
              <button onClick={() => setShowTutorial(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <Icon name="Monitor" size={24} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">En Computadora:</span>
                  Usa <strong className="text-cyan-300">WASD</strong> o las Flechas del teclado para desplazarte. Haz <strong className="text-cyan-300">Click y Arrastra</strong> con el ratón para girar la cámara 360°. Usa <strong className="text-cyan-300">Espacio</strong> para levitar.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <Icon name="Smartphone" size={24} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">En Celular o Tablet:</span>
                  Usa los controles táctiles en pantalla (Joystick izquierdo para caminar y deslizador derecho para girar la vista).
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <Icon name="Users" size={24} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Avatares Orgánicos y Pantallas:</span>
                  Cada entonador se representa mediante una forma estelar redondeada con su nombre flotante. Las pantallas proyectan la entonación en tiempo real.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.5)] mt-2"
            >
              Entrar al Santuario VR
            </button>
          </div>
        </div>
      )}

      {/* TOUCH CONTROLS OVERLAY FOR MOBILE DEVICES */}
      {isTouchDevice && (
        <div className="absolute bottom-6 left-6 right-6 z-30 flex justify-between items-end pointer-events-none">
          {/* D-PAD JOYSTICK MOVEMENET */}
          <div className="w-32 h-32 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 p-2 flex flex-col justify-between items-center pointer-events-auto shadow-2xl">
            <button
              onMouseDown={() => (touchMove.current.y = -1)}
              onMouseUp={() => (touchMove.current.y = 0)}
              onTouchStart={() => (touchMove.current.y = -1)}
              onTouchEnd={() => (touchMove.current.y = 0)}
              className="w-10 h-8 bg-cyan-500/20 active:bg-cyan-500 rounded-lg text-cyan-300 flex items-center justify-center font-bold"
            >
              ▲
            </button>
            <div className="flex justify-between w-full px-1">
              <button
                onMouseDown={() => (touchMove.current.x = -1)}
                onMouseUp={() => (touchMove.current.x = 0)}
                onTouchStart={() => (touchMove.current.x = -1)}
                onTouchEnd={() => (touchMove.current.x = 0)}
                className="w-8 h-10 bg-cyan-500/20 active:bg-cyan-500 rounded-lg text-cyan-300 flex items-center justify-center font-bold"
              >
                ◀
              </button>
              <button
                onMouseDown={() => (touchMove.current.x = 1)}
                onMouseUp={() => (touchMove.current.x = 0)}
                onTouchStart={() => (touchMove.current.x = 1)}
                onTouchEnd={() => (touchMove.current.x = 0)}
                className="w-8 h-10 bg-cyan-500/20 active:bg-cyan-500 rounded-lg text-cyan-300 flex items-center justify-center font-bold"
              >
                ▶
              </button>
            </div>
            <button
              onMouseDown={() => (touchMove.current.y = 1)}
              onMouseUp={() => (touchMove.current.y = 0)}
              onTouchStart={() => (touchMove.current.y = 1)}
              onTouchEnd={() => (touchMove.current.y = 0)}
              className="w-10 h-8 bg-cyan-500/20 active:bg-cyan-500 rounded-lg text-cyan-300 flex items-center justify-center font-bold"
            >
              ▼
            </button>
          </div>

          {/* TOUCH LOOK PAD */}
          <div className="bg-black/60 backdrop-blur-md p-4 rounded-3xl border border-white/10 text-xs font-mono text-cyan-300 pointer-events-auto">
            Desliza para Girar Vista 360°
          </div>
        </div>
      )}

    </div>
  );
};

export default VirtualVRRoom;
