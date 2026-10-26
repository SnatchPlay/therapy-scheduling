import type { SmokeState } from "./timeline";

// Малює хрест з диму у WebGL: форма хреста (SDF), викривлена кількома шарами шуму, що повільно піднімається вгору.
// Колір — токен primary (DESIGN.md), прозорий фон канви: під димом видно тло сторінки.

const VERTEX = `attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime, uScale, uAlpha, uWarp;
uniform vec3 uColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float crossShape(vec2 p) { return min(box(p, vec2(.30, .085)), box(p, vec2(.085, .30))) - .025; }

void main() {
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y) / uScale;
  float t = uTime;
  vec2 q = vec2(fbm(p * 2.2 + vec2(0., -t * .12)), fbm(p * 2.2 + vec2(5.2, 1.3 - t * .1)));
  vec2 r = vec2(fbm(p * 2.8 + 4. * q + vec2(1.7, 9.2) + t * .04), fbm(p * 2.8 + 4. * q + vec2(8.3, 2.8) - t * .05));
  float d = crossShape(p + (r - .5) * uWarp);
  float n = fbm(p * 3.5 + r * 2.5 + vec2(0., -t * .22));
  float body = 1. - smoothstep(-.06, .03, d);
  float halo = exp(-max(d, 0.) * 10.) * n;
  float density = clamp(body * (.45 + .75 * n) + halo * .8, 0., 1.);
  // clamp: у premultiplied alpha колір не може бути більшим за непрозорість.
  // Лише відтінки primary (DESIGN.md, розділ 11): світліше й темніше від шуму, без домішки іншого кольору.
  vec3 color = clamp(uColor * (.65 + .7 * n), 0., 1.);
  float alpha = density * uAlpha;
  gl_FragColor = vec4(color * alpha, alpha);
}`;

// Дим розмитий, тож повна роздільність не потрібна: менше пікселів — менше роботи GPU на кожен кадр.
const RESOLUTION = 0.5;

export type SmokeRenderer = {
  draw(state: SmokeState, seconds: number): void;
  setColor(rgb: readonly [number, number, number]): void;
  dispose(): void;
};

/** null — WebGL недоступний або шейдер не зібрався: тло декоративне, сторінка працює й без нього. */
export function createSmokeRenderer(canvas: HTMLCanvasElement): SmokeRenderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const program = gl.createProgram();
  const shaders: WebGLShader[] = [];
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    // null — контекст уже втрачено: декоративне тло не має валити кореневий layout.
    const shader = gl.createShader(type);
    if (!shader) return null;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("smoke backdrop: shader", gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("smoke backdrop: program", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Один трикутник, що накриває весь екран.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    res: uniform("uRes"),
    time: uniform("uTime"),
    scale: uniform("uScale"),
    alpha: uniform("uAlpha"),
    warp: uniform("uWarp"),
    color: uniform("uColor"),
  };

  return {
    draw(state, seconds) {
      const width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION));
      const height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.time, seconds);
      gl.uniform1f(u.scale, state.scale);
      gl.uniform1f(u.alpha, state.alpha);
      gl.uniform1f(u.warp, state.warp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    setColor(rgb) {
      gl.uniform3fv(u.color, rgb);
    },
    // Контекст не втрачаємо: у dev React монтує ефект двічі, і канва мусить віддати робочий контекст удруге.
    dispose() {
      gl.deleteBuffer(buffer);
      for (const shader of shaders) gl.deleteShader(shader);
      gl.deleteProgram(program);
    },
  };
}

/** Будь-який CSS-колір (зокрема oklch із токена) → sRGB 0–1 для шейдера: його перетворює сам браузер. */
export function cssColorToRgb(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
