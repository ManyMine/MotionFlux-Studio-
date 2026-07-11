const fs = require('fs');
const content = fs.readFileSync('src/utils/exportOffline.ts', 'utf8');

const targetTransitions = `
      // Transitions
      const videoClips = clips.filter(c => (c.type === 'image' || c.type === 'video'));
      const trackClips = videoClips.filter(c => c.trackId === clip.trackId).sort((a, b) => a.startTime - b.startTime);
      const clipIdx = trackClips.findIndex(c => c.id === clip.id);
      const prevClip = trackClips[clipIdx - 1];
      const nextClip = trackClips[clipIdx + 1];
      let visualStart = clip.startTime;
      let visualEnd = clipEndTime;

      if (prevClip && prevClip.transitionNext && Math.abs(prevClip.startTime + (prevClip.clipEndOffset - prevClip.clipStartOffset) - clip.startTime) < 0.1) {
        visualStart -= 0.5;
        const transProgress = (t - visualStart) / 1.0;
        if (transProgress >= 0 && transProgress <= 1) {
          if (prevClip.transitionNext === 'fade') opacity *= transProgress;
          else if (prevClip.transitionNext === 'zoom') { scale *= transProgress; opacity *= transProgress; }
          // ... basic implementations for offline
        }
      }
      if (clip.transitionNext && nextClip && Math.abs(clipEndTime - nextClip.startTime) < 0.1) {
        visualEnd += 0.5;
        const transProgress = (t - (clipEndTime - 0.5)) / 1.0;
        if (transProgress >= 0 && transProgress <= 1) {
          if (clip.transitionNext === 'fade') opacity *= (1 - transProgress);
          else if (clip.transitionNext === 'zoom') { scale *= (1 - transProgress); opacity *= (1 - transProgress); }
        }
      }
`;

const replaceTransitions = `
      let clipPathRect = null;
      // Clip-level Transition In
      if (clip.transitionIn) {
          const inDur = clip.transitionInDuration || 0.5;
          const tIn = t - clip.startTime;
          if (tIn >= 0 && tIn <= inDur) {
              const p = tIn / inDur;
              const easeProgress = -(Math.cos(Math.PI * p) - 1) / 2;
              
              const tInType = clip.transitionIn;
              if (tInType === 'fade' || tInType === 'dissolve') {
                  opacity *= easeProgress;
              } else if (tInType === 'wipe-left') {
                  clipPathRect = { x: 0, y: 0, w: easeProgress * canvas.width, h: canvas.height };
              } else if (tInType === 'wipe-right') {
                  clipPathRect = { x: canvas.width * (1 - easeProgress), y: 0, w: easeProgress * canvas.width, h: canvas.height };
              } else if (tInType === 'wipe-up') {
                  clipPathRect = { x: 0, y: 0, w: canvas.width, h: easeProgress * canvas.height };
              } else if (tInType === 'wipe-down') {
                  clipPathRect = { x: 0, y: canvas.height * (1 - easeProgress), w: canvas.width, h: easeProgress * canvas.height };
              } else if (tInType === 'slide-left') {
                  posX += (1 - easeProgress) * 400;
              } else if (tInType === 'slide-right') {
                  posX -= (1 - easeProgress) * 400;
              } else if (tInType === 'slide-up') {
                  posY += (1 - easeProgress) * 400;
              } else if (tInType === 'slide-down') {
                  posY -= (1 - easeProgress) * 400;
              } else if (tInType === 'push-left') {
                  posX += (1 - easeProgress) * 400;
                  opacity *= easeProgress;
              } else if (tInType === 'push-right') {
                  posX -= (1 - easeProgress) * 400;
                  opacity *= easeProgress;
              } else if (tInType === 'zoom-in') {
                  scale *= Math.max(0.01, easeProgress);
                  opacity *= easeProgress;
              } else if (tInType === 'zoom-out') {
                  scale *= (2 - easeProgress);
                  opacity *= easeProgress;
              } else if (tInType === 'spin') {
                  rotation += (1 - easeProgress) * 360;
              } else if (tInType === 'blur-fade') {
                  opacity *= easeProgress;
              } else if (tInType === 'color-flash-white') {
                  ctx.filter = (ctx.filter || 'none') !== 'none' ? ctx.filter + \` brightness(\${1 + (1 - easeProgress) * 3})\` : \`brightness(\${1 + (1 - easeProgress) * 3})\`;
              } else if (tInType === 'color-flash-black') {
                  ctx.filter = (ctx.filter || 'none') !== 'none' ? ctx.filter + \` brightness(\${easeProgress})\` : \`brightness(\${easeProgress})\`;
              }
          }
      }
      
      // Clip-level Transition Out
      if (clip.transitionOut) {
          const outDur = clip.transitionOutDuration || 0.5;
          const tOut = clipEndTime - t;
          if (tOut >= 0 && tOut <= outDur) {
              const p = (t - (clipEndTime - outDur)) / outDur;
              const easeProgress = -(Math.cos(Math.PI * p) - 1) / 2;
              
              const tOutType = clip.transitionOut;
              if (tOutType === 'fade' || tOutType === 'dissolve') {
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'wipe-left') {
                  clipPathRect = { x: easeProgress * canvas.width, y: 0, w: (1 - easeProgress) * canvas.width, h: canvas.height };
              } else if (tOutType === 'wipe-right') {
                  clipPathRect = { x: 0, y: 0, w: (1 - easeProgress) * canvas.width, h: canvas.height };
              } else if (tOutType === 'wipe-up') {
                  clipPathRect = { x: 0, y: easeProgress * canvas.height, w: canvas.width, h: (1 - easeProgress) * canvas.height };
              } else if (tOutType === 'wipe-down') {
                  clipPathRect = { x: 0, y: 0, w: canvas.width, h: (1 - easeProgress) * canvas.height };
              } else if (tOutType === 'slide-left') {
                  posX -= easeProgress * 400;
              } else if (tOutType === 'slide-right') {
                  posX += easeProgress * 400;
              } else if (tOutType === 'slide-up') {
                  posY -= easeProgress * 400;
              } else if (tOutType === 'slide-down') {
                  posY += easeProgress * 400;
              } else if (tOutType === 'push-left') {
                  posX -= easeProgress * 400;
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'push-right') {
                  posX += easeProgress * 400;
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'zoom-in') {
                  scale *= 1 + (easeProgress * 0.5);
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'zoom-out') {
                  scale *= Math.max(0.01, 1 - easeProgress);
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'spin') {
                  rotation -= easeProgress * 360;
              } else if (tOutType === 'blur-fade') {
                  opacity *= (1 - easeProgress);
              } else if (tOutType === 'color-flash-white') {
                  ctx.filter = (ctx.filter || 'none') !== 'none' ? ctx.filter + \` brightness(\${1 + easeProgress * 3})\` : \`brightness(\${1 + easeProgress * 3})\`;
              } else if (tOutType === 'color-flash-black') {
                  ctx.filter = (ctx.filter || 'none') !== 'none' ? ctx.filter + \` brightness(\${1 - easeProgress})\` : \`brightness(\${1 - easeProgress})\`;
              }
          }
      }
`;

const updated = content.replace(targetTransitions, replaceTransitions);
fs.writeFileSync('src/utils/exportOffline.ts', updated);
