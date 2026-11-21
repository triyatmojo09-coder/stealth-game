// SHADOW PROTOCOL — keyboard and mouse input.
// One job: track which keys are held, the mouse position over the canvas,
// and single-press events (a key going down, a click) for one frame.

export class Input {
  constructor(canvas, onFirstGesture) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.clicked = false;
    this.onFirstGesture = onFirstGesture || (() => {});
    this.gestureDone = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.gesture();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.clicked = true;
      this.gesture();
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  gesture() {
    if (!this.gestureDone) {
      this.gestureDone = true;
      this.onFirstGesture();
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down. Consumed by endFrame().
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement vector from WASD or arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get sneaking() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
