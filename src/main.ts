import { CANVAS_H, CANVAS_W } from './core/config';
import { Renderer } from './ui/Renderer';
import { Input } from './core/Input';
import { AudioFx } from './core/Audio';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game not found');

function fitCanvas(el: HTMLCanvasElement): void {
  const scale = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
  el.style.width = `${Math.floor(CANVAS_W * scale)}px`;
  el.style.height = `${Math.floor(CANVAS_H * scale)}px`;
}

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new AudioFx();
const game = new Game(renderer, input, audio);
const loop = new GameLoop(
  (dt) => game.update(dt),
  (fps) => game.render(fps),
  () => input.endFrame(),
);

fitCanvas(canvas);
window.addEventListener('resize', () => fitCanvas(canvas));
canvas.focus();
loop.start();
