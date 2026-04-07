/* ======================================================
   effects.js — Efectos atmosféricos: niebla + partículas
   ======================================================

   Uso desde game.js:
     updateEffects('fondo-bosque');   ← se llama en loadScene()

   Para agregar efectos a una nueva escena:
     Agregá una entrada en SCENE_EFFECTS con estos campos:
       fog:            'none' | 'light' | 'medium' | 'heavy'
       particles:      'none' | 'dust' | 'ash'
       particleCount:  número (máximo recomendado: 25)
   ====================================================== */


/* ======================================================
   1. CONFIGURACIÓN POR ESCENA
   ====================================================== */

const SCENE_EFFECTS = {
  'fondo-taberna':        { fog: 'light',  particles: 'dust', particleCount: 12 },
  'fondo-noche':          { fog: 'medium', particles: 'none', particleCount: 0  },
  'fondo-bosque':         { fog: 'heavy',  particles: 'dust', particleCount: 20 },
  'fondo-aldea-quemada':  { fog: 'light',  particles: 'ash',  particleCount: 25 },
  'fondo-cueva':          { fog: 'heavy',  particles: 'none', particleCount: 0  },
  'fondo-laboratorio':    { fog: 'medium', particles: 'dust', particleCount: 10 },
  'fondo-amanecer':       { fog: 'none',   particles: 'dust', particleCount: 8  },
  'fondo-muerte':         { fog: 'heavy',  particles: 'ash',  particleCount: 25 },
};

// Opacidad del contenedor #fog-layer por nivel
// El valor final renderizado = esta opacidad × opacidad interna de los gradientes
const FOG_OPACITY = {
  none:   0,
  light:  0.07,
  medium: 0.13,
  heavy:  0.20,
};


/* ======================================================
   2. SISTEMA DE NIEBLA (CSS — GPU animado)
   ====================================================== */

/**
 * Ajusta la opacidad del contenedor de niebla.
 * La transición CSS de 1.8s hace el fade automáticamente.
 * @param {'none'|'light'|'medium'|'heavy'} nivel
 */
function setFog(nivel) {
  const fogLayer = document.getElementById('fog-layer');
  if (!fogLayer) return;
  fogLayer.style.opacity = FOG_OPACITY[nivel] ?? 0;
}


/* ======================================================
   3. SISTEMA DE PARTÍCULAS (Canvas + requestAnimationFrame)
   ====================================================== */

const canvas = document.getElementById('particles-canvas');
const ctx    = canvas?.getContext('2d');

let particles   = [];
let animFrameId = null;   // id de la animación activa (para cancelarla)

/** Ajusta el canvas al tamaño de la ventana. */
function resizeCanvas() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

/* ── Clase Particle ────────────────────────────────── */

class Particle {
  /**
   * @param {'dust'|'ash'} tipo
   * @param {boolean} randomY — true al activar la escena (distribuir por pantalla)
   */
  constructor(tipo, randomY = false) {
    this.tipo = tipo;
    this._init(randomY);
  }

  _init(randomY = false) {
    // Posición inicial
    this.x = Math.random() * canvas.width;
    this.y = randomY
      ? Math.random() * canvas.height          // distribuido al cargar
      : canvas.height + Math.random() * 80;    // desde abajo al respawnear

    if (this.tipo === 'ash') {
      // Cenizas: más grandes, más opacas, derivan más
      this.radio    = Math.random() * 2.2 + 0.8;          // 0.8–3px
      this.vy       = -(Math.random() * 0.45 + 0.12);     // sube
      this.vx       = (Math.random() - 0.5) * 0.65;       // deriva lateral
      this.opacidad = Math.random() * 0.55 + 0.18;
      const g       = 120 + Math.floor(Math.random() * 70);
      this.color    = `${g}, ${g - 15}, ${g - 25}`;       // gris cálido
    } else {
      // Polvo: pequeño, sutil, casi sin deriva
      this.radio    = Math.random() * 1.6 + 0.3;          // 0.3–2px
      this.vy       = -(Math.random() * 0.22 + 0.06);     // sube muy lento
      this.vx       = (Math.random() - 0.5) * 0.25;
      this.opacidad = Math.random() * 0.30 + 0.06;
      this.color    = '205, 195, 175';                     // dorado pálido
    }

    // Fase de oscilación aleatoria → cada partícula se mueve diferente
    this.wobbleFase  = Math.random() * Math.PI * 2;
    this.wobbleVel   = Math.random() * 0.018 + 0.007;
  }

  update() {
    this.y           += this.vy;
    this.x           += this.vx;
    this.wobbleFase  += this.wobbleVel;
    this.x           += Math.sin(this.wobbleFase) * 0.28;  // oscilación suave

    // Respawn al salir por arriba
    if (this.y < -8) this._init(false);

    // Teletransporte horizontal (sin corte visual)
    if (this.x < -6)               this.x = canvas.width + 6;
    if (this.x > canvas.width + 6) this.x = -6;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color}, ${this.opacidad})`;
    ctx.fill();
  }
}

/* ── Loop de animación ─────────────────────────────── */

function animLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  animFrameId = requestAnimationFrame(animLoop);
}

/**
 * Inicia el sistema de partículas con el tipo y cantidad dados.
 * Cancela automáticamente la animación anterior.
 * @param {'none'|'dust'|'ash'} tipo
 * @param {number} cantidad
 */
function startParticles(tipo, cantidad) {
  // Siempre cancelar el frame anterior primero
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  particles = [];
  ctx?.clearRect(0, 0, canvas?.width, canvas?.height);

  if (tipo === 'none' || cantidad === 0) return;

  // Crear partículas distribuidas por la pantalla (randomY = true)
  for (let i = 0; i < cantidad; i++) {
    particles.push(new Particle(tipo, true));
  }

  animLoop();
}


/* ======================================================
   4. FUNCIÓN PÚBLICA — llamada desde game.js
   ====================================================== */

/**
 * Activa los efectos correspondientes a una clase de fondo.
 * Se llama en loadScene() después del fade del fondo.
 * @param {string} imagenClass — ej: 'fondo-bosque'
 */
function updateEffects(imagenClass) {
  const config = SCENE_EFFECTS[imagenClass] ?? {
    fog: 'none', particles: 'none', particleCount: 0,
  };

  setFog(config.fog);
  startParticles(config.particles, config.particleCount);
}


/* ======================================================
   5. INICIALIZACIÓN
   ====================================================== */

// Ajustar canvas al arrancar
resizeCanvas();

// Re-ajustar al redimensionar la ventana
window.addEventListener('resize', () => {
  resizeCanvas();
  // Reposicionar partículas que quedaron fuera de pantalla
  particles.forEach(p => {
    if (p.x > canvas.width)  p.x = Math.random() * canvas.width;
    if (p.y > canvas.height) p.y = Math.random() * canvas.height;
  });
});
