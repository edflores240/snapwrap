/**
 * Film-camera looks (disposable, Polaroid, CCD, camcorder...) rendered with one small WebGL shader.
 *
 * A look is a recipe of the same ingredients the real cameras and apps use: per-channel colour
 * curves, faded blacks, shadow/highlight tints, grain, vignette, glow, lens fringing, scanlines, a
 * light leak and a date stamp. The same shader runs on the live viewfinder and on the final photo,
 * so what guests see is what they get. Browsers without WebGL fall back to plain CSS filters.
 */

type Pt = [number, number];
type RGB = [number, number, number];

export interface FilmLook {
    id: string;
    label: string;
    /** Three colours for the round filter chip */
    swatch: [string, string, string];
    curves: { r: Pt[]; g: Pt[]; b: Pt[] };
    sat: number;
    contrast: number;
    /** Lifts the blacks (0 = none) */
    fade: number;
    /** Colour added to the shadows and to the highlights */
    shadow: RGB;
    highlight: RGB;
    mono: number;
    grain: number;
    vignette: number;
    glow: number;
    /** Red/blue fringing towards the edges */
    aberration: number;
    scanlines: number;
    leak: number;
    leakColor: RGB;
    stamp: 'none' | 'date' | 'digital' | 'rec';
    stampColor: string;
    /** Approximation for browsers without WebGL */
    basic: { brightness: number; contrast: number; saturate: number; sepia: number; gray: number };
}

const ID: Pt[] = [[0, 0], [1, 1]];

const look = (l: Partial<FilmLook> & Pick<FilmLook, 'id' | 'label' | 'swatch'>): FilmLook => ({
    curves: { r: ID, g: ID, b: ID },
    sat: 1, contrast: 1, fade: 0,
    shadow: [0, 0, 0], highlight: [0, 0, 0],
    mono: 0, grain: 0, vignette: 0, glow: 0, aberration: 0, scanlines: 0,
    leak: 0, leakColor: [1, 0.45, 0.15],
    stamp: 'none', stampColor: '#ff9a3c',
    basic: { brightness: 1, contrast: 1, saturate: 1, sepia: 0, gray: 0 },
    ...l,
});

