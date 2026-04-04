/* ======================================================
   EL BRUJO DEL GATO — RPG NARRATIVO v2.0
   game.js — Sistema de escenas + combate mejorado

   ÍNDICE:
   1.  Estado del jugador
   2.  Estado del combate
   3.  ENEMIES — enemigos regulares
   4.  BOSS    — jefe de dos fases
   5.  SCENES  — todas las escenas del juego
   6.  Motor de escenas (loadScene, renderOptions, applyEffect)
   7.  Helpers de combate (calcularDaño, verificarEsquiva)
   8.  Sistema de combate (startCombat, combatAction, turnoEnemigo)
   9.  IA del boss fase 2
   10. Transición de fase del boss
   11. Fin de combate
   12. UI de combate
   13. Stats y notificaciones
   14. Reinicio e inicialización

   ── Cómo agregar una escena nueva ──────────────────────
   En el objeto SCENES agregá una entrada así:

     mi_escena: {
       id:     'mi_escena',
       titulo: 'Título visible',
       imagen: 'fondo-bosque',          ← clase CSS de style.css
       texto:  'Narración de la escena...',
       onEnter: () => applyEffect({ exp: 10 }),   ← opcional
       opciones: [
         {
           texto:          'Texto del botón',
           siguienteEscena:'otra_clave',    ← navegar a otra escena
         },
         {
           texto:          'Combatir',
           combate:        'lobo_maldito', ← clave de ENEMIES
           escenaVictoria: 'escena_post',  ← adónde ir al ganar
           dañoInicial:    0,              ← daño previo (opcional)
         },
         {
           texto:     'Opción cara',
           condicion: () => player.oro >= 20,   ← ocultar si false
           efecto:    { oro: -20, vida: 40 },   ← cambio de stats
           siguienteEscena: 'resultado',
         },
       ],
     },

   ── Cómo agregar un enemigo nuevo ──────────────────────
   En el objeto ENEMIES agregá una entrada con estos campos:
   nombre, vidaMax, ataqueMin, ataqueMax, velocidad, defensa,
   critChance, critMult, visual, descripcion, recompensaOro, recompensaExp
   ====================================================== */


/* ======================================================
   1. ESTADO DEL JUGADOR
   ====================================================== */
const player = {
  vida:        100,
  vidaMax:     100,
  oro:         50,
  experiencia: 0,
  nivel:       1,
};


/* ======================================================
   2. ESTADO DEL COMBATE
   ====================================================== */
const combat = {
  activo:           false,
  enemigo:          null,    // objeto con stats del enemigo actual
  enemigoVida:      0,

  // Mecánicas del jugador
  esquivandoJugador:  false, // true si eligió esquivar este turno
  igniCooldown:       0,     // turnos restantes para usar Igni
  burnTurnos:         0,     // turnos de quemadura activos (Igni)
  burnDaño:           6,     // daño por turno de quemadura

  // Mecánicas del enemigo
  enemigoEsquivando: false,  // true si el boss usó su stance defensiva

  // Destinos post-combate
  escenaVictoria:  '',
  escenaMuerte:    'muerte',

  // Estado del boss
  esBoss:        false,
  faseActual:    1,
  enTransicion:  false,      // pausa durante el cutscene de fase 2
};


/* ======================================================
   3. ENEMIES — criaturas regulares

   Campos:
     nombre      — nombre en pantalla
     vidaMax     — puntos de vida
     ataqueMin/Max — rango de daño por turno
     velocidad   — probabilidad de esquivar ataques (0.0–1.0)
     defensa     — reducción plana de daño recibido
     critChance  — probabilidad de golpe crítico (0.0–1.0)
     critMult    — multiplicador del daño crítico
     visual      — emoji
     descripcion — texto al iniciar el combate
     recompensaOro/Exp — recompensa al morir
   ====================================================== */
const ENEMIES = {

  nekker: {
    nombre:       "Nekker",
    vidaMax:      35,
    ataqueMin:    7,
    ataqueMax:    13,
    velocidad:    0.10,   // 10% de chance de esquivar
    defensa:      0,
    critChance:   0.10,
    critMult:     1.6,
    visual:       "👺",
    descripcion:  "Un humanoide pequeño con dientes como agujas. Suelen ir en manada.",
    recompensaOro: 18,
    recompensaExp: 30,
  },

  lobo_maldito: {
    nombre:       "Lobo Maldito",
    vidaMax:      55,
    ataqueMin:    10,
    ataqueMax:    20,
    velocidad:    0.22,   // rápido, esquiva bastante
    defensa:      2,
    critChance:   0.15,
    critMult:     1.8,
    visual:       "🐺",
    descripcion:  "Sus ojos brillan con luz propia. Algo oscuro lo controla desde adentro.",
    recompensaOro: 28,
    recompensaExp: 50,
  },

  /* ── Plantilla para un enemigo nuevo ──────────────────
  nombre_clave: {
    nombre:        "Nombre Visible",
    vidaMax:       60,
    ataqueMin:     10,
    ataqueMax:     20,
    velocidad:     0.15,   // 0 = nunca esquiva · 1 = siempre esquiva
    defensa:       3,      // reduce daño recibido en X puntos planos
    critChance:    0.15,   // 0 = sin críticos · 1 = siempre crítico
    critMult:      1.8,    // daño × critMult al criticar
    visual:        "👾",
    descripcion:   "Texto que aparece al iniciar el combate.",
    recompensaOro: 25,
    recompensaExp: 45,
  },
  ─────────────────────────────────────────────────────── */
};


/* ======================================================
   4. BOSS — El Jefe Final, dos fases

   Fase 1: La Bestia de Verano — criatura rápida y agresiva
   Fase 2: Gael el Mutado — usa señales como un brujo real

   La transición ocurre cuando la fase 1 cae por debajo
   del umbralFase2 (40% de vida).

   La fase 2 tiene IA especial con habilidades y probabilidades
   configurables (ver turnoEnemigoBossFase2).
   ====================================================== */
const BOSS = {
  esBoss:       true,
  umbralFase2:  0.40,  // porcentaje de vida que activa la fase 2

  fase1: {
    nombre:      "La Bestia de Verano",
    vidaMax:     110,
    ataqueMin:   14,
    ataqueMax:   26,
    velocidad:   0.30,   // muy rápida — esquiva 30% de los ataques
    defensa:     3,
    critChance:  0.22,
    critMult:    2.0,
    visual:      "🦇",
    descripcion: "Se mueve como un relámpago entre las sombras de la cueva.",
  },

  fase2: {
    nombre:       "Gael — Brujo Mutado",
    vidaMax:      85,
    ataqueMin:    12,
    ataqueMax:    28,
    velocidad:    0.15,  // más lento pero más calculador
    defensa:      5,
    critChance:   0.28,
    critMult:     2.2,
    visual:       "🧙",
    descripcion:  "Ya no es solo una bestia. Recuerda quién fue. Y eso lo hace más peligroso.",
    recompensaOro: 120,
    recompensaExp: 200,

    // IA de fase 2: lista de acciones y sus probabilidades
    // Deben sumar 1.0
    habilidades:    ['atacar', 'señal',  'curar', 'esquivar_activo'],
    probabilidades: [  0.35,    0.35,    0.15,       0.15          ],

    // Si la vida cae por debajo del 20%, hay 60% de chance de curar
    // en lugar de la acción normal (override de emergencia)
    umbralCuracionEmergencia: 0.20,
  },
};


