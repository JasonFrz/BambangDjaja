import React, { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Eye, GripVertical, RotateCcw, Thermometer, ShieldAlert, Zap } from 'lucide-react';

export const Transformer3DPanel = memo(({ panel = {}, latestData = {}, isEditing = false }) => {
  const mountRef = useRef(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [isRotating, setIsRotating] = useState(true);

  const oilTemp = Number(latestData?.oil_temperature ?? 57);
  const loadingKva = Number(latestData?.power ? (latestData.power / 1000).toFixed(1) : 45);

  const isHot = oilTemp > 70;
  const isTrip = oilTemp > 85;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5.5, 4.5, 6.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(8, 12, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x6366f1, 0.6);
    dirLight2.position.set(-8, -4, -6);
    scene.add(dirLight2);

    const transformerGroup = new THREE.Group();
    scene.add(transformerGroup);

    const tankColor = isTrip ? 0xef4444 : isHot ? 0xf59e0b : 0x2563eb;
    const metalMat = new THREE.MeshStandardMaterial({
      color: tankColor,
      metalness: 0.7,
      roughness: 0.35,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });

    const porcelainMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.15,
      metalness: 0.1,
    });

    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.2,
    });

    const tankGeo = new THREE.BoxGeometry(2.6, 2.2, 1.8);
    const mainTank = new THREE.Mesh(tankGeo, metalMat);
    mainTank.position.set(0, 0, 0);
    mainTank.userData = { name: 'Main Tank (Oli Trafo)', detail: `Suhu Top Oil: ${oilTemp}°C` };
    transformerGroup.add(mainTank);

    const baseGeo = new THREE.BoxGeometry(2.8, 0.2, 2.0);
    const baseMesh = new THREE.Mesh(baseGeo, darkMetalMat);
    baseMesh.position.set(0, -1.2, 0);
    transformerGroup.add(baseMesh);

    const conservatorGeo = new THREE.CylinderGeometry(0.38, 0.38, 2.2, 24);
    const conservator = new THREE.Mesh(conservatorGeo, darkMetalMat);
    conservator.rotation.z = Math.PI / 2;
    conservator.position.set(0, 1.6, -0.6);
    conservator.userData = { name: 'Conservator Tank', detail: 'Menampung pemuaian oli isolasi' };
    transformerGroup.add(conservator);

    const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12);
    const pipe1 = new THREE.Mesh(pipeGeo, darkMetalMat);
    pipe1.position.set(-0.6, 1.3, -0.6);
    transformerGroup.add(pipe1);
    const pipe2 = new THREE.Mesh(pipeGeo, darkMetalMat);
    pipe2.position.set(0.6, 1.3, -0.6);
    transformerGroup.add(pipe2);

    const createBushing = (x, z, scale = 1, isHv = true) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(x, 1.1, z);

      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.15 * scale, 0.15, 12), darkMetalMat);
      bGroup.add(baseRing);

      for (let i = 0; i < (isHv ? 4 : 3); i++) {
        const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.16 * scale, 0.12 * scale, 16), porcelainMat);
        shed.position.y = 0.12 + i * 0.13 * scale;
        bGroup.add(shed);
      }

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.8 * scale, 12), copperMat);
      rod.position.y = 0.35 * scale;
      bGroup.add(rod);

      bGroup.userData = {
        name: isHv ? 'HV Bushing (Sisi Primer 20kV)' : 'LV Bushing (Sisi Sekunder 400V)',
        detail: isHv ? 'Koneksi tegangan tinggi fase grid' : 'Koneksi tegangan rendah fase beban'
      };
      return bGroup;
    };

    [-0.6, 0, 0.6].forEach((x) => {
      transformerGroup.add(createBushing(x, 0.4, 1.1, true));
    });

    [-0.75, -0.25, 0.25, 0.75].forEach((x) => {
      transformerGroup.add(createBushing(x, -0.1, 0.7, false));
    });

    const createFins = (side) => {
      const finGroup = new THREE.Group();
      for (let i = -4; i <= 4; i++) {
        const finGeo = new THREE.BoxGeometry(0.04, 1.6, 0.7);
        const fin = new THREE.Mesh(finGeo, darkMetalMat);
        fin.position.set(side * 1.5, 0, i * 0.18);
        finGroup.add(fin);
      }
      finGroup.userData = { name: 'Radiator Fin', detail: 'Sirip pendingin pelepasan panas minyak' };
      return finGroup;
    };
    transformerGroup.add(createFins(1));
    transformerGroup.add(createFins(-1));

    camera.lookAt(0, 0.2, 0);

    let animationFrameId;
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (isRotating && !isDragging) {
        transformerGroup.rotation.y += 0.007;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onMouseDown = (e) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      transformerGroup.rotation.y += deltaX * 0.01;
      transformerGroup.rotation.x = Math.max(-0.6, Math.min(0.6, transformerGroup.rotation.x + deltaY * 0.005));
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(transformerGroup.children, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.name && obj.parent !== transformerGroup && obj.parent !== scene) {
          obj = obj.parent;
        }
        if (obj?.userData?.name) {
          setSelectedPart(obj.userData);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('click', onClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);

      if (container.contains(dom)) {
        container.removeChild(dom);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [isRotating, isHot, isTrip, oilTemp]);

  return (
    <div className="h-full w-full flex flex-col min-h-0 select-none">
      <div className={`flex items-center justify-between gap-2 px-1 mb-1.5 shrink-0 ${isEditing ? 'cursor-move drag-handle' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 shrink-0">
            <Box size={14} />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
            {panel.title || '3D Transformer Digital Twin'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pr-14">
          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className="p-1 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-white/10 transition"
            title={isRotating ? 'Jeda Rotasi' : 'Mulai Rotasi'}
          >
            <RotateCcw size={12} className={isRotating ? 'animate-spin' : ''} />
          </button>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isTrip
              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
              : isHot
              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
          }`}>
            {oilTemp}°C
          </span>
          {isEditing && <GripVertical size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative bg-gradient-to-b from-gray-50/50 to-indigo-50/20 dark:from-black/20 dark:to-indigo-950/10 rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[10px]">
          <div className="bg-white/85 dark:bg-[#151521]/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200/60 dark:border-white/10 text-gray-600 dark:text-gray-300 shadow-xs pointer-events-auto">
            {selectedPart ? (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {selectedPart.name} • <span className="font-normal text-gray-500 dark:text-gray-400">{selectedPart.detail}</span>
              </span>
            ) : (
              <span>Klik komponen trafo untuk inspeksi</span>
            )}
          </div>
          <span className="text-gray-400 font-mono hidden sm:inline">{loadingKva} kVA</span>
        </div>
      </div>
    </div>
  );
});

export default Transformer3DPanel;