export const FILM_LOOKS: FilmLook[] = [
    look({ id: 'natural', label: 'Natural', swatch: ['#f4f1ea', '#d9d4ca', '#b9b2a4'] }),

    // Kodak FunSaver on a hot flash: warm, punchy, green-yellow shadows, heavy grain, orange date
    look({
        id: 'disposable', label: 'Disposable', swatch: ['#ffcf7a', '#ff8a3d', '#3f5a2a'],
        curves: { r: [[0, 0.03], [0.5, 0.56], [1, 1]], g: [[0, 0.02], [0.5, 0.5], [1, 0.97]], b: [[0, 0.05], [0.5, 0.42], [1, 0.86]] },
        sat: 1.22, contrast: 1.14, fade: 0.04,
        shadow: [0.0, 0.035, 0.0], highlight: [0.05, 0.025, -0.03],
        grain: 0.17, vignette: 0.38, glow: 0.25, leak: 0.32, leakColor: [1, 0.4, 0.12],
        stamp: 'date', stampColor: '#ff9a3c',
        basic: { brightness: 1.04, contrast: 1.12, saturate: 1.25, sepia: 0.16, gray: 0 },
    }),

    // Kodak Gold 200: golden hour in a box
    look({
        id: 'gold', label: 'Gold 200', swatch: ['#ffe9a8', '#f2b441', '#a1561c'],
        curves: { r: [[0, 0.04], [0.5, 0.57], [1, 1]], g: [[0, 0.03], [0.5, 0.5], [1, 0.97]], b: [[0, 0.06], [0.5, 0.4], [1, 0.8]] },
        sat: 1.1, contrast: 1.05, fade: 0.07,
        shadow: [0.02, 0.01, -0.01], highlight: [0.06, 0.03, -0.04],
        grain: 0.13, vignette: 0.28, glow: 0.3,
        basic: { brightness: 1.03, contrast: 1.05, saturate: 1.1, sepia: 0.3, gray: 0 },
    }),

    // Polaroid: faded, creamy highlights, cool lifted shadows
    look({
        id: 'polaroid', label: 'Polaroid', swatch: ['#fdf6e3', '#bfd8d2', '#e4b7a0'],
        curves: { r: [[0, 0.07], [0.5, 0.52], [1, 0.97]], g: [[0, 0.08], [0.5, 0.5], [1, 0.96]], b: [[0, 0.13], [0.5, 0.5], [1, 0.9]] },
        sat: 0.88, contrast: 0.94, fade: 0.1,
        shadow: [-0.01, 0.025, 0.04], highlight: [0.05, 0.035, 0.0],
        grain: 0.08, vignette: 0.3, glow: 0.4,
        basic: { brightness: 1.05, contrast: 0.92, saturate: 0.88, sepia: 0.2, gray: 0 },
    }),

    // Fuji 400H: pastel, cool greens, a touch of magenta in the highlights
    look({
        id: 'fuji', label: 'Fuji 400', swatch: ['#cfeadf', '#7fb7a4', '#b78fb5'],
        curves: { r: [[0, 0.03], [0.5, 0.48], [1, 0.97]], g: [[0, 0.04], [0.5, 0.53], [1, 1]], b: [[0, 0.07], [0.5, 0.52], [1, 0.96]] },
        sat: 1.08, contrast: 1.04, fade: 0.06,
        shadow: [-0.025, 0.03, 0.035], highlight: [0.03, 0.0, 0.03],
        grain: 0.11, vignette: 0.2, glow: 0.2,
        basic: { brightness: 1.03, contrast: 1.02, saturate: 1.0, sepia: 0.05, gray: 0 },
    }),

    // Early-2000s compact digicam with its flash on: blown, cool-green, fringed, digital date
    look({
        id: 'ccd', label: 'CCD', swatch: ['#e8f4ff', '#6aa6c8', '#2c3e50'],
        curves: { r: [[0, 0], [0.5, 0.5], [1, 1]], g: [[0, 0], [0.5, 0.55], [1, 1]], b: [[0, 0.02], [0.5, 0.54], [1, 1]] },
        sat: 1.18, contrast: 1.3, fade: 0.0,
        shadow: [-0.01, 0.0, 0.02], highlight: [0.0, 0.015, 0.03],
        grain: 0.16, vignette: 0.22, glow: 0.55, aberration: 0.0035,
        stamp: 'digital', stampColor: '#ff8a1f',
        basic: { brightness: 1.08, contrast: 1.25, saturate: 1.15, sepia: 0, gray: 0 },
    }),

    // Handycam: soft and smeary with scanlines, a REC badge and a timestamp
    look({
        id: 'camcorder', label: 'Camcorder', swatch: ['#c9d3d6', '#6c7a80', '#2a3238'],
        curves: { r: [[0, 0.04], [0.5, 0.5], [1, 0.95]], g: [[0, 0.05], [0.5, 0.52], [1, 0.97]], b: [[0, 0.07], [0.5, 0.52], [1, 0.97]] },
        sat: 0.72, contrast: 1.08, fade: 0.05,
        shadow: [0.0, 0.015, 0.03], highlight: [0.01, 0.01, 0.0],
        grain: 0.2, vignette: 0.4, glow: 0.3, aberration: 0.0025, scanlines: 0.35,
        stamp: 'rec', stampColor: '#ffffff',
        basic: { brightness: 1.0, contrast: 1.08, saturate: 0.72, sepia: 0.1, gray: 0 },
    }),

    // Tri-X pushed: contrasty black and white with chunky grain
    look({
        id: 'noir', label: 'B&W 400', swatch: ['#f2f2f2', '#8a8a8a', '#1b1b1b'],
        curves: { r: [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]], g: [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]], b: [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]] },
        sat: 1, contrast: 1.18, fade: 0.03, mono: 1,
        grain: 0.26, vignette: 0.42, glow: 0.2,
        basic: { brightness: 1.0, contrast: 1.2, saturate: 1, sepia: 0, gray: 1 },
    }),
];

export const lookById = (id: string): FilmLook => FILM_LOOKS.find(l => l.id === id) ?? FILM_LOOKS[0];

// ── Curves ─────────────────────────────────────────────────────────────────

