import './style.css';

// Wired together by the integration step (see docs/ARCHITECTURE.md).
const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (canvas) canvas.dataset.booted = '1';