/* ======================================================
   5. SCENES — Todas las escenas del juego

   Estructura de cada escena:
   {
     id:      'clave_unica',
     titulo:  'Título visible en pantalla',
     imagen:  'nombre-clase-css',   ← clase de fondo en style.css
     texto:   'Narración...',
     onEnter: () => { ... },        ← ejecutado al cargar (opcional)
     opciones: [ ... ],             ← ver estructura arriba
   }
   ====================================================== */
const SCENES = {

  /* ── ESCENA 1: EL CONTRATO ──────────────────────────── */
  taberna_contrato: {
    id:     'taberna_contrato',
    titulo: "El Contrato",
    imagen: "fondo-taberna",
    texto:
`La Escuela del Gato entrena brujos para la velocidad y el sigilo.
Vos sos uno de los mejores — y uno de los más caros.

El alcalde Aldric de Verano entra a la taberna sin mirar a nadie
a los ojos. Pone una bolsa sobre la mesa. Tiene peso.

"Hay algo en los bosques al norte. Un mes de ataques. Primero los
animales, después la gente. Rápido, silencioso. Nadie que lo vio
pudo describir bien qué era. Solo dicen que se mueve como el viento."

La bolsa tiene peso. Eso habla más que cualquier descripción.`,
    opciones: [
      {
        texto:          "💰 Aceptar el contrato (adelanto: +30 oro)",
        efecto:         { oro: 30 },
        siguienteEscena: 'camino_verano',
      },
      {
        texto:          "🔍 Pedir más información antes de decidir",
        siguienteEscena: 'detalles_contrato',
      },
      {
        texto:          "📊 Negociar un precio mejor (+50 oro)",
        efecto:         { oro: 50 },
        siguienteEscena: 'camino_verano',
      },
    ],
  },

  /* ── ESCENA 1B: DETALLES ────────────────────────────── */
  detalles_contrato: {
    id:     'detalles_contrato',
    titulo: "Más Información",
    imagen: "fondo-taberna",
    texto:
`Aldric se sienta. Acepta el vino que le ofrecés.

"Tres muertos en un mes. Uno de ellos un cazador veterano con
veinte años de experiencia. Antes de morir dijo que la criatura
'hablaba como un hombre pero se movía como el viento'."

Eso te hace frenar. Las bestias no hablan.

"También encontramos viales rotos cerca del último ataque.
Mi herbolario dice que son ingredientes de elixires de brujo.
Pero ningún brujo conocido vive por estos bosques."

Ahora sí esto se pone interesante.`,
    onEnter: () => applyEffect({ exp: 15 }),
    opciones: [
      {
        texto:          "⚔️ Aceptar — esto es más que una bestia común (+35 oro)",
        efecto:         { oro: 35 },
        siguienteEscena: 'camino_verano',
      },
    ],
  },

  /* ── ESCENA 2: EL CAMINO ─────────────────────────────── */
  camino_verano: {
    id:     'camino_verano',
    titulo: "El Camino a Verano",
    imagen: "fondo-bosque",
    texto:
`Media jornada de caminata al norte. Bosque denso, sin pájaros.
Ese silencio es siempre una señal.

A una legua del pueblo encontrás el primer indicio: un ciervo
muerto con heridas de precisión quirúrgica. No garras. No dientes.
Una hoja, o algo muy parecido.

Más adelante, un vial roto en el barro. Tu olfato de brujo lo
identifica al instante: Gato Negro — elixir de velocidad exclusivo
de la Escuela del Gato.

Alguien de tu gremio estuvo aquí. O algo que los imita.

Entre los árboles, un movimiento brusco.`,
    onEnter: () => applyEffect({ exp: 20 }),
    opciones: [
      {
        texto:          "🔍 Examinar las huellas con cuidado (+exp)",
        efecto:         { exp: 15 },
        siguienteEscena: 'huellas_dobles',
      },
      {
        texto:          "🐺 Investigar el movimiento en los árboles",
        siguienteEscena: 'encuentro_lobo_camino',
      },
      {
        texto:          "💨 Seguir al pueblo sin distracciones",
        siguienteEscena: 'pueblo_verano',
      },
    ],
  },

  /* ── ESCENA 2B: HUELLAS DOBLES ───────────────────────── */
  huellas_dobles: {
    id:     'huellas_dobles',
    titulo: "Dos Tipos de Huellas",
    imagen: "fondo-bosque",
    texto:
`Con la vista agudizada por el elixir, examinás el suelo.

Las huellas se superponen: zarpas de bestia grande y pisadas
humanas. Descalzas. Del mismo tamaño, siguiendo el mismo camino.

La bestia y el hombre son lo mismo.

No es una criatura normal. Es alguien — o algo — atrapado entre
dos formas. Un proceso de mutación que salió muy, muy mal.

Tu medallón vibra levemente. Reciente. Todavía está por aquí.`,
    onEnter: () => applyEffect({ exp: 25 }),
    opciones: [
      {
        texto:          "⚔️ Continuar al pueblo con esta información",
        siguienteEscena: 'pueblo_verano',
      },
    ],
  },

  /* ── ESCENA 2C: ENCUENTRO LOBO ───────────────────────── */
  encuentro_lobo_camino: {
    id:     'encuentro_lobo_camino',
    titulo: "El Lobo Maldito",
    imagen: "fondo-bosque",
    texto:
`Un lobo emerge de las sombras. Sus ojos brillan con luz propia
y se mueve de forma errática — controlado por algo externo.

Una bestia bajo influencia de magia oscura. No es el origen
del problema, pero te va a atacar de todas formas.

Desenvainás la espada de plata.`,
    opciones: [
      {
        texto:          "⚔️ Pelear (combate)",
        combate:        'lobo_maldito',
        escenaVictoria: 'pueblo_verano',
      },
      {
        texto:          "🏃 Huir hacia el pueblo (−10 vida)",
        efecto:         { vida: -10 },
        siguienteEscena: 'pueblo_verano',
      },
    ],
  },

  /* ── ESCENA 3: EL PUEBLO ─────────────────────────────── */
  pueblo_verano: {
    id:     'pueblo_verano',
    titulo: "El Pueblo de Verano",
    imagen: "fondo-aldea-quemada",
    texto:
`Las calles de Verano están vacías. Postigos cerrados en plena tarde.
El alcalde Aldric te espera en la plaza junto a una joven con
los ojos enrojecidos — la única sobreviviente del último ataque.

"Llegó de noche", dice la mujer sin que nadie se lo pregunte.
"Vi su cara por un segundo a la luz de la antorcha. No era
un animal. Tenía cara de hombre. Pero se movía como si el
viento lo llevara."

"Y tenía un medallón", agrega. "Como el tuyo."`,
    onEnter: () => applyEffect({ exp: 20 }),
    opciones: [
      {
        texto:          "🗣️ Interrogar a la sobreviviente a fondo (+exp)",
        efecto:         { exp: 20 },
        siguienteEscena: 'testimonio_sobreviviente',
      },
      {
        texto:          "🔍 Ir directo al lugar del último ataque",
        siguienteEscena: 'pistas_brujo',
      },
      {
        texto:          "💤 Descansar y recuperar fuerzas (+30 vida)",
        efecto:         { vida: 30 },
        siguienteEscena: 'pistas_brujo',
      },
    ],
  },

  /* ── ESCENA 3B: TESTIMONIO ───────────────────────────── */
  testimonio_sobreviviente: {
    id:     'testimonio_sobreviviente',
    titulo: "El Testimonio",
    imagen: "fondo-aldea-quemada",
    texto:
`La sobreviviente — Marta, se llama — te mira como si fuera
la primera vez que alguien la escucha de verdad.

"Tiene el medallón de un brujo. Un ojo de gato. Como el tuyo."

Eso te detiene.

"¿Y las manos?", preguntás.
"Una era normal. La otra estaba deformada. Como si hubiera
intentado algo y salió muy mal. Un brazo casi no parecía humano."

Sabés exactamente qué significa. Las mutaciones fallidas.
El gremio lo llama el proceso roto: cuando alguien intenta
amplificar sus mutaciones más allá del umbral que el cuerpo
puede tolerar.

Uno de los vuestros intentó volverse más. Y se quebró en el intento.`,
    onEnter: () => applyEffect({ exp: 30 }),
    opciones: [
      {
        texto:          "🏔️ Investigar el lugar del ataque",
        siguienteEscena: 'pistas_brujo',
      },
    ],
  },

  /* ── ESCENA 4: LAS PISTAS ─────────────────────────────── */
  pistas_brujo: {
    id:     'pistas_brujo',
    titulo: "Las Pistas del Brujo Roto",
    imagen: "fondo-aldea-quemada",
    texto:
`El último lugar de ataque: un establo en el borde del pueblo.

Usás el Aard para mover los escombros. Debajo, fórmulas de
mutágenos escritas en la madera. Nombres de elixires que solo
existen en los archivos secretos de la Escuela del Gato.

Y una carta a medias, escrita con mano temblorosa:

"Si alguien lee esto, fui el Brujo Gael, Escuela del Gato.
Intenté perfeccionar las mutaciones del Gato más allá del
segundo umbral. El proceso comenzó a deshacerse hace tres meses.
Ya no puedo controlar—"

La carta se interrumpe en medio de una palabra.

Las huellas al norte de este establo llevan a las montañas.`,
    onEnter: () => applyEffect({ exp: 35 }),
    opciones: [
      {
        texto:          "🏔️ Seguir el rastro a las montañas",
        siguienteEscena: 'cueva_exterior',
      },
      {
        texto:          "🗣️ Informar al alcalde antes de partir (+20 oro)",
        efecto:         { oro: 20 },
        siguienteEscena: 'cueva_exterior',
      },
    ],
  },

  /* ── ESCENA 5: CUEVA EXTERIOR ─────────────────────────── */
  cueva_exterior: {
    id:     'cueva_exterior',
    titulo: "La Cueva del Mutado",
    imagen: "fondo-bosque",
    texto:
`Dos horas de ascenso. La cueva es fácil de encontrar —
hay marcas de garras en todos los árboles del perímetro.

Desde adentro llega olor a elixires rancios y ozono.
El rastro de señales usadas repetidamente.

Tu medallón vibra con fuerza. Algo con poder de brujo
vive ahí adentro. Y lo lleva mucho tiempo.

Podés prepararte antes de entrar, o ir directo.`,
    opciones: [
      {
        texto:          "🧘 Meditar y recuperar fuerzas (+25 vida, +exp)",
        efecto:         { vida: 25, exp: 15 },
        siguienteEscena: 'laboratorio',
      },
      {
        texto:          "⚔️ Entrar directamente — el tiempo importa",
        siguienteEscena: 'laboratorio',
      },
      {
        texto:          "🔥 Usar Igni para revelar trampas antes de entrar (+daño inicial)",
        efecto:         { exp: 20 },
        siguienteEscena: 'laboratorio_ventaja',
      },
    ],
  },

  /* ── ESCENA 6A: EL LABORATORIO ────────────────────────── */
  laboratorio: {
    id:     'laboratorio',
    titulo: "El Laboratorio",
    imagen: "fondo-laboratorio",
    texto:
`El interior de la cueva es un laboratorio improvisado.
Cientos de viales. Fórmulas en las paredes. Un catre
cubierto de sangre. Años de trabajo desesperado.

"Lo sabía. Sabía que alguien vendría."

La voz sale de las sombras. Ronca, rota, mezclada con algo
que no es del todo humano.

De la oscuridad emerge La Bestia de Verano.
Veloz. Demasiado veloz.

No hay tiempo para hablar. Solo para sobrevivir.`,
    opciones: [
      {
        texto:          "⚔️ ¡Combatir! (Jefe — Dos Fases)",
        combate:        'jefe_final',
        escenaVictoria: 'confrontacion_final',
      },
    ],
  },

  /* ── ESCENA 6B: LABORATORIO CON VENTAJA ───────────────── */
  laboratorio_ventaja: {
    id:     'laboratorio_ventaja',
    titulo: "El Laboratorio",
    imagen: "fondo-laboratorio",
    texto:
`Igni revela tres trampas de alambre en el umbral. Las
desactivás en silencio antes de entrar. Gael no lo sabe.

El interior: un laboratorio desesperado. Años de trabajo
intentando perfeccionar algo que no debería perfeccionarse.

"Lo sabía. Sabía que alguien vendría."

Emerge de las sombras — pero ya tenés la posición.
Tu primer movimiento es tuyo.`,
    opciones: [
      {
        texto:          "⚔️ ¡Atacar primero! (Jefe con −15 vida inicial)",
        combate:        'jefe_final',
        escenaVictoria: 'confrontacion_final',
        dañoInicial:    15,
      },
    ],
  },

  /* ── ESCENA 7: CONFRONTACIÓN FINAL (post-combate) ─────── */
  confrontacion_final: {
    id:     'confrontacion_final',
    titulo: "El Brujo Caído",
    imagen: "fondo-laboratorio",
    texto:
`Gael está en el suelo. Su forma oscila entre humano y bestia —
el proceso de mutación atrapado entre dos estados.

Todavía respira. Te mira con unos ojos que, por primera vez,
no tienen locura. Solo unos segundos de lucidez.

"¿Ves estos viales? Estaba tan cerca. Solo quería demostrar
que las mutaciones del Gato podían llevarse más lejos.
Que podíamos ser más que guardianes pagos."

Tosé sangre negra.

"Terminá el trabajo. O dejame ir. No importa cuál.
Ya no hay vuelta atrás para mí de todas formas."

Tenés que decidir.`,
    onEnter: () => applyEffect({ exp: 50 }),
    opciones: [
      {
        texto:          "⚔️ Ejecutarlo — es tu deber y el del gremio",
        efecto:         { oro: 50 },
        siguienteEscena: 'final_ejecucion',
      },
      {
        texto:          "🕊️ Dejarlo ir — ya no es un peligro para nadie",
        siguienteEscena: 'final_misericordia',
      },
      {
        texto:          "🧪 Intentar estabilizarlo con tus elixires (−30 oro)",
        condicion:      () => player.oro >= 30,
        efecto:         { oro: -30 },
        siguienteEscena: 'final_estabilizacion',
      },
    ],
  },

  /* ── FINAL A: EJECUCIÓN ───────────────────────────────── */
  final_ejecucion: {
    id:     'final_ejecucion',
    titulo: "El Trabajo Está Hecho",
    imagen: "fondo-amanecer",
    texto:
`La espada de plata hace su trabajo.

Gael no grita. Cierra los ojos con algo que parece alivio.

Regresás a Verano con la prueba del contrato cumplido.
El alcalde Aldric te paga sin hacer preguntas. La gente
sale a la calle por primera vez en un mes.

En el camino de vuelta, guardás sus notas de investigación
en tu bolsa. No por respeto — por si algún día sirven de
advertencia a otro brujo que quiera ir demasiado lejos.

El camino del Gato sigue.
Siempre hay otro contrato esperando.

══════════════════════════════════════
   🎮 FIN — "El Precio del Experimento"
         FINAL A: El Deber Cumplido
══════════════════════════════════════`,
    onEnter: () => applyEffect({ oro: 50, exp: 30 }),
    opciones: [
      { texto: "🔄 Jugar de nuevo", siguienteEscena: '__reiniciar__' },
    ],
  },

  /* ── FINAL B: MISERICORDIA ────────────────────────────── */
  final_misericordia: {
    id:     'final_misericordia',
    titulo: "El Camino del Gato",
    imagen: "fondo-amanecer",
    texto:
`"Andate", le decís. "Lejos de aquí. Si volvés a atacar gente,
la próxima vez no habrá conversación."

Gael asiente. Con un esfuerzo enorme, se pone de pie
y desaparece en las profundidades de la cueva.

Regresás a Verano y le decís al alcalde que la amenaza terminó.
Sin detalles. No necesitan saber que el monstruo sigue vivo.

Aldric te paga a regañadientes. No parece convencido.
Tampoco vos.

Pero en el camino de vuelta, pensás en Gael. En lo que intentó.
En cuánto de eso era locura y cuánto era simplemente
un brujo queriendo ser más de lo que el mundo le permitía.

No sabés la respuesta. Quizás nadie la sabe.

══════════════════════════════════════
   🎮 FIN — "El Precio del Experimento"
      FINAL B: La Misericordia del Gato
══════════════════════════════════════`,
    onEnter: () => applyEffect({ exp: 40 }),
    opciones: [
      { texto: "🔄 Jugar de nuevo", siguienteEscena: '__reiniciar__' },
    ],
  },

  /* ── FINAL C: ESTABILIZACIÓN (requiere 30 oro) ────────── */
  final_estabilizacion: {
    id:     'final_estabilizacion',
    titulo: "El Experimento Continúa",
    imagen: "fondo-amanecer",
    texto:
`Combinás tus elixires con los de Gael. Es arriesgado —
dos conjuntos de fórmulas que no están diseñadas para mezclarse.
Pero funciona.

La forma de Gael se estabiliza. Humano. Completamente humano.

"No lo esperaba", dice con la voz de alguien que volvió
de muy lejos.

No podés decirle que la estabilización es temporal. Que tiene
meses, quizás un año. Que lo que hizo no tiene cura real con
el conocimiento actual.

Pero un año es un año. Y un brujo con un año de tiempo puede
escribir todo lo que sabe. Un mapa del territorio para que
el próximo que intente esto no caiga de la misma forma.

Regresás a Verano. Cobrás el contrato.
Y dejás atrás una cueva con un brujo que tiene trabajo pendiente.

══════════════════════════════════════
   🎮 FIN — "El Precio del Experimento"
      FINAL C: El Alquimista Herido
══════════════════════════════════════`,
    onEnter: () => applyEffect({ exp: 80, oro: 40 }),
    opciones: [
      { texto: "🔄 Jugar de nuevo", siguienteEscena: '__reiniciar__' },
    ],
  },

  /* ── MUERTE ───────────────────────────────────────────── */
  muerte: {
    id:     'muerte',
    titulo: "El Brujo del Gato Cae",
    imagen: "fondo-muerte",
    texto:
`La Escuela del Gato entrena para no fallar.
Esta vez fallaste.

La oscuridad llega rápido — al menos eso tienen de bueno
los brujos del Gato. Saben exactamente cuándo una batalla
está perdida.

Gael te mira desde las sombras. Por un momento,
sus ojos parecen tener algo de lamento.

Después desaparece. El contrato quedó sin cumplir.
El pueblo de Verano sigue esperando.

═══════════════════════
💀 FIN — Misión fallida
═══════════════════════`,
    opciones: [
      { texto: "🔄 Volver a intentarlo", siguienteEscena: '__reiniciar__' },
    ],
  },
};