/** Smooth monotone curve through the points, sampled at 256 steps */
function buildCurve(points: Pt[]): Uint8Array {
    const n = points.length;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const d: number[] = new Array(n).fill(0);
    const delta = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
    d[0] = delta[0]; d[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i++) d[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
    // Fritsch-Carlson: keep it monotone so shadows and highlights never invert
    for (let i = 0; i < n - 1; i++) {
        if (delta[i] === 0) { d[i] = 0; d[i + 1] = 0; continue; }
        const a = d[i] / delta[i], b = d[i + 1] / delta[i], s = a * a + b * b;
        if (s > 9) { const t = 3 / Math.sqrt(s); d[i] = t * a * delta[i]; d[i + 1] = t * b * delta[i]; }
    }
    const out = new Uint8Array(256);
    for (let k = 0; k < 256; k++) {
        const x = k / 255;
        let i = 0;
        while (i < n - 2 && x > xs[i + 1]) i++;
        const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
        const t2 = t * t, t3 = t2 * t;
        const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * d[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * d[i + 1];
        out[k] = Math.round(Math.min(1, Math.max(0, y)) * 255);
    }
    return out;
}

const curveCache = new Map<string, Uint8Array>();
function curveTextureData(l: FilmLook): Uint8Array {
    let data = curveCache.get(l.id);
    if (!data) {
        const r = buildCurve(l.curves.r), g = buildCurve(l.curves.g), b = buildCurve(l.curves.b);
        data = new Uint8Array(256 * 4);
        for (let i = 0; i < 256; i++) { data[i * 4] = r[i]; data[i * 4 + 1] = g[i]; data[i * 4 + 2] = b[i]; data[i * 4 + 3] = 255; }
        curveCache.set(l.id, data);
    }
    return data;
}

// ── WebGL renderer ─────────────────────────────────────────────────────────

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uCurves;
uniform vec2 uCropScale, uCropOffset, uRes;
uniform float uMirror, uSat, uContrast, uFade, uMono, uGrain, uVignette, uGlow, uAb, uScan, uSeed, uLeak;
uniform vec3 uShadow, uHigh, uLeakColor;
uniform vec2 uLeakPos;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec3 tex(vec2 uv) {
    vec2 u = vec2(mix(uv.x, 1.0 - uv.x, uMirror), uv.y);
    return texture2D(uTex, uCropOffset + clamp(u, 0.0, 1.0) * uCropScale).rgb;
}
vec3 curve(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    vec3 k = c * (255.0 / 256.0) + 0.5 / 256.0;
    return vec3(texture2D(uCurves, vec2(k.r, 0.5)).r, texture2D(uCurves, vec2(k.g, 0.5)).g, texture2D(uCurves, vec2(k.b, 0.5)).b);
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    vec3 c = uAb > 0.0 ? vec3(tex(uv + dir * uAb).r, tex(uv).g, tex(uv - dir * uAb).b) : tex(uv);

    // Halation: bright areas bleed a warm glow
    if (uGlow > 0.0) {
        vec3 b = vec3(0.0);
        vec2 px = 7.0 / uRes;
        for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398;
            b += tex(uv + vec2(cos(a), sin(a)) * px);
        }
        b /= 8.0;
        c += max(b - 0.55, 0.0) * uGlow * vec3(1.0, 0.82, 0.68) * 1.6;
    }

    c = curve(c);
    float l = lum(c);
    c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uContrast + 0.5;
    c = uFade + c * (1.0 - uFade);

    l = lum(c);
    c += uShadow * (1.0 - l) + uHigh * l;
    c = mix(c, vec3(lum(c)), uMono);

    if (uLeak > 0.0) {
        float d = distance(uv, uLeakPos);
        float leak = exp(-d * d * 5.5) * uLeak;
        c = 1.0 - (1.0 - c) * (1.0 - uLeakColor * leak);
    }

    if (uScan > 0.0) {
        float s = sin(uv.y * uRes.y * 1.5708 / max(1.0, uRes.y / 600.0));
        c *= 1.0 - uScan * 0.45 * (0.5 + 0.5 * s);
    }

    float v = smoothstep(0.42, 1.0, length(dir) * 1.45);
    c *= 1.0 - v * uVignette;

    float gs = max(1.0, uRes.y / 700.0);
    float n = hash(floor(uv * uRes / gs) + uSeed) - 0.5;
    c += n * uGrain * (1.0 - abs(l - 0.5) * 1.2);

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export interface DrawOptions { mirror: boolean; seed: number; leakPos?: [number, number] }

export class FilmRenderer {
    readonly canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private videoTex: WebGLTexture;
    private curveTex: WebGLTexture;
    private u: Record<string, WebGLUniformLocation | null> = {};
    private currentLook = '';

    private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, program: WebGLProgram) {
        this.canvas = canvas;
        this.gl = gl;
        this.program = program;
        gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        for (const name of ['uTex', 'uCurves', 'uCropScale', 'uCropOffset', 'uRes', 'uMirror', 'uSat', 'uContrast', 'uFade', 'uMono', 'uGrain', 'uVignette', 'uGlow', 'uAb', 'uScan', 'uSeed', 'uLeak', 'uShadow', 'uHigh', 'uLeakColor', 'uLeakPos']) {
            this.u[name] = gl.getUniformLocation(program, name);
        }

        const mk = (unit: number) => {
            const t = gl.createTexture()!;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        };
        this.videoTex = mk(0);
        this.curveTex = mk(1);
        gl.uniform1i(this.u.uTex, 0);
        gl.uniform1i(this.u.uCurves, 1);
    }

    /** Null when the browser has no (working) WebGL */
    static create(canvas: HTMLCanvasElement): FilmRenderer | null {
        try {
            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false }) as WebGLRenderingContext | null;
            if (!gl) return null;
            const compile = (type: number, src: string) => {
                const s = gl.createShader(type)!;
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
                return s;
            };
            const program = gl.createProgram()!;
            gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link error');
            return new FilmRenderer(canvas, gl, program);
        } catch (err) {
            console.warn('Film filters unavailable, using CSS filters:', (err as Error).message);
            return null;
        }
    }

    resize(width: number, height: number) {
        const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    draw(source: TexImageSource, srcW: number, srcH: number, l: FilmLook, opts: DrawOptions) {
        const gl = this.gl;
        const w = this.canvas.width, h = this.canvas.height;
        gl.viewport(0, 0, w, h);
        gl.useProgram(this.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        if (this.currentLook !== l.id) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, curveTextureData(l));
            this.currentLook = l.id;
        }

        // Crop the source to the output's shape, like object-fit: cover
        const frameRatio = w / h, srcRatio = srcW / srcH;
        let sx = 1, sy = 1;
        if (srcRatio > frameRatio) sx = frameRatio / srcRatio; else sy = srcRatio / frameRatio;

        const u = this.u;
        gl.uniform2f(u.uCropScale, sx, sy);
        gl.uniform2f(u.uCropOffset, (1 - sx) / 2, (1 - sy) / 2);
        gl.uniform2f(u.uRes, w, h);
        gl.uniform1f(u.uMirror, opts.mirror ? 1 : 0);
        gl.uniform1f(u.uSat, l.sat);
        gl.uniform1f(u.uContrast, l.contrast);
        gl.uniform1f(u.uFade, l.fade);
        gl.uniform1f(u.uMono, l.mono);
        gl.uniform1f(u.uGrain, l.grain);
        gl.uniform1f(u.uVignette, l.vignette);
        gl.uniform1f(u.uGlow, l.glow);
        gl.uniform1f(u.uAb, l.aberration);
        gl.uniform1f(u.uScan, l.scanlines);
        gl.uniform1f(u.uSeed, opts.seed);
        gl.uniform1f(u.uLeak, l.leak);
        gl.uniform3f(u.uShadow, ...l.shadow);
        gl.uniform3f(u.uHigh, ...l.highlight);
        gl.uniform3f(u.uLeakColor, ...l.leakColor);
        const lp = opts.leakPos ?? [0.95, 0.12];
        gl.uniform2f(u.uLeakPos, lp[0], lp[1]);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    destroy() {
        const gl = this.gl;
        gl.deleteTexture(this.videoTex);
        gl.deleteTexture(this.curveTex);
        gl.deleteProgram(this.program);
        // The context is left alone on purpose: a canvas whose context was force-lost can't get a new one,
        // and React may mount the viewfinder twice in development. The browser frees it with the canvas.
    }
}

