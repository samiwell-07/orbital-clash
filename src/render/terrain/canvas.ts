export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;
export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type CanvasFactory = (width: number, height: number) => Canvas2D;

/** HTMLCanvasElement when a DOM exists, else OffscreenCanvas (workers). Tests can inject their own factory. */
export const defaultCanvasFactory: CanvasFactory = (width, height) => {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  return new OffscreenCanvas(width, height);
};

export function context2d(canvas: Canvas2D): Context2D {
  const ctx = canvas.getContext('2d') as Context2D | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export function putRgba(canvas: Canvas2D, data: Uint8ClampedArray): void {
  const img = new ImageData(data as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height);
  context2d(canvas).putImageData(img, 0, 0);
}
