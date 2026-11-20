import './style.css';

import { createApp } from './app/createApp';

const gl = document.getElementById('game') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLCanvasElement;
const app = createApp({ gl, hud });

(window as unknown as { orbital: typeof app }).orbital = app;