// ── Date stamp / REC badge (2D overlay, shared by the live view and the saved photo) ──

export function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, l: FilmLook, date = new Date()) {
    if (l.stamp === 'none') return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const unit = Math.min(w, h);
    ctx.save();
    ctx.textBaseline = 'bottom';

    if (l.stamp === 'date') {
        const size = unit * 0.05;
        ctx.font = `700 ${size}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(255,110,0,0.85)';
        ctx.shadowBlur = size * 0.55;
        ctx.fillStyle = l.stampColor;
        ctx.fillText(`'${String(date.getFullYear()).slice(2)} ${pad(date.getMonth() + 1)} ${pad(date.getDate())}`, w - unit * 0.05, h - unit * 0.05);
    } else if (l.stamp === 'digital') {
        const size = unit * 0.034;
        ctx.font = `700 ${size}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(255,90,0,0.7)';
        ctx.shadowBlur = size * 0.4;
        ctx.fillStyle = l.stampColor;
        ctx.fillText(`${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}`, w - unit * 0.045, h - unit * 0.045);
    } else if (l.stamp === 'rec') {
        const size = unit * 0.04;
        ctx.font = `700 ${size}px "Courier New", monospace`;
        ctx.fillStyle = l.stampColor;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = size * 0.25;
        ctx.textAlign = 'left';
        ctx.fillText(`${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`, unit * 0.05, h - unit * 0.075);
        ctx.fillText(`${date.getHours() % 12 || 12}:${pad(date.getMinutes())} ${date.getHours() < 12 ? 'AM' : 'PM'}`, unit * 0.05, h - unit * 0.035);
        ctx.textBaseline = 'top';
        ctx.fillText('PLAY ►', unit * 0.05, unit * 0.05);
        // REC dot
        ctx.textAlign = 'right';
        ctx.fillText('REC', w - unit * 0.1, unit * 0.05);
        ctx.fillStyle = '#ff2d2d';
        ctx.shadowColor = 'rgba(255,0,0,0.8)';
        ctx.beginPath();
        ctx.arc(w - unit * 0.07, unit * 0.05 + size * 0.45, size * 0.38, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
