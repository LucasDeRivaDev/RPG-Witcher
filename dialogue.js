/* ======================================================
   dialogue.js — Sistema de diálogos con retrato y typewriter

   Uso desde game.js:
     startDialogue(lineas, onFin);

   Formato de cada línea:
     {
       hablante:  'Nombre del personaje',
       retrato:   'assets/portraits/npc/X.png',
       texto:     'Lo que dice el personaje.',
     }
   ====================================================== */


/* ======================================================
   1. UTILIDAD — Eliminar fondo blanco de imágenes con Canvas
   ====================================================== */

/**
 * Lee los píxeles de una imagen con Canvas y hace transparentes
 * todos los píxeles blancos o casi blancos.
 * Se llama automáticamente cuando se carga un retrato.
 *
 * @param {HTMLImageElement} imgEl   — el <img> a procesar
 * @param {number}           umbral  — 0-255, qué tan "blanco" cuenta (def. 230)
 */
function quitarFondoBlanco(imgEl, umbral = 230) {
  const cv  = document.createElement('canvas');
  cv.width  = imgEl.naturalWidth;
  cv.height = imgEl.naturalHeight;

  const ctx  = cv.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);

  const imageData = ctx.getImageData(0, 0, cv.width, cv.height);
  const d         = imageData.data;   // array plano [R,G,B,A, R,G,B,A, ...]

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];

    if (r >= umbral && g >= umbral && b >= umbral) {
      // Calcula cuánto "color" tiene el píxel vs puro blanco
      // → los píxeles de borde/anti-aliasing quedan semitransparentes
      const colorMax = Math.max(255 - r, 255 - g, 255 - b);
      d[i + 3] = Math.min(d[i + 3], colorMax * 4);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  imgEl.src = cv.toDataURL('image/png');
}

/**
 * Asigna src a un <img> y al cargar aplica quitarFondoBlanco.
 * @param {HTMLImageElement} imgEl
 * @param {string}           src
 */
function _setPortrait(imgEl, src) {
  if (!src) {
    imgEl.src          = '';
    imgEl.style.display = 'none';
    return;
  }

  imgEl.style.display = 'block';

  // Si es la misma imagen que ya tiene, no recargar
  if (imgEl.dataset.processedSrc === src) return;

  const tmp    = new Image();
  tmp.crossOrigin = 'anonymous';
  tmp.onload   = () => {
    imgEl.dataset.processedSrc = src;
    // Copiar a canvas para quitar blanco y asignar al <img> real
    const cv  = document.createElement('canvas');
    cv.width  = tmp.naturalWidth;
    cv.height = tmp.naturalHeight;
    const ctx  = cv.getContext('2d');
    ctx.drawImage(tmp, 0, 0);

    const imageData = ctx.getImageData(0, 0, cv.width, cv.height);
    const d         = imageData.data;
    const umbral    = 230;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r >= umbral && g >= umbral && b >= umbral) {
        const colorMax = Math.max(255 - r, 255 - g, 255 - b);
        d[i + 3] = Math.min(d[i + 3], colorMax * 4);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    imgEl.src = cv.toDataURL('image/png');
  };
  tmp.src = src;
}


/* ======================================================
   2. ESTADO DEL DIÁLOGO
   ====================================================== */

const dialogState = {
  lineas:      [],
  indice:      0,
  escribiendo: false,
  timerID:     null,
  onFin:       null,
};


/* ======================================================
   3. API PÚBLICA
   ====================================================== */

/**
 * Inicia una secuencia de diálogo.
 * @param {Array}    lineas  — array de { hablante, retrato, texto }
 * @param {Function} onFin   — callback al cerrar el último diálogo
 */
function startDialogue(lineas, onFin) {
  if (!lineas || lineas.length === 0) {
    if (typeof onFin === 'function') onFin();
    return;
  }

  dialogState.lineas = lineas;
  dialogState.indice = 0;
  dialogState.onFin  = onFin || null;

  // gameState está definido en game.js (cargado después, pero disponible al llamar)
  if (typeof setState === 'function') setState('dialogo');

  document.getElementById('dialogue-box').classList.remove('hidden');
  _mostrarLinea(0);
}

/**
 * Avanza al siguiente diálogo (botón "Continuar").
 * Si el typewriter está activo → salta al texto completo.
 * Si ya terminó → avanza a la siguiente línea.
 */
function nextDialogueLine() {
  if (dialogState.escribiendo) {
    _cancelarTypewriter();
    const linea = dialogState.lineas[dialogState.indice];
    const el    = document.getElementById('dialogue-text');
    el.textContent = linea.texto;
    el.classList.remove('typing');
    dialogState.escribiendo = false;
    return;
  }

  dialogState.indice++;
  if (dialogState.indice < dialogState.lineas.length) {
    _mostrarLinea(dialogState.indice);
  } else {
    _cerrarDialogo();
  }
}


/* ======================================================
   4. FUNCIONES INTERNAS
   ====================================================== */

function _mostrarLinea(idx) {
  const linea    = dialogState.lineas[idx];
  const portrait = document.getElementById('dialogue-portrait');
  const speaker  = document.getElementById('dialogue-speaker');
  const textEl   = document.getElementById('dialogue-text');

  // Retrato con fondo blanco eliminado
  _setPortrait(portrait, linea.retrato || '');

  // Hablante
  speaker.textContent = linea.hablante || '';

  // Typewriter
  textEl.textContent = '';
  textEl.classList.add('typing');
  _iniciarTypewriter(linea.texto, textEl);
}

function _iniciarTypewriter(texto, el) {
  const VELOCIDAD = 28;
  let i = 0;
  dialogState.escribiendo = true;

  _cancelarTypewriter();

  dialogState.timerID = setInterval(() => {
    el.textContent += texto[i];
    i++;
    if (i >= texto.length) {
      _cancelarTypewriter();
      el.classList.remove('typing');
      dialogState.escribiendo = false;
    }
  }, VELOCIDAD);
}

function _cancelarTypewriter() {
  if (dialogState.timerID !== null) {
    clearInterval(dialogState.timerID);
    dialogState.timerID = null;
  }
}

function _cerrarDialogo() {
  _cancelarTypewriter();
  dialogState.escribiendo = false;

  document.getElementById('dialogue-box').classList.add('hidden');
  document.getElementById('dialogue-text').textContent    = '';
  document.getElementById('dialogue-speaker').textContent = '';
  document.getElementById('dialogue-portrait').src        = '';

  // Restaurar el estado anterior al diálogo (narrativa o combate)
  if (typeof setState === 'function' && typeof gameState !== 'undefined') {
    setState(gameState.anterior);
  }

  if (typeof dialogState.onFin === 'function') {
    dialogState.onFin();
    dialogState.onFin = null;
  }
}