/* ======================================================
   6. MOTOR DE ESCENAS
   ====================================================== */

/**
 * Carga y renderiza una escena por su ID.
 * Si el ID es '__reiniciar__', reinicia el juego.
 * @param {string} sceneId — clave en SCENES
 */
function loadScene(sceneId) {
  if (sceneId === '__reiniciar__') {
    reiniciarJuego();
    return;
  }

  const scene = SCENES[sceneId];
  if (!scene) {
    console.error(`[game] Escena no encontrada: "${sceneId}"`);
    return;
  }

  // Ocultar combate, mostrar narración
  combat.activo = false;
  document.getElementById('combat-panel').classList.add('hidden');
  document.getElementById('scene-panel').classList.remove('hidden');

  // Aplicar fondo (clase CSS de style.css)
  document.getElementById('scene-bg').className = scene.imagen || 'fondo-taberna';

  // Rellenar contenido
  document.getElementById('scene-title').textContent = scene.titulo;
  document.getElementById('scene-text').textContent  = scene.texto;

  // Ejecutar lógica de entrada
  if (typeof scene.onEnter === 'function') scene.onEnter();

  // Crear botones de opciones
  renderOptions(scene.opciones || []);

  updateStats();

  // Animación de transición
  const panel = document.getElementById('scene-panel');
  panel.classList.remove('fade-in');
  void panel.offsetWidth; // forzar reflow para reiniciar la animación
  panel.classList.add('fade-in');
}

