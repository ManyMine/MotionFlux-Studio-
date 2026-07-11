const fs = require('fs');
const content = fs.readFileSync('src/utils/exportOffline.ts', 'utf8');

const targetVisualAnim = `
      // Transitions
`;

const replaceVisualAnim = `
      // 15 ANIMATIONS MATH (Visuals)
      if (clip.animationType === 'pan-right') {
          posX += easeProgress * 200;
      } else if (clip.animationType === 'pan-left') {
          posX -= easeProgress * 200;
      } else if (clip.animationType === 'pan-up') {
          posY -= easeProgress * 200;
      } else if (clip.animationType === 'pan-down') {
          posY += easeProgress * 200;
      } else if (clip.animationType === 'zoom-in') {
          scale *= 1 + (easeProgress * 0.8);
      } else if (clip.animationType === 'zoom-out') {
          scale *= Math.max(0.1, 1 - easeProgress * 0.6);
      } else if (clip.animationType === 'spin') {
          rotation += easeProgress * 360;
      } else if (clip.animationType === 'wobble') {
          rotation += Math.sin(easeProgress * Math.PI * 4) * 15;
      } else if (clip.animationType === 'heartbeat') {
          scale *= 1 + Math.abs(Math.sin(easeProgress * Math.PI * 3)) * 0.15;
      } else if (clip.animationType === 'zoom-rotate') {
          scale *= 1 + (easeProgress * 0.5);
          rotation += easeProgress * 180;
      } else if (clip.animationType === 'slide-up') {
          posY += (1 - easeProgress) * 400;
      } else if (clip.animationType === 'slide-down') {
          posY -= (1 - easeProgress) * 400;
      } else if (clip.animationType === 'fade-in') {
          opacity = easeProgress;
      } else if (clip.animationType === 'fade-out') {
          opacity = 1 - easeProgress;
      } else if (clip.animationType === 'swing') {
          rotation += Math.sin(easeProgress * Math.PI * 3) * 20;
      } else if (clip.animationType === 'flash') {
          opacity = 0.5 + Math.sin(easeProgress * Math.PI * 6) * 0.5;
      } else if (clip.animationType === 'pulse-rapid') {
          scale *= 1 + Math.abs(Math.sin(easeProgress * Math.PI * 6)) * 0.2;
      } else if (clip.animationType === 'shake-intense') {
          const f = easeProgress * Math.PI * 16;
          posX += Math.sin(f) * 15;
          posY += Math.cos(f * 1.5) * 15;
      } else if (clip.animationType === 'rotate-flip') {
          scale = scale * Math.cos(easeProgress * Math.PI * 2);
      } else if (clip.animationType === 'zoom-shake') {
          scale *= 1 + (easeProgress * 0.4);
          const f = easeProgress * Math.PI * 12;
          posX += Math.sin(f) * 8;
          posY += Math.cos(f * 1.2) * 8;
      } else if (clip.animationType === 'slide-fade-down') {
          posY += (1 - easeProgress) * -200;
          opacity = easeProgress;
      } else if (clip.animationType === 'zoom-in-bounce') {
          const p = easeProgress;
          const bounceScale = p < 0.6 ? p * 1.5 : p < 0.8 ? 1 + (0.8 - p) * 0.5 : 1 + (1.0 - p) * 0.1;
          scale *= bounceScale;
      } else if (clip.animationType === 'shake-small') {
          const f = easeProgress * Math.PI * 12;
          posX += Math.sin(f) * 4;
          posY += Math.cos(f * 1.3) * 4;
      }

      // Transitions
`;

const targetTextAnim = `
      // Apply basic text anims for offline
      if (textClip.animationType === 'typewriter') {
        textToDisplay = textToDisplay.substring(0, Math.floor(textToDisplay.length * Math.min(1, textProgress / 0.45)));
      } else if (textClip.animationType === 'blur-reveal') {
        const animProgress = Math.min(1, textProgress / 0.4);
        ctx.filter = \`blur(\${(1 - animProgress) * 20}px)\`;
        textOpacity *= animProgress;
      }
`;

