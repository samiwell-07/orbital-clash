/** Thrown by RendererApi.init when no WebGL context can be created, so the shell can show a fallback screen. */
export class WebGLUnsupportedError extends Error {
  constructor(message = 'WebGL is not available in this browser or on this device.', cause?: unknown) {
    super(message, { cause });
    this.name = 'WebGLUnsupportedError';
    Object.setPrototypeOf(this, WebGLUnsupportedError.prototype);
  }
}