/**
 * Crea y monta los botones de opciones de la escena.
 * Soporta: siguienteEscena, combate, efecto, condicion.
 * @param {Array} opciones
 */
function renderOptions(opciones) {
  const container = document.getElementById('scene-options');
  container.innerHTML = '';

  opciones.forEach((opcion) => {
    // Si tiene condición y no se cumple, no mostrar
    if (typeof opcion.condicion === 'function' && !opcion.condicion()) return;

    const btn = document.createElement('button');
    btn.className   = 'btn-opcion';
    btn.textContent = opcion.texto;

    btn.addEventListener('click', () => {
      // Primero aplicar el efecto de la opción (costo/beneficio)
      if (opcion.efecto) applyEffect(opcion.efecto);

      // Luego ejecutar la acción
      if (opcion.combate) {
        startCombat(
          opcion.combate,
          opcion.escenaVictoria || 'muerte',
          opcion.dañoInicial    || 0
        );
      } else if (opcion.siguienteEscena) {
        loadScene(opcion.siguienteEscena);
      }
    });

    container.appendChild(btn);
  });
}

/**
 * Aplica cambios a las stats del jugador y muestra notificación.
 * @param {Object} efecto — { vida?, oro?, exp? }
 */
function applyEffect(efecto) {
  if (!efecto) return;
  const partes = [];

  if (efecto.vida !== undefined) {
    const antes  = player.vida;
    player.vida  = Math.min(player.vidaMax, Math.max(0, player.vida + efecto.vida));
    const delta  = player.vida - antes;
    if (delta > 0) partes.push(`+${delta} ❤️`);
    if (delta < 0) partes.push(`${delta} ❤️`);
  }

  if (efecto.oro !== undefined) {
    const antes = player.oro;
    player.oro  = Math.max(0, player.oro + efecto.oro);
    const delta = player.oro - antes;
    if (delta > 0) partes.push(`+${delta} 💰`);
    if (delta < 0) partes.push(`${delta} 💰`);
  }

  if (efecto.exp !== undefined && efecto.exp > 0) {
    player.experiencia += efecto.exp;
    partes.push(`+${efecto.exp} ⭐`);
    checkLevelUp();
  }

  updateStats();
  if (partes.length > 0) showNotification(partes.join('   '));
}