const replaceTextAnim = `
      // Text Animations
      if (textClip.animationType === 'typewriter') {
        const revealProgress = Math.min(1, textProgress / 0.45);
        const charCount = Math.floor(textToDisplay.length * revealProgress);
        textToDisplay = textToDisplay.substring(0, charCount);
      } else if (textClip.animationType === 'slide-fade-up') {
        const animProgress = Math.min(1, textProgress / 0.3);
        const translateY = (1 - animProgress) * 40; 
        posY += translateY;
        textOpacity = animProgress * textOpacity;
      } else if (textClip.animationType === 'zoom-pop') {
        const animProgress = Math.min(1, textProgress / 0.35);
        const pScale = animProgress === 1 ? 1 : Math.sin(-13 * (Math.PI / 2) * (animProgress + 1)) * Math.pow(2, -10 * animProgress) + 1;
        textScale *= pScale;
        textOpacity = Math.min(1, animProgress * 1.5) * textOpacity;
      } else if (textClip.animationType === 'glitch-shake') {
        const f = t * 60;
        const shakeX = Math.sin(f * 1.5) * 6;
        const shakeY = Math.cos(f * 2.2) * 6;
        posX += shakeX;
        posY += shakeY;
        const chars = "01$#@%&*+=_<>/?[]{}█▓▒░";
        const len = textToDisplay.length;
        const revealProgress = Math.min(1, textProgress / 0.6);
        const solvedCount = Math.floor(len * revealProgress);
        let result = "";
        for (let i = 0; i < len; i++) {
          if (i < solvedCount) {
            result += (Math.sin(f + i) > 0.95) ? chars[Math.floor(Math.sin(f + i) * 100) % chars.length] : textToDisplay[i];
          } else {
            const charIdx = Math.abs(Math.floor(Math.sin(f + i) * 100)) % chars.length;
            result += chars[charIdx];
          }
        }
        textToDisplay = result;
        ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = Math.sin(f * 4) * 5;
        textColor = textClip.textColor || '#ffffff';
      } else if (textClip.animationType === 'bounce-entrance') {
        const animProgress = Math.min(1, textProgress / 0.5);
        const n1 = 7.5625, d1 = 2.75;
        let p = 1 - animProgress;
        let ease;
        if (p < 1 / d1) { ease = n1 * p * p; }
        else if (p < 2 / d1) { ease = n1 * (p -= 1.5 / d1) * p + 0.75; }
        else if (p < 2.5 / d1) { ease = n1 * (p -= 2.25 / d1) * p + 0.9375; }
        else { ease = n1 * (p -= 2.625 / d1) * p + 0.984375; }
        posY += ease * -150; 
        textOpacity = Math.min(1, animProgress * 2) * textOpacity;
      } else if (textClip.animationType === 'rotate-drop') {
        const animProgress = Math.min(1, textProgress / 0.35);
        textRotation += (1 - animProgress) * 120;
        textScale *= animProgress;
        textOpacity = animProgress * textOpacity;
      } else if (textClip.animationType === 'rainbow-wave') {
        const hue = (t * 120) % 360;
        textColor = \`hsl(\${hue}, 90%, 65%)\`;
      } else if (textClip.animationType === 'soft-pulse') {
        textScale *= 1 + Math.sin(t * Math.PI * 2) * 0.08;
      } else if (textClip.animationType === 'blur-reveal') {
        const animProgress = Math.min(1, textProgress / 0.4);
        ctx.filter = \`blur(\${(1 - animProgress) * 20}px)\`;
        textOpacity *= animProgress;
      }
`;

const updated = content
  .replace(targetVisualAnim, replaceVisualAnim)
  .replace(targetTextAnim, replaceTextAnim);

fs.writeFileSync('src/utils/exportOffline.ts', updated);
