const fs = require('fs');
let content = fs.readFileSync('src/components/PreviewCanvas.tsx', 'utf-8');

const startIdx = content.indexOf('const [draggingClip, setDraggingClip] = useState<string | null>(null);');
const endIdx = content.indexOf('// Sort: V1 rendered first, V2 Overlay rendered on top of V1');

const newLogic = `
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  
  // Unified ref for both mouse and touch drag state
  const dragRef = React.useRef<{
    initialX: number;
    initialY: number;
    initialClipPosX: number;
    initialClipPosY: number;
    initialClipScale: number;
    initialClipRotation: number;
    initialKeyframes: any[] | null;
    isMultiTouch: boolean;
    initialDistance: number;
    initialAngle: number;
  } | null>(null);

  const handleMouseDown = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    setDraggingClip(clipId);
    dragRef.current = {
      initialX: e.clientX,
      initialY: e.clientY,
      initialClipPosX: clip.posX || 0,
      initialClipPosY: clip.posY || 0,
      initialClipScale: clip.scale ?? 1,
      initialClipRotation: clip.rotation || 0,
      initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
      isMultiTouch: false,
      initialDistance: 0,
      initialAngle: 0
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingClip && dragRef.current && !dragRef.current.isMultiTouch) {
      const state = dragRef.current;
      const deltaX = e.clientX - state.initialX;
      const deltaY = e.clientY - state.initialY;
      
      const newPosX = state.initialClipPosX + deltaX;
      const newPosY = state.initialClipPosY + deltaY;
      
      const updates: any = { posX: newPosX, posY: newPosY };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          posX: (kf.posX || 0) + deltaX,
          posY: (kf.posY || 0) + deltaY
        }));
      }

      onUpdateClip(draggingClip, updates);
    }
  };

  const handleMouseUp = () => {
    setDraggingClip(null);
    dragRef.current = null;
  };

  const handleTouchStart = (clipId: string, e: React.TouchEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    setDraggingClip(clipId);

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragRef.current = {
        initialX: touch.clientX,
        initialY: touch.clientY,
        initialClipPosX: clip.posX || 0,
        initialClipPosY: clip.posY || 0,
        initialClipScale: clip.scale ?? 1,
        initialClipRotation: clip.rotation || 0,
        initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
        isMultiTouch: false,
        initialDistance: 0,
        initialAngle: 0
      };
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      dragRef.current = {
        initialX: centerX,
        initialY: centerY,
        initialClipPosX: clip.posX || 0,
        initialClipPosY: clip.posY || 0,
        initialClipScale: clip.scale ?? 1,
        initialClipRotation: clip.rotation || 0,
        initialKeyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
        isMultiTouch: true,
        initialDistance: dist,
        initialAngle: angle
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingClip || !dragRef.current) return;
    const state = dragRef.current;

    if (e.touches.length === 1 && !state.isMultiTouch) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.initialX;
      const deltaY = touch.clientY - state.initialY;
      
      const newPosX = state.initialClipPosX + deltaX;
      const newPosY = state.initialClipPosY + deltaY;

      const updates: any = { posX: newPosX, posY: newPosY };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          posX: (kf.posX || 0) + deltaX,
          posY: (kf.posY || 0) + deltaY
        }));
      }

      onUpdateClip(draggingClip, updates);
      
    } else if (e.touches.length === 2 && state.isMultiTouch) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const scaleFactor = dist / state.initialDistance;
      let angleDiff = angle - state.initialAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const rotationDiff = angleDiff * (180 / Math.PI);

      const moveX = centerX - state.initialX;
      const moveY = centerY - state.initialY;

      const newScale = parseFloat(Math.max(0.1, Math.min(10, state.initialClipScale * scaleFactor)).toFixed(3));
      const newRotation = Math.round((state.initialClipRotation + rotationDiff) % 360);
      const newPosX = Math.round(state.initialClipPosX + moveX);
      const newPosY = Math.round(state.initialClipPosY + moveY);

      const updates: any = { 
        scale: newScale,
        rotation: newRotation,
        posX: newPosX,
        posY: newPosY
      };

      if (state.initialKeyframes && state.initialKeyframes.length > 0) {
        updates.keyframes = state.initialKeyframes.map((kf: any) => ({
          ...kf,
          scale: (kf.scale || 1) * scaleFactor,
          rotation: (kf.rotation || 0) + rotationDiff,
          posX: (kf.posX || 0) + moveX,
          posY: (kf.posY || 0) + moveY
        }));
      }

      onUpdateClip(draggingClip, updates);
    }
  };

  `;

content = content.substring(0, startIdx) + newLogic + content.substring(endIdx);

fs.writeFileSync('src/components/PreviewCanvas.tsx', content);
console.log('Done replacing');