/**
 * Verifica y aplica subida de nivel.
 * Requisito: nivel × 100 exp acumulados.
 */
function checkLevelUp() {
  const expRequerida = player.nivel * 100;
  if (player.experiencia >= expRequerida) {
    player.nivel++;
    player.vidaMax += 20;
    const curado = Math.min(30, player.vidaMax - player.vida);
    player.vida += curado;
    showNotification(`⬆️ ¡NIVEL ${player.nivel}! +20 vida máx, +${curado} vida`);
  }
}


/* ======================================================
   7. HELPERS DE COMBATE
   ====================================================== */

/**
 * Calcula el daño de un ataque con variación aleatoria y críticos.
 * @param {number} min        — daño mínimo
 * @param {number} max        — daño máximo
 * @param {number} critChance — probabilidad de crítico (0–1)
 * @param {number} critMult   — multiplicador del crítico
 * @returns {{ daño: number, esCritico: boolean }}
 */
function calcularDaño(min, max, critChance = 0.15, critMult = 1.8) {
  const base      = Math.floor(Math.random() * (max - min + 1)) + min;
  const esCritico = Math.random() < critChance;
  const daño      = esCritico ? Math.floor(base * critMult) : base;
  return { daño, esCritico };
}

/**
 * Verifica si un ataque es esquivado según la velocidad del objetivo.
 * @param {number} velocidad — probabilidad de esquiva (0–1)
 * @returns {boolean}
 */
function verificarEsquiva(velocidad = 0) {
  return Math.random() < velocidad;
}


/* ======================================================
   8. SISTEMA DE COMBATE
   ====================================================== */

/**
 * Inicia un combate.
 * Si enemigoKey === 'jefe_final', usa el objeto BOSS.
 * @param {string} enemigoKey     — clave en ENEMIES o 'jefe_final'
 * @param {string} escenaVictoria — escena a cargar al ganar
 * @param {number} dañoInicial    — vida descontada antes del combate
 */
function startCombat(enemigoKey, escenaVictoria, dañoInicial = 0) {
  let enemigo;

  if (enemigoKey === 'jefe_final') {
    combat.esBoss     = true;
    combat.faseActual = 1;
    enemigo           = BOSS.fase1;
  } else {
    combat.esBoss = false;
    enemigo       = ENEMIES[enemigoKey];
    if (!enemigo) {
      console.error(`[game] Enemigo no encontrado: "${enemigoKey}"`);
      return;
    }
  }

  // Inicializar estado
  combat.activo            = true;
  combat.enemigo           = enemigo;
  combat.enemigoVida       = Math.max(1, enemigo.vidaMax - dañoInicial);
  combat.escenaVictoria    = escenaVictoria;
  combat.esquivandoJugador = false;
  combat.enemigoEsquivando = false;
  combat.igniCooldown      = 0;
  combat.burnTurnos        = 0;
  combat.enTransicion      = false;

  // Mostrar combate
  document.getElementById('scene-panel').classList.add('hidden');
  document.getElementById('combat-panel').classList.remove('hidden');
  document.getElementById('combat-panel').classList.remove('boss-fase2');

  document.getElementById('enemy-visual').textContent = enemigo.visual;
  document.getElementById('enemy-name').textContent   = enemigo.nombre;

  // Ocultar badge de fase 2 al comenzar
  document.getElementById('combat-fase').classList.add('hidden');

  // Ocultar indicadores de estado
  document.getElementById('combat-burn').classList.add('hidden');
  document.getElementById('combat-crit-flash').classList.add('hidden');

  // Resetear Igni
  resetIgniButton();
  setBotonsCombate(true);

  let msg = enemigo.descripcion;
  if (dañoInicial > 0) msg += ` [Golpe inicial aplicado: −${dañoInicial} vida.]`;
  setCombatMessage(msg, false);

  updateCombatBars();
  updateStats();
}

/**
 * Procesa la acción elegida por el jugador en su turno.
 * Flujo por turno:
 *   1. Daño de quemadura (burn) si está activa
 *   2. Acción del jugador
 *   3. Verificar si el enemigo murió / fase del boss
 *   4. Turno del enemigo
 *   5. Verificar si el jugador murió
 * @param {string} accion — 'atacar' | 'esquivar' | 'igni'
 */
function combatAction(accion) {
  if (!combat.activo || combat.enTransicion) return;

  const msgs            = [];
  let   dañoAlEnemigo   = 0;
  let   huboCritico     = false;
  combat.esquivandoJugador = false;

  /* ── 1. DAÑO DE QUEMADURA (burn de Igni) ── */
  if (combat.burnTurnos > 0) {
    combat.enemigoVida = Math.max(0, combat.enemigoVida - combat.burnDaño);
    combat.burnTurnos--;
    msgs.push(`🔥 Quemadura: ${combat.burnDaño} daño al ${combat.enemigo.nombre}. (${combat.burnTurnos} turnos restantes)`);

    // Actualizar indicador de burn
    const burnEl = document.getElementById('combat-burn');
    if (combat.burnTurnos > 0) {
      burnEl.textContent = `🔥 Quemando (${combat.burnTurnos})`;
      burnEl.classList.remove('hidden');
    } else {
      burnEl.classList.add('hidden');
    }

    // ¿Murió el enemigo por quemadura?
    if (combat.enemigoVida <= 0) {
      msgs.push(`¡${combat.enemigo.nombre} murió por las llamas!`);
      setCombatMessage(msgs.join(' | '), false);
      updateCombatBars();
      endCombat(true);
      return;
    }
  }

  /* ── 2. ACCIÓN DEL JUGADOR ── */
  switch (accion) {

    case 'atacar': {
      const resultado = calcularDaño(12, 22, 0.20, 1.85);
      dañoAlEnemigo   = resultado.daño;
      huboCritico     = resultado.esCritico;

      if (verificarEsquiva(combat.enemigo.velocidad)) {
        msgs.push(`${combat.enemigo.nombre} esquivó el ataque.`);
        dañoAlEnemigo = 0;
      } else if (huboCritico) {
        msgs.push(`⚡ ¡GOLPE CRÍTICO! ${dañoAlEnemigo} de daño al ${combat.enemigo.nombre}.`);
        mostrarCritico();
      } else {
        msgs.push(`⚔️ Atacás al ${combat.enemigo.nombre}: ${dañoAlEnemigo} de daño.`);
      }
      break;
    }

    case 'esquivar': {
      // Postura de esquiva: counterataca y el daño enemigo cae al 15%
      combat.esquivandoJugador = true;
      const contra = calcularDaño(5, 12, 0.10, 1.4);
      dañoAlEnemigo = contra.daño;
      msgs.push(`🛡️ Tomás postura de esquiva y contraatacás por ${dañoAlEnemigo}.`);
      break;
    }

    case 'igni': {
      if (combat.igniCooldown > 0) {
        showNotification(`🔥 Igni en recarga: ${combat.igniCooldown} turno/s`);
        return; // no se consume el turno del jugador
      }
      const resultado = calcularDaño(22, 42, 0.25, 2.0);
      dañoAlEnemigo   = resultado.daño;
      huboCritico     = resultado.esCritico;

      // Igni es más difícil de esquivar que un ataque físico
      if (verificarEsquiva(combat.enemigo.velocidad * 0.5)) {
        dañoAlEnemigo    = Math.floor(dañoAlEnemigo * 0.35);
        msgs.push(`🔥 Igni lanzado — ${combat.enemigo.nombre} lo esquivó parcialmente. ${dañoAlEnemigo} de daño. Sin quemadura.`);
      } else {
        combat.burnTurnos   = 3;
        combat.igniCooldown = 3;
        if (huboCritico) {
          msgs.push(`🔥⚡ ¡IGNI CRÍTICO! ${dañoAlEnemigo} de daño + quemadura activada (3 turnos).`);
          mostrarCritico();
        } else {
          msgs.push(`🔥 Señal Igni: ${dañoAlEnemigo} de daño + quemadura activa (3 turnos).`);
        }
        // Mostrar indicador de burn
        const burnEl = document.getElementById('combat-burn');
        burnEl.textContent = `🔥 Quemando (3)`;
        burnEl.classList.remove('hidden');
      }
      // El cooldown se establece arriba solo si Igni no fue esquivado
      if (combat.igniCooldown === 0 && combat.burnTurnos === 0) {
        combat.igniCooldown = 3; // cooldown igual si fue esquivado
      }
      break;
    }
  }

  /* ── 3. APLICAR DAÑO AL ENEMIGO ── */
  // Reducir por defensa del enemigo (mínimo 1 si hubo impacto)
  if (dañoAlEnemigo > 0) {
    const defensa     = combat.enemigo.defensa || 0;
    dañoAlEnemigo     = Math.max(1, dañoAlEnemigo - defensa);
    // Si el enemigo estaba en stance defensiva (boss fase 2), reducir aún más
    if (combat.enemigoEsquivando) {
      dañoAlEnemigo          = Math.max(1, Math.floor(dañoAlEnemigo * 0.18));
      combat.enemigoEsquivando = false;
      msgs.push(`[Quen de Gael absorbió el golpe — solo ${dañoAlEnemigo} de daño.]`);
    }
  }
  combat.enemigoVida = Math.max(0, combat.enemigoVida - dañoAlEnemigo);

  /* ── 3B. VERIFICAR TRANSICIÓN DE FASE (boss) ── */
  if (combat.esBoss && combat.faseActual === 1) {
    const pct = combat.enemigoVida / BOSS.fase1.vidaMax;
    if (pct <= BOSS.umbralFase2) {
      setCombatMessage(msgs.join(' | '), false);
      updateCombatBars();
      iniciarTransicionFase2();
      return;
    }
  }

  /* ── 3C. VERIFICAR MUERTE DEL ENEMIGO ── */
  if (combat.enemigoVida <= 0) {
    msgs.push(`¡${combat.enemigo.nombre} ha caído!`);
    setCombatMessage(msgs.join(' | '), false);
    updateCombatBars();
    endCombat(true);
    return;
  }

  /* ── 4. TURNO DEL ENEMIGO ── */
  const msgsEnemigo = turnoEnemigo();
  msgsEnemigo.forEach(m => msgs.push(m));

  /* ── ACTUALIZAR COOLDOWN DE IGNI ── */
  if (combat.igniCooldown > 0) {
    combat.igniCooldown--;
    updateIgniButton();
  } else {
    updateIgniButton();
  }

  /* ── ACTUALIZAR UI ── */
  setCombatMessage(msgs.join(' | '), false);
  updateCombatBars();
  updateStats();

  /* ── 5. VERIFICAR MUERTE DEL JUGADOR ── */
  if (player.vida <= 0) {
    setCombatMessage(msgs.join(' | ') + ' | 💀 Tu vida cayó a cero...', false);
    setTimeout(() => endCombat(false), 1800);
  }
}

/**
 * Ejecuta el turno del enemigo y devuelve array de mensajes.
 * Si el jugador esquivó, el enemigo solo hace daño residual.
 * @returns {string[]}
 */
function turnoEnemigo() {
  // Si el jugador esquivó: el enemigo prácticamente no hace daño
  if (combat.esquivandoJugador) {
    const rozón = Math.max(1, Math.floor(
      (Math.floor(Math.random() * (combat.enemigo.ataqueMax - combat.enemigo.ataqueMin + 1)) +
       combat.enemigo.ataqueMin) * 0.12
    ));
    player.vida = Math.max(0, player.vida - rozón);
    return [`Esquivaste el ataque — solo ${rozón} de rozón.`];
  }

  // Boss fase 2 tiene su propia IA
  if (combat.esBoss && combat.faseActual === 2) {
    return turnoEnemigoBossFase2();
  }

  // Enemigo regular: ataque con posibilidad de crítico
  const { daño, esCritico } = calcularDaño(
    combat.enemigo.ataqueMin,
    combat.enemigo.ataqueMax,
    combat.enemigo.critChance,
    combat.enemigo.critMult
  );

  player.vida = Math.max(0, player.vida - daño);

  if (esCritico) {
    return [`💥 ¡CRÍTICO del ${combat.enemigo.nombre}! ${daño} de daño.`];
  }

  const frases = [
    `${combat.enemigo.nombre} ataca — ${daño} de daño.`,
    `Golpe del ${combat.enemigo.nombre}: recibís ${daño}.`,
    `El ${combat.enemigo.nombre} arremete — ${daño} de daño.`,
  ];
  return [frases[Math.floor(Math.random() * frases.length)]];
}


/* ======================================================
   9. IA DEL BOSS FASE 2 — Gael el Mutado

   Elige entre cuatro habilidades con probabilidades configuradas
   en BOSS.fase2.habilidades y BOSS.fase2.probabilidades.
   Si tiene menos del 20% de vida, puede curar de emergencia.
   ====================================================== */

/**
 * @returns {string[]} array de mensajes del turno
 */
function turnoEnemigoBossFase2() {
  const msgs = [];
  const fase2 = BOSS.fase2;

  // Override de emergencia: si está muy bajo de vida, probable curación
  const pctVida = combat.enemigoVida / fase2.vidaMax;
  let accionElegida = elegirHabilidadBoss();
  if (pctVida < fase2.umbralCuracionEmergencia && Math.random() < 0.65) {
    accionElegida = 'curar';
  }

  switch (accionElegida) {

    case 'atacar': {
      const { daño, esCritico } = calcularDaño(
        fase2.ataqueMin, fase2.ataqueMax, fase2.critChance, fase2.critMult
      );
      player.vida = Math.max(0, player.vida - daño);
      if (esCritico) {
        msgs.push(`💥 Gael lanza un golpe calculado: ¡CRÍTICO! ${daño} de daño.`);
      } else {
        msgs.push(`🧙 Gael te embiste con una velocidad que reconocés. ${daño} de daño.`);
      }
      break;
    }

    case 'señal': {
      // Señal de Igni del mutado — daño mágico, ignora defensa del jugador
      const dañoMagico = Math.floor(Math.random() * 18) + 14; // 14–32
      player.vida = Math.max(0, player.vida - dañoMagico);
      msgs.push(`🔥 ¡Gael usa Igni mutado! Llamaradas que reconocés. ${dañoMagico} de daño mágico.`);
      break;
    }

    case 'curar': {
      const curado = Math.floor(fase2.vidaMax * 0.13); // cura 13% de vida máx
      combat.enemigoVida = Math.min(fase2.vidaMax, combat.enemigoVida + curado);
      msgs.push(`✨ Gael bebe un elixir de sus reservas. Se cura ${curado} vida.`);
      break;
    }

    case 'esquivar_activo': {
      // Gael activa Quen — próximo ataque del jugador hará mínimo daño
      combat.enemigoEsquivando = true;
      msgs.push(`🛡️ Gael lanza Quen. Absorbió tu próximo golpe casi por completo.`);
      break;
    }
  }

  return msgs;
}

/**
 * Elige una habilidad del boss según las probabilidades configuradas.
 * @returns {string} nombre de la habilidad
 */
function elegirHabilidadBoss() {
  const habilidades    = BOSS.fase2.habilidades;
  const probabilidades = BOSS.fase2.probabilidades;
  const rand = Math.random();
  let acumulado = 0;

  for (let i = 0; i < habilidades.length; i++) {
    acumulado += probabilidades[i];
    if (rand <= acumulado) return habilidades[i];
  }
  return habilidades[0]; // fallback
}


/* ======================================================
   10. TRANSICIÓN DE FASE DEL BOSS

   Cuando la fase 1 cae al umbral, el combate se pausa,
   se muestra el texto de revelación y tras 3 segundos
   la fase 2 comienza con stats y visual nuevos.
   ====================================================== */

/**
 * Pausa el combate, muestra el cutscene de revelación
 * y luego activa la fase 2 del boss.
 */
function iniciarTransicionFase2() {
  combat.enTransicion = true;
  setBotonsCombate(false);

  // Mensaje de revelación con estilo especial
  setCombatMessage(
    '⚡ LA BESTIA SE DETIENE. Su forma tiembla entre animal y humano. ' +
    '"Soy... Gael. Fui Brujo del Gato. Intenté ir más lejos que nadie." ' +
    '"No puedo controlar esto ya. Pero recuerdo quién fui."' +
    ' ...El combate no terminó.',
    true // modo revelación
  );

  // Efecto visual en el panel
  document.getElementById('combat-panel').classList.add('fase-transition');

  setTimeout(() => {
    const fase2 = BOSS.fase2;

    // Actualizar visual
    document.getElementById('enemy-visual').textContent = fase2.visual;
    document.getElementById('enemy-name').textContent   = fase2.nombre;
    document.getElementById('combat-panel').classList.add('boss-fase2');
    document.getElementById('combat-panel').classList.remove('fase-transition');

    // Mostrar badge de fase 2
    const faseEl = document.getElementById('combat-fase');
    faseEl.textContent = '⚡ FASE 2';
    faseEl.classList.remove('hidden');

    // Inicializar stats de fase 2
    combat.faseActual  = 2;
    combat.enemigo     = fase2;
    combat.enemigoVida = fase2.vidaMax;
    combat.burnTurnos  = 0; // resetear burn al cambiar de fase

    document.getElementById('combat-burn').classList.add('hidden');

    setCombatMessage(
      `⚡ FASE 2 — ${fase2.nombre}. ${fase2.descripcion} ` +
      'Ahora recuerda sus señales. Prepárate.',
      true
    );

    updateCombatBars();
    combat.enTransicion = false;
    setBotonsCombate(true);
  }, 3200);
}


/* ======================================================
   11. FIN DE COMBATE
   ====================================================== */

/**
 * Finaliza el combate, otorga recompensas y carga la siguiente escena.
 * @param {boolean} victoria
 */
function endCombat(victoria) {
  combat.activo = false;

  if (victoria) {
    let recompensa = { oro: 0, exp: 0 };

    if (combat.esBoss && combat.faseActual === 2) {
      // Recompensa del boss es la de la fase 2
      recompensa = { oro: BOSS.fase2.recompensaOro, exp: BOSS.fase2.recompensaExp };
    } else if (!combat.esBoss) {
      recompensa = {
        oro: combat.enemigo.recompensaOro || 0,
        exp: combat.enemigo.recompensaExp || 0,
      };
    }

    if (recompensa.oro > 0 || recompensa.exp > 0) {
      applyEffect(recompensa);
      showNotification(`🏆 ¡Victoria!  +${recompensa.oro} 💰  +${recompensa.exp} ⭐`);
    }

    setTimeout(() => loadScene(combat.escenaVictoria), 2000);
  } else {
    setTimeout(() => loadScene(combat.escenaMuerte), 2000);
  }
}


/* ======================================================
   12. UI DE COMBATE
   ====================================================== */

/** Actualiza ambas barras de vida en el panel de combate. */
function updateCombatBars() {
  // Vida máxima del enemigo según la fase actual
  const vidaMaxEnemigo = (combat.esBoss && combat.faseActual === 2)
    ? BOSS.fase2.vidaMax
    : combat.enemigo.vidaMax;

  // Barra del enemigo (rojo cuando tiene mucha vida, verde cuando está por morir)
  const enemPct = Math.max(0, (combat.enemigoVida / vidaMaxEnemigo) * 100);
  const enemBar = document.getElementById('enemy-vida-bar');
  enemBar.style.width = `${enemPct}%`;
  enemBar.style.background =
    enemPct > 60 ? '#f87171' :
    enemPct > 30 ? '#fb923c' : '#facc15';
  document.getElementById('enemy-vida-text').textContent =
    `${combat.enemigoVida} / ${vidaMaxEnemigo}`;

  // Barra del jugador
  const jugPct  = Math.max(0, (player.vida / player.vidaMax) * 100);
  const jugBar  = document.getElementById('player-combat-vida-bar');
  jugBar.style.width = `${jugPct}%`;
  jugBar.style.background =
    jugPct > 60 ? '#4ade80' :
    jugPct > 30 ? '#facc15' : '#f87171';
  document.getElementById('player-combat-vida-text').textContent =
    `${player.vida} / ${player.vidaMax}`;
}

/**
 * Actualiza el mensaje en el log de combate.
 * @param {string}  msg        — texto a mostrar
 * @param {boolean} revelacion — true: aplica estilo dramático
 */
function setCombatMessage(msg, revelacion = false) {
  const el = document.getElementById('combat-message');
  el.textContent = msg;
  el.classList.toggle('revelacion', revelacion);
}

/** Muestra el badge de golpe crítico brevemente. */
function mostrarCritico() {
  const el = document.getElementById('combat-crit-flash');
  el.classList.remove('hidden', 'crit-flash');
  void el.offsetWidth;
  el.classList.add('crit-flash');
  setTimeout(() => el.classList.add('hidden'), 600);
}

/** Habilita o deshabilita todos los botones de combate. */
function setBotonsCombate(habilitado) {
  document.querySelectorAll('.btn-combat').forEach(btn => {
    btn.disabled = !habilitado;
  });
}

/** Resetea el botón de Igni a su estado inicial. */
function resetIgniButton() {
  const btn = document.getElementById('btn-igni');
  btn.textContent = '🔥 Señal Igni';
  btn.disabled    = false;
}

/** Actualiza el texto y estado del botón de Igni según el cooldown. */
function updateIgniButton() {
  const btn = document.getElementById('btn-igni');
  if (combat.igniCooldown > 0) {
    btn.textContent = `🔥 Igni (${combat.igniCooldown} turnos)`;
    btn.disabled    = true;
  } else {
    btn.textContent = '🔥 Señal Igni';
    btn.disabled    = false;
  }
}


/* ======================================================
   13. STATS Y NOTIFICACIONES
   ====================================================== */

/** Actualiza la barra de stats superior con los valores actuales. */
function updateStats() {
  const pct = (player.vida / player.vidaMax) * 100;

  document.getElementById('vida-value').textContent = `${player.vida}/${player.vidaMax}`;

  const vidaBar = document.getElementById('vida-bar');
  vidaBar.style.width = `${Math.max(0, pct)}%`;
  vidaBar.style.background =
    pct > 60 ? '#4ade80' :
    pct > 30 ? '#facc15' : '#f87171';

  document.getElementById('oro-value').textContent   = player.oro;
  document.getElementById('exp-value').textContent   = player.experiencia;
  document.getElementById('nivel-value').textContent = player.nivel;
}

/**
 * Muestra una notificación flotante que desaparece en 2.6 segundos.
 * @param {string} mensaje
 */
function showNotification(mensaje) {
  const notif = document.getElementById('notification');
  notif.textContent = mensaje;
  notif.classList.remove('hidden');
  notif.classList.add('show');
  setTimeout(() => {
    notif.classList.remove('show');
    notif.classList.add('hidden');
  }, 2600);
}


/* ======================================================
   14. REINICIO E INICIALIZACIÓN
   ====================================================== */

/** Reinicia todas las variables y vuelve al inicio. */
function reiniciarJuego() {
  player.vida        = 100;
  player.vidaMax     = 100;
  player.oro         = 50;
  player.experiencia = 0;
  player.nivel       = 1;

  combat.activo            = false;
  combat.esBoss            = false;
  combat.faseActual        = 1;
  combat.igniCooldown      = 0;
  combat.burnTurnos        = 0;
  combat.enTransicion      = false;
  combat.enemigoEsquivando = false;

  document.getElementById('combat-fase').classList.add('hidden');
  document.getElementById('combat-burn').classList.add('hidden');

  updateStats();
  loadScene('taberna_contrato');
}

// Arrancar el juego cuando la página esté lista
document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  loadScene('taberna_contrato');
});
